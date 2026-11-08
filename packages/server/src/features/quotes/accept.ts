import { and, desc, eq, isNull } from "drizzle-orm";
import type { QuoteOption, QuoteStatus } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import {
  ConflictError,
  fieldError,
  NotFoundError,
} from "../../middleware/errors.ts";
import { clock, dayOf } from "../../services/clock/index.ts";
import { email, formatWhen } from "../../services/email/index.ts";
import {
  paymentGateway,
  type DepositAttempt,
} from "../../services/payment-gateway/index.ts";
import { weeklyBillOf } from "../bills/billed-weekly.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { bookJob, lockDay } from "../jobs/jobs.ts";
import type { Job } from "../jobs/jobs.schema.ts";
import { scheduleFor } from "../jobs/schedule.ts";
import {
  payerFor,
  paymentMethodOf,
  storePaymentMethod,
} from "../payments/payments.ts";
import {
  giveBackDeposit,
  takeDepositOnce,
  UNREACHABLE,
} from "../payments/money.ts";
import { idempotencyKey } from "../payments/keys.ts";
import { charges } from "../payments/payments.schema.ts";
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
import { cleanOf } from "../services/services.ts";
import {
  bookingConfirmationEmail,
  planChangeEmail,
  planConfirmationEmail,
  type Paid,
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

// who is accepting: the Client, from the portal, or Office Staff recording
// the Client's acceptance on their behalf (they never enter card details: the
// Client's saved Payment Method is charged)
export type Acceptor =
  | { by: "client"; clientId: string; accountId: string }
  | { by: "office"; accountId: string };

// the payment provider couldn't be reached
const PAYMENT_DOWN =
  "Something went wrong taking the payment, so nothing was booked. Please try again in a few minutes.";

export type AcceptResult =
  | { status: "accepted"; job: Job }
  | { status: "needs_approval"; secret: string };

// what happened (whatClosed), then what to do: the Client asks us for a new
// Quote, and the Office sends one
const closedMessage = (status: QuoteStatus, acceptor: Acceptor["by"]) => {
  if (status === "requested" || status === "draft") {
    return `${whatClosed(status)} Send it first.`;
  }
  if (status === "accepted") return whatClosed(status);
  return `${whatClosed(status)} ${acceptor === "client" ? "Ask us for a new one." : "Send a new one."}`;
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
    return acceptor.by === "client"
      ? "This quote was just updated, so nothing was booked. Please reload the page to see it."
      : "An updated quote was just sent, so nothing was booked. Reload the page to see it.";
  }
  if (
    unbookable.reason === "has_plan" ||
    unbookable.reason === "plan_changed"
  ) {
    return acceptor.by === "client"
      ? "Your cleaning plan changed just now, so nothing was booked. Please reload the page and try again."
      : "This home's cleaning plan changed just now, so nothing was booked. Reload the page and try again.";
  }
  return acceptor.by === "client"
    ? "Sorry, that time just got booked up, so nothing was charged. We'll be in touch with another time."
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
  [...new Set(names)].map((name) => `a ${name}`).join(" and ");

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
        `Pick ${rows.map((r) => `a ${r.suggested.serviceName}`).join(" or ")}`,
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
      `This cleaning plan is for ${describeServices(rows.map((r) => r.suggested.serviceName))}.`,
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
    ? `Deposit: Service Plan at ${addressOf(property)}, from ${formatWhen(revision.proposedStartsAt!)}`
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
 * finalizeDeposit() books it once approved. Office Staff always charge the
 * saved Payment Method, without the Client there.
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
        ? "Add a card to accept this quote."
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
  // Once per attempt, however often accepting is tried (takeDepositOnce).
  // Nothing to take only saves a card entered just now, keyed by its token,
  // which is used once
  const takeDeposit = async (tx: Tx): Promise<DepositAttempt> => {
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
        : takeDepositOnce(tx, id, {
            call: "deposit",
            input: { ...input, source },
          });
    }
    // the Office: off-session, so no approval can be asked for
    return takeDepositOnce(tx, id, {
      call: "charge",
      input: { ...input, paymentMethodId: saved!.gatewayRef },
    });
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

      const attempt = await takeDeposit(tx);
      if (attempt.status === "failed") {
        // the Client is told only that their card wasn't charged
        log.info(`Deposit for Quote ${id} not taken (${attempt.reason})`);
        const { kind, why } = whyNotPaid(attempt.reason);
        const because = why ? ` ${why}` : "";
        throw new ConflictError(
          kind === "waiting"
            ? PAYMENT_DOWN
            : acceptor.by === "client"
              ? `Your card didn't go through, so nothing was booked.${because} Please try another card.`
              : `${client.name}'s ${saved!.label} didn't go through, so nothing was booked.${because} Email them a link to add another card.`,
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
        paidWith: attempt.saved?.label ?? saved?.label ?? null,
      } as const;
    });
  } catch (error) {
    if (chargeId) await giveBackDeposit(chargeId, offer.depositCents, id);
    throw error;
  }

  if (outcome.status === "needs_approval") return outcome;
  await afterAcceptance(
    client,
    property,
    outcome.booked,
    offer,
    outcome.paidWith,
  );
  return { status: "accepted", job: outcome.booked.jobs[0]! };
};

// how finishing a Deposit that needed approval went
export type Finalized =
  | { status: "accepted" }
  | { status: "waiting" }
  | { status: "failed"; reason: string }
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

