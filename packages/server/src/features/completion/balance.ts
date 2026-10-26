import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import type { JobPayment } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { formatWhen } from "../../services/email/index.ts";
import { paymentGateway } from "../../services/payment-gateway/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { payerFor } from "../payments/payments.ts";
import {
  charges,
  paymentMethods,
  refunds,
  type Charge,
} from "../payments/payments.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { adjustments, type Adjustment } from "./completion.schema.ts";
import { quotedJob } from "./pricing.ts";

const cleanTypeLabel = { deep: "Deep Clean", standard: "Standard Clean" };

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
  owedCents: number;
};

// What the Job should have taken against what it has. A Completed Job owes
// its price with the Adjustments that count, plus the Deposit kept if a
// second Late Reschedule moved it (ADR-0010); a booked one (or one whose
// completion was undone) owes only its Deposit; a Cancelled or No Access one
// owes its fee, which is 0 unless it was a Late Cancellation or No Access,
// or a Late Reschedule kept the Deposit.
const ledgerOf = async (job: Job, tx: Tx | typeof db): Promise<Ledger> => {
  const [quoted, rows, taken] = await Promise.all([
    quotedJob(job.id, tx),
    tx.select().from(adjustments).where(eq(adjustments.jobId, job.id)),
    tx
      .select()
      .from(charges)
      .where(eq(charges.jobId, job.id))
      .orderBy(desc(charges.chargedAt), desc(charges.createdAt)),
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
    owedCents: owes - paidCents,
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
      kind: c.kind,
      amountCents: c.amountCents,
      refundedCents: c.refundedCents,
      chargedAt: c.chargedAt.toISOString(),
    })),
    paidCents: ledger.paidCents,
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
};

const describe = async (job: Job) => {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, job.propertyId));
  return `Balance: ${cleanTypeLabel[job.cleanType]} at ${addressOf(property!)}, ${formatWhen(job.startsAt)}`;
};

// gives back `amount`, from the latest Charges first; stops at the first
// refund that fails, which the next settling tries again
const giveBack = async (
  tx: Tx,
  ledger: Ledger,
  amount: number,
  jobId: string,
) => {
  let left = amount;
  for (const charge of ledger.charges) {
    if (left === 0) break;
    const part = Math.min(left, charge.amountCents - charge.refundedCents);
    if (part === 0) continue;
    const refunded = await paymentGateway
      .refund({
        chargeId: charge.gatewayRef,
        amount: part,
        idempotencyKey: `refund:${charge.id}:${charge.refundedCents}:${part}`,
      })
      .catch((e: unknown) => ({ ok: false, reason: String(e) }) as const);
    if (!refunded.ok) {
      // TODO(#41): the refund_failed signal
      console.error(
        `${part} cents for Job ${jobId} couldn't be refunded from Charge ${charge.id} (${refunded.reason}); settling the Job again retries it`,
      );
      break;
    }
    await tx.insert(refunds).values({
      chargeId: charge.id,
      amountCents: part,
      gatewayRef: refunded.refundId,
      refundedAt: clock.now(),
    });
    left -= part;
  }
  return amount - left;
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
 * time: the Job is held while its money moves.
 */
export const settleJob = async (jobId: string): Promise<Settled> =>
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
    };

    if (ledger.owedCents < 0) {
      settled.refundedCents = await giveBack(
        tx,
        ledger,
        -ledger.owedCents,
        jobId,
      );
    }

    if (ledger.owedCents > 0) {
      if (!method) {
        settled.failure = "no Payment Method is saved";
      } else {
        const result = await paymentGateway
          .charge({
            payerId: await payerFor(client),
            paymentMethodId: method.gatewayRef,
            amount: ledger.owedCents,
            description: await describe(job!),
            idempotencyKey: `balance:${jobId}:${randomUUID()}`,
          })
          .catch((error: unknown) => {
            // TODO(#41): the payment_gateway_error signal
            console.error(`Balance for Job ${jobId} not charged:`, error);
            return {
              ok: false,
              reason: "the payment provider couldn't be reached",
            } as const;
          });
        if (result.ok) {
          await tx.insert(charges).values({
            jobId,
            kind: "balance",
            amountCents: ledger.owedCents,
            gatewayRef: result.chargeId,
            chargedAt: clock.now(),
          });
          settled.chargedCents = ledger.owedCents;
        } else {
          settled.failure = result.reason;
        }
      }
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
    return settled;
  });
