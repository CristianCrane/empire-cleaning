import { desc, eq, inArray } from "drizzle-orm";
import type { ChargeView, JobPayment } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { formatWhen } from "../../services/email/index.ts";
import { billedOf, isBilledWeekly } from "../bills/billed-weekly.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { chargeSaved, refundFrom } from "../payments/money.ts";
import {
  charges,
  paymentMethods,
  refunds,
  type Charge,
} from "../payments/payments.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { holdOrResume } from "../service-plans/on-hold.ts";
import { adjustments, type Adjustment } from "./completion.schema.ts";
import { quotedJob } from "./pricing.ts";
import { serviceNameOf } from "../services/services.ts";

// the Adjustments that change what the Client pays
export const counts = (adjustment: Pick<Adjustment, "status">) =>
  adjustment.status === "applied" || adjustment.status === "approved";

type Ledger = {
  quotedCents: number;
  adjustmentsCents: number;
  totalCents: number;
  rescheduleFeeCents: number;
  charges: (Charge & { refundedCents: number })[];
  paidCents: number;
  // what Bills not voided have billed for it (ADR-0016)
  billedCents: number;
  // whether any has
  billedLines: number;
  owedCents: number;
};

// What the Job should have taken against what it has. A Completed Job owes
// its price with the Adjustments that count, plus the fee if a second Late
// Reschedule moved it (ADR-0010); a booked one (or one whose completion was
// undone) owes only its Deposit; a Cancelled or No Access one owes its fee,
// which is 0 unless it was a Late Cancellation or No Access, or a Late
// Reschedule made one due. A one-off Job's fee is its Deposit, kept; a plan
// Job has none, so its fee is charged.
// What a weekly Bill has billed for it counts as taken: the Bill owes it now.
const ledgerOf = async (job: Job, tx: Tx | typeof db): Promise<Ledger> => {
  const [quoted, rows, taken, billed] = await Promise.all([
    quotedJob(job.id, tx),
    tx.select().from(adjustments).where(eq(adjustments.jobId, job.id)),
    tx
      .select()
      .from(charges)
      .where(eq(charges.jobId, job.id))
      .orderBy(desc(charges.chargedAt), desc(charges.createdAt)),
    billedOf(job.id, tx),
  ]);
  const given =
    taken.length === 0
      ? []
      : await tx
          .select()
          .from(refunds)
          .where(
            inArray(
              refunds.chargeId,
              taken.map((c) => c.id),
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
  const adjustmentsCents = rows
    .filter(counts)
    .reduce((sum, a) => sum + a.totalCents, 0);
  const totalCents = Math.max(quoted.totalCents + adjustmentsCents, 0);
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
    billedCents: billed.cents,
    billedLines: billed.lines,
    owedCents: owes - paidCents - billed.cents,
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
    unpaid: job.unpaidSince
      ? {
          since: job.unpaidSince.toISOString(),
          reason: job.unpaidReason ?? "",
        }
      : null,
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

const feeLabel = {
  cancelled: "Late Cancellation fee",
  no_access: "No Access fee",
};

const describe = async (job: Job) => {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, job.propertyId));
  const what =
    job.status === "cancelled" || job.status === "no_access"
      ? feeLabel[job.status]
      : "Balance";
  return `${what}: ${await serviceNameOf(job.serviceId)} at ${addressOf(property!)}, ${formatWhen(job.startsAt)}`;
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
  item: string | null = null,
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
    // A refund that fails is tried again by the next settling.
    if (!settled.billed && ledger.owedCents < 0) {
      settled.refundedCents = await refundFrom(
        tx,
        ledger.charges,
        -ledger.owedCents,
        item,
      );
    }

    if (!settled.billed && ledger.owedCents > 0) {
      const charged = await chargeSaved(tx, {
        client,
        method,
        amount: ledger.owedCents,
        description: await describe(job!),
        for: { jobId, kind: kindOf(job!) },
        item,
      });
      if (charged.ok) settled.chargedCents = ledger.owedCents;
      else settled.failure = charged.reason;
    }

    if (settled.failure) {
      settled.becameUnpaid = job!.unpaidSince === null;
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
    return settled;
  });
