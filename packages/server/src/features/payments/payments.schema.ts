import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { servicePlans } from "../service-plans/service-plans.schema.ts";

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
// Deposit of its own to keep
export const chargeKind = pgEnum("charge_kind", ["deposit", "balance", "fee"]);

// money taken from a Client's Payment Method, for a Job, or a Service Plan's
// Deposit, which is held for the plan's life and counts towards no Job's
// price until the plan Ends (#15)
export const charges = pgTable(
  "charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    servicePlanId: uuid("service_plan_id").references(() => servicePlans.id, {
      onDelete: "restrict",
    }),
    kind: chargeKind("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // the Payment Gateway's id for it, for refunds
    gatewayRef: text("gateway_ref").notNull(),
    chargedAt: timestamp("charged_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("charges_job_id_idx").on(t.jobId),
    index("charges_service_plan_id_idx").on(t.servicePlanId),
    check(
      "charges_job_or_service_plan",
      sql`(${t.jobId} is null) <> (${t.servicePlanId} is null)`,
    ),
  ],
);

// money given back from a Charge: a negative Balance, a correction, or an
// undone completion
export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chargeId: uuid("charge_id")
      .notNull()
      .references(() => charges.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    // the Payment Gateway's id for it
    gatewayRef: text("gateway_ref").notNull(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("refunds_charge_id_idx").on(t.chargeId)],
);

export type Charge = typeof charges.$inferSelect;
export type PaymentMethodRow = typeof paymentMethods.$inferSelect;
