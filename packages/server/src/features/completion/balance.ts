import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { currentLanguage } from "#services/request";
import {
  type Card,
  type ChargeView,
  type JobPayment,
  formats,
  messages,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { APPROVE } from "../../services/payment-gateway/index.ts";
import { monitoring } from "../../services/monitoring/index.ts";
import {
  billLinesOf,
  billNumber,
  isBilledWeekly,
} from "../bills/billed-weekly.ts";
import type { Bill } from "../bills/bills.schema.ts";
import { standing } from "../bills/standing.ts";
import { paymentOn } from "../payments/payment-on.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import {
  chargeSaved,
  newestAttempt,
  NOT_APPROVED,
  recordGivenEarlier,
  recordTakenEarlier,
  refundedAtProvider,
  refundFrom,
  UNREACHABLE,
} from "../payments/money.ts";
import {
  charges,
  paymentMethods,
  refunds,
  cardIn,
  type Charge,
  type ChargeItem,
} from "../payments/payments.schema.ts";
import { nowTheirs, NOT_SETTLED, unpaidOf } from "../payments/unpaid.ts";
import { properties } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { holdOrResume, planOnHold } from "../service-plans/on-hold.ts";
import { adjustments, type Adjustment } from "./completion.schema.ts";
import { quotedJob } from "./pricing.ts";
import { serviceNameOf } from "../services/services.ts";

const { feeName } = messages.en;

const { formatWhen } = formats.en;

// the Adjustments that change what the Client pays
export const counts = (adjustment: Pick<Adjustment, "status">) =>
  adjustment.status === "applied" || adjustment.status === "approved";

// what a Completed Job costs: its quoted price with the Adjustments that
// count, never below nothing
export const totalOf = (
  quotedCents: number,
  rows: Pick<Adjustment, "status" | "totalCents">[],
) =>
  Math.max(
    quotedCents + rows.filter(counts).reduce((sum, a) => sum + a.totalCents, 0),
    0,
  );

type Ledger = {
  quotedCents: number;
  adjustmentsCents: number;
  totalCents: number;
  rescheduleFeeCents: number;
  charges: (Charge & {
    refundedCents: number;
    refunds: { amountCents: number; refundedAt: Date }[];
  })[];
  paidCents: number;
  // taken off what it owes by refunds made in the provider's dashboard
  refundedAtProviderCents: number;
  // what Bills not voided have billed for it (ADR-0016), less what was
  // refunded from their Charges for it
  billedCents: number;
  // the Charges of those Bills, which a Refund for it comes from first
  billCharges: Charge[];
  // those Bills, each once, with what each billed for it and what its
  // Charges gave back for it
  bills: { bill: Bill; cents: number; refundedCents: number }[];
  owedCents: number;
};

// the Charges that paid these Bills
const billChargesOf = async (of: Bill[], tx: Tx | typeof db) =>
  of.length === 0
    ? []
    : tx
        .select()
        .from(charges)
        .where(
          inArray(
            charges.billId,
            of.map((b) => b.id),
          ),
        );