/**
 * Finishes a Deposit that waited on the Client's bank: once the payment has
 * succeeded, books the Job and Accepts the Quote as acceptQuote() would have.
 * The browser calls this after the Client approves, and the provider's
 * webhook does too, in case the browser never comes back; whichever is first
 * books it, and the other finds it settled.
 *
 * The Quote may have closed, or its day filled, while the bank was asking:
 * then the Deposit is refunded and nothing is booked.
 */
export const finalizeDeposit = async (ref: string): Promise<Finalized> => {
  const [pending] = await db
    .select()
    .from(pendingDeposits)
    .where(eq(pendingDeposits.gatewayRef, ref));
  if (!pending || pending.settledAt) return { status: "settled" };

  const attempt = await paymentGateway.depositOutcome(ref);
  if (attempt.status === "needs_approval") return { status: "waiting" };
  if (attempt.status === "failed") {
    log.info(
      `Deposit ${ref} for Quote ${pending.quoteId} not approved (${attempt.reason})`,
    );
    await settle(ref);
    return { status: "failed", reason: attempt.reason };
  }

  const { quote, client, property } = (await findForAcceptance(
    pending.quoteId,
  ))!;
  // the Revision the Deposit was for, which must still be the offer
  const [pendingRevision] = await db
    .select()
    .from(quoteRevisions)
    .where(eq(quoteRevisions.id, pending.revisionId));
  const revision: KindedRevision = { ...pendingRevision!, kind: quote.kind! };
  const offer = await offerFor(revision, pending.serviceKey);
  const booking: Booking = {
    quote,
    revision,
    property,
    offer,
    clientId: client.id,
    acceptedBy: pending.acceptedBy,
  };

  let result;
  try {
    result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(pendingDeposits)
        .where(eq(pendingDeposits.gatewayRef, ref))
        .for("update");
      if (current!.settledAt) return { status: "settled" } as const;

      // the plan it changes must still be the home's, or, if it changes
      // none, the home must have none
      const hold = await holdForBooking(
        tx,
        quote,
        revision,
        offer,
        pending.changingPlanId,
      );
      await settle(ref, tx);
      if (hold.unbookable) {
        return { status: "refunded", unbookable: hold.unbookable } as const;
      }
      const booked = await recordAcceptance(tx, booking, attempt, hold.change);
      return { status: "accepted", booked } as const;
    });
  } catch (error) {
    if (attempt.chargeId) {
      await giveBackDeposit(attempt.chargeId, pending.depositCents, quote.id);
    }
    // given back: a later webhook mustn't book it after all
    await settle(ref);
    throw error;
  }

  if (result.status === "refunded" && attempt.chargeId) {
    await giveBackDeposit(attempt.chargeId, pending.depositCents, quote.id);
  }
  if (result.status !== "accepted") return result;

  const paidWith =
    attempt.saved?.label ?? (await paymentMethodOf(client.id))!.label;
  await afterAcceptance(client, property, result.booked, offer, paidWith);
  return { status: "accepted" };
};

// the Client's latest Deposit still waiting on their bank for this Quote
export const pendingDepositFor = async (quoteId: string) => {
  const [pending] = await db
    .select()
    .from(pendingDeposits)
    .where(
      and(
        eq(pendingDeposits.quoteId, quoteId),
        isNull(pendingDeposits.settledAt),
      ),
    )
    .orderBy(desc(pendingDeposits.createdAt));
  return pending;
};

// what a Client is told when finishing their approved Deposit didn't book
export const finalizeProblem = (finalized: Finalized) => {
  switch (finalized.status) {
    case "waiting":
      return "Your bank hasn't approved the payment yet. Please approve it, then try again.";
    case "failed":
      return "Your bank didn't approve the payment, so nothing was booked. Please try again, or use another card.";
    case "refunded":
      return finalized.unbookable.reason === "no_room"
        ? "Sorry, that time got booked up while your bank was approving the payment. We've refunded your deposit, and we'll be in touch with another time."
        : finalized.unbookable.reason === "has_plan" ||
            finalized.unbookable.reason === "plan_changed"
          ? "Your cleaning plan started while your bank was approving the payment, so we've refunded your deposit."
          : finalized.unbookable.reason === "revised"
            ? "This quote was updated while your bank was approving the payment, so we've refunded your deposit. Please look at the updated quote."
            : "This quote closed while your bank was approving the payment, so we've refunded your deposit.";
    default:
      return "There's no payment waiting on this quote.";
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
  paidWith: string | null,
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

// a plan's cleans, as its emails give them
const cleansOf = (plan: ServicePlan, offer: Offer): PlanCleans => ({
  recurrence: plan.recurrence,
  cleans: offer.cleans.map((c) => ({
    startsAt: c.startsAt,
    serviceName: c.option.serviceName,
    totalCents: c.option.totalCents,
  })),
});

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
    ...planConfirmationEmail({
      name: client.name,
      address: addressOf(property),
      plan: cleansOf(plan, offer),
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
    ...planChangeEmail({
      name: client.name,
      address: addressOf(property),
      planId: plan.id,
      plan: cleansOf(plan, offer),
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
    ...bookingConfirmationEmail({
      name: client.name,
      clean: await cleanOf(job, property),
      paid,
    }),
  });
};
