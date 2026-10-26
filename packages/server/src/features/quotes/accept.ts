import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type {
  CleanType,
  QuoteOption,
  QuoteStatus,
  Recurrence,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import env from "../../env.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock, dayOf } from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatMoney,
  formatTime,
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
  generateServicePlanJobs,
  hasServicePlan,
  startServicePlan,
} from "../service-plans/service-plans.ts";
import type { ServicePlan } from "../service-plans/service-plans.schema.ts";
import { warnOfficeOfQuotesWithoutRoom } from "./quote-room.ts";
import { statusOf } from "./quote-state.ts";
import { lockProperty, toOption } from "./quotes.ts";
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
  // a Service Plan Quote for a home with a plan already: changing a plan's
  // terms by a new Quote is #15's
  | { reason: "has_plan" };

const hasPlanMessage = (acceptor: Acceptor["by"]) =>
  acceptor === "client"
    ? "This home already has a Service Plan, so nothing has been charged. We'll be in touch about changing it."
    : "This home already has a Service Plan, so nothing was charged. Changing a plan's terms isn't possible yet.";

const unbookableMessage = (unbookable: Unbookable, acceptor: Acceptor) => {
  if (unbookable.reason === "closed") {
    return closedMessage(unbookable.status, acceptor.by);
  }
  if (unbookable.reason === "has_plan") return hasPlanMessage(acceptor.by);
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

const optionFor = async (quote: Quote, cleanType: CleanType) => {
  const [row] = await db
    .select()
    .from(quoteOptions)
    .where(
      and(
        eq(quoteOptions.quoteId, quote.id),
        eq(quoteOptions.cleanType, cleanType),
      ),
    );
  return toOption(quote, row!);
};

/**
 * Holds what booking needs until the transaction ends: the Property (so a
 * newer Quote can't be sent meanwhile), the Quote, and the proposed day (so
 * two acceptances can't both take its last free hours or crew). Then says
 * whether the Quote can still be booked: open, and its time with room.
 */
const holdForBooking = async (
  tx: Tx,
  quote: Quote,
  option: QuoteOption,
): Promise<Unbookable | null> => {
  await lockProperty(tx, quote.propertyId);
  const [current] = await tx
    .select()
    .from(quotes)
    .where(eq(quotes.id, quote.id))
    .for("update");
  const status = statusOf(current!);
  if (status !== "sent") return { reason: "closed", status };
  if (
    quote.kind === "service_plan" &&
    (await hasServicePlan(quote.propertyId, tx))
  ) {
    return { reason: "has_plan" };
  }

  await lockDay(tx, dayOf(quote.proposedStartsAt!));
  const { hasRoom } = await roomFor({
    startsAt: quote.proposedStartsAt!,
    labourHours: option.labourHours,
    crewSize: quote.crewSize,
  });
  return hasRoom ? null : { reason: "no_room" };
};

type Booking = {
  quote: Quote;
  property: Property;
  cleanType: CleanType;
  option: QuoteOption;
  clientId: string;
  acceptedBy: string | null;
};

// books the Job and Accepts the Quote, with its Deposit paid; inside a
// transaction holding them (holdForBooking). A Service Plan Quote starts its
// plan, with the Job as its first, and the Deposit is the plan's: held for
// its life, not counted towards that Job's price.
const recordAcceptance = async (
  tx: Tx,
  booking: Booking,
  paid: Extract<DepositAttempt, { status: "succeeded" }>,
): Promise<{ job: Job; plan: ServicePlan | null }> => {
  const { quote, property, cleanType, option } = booking;
  const now = clock.now();
  const job = await bookJob(
    {
      propertyId: property.id,
      cleanType,
      startsAt: quote.proposedStartsAt!,
      labourHours: option.labourHours,
      crewSize: quote.crewSize,
    },
    tx,
  );
  const plan =
    quote.kind === "service_plan"
      ? await startServicePlan(tx, {
          quote,
          option,
          firstJob: job,
          startedBy: booking.acceptedBy,
        })
      : null;
  if (paid.chargeId) {
    await tx.insert(charges).values({
      ...(plan ? { servicePlanId: plan.id } : { jobId: job.id }),
      kind: "deposit",
      amountCents: option.depositCents,
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
      acceptedCleanType: cleanType,
      jobId: job.id,
      acceptedBy: booking.acceptedBy,
    })
    .where(eq(quotes.id, quote.id));
  return { job, plan };
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

const describe = (booking: Booking) =>
  `Deposit: ${cleanTypeLabel[booking.cleanType]} at ${addressOf(booking.property)}, ${formatWhen(booking.quote.proposedStartsAt!)}`;

/**
 * Accepts a Sent Quote with the Clean Type chosen, as one step: the proposed
 * day must still have room for its Labour Hours, and the Deposit must be
 * taken; only then is the Quote Accepted and the Job booked (ADR-0001). If
 * either fails, nothing changes and the Quote stays Sent.
 *
 * A Client pays with a card entered just now (`paymentToken`, from the
 * provider's form in their browser), which the same payment saves for later
 * Charges, or else with their saved Payment Method (ADR-0008). Their bank
 * may want them to approve it first: then nothing is booked yet, and
 * finalizeDeposit() books it once approved. Office Staff always charge the
 * saved Payment Method, without the Client there.
 *
 * Everything from checking the day has room to booking it happens in one
 * transaction holding the day, with the Deposit taken inside it, and
 * refunded if the booking then fails to save.
 */
export const acceptQuote = async (
  id: string,
  { cleanType, paymentToken }: { cleanType: CleanType; paymentToken?: string },
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
  if (quote.kind === "service_plan") {
    // a Service Plan Quote offers the one Clean Type
    const [offered] = await db
      .select()
      .from(quoteOptions)
      .where(eq(quoteOptions.quoteId, quote.id));
    if (offered!.cleanType !== cleanType) {
      throw new ConflictError(
        `This Service Plan is for a ${cleanTypeLabel[offered!.cleanType]}.`,
      );
    }
    if (await hasServicePlan(property.id, db)) {
      throw new ConflictError(hasPlanMessage(acceptor.by));
    }
  }

  const saved = await paymentMethodOf(client.id);
  const token = acceptor.by === "client" ? paymentToken : undefined;
  if (!token && !saved) {
    throw new ConflictError(
      acceptor.by === "client"
        ? "Enter a card to accept this Quote."
        : `${client.name} hasn't added a Payment Method yet. Email them a link to add one.`,
    );
  }

  const option = await optionFor(quote, cleanType);
  const payerId = await payerFor(client);
  const booking: Booking = {
    quote,
    property,
    cleanType,
    option,
    clientId: client.id,
    acceptedBy: acceptor.accountId,
  };

  // a card entered just now is used once, so its token keys the Deposit; a
  // saved one is keyed per attempt, so a retry after a refund can't replay a
  // payment that was given back
  const takeDeposit = (): Promise<DepositAttempt> => {
    // a 0% Deposit from a saved card has nothing to take or save
    if (option.depositCents === 0 && !token) {
      return Promise.resolve({
        status: "succeeded",
        chargeId: null,
        saved: null,
      });
    }
    if (acceptor.by === "client") {
      return paymentGateway.takeDeposit({
        payerId,
        source: token ? { token } : { paymentMethodId: saved!.gatewayRef },
        amount: option.depositCents,
        description: describe(booking),
        idempotencyKey: `deposit:${id}:${token ?? randomUUID()}`,
      });
    }
    // the Office: off-session, so no approval can be asked for
    return paymentGateway
      .charge({
        payerId,
        paymentMethodId: saved!.gatewayRef,
        amount: option.depositCents,
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
      const unbookable = await holdForBooking(tx, quote, option);
      if (unbookable) {
        throw new ConflictError(unbookableMessage(unbookable, acceptor));
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
          cleanType,
          depositCents: option.depositCents,
          acceptedBy: acceptor.accountId,
        });
        return { status: "needs_approval", secret: attempt.secret } as const;
      }

      chargeId = attempt.chargeId;
      const booked = await recordAcceptance(tx, booking, attempt);
      return {
        status: "accepted",
        booked,
        paidWith: attempt.saved?.label ?? saved!.label,
      } as const;
    });
  } catch (error) {
    if (chargeId) await refundUnbooked(chargeId, option.depositCents, id);
    throw error;
  }

  if (outcome.status === "needs_approval") return outcome;
  await afterAcceptance(
    client,
    property,
    outcome.booked,
    option,
    outcome.paidWith,
  );
  return { status: "accepted", job: outcome.booked.job };
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
  const option = await optionFor(quote, pending.cleanType);
  const booking: Booking = {
    quote,
    property,
    cleanType: pending.cleanType,
    option,
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

      const unbookable = await holdForBooking(tx, quote, option);
      await settle(ref, tx);
      if (unbookable) return { status: "refunded", unbookable } as const;
      const booked = await recordAcceptance(tx, booking, attempt);
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
  await afterAcceptance(client, property, result.booked, option, paidWith);
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
        : finalized.unbookable.reason === "has_plan"
          ? "This home already has a Service Plan, so we've refunded your Deposit. We'll be in touch about changing it."
          : "This Quote closed while your bank was approving the payment, so we've refunded your Deposit.";
    default:
      return "There's no payment waiting for approval on this Quote.";
  }
};

// Once the acceptance is saved: the Client's confirmation, the Office told of
// Sent Quotes the booking left without room, and a Service Plan's next Jobs
// put on the Schedule. An email that can't go mustn't make it look as though
// nothing was booked.
const afterAcceptance = async (
  client: Client,
  property: Property,
  { job, plan }: { job: Job; plan: ServicePlan | null },
  option: QuoteOption,
  paidWith: string,
) => {
  const paid = {
    depositCents: option.depositCents,
    totalCents: option.totalCents,
    paymentMethod: paidWith,
  };
  try {
    await (plan
      ? sendPlanConfirmation(client, property, job, plan, paid)
      : sendBookingConfirmation(client, property, job, paid));
  } catch (error) {
    console.error(`booking confirmation for Job ${job.id} not sent:`, error);
  }
  await warnOfficeOfQuotesWithoutRoom(dayOf(job.startsAt));
  if (plan) await generateServicePlanJobs(plan.id);
};

const recurrenceLabel: Record<Recurrence, string> = {
  weekly: "every week",
  fortnightly: "every 2 weeks",
  four_weekly: "every 4 weeks",
};

// one email for the whole plan: its Jobs after the first get only the
// day-before reminder
const sendPlanConfirmation = async (
  client: Client,
  property: Property,
  job: Job,
  plan: ServicePlan,
  paid: { depositCents: number; totalCents: number; paymentMethod: string },
) => {
  await email.send({
    to: client.email,
    subject: "Your Service Plan with Empire Cleaning has started",
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        `Your Service Plan has started: a ${cleanTypeLabel[plan.cleanType]} at ${addressOf(property)} ${recurrenceLabel[plan.recurrence]}, on ${weekdayName(job.startsAt)}s at ${formatTime(job.startsAt)}. The first is on ${formatWhen(job.startsAt)}.`,
        `Each clean is ${formatMoney(paid.totalCents)}, charged to your ${paid.paymentMethod} when it's done.`,
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

const sendBookingConfirmation = async (
  client: Client,
  property: Property,
  job: Job,
  paid: { depositCents: number; totalCents: number; paymentMethod: string },
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
          ? `We've taken your Deposit of ${formatMoney(paid.depositCents)} from your ${paid.paymentMethod}. The rest, ${formatMoney(balance)}, is charged to it when the clean is done.`
          : `The ${formatMoney(paid.totalCents)} is charged to your ${paid.paymentMethod} when the clean is done.`,
        "We'll remind you the day before. Please check your Access Instructions, so our team can get in:",
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/details`,
        label: "Check your Access Instructions",
      },
    ),
  });
};
