import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type {
  Card,
  DepositRefundedWhy,
  QuoteOption,
  QuoteStatus,
} from "@empire-cleaning/models";
import {
  catalog,
  clientPaying as clientPayingWords,
  dayOf,
  formats,
  inLanguage,
  messages,
  MINUTE_MS,
} from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { db, type Tx } from "../../db/index.ts";
import {
  ConflictError,
  fieldError,
  NotFoundError,
} from "../../middleware/errors.ts";
import { clock } from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import {
  paymentGateway,
  type DepositAttempt,
} from "../../services/payment-gateway/index.ts";
import { weeklyBillOf } from "../bills/billed-weekly.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { bookJob, lockDay } from "../jobs/jobs.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { scheduleFor } from "../jobs/schedule.ts";
import {
  payerFor,
  cardIn,
  paymentMethodOf,
  storePaymentMethod,
} from "../payments/payments.ts";
import {
  APPROVAL_MS,
  approvalOf,
  depositAttemptOf,
  giveBackDeposit,
  giveBackUnbookedDeposits,
  keepTaken,
  takeDepositOnce,
  UNREACHABLE,
  type Approval,
  type DepositTaken,
} from "../payments/money.ts";
import { idempotencyKey } from "../payments/keys.ts";
import { charges, type ChargeAttempt } from "../payments/payments.schema.ts";
import { whyNotPaid } from "../payments/unpaid.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import {
  afterTermsChanged,
  changeServicePlanTerms,
  holdForChange,
} from "../service-plans/changing.ts";
import {
  currentPlanOf,
  generateServicePlanJobs,
  startServicePlan,
} from "../service-plans/service-plans.ts";
import type { FirstJobs } from "../service-plans/first-visits.ts";
import type { ServicePlan } from "../service-plans/service-plans.schema.ts";
import { cleanOf, serviceVersions } from "../services/services.ts";
import {
  bookingConfirmationEmail,
  depositCalledOffEmail,
  depositRefundedEmail,
  planChangeEmail,
  planConfirmationEmail,
  type DepositFor,
  type Paid,
  type QuoteSince,
  type PaidWith,
  type PlanCleans,
} from "./emails.ts";
import { lockProperty } from "../properties/locking.ts";
import { warnOfficeOfQuotesWithoutRoom } from "./quote-room.ts";
import { offers, statusOf, whatClosed } from "./quote-state.ts";
import { whyClosed, whyUnbookable, type Unbookable } from "./rules.ts";
import {
  dropDraftRevision,
  inOrder,
  optionsOf,
  payingOf,
  toOption,
  type KindedRevision,
} from "./quotes.ts";
import {
  pendingDeposits,
  quoteRevisions,
  quotes,
  type Quote,
} from "./quotes.schema.ts";
import { log, monitoring } from "../../services/monitoring/index.ts";

// the payment's description, a record: English (ADR-0025)
const { formatWhen } = formats.en;

// who is accepting: the Client, from the portal, or Office Staff recording
// the Client's acceptance on their behalf (they never enter card details: the
// Client's saved Payment Method is charged)
export type Acceptor =
  | { by: "client"; clientId: string; accountId: string }
  | { by: "office"; accountId: string };

// what a Deposit waiting on the Client's bank books: a one-off Quote's
// clean, a plan started, or the home's plan changed
type Paying = "clean" | "plan" | "change";

