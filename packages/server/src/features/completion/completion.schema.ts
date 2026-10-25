import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { staff } from "../staff/staff.schema.ts";

// what the assigned Staff can report at completion (ADR-0009)
export const adjustmentKind = pgEnum("adjustment_kind", [
  "add_on_done",
  "add_on_not_done",
  "extra_time",
]);

// A reduction is "applied" at once. An increase is "reported" until Office
// Staff propose it to the Client or dismiss it; once "proposed", the Client
// approves or declines it, or it lapses unanswered after 7 days. Only
// applied and approved ones count towards the Job's price.
export const adjustmentStatus = pgEnum("adjustment_status", [
  "applied",
  "reported",
  "dismissed",
  "proposed",
  "approved",
  "declined",
  "lapsed",
]);

// A change to a Job's quoted price, from what Staff reported at completion,
// priced from the Price List version the Job's Quote used. Amounts are signed
// cents: negative for a reduction.
export const adjustments = pgTable(
  "adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    kind: adjustmentKind("kind").notNull(),
    // the Add-on done or not done, by its Price List key and name then
    addOnKey: uuid("add_on_key"),
    addOnName: text("add_on_name"),
    // the extra Labour Hours
    hours: numeric("hours", { precision: 6, scale: 2, mode: "number" }),
    // the Cleaner's reason
    reason: text("reason").notNull(),
    status: adjustmentStatus("status").notNull(),
    // the price as worked out from the Price List, before tax
    workedOutCents: integer("worked_out_cents").notNull(),
    // the price: the worked-out one, or one Office Staff set, with why
    priceCents: integer("price_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    // tax-exempt Add-ons are untaxed however their price changes
    taxExempt: boolean("tax_exempt").notNull().default(false),
    officeReason: text("office_reason"),
    reportedBy: uuid("reported_by").references(() => staff.id, {
      onDelete: "set null",
    }),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
    // Office Staff proposing or dismissing it, or later correcting it
    reviewedBy: uuid("reviewed_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    proposedAt: timestamp("proposed_at", { withTimezone: true }),
    // the Client's answer, or its lapsing
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    // the one reminder before it lapses
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("adjustments_job_id_idx").on(t.jobId)],
);

export type Adjustment = typeof adjustments.$inferSelect;
