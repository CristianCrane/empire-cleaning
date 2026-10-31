import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db, type Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import {
  paymentGateway,
  type ChargeResult,
} from "../../services/payment-gateway/index.ts";
import type { Client } from "../clients/clients.schema.ts";
import { payerFor } from "./payments.ts";
import {
  charges,
  refunds,
  type Charge,
  type PaymentMethodRow,
} from "./payments.schema.ts";

// Money moved off-session, and kept in our ledger of Charges and Refunds.
// The Deposit isn't taken here: it's taken while the Client accepts, and
// recorded once the booking it pays for is made.

// what a Charge is for: a Job's Balance, or the fee for one that didn't
// happen, or a weekly Bill (ADR-0016)
export type ChargeFor =
  { jobId: string; kind: "balance" | "fee" } | { billId: string; kind: "bill" };

/**
 * Charges a Client's saved Payment Method, without them there, and records
 * the Charge. Never throws for money that couldn't be taken: no Payment
 * Method saved, a decline, or the provider unreachable each come back as
 * why, for the caller to make what it charged for Unpaid.
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
): Promise<ChargeResult> => {
  if (!method) return { ok: false, reason: "no Payment Method is saved" };
  const forId = "jobId" in chargeFor ? chargeFor.jobId : chargeFor.billId;
  const result = await paymentGateway
    .charge({
      payerId: await payerFor(client),
      paymentMethodId: method.gatewayRef,
      amount,
      description,
      idempotencyKey: `${chargeFor.kind}:${forId}:${randomUUID()}`,
    })
    .catch((error: unknown) => {
      // TODO(#41): the payment_gateway_error signal
      console.error(`${description} not charged:`, error);
      return {
        ok: false,
        reason: "the payment provider couldn't be reached",
      } as const;
    });
  if (result.ok) {
    await tx.insert(charges).values({
      ...chargeFor,
      item,
      amountCents: amount,
      gatewayRef: result.chargeId,
      chargedAt: clock.now(),
    });
  }
  return result;
};

/**
 * Gives back up to `amount` from these Charges, latest first, each only as
 * far as it hasn't been refunded already, and records each Refund. Stops at
 * the first refund that fails, so trying again later takes up from there.
 * Returns how much it gave back.
 */
export const refundFrom = async (
  tx: Tx | typeof db,
  from: Charge[],
  amount: number,
  // the one change to the price it gives back for, by name, if it is
  item: string | null = null,
): Promise<number> => {
  if (amount <= 0 || from.length === 0) return 0;
  const given = await tx
    .select()
    .from(refunds)
    .where(
      inArray(
        refunds.chargeId,
        from.map((c) => c.id),
      ),
    );
  const latestFirst = [...from].sort(
    (a, b) =>
      b.chargedAt.getTime() - a.chargedAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  let left = amount;
  for (const charge of latestFirst) {
    if (left === 0) break;
    const already = given
      .filter((r) => r.chargeId === charge.id)
      .reduce((sum, r) => sum + r.amountCents, 0);
    const part = Math.min(left, charge.amountCents - already);
    if (part <= 0) continue;
    const refunded = await paymentGateway
      .refund({
        chargeId: charge.gatewayRef,
        amount: part,
        idempotencyKey: `refund:${charge.id}:${already}:${part}`,
      })
      .catch((e: unknown) => ({ ok: false, reason: String(e) }) as const);
    if (!refunded.ok) {
      // TODO(#41): the refund_failed signal
      console.error(
        `${part} cents couldn't be refunded from Charge ${charge.id} (${refunded.reason})`,
      );
      break;
    }
    await tx.insert(refunds).values({
      chargeId: charge.id,
      item,
      amountCents: part,
      gatewayRef: refunded.refundId,
      refundedAt: clock.now(),
    });
    left -= part;
  }
  return amount - left;
};