// What the Job should have taken against what it has. A Completed Job owes
// its price with the Adjustments that count, plus the fee if a second Late
// Reschedule moved it (ADR-0010); a booked one (or one whose completion was
// undone) owes only its Deposit; a Cancelled or No Access one owes its fee,
// which is 0 unless it was a Late Cancellation or No Access, or a Late
// Reschedule made one due. A one-off Job's fee is its Deposit, kept; a plan
// Job has none, so its fee is charged.
// What a weekly Bill has billed for it counts as taken: the Bill owes it now.
// A refund made in the provider's dashboard is a discount: the Job owes that
// much less, though never less than nothing.
const ledgerOf = async (job: Job, tx: Tx | typeof db): Promise<Ledger> => {
  // one after the other, as a transaction's queries share one connection
  // (ADR-0024)
  const quoted = await quotedJob(job.id, tx);
  const rows = await tx
    .select()
    .from(adjustments)
    .where(eq(adjustments.jobId, job.id));
  const taken = await tx
    .select()
    .from(charges)
    .where(eq(charges.jobId, job.id))
    .orderBy(desc(charges.chargedAt), desc(charges.createdAt));
  const onBills = new Map<
    string,
    { bill: Bill; cents: number; refundedCents: number }
  >();
  for (const { bill, line } of await billLinesOf(job.id, tx))
    onBills.set(bill.id, {
      bill,
      cents: (onBills.get(bill.id)?.cents ?? 0) + line.amountCents,
      refundedCents: 0,
    });
  const billCharges = await billChargesOf(
    [...onBills.values()].map((b) => b.bill),
    tx,
  );
  // given back for it from Bills' Charges, each to the Bill it came from
  const fromBills = await tx
    .select({ cents: refunds.amountCents, chargeId: refunds.chargeId })
    .from(refunds)
    .where(and(eq(refunds.jobId, job.id), isNull(refunds.failedAt)));
  for (const { cents, chargeId } of fromBills) {
    const billId = billCharges.find((c) => c.id === chargeId)?.billId;
    const onBill = billId ? onBills.get(billId) : undefined;
    if (onBill) onBill.refundedCents += cents;
  }
  const billedCents =
    [...onBills.values()].reduce((total, b) => total + b.cents, 0) -
    fromBills.reduce((total, r) => total + r.cents, 0);
  const given =
    taken.length === 0
      ? []
      : await tx
          .select()
          .from(refunds)
          .where(
            and(
              inArray(
                refunds.chargeId,
                taken.map((c) => c.id),
              ),
              isNull(refunds.failedAt),
            ),
          );

  const withRefunds = taken.map((charge) => {
    const back = given.filter((r) => r.chargeId === charge.id);
    return {
      ...charge,
      refundedCents: back.reduce((sum, r) => sum + r.amountCents, 0),
      refunds: back,
    };
  });
  const paidCents = withRefunds.reduce(
    (sum, c) => sum + c.amountCents - c.refundedCents,
    0,
  );
  const refundedAtProviderCents = refundedAtProvider(given);
  const adjustmentsCents = rows
    .filter(counts)
    .reduce((sum, a) => sum + a.totalCents, 0);
  const totalCents = totalOf(quoted.totalCents, rows);
  const depositCents = taken
    .filter((c) => c.kind === "deposit")
    .reduce((sum, c) => sum + c.amountCents, 0);
  const owes =
    job.status === "completed"
      ? totalCents + job.rescheduleFeeCents
      : job.status === "booked"
        ? depositCents
        : (job.feeCents ?? 0);

  return {
    quotedCents: quoted.totalCents,
    adjustmentsCents,
    totalCents,
    rescheduleFeeCents: job.rescheduleFeeCents,
    charges: withRefunds,
    paidCents,
    refundedAtProviderCents,
    billedCents,
    billCharges,
    bills: [...onBills.values()],
    owedCents:
      Math.max(owes - refundedAtProviderCents, 0) - paidCents - billedCents,
  };
};

// whether all a Job's money is in: it owes nothing, isn't Unpaid, and any
// Bill that billed it (billed weekly) is paid. Till then, a plan offer for
// its home waits (WEB-5)
export const paidUp = async (job: Job, tx: Tx | typeof db = db) => {
  if (job.unpaidSince) return false;
  const ledger = await ledgerOf(job, tx);
  return (
    ledger.owedCents <= 0 &&
    ledger.bills.every(({ bill }) => bill.status === "paid")
  );
};

