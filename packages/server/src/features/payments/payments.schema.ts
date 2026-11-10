import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/timestamps.ts";
import { bills } from "../bills/bills.schema.ts";
import { clients } from "../clients/clients.schema.ts";
import type { ReportedChange } from "../completion/completion.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { servicePlans } from "../service-plans/service-plans.schema.ts";

// the one change to a Job's price a payment moved for: approved, its price
// corrected, or taken off
export type ChargeItem = ReportedChange & {
  how: "approved" | "corrected" | "taken_off";
};

// the Client as the payment provider knows them, made the first time they
// pay or save a card; their Payment Methods are kept with it
export const payers = pgTable("payers", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  // the Payment Gateway's id for them, opaque to us
  gatewayRef: text("gateway_ref").notNull().unique(),
  ...timestamps,
});

// A Client's saved means of payment: one each, a new one replacing the last.
// The card itself lives with the payment provider (ADR-0004); we hold only
// its reference and how to describe it.
export const paymentMethods = pgTable("payment_methods", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  // the Payment Gateway's id for it, opaque to us
  gatewayRef: text("gateway_ref").notNull(),
  // e.g. "Visa ending 4242"
  label: text("label").notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull(),
  // when they agreed, saving it, to later Charges without them there: the
  // Balance, and late-cancellation or No Access fees
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

// the Deposit at acceptance, or the Balance once Completed, which may be
// taken in parts: at completion, then as the Client approves increases; or
// the fee for a Late Cancellation or No Access of a plan Job, which has no
// Deposit of its own to keep; or a weekly Bill (ADR-0016)
export const chargeKind = pgEnum("charge_kind", [
  "deposit",
  "balance",
  "fee",
  "bill",
]);

// money taken from a Client's Payment Method, for a Job, or a Service Plan's
// Deposit, which is held for the plan's life and counts towards no Job's
// price until the plan Ends (#15), or a Bill, by card or bank debit
export const charges = pgTable(
  "charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    servicePlanId: uuid("service_plan_id").references(() => servicePlans.id, {
      onDelete: "restrict",
    }),
    billId: uuid("bill_id").references(() => bills.id, {
      onDelete: "restrict",
    }),
    kind: chargeKind("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // the one change to the price it was for ("Inside the fridge", "1 more
    // hour"), when it was taken for one: kept, as the Adjustment may later be
    // taken off, and worded as it's read (#395)
    item: jsonb("item").$type<ChargeItem>(),
    // the Payment Gateway's id for it, for refunds
    gatewayRef: text("gateway_ref").notNull(),
    chargedAt: timestamp("charged_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("charges_job_id_idx").on(t.jobId),
    index("charges_service_plan_id_idx").on(t.servicePlanId),
    index("charges_bill_id_idx").on(t.billId),
    // for exactly one of them
    check(
      "charges_job_or_service_plan_or_bill",
      sql`num_nonnulls(${t.jobId}, ${t.servicePlanId}, ${t.billId}) = 1`,
    ),
  ],
);

// money given back from a Charge: a negative Balance, a correction, an
// undone completion, or one made in the payment provider's dashboard. One
// from a Bill's Charge may be for one of its Jobs, settled on its own once
// weekly billing no longer takes it (#241)
export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chargeId: uuid("charge_id")
      .notNull()
      .references(() => charges.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    // as a Charge's: the one change to the price it gave back for
    item: jsonb("item").$type<ChargeItem>(),
    // the Job a Bill's Charge was refunded for, which it billed: it counts
    // against what Bills took for that Job. Never set on a Job's own
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    // the Bill whose credit it gave back, when no Bill followed (ADR-0016)
    creditBillId: uuid("credit_bill_id").references(() => bills.id, {
      onDelete: "restrict",
    }),
    // the Payment Gateway's id for it; each is recorded once
    gatewayRef: text("gateway_ref").notNull(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }).notNull(),
    // made in the provider's dashboard, not by us: the Client owes that much
    // less, so it's never charged back (refundedAtProvider)
    atProvider: boolean("at_provider").notNull().default(false),
    // when the provider told us it failed after all, as some do once made
    // (#241): the money wasn't given back, so it counts for nothing
    failedAt: timestamp("failed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("refunds_charge_id_idx").on(t.chargeId),
    index("refunds_job_id_idx").on(t.jobId),
    uniqueIndex("refunds_gateway_ref_idx").on(t.gatewayRef),
  ],
);

// how asking the provider for a payment went: pending until its reply
// comes, which it may never; processing while the provider has it on its
// way; taken; failed, as when declined or never made; or given back, as a
// Deposit nothing was booked for
export const chargeAttemptStatus = pgEnum("charge_attempt_status", [
  "pending",
  "processing",
  "taken",
  "failed",
  "given_back",
]);

// Every payment asked of the provider for a Job, a Bill or a Quote's
// Deposit, committed before it's asked, so a retry after a lost reply or a
// rolled-back transaction finds what was taken instead of taking it again
// (#241). One that took money is done once a Charge records it.
export const chargeAttempts = pgTable(
  "charge_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: chargeKind("kind").notNull(),
    // the Job, Bill or Quote it's for, as `kind` says
    forId: uuid("for_id").notNull(),
    // the provider call and what it was asked with, to ask again just so
    request: jsonb("request").notNull(),
    status: chargeAttemptStatus("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    // the Payment Gateway's id for the payment, once known
    gatewayRef: text("gateway_ref"),
    reason: text("reason"),
    // by the Clock: the provider forgets its key a day later
    askedAt: timestamp("asked_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("charge_attempts_for_idx").on(t.kind, t.forId)],
);

// how asking the provider for a refund went: pending until its reply comes,
// which it may never; made; or refused, as when it fails or was never made
export const refundAttemptStatus = pgEnum("refund_attempt_status", [
  "pending",
  "made",
  "refused",
]);

// Every refund we ask of the provider, committed before it's asked, as a
// Charge attempt is (ADR-0022): a retry after a lost reply or a rolled-back
// transaction records what was given back instead of giving it again. One
// that was made is done once a Refund records it. No references: it's written
// outside the transaction that holds the Job or Bill it's for, which a
// reference's check would wait on.
export const refundAttempts = pgTable(
  "refund_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // what it gives back for: a Job, a Bill paid twice, or a Bill's credit
    forId: uuid("for_id").notNull(),
    chargeId: uuid("charge_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // as its Refund will have them
    item: jsonb("item").$type<ChargeItem>(),
    jobId: uuid("job_id"),
    creditBillId: uuid("credit_bill_id"),
    status: refundAttemptStatus("status").notNull().default("pending"),
    // the Payment Gateway's id for the refund, once made
    gatewayRef: text("gateway_ref"),
    reason: text("reason"),
    // by the Clock: the provider forgets its key a day later
    askedAt: timestamp("asked_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("refund_attempts_for_idx").on(t.forId)],
);

export type Charge = typeof charges.$inferSelect;
export type RefundAttempt = typeof refundAttempts.$inferSelect;
export type ChargeAttempt = typeof chargeAttempts.$inferSelect;
export type PaymentMethodRow = typeof paymentMethods.$inferSelect;
