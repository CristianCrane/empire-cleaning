import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  or,
} from "drizzle-orm";
import type {
  BillPaymentForm,
  BillSummary,
  BillView,
  ClientBillingInput,
  OfficeClientView,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import env from "../../env.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import {
  addDays,
  clock,
  dayOf,
  startOfDay,
  timeOf,
  weekdayOf,
} from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatDay,
  formatMoney,
  formatWhen,
} from "../../services/email/index.ts";
import { paymentGateway } from "../../services/payment-gateway/index.ts";
import { ON_HOLD_LINE } from "../cancellation/cancellation.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { officeClientView } from "../clients/clients.ts";
import { counts, settleJob } from "../completion/balance.ts";
import { adjustments } from "../completion/completion.schema.ts";
import { adjustmentLabel } from "../completion/completion.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { REMINDER_TIME } from "../jobs/reminders.ts";
import { payerFor } from "../payments/payments.ts";
import {
  charges,
  paymentMethods,
  refunds,
} from "../payments/payments.schema.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { jobQuotes } from "../quotes/job-quotes.ts";
import { holdOrResumePlan } from "../service-plans/on-hold.ts";
import {
  servicePlans,
  servicePlanVisits,
} from "../service-plans/service-plans.schema.ts";
import { billedOf, isBilledWeekly, owesOnBill } from "./billed-weekly.ts";
import { billLines, bills, type Bill, type BillLine } from "./bills.schema.ts";

// a credit no Bill follows within this long is refunded (ADR-0016)
export const CREDIT_REFUND_DAYS = 30;
// a Bill paid on its page is first reminded this many days before it's due
export const BILL_REMINDER_DAYS = 3;
// why a Bill paid on its page is Unpaid
export const LATE_REASON = "not paid by its due date";
const DAY_MS = 86_400_000;

const cleanTypeLabel = { deep: "Deep Clean", standard: "Standard Clean" };
const feeLabel = {
  cancelled: "Late Cancellation fee",
  no_access: "No Access fee",
};

// EC-000123
export const billNumber = (number: number) =>
  `EC-${String(number).padStart(6, "0")}`;

// the Monday of the week a day is in
const mondayOf = (day: string) => addDays(day, -weekdayOf(day));

// ---- what a Bill bills ----

// one thing billed for a Job, tax included, by the key its lines carry
type Part = {
  key: string;
  label: string;
  amountCents: number;
  taxCents: number;
};

// tax in part of a Job's price, at the share of tax in the whole
const taxShare = (
  cents: number,
  option: { totalCents: number; taxCents: number },
) =>
  option.totalCents === 0
    ? 0
    : Math.round((cents * option.taxCents) / option.totalCents);

/**
 * Everything a Job should have billed in all, as parts: once Completed, its
 * price, the Adjustments that count and any Late Reschedule fee; once
 * Cancelled or No Access with a fee, that fee. Either way less its Deposit
 * and anything already charged for it on its own, as before weekly billing
 * was switched on. A Job that owes nothing a Bill bills, as when its
 * completion was undone, should have billed nothing.
 */
const partsOf = async (
  job: Job,
  property: Property,
  tx: Tx | typeof db,
): Promise<Part[]> => {
  if (!owesOnBill(job)) return [];
  const [[quoted], rows, taken] = await Promise.all([
    jobQuotes([job.id], tx),
    tx.select().from(adjustments).where(eq(adjustments.jobId, job.id)),
    tx.select().from(charges).where(eq(charges.jobId, job.id)),
  ]);
  if (!quoted)
    throw new ConflictError("This Job has no Quote to price it from");
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
  const net = (kind: "deposit" | "other") =>
    taken
      .filter((c) => (c.kind === "deposit") === (kind === "deposit"))
      .reduce(
        (sum, c) =>
          sum +
          c.amountCents -
          given
            .filter((r) => r.chargeId === c.id)
            .reduce((s, r) => s + r.amountCents, 0),
        0,
      );

  const { option } = quoted;
  const what = `${cleanTypeLabel[job.cleanType]} at ${addressOf(property)}, ${formatWhen(job.startsAt)}`;
  const share = (key: string, label: string, cents: number): Part => ({
    key,
    label,
    amountCents: cents,
    taxCents: taxShare(cents, option),
  });

  const parts: Part[] =
    job.status === "completed"
      ? [
          {
            key: "price",
            label: what,
            amountCents: option.totalCents,
            taxCents: option.taxCents,
          },
          ...rows.filter(counts).map((a) => ({
            key: `adjustment:${a.id}`,
            label: `${adjustmentLabel(a)}: ${what}`,
            amountCents: a.totalCents,
            taxCents: a.taxCents,
          })),
          ...(job.rescheduleFeeCents > 0
            ? [
                share(
                  "reschedule_fee",
                  `Late Reschedule fee: ${what}`,
                  job.rescheduleFeeCents,
                ),
              ]
            : []),
        ]
      : [
          share(
            "fee",
            `${feeLabel[job.status as "cancelled" | "no_access"]}: ${what}`,
            job.feeCents ?? 0,
          ),
        ];
  const deposit = net("deposit");
  if (deposit !== 0)
    parts.push(share("deposit", `Deposit paid: ${what}`, -deposit));
  const paid = net("other");
  if (paid !== 0) parts.push(share("paid", `Already paid: ${what}`, -paid));
  return parts;
};

