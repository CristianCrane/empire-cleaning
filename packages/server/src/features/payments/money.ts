import { and, eq, inArray, isNull, lte, notExists, or, sql } from "drizzle-orm";
import { DAY_MS } from "@empire-cleaning/models";
import { apart, db, type Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { monitoring } from "../../services/monitoring/index.ts";
import {
  paymentGateway,
  type ChargeInput,
  type ChargeResult,
  type DepositAttempt,
  type DepositInput,
  type RefundResult,
  type SavedPaymentMethod,
} from "../../services/payment-gateway/index.ts";
import { bills } from "../bills/bills.schema.ts";
import type { Client } from "../clients/clients.schema.ts";
import { idempotencyKey } from "./keys.ts";
import { payerFor } from "./payments.ts";
import {
  chargeAttempts,
  charges,
  refundAttempts,
  refunds,
  type Charge,
  type ChargeAttempt,
  type PaymentMethodRow,
  type RefundAttempt,
} from "./payments.schema.ts";

// Money moved off-session, and kept in our ledger of Charges and Refunds.
// Refunds made in the payment provider's dashboard are recorded too.
// The Deposit is taken while the Client accepts, and recorded once the
// booking it pays for is made; takeDepositOnce() asks for it.

// what a Charge is for: a Job's Balance, or the fee for one that didn't
// happen, or a weekly Bill (ADR-0016)
export type ChargeFor =
  { jobId: string; kind: "balance" | "fee" } | { billId: string; kind: "bill" };

// what charging came to: how much was taken, or why nothing more was
export type Taken = { ok: true; cents: number } | { ok: false; reason: string };

// why nothing was taken when the provider didn't answer
export const UNREACHABLE = "the payment provider couldn't be reached";
// why nothing was taken when what the provider made of it isn't known yet:
// a later try asks again
export const WAITING_ON_PROVIDER = [UNREACHABLE, "processing"];
// why nothing was taken from a Client with no card saved
export const NO_CARD = "no Payment Method is saved";

// ---- asking the provider once (#241) ----
//
// Each payment is an attempt, committed before the provider is asked, with
// its own idempotency key. If the reply never comes, or the transaction it
// was taken in rolls back, the next try for the same thing finds the
// attempt: asks again with its key within a day, while the provider still
// replays it, or else looks the payment up; and records what was taken
// rather than taking it again. A declined attempt is over, so the next try
// asks the card afresh.

// the provider call an attempt makes, as asked but for its key
type Asked =
  | { call: "charge"; input: Omit<ChargeInput, "idempotencyKey"> }
  | { call: "deposit"; input: Omit<DepositInput, "idempotencyKey"> };

// where an attempt stands once asked: taken (with the card a Deposit saved,
// when it's known), or not yet known, or not taken
type Outcome =
  | {
      status: "taken";
      attempt: ChargeAttempt;
      saved: SavedPaymentMethod | null;
    }
  | { status: "unknown"; reason: string }
  | { status: "needs_approval"; ref: string; secret: string }
  | { status: "failed"; reason: string };

// written outside the caller's transaction, so it stands whatever that does
const update = async (
  attempt: ChargeAttempt,
  set: Partial<Pick<ChargeAttempt, "status" | "gatewayRef" | "reason">>,
) => {
  const [updated] = await apart
    .update(chargeAttempts)
    .set(set)
    .where(eq(chargeAttempts.id, attempt.id))
    .returning();
  return updated!;
};

// keeps what the provider said of an attempt
const keep = async (
  attempt: ChargeAttempt,
  reply: ChargeResult | DepositAttempt,
): Promise<Outcome> => {
  const said: DepositAttempt =
    "ok" in reply
      ? reply.ok
        ? { status: "succeeded", chargeId: reply.chargeId, saved: null }
        : { status: "failed", reason: reply.reason }
      : reply;
  if ("ok" in reply && !reply.ok && "chargeId" in reply) {
    await update(attempt, { status: "processing", gatewayRef: reply.chargeId });
    return { status: "unknown", reason: "processing" };
  }
  switch (said.status) {
    case "succeeded":
      return {
        status: "taken",
        attempt: await update(attempt, {
          status: "taken",
          gatewayRef: said.chargeId,
        }),
        saved: said.saved,
      };
    // the Client's bank wants them there: a Deposit waiting on it is the
    // pending Deposit's to finish, not the attempt's
    case "needs_approval":
      await update(attempt, {
        status: "failed",
        gatewayRef: said.ref,
        reason: "needs_approval",
      });
      return said;
    case "failed":
      await update(attempt, { status: "failed", reason: said.reason });
      return said;
  }
};

// asks the provider with the attempt's key; no reply leaves it pending
const ask = async (attempt: ChargeAttempt): Promise<Outcome> => {
  const asked = attempt.request as Asked;
  const key = idempotencyKey.charge(attempt);
  try {
    return await keep(
      attempt,
      asked.call === "charge"
        ? await paymentGateway.charge({ ...asked.input, idempotencyKey: key })
        : await paymentGateway.takeDeposit({
            ...asked.input,
            idempotencyKey: key,
          }),
    );
  } catch (error) {
    monitoring.signal("payment_gateway_error", {
      what: `a Charge for ${attempt.kind} ${attempt.forId}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return { status: "unknown", reason: UNREACHABLE };
  }
};

// what an earlier attempt came to, asking the provider if we never heard
const outcomeOf = async (attempt: ChargeAttempt): Promise<Outcome> => {
  if (attempt.status === "taken") {
    return { status: "taken", attempt, saved: null };
  }
  const fresh = clock.now().getTime() - attempt.askedAt.getTime() < DAY_MS;
  if (attempt.status === "pending" && fresh) return ask(attempt);
  const found = await paymentGateway
    .chargeOutcome({
      payerId: (attempt.request as Asked).input.payerId,
      idempotencyKey: idempotencyKey.charge(attempt),
      chargeId: attempt.gatewayRef,
      since: attempt.askedAt,
    })
    .catch(() => undefined);
  if (found === undefined) return { status: "unknown", reason: UNREACHABLE };
  return found === null
    ? (await update(attempt, { status: "failed", reason: "never_made" }),
      { status: "failed", reason: "never_made" })
    : keep(attempt, found);
};

// an attempt we never heard the end of, or that took money no Charge
// records yet
const isOpen = (tx: Tx | typeof db) =>
  or(
    inArray(chargeAttempts.status, ["pending", "processing"]),
    and(
      eq(chargeAttempts.status, "taken"),
      notExists(
        tx
          .select({ one: sql`1` })
          .from(charges)
          .where(eq(charges.gatewayRef, chargeAttempts.gatewayRef)),
      ),
    ),
  );

// the open attempts for a Job, Bill or Quote, of any kind: a Job asked for
// as a fee may be charged a Balance now
const openAttempts = (tx: Tx, forId: string) =>
  tx
    .select()
    .from(chargeAttempts)
    .where(and(eq(chargeAttempts.forId, forId), isOpen(tx)))
    .orderBy(chargeAttempts.askedAt);

// a new attempt, committed, then asked
const attempt = async (
  kind: ChargeAttempt["kind"],
  forId: string,
  asked: Asked,
): Promise<Outcome> => {
  const [made] = await apart
    .insert(chargeAttempts)
    .values({
      kind,
      forId,
      request: asked,
      amountCents: asked.input.amount,
      askedAt: clock.now(),
    })
    .returning();
  return ask(made!);
};

const forIdOf = (chargeFor: ChargeFor) =>
  "jobId" in chargeFor ? chargeFor.jobId : chargeFor.billId;

// the Charge an attempt took, recorded
const record = async (
  tx: Tx,
  chargeFor: ChargeFor,
  taken: ChargeAttempt,
  item: string | null,
) => {
  const [charge] = await tx
    .insert(charges)
    .values({
      ...("jobId" in chargeFor
        ? { jobId: chargeFor.jobId, kind: taken.kind as "balance" | "fee" }
        : { billId: chargeFor.billId, kind: "bill" as const }),
      item,
      amountCents: taken.amountCents,
      gatewayRef: taken.gatewayRef!,
      chargedAt: taken.askedAt,
    })
    .returning();
  return charge!;
};

/**
 * Records what earlier attempts for a Job or Bill took that no Charge
 * records yet, asking the provider how each ended: the Charges, or why
 * that isn't known yet.
 */
export const recordTakenEarlier = async (
  tx: Tx,
  chargeFor: ChargeFor,
): Promise<Charge[] | { unknown: string }> => {
  const recorded: Charge[] = [];
  for (const earlier of await openAttempts(tx, forIdOf(chargeFor))) {
    const outcome = await outcomeOf(earlier);
    if (outcome.status === "unknown") return { unknown: outcome.reason };
    if (outcome.status === "taken") {
      recorded.push(await record(tx, chargeFor, outcome.attempt, null));
    }
  }
  return recorded;
};

/**
 * Charges a Client's saved Payment Method, without them there, and records
 * the Charge. What an earlier try for the same thing took, whose reply was
 * lost or whose transaction rolled back, is recorded first and counts
 * towards `amount`; only the rest is asked for. Never throws for money that
 * couldn't be taken: no Payment Method saved, a decline, or the provider
 * unreachable (or an earlier try still unknown) each come back as why, for
 * the caller to make what it charged for Unpaid.
 */
export const chargeSaved = async (
  tx: Tx,
  {
    client,
    method,
    amount,
    description,
    for: chargeFor,
    item = null,
  }: {
    client: Pick<Client, "id" | "name" | "email">;
    method: PaymentMethodRow | null;
    amount: number;
    description: string;
    for: ChargeFor;
    // the one change to the price it's for, by name, if it is
    item?: string | null;
  },
): Promise<Taken> => {
  if (!method) return { ok: false, reason: NO_CARD };
  const earlier = await recordTakenEarlier(tx, chargeFor);
  // it may yet take the money, so nothing more is asked for meanwhile
  if ("unknown" in earlier) return { ok: false, reason: earlier.unknown };
  let cents = earlier.reduce((sum, c) => sum + c.amountCents, 0);
  if (cents >= amount) return { ok: true, cents };

  const payerId = await payerFor(client).catch((error: unknown) => {
    monitoring.signal("payment_gateway_error", {
      what: `a payer for Client ${client.id}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  if (!payerId) return { ok: false, reason: UNREACHABLE };
  const outcome = await attempt(chargeFor.kind, forIdOf(chargeFor), {
    call: "charge",
    input: {
      payerId,
      paymentMethodId: method.gatewayRef,
      amount: amount - cents,
      description,
    },
  });
  if (outcome.status !== "taken") {
    return cents > 0
      ? { ok: true, cents }
      : {
          ok: false,
          reason:
            outcome.status === "needs_approval"
              ? "needs_approval"
              : outcome.reason,
        };
  }
  await record(tx, chargeFor, outcome.attempt, item);
  return { ok: true, cents: cents + outcome.attempt.amountCents };
};

/**
 * Takes a Quote's Deposit once, however often accepting it is tried: a
 * Deposit an earlier try took, whose reply was lost or whose booking rolled
 * back unrecorded, is the Deposit, if it was for as much and the card it
 * saved (if any) is known; otherwise it's given back, and a new one taken.
 * An earlier try still unknown takes nothing more. `call` says how: on
 * session, as the Client accepts, or as a Charge, as the Office does.
 */
export const takeDepositOnce = async (
  tx: Tx,
  quoteId: string,
  asked: Asked,
): Promise<DepositAttempt> => {
  for (const earlier of await openAttempts(tx, quoteId)) {
    const outcome = await outcomeOf(earlier);
    if (outcome.status === "unknown") {
      return { status: "failed", reason: outcome.reason };
    }
    if (outcome.status !== "taken") continue;
    const before = earlier.request as Asked;
    const savedNothing =
      before.call === "charge" || "paymentMethodId" in before.input.source;
    if (
      outcome.attempt.amountCents === asked.input.amount &&
      (savedNothing || outcome.saved)
    ) {
      return {
        status: "succeeded",
        chargeId: outcome.attempt.gatewayRef!,
        saved: outcome.saved,
      };
    }
    await giveBackDeposit(
      outcome.attempt.gatewayRef!,
      outcome.attempt.amountCents,
      quoteId,
    );
  }

  const outcome = await attempt("deposit", quoteId, asked);
  switch (outcome.status) {
    case "taken":
      return {
        status: "succeeded",
        chargeId: outcome.attempt.gatewayRef!,
        saved: outcome.saved,
      };
    case "unknown":
      return { status: "failed", reason: outcome.reason };
    default:
      return outcome;
  }
};

// a Deposit was taken but nothing was booked: give it back
export const giveBackDeposit = async (
  chargeId: string,
  amount: number,
  quoteId: string,
) => {
  const refunded = await paymentGateway
    .refund({
      chargeId,
      amount,
      idempotencyKey: idempotencyKey.givingBack(chargeId),
    })
    .catch((e: unknown) => ({ ok: false, reason: String(e) }) as const);
  if (!refunded.ok) {
    // taken but not booked: refund it by hand
    monitoring.signal("refund_failed", {
      chargeId,
      quoteId,
      cents: amount,
      reason: refunded.reason,
    });
    return;
  }
  await apart
    .update(chargeAttempts)
    .set({ status: "given_back" })
    .where(eq(chargeAttempts.gatewayRef, chargeId));
};

/**
 * Gives back what earlier tries to accept a Quote took as its Deposit, when
 * no booking recorded it: their reply was lost, and the Client didn't try
 * again. Hold the Quote, so no try to accept it is taking one meanwhile.
 */
export const giveBackUnbookedDeposits = async (tx: Tx, quoteId: string) => {
  for (const earlier of await openAttempts(tx, quoteId)) {
    const outcome = await outcomeOf(earlier);
    if (outcome.status !== "taken") continue;
    await giveBackDeposit(
      outcome.attempt.gatewayRef!,
      outcome.attempt.amountCents,
      quoteId,
    );
  }
};

// ---- giving back once (#241) ----
//
// As with Charges: each refund is an attempt, committed before the provider
// is asked, with its own idempotency key. One the provider made, but whose
// reply was lost or whose transaction rolled back, is recorded by the next
// try for the same thing rather than given again: asked again with its key
// within a day, or else looked up by it.

// what the provider said of a refund attempt, kept outside the caller's
// transaction
const keepRefund = async (
  attempt: RefundAttempt,
  reply: RefundResult,
): Promise<RefundResult> => {
  await apart
    .update(refundAttempts)
    .set(
      reply.ok
        ? { status: "made", gatewayRef: reply.refundId }
        : { status: "refused", reason: reply.reason },
    )
    .where(eq(refundAttempts.id, attempt.id));
  return reply;
};

// asks the provider with the attempt's key; null when no reply came, which
// leaves it pending
const askRefund = async (
  attempt: RefundAttempt,
  gatewayChargeId: string,
): Promise<RefundResult | null> => {
  try {
    return await keepRefund(
      attempt,
      await paymentGateway.refund({
        chargeId: gatewayChargeId,
        amount: attempt.amountCents,
        idempotencyKey: idempotencyKey.refund(attempt),
      }),
    );
  } catch (error) {
    monitoring.signal("payment_gateway_error", {
      what: `a refund for ${attempt.forId}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

// what an earlier refund attempt came to, asking the provider if we never
// heard; null while that's still unknown
const refundOutcomeOf = async (
  attempt: RefundAttempt,
  gatewayChargeId: string,
): Promise<RefundResult | null> => {
  if (attempt.status === "made") {
    return { ok: true, refundId: attempt.gatewayRef! };
  }
  if (clock.now().getTime() - attempt.askedAt.getTime() < DAY_MS) {
    return askRefund(attempt, gatewayChargeId);
  }
  const found = await paymentGateway
    .refundOutcome({
      chargeId: gatewayChargeId,
      idempotencyKey: idempotencyKey.refund(attempt),
    })
    .catch(() => undefined);
  if (found === undefined) return null;
  return keepRefund(attempt, found ?? { ok: false, reason: "never_made" });
};

// a refund attempt we never heard the end of, or that gave back money no
// Refund records yet
const isOpenRefund = (tx: Tx | typeof db) =>
  or(
    eq(refundAttempts.status, "pending"),
    and(
      eq(refundAttempts.status, "made"),
      notExists(
        tx
          .select({ one: sql`1` })
          .from(refunds)
          .where(eq(refunds.gatewayRef, refundAttempts.gatewayRef)),
      ),
    ),
  );

// the open refund attempts for something, with the Charge each is from
const openRefundAttempts = (tx: Tx | typeof db, forId: string) =>
  tx
    .select({ attempt: refundAttempts, charge: charges })
    .from(refundAttempts)
    .innerJoin(charges, eq(charges.id, refundAttempts.chargeId))
    .where(and(eq(refundAttempts.forId, forId), isOpenRefund(tx)))
    .orderBy(refundAttempts.askedAt);

// what a refund gives back for, and how its Refund is recorded
type RefundFor = {
  // the Job, Bill or Bill's credit: a later try for the same thing finds
  // what an earlier one gave back
  for: string;
  // the one change to the price it gives back for, by name, if it is
  item?: string | null;
  // when `from` are Bills' Charges: the Job it gives back for, or the Bill
  // whose credit it is
  jobId?: string | null;
  creditBillId?: string | null;
};

/**
 * Gives back up to `amount` from these Charges, latest first, each only as
 * far as it hasn't been refunded already, and records each Refund. What an
 * earlier try for the same thing gave back unrecorded is recorded first,
 * and counts towards `amount`. Stops at the first refund that fails, or
 * whose outcome isn't known yet, so trying again later takes up from there.
 * Returns how much it gave back.
 */
export const refundFrom = async (
  tx: Tx | typeof db,
  from: Charge[],
  amount: number,
  { for: forId, item = null, jobId = null, creditBillId = null }: RefundFor,
): Promise<number> => {
  if (amount <= 0) return 0;
  const record = (attempt: RefundAttempt, refundId: string) =>
    tx.insert(refunds).values({
      chargeId: attempt.chargeId,
      item: attempt.item,
      jobId: attempt.jobId,
      creditBillId: attempt.creditBillId,
      amountCents: attempt.amountCents,
      gatewayRef: refundId,
      refundedAt: attempt.askedAt,
    });

  let left = amount;
  for (const { attempt, charge } of await openRefundAttempts(tx, forId)) {
    const outcome = await refundOutcomeOf(attempt, charge.gatewayRef);
    // it may yet be given, so nothing more is meanwhile
    if (!outcome) return amount - left;
    if (outcome.ok) {
      await record(attempt, outcome.refundId);
      left = Math.max(left - attempt.amountCents, 0);
    }
  }
  if (left === 0 || from.length === 0) return amount - left;

  const given = await tx
    .select()
    .from(refunds)
    .where(
      inArray(
        refunds.chargeId,
        from.map((c) => c.id),
      ),
    );
  // one whose refund failed after it was made won't take another: the card
  // behind it is gone, so the Office gives it back another way
  const refusing = new Set(
    given.filter((r) => r.failedAt).map((r) => r.chargeId),
  );
  const latestFirst = [...from].sort(
    (a, b) =>
      b.chargedAt.getTime() - a.chargedAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  for (const charge of latestFirst) {
    if (left === 0) break;
    if (refusing.has(charge.id)) continue;
    const already = given
      .filter((r) => r.chargeId === charge.id && !r.failedAt)
      .reduce((sum, r) => sum + r.amountCents, 0);
    const part = Math.min(left, charge.amountCents - already);
    if (part <= 0) continue;
    const [attempt] = await apart
      .insert(refundAttempts)
      .values({
        forId,
        chargeId: charge.id,
        amountCents: part,
        item,
        jobId,
        creditBillId,
        askedAt: clock.now(),
      })
      .returning();
    const refunded = await askRefund(attempt!, charge.gatewayRef);
    if (!refunded) break;
    if (!refunded.ok) {
      monitoring.signal("refund_failed", {
        chargeId: charge.id,
        cents: part,
        reason: refunded.reason,
      });
      break;
    }
    await record(attempt!, refunded.refundId);
    left -= part;
  }
  return amount - left;
};

/**
 * Records the refunds of a Charge that were made in the payment provider's
 * dashboard, not by us, each once, as the counted refunded_at_provider
 * signal says. The Client owes that much less: settling never charges it
 * back (refundedAtProvider). A payment we have no Charge for is only
 * signalled.
 */
export const recordRefundsAtProvider = async (gatewayChargeId: string) => {
  const [charge] = await db
    .select()
    .from(charges)
    .where(eq(charges.gatewayRef, gatewayChargeId));
  if (!charge) {
    monitoring.signal("refunded_at_provider", { ref: gatewayChargeId });
    return;
  }
  for (const refund of await paymentGateway.refundsElsewhere(gatewayChargeId)) {
    const recorded = await db
      .insert(refunds)
      .values({
        chargeId: charge.id,
        amountCents: refund.amount,
        gatewayRef: refund.refundId,
        refundedAt: refund.at,
        atProvider: true,
      })
      // told of before, or one of ours made before they were marked
      .onConflictDoNothing({ target: refunds.gatewayRef })
      .returning({ id: refunds.id });
    if (recorded.length > 0) {
      monitoring.signal("refunded_at_provider", {
        chargeId: charge.id,
        cents: refund.amount,
      });
    }
  }
};

// what the refunds made in the provider's dashboard took off what a
// Client owes: a discount, never charged back
export const refundedAtProvider = (
  given: { amountCents: number; atProvider: boolean }[],
) =>
  given.filter((r) => r.atProvider).reduce((sum, r) => sum + r.amountCents, 0);

/**
 * A refund the provider made, then failed (#241): it counts for nothing
 * from now on, as the money wasn't given back. One made in the dashboard
 * was a discount, now undone; one of ours leaves the Job (or the Bill's
 * credit) owed back again, which the urgent refund_failed signal tells the
 * Office to give another way, as settling won't refund that Charge again.
 * Told twice, it's one failure.
 */
export const recordRefundFailed = async (gatewayRefundId: string) => {
  const [failed] = await db
    .update(refunds)
    .set({ failedAt: clock.now() })
    .where(
      and(eq(refunds.gatewayRef, gatewayRefundId), isNull(refunds.failedAt)),
    )
    .returning();
  if (!failed) {
    const [known] = await db
      .select({ id: refunds.id })
      .from(refunds)
      .where(eq(refunds.gatewayRef, gatewayRefundId));
    // not one we recorded: for us to look into
    if (!known) monitoring.signal("refund_failed", { ref: gatewayRefundId });
    return;
  }
  if (failed.creditBillId) {
    await db
      .update(bills)
      .set({
        creditRefundedCents: sql`${bills.creditRefundedCents} - ${failed.amountCents}`,
        creditRefundedAt: null,
      })
      .where(eq(bills.id, failed.creditBillId));
  }
  monitoring.signal("refund_failed", {
    chargeId: failed.chargeId,
    cents: failed.amountCents,
    atProvider: failed.atProvider,
    reason: "failed at the provider after it was made",
  });
};

/**
 * What waits on payments asked for before `before` that are still open:
 * the Jobs, Bills and Quotes Charge attempts were for, and the Jobs and
 * Charges refund attempts were for. A credit's refunds are left to the run
 * that refunds lapsed credits, which tries them again anyway.
 */
export const openBefore = async (before: Date) => {
  const charging = await db
    .selectDistinct({ kind: chargeAttempts.kind, forId: chargeAttempts.forId })
    .from(chargeAttempts)
    .where(and(lte(chargeAttempts.askedAt, before), isOpen(db)));
  const refunding = await db
    .selectDistinct({
      forId: refundAttempts.forId,
      chargeId: refundAttempts.chargeId,
    })
    .from(refundAttempts)
    .where(
      and(
        lte(refundAttempts.askedAt, before),
        isNull(refundAttempts.creditBillId),
        isOpenRefund(db),
      ),
    );
  const of = (kinds: ChargeAttempt["kind"][]) =>
    charging.filter((a) => kinds.includes(a.kind)).map((a) => a.forId);
  return {
    jobs: [
      ...of(["balance", "fee"]),
      // a Job's refunds are for it; all of a Charge's are for the Charge
      ...refunding.filter((r) => r.forId !== r.chargeId).map((r) => r.forId),
    ],
    bills: of(["bill"]),
    quotes: of(["deposit"]),
    charges: refunding
      .filter((r) => r.forId === r.chargeId)
      .map((r) => r.chargeId),
  };
};