// What the API says to someone accepting a Quote, in the request's language
// (ADR-0025): the Client's words, and those the Office reads too. The
// Office's own stay English, where they're said
const words = catalog({
  en: {
    // the payment provider couldn't be reached
    PAYMENT_DOWN:
      "Something went wrong taking the payment, so nothing was booked. Please try again in a few minutes.",
    sendFirst: "Send it first.",
    askNew: "Ask us for a new one.",
    revised:
      "This quote was just updated, so nothing was booked. Please reload the page to see it.",
    planChanged:
      "Your cleaning plan changed just now, so nothing was booked. Please reload the page and try again.",
    bookedUp:
      "Sorry, that time just got booked up, so nothing was charged. We'll be in touch with another time.",
    addCard: "Add a card to accept this quote.",
    cardFailed: (because: string) =>
      `Your card didn't go through${because}, so nothing was booked. Please try another card.`,
    planFor: (services: string) => `This cleaning plan is for ${services}.`,
    aService: (name: string) => `a ${name}`,
    pick: (services: string) => `Pick ${services}`,
    // back from their bank with the payment not yet approved: approving
    // it in their bank's app books it, and pressing again starts over, as
    // a closed pop-up may leave it either way (#534)
    waiting: (what: Paying) =>
      `Your bank hasn't approved the payment yet. Approve it in your bank's app to ${{ clean: "book your clean", plan: "start your plan", change: "change your plan" }[what]}. Or press Accept and pay to start over: the first payment is called off, so you're only charged once.`,
    // pressed again while their bank finishes the first payment: its own
    // words, as only here has the Client paid already, so "nothing more"
    // (PAYMENT_DOWN is the provider unreachable, the Bill's `ours` a
    // payment we take). The page, not an email, as one that fails then
    // sends none (#534 review F5, F15)
    processing:
      "Your first payment is still going through with your bank, so nothing more was charged. It usually takes a few minutes: reload this page then to see how it went.",
    calledOff: (minutes: number) =>
      `This payment was called off, as it wasn't approved within ${minutes} minutes, so nothing was charged. Please pay again.`,
    bankFailed:
      "Your bank didn't approve the payment, so nothing was booked. Please try again, or use another card.",
    refundedNoRoom:
      "Sorry, that time got booked up while your bank was approving the payment. We've refunded your deposit, and we'll be in touch with another time.",
    refundedPlan:
      "Your cleaning plan started while your bank was approving the payment, so we've refunded your deposit.",
    refundedRevised:
      "This quote was updated while your bank was approving the payment, so we've refunded your deposit. Please take a look at what's changed.",
    refundedClosed:
      "This quote closed while your bank was approving the payment, so we've refunded your deposit.",
    nothingWaiting: "There's no payment waiting on this quote.",
  },
  es: {
    PAYMENT_DOWN:
      "Algo salió mal al cobrar el pago, así que no se reservó nada. Vuelva a intentarlo en unos minutos.",
    sendFirst: "Envíela primero.",
    askNew: "Pídanos una nueva.",
    revised:
      "Esta cotización se acaba de actualizar, así que no se reservó nada. Vuelva a cargar la página para verla.",
    planChanged:
      "Su plan de limpieza acaba de cambiar, así que no se reservó nada. Vuelva a cargar la página e inténtelo de nuevo.",
    bookedUp:
      "Lo sentimos, esa hora se acaba de llenar, así que no se cobró nada. Le contactaremos con otra hora.",
    addCard: "Agregue una tarjeta para aceptar esta cotización.",
    cardFailed: (because: string) =>
      `Su tarjeta no pasó${because}, así que no se reservó nada. Pruebe con otra tarjeta.`,
    planFor: (services: string) => `Este plan de limpieza es para ${services}.`,
    aService: (name: string) => name,
    pick: (services: string) => `Elija ${services}`,
    waiting: (what: Paying) =>
      `Su banco aún no ha aprobado el pago. Apruébelo en la app de su banco para ${{ clean: "reservar su limpieza", plan: "empezar su plan", change: "cambiar su plan" }[what]}. O presione Aceptar y pagar para empezar de nuevo: el primer pago se cancela, así que solo se le cobra una vez.`,
    processing:
      "Su primer pago aún se está procesando con su banco, así que no se cobró nada más. Suele tardar unos minutos: vuelva a cargar esta página entonces para ver cómo fue.",
    calledOff: (minutes: number) =>
      `Este pago se canceló porque no se aprobó en ${minutes} minutos, así que no se cobró nada. Vuelva a pagar.`,
    bankFailed:
      "Su banco no aprobó el pago, así que no se reservó nada. Vuelva a intentarlo, o use otra tarjeta.",
    refundedNoRoom:
      "Lo sentimos, esa hora se llenó mientras su banco aprobaba el pago. Le devolvimos el depósito, y le contactaremos con otra hora.",
    refundedPlan:
      "Su plan de limpieza empezó mientras su banco aprobaba el pago, así que le devolvimos el depósito.",
    refundedRevised:
      "Esta cotización se actualizó mientras su banco aprobaba el pago, así que le devolvimos el depósito. Revise lo que cambió.",
    refundedClosed:
      "Esta cotización se cerró mientras su banco aprobaba el pago, así que le devolvimos el depósito.",
    nothingWaiting: "No hay ningún pago pendiente en esta cotización.",
  },
});
const said = () => words[currentLanguage()];
const formatList = (items: string[], type?: "and" | "or") =>
  formats[currentLanguage()].formatList(items, type);

// paidOnline: booked with a Deposit the Client's bank approved just
// before, not with what Office Staff pressed for (#534)
export type AcceptResult =
  | { status: "accepted"; job: Job; paidOnline: boolean }
  | { status: "needs_approval"; secret: string }
  | { status: "processing"; message: string };

// what happened (whatClosed), then what to do: the Client asks us for a new
// Quote, and the Office sends one
const closedMessage = (status: QuoteStatus, acceptor: Acceptor["by"]) => {
  if (status === "requested" || status === "draft") {
    return `${whatClosed(status)} ${said().sendFirst}`;
  }
  if (status === "accepted") return whatClosed(status);
  return `${whatClosed(status)} ${acceptor === "client" ? said().askNew : "Send a new one."}`;
};

// only a Sent Quote's offer, `revisionId`, can be Accepted, and only before
// it Expires (whyClosed, as booking checks again under the lock)
const refuseUnlessOpen = (
  quote: Quote,
  revision: KindedRevision,
  revisionId: string,
  acceptor: Acceptor,
) => {
  const closed = whyClosed(
    {
      sentRevisionId: quote.sentRevisionId,
      status: statusOf({ ...quote, expiresAt: revision.expiresAt }),
    },
    revisionId,
  );
  if (closed) throw new ConflictError(unbookableMessage(closed, acceptor));
};

const unbookableMessage = (unbookable: Unbookable, acceptor: Acceptor) => {
  if (unbookable.reason === "closed") {
    return closedMessage(unbookable.status, acceptor.by);
  }
  if (unbookable.reason === "revised") {
    return said().revised;
  }
  if (
    unbookable.reason === "has_plan" ||
    unbookable.reason === "plan_changed"
  ) {
    return acceptor.by === "client"
      ? said().planChanged
      : "This home's cleaning plan changed just now, so nothing was booked. Reload the page and try again.";
  }
  return acceptor.by === "client"
    ? said().bookedUp
    : "That day is now too full for this job, so nothing was charged. Send a quote for another time.";
};