type NewLine = Omit<
  BillLine,
  "id" | "billId" | "position" | "createdAt" | "updatedAt"
>;

// What a Job's next Bill bills: each part less what Bills not voided have
// billed for it already, so nothing is billed twice; whatever was billed and
// is no longer owed comes off, as a correction. Nothing for a Job never
// billed that nets to nothing, such as a fee its Deposit already covers.
const linesFor = async (
  job: Job,
  property: Property,
  tx: Tx | typeof db,
): Promise<NewLine[]> => {
  const [parts, before] = await Promise.all([
    partsOf(job, property, tx),
    tx
      .select({
        key: billLines.key,
        label: billLines.label,
        amountCents: billLines.amountCents,
        taxCents: billLines.taxCents,
      })
      .from(billLines)
      .innerJoin(bills, eq(bills.id, billLines.billId))
      .where(and(eq(billLines.jobId, job.id), ne(bills.status, "void"))),
  ]);
  const billed = new Map<
    string,
    { label: string; amountCents: number; taxCents: number }
  >();
  for (const line of before) {
    const known = billed.get(line.key);
    billed.set(line.key, {
      label: known?.label ?? line.label,
      amountCents: (known?.amountCents ?? 0) + line.amountCents,
      taxCents: (known?.taxCents ?? 0) + line.taxCents,
    });
  }

  const lines: NewLine[] = [];
  const keys = new Set([...parts.map((p) => p.key), ...billed.keys()]);
  for (const key of keys) {
    const part = parts.find((p) => p.key === key);
    const was = billed.get(key);
    const amountCents = (part?.amountCents ?? 0) - (was?.amountCents ?? 0);
    if (amountCents === 0) continue;
    const label = part?.label ?? was!.label;
    lines.push({
      jobId: job.id,
      key,
      label: was ? `Correction, ${label}` : label,
      amountCents,
      taxCents: (part?.taxCents ?? 0) - (was?.taxCents ?? 0),
    });
  }
  if (
    before.length === 0 &&
    lines.reduce((s, l) => s + l.amountCents, 0) === 0
  ) {
    return [];
  }
  return lines;
};

// the credit a Client has from their latest Bill below zero, that no Bill
// has carried since and that hasn't all been refunded
const openCreditOf = async (clientId: string, tx: Tx | typeof db) => {
  const carriers = tx
    .select({ id: bills.creditFromBillId })
    .from(bills)
    .where(and(isNotNull(bills.creditFromBillId), ne(bills.status, "void")));
  const [credit] = await tx
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.clientId, clientId),
        lt(bills.totalCents, 0),
        ne(bills.status, "void"),
        isNull(bills.creditRefundedAt),
        notInArray(bills.id, carriers),
      ),
    )
    .orderBy(desc(bills.madeAt))
    .limit(1);
  return credit
    ? { bill: credit, cents: -credit.totalCents - credit.creditRefundedCents }
    : null;
};

/**
 * Makes a Client's Bill for the week from `weekStart` (a Monday), unless
 * they have one for it already, even voided: one per week, so making Bills
 * again makes nothing twice. It bills everything owed and not yet billed for
 * their Jobs, at all their Properties, from the week weekly billing was
 * switched on to the end of this one; anything settled since an earlier
 * Bill was made goes on this one. An open credit from an earlier Bill comes
 * off it. With nothing to bill, there's no Bill, and a credit waits.
 */
export const makeBill = async (
  clientId: string,
  weekStart: string,
): Promise<string | null> =>
  db.transaction(async (tx) => {
    // held, so two runs at once make one Bill
    const [client] = await tx
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .for("update");
    if (!client?.billedWeeklyFrom || weekStart < client.billedWeeklyFrom) {
      return null;
    }
    const [made] = await tx
      .select({ id: bills.id })
      .from(bills)
      .where(and(eq(bills.clientId, clientId), eq(bills.weekStart, weekStart)));
    if (made) return null;

    // held while billed, in the order settling a Job holds it
    const candidates = await tx
      .select({ job: jobs, property: properties })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(
        and(
          eq(properties.clientId, clientId),
          gte(jobs.startsAt, startOfDay(client.billedWeeklyFrom)),
          lt(jobs.startsAt, startOfDay(addDays(weekStart, 7))),
        ),
      )
      .orderBy(asc(jobs.startsAt), asc(jobs.id))
      .for("update", { of: jobs });
    const lines: NewLine[] = [];
    for (const { job, property } of candidates) {
      if (!isBilledWeekly(job, client, await billedOf(job.id, tx))) continue;
      lines.push(...(await linesFor(job, property, tx)));
    }
    if (lines.length === 0) return null;

    const credit = await openCreditOf(clientId, tx);
    if (credit && credit.cents > 0) {
      lines.push({
        jobId: null,
        key: "credit",
        label: `Credit from ${billNumber(credit.bill.number)}`,
        amountCents: -credit.cents,
        taxCents: 0,
      });
    }

    const now = clock.now();
    const today = dayOf(now);
    const totalCents = lines.reduce((s, l) => s + l.amountCents, 0);
    const [bill] = await tx
      .insert(bills)
      .values({
        clientId,
        weekStart,
        madeAt: now,
        payment: client.billPayment,
        dueOn:
          client.billPayment === "on_page"
            ? addDays(today, client.billTermsDays)
            : today,
        totalCents,
        taxCents: lines.reduce((s, l) => s + l.taxCents, 0),
        creditFromBillId: credit && credit.cents > 0 ? credit.bill.id : null,
        // nothing to pay, as when it's a credit on the next
        ...(totalCents <= 0 && {
          status: "paid" as const,
          paidAt: now,
          paidVia: "nothing_due" as const,
        }),
      })
      .returning();
    await tx.insert(billLines).values(
      lines.map((line, position) => ({
        ...line,
        billId: bill!.id,
        position,
      })),
    );
    return bill!.id;
  });