// where a Job's money stands, for the Office and its Client
export const paymentOf = async (job: Job): Promise<JobPayment> => {
  const [ledger, [owner]] = await Promise.all([
    ledgerOf(job, db),
    db
      .select({ method: paymentMethods })
      .from(properties)
      .leftJoin(
        paymentMethods,
        eq(paymentMethods.clientId, properties.clientId),
      )
      .where(eq(properties.id, job.propertyId)),
  ]);
  const onBills = await paymentOn(
    "bill",
    ledger.bills.map(({ bill }) => bill.id),
  );
  return {
    quotedCents: ledger.quotedCents,
    adjustmentsCents: ledger.adjustmentsCents,
    totalCents: ledger.totalCents,
    rescheduleFeeCents: ledger.rescheduleFeeCents,
    charges: [...ledger.charges].reverse().map((c) => ({
      // a Job's own Charges are never a Bill's
      kind: c.kind as ChargeView["kind"],
      amountCents: c.amountCents,
      refundedCents: c.refundedCents,
      chargedAt: c.chargedAt.toISOString(),
      refunds: [...c.refunds]
        .sort((a, b) => a.refundedAt.getTime() - b.refundedAt.getTime())
        .map((r) => ({
          amountCents: r.amountCents,
          refundedAt: r.refundedAt.toISOString(),
        })),
    })),
    paidCents: ledger.paidCents,
    billedCents: ledger.billedCents,
    // each as its own page says where it stands
    bills: ledger.bills.map(({ bill, cents, refundedCents }) => ({
      id: bill.id,
      number: billNumber(bill.number),
      status: bill.status,
      ...standing(bill, onBills(bill.id)),
      totalCents: bill.totalCents,
      cents,
      refundedCents,
    })),
    owedCents: ledger.owedCents,
    // in the reply's language
    paymentMethod: owner?.method
      ? messages[currentLanguage()].card(cardIn(owner.method))
      : null,
    unpaid: unpaidOf(currentLanguage(), job.unpaidSince, job.unpaidReason),
  };
};

// how settling a Job went
export type Settled = {
  chargedCents: number;
  refundedCents: number;
  // why taking what's owed failed: the Job is now Unpaid
  failure: string | null;
  // whether this settling made it Unpaid, when it wasn't before
  becameUnpaid: boolean;
  // the card it was taken from, or would have been
  paymentMethod: Card | null;
  // what it did to the plan of a plan Job: put it On Hold, or resumed it
  plan: "held" | "resumed" | null;
  // its money goes on its Client's weekly Bill instead (ADR-0016), so none
  // moved now
  billed: boolean;
  // the Client paying on its page, whose bank wants them to approve it
  // there: for their browser, then settleJob as "approved" or "refused"
  secret?: string;
  // once their bank's check is done, that it wasn't approved (refused, or
  // left), so nothing was taken: whatever the Job was Unpaid for before
  // stays its failure, but this payment wasn't declined (critical review
  // C10, in critical-review-payment-truth.md)
  notApproved?: boolean;
};

// The Client settling a Job on its page: "paying", there for their bank to
// ask them to approve it; then "approved" or "refused", once their bank's
// check is done, which asks for nothing new. Anyone else (the Clock, Office
// Staff, a change to the Job) charges their saved card without them there
export type ByClient = "paying" | "approved" | "refused";

// what a Charge is for: the Balance of a Completed Job, or the fee for one
// that didn't happen
const kindOf = (job: Job) =>
  job.status === "cancelled" || job.status === "no_access"
    ? ("fee" as const)
    : ("balance" as const);

const describe = async (tx: Tx, job: Job) => {
  const [property] = await tx
    .select()
    .from(properties)
    .where(eq(properties.id, job.propertyId));
  const what =
    job.status === "cancelled" || job.status === "no_access"
      ? feeName[job.status]
      : "Balance";
  return `${what}: ${await serviceNameOf("en", job.serviceId, tx)} at ${addressOf(property!)}, ${formatWhen(job.startsAt)}`;
};