const findForAcceptance = async (id: string) => {
  const [found] = await db
    .select({
      quote: quotes,
      revision: offers,
      client: clients,
      property: properties,
    })
    .from(quotes)
    .leftJoin(offers, eq(offers.id, quotes.sentRevisionId))
    .innerJoin(properties, eq(properties.id, quotes.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(quotes.id, id));
  return found;
};

// a clean accepting books: a one-off Quote's Job, or the first on one of a
// Service Plan Quote's weekdays
type Clean = {
  position: number;
  startsAt: Date;
  crewSize: number;
  // the Service version it was priced with
  serviceId: string;
  option: QuoteOption;
};

// What accepting a Quote books and takes: a one-off Quote's Job, of the
// Service chosen, with its Deposit; or a Service Plan Quote's first clean on
// each of its weekdays, earliest first, with the Deposit for one on each
// (ADR-0013), accepted whole. `serviceKey` is the one chosen, or a plan's
// first weekday's.
type Offer = {
  serviceKey: string;
  cleans: Clean[];
  depositCents: number;
};

const describeServices = (names: string[]) =>
  formatList([...new Set(names)].map(said().aService));

// the options' Services, as the request's own message names them: by the
// version each was priced with, in its language (ADR-0025)
const serviceNamesOf = async (rows: { serviceId: string }[]) => {
  const versions = await serviceVersions(rows.map((r) => r.serviceId));
  return rows.map(
    (r) => inLanguage(currentLanguage(), versions.get(r.serviceId)!).name,
  );
};

const offerFor = async (
  revision: KindedRevision,
  serviceKey: string | undefined,
): Promise<Offer> => {
  const rows = inOrder(await optionsOf(revision.id));
  if (revision.kind === "one_off") {
    const row = rows.find((r) => r.serviceKey === serviceKey);
    if (!row) {
      throw fieldError(
        ["serviceKey"],
        said().pick(
          formatList((await serviceNamesOf(rows)).map(said().aService), "or"),
        ),
      );
    }
    const option = toOption(revision, row);
    return {
      serviceKey: row.serviceKey,
      cleans: [
        {
          position: 0,
          startsAt: revision.proposedStartsAt!,
          crewSize: row.crewSize,
          serviceId: row.serviceId,
          option,
        },
      ],
      depositCents: option.depositCents,
    };
  }
  // a Service Plan Quote offers its weekdays' Services, and only those
  if (serviceKey && !rows.some((r) => r.serviceKey === serviceKey)) {
    throw new ConflictError(
      said().planFor(describeServices(await serviceNamesOf(rows))),
    );
  }
  const cleans = rows.map((row) => ({
    position: row.position,
    startsAt: row.startsAt!,
    crewSize: row.crewSize,
    serviceId: row.serviceId,
    option: toOption(revision, row),
  }));
  return {
    serviceKey: rows[0]!.serviceKey,
    cleans,
    depositCents: cleans.reduce((sum, c) => sum + c.option.depositCents, 0),
  };
};

// a Service Plan Quote changing its home's plan: the plan, and its booked
// Jobs the new terms replace
type Change = { plan: ServicePlan; replaced: Job[] };

type Hold =
  | { unbookable: Unbookable; change?: never }
  | { unbookable: null; change: Change | null };

/**
 * Holds what booking needs until the transaction ends: the Property (so a
 * newer Revision can't be sent meanwhile), the Quote, a plan whose terms it
 * changes with the Jobs it replaces, and the day of each clean it books (so
 * two acceptances can't both take a day's last free hours or crew). Then
 * says whether the Quote can still be booked, as whyUnbookable says, with
 * `changing` the plan its home is expected to have: none for a Quote
 * starting one.
 */
const holdForBooking = async (
  tx: Tx,
  quote: Quote,
  revision: KindedRevision,
  offer: Offer,
  changing: string | null,
): Promise<Hold> => {
  await lockProperty(tx, quote.propertyId);
  const [current] = await tx
    .select()
    .from(quotes)
    .where(eq(quotes.id, quote.id))
    .for("update");

  let planId: string | null = null;
  let change: Change | null = null;
  if (quote.kind === "service_plan") {
    const plan = await currentPlanOf(quote.propertyId, tx);
    planId = plan?.id ?? null;
    // the plan it changes, while it's still the home's: one that changed
    // meanwhile is refused, so nothing of it needs holding
    if (plan && plan.id === changing) {
      change = await holdForChange(tx, plan.id, revision.proposedStartsAt!);
    }
  }

  // earliest first, as sending put a plan's weekdays, so two acceptances
  // hold their days in the same order
  const dates = offer.cleans.map((clean) => dayOf(clean.startsAt));
  for (const date of dates) await lockDay(tx, date);
  const days = await scheduleFor(dates[0]!, dates.at(-1)!, tx);

  const unbookable = whyUnbookable(
    {
      sentRevisionId: current!.sentRevisionId,
      status: statusOf({ ...current!, expiresAt: revision.expiresAt }),
      planId,
      days,
      replacing: change?.replaced.map((j) => j.id) ?? [],
    },
    {
      revisionId: revision.id,
      changing,
      cleans: offer.cleans.map((clean) => ({
        startsAt: clean.startsAt,
        labourHours: clean.option.labourHours,
        crewSize: clean.crewSize,
      })),
    },
  );
  return unbookable ? { unbookable } : { unbookable: null, change };
};

type Booking = {
  quote: Quote;
  revision: KindedRevision;
  property: Property;
  offer: Offer;
  clientId: string;
  acceptedBy: string | null;
};

type Booked = {
  // earliest first: one, unless a Service Plan Quote booked several weekdays
  jobs: Job[];
  plan: ServicePlan | null;
  // the plan's Jobs its new terms replaced, when the Quote changed them
  replaced: Job[] | null;
};

// Books the Jobs and Accepts the Quote, with its Deposit paid; inside a
// transaction holding them (holdForBooking). A Service Plan Quote starts its
// plan, with its first Job on each weekday, and the Deposit is the plan's:
// held for its life, not counted towards any Job's price. Or it changes its
// home's plan from its first Job on, which takes no Deposit: the plan's
// carries over.
const recordAcceptance = async (
  tx: Tx,
  booking: Booking,
  paid: Extract<DepositAttempt, { status: "succeeded" }>,
  change: Change | null,
): Promise<Booked> => {
  const { quote, revision, property, offer } = booking;
  const now = clock.now();
  // the Quote, on its accepted Revision's terms
  const accepted = {
    id: quote.id,
    propertyId: quote.propertyId,
    proposedStartsAt: revision.proposedStartsAt,
    recurrence: revision.recurrence,
  };
  const firstJobs: FirstJobs = [];
  for (const clean of offer.cleans) {
    const job = await bookJob(
      {
        propertyId: property.id,
        serviceId: clean.serviceId,
        startsAt: clean.startsAt,
        labourHours: clean.option.labourHours,
        crewSize: clean.crewSize,
      },
      tx,
    );
    firstJobs.push({ position: clean.position, job });
  }
  const [first] = firstJobs;
  const plan = change
    ? await changeServicePlanTerms(tx, {
        ...change,
        quote: accepted,
        firstJobs,
        changedBy: booking.acceptedBy,
      })
    : quote.kind === "service_plan"
      ? await startServicePlan(tx, {
          quote: accepted,
          firstJobs,
          startedBy: booking.acceptedBy,
        })
      : null;
  if (paid.chargeId) {
    await tx.insert(charges).values({
      ...(plan ? { servicePlanId: plan.id } : { jobId: first!.job.id }),
      kind: "deposit",
      amountCents: offer.depositCents,
      gatewayRef: paid.chargeId,
      chargedAt: now,
    });
  }
  // a card entered just now was saved by the Deposit's own payment
  if (paid.saved) {
    await storePaymentMethod(booking.clientId, paid.saved, tx);
  }
  await tx
    .update(quotes)
    .set({
      status: "accepted",
      acceptedAt: now,
      acceptedServiceKey: offer.serviceKey,
      // a plan's first
      jobId: first!.job.id,
      acceptedBy: booking.acceptedBy,
    })
    .where(eq(quotes.id, quote.id));
  await dropDraftRevision(tx, quote.id);
  return {
    jobs: firstJobs.map((f) => f.job),
    plan,
    replaced: change?.replaced ?? null,
  };
};

const describe = ({ revision, property, offer }: Booking) =>
  revision.kind === "service_plan"
    ? `Deposit: cleaning plan at ${addressOf(property)}, from ${formatWhen(revision.proposedStartsAt!)}`
    : `Deposit: ${offer.cleans[0]!.option.serviceName} at ${addressOf(property)}, ${formatWhen(revision.proposedStartsAt!)}`;

/**
 * Accepts a Sent Quote's offer, `revisionId` (refused before anything is
 * charged once a newer one is Sent), with the Service chosen, as one step:
 * the proposed day must still have room for its Labour Hours, and the
 * Deposit must be taken; only then is the Quote Accepted and the Job booked
 * (ADR-0001). If either fails, nothing changes and the Quote stays Sent. A
 * Service Plan Quote is accepted whole: the first clean on each of its
 * weekdays must have room, and all are booked (ADR-0013).
 *
 * A Client pays with a card entered just now (`paymentToken`, from the
 * provider's form in their browser), which the same payment saves for later
 * Charges, or else with their saved Payment Method (ADR-0008). Their bank
 * may want them to approve it first: then nothing is booked yet, and
 * finalizeDeposit() books it once approved. Office Staff charge the saved
 * Payment Method, without the Client there, but not while the Client's
 * bank is approving their Deposit (the one rule, ADR-0022): within
 * APPROVAL_MS they're refused, and after it the Client's payment is called
 * off first, or, approved, books the Quote instead (`paidOnline`).
 *
 * A Service Plan Quote for a home that has a plan changes that plan's terms
 * from its proposed time on (changeServicePlanTerms), taking no Deposit.
 *
 * Everything from checking the day has room to booking it happens in one
 * transaction holding the day, with the Deposit taken inside it, and
 * refunded if the booking then fails to save.
 */
export const acceptQuote = async (
  id: string,
  {
    revisionId,
    serviceKey,
    paymentToken,
  }: {
    revisionId: string;
    serviceKey?: string | undefined;
    paymentToken?: string | undefined;
  },
  acceptor: Acceptor,
): Promise<AcceptResult> => {
  const found = await findForAcceptance(id);
  // Quotes with nothing Sent, and other Clients' Quotes, don't exist for a
  // Client
  if (
    !found ||
    (acceptor.by === "client" &&
      (found.client.id !== acceptor.clientId || !found.revision))
  ) {
    throw new NotFoundError("Quote not found");
  }
  const { quote, client, property } = found;
  if (!found.revision) {
    throw new ConflictError(closedMessage(quote.status, acceptor.by));
  }
  // the offer: its latest Sent Revision
  const revision: KindedRevision = { ...found.revision, kind: quote.kind! };
  refuseUnlessOpen(quote, revision, revisionId, acceptor);
  const offer = await offerFor(revision, serviceKey);
  // a Service Plan Quote for a home with a plan changes that plan's terms
  const changing =
    quote.kind === "service_plan"
      ? ((await currentPlanOf(property.id))?.id ?? null)
      : null;

  const saved = await paymentMethodOf(client.id);
  const token = acceptor.by === "client" ? paymentToken : undefined;
  // a card is needed even to change a plan, which takes no Deposit: the
  // plan's Balances are charged to it
  if (!token && !saved) {
    throw new ConflictError(
      acceptor.by === "client"
        ? said().addCard
        : `${client.name} hasn't added a card yet. Email them a link to add one.`,
    );
  }

  const booking: Booking = {
    quote,
    revision,
    property,
    offer,
    clientId: client.id,
    acceptedBy: acceptor.accountId,
  };

  // changing a plan takes no Deposit: the plan's carries over
  const depositCents = changing ? 0 : offer.depositCents;
  // Once per attempt, however often accepting is tried (takeDepositOnce):
  // one still waiting on the Client's bank is called off, as they're
  // paying again or Office Staff are recording their yes. Nothing to take
  // only saves a card entered just now, keyed by its token, which is used
  // once
  const takeDeposit = async (tx: Tx): Promise<DepositTaken> => {
    // nothing to take or save from a saved card
    if (depositCents === 0 && !token) {
      return { status: "succeeded", chargeId: null, saved: null };
    }
    const payerId = await payerFor(client);
    const input = {
      payerId,
      amount: depositCents,
      description: describe(booking),
    };
    const once = {
      callOff: acceptor.by === "client" ? "client_retried" : "abandoned",
      unsettled: await unsettledDeposits(id, tx),
    } as const;
    if (acceptor.by === "client") {
      const source = token ? { token } : { paymentMethodId: saved!.gatewayRef };
      return depositCents === 0
        ? paymentGateway
            .takeDeposit({
              ...input,
              source,
              idempotencyKey: idempotencyKey.savingCard(id, token!),
            })
            // nothing is taken, so trying again is safe
            .catch((): DepositAttempt => ({
              status: "failed",
              reason: UNREACHABLE,
            }))
        : takeDepositOnce(
            tx,
            id,
            { call: "deposit", input: { ...input, source } },
            once,
          );
    }
    // the Office: off-session, so no approval can be asked for
    return takeDepositOnce(
      tx,
      id,
      {
        call: "charge",
        input: { ...input, paymentMethodId: saved!.gatewayRef },
      },
      once,
    );
  };

  // set inside the transaction; `as` stops TypeScript deciding it's always null
  let chargeId = null as string | null;
  let outcome;
  try {
    outcome = await db.transaction(async (tx) => {
      const hold = await holdForBooking(tx, quote, revision, offer, changing);
      if (hold.unbookable) {
        throw new ConflictError(unbookableMessage(hold.unbookable, acceptor));
      }
      // The one rule (ADR-0022): while the Client's bank asks them to
      // approve a Deposit, Office Staff wait, for APPROVAL_MS at most; the
      // Client may pay again, calling it off
      const paying = acceptor.by === "office" && (await payingOf(quote, tx));
      if (paying) {
        throw new ConflictError(
          clientPayingWords.record({
            name: client.name,
            deposit: formats.en.formatMoney(paying.depositCents),
            service: paying.serviceName,
            until: formats.en.formatTime(paying.until),
          }),
        );
      }

      const attempt = await takeDeposit(tx);
      // their bank approved an earlier one: it's the Deposit, booked as it
      // asked, once this lets go of the day (finalizeDeposit)
      if (attempt.status === "approved") return attempt;
      if (attempt.status === "finishing") {
        // nothing more was taken, and nothing to do but wait
        if (acceptor.by === "client") {
          return { status: "processing", message: said().processing } as const;
        }
        throw new ConflictError(clientPayingWords.finishing(client.name));
      }
      if (attempt.status === "failed") {
        // the Client is told only that their card wasn't charged
        log.info(`Deposit for Quote ${id} not taken (${attempt.reason})`);
        const { kind, why } = whyNotPaid(currentLanguage(), attempt.reason);
        const because = why ? ` (${why})` : "";
        throw new ConflictError(
          kind === "waiting"
            ? said().PAYMENT_DOWN
            : acceptor.by === "client"
              ? said().cardFailed(because)
              : `${client.name}'s ${messages.en.card(saved!)} didn't go through${because}, so nothing was booked. Email them a link to add another card.`,
        );
      }
      if (attempt.status === "needs_approval") {
        await tx.insert(pendingDeposits).values({
          gatewayRef: attempt.ref,
          quoteId: id,
          revisionId: revision.id,
          serviceKey: offer.serviceKey,
          depositCents,
          changingPlanId: changing,
          acceptedBy: acceptor.accountId,
        });
        return { status: "needs_approval", secret: attempt.secret } as const;
      }

      chargeId = attempt.chargeId;
      const booked = await recordAcceptance(tx, booking, attempt, hold.change);
      return {
        status: "accepted",
        booked,
        paidWith: attempt.saved?.card ?? (saved && cardIn(saved)) ?? null,
      } as const;
    });
  } catch (error) {
    if (chargeId) await giveBackDeposit(chargeId, offer.depositCents, id);
    throw error;
  }

  if (outcome.status === "approved") {
    return bookedWith(
      await finalizeDeposit(outcome.ref),
      id,
      acceptor.by === "client"
        ? finalizeProblem
        : (finalized) =>
            finalized.status === "refunded"
              ? clientPayingWords.refunded(client.name)
              : said().PAYMENT_DOWN,
    );
  }
  if (outcome.status !== "accepted") return outcome;
  await afterAcceptance(
    client,
    property,
    outcome.booked,
    offer,
    outcome.paidWith,
  );
  return {
    status: "accepted",
    job: outcome.booked.jobs[0]!,
    paidOnline: false,
  };
};

// An earlier Deposit the Client's bank approved, finished: the Quote
// booked with it, by this or by whoever finished it first, or else the
// `problem` it came to
const bookedWith = async (
  finalized: Finalized,
  quoteId: string,
  problem: (finalized: Finalized) => string,
): Promise<AcceptResult> => {
  if (finalized.status === "accepted") {
    return { status: "accepted", job: finalized.job, paidOnline: true };
  }
  const job = await acceptedJobOf(quoteId);
  if (job) return { status: "accepted", job, paidOnline: true };
  throw new ConflictError(
    finalized.status === "settled" ? said().PAYMENT_DOWN : problem(finalized),
  );
};

// an Accepted Quote's Job (a plan's first); null while it isn't Accepted
const acceptedJobOf = async (quoteId: string) => {
  const [found] = await db
    .select({ job: jobs })
    .from(quotes)
    .innerJoin(jobs, eq(jobs.id, quotes.jobId))
    .where(and(eq(quotes.id, quoteId), eq(quotes.status, "accepted")));
  return found?.job ?? null;
};

// the Deposits for a Quote still waiting on the Client's bank, which
// finalizeDeposit() may yet book, by the provider's ref
const unsettledDeposits = async (quoteId: string, tx: Tx | typeof db = db) =>
  new Set(
    (
      await tx
        .select({ ref: pendingDeposits.gatewayRef })
        .from(pendingDeposits)
        .where(
          and(
            eq(pendingDeposits.quoteId, quoteId),
            isNull(pendingDeposits.settledAt),
          ),
        )
    ).map((p) => p.ref),
  );

// how finishing a Deposit that needed approval went
export type Finalized =
  | { status: "accepted"; job: Job }
  // their bank is still asking them, or finishing it
  | { status: "waiting"; paying: Paying }
  | { status: "failed"; reason: string }
  // not approved within APPROVAL_MS, so called off
  | { status: "called_off" }
  // the provider couldn't be reached
  | { status: "unknown" }
  | { status: "refunded"; unbookable: Unbookable }
  // not one of ours, or already finished by the browser or the webhook
  | { status: "settled" };

const settle = (ref: string, tx: Tx | typeof db = db) =>
  tx
    .update(pendingDeposits)
    .set({ settledAt: clock.now() })
    .where(
      and(
        eq(pendingDeposits.gatewayRef, ref),
        isNull(pendingDeposits.settledAt),
      ),
    );

// how a settled Deposit ended, as its attempt says: called off, refused,
// or booked or given back (settled)
const settledAs = (attempt: ChargeAttempt | undefined): Finalized =>
  attempt?.status !== "failed"
    ? { status: "settled" }
    : attempt.reason === "canceled"
      ? { status: "called_off" }
      : { status: "failed", reason: attempt.reason ?? "" };

/**
 * Finishes a Deposit that waited on the Client's bank: once their bank has
 * approved it, books the Job and Accepts the Quote as acceptQuote() would
 * have. The browser calls this after the Client approves, the provider's
 * webhook does too, in case the browser never comes back, and the Clock
 * does once APPROVAL_MS has gone by, in case neither does; whichever is
 * first books it, and the others find it settled. One refused, or called
 * off, is settled with nothing booked.
 *
 * The Quote may have closed, or its day filled, while the bank was asking:
 * then the Deposit is refunded, the Client emailed, and nothing is booked.
 * Holds the day, then the pending Deposit, so where it stands is read once
 * nothing else can book or call it off.
 */
export const finalizeDeposit = async (ref: string): Promise<Finalized> => {
  const [pending] = await db
    .select()
    .from(pendingDeposits)
    .where(eq(pendingDeposits.gatewayRef, ref));
  if (!pending) return { status: "settled" };
  if (pending.settledAt) return settledAs(await depositAttemptOf(ref));

  // the Revision the Deposit was for, which must still be the offer
  const { quote, client, property, revision, offer } =
    await pendingOffer(pending);
  const booking: Booking = {
    quote,
    revision,
    property,
    offer,
    clientId: client.id,
    acceptedBy: pending.acceptedBy,
  };

  // set once their bank has approved it: the Deposit, taken
  let approved = null as Extract<Approval, { status: "approved" }> | null;
  let result;
  try {
    result = await db.transaction(async (tx) => {
      // the plan it changes must still be the home's, or, if it changes
      // none, the home must have none
      const hold = await holdForBooking(
        tx,
        quote,
        revision,
        offer,
        pending.changingPlanId,
      );
      const [current] = await tx
        .select()
        .from(pendingDeposits)
        .where(eq(pendingDeposits.gatewayRef, ref))
        .for("update");
      if (current!.settledAt) return { status: "settled" } as const;

      const attempt = await depositAttemptOf(ref, tx);
      const standing = await approvalOf(ref, attempt, null);
      switch (standing.status) {
        case "waiting":
        case "finishing":
          return {
            status: "waiting",
            paying: pending.changingPlanId
              ? "change"
              : quote.kind === "service_plan"
                ? "plan"
                : "clean",
          } as const;
        case "unknown":
          return { status: "unknown" } as const;
        case "called_off":
        case "ended": {
          const reason =
            standing.status === "ended" ? standing.reason : "canceled";
          log.info(
            `Deposit ${ref} for Quote ${pending.quoteId} not approved (${reason})`,
          );
          await settle(ref, tx);
          return reason === "canceled"
            ? ({ status: "called_off" } as const)
            : ({ status: "failed", reason } as const);
        }
        case "approved":
          break;
      }

      approved = standing;
      await settle(ref, tx);
      if (hold.unbookable) {
        return { status: "refunded", unbookable: hold.unbookable } as const;
      }
      const booked = await recordAcceptance(
        tx,
        booking,
        {
          status: "succeeded",
          chargeId: standing.chargeId,
          saved: standing.saved,
        },
        hold.change,
      );
      if (attempt) await keepTaken(tx, attempt);
      return { status: "accepted", booked } as const;
    });
  } catch (error) {
    if (approved) {
      // settled first, so a later webhook or Clock never books a Deposit
      // given back (#534, N3)
      await settle(ref);
      await giveBackDeposit(approved.chargeId, pending.depositCents, quote.id);
    }
    throw error;
  }

  if (result.status === "settled") {
    return settledAs(await depositAttemptOf(ref));
  }
  if (result.status === "refunded") {
    const { chargeId, saved } = approved!;
    const why = result.unbookable.reason;
    if (await giveBackDeposit(chargeId, pending.depositCents, quote.id, why)) {
      await tellRefunded(pending, why, saved?.card ?? null);
    }
    return result;
  }
  if (result.status !== "accepted") return result;

  const paidWith =
    approved!.saved?.card ?? cardIn((await paymentMethodOf(client.id))!);
  await afterAcceptance(client, property, result.booked, offer, paidWith);
  return { status: "accepted", job: result.booked.jobs[0]! };
};

// the Client's latest Deposit that waited on their bank for this Quote,
// settled or not: what the page they came back to asked for
export const latestDepositFor = async (quoteId: string) => {
  const [pending] = await db
    .select()
    .from(pendingDeposits)
    .where(eq(pendingDeposits.quoteId, quoteId))
    .orderBy(desc(pendingDeposits.createdAt))
    .limit(1);
  return pending;
};

// what a Client is told when finishing their Deposit didn't book it
export const finalizeProblem = (finalized: Finalized) => {
  switch (finalized.status) {
    case "waiting":
      return said().waiting(finalized.paying);
    case "called_off":
      return said().calledOff(APPROVAL_MS / MINUTE_MS);
    case "unknown":
      return said().PAYMENT_DOWN;
    case "failed":
      return said().bankFailed;
    case "refunded":
      return finalized.unbookable.reason === "no_room"
        ? said().refundedNoRoom
        : finalized.unbookable.reason === "has_plan" ||
            finalized.unbookable.reason === "plan_changed"
          ? said().refundedPlan
          : finalized.unbookable.reason === "revised"
            ? said().refundedRevised
            : said().refundedClosed;
    default:
      return said().nothingWaiting;
  }
};

// ---- the Deposits nobody finished (#534) ----

/**
 * Settles the Deposits on a Quote that waited on the Client's bank, as the
 * Clock does once APPROVAL_MS has gone by and Office Staff do before
 * sending changes: those still waiting are called off, those approved are
 * booked (finalizeDeposit), or given back if they can't be; and whatever
 * else an earlier try took unbooked is given back. Emails the Client of
 * each given back; those called off are returned, for the caller to say
 * what's become of the Quote. Whether the Quote is now Accepted.
 */
export const settleQuotePayments = async (quoteId: string) => {
  const { givenBack, calledOff } = await db.transaction(async (tx) => {
    // as accepting it does, so the two never both have its Deposit
    await tx
      .select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .for("update");
    return giveBackUnbookedDeposits(
      tx,
      quoteId,
      await unsettledDeposits(quoteId, tx),
    );
  });
  // each apart, holding the day, never inside the Quote's lock
  for (const ref of await unsettledDeposits(quoteId)) {
    await finalizeDeposit(ref);
  }
  for (const ref of givenBack) {
    const [pending] = await db
      .select()
      .from(pendingDeposits)
      .where(eq(pendingDeposits.gatewayRef, ref));
    const attempt = await depositAttemptOf(ref);
    if (pending && attempt?.givenBackWhy) {
      await tellRefunded(pending, attempt.givenBackWhy, null);
    }
  }
  const pendings = calledOff.length
    ? await db
        .select()
        .from(pendingDeposits)
        .where(inArray(pendingDeposits.gatewayRef, calledOff))
    : [];
  return {
    accepted: (await acceptedJobOf(quoteId)) !== null,
    calledOff: pendings,
  };
};

type PendingDeposit = typeof pendingDeposits.$inferSelect;

// what a pending Deposit was for: its Quote as it stands (with its latest
// Sent Revision, `sent`), and the Revision and offer it paid for
const pendingOffer = async (pending: PendingDeposit) => {
  const found = (await findForAcceptance(pending.quoteId))!;
  const [paidFor] = await db
    .select()
    .from(quoteRevisions)
    .where(eq(quoteRevisions.id, pending.revisionId));
  const revision: KindedRevision = { ...paidFor!, kind: found.quote.kind! };
  const offer = await offerFor(revision, pending.serviceKey);
  return { ...found, sent: found.revision, revision, offer };
};

// what a Deposit was for, as its emails to the Client name it
const depositFor = async (pending: PendingDeposit) => {
  const { quote, client, property, sent, offer } = await pendingOffer(pending);
  const [first] = offer.cleans;
  return {
    client,
    // as it stands: its latest Sent Revision's expiry
    quote: { ...quote, expiresAt: sent?.expiresAt ?? null },
    deposit: {
      name: client.name,
      address: addressOf(property),
      quoteId: quote.id,
      service:
        quote.kind === "one_off"
          ? (await serviceVersions([first!.serviceId])).get(first!.serviceId)!
          : null,
      changing: pending.changingPlanId !== null,
      startsAt: first!.startsAt,
      amountCents: pending.depositCents,
    } satisfies DepositFor,
  };
};

// the card the Client has saved, if any
const savedCardOf = async (clientId: string) => {
  const saved = await paymentMethodOf(clientId);
  return saved ? cardIn(saved) : null;
};

// The Client's record of a Deposit their bank approved but that couldn't
// be booked, given back: the only word for one who never came back to the
// Quote's page. An email that can't go mustn't undo the refund
const tellRefunded = async (
  pending: PendingDeposit,
  why: DepositRefundedWhy,
  card: Card | null,
) => {
  try {
    const { client, deposit } = await depositFor(pending);
    await email.send({
      to: client.email,
      ...depositRefundedEmail(client.preferredLanguage, {
        ...deposit,
        why,
        card: card ?? (await savedCardOf(client.id)),
      }),
    });
  } catch (error) {
    monitoring.error(error, {
      what: `refund email for Deposit ${pending.gatewayRef} not sent`,
    });
  }
};

// Tells the Client their Deposits left unapproved past APPROVAL_MS were
// called off, and what's become of the Quote `since`: still open, Expired,
// or changes sent (by whoever called them off). Nothing for one otherwise
// closed: they closed it, or it's booked
export const tellCalledOff = async (
  calledOff: PendingDeposit[],
  sent: boolean,
) => {
  for (const pending of calledOff) {
    try {
      const { client, quote, deposit } = await depositFor(pending);
      const status = statusOf(quote);
      const since: QuoteSince | null = sent
        ? "sent"
        : status === "sent"
          ? "open"
          : status === "expired"
            ? "expired"
            : null;
      if (!since) continue;
      await email.send({
        to: client.email,
        ...depositCalledOffEmail(client.preferredLanguage, {
          ...deposit,
          minutes: APPROVAL_MS / MINUTE_MS,
          since,
        }),
      });
    } catch (error) {
      monitoring.error(error, {
        what: `called-off email for Deposit ${pending.gatewayRef} not sent`,
      });
    }
  }
};

// Once the acceptance is saved: the Client's confirmation, the Office told of
// Sent Quotes the bookings left without room, and a Service Plan's next Jobs
// put on the Schedule; when it changed a plan, the crews of the Jobs it
// replaced told they're off. An email that can't go mustn't make it look as
// though nothing was booked.
const afterAcceptance = async (
  client: Client,
  property: Property,
  { jobs, plan, replaced }: Booked,
  offer: Offer,
  paidWith: Card | null,
) => {
  const paid = {
    paymentMethod: paidWith,
    weeklyBill: weeklyBillOf(client),
    depositCents: offer.depositCents,
  };
  if (replaced) await afterTermsChanged(replaced);
  try {
    await (replaced
      ? sendPlanChangeConfirmation(
          client,
          property,
          offer,
          plan!,
          replaced,
          paid,
        )
      : plan
        ? sendPlanConfirmation(client, property, offer, plan, paid)
        : sendBookingConfirmation(client, property, jobs[0]!, {
            ...paid,
            totalCents: offer.cleans[0]!.option.totalCents,
          }));
  } catch (error) {
    monitoring.error(error, {
      what: `booking confirmation for Job ${jobs[0]!.id} not sent`,
    });
  }
  for (const day of new Set(jobs.map((j) => dayOf(j.startsAt)))) {
    await warnOfficeOfQuotesWithoutRoom(day);
  }
  if (plan) await generateServicePlanJobs(plan.id);
};

// a plan's cleans, as its emails give them, each Service by its version
const cleansOf = async (
  plan: ServicePlan,
  offer: Offer,
): Promise<PlanCleans> => {
  const versions = await serviceVersions(offer.cleans.map((c) => c.serviceId));
  return {
    recurrence: plan.recurrence,
    cleans: offer.cleans.map((c) => ({
      startsAt: c.startsAt,
      service: versions.get(c.serviceId)!,
      totalCents: c.option.totalCents,
    })),
  };
};

// one email for the whole plan: its Jobs after the first get only the
// day-before reminder
const sendPlanConfirmation = async (
  client: Client,
  property: Property,
  offer: Offer,
  plan: ServicePlan,
  paid: PaidWith & { depositCents: number },
) => {
  await email.send({
    to: client.email,
    ...planConfirmationEmail(client.preferredLanguage, {
      name: client.name,
      address: addressOf(property),
      plan: await cleansOf(plan, offer),
      paid,
    }),
  });
};

// the plan's new terms, from the first Job on them, and the Jobs they
// replaced
const sendPlanChangeConfirmation = async (
  client: Client,
  property: Property,
  offer: Offer,
  plan: ServicePlan,
  replaced: Job[],
  paid: PaidWith,
) => {
  await email.send({
    to: client.email,
    ...planChangeEmail(client.preferredLanguage, {
      name: client.name,
      address: addressOf(property),
      planId: plan.id,
      plan: await cleansOf(plan, offer),
      replaced: replaced.map((j) => j.startsAt),
      paid,
    }),
  });
};

const sendBookingConfirmation = async (
  client: Client,
  property: Property,
  job: Job,
  paid: Paid,
) => {
  await email.send({
    to: client.email,
    ...bookingConfirmationEmail(client.preferredLanguage, {
      name: client.name,
      clean: await cleanOf(job, property),
      paid,
    }),
  });
};