// ---- paying ----

// the Service Plans with Jobs on a Bill, On Hold while it's Unpaid
const plansOf = async (billId: string, tx: Tx | typeof db) =>
  (
    await tx
      .selectDistinct({ planId: servicePlanVisits.servicePlanId })
      .from(billLines)
      .innerJoin(
        servicePlanVisits,
        eq(servicePlanVisits.jobId, billLines.jobId),
      )
      .where(eq(billLines.billId, billId))
  ).map((r) => r.planId);

// puts the plans with Jobs on a Bill On Hold, or back on, as it now stands
const holdOrResumePlansOf = async (billId: string, tx: Tx) => {
  let held = false;
  let resumed = false;
  for (const planId of await plansOf(billId, tx)) {
    const changed = await holdOrResumePlan(tx, planId);
    held ||= changed === "held";
    resumed ||= changed === "resumed";
  }
  return held ? "held" : resumed ? "resumed" : null;
};

type Charged = {
  failure: string | null;
  becameUnpaid: boolean;
  plan: "held" | "resumed" | null;
};

/**
 * Charges a due Bill to its Client's saved Payment Method, off-session. If
 * it can't be (declined, no card saved, the provider unreachable), the Bill
 * is Unpaid, and so the Client's Service Plans with Jobs on it are On Hold,
 * until a later try takes it or it's paid another way.
 */
export const chargeBill = async (billId: string): Promise<Charged | null> =>
  db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (bill?.status !== "due" || bill.totalCents <= 0) return null;
    const [owner] = await tx
      .select({ client: clients, method: paymentMethods })
      .from(clients)
      .leftJoin(paymentMethods, eq(paymentMethods.clientId, clients.id))
      .where(eq(clients.id, bill.clientId));
    const { client, method } = owner!;
    const now = clock.now();

    let failure: string | null = null;
    if (!method) {
      failure = "no Payment Method is saved";
    } else {
      const result = await paymentGateway
        .charge({
          payerId: await payerFor(client),
          paymentMethodId: method.gatewayRef,
          amount: bill.totalCents,
          description: `Empire Cleaning bill ${billNumber(bill.number)}`,
          idempotencyKey: `bill:${bill.id}:${randomUUID()}`,
        })
        .catch((error: unknown) => {
          // TODO(#41): the payment_gateway_error signal
          console.error(`Bill ${bill.id} not charged:`, error);
          return {
            ok: false,
            reason: "the payment provider couldn't be reached",
          } as const;
        });
      if (result.ok) {
        await tx.insert(charges).values({
          billId: bill.id,
          kind: "bill",
          amountCents: bill.totalCents,
          gatewayRef: result.chargeId,
          chargedAt: now,
        });
      } else {
        failure = result.reason;
      }
    }

    await tx
      .update(bills)
      .set({
        chargeAttemptedAt: bill.chargeAttemptedAt ?? now,
        ...(failure
          ? { unpaidSince: bill.unpaidSince ?? now, unpaidReason: failure }
          : {
              status: "paid" as const,
              paidAt: now,
              paidVia: "charge" as const,
              unpaidSince: null,
              unpaidReason: null,
            }),
      })
      .where(eq(bills.id, bill.id));
    return {
      failure,
      becameUnpaid: failure !== null && bill.unpaidSince === null,
      plan: await holdOrResumePlansOf(bill.id, tx),
    };
  });

/**
 * Sends a Bill just made to its Client, once: charged first if they're
 * charged automatically, so it goes as their receipt, or as the notice that
 * it couldn't be taken; otherwise to pay on its page by its due date.
 * Making Bills runs this again for any never sent, as after a crash.
 */
export const issueBill = async (billId: string) => {
  const [bill] = await db.select().from(bills).where(eq(bills.id, billId));
  if (!bill || bill.sentAt) return;
  const charged =
    bill.payment === "automatic" && !bill.chargeAttemptedAt
      ? await chargeBill(billId)
      : null;
  // claimed first, so two runs at once send it once
  const [claimed] = await db
    .update(bills)
    .set({ sentAt: clock.now() })
    .where(and(eq(bills.id, billId), isNull(bills.sentAt)))
    .returning();
  if (!claimed) return;
  try {
    await sendBill(
      billId,
      "made",
      charged?.plan === "held" ? [ON_HOLD_LINE] : [],
    );
  } catch (error) {
    console.error(`Bill ${billId} not sent:`, error);
    await db.update(bills).set({ sentAt: null }).where(eq(bills.id, billId));
  }
};

/**
 * Makes each Monday's Bills, for the week before, for every Client billed
 * weekly, and sends them; sends any made but never sent; and refunds credits
 * no Bill has followed within 30 days. Safe to run as often as you like, and
 * on more than one server.
 */