/**
 * Settles a Job's money: works out afresh what it owes (its price with the
 * Adjustments that count, once Completed; its Deposit, if not), against what
 * has been charged less refunds, and charges or refunds the difference
 * (ADR-0009). Completing, approving an increase, correcting a completion and
 * retrying all come here.
 *
 * What an earlier try took, whose reply was lost, is recorded first, so it
 * counts whatever the Job owes now (ADR-0022): it's given back once the Job
 * owes less (#534, F1, F3), and a weekly Bill bills only the rest (F9).
 * While that isn't known yet, nothing moves.
 *
 * A Charge is taken off-session from the Client's saved Payment Method. If
 * it can't be (declined, no card saved, the provider unreachable, their
 * bank wanting them there to approve it), the Job is Unpaid until a later
 * settling takes it. The Client paying on its page (`by`) is there for
 * their bank to ask: the payment it wanted approved is confirmed with them,
 * one waiting on them that they left is called off first, and one they
 * refused leaves the Job as it was, for a fresh payment next time (#534
 * Q7). One still waiting on them is called off by anyone else only once
 * it's waited APPROVAL_MS (mayCallOff). One settling of a Job at a time:
 * the Job is held while its money moves. A plan Job's plan is On Hold while
 * any of its Jobs is Unpaid.
 *
 * A Job whose Client is billed weekly moves no money here: its next Bill
 * bills whatever is owed then (ADR-0016).
 */
