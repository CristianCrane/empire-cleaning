import { and, desc, eq, inArray, isNull, ne, sql, sum } from "drizzle-orm";
import { currentLanguage } from "#services/request";
import {
  type ChargeView,
  type JobPayment,
  formats,
  messages,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { monitoring } from "../../services/monitoring/index.ts";
import { billedOf, isBilledWeekly } from "../bills/billed-weekly.ts";
import { billLines, bills } from "../bills/bills.schema.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import {
  chargeSaved,
  refundedAtProvider,
  refundFrom,
} from "../payments/money.ts";
import {
  charges,
  paymentMethods,
  refunds,
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
  charges: (Charge & { refundedCents: number })[];
  paidCents: number;
  // taken off what it owes by refunds made in the provider's dashboard
  refundedAtProviderCents: number;
  // what Bills not voided have billed for it (ADR-0016), less what was
  // refunded from their Charges for it
  billedCents: number;
  // the Charges of those Bills, which a Refund for it comes from first
  billCharges: Charge[];
  // whether any has
  billedLines: number;
  owedCents: number;
};

// the Charges that paid Bills not voided with lines for a Job
const billChargesOf = async (jobId: string, tx: Tx | typeof db) =>
  (
    await tx
      .selectDistinct({ charge: charges })
      .from(charges)
      .innerJoin(bills, eq(bills.id, charges.billId))
      .innerJoin(billLines, eq(billLines.billId, bills.id))
      .where(and(eq(billLines.jobId, jobId), ne(bills.status, "void")))
  ).map((r) => r.charge);

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
  const billed = await billedOf(job.id, tx);
  const billCharges = await billChargesOf(job.id, tx);
  const [fromBills] = await tx
    .select({ cents: sum(refunds.amountCents).mapWith(Number) })
    .from(refunds)
    .where(and(eq(refunds.jobId, job.id), isNull(refunds.failedAt)));
  const billedCents = billed.cents - (fromBills?.cents ?? 0);
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

  const withRefunds = taken.map((charge) => ({
    ...charge,
    refundedCents: given
      .filter((r) => r.chargeId === charge.id)
      .reduce((sum, r) => sum + r.amountCents, 0),
  }));
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
    billedLines: billed.lines,
    owedCents:
      Math.max(owes - refundedAtProviderCents, 0) - paidCents - billedCents,
  };
};

// where a Job's money stands, for the Office and its Client
export const paymentOf = async (job: Job): Promise<JobPayment> => {
  const [ledger, [owner]] = await Promise.all([
    ledgerOf(job, db),
    db
      .select({ label: paymentMethods.label })
      .from(properties)
      .leftJoin(
        paymentMethods,
        eq(paymentMethods.clientId, properties.clientId),
      )
      .where(eq(properties.id, job.propertyId)),
  ]);
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
    })),
    paidCents: ledger.paidCents,
    billedCents: ledger.billedCents,
    owedCents: ledger.owedCents,
    paymentMethod: owner?.label ?? null,
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
  paymentMethod: string | null;
  // what it did to the plan of a plan Job: put it On Hold, or resumed it
  plan: "held" | "resumed" | null;
  // its money goes on its Client's weekly Bill instead (ADR-0016), so none
  // moved now
  billed: boolean;
};

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
 * A Charge is taken off-session from the Client's saved Payment Method. If
 * it can't be (declined, no card saved, the provider unreachable), the Job
 * is Unpaid until a later settling takes it. One settling of a Job at a
 * time: the Job is held while its money moves. A plan Job's plan is On Hold
 * while any of its Jobs is Unpaid.
 *
 * A Job whose Client is billed weekly moves no money here: its next Bill
 * bills whatever is owed then (ADR-0016).
 */
export const settleJob = async (
  jobId: string,
  // the one change to its price that moved this money, by name, for the
  // Client's Payments page to say
  item: ChargeItem | null = null,
): Promise<Settled> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for("update");
    const ledger = await ledgerOf(job!, tx);
    const [owner] = await tx
      .select({ client: clients, method: paymentMethods })
      .from(properties)
      .innerJoin(clients, eq(clients.id, properties.clientId))
      .leftJoin(paymentMethods, eq(paymentMethods.clientId, clients.id))
      .where(eq(properties.id, job!.propertyId));
    const { client, method } = owner!;
    const settled: Settled = {
      chargedCents: 0,
      refundedCents: 0,
      failure: null,
      becameUnpaid: false,
      paymentMethod: method?.label ?? null,
      plan: null,
      billed: isBilledWeekly(job!, client, {
        lines: ledger.billedLines,
      }),
    };

    // billed weekly, nothing moves: the next Bill takes it, and a Job
    // Unpaid before weekly billing was switched on this week no longer is.
    // What Bills took for it is given back from their Charges first, never
    // from its Deposit (#241). A refund that fails is tried again by the
    // next settling.
    if (!settled.billed && ledger.owedCents < 0) {
      const fromBills = await refundFrom(
        tx,
        ledger.billCharges,
        Math.min(-ledger.owedCents, ledger.billedCents),
        { for: jobId, item, jobId },
      );
      settled.refundedCents =
        fromBills +
        (await refundFrom(tx, ledger.charges, -ledger.owedCents - fromBills, {
          for: jobId,
          item,
        }));
    }

    if (!settled.billed && ledger.owedCents > 0) {
      const charged = await chargeSaved(tx, {
        client,
        method,
        amount: ledger.owedCents,
        description: await describe(tx, job!),
        for: { jobId, kind: kindOf(job!) },
        item,
      });
      if (charged.ok) settled.chargedCents = charged.cents;
      else settled.failure = charged.reason;
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
    return await settleJob(jobId, item);
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