export const makeDueBills = async () => {
  const lastWeek = addDays(mondayOf(dayOf(clock.now())), -7);
  const billed = await db
    .select({ id: clients.id })
    .from(clients)
    .where(lte(clients.billedWeeklyFrom, lastWeek));
  for (const { id } of billed) {
    try {
      await makeBill(id, lastWeek);
    } catch (error) {
      console.error(`Bill for Client ${id} not made:`, error);
    }
  }
  const unsent = await db
    .select({ id: bills.id })
    .from(bills)
    .where(isNull(bills.sentAt))
    .orderBy(asc(bills.madeAt));
  for (const { id } of unsent) await issueBill(id);
  await refundLapsedCredits();
};

// After a Client saves a new Payment Method, tries their Unpaid Bills again
// with it, as their Jobs are; one that still fails stays Unpaid
export const retryUnpaidBillsFor = async (clientId: string) => {
  const unpaid = await db
    .select({ id: bills.id })
    .from(bills)
    .where(
      and(
        eq(bills.clientId, clientId),
        eq(bills.payment, "automatic"),
        eq(bills.status, "due"),
        isNotNull(bills.unpaidSince),
      ),
    );
  for (const { id } of unpaid) {
    const charged = await chargeBill(id);
    if (charged && !charged.failure) await tellPaid(id, charged.plan);
  }
};

// ---- on its page ----

const payable = (bill: Bill) => bill.status === "due" && bill.totalCents > 0;

const clientBill = async (clientId: string, billId: string) => {
  const [bill] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.clientId, clientId)));
  if (!bill) throw new NotFoundError("Bill not found");
  return bill;
};

// the provider's form for the Client to pay a Bill on its page, by card or
// bank debit
export const startBillPayment = async (
  client: Client,
  billId: string,
): Promise<BillPaymentForm> => {
  const bill = await clientBill(client.id, billId);
  if (!payable(bill)) {
    throw new ConflictError(
      bill.status === "processing"
        ? "Your bank payment for this Bill is on its way."
        : "This Bill has nothing to pay.",
    );
  }
  const { ref, secret } = await paymentGateway.startBillPayment({
    payerId: await payerFor(client),
    amount: bill.totalCents,
    description: `Empire Cleaning bill ${billNumber(bill.number)}`,
    reference: bill.id,
    idempotencyKey: `bill-payment:${bill.id}:${randomUUID()}`,
  });
  return { ...paymentGateway.paymentForm(), secret, ref };
};

/**
 * Records how a payment the Client started on a Bill's page went, from
 * their browser or the provider's webhook, whichever says first: paid, or a
 * bank debit processing until it clears (days later), or failed. A second
 * payment that succeeds for a Bill already paid is refunded; one started for
 * another Bill counts for nothing. Returns why it failed, or null.
 */
export const finishBillPayment = async (
  billId: string,
  ref: string,
): Promise<string | null> => {
  const outcome = await paymentGateway.billPaymentOutcome(ref);
  // a payment for another Bill pays nothing here
  if (outcome.status === "succeeded" && outcome.reference !== billId) {
    return "that payment isn't for this Bill";
  }
  const done = await db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (!bill) return null;
    const now = clock.now();

    if (outcome.status === "succeeded") {
      const [known] = await tx
        .select({ id: charges.id })
        .from(charges)
        .where(
          and(
            eq(charges.billId, bill.id),
            eq(charges.gatewayRef, outcome.chargeId),
          ),
        );
      if (known) return null;
      const [charge] = await tx
        .insert(charges)
        .values({
          billId: bill.id,
          kind: "bill",
          amountCents: outcome.amount,
          gatewayRef: outcome.chargeId,
          chargedAt: now,
        })
        .returning();
      if (bill.status === "paid" || bill.status === "void") {
        return { kind: "refund", charge: charge! } as const;
      }
      await tx
        .update(bills)
        .set({
          status: "paid",
          paidAt: now,
          paidVia: "page",
          paymentRef: null,
          unpaidSince: null,
          unpaidReason: null,
        })
        .where(eq(bills.id, bill.id));
      return {
        kind: "paid",
        plan: await holdOrResumePlansOf(bill.id, tx),
      } as const;
    }
    if (outcome.status === "processing" && bill.status === "due") {
      await tx
        .update(bills)
        .set({ status: "processing", paymentRef: ref })
        .where(eq(bills.id, bill.id));
    }
    if (
      outcome.status === "failed" &&
      bill.status === "processing" &&
      bill.paymentRef === ref
    ) {
      await tx
        .update(bills)
        .set({ status: "due", paymentRef: null })
        .where(eq(bills.id, bill.id));
      return { kind: "debit_failed" } as const;
    }
    return null;
  });

  if (done?.kind === "refund") {
    // TODO(#41): the refund_failed signal, if this one fails
    const refunded = await paymentGateway
      .refund({
        chargeId: done.charge.gatewayRef,
        amount: done.charge.amountCents,
        idempotencyKey: `refund:${done.charge.id}:0:${done.charge.amountCents}`,
      })
      .catch((e: unknown) => ({ ok: false, reason: String(e) }) as const);
    if (refunded.ok) {
      await db.insert(refunds).values({
        chargeId: done.charge.id,
        amountCents: done.charge.amountCents,
        gatewayRef: refunded.refundId,
        refundedAt: clock.now(),
      });
    } else {
      console.error(
        `a second payment for Bill ${billId} couldn't be refunded (${refunded.reason})`,
      );
    }
  }
  if (done?.kind === "paid") await tellPaid(billId, done.plan);
  if (done?.kind === "debit_failed") await tellDebitFailed(billId);
  return outcome.status === "failed" ? outcome.reason : null;
};