export const settleJob = async (
  jobId: string,
  {
    item = null,
    by = null,
  }: {
    // the one change to its price that moved this money, by name, for the
    // Client's Payments page to say
    item?: ChargeItem | null;
    by?: ByClient | null;
  } = {},
): Promise<Settled> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for("update");
    // a refund whose reply was lost first, as what it gave back counts
    // whatever is charged now; while it isn't known, nothing moves
    const given = await recordGivenEarlier(tx, jobId);
    const before = await ledgerOf(job!, tx);
    const [owner] = await tx
      .select({ client: clients, method: paymentMethods })
      .from(properties)
      .innerJoin(clients, eq(clients.id, properties.clientId))
      .leftJoin(paymentMethods, eq(paymentMethods.clientId, clients.id))
      .where(eq(properties.id, job!.propertyId));
    const { client, method } = owner!;
    const billed = isBilledWeekly(job!, client, {
      lines: before.bills.length,
    });
    // what still waits on the Client's bank: why it was Unpaid before, a
    // payment their bank wants them to approve, if not
    const waiting = job!.unpaidReason ?? APPROVE;
    // the Client paying again, or refusing, calls off what waits on them;
    // anyone else, only once it's waited (mayCallOff)
    const callOff =
      by === "approved" ? null : by ? "client_retried" : "abandoned";
    // billed, owing nothing more, or with no card, a try would ask for
    // nothing now
    const earlier = await recordTakenEarlier(
      tx,
      { jobId, kind: kindOf(job!) },
      !billed && !given.unknown && before.owedCents > 0 && method
        ? { amount: before.owedCents, card: method.gatewayRef }
        : null,
      callOff,
    );
    const found = "unknown" in earlier ? [] : earlier;
    const ledger = found.length > 0 ? await ledgerOf(job!, tx) : before;
    // a refund unheard holds the Job's money, and only a charge it held
    // back, which the Client owes, makes the Job Unpaid: one we owe them
    // doesn't (#534 critical review C8)
    const unknown =
      "unknown" in earlier
        ? earlier.unknown === "approving"
          ? waiting
          : earlier.unknown
        : given.unknown && before.owedCents > 0
          ? UNREACHABLE
          : null;
    const settled: Settled = {
      // what a lost reply took or gave back counts now, as it's found
      chargedCents: found.reduce((sum, c) => sum + c.amountCents, 0),
      refundedCents: given.given,
      // it may yet move the money, so nothing more moves meanwhile; billed,
      // nothing moves anyway, and the Clock asks after it (ADR-0022)
      failure: unknown && !billed ? unknown : null,
      becameUnpaid: false,
      paymentMethod: method && cardIn(method),
      plan: null,
      billed,
    };
    const moves = !settled.billed && !settled.failure && !given.unknown;

    // billed weekly, nothing moves: the next Bill takes it, and a Job
    // Unpaid before weekly billing was switched on this week no longer is.
    // What Bills took for it is given back from their Charges first, never
    // from its Deposit (#241). A refund that fails is tried again by the
    // next settling.
    if (moves && ledger.owedCents < 0) {
      const fromBills = await refundFrom(
        tx,
        ledger.billCharges,
        Math.min(-ledger.owedCents, ledger.billedCents),
        { for: jobId, item, jobId },
      );
      settled.refundedCents +=
        fromBills +
        (await refundFrom(tx, ledger.charges, -ledger.owedCents - fromBills, {
          for: jobId,
          item,
        }));
    }

    // once their bank's check is done, nothing new is asked for: one they
    // refused leaves the Job as it was; one their bank declined once it
    // was approved is Unpaid for that
    if (
      moves &&
      ledger.owedCents > 0 &&
      (by === "approved" || by === "refused")
    ) {
      const newest = await newestAttempt(tx, jobId);
      const declined =
        newest?.status === "failed" &&
        newest.reason !== APPROVE &&
        !NOT_APPROVED(newest.reason);
      settled.failure = declined ? (newest.reason ?? waiting) : waiting;
      settled.notApproved = !declined;
    } else if (moves && ledger.owedCents > 0) {
      const charged = await chargeSaved(tx, {
        client,
        source: method,
        amount: ledger.owedCents,
        description: await describe(tx, job!),
        for: { jobId, kind: kindOf(job!) },
        item,
        callOff: by ? "client_retried" : "abandoned",
        withClient: by === "paying",
      });
      if (charged.ok) settled.chargedCents += charged.cents;
      else if ("secret" in charged) {
        settled.secret = charged.secret;
        settled.failure = waiting;
      } else settled.failure = charged.reason;
    }

    if (settled.failure) {
      settled.becameUnpaid = nowTheirs(
        job!.unpaidSince ? (job!.unpaidReason ?? "") : null,
        settled.failure,
      );
      await tx
        .update(jobs)
        .set({
          unpaidSince: job!.unpaidSince ?? clock.now(),
          unpaidReason: settled.failure,
        })
        .where(eq(jobs.id, jobId));
    } else if (job!.unpaidSince) {
      await tx
        .update(jobs)
        .set({ unpaidSince: null, unpaidReason: null })
        .where(eq(jobs.id, jobId));
    }
    settled.plan = await holdOrResume(tx, jobId);
    // a plan held already, as while the payment only waited on the
    // provider, is told now the payment is the Client's to put right
    if (settled.becameUnpaid && !settled.plan && (await planOnHold(tx, jobId)))
      settled.plan = "held";
    return settled;
  });

/**
 * Settles a Job's money once a change to it is saved, as settleJob does,
 * but never throws: the change stands, whatever happens to the money. If
 * settling fails, the error is reported and the Job is Unpaid (its plan On
 * Hold) until a retry settles it, whether it owes money or is owed a
 * Refund. Nothing moved, so nothing is said of money; the Office sees it
 * Unpaid.
 */
export const settleAfterChange = async (
  jobId: string,
  item: ChargeItem | null = null,
): Promise<Settled> => {
  try {
    return await settleJob(jobId, { item });
  } catch (error) {
    monitoring.error(error, { what: `Job ${jobId} not settled` });
    const plan = await db.transaction(async (tx) => {
      await tx
        .update(jobs)
        .set({
          unpaidSince: sql`coalesce(${jobs.unpaidSince}, ${clock.now()})`,
          unpaidReason: NOT_SETTLED,
        })
        .where(eq(jobs.id, jobId));
      return holdOrResume(tx, jobId);
    });
    return {
      chargedCents: 0,
      refundedCents: 0,
      failure: null,
      becameUnpaid: false,
      paymentMethod: null,
      plan,
      billed: false,
    };
  }
};
