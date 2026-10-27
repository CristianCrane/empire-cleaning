import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type {
  CleanType,
  QuoteOption,
  QuoteStatus,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import env from "../../env.ts";
import {
  ConflictError,
  NotFoundError,
  RequestBodyError,
} from "../../middleware/errors.ts";
import { clock, dayOf } from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatMoney,
  formatWhen,
  weekdayName,
} from "../../services/email/index.ts";
import {
  paymentGateway,
  type DepositAttempt,
} from "../../services/payment-gateway/index.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { bookJob, lockDay } from "../jobs/jobs.ts";
import type { Job } from "../jobs/jobs.schema.ts";
import { roomFor } from "../jobs/schedule.ts";
import {
  payerFor,
  paymentMethodOf,
  storePaymentMethod,
} from "../payments/payments.ts";
import { charges } from "../payments/payments.schema.ts";
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
import { describePlan } from "./plan-days.ts";
import { warnOfficeOfQuotesWithoutRoom } from "./quote-room.ts";
import { statusOf } from "./quote-state.ts";
import { inOrder, lockProperty, toOption } from "./quotes.ts";
import {
  pendingDeposits,
  quoteOptions,
  quotes,
  type Quote,
} from "./quotes.schema.ts";

// who is accepting: the Client, from the portal, or Office Staff recording
// the Client's acceptance on their behalf (they never enter card details: the
// Client's saved Payment Method is charged)
export type Acceptor =
  | { by: "client"; clientId: string; accountId: string }
  | { by: "office"; accountId: string };

export type AcceptResult =
  | { status: "accepted"; job: Job }
  | { status: "needs_approval"; secret: string };

const cleanTypeLabel = { deep: "Deep Clean", standard: "Standard Clean" };

const closedMessage = (status: QuoteStatus, acceptor: Acceptor["by"]) =>
  ({
    draft: "Send the Quote before recording its acceptance.",
    sent: "",
    accepted: "This Quote has already been accepted.",
    declined: "This Quote was declined, so it can't be accepted.",
    expired:
      acceptor === "client"
        ? "This Quote has expired, so it can't be accepted. Ask us for a new Quote and we'll find another time."
        : "This Quote has expired, so it can't be accepted. Send a new one.",
    superseded: "A newer Quote replaces this one, so it can't be accepted.",
  })[status];

// only a Sent Quote can be Accepted, and only before it Expires
const refuseUnlessOpen = (quote: Quote, acceptor: Acceptor) => {
  const status = statusOf(quote);
  if (status !== "sent") {
    throw new ConflictError(closedMessage(status, acceptor.by));
  }
};

// why a Deposit that has been taken can't be booked after all
type Unbookable =
  | { reason: "closed"; status: QuoteStatus }
  | { reason: "no_room" }
  // a Service Plan Quote starting a plan, for a home whose plan started
  // while the Client's bank was approving its Deposit
  | { reason: "has_plan" }
  // a Service Plan Quote whose home's plan started or Ended just then
  | { reason: "plan_changed" };

const unbookableMessage = (unbookable: Unbookable, acceptor: Acceptor) => {
  if (unbookable.reason === "closed") {
    return closedMessage(unbookable.status, acceptor.by);
  }
  if (
    unbookable.reason === "has_plan" ||
    unbookable.reason === "plan_changed"
  ) {
    return acceptor.by === "client"
      ? "This home's Service Plan changed just then, so nothing has been booked. Please reload the page and try again."
      : "This home's Service Plan changed just then, so nothing was booked. Reload the page and try again.";
  }
  return acceptor.by === "client"
    ? "Sorry, that time has just been booked up, so nothing has been charged. We'll be in touch with another time."
    : "That day no longer has room for this Job, so nothing was charged. Send a Quote for another time.";
};

const findForAcceptance = async (id: string) => {
  const [found] = await db
    .select({ quote: quotes, client: clients, property: properties })
    .from(quotes)
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
  option: QuoteOption;
};