// ---- the Office ----

/**
 * Office Staff void a Bill that shouldn't have gone out, while it's unpaid:
 * it stays, as voided, and everything on it goes on the next Bill, or is
 * charged per Job if the Client is no longer billed weekly. Its plans come
 * off hold, and a credit it carried is open again.
 */
export const voidBill = async (
  billId: string,
  { byAccountId, reason }: { byAccountId: string; reason: string },
) => {
  const voided = await db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (!bill) throw new NotFoundError("Bill not found");
    if (bill.status !== "due") {
      throw new ConflictError(
        bill.status === "processing"
          ? "A bank payment for this Bill is on its way, so it can't be voided."
          : `This Bill is already ${bill.status === "void" ? "voided" : "paid"}.`,
      );
    }
    await tx
      .update(bills)
      .set({
        status: "void",
        voidedAt: clock.now(),
        voidedBy: byAccountId,
        voidReason: reason,
        unpaidSince: null,
        unpaidReason: null,
      })
      .where(eq(bills.id, billId));
    await holdOrResumePlansOf(billId, tx);
    return bill;
  });

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, voided.clientId));
  if (!client!.billedWeeklyFrom) {
    for (const jobId of await jobsOn(billId)) await settleJob(jobId);
  }
  await notify(`Voided notice for Bill ${billId}`, () =>
    sendBill(billId, "voided"),
  );
  return billView(billId);
};

const jobsOn = async (billId: string) =>
  (
    await db
      .selectDistinct({ jobId: billLines.jobId })
      .from(billLines)
      .where(and(eq(billLines.billId, billId), isNotNull(billLines.jobId)))
  ).map((r) => r.jobId!);

// Office Staff record a payment made another way, such as a cheque or bank
// transfer, with a note; it settles the Bill
export const recordOutsidePayment = async (
  billId: string,
  { byAccountId, note }: { byAccountId: string; note: string },
) => {
  const plan = await db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (!bill) throw new NotFoundError("Bill not found");
    if (bill.status !== "due") {
      throw new ConflictError(
        bill.status === "processing"
          ? "A bank payment for this Bill is on its way."
          : `This Bill is already ${bill.status === "void" ? "voided" : "paid"}.`,
      );
    }
    await tx
      .update(bills)
      .set({
        status: "paid",
        paidAt: clock.now(),
        paidVia: "outside",
        paymentNote: note,
        recordedBy: byAccountId,
        unpaidSince: null,
        unpaidReason: null,
      })
      .where(eq(bills.id, billId));
    return holdOrResumePlansOf(billId, tx);
  });
  await tellPaid(billId, plan);
  return billView(billId);
};

const commercial = async (clientId: string) => {
  const [found] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(eq(properties.clientId, clientId), eq(properties.kind, "commercial")),
    )
    .limit(1);
  return found !== undefined;
};

/**
 * Office Staff set how a Client is billed. Weekly billing is for a
 * commercial Client only, and applies from the current week: their Jobs
 * from its Monday on go on Bills, and any of them Unpaid now waits for the
 * Bill instead. Switched off, Bills already made stay due, and whatever is
 * owed and not yet billed is charged per Job, as before.
 */
export const setBilling = async (
  clientId: string,
  input: ClientBillingInput,
): Promise<OfficeClientView> => {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!client) throw new NotFoundError("Client not found");
  if (
    input.weekly &&
    !client.billedWeeklyFrom &&
    !(await commercial(clientId))
  ) {
    throw new ConflictError(
      "Only a business Client, with business premises, can be billed weekly.",
    );
  }
  const from = input.weekly
    ? (client.billedWeeklyFrom ?? mondayOf(dayOf(clock.now())))
    : null;
  await db
    .update(clients)
    .set({
      billedWeeklyFrom: from,
      billPayment: input.payment,
      billTermsDays: input.termsDays,
      billingEmail: input.billingEmail?.trim().toLowerCase() || null,
    })
    .where(eq(clients.id, clientId));

  const was = client.billedWeeklyFrom;
  if (from !== was) {
    // switched on, its Unpaid Jobs this week wait for the Bill; switched
    // off, everything owed since is charged or refunded per Job
    const since = from ?? was!;
    const affected = await db
      .select({ id: jobs.id })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(
        and(
          eq(properties.clientId, clientId),
          gte(jobs.startsAt, startOfDay(since)),
          from ? isNotNull(jobs.unpaidSince) : undefined,
          from
            ? undefined
            : inArray(jobs.status, ["completed", "cancelled", "no_access"]),
        ),
      )
      .orderBy(asc(jobs.startsAt));
    for (const { id } of affected) await settleJob(id);
  }
  return (await officeClientView(clientId))!;
};

// ---- the Clock: credits ----

/**
 * Refunds each credit no Bill has followed within 30 days, from the
 * Client's latest Charges first. A refund that fails is tried again on the
 * next run.
 */
