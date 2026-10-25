import {
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
  ...timestamps,
});

// a Balance Charge comes with Completed Jobs (#10)
export const chargeKind = pgEnum("charge_kind", ["deposit"]);

// money taken from a Client's Payment Method, for a Job
export const charges = pgTable(
  "charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    kind: chargeKind("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // the Payment Gateway's id for it, for refunds
    gatewayRef: text("gateway_ref").notNull(),
    chargedAt: timestamp("charged_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("charges_job_id_idx").on(t.jobId)],
);

export type PaymentMethodRow = typeof paymentMethods.$inferSelect;