// What accepting a Quote books and takes: a one-off Quote's Job, of the
// Clean Type chosen, with its Deposit; or a Service Plan Quote's first clean
// on each of its weekdays, earliest first, with the Deposit for one on each
// (ADR-0013), accepted whole. `cleanType` is the one chosen, or a plan's
// first weekday's.
type Offer = {
  cleanType: CleanType;
  cleans: Clean[];
  depositCents: number;
};

const describeTypes = (types: CleanType[]) =>
  [...new Set(types)].map((t) => `a ${cleanTypeLabel[t]}`).join(" and ");

const offerFor = async (
  quote: Quote,
  cleanType: CleanType | undefined,
): Promise<Offer> => {
  const rows = inOrder(
    await db
      .select()
      .from(quoteOptions)
      .where(eq(quoteOptions.quoteId, quote.id)),
  );
  if (quote.kind === "one_off") {
    const row = rows.find((r) => r.cleanType === cleanType);
    if (!row) {
      throw new RequestBodyError(
        new z.ZodError([
          {
            code: "custom",
            path: ["cleanType"],
            message: "Choose a Deep Clean or a Standard Clean",
            input: undefined,
          },
        ]),
      );
    }
    const option = toOption(quote, row);
    return {
      cleanType: row.cleanType,
      cleans: [
        {
          position: 0,
          startsAt: quote.proposedStartsAt!,
          crewSize: row.crewSize,
          option,
        },
      ],
      depositCents: option.depositCents,
    };
  }
  // a Service Plan Quote offers its weekdays' Clean Types, and only those
  if (cleanType && !rows.some((r) => r.cleanType === cleanType)) {
    throw new ConflictError(
      `This Service Plan is for ${describeTypes(rows.map((r) => r.cleanType))}.`,
    );
  }
  const cleans = rows.map((row) => ({
    position: row.position,
    startsAt: row.startsAt!,
    crewSize: row.crewSize,
    option: toOption(quote, row),
  }));
  return {
    cleanType: rows[0]!.cleanType,
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
 * newer Quote can't be sent meanwhile), the Quote, a plan whose terms it
 * changes with the Jobs it replaces, and the day of each clean it books (so
 * two acceptances can't both take a day's last free hours or crew). Then
 * says whether the Quote can still be booked: open, its home's plan still
 * the one expected (`changing`: none for a Quote starting one), and every
 * clean's time with room, the Jobs it replaces counting as gone.
 */
const holdForBooking = async (
  tx: Tx,
  quote: Quote,
  offer: Offer,
  changing: string | null,
): Promise<Hold> => {
  await lockProperty(tx, quote.propertyId);
  const [current] = await tx
    .select()
    .from(quotes)
    .where(eq(quotes.id, quote.id))
    .for("update");
  const status = statusOf(current!);
  if (status !== "sent") return { unbookable: { reason: "closed", status } };

  let change: Change | null = null;
  if (quote.kind === "service_plan") {
    const plan = await currentPlanOf(quote.propertyId, tx);
    if ((plan?.id ?? null) !== changing) {
      return {
        unbookable: { reason: changing ? "plan_changed" : "has_plan" },
      };
    }
    if (plan) {
      change = await holdForChange(tx, plan.id, quote.proposedStartsAt!);
    }
  }

  // earliest first, so two acceptances hold their days in the same order
  for (const clean of offer.cleans) await lockDay(tx, dayOf(clean.startsAt));
  for (const clean of offer.cleans) {
    const { hasRoom } = await roomFor(
      {
        startsAt: clean.startsAt,
        labourHours: clean.option.labourHours,
        crewSize: clean.crewSize,
      },
      change?.replaced.map((j) => j.id),
    );
    if (!hasRoom) return { unbookable: { reason: "no_room" } };
  }
  return { unbookable: null, change };
};

type Booking = {
  quote: Quote;
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
  const { quote, property, offer } = booking;
  const now = clock.now();
  const firstJobs: FirstJobs = [];
  for (const clean of offer.cleans) {
    const job = await bookJob(
      {
        propertyId: property.id,
        cleanType: clean.option.cleanType,
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
        quote,
        firstJobs,
        changedBy: booking.acceptedBy,
      })
    : quote.kind === "service_plan"
      ? await startServicePlan(tx, {
          quote,
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
      acceptedCleanType: offer.cleanType,
      // a plan's first
      jobId: first!.job.id,
      acceptedBy: booking.acceptedBy,
    })
    .where(eq(quotes.id, quote.id));
  return {
    jobs: firstJobs.map((f) => f.job),
    plan,
    replaced: change?.replaced ?? null,
  };
};

// a Deposit was taken but nothing was booked: give it back
const refundUnbooked = async (
  chargeId: string,
  amount: number,
  quoteId: string,
) => {
  const refunded = await paymentGateway
    .refund({ chargeId, amount, idempotencyKey: `refund:${chargeId}` })
    .catch((e: unknown) => ({ ok: false, reason: String(e) }) as const);
  if (!refunded.ok) {
    // TODO(#41): the refund_failed signal
    console.error(
      `Deposit ${chargeId} for Quote ${quoteId} was taken but not booked, and couldn't be refunded (${refunded.reason}): refund it by hand`,
    );
  }
};

const describe = ({ quote, property, offer }: Booking) =>
  quote.kind === "service_plan"
    ? `Deposit: Service Plan at ${addressOf(property)}, from ${formatWhen(quote.proposedStartsAt!)}`
    : `Deposit: ${cleanTypeLabel[offer.cleanType]} at ${addressOf(property)}, ${formatWhen(quote.proposedStartsAt!)}`;

/**
 * Accepts a Sent Quote with the Clean Type chosen, as one step: the proposed
 * day must still have room for its Labour Hours, and the Deposit must be
 * taken; only then is the Quote Accepted and the Job booked (ADR-0001). If
 * either fails, nothing changes and the Quote stays Sent. A Service Plan
 * Quote is accepted whole: the first clean on each of its weekdays must have
 * room, and all are booked (ADR-0013).
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
    cleanType,
    paymentToken,
  }: { cleanType?: CleanType | undefined; paymentToken?: string | undefined },
  acceptor: Acceptor,
): Promise<AcceptResult> => {
  const found = await findForAcceptance(id);
  // Drafts and other Clients' Quotes don't exist for a Client
  if (
    !found ||
    (acceptor.by === "client" &&
      (found.client.id !== acceptor.clientId || found.quote.status === "draft"))
  ) {
    throw new NotFoundError("Quote not found");
  }
  const { quote, client, property } = found;
  refuseUnlessOpen(quote, acceptor);
  const offer = await offerFor(quote, cleanType);
  // a Service Plan Quote for a home with a plan changes that plan's terms
  const changing =
    quote.kind === "service_plan"
      ? ((await currentPlanOf(property.id))?.id ?? null)
      : null;

  const saved = await paymentMethodOf(client.id);
  const token = acceptor.by === "client" ? paymentToken : undefined;
  // changing a plan takes no Deposit: the plan's carries over
  if (!changing && !token && !saved) {
    throw new ConflictError(
      acceptor.by === "client"
        ? "Enter a card to accept this Quote."
        : `${client.name} hasn't added a Payment Method yet. Email them a link to add one.`,
    );
  }

  const booking: Booking = {
    quote,
    property,
    offer,
    clientId: client.id,
    acceptedBy: acceptor.accountId,
  };

  // a card entered just now is used once, so its token keys the Deposit; a
  // saved one is keyed per attempt, so a retry after a refund can't replay a
  // payment that was given back
  const takeDeposit = async (): Promise<DepositAttempt> => {
    // a 0% Deposit from a saved card has nothing to take or save, and nor
    // does changing a plan
    if (changing || (offer.depositCents === 0 && !token)) {
      return { status: "succeeded", chargeId: null, saved: null };
    }
    const payerId = await payerFor(client);
    if (acceptor.by === "client") {
      return paymentGateway.takeDeposit({
        payerId,
        source: token ? { token } : { paymentMethodId: saved!.gatewayRef },
        amount: offer.depositCents,
        description: describe(booking),
        idempotencyKey: `deposit:${id}:${token ?? randomUUID()}`,
      });
    }
    // the Office: off-session, so no approval can be asked for
    return paymentGateway
      .charge({
        payerId,
        paymentMethodId: saved!.gatewayRef,
        amount: offer.depositCents,
        description: describe(booking),
        idempotencyKey: `deposit:${id}:${randomUUID()}`,
      })
      .then((result) =>
        result.ok
          ? { status: "succeeded", chargeId: result.chargeId, saved: null }
          : { status: "failed", reason: result.reason },
      );
  };

  // set inside the transaction; `as` stops TypeScript deciding it's always null
  let chargeId = null as string | null;
  let outcome;
  try {
    outcome = await db.transaction(async (tx) => {
      const hold = await holdForBooking(tx, quote, offer, changing);
      if (hold.unbookable) {
        throw new ConflictError(unbookableMessage(hold.unbookable, acceptor));
      }

      const attempt = await takeDeposit();
      if (attempt.status === "failed") {
        // the Client is told only that their card wasn't charged
        console.error(`Deposit for Quote ${id} not taken (${attempt.reason})`);
        throw new ConflictError(
          acceptor.by === "client"
            ? "Your card couldn't be charged, so nothing has been booked. Please try another card."
            : `The Deposit couldn't be charged to ${client.name}'s ${saved!.label} (${attempt.reason}), so nothing has been booked.`,
        );
      }
      if (attempt.status === "needs_approval") {
        await tx.insert(pendingDeposits).values({
          gatewayRef: attempt.ref,
          quoteId: id,
          cleanType: offer.cleanType,
          depositCents: offer.depositCents,
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
    if (chargeId) await refundUnbooked(chargeId, offer.depositCents, id);
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
    console.error(
      `Deposit ${ref} for Quote ${pending.quoteId} not approved (${attempt.reason})`,
    );
    await settle(ref);
    return { status: "failed", reason: attempt.reason };
  }

  const { quote, client, property } = (await findForAcceptance(
    pending.quoteId,
  ))!;
  const offer = await offerFor(quote, pending.cleanType);
  const booking: Booking = {
    quote,
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

      // a Deposit was being taken, so the Quote starts its home's plan
      const hold = await holdForBooking(tx, quote, offer, null);
      await settle(ref, tx);
      if (hold.unbookable) {
        return { status: "refunded", unbookable: hold.unbookable } as const;
      }
      const booked = await recordAcceptance(tx, booking, attempt, null);
      return { status: "accepted", booked } as const;
    });
  } catch (error) {
    if (attempt.chargeId) {
      await refundUnbooked(attempt.chargeId, pending.depositCents, quote.id);
    }
    // given back: a later webhook mustn't book it after all
    await settle(ref);
    throw error;
  }

  if (result.status === "refunded" && attempt.chargeId) {
    await refundUnbooked(attempt.chargeId, pending.depositCents, quote.id);
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
      return "Your bank hasn't approved the payment yet. Please approve it and try again.";
    case "failed":
      return "Your bank didn't approve the payment, so nothing has been booked. Please try again, or use another card.";
    case "refunded":
      return finalized.unbookable.reason === "no_room"
        ? "Sorry, that time was booked up while your bank was approving the payment. We've refunded your Deposit and we'll be in touch with another time."
        : finalized.unbookable.reason === "has_plan" ||
            finalized.unbookable.reason === "plan_changed"
          ? "This home's Service Plan started while your bank was approving the payment, so we've refunded your Deposit."
          : "This Quote closed while your bank was approving the payment, so we've refunded your Deposit.";
    default:
      return "There's no payment waiting for approval on this Quote.";
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
    depositCents: offer.depositCents,
    totalCents: offer.cleans[0]!.option.totalCents,
    paymentMethod: paidWith,
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
        : sendBookingConfirmation(client, property, jobs[0]!, paid));
  } catch (error) {
    console.error(
      `booking confirmation for Job ${jobs[0]!.id} not sent:`,
      error,
    );
  }
  for (const day of new Set(jobs.map((j) => dayOf(j.startsAt)))) {
    await warnOfficeOfQuotesWithoutRoom(day);
  }
  if (plan) await generateServicePlanJobs(plan.id);
};

type Paid = {
  depositCents: number;
  // a one-off Job's, or a plan's first clean's
  totalCents: number;
  paymentMethod: string | null;
};

const chargedTo = (paid: Paid) =>
  paid.paymentMethod ? `your ${paid.paymentMethod}` : "your card";

// a plan's weekdays, and what each clean on them costs
const planPrices = (offer: Offer, paid: Paid, now = "") =>
  offer.cleans.length === 1
    ? `Each clean is ${now}${formatMoney(paid.totalCents)}, charged to ${chargedTo(paid)} when it's done.`
    : `Each clean is charged to ${chargedTo(paid)} when it's done: ${offer.cleans
        .map(
          (c) =>
            `${formatMoney(c.option.totalCents)} on ${weekdayName(c.startsAt)}s`,
        )
        .join(", ")}.`;

const planOf = (plan: ServicePlan, offer: Offer, where = "") =>
  describePlan(
    plan.recurrence,
    offer.cleans.map((c) => ({
      startsAt: c.startsAt,
      cleanType: c.option.cleanType,
    })),
    where,
  );

// one email for the whole plan: its Jobs after the first get only the
// day-before reminder
const sendPlanConfirmation = async (
  client: Client,
  property: Property,
  offer: Offer,
  plan: ServicePlan,
  paid: Paid,
) => {
  const first = offer.cleans[0]!.startsAt;
  await email.send({
    to: client.email,
    subject: "Your Service Plan with Empire Cleaning has started",
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        offer.cleans.length === 1
          ? `Your Service Plan has started: ${planOf(plan, offer, ` at ${addressOf(property)}`)}. The first is on ${formatWhen(first)}.`
          : `Your Service Plan at ${addressOf(property)} has started: ${planOf(plan, offer)}. The first is on ${formatWhen(first)}.`,
        planPrices(offer, paid),
        ...(paid.depositCents > 0
          ? [
              `We've taken your Deposit of ${formatMoney(paid.depositCents)}. We hold it for as long as the plan runs, and it comes off your last clean when the plan ends.`,
            ]
          : []),
        "We'll remind you the day before each clean. Please check your Access Instructions, so our team can get in:",
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/details`,
        label: "Check your Access Instructions",
      },
    ),
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
  paid: Paid,
) => {
  const first = offer.cleans[0]!.startsAt;
  await email.send({
    to: client.email,
    subject: "Your Service Plan with Empire Cleaning has changed",
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        `Your Service Plan at ${addressOf(property)} has changed: from ${formatWhen(first)}, it's ${planOf(plan, offer)}.`,
        `${planPrices(offer, paid, "now ")} Cleans before then go ahead as they were.`,
        ...(replaced.length > 0
          ? [
              `The ${replaced.length === 1 ? "clean" : "cleans"} you had booked from then on (${replaced.map((j) => formatWhen(j.startsAt)).join("; ")}) ${replaced.length === 1 ? "is" : "are"} cancelled, at no charge.`,
            ]
          : []),
        "Your Deposit stays as it is: we hold it for as long as the plan runs, and it comes off your last clean when the plan ends.",
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/plans/${plan.id}`,
        label: "See your Service Plan",
      },
    ),
  });
};

const sendBookingConfirmation = async (
  client: Client,
  property: Property,
  job: Job,
  paid: Paid,
) => {
  const balance = paid.totalCents - paid.depositCents;
  await email.send({
    to: client.email,
    subject: "You're booked with Empire Cleaning",
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        `You're booked: a ${cleanTypeLabel[job.cleanType]} at ${addressOf(property)} on ${formatWhen(job.startsAt)}.`,
        paid.depositCents > 0
          ? `We've taken your Deposit of ${formatMoney(paid.depositCents)} from ${chargedTo(paid)}. The rest, ${formatMoney(balance)}, is charged to it when the clean is done.`
          : `The ${formatMoney(paid.totalCents)} is charged to ${chargedTo(paid)} when the clean is done.`,
        "We'll remind you the day before. Please check your Access Instructions, so our team can get in:",
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/details`,
        label: "Check your Access Instructions",
      },
    ),
  });
};