export const refundLapsedCredits = async () => {
  const cutoff = new Date(clock.now().getTime() - CREDIT_REFUND_DAYS * DAY_MS);
  const lapsed = await db
    .selectDistinct({ clientId: bills.clientId })
    .from(bills)
    .where(
      and(
        lt(bills.totalCents, 0),
        ne(bills.status, "void"),
        isNull(bills.creditRefundedAt),
        lte(bills.madeAt, cutoff),
      ),
    );
  for (const { clientId } of lapsed) {
    const refunded = await refundCredit(clientId, cutoff);
    if (refunded) {
      await notify(`Credit refund notice for Bill ${refunded.billId}`, () =>
        tellCreditRefunded(refunded.billId, refunded.cents),
      );
    }
  }
};

const refundCredit = async (clientId: string, cutoff: Date) =>
  db.transaction(async (tx) => {
    // held, so making a Bill can't carry the credit while it's refunded
    await tx
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .for("update");
    const credit = await openCreditOf(clientId, tx);
    if (!credit || credit.bill.madeAt > cutoff) return null;

    // the Client's Charges, for Bills and Jobs, latest first; a plan's held
    // Deposit isn't theirs to take back while the plan runs
    const theirs = await tx
      .select({ charge: charges })
      .from(charges)
      .leftJoin(bills, eq(bills.id, charges.billId))
      .leftJoin(jobs, eq(jobs.id, charges.jobId))
      .leftJoin(properties, eq(properties.id, jobs.propertyId))
      .where(
        or(eq(bills.clientId, clientId), eq(properties.clientId, clientId)),
      )
      .orderBy(desc(charges.chargedAt), desc(charges.createdAt));
    const given =
      theirs.length === 0
        ? []
        : await tx
            .select()
            .from(refunds)
            .where(
              inArray(
                refunds.chargeId,
                theirs.map((t) => t.charge.id),
              ),
            );

    let left = credit.cents;
    for (const { charge } of theirs) {
      if (left === 0) break;
      const already = given
        .filter((r) => r.chargeId === charge.id)
        .reduce((s, r) => s + r.amountCents, 0);
      const part = Math.min(left, charge.amountCents - already);
      if (part <= 0) continue;
      const refunded = await paymentGateway
        .refund({
          chargeId: charge.gatewayRef,
          amount: part,
          idempotencyKey: `credit:${credit.bill.id}:${charge.id}:${already}:${part}`,
        })
        .catch((e: unknown) => ({ ok: false, reason: String(e) }) as const);
      if (!refunded.ok) {
        // TODO(#41): the refund_failed signal
        console.error(
          `${part} cents of Bill ${credit.bill.id}'s credit couldn't be refunded from Charge ${charge.id} (${refunded.reason}); the next run tries again`,
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
    const cents = credit.cents - left;
    if (cents === 0) return null;
    await tx
      .update(bills)
      .set({
        creditRefundedCents: credit.bill.creditRefundedCents + cents,
        ...(left === 0 && { creditRefundedAt: clock.now() }),
      })
      .where(eq(bills.id, credit.bill.id));
    return { billId: credit.bill.id, cents };
  });

// ---- the Clock: reminders and late Bills ----

// The day of the latest reminder a Bill paid on its page is owed by `today`:
// 3 days before it's due, on the day, then each week after while it's
// unpaid; null before the first.
export const reminderDayOf = (dueOn: string, today: string) => {
  if (today < addDays(dueOn, -BILL_REMINDER_DAYS)) return null;
  if (today < dueOn) return addDays(dueOn, -BILL_REMINDER_DAYS);
  let day = dueOn;
  while (addDays(day, 7) <= today) day = addDays(day, 7);
  return day;
};

// a Bill paid on its page with something still to pay, and no bank debit
// paying it on its way
const onPageToPay = () =>
  and(
    eq(bills.payment, "on_page"),
    eq(bills.status, "due"),
    gt(bills.totalCents, 0),
  );

/**
 * Makes each Bill paid on its page and not paid by its due date Unpaid,
 * from the day after, so the Client's Service Plans with Jobs on it are On
 * Hold until it's paid; then sends the reminders such Bills are owed. Safe
 * to run as often as you like, and on more than one server.
 *
 * Nothing calls this but the timer in src/index.ts (and tests).
 */
export const chaseBills = async () => {
  const late = await db
    .select({ id: bills.id })
    .from(bills)
    .where(
      and(
        onPageToPay(),
        isNull(bills.unpaidSince),
        lt(bills.dueOn, dayOf(clock.now())),
      ),
    );
  for (const { id } of late) {
    try {
      await markLate(id);
    } catch (error) {
      console.error(`Bill ${id} not made Unpaid:`, error);
    }
  }
  return sendBillReminders();
};

const markLate = (billId: string) =>
  db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (bill?.status !== "due" || bill.unpaidSince) return;
    await tx
      .update(bills)
      .set({
        unpaidSince: startOfDay(addDays(bill.dueOn, 1)),
        unpaidReason: LATE_REASON,
      })
      .where(eq(bills.id, billId));
    await holdOrResumePlansOf(billId, tx);
  });

/**
 * From 8am (New York), emails each reminder a Bill paid on its page is owed
 * (see reminderDayOf), once, while it's still to pay: none for a day on or
 * before the one the Bill itself went out, and after a gap only the latest.
 * Each is claimed before its email goes, and let go again if the email
 * fails, so the next run tries again.
 */
const sendBillReminders = async () => {
  const now = clock.now();
  if (timeOf(now) < REMINDER_TIME) return 0;
  const today = dayOf(now);
  const owed = await db
    .select()
    .from(bills)
    .where(
      and(
        onPageToPay(),
        isNotNull(bills.sentAt),
        lte(bills.dueOn, addDays(today, BILL_REMINDER_DAYS)),
      ),
    )
    .orderBy(asc(bills.dueOn));

  let sent = 0;
  for (const bill of owed) {
    const day = reminderDayOf(bill.dueOn, today)!;
    if (day <= dayOf(bill.sentAt!)) continue;
    if (bill.remindedOn && bill.remindedOn >= day) continue;
    const [claimed] = await db
      .update(bills)
      .set({ remindedOn: day })
      .where(
        and(
          eq(bills.id, bill.id),
          onPageToPay(),
          or(isNull(bills.remindedOn), lt(bills.remindedOn, day)),
        ),
      )
      .returning();
    if (!claimed) continue;

    try {
      const plans = await hasLivePlansOn(bill.id);
      await sendBill(
        bill.id,
        "reminder",
        !plans
          ? []
          : claimed.unpaidSince
            ? [ON_HOLD_LINE]
            : [
                "If it isn't paid by then, your Service Plan goes On Hold until it is: cleans already booked go ahead, but we won't book any more.",
              ],
      );
      sent += 1;
    } catch (error) {
      console.error(`reminder for Bill ${bill.id} not sent:`, error);
      await db
        .update(bills)
        .set({ remindedOn: bill.remindedOn })
        .where(and(eq(bills.id, bill.id), eq(bills.remindedOn, day)));
    }
  }
  return sent;
};

// whether a Bill has Jobs on it from Service Plans that haven't Ended
const hasLivePlansOn = async (billId: string) => {
  const [found] = await db
    .select({ id: servicePlans.id })
    .from(billLines)
    .innerJoin(servicePlanVisits, eq(servicePlanVisits.jobId, billLines.jobId))
    .innerJoin(
      servicePlans,
      eq(servicePlans.id, servicePlanVisits.servicePlanId),
    )
    .where(and(eq(billLines.billId, billId), ne(servicePlans.status, "ended")))
    .limit(1);
  return found !== undefined;
};

// ---- views ----

const toSummary = (
  bill: Bill,
  client: Pick<Client, "id" | "name" | "businessName">,
): BillSummary => ({
  id: bill.id,
  number: billNumber(bill.number),
  client: {
    id: client.id,
    name: client.name,
    businessName: client.businessName,
  },
  weekStart: bill.weekStart,
  weekEnd: addDays(bill.weekStart, 6),
  madeAt: bill.madeAt.toISOString(),
  payment: bill.payment,
  dueOn: bill.dueOn,
  status: bill.status,
  totalCents: bill.totalCents,
  taxCents: bill.taxCents,
  unpaid: bill.unpaidSince
    ? { since: bill.unpaidSince.toISOString(), reason: bill.unpaidReason ?? "" }
    : null,
  paidAt: bill.paidAt?.toISOString() ?? null,
  paidVia: bill.paidVia,
});

const linesOf = (billId: string) =>
  db
    .select()
    .from(billLines)
    .where(eq(billLines.billId, billId))
    .orderBy(asc(billLines.position));

// a Bill with its lines; the Office's own, or one of the Client's
export const billView = async (
  billId: string,
  clientId?: string,
): Promise<BillView> => {
  const [found] = await db
    .select({ bill: bills, client: clients })
    .from(bills)
    .innerJoin(clients, eq(clients.id, bills.clientId))
    .where(
      and(
        eq(bills.id, billId),
        clientId ? eq(bills.clientId, clientId) : undefined,
      ),
    );
  if (!found) throw new NotFoundError("Bill not found");
  const { bill, client } = found;
  return {
    ...toSummary(bill, client),
    lines: (await linesOf(billId)).map((l) => ({
      jobId: l.jobId,
      label: l.label,
      amountCents: l.amountCents,
      taxCents: l.taxCents,
    })),
    paymentNote: bill.paymentNote,
    voidedAt: bill.voidedAt?.toISOString() ?? null,
    voidReason: bill.voidReason,
    payable: payable(bill),
  };
};

// Bills newest first: a Client's, or only Unpaid ones, or every one
export const listBills = async ({
  clientId,
  unpaid,
}: {
  clientId?: string;
  unpaid?: boolean;
}): Promise<BillSummary[]> => {
  const rows = await db
    .select({ bill: bills, client: clients })
    .from(bills)
    .innerJoin(clients, eq(clients.id, bills.clientId))
    .where(
      and(
        clientId ? eq(bills.clientId, clientId) : undefined,
        unpaid ? isNotNull(bills.unpaidSince) : undefined,
      ),
    )
    .orderBy(desc(bills.weekStart), desc(bills.number));
  return rows.map(({ bill, client }) => toSummary(bill, client));
};

// ---- emails ----

// emails go out after the change is saved; one that fails is logged, and the
// change stands
const notify = async (what: string, send: () => Promise<void>) => {
  try {
    await send();
  } catch (error) {
    console.error(`${what} not sent:`, error);
  }
};

type Occasion = "made" | "reminder" | "paid" | "voided" | "debit_failed";

// The whole Bill, as an email to the billing email, or else the Client's:
// its number, week, due date, each line, tax and total, with why it's sent
// and a link to it in the portal
const sendBill = async (
  billId: string,
  occasion: Occasion,
  extra: string[] = [],
) => {
  const [found] = await db
    .select({ bill: bills, client: clients, method: paymentMethods })
    .from(bills)
    .innerJoin(clients, eq(clients.id, bills.clientId))
    .leftJoin(paymentMethods, eq(paymentMethods.clientId, clients.id))
    .where(eq(bills.id, billId));
  const { bill, client, method } = found!;
  const number = billNumber(bill.number);
  const card = method?.label ?? "card";
  const total = formatMoney(bill.totalCents);

  const [subject, ...about] = ((): string[] => {
    switch (occasion) {
      case "made":
        if (bill.unpaidSince) {
          return [
            `We couldn't take payment for bill ${number}`,
            `We couldn't charge ${total} for bill ${number} to your ${card}. Please update your Payment Method and we'll try again straight away, or pay it on its page.`,
          ];
        }
        if (bill.totalCents < 0) {
          return [
            `Your bill ${number}: a credit`,
            `This week's bill comes to a credit of ${formatMoney(-bill.totalCents)}, which comes off your next one. If none follows within ${CREDIT_REFUND_DAYS} days, we'll refund it.`,
          ];
        }
        if (bill.totalCents === 0) {
          return [`Your bill ${number}`, "There's nothing to pay this week."];
        }
        return bill.status === "paid"
          ? [
              `Your receipt for bill ${number}`,
              `Here's your bill for the week. We've charged ${total} to your ${card}.`,
            ]
          : [
              `Your bill ${number} from Empire Cleaning`,
              `Here's your bill for the week: ${total}, due by ${formatDay(bill.dueOn)}. You can pay it by card or bank transfer on its page.`,
            ];
      case "reminder": {
        const today = dayOf(clock.now());
        if (today < bill.dueOn) {
          return [
            `Bill ${number} is due ${formatDay(bill.dueOn)}`,
            `A reminder that bill ${number}, ${total}, is due by ${formatDay(bill.dueOn)}. You can pay it by card or bank transfer on its page.`,
          ];
        }
        if (today === bill.dueOn) {
          return [
            `Bill ${number} is due today`,
            `A reminder that bill ${number}, ${total}, is due today. You can pay it by card or bank transfer on its page.`,
          ];
        }
        return [
          `Bill ${number} is overdue`,
          `Bill ${number}, ${total}, was due by ${formatDay(bill.dueOn)} and hasn't been paid yet. Please pay it on its page, by card or bank transfer.`,
        ];
      }
      case "paid":
        return [
          `Your receipt for bill ${number}`,
          bill.paidVia === "outside"
            ? `We've received your payment of ${total} for bill ${number}. Thank you.`
            : `Thank you: bill ${number} is paid, ${total}.`,
        ];
      case "voided":
        return [
          `Bill ${number} is cancelled`,
          `We've voided bill ${number}, so there's nothing to pay on it.${bill.voidReason ? ` ${bill.voidReason}` : ""}`,
          client.billedWeeklyFrom
            ? "Anything on it that's still owed will be on your next bill."
            : "Anything on it that's still owed is charged to your card per clean, as before.",
        ];
      case "debit_failed":
        return [
          `Your bank payment for bill ${number} didn't go through`,
          `Your bank payment of ${total} for bill ${number} didn't go through. Please pay it again on its page, by card or from another account.`,
        ];
    }
  })();

  const lines = await linesOf(billId);
  await email.send({
    to: client.billingEmail ?? client.email,
    subject: subject!,
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        ...about,
        ...extra,
        [
          `Bill ${number}`,
          `Week: ${formatDay(bill.weekStart)} to ${formatDay(addDays(bill.weekStart, 6))}`,
          ...(bill.payment === "on_page" && bill.totalCents > 0
            ? [`Due by: ${formatDay(bill.dueOn)}`]
            : []),
        ].join("\n"),
        lines
          .map((l) => `${l.label}: ${formatMoney(l.amountCents)}`)
          .join("\n"),
        [`Tax included: ${formatMoney(bill.taxCents)}`, `Total: ${total}`].join(
          "\n",
        ),
        "Prices include tax.",
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/bills/${billId}`,
        label: "See your bill",
      },
    ),
  });
};

const tellPaid = (billId: string, plan: "held" | "resumed" | null) =>
  notify(`Receipt for Bill ${billId}`, () =>
    sendBill(
      billId,
      "paid",
      plan === "resumed"
        ? ["Your Service Plan is back on, and we'll book your cleans as usual."]
        : [],
    ),
  );

const tellDebitFailed = (billId: string) =>
  notify(`Failed bank payment notice for Bill ${billId}`, () =>
    sendBill(billId, "debit_failed"),
  );

const tellCreditRefunded = async (billId: string, cents: number) => {
  const [found] = await db
    .select({ bill: bills, client: clients })
    .from(bills)
    .innerJoin(clients, eq(clients.id, bills.clientId))
    .where(eq(bills.id, billId));
  const { bill, client } = found!;
  await email.send({
    to: client.billingEmail ?? client.email,
    subject: `We've refunded your credit from bill ${billNumber(bill.number)}`,
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        `No bill has followed bill ${billNumber(bill.number)} in ${CREDIT_REFUND_DAYS} days, so we've refunded its ${formatMoney(cents)} credit to you. It can take a few days to reach you.`,
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/bills/${billId}`,
        label: "See the bill",
      },
    ),
  });
};
