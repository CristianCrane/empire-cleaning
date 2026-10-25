import { sql } from "drizzle-orm";
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
import { condition, properties } from "../properties/properties.schema.ts";
import { staff } from "../staff/staff.schema.ts";

export const cleanType = pgEnum("clean_type", ["standard", "deep"]);

// booked, then Completed by its assigned Staff, Cancelled, or No Access when
// they couldn't get in
export const jobStatus = pgEnum("job_status", [
  "booked",
  "completed",
  "cancelled",
  "no_access",
]);

// who a cancellation is down to: the Client (themselves, or Office Staff on
// their behalf), or Empire Cleaning
export const cancelledBy = pgEnum("cancelled_by", ["client", "empire"]);

// A single cleaning visit at one Property, booked for a confirmed time. The
// Schedule is every booked, Completed or No Access Job; a Cancelled one has
// left it. Accepting a Quote (#8) and
// Service Plans (#14) create them; an Accepted Quote points at the Job it
// booked.
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    cleanType: cleanType("clean_type").notNull(),
    status: jobStatus("status").notNull().default("booked"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    labourHours: numeric("labour_hours", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    crewSize: integer("crew_size").notNull(),
    // by the Clock (created_at is the database's own time)
    bookedAt: timestamp("booked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // when the day-before reminder went to the Client
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    // once Completed: when, by whom, and the Condition they reported, with
    // the Property's Condition before it, so undoing the completion can put
    // it back
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => staff.id, {
      onDelete: "set null",
    }),
    reportedCondition: condition("reported_condition"),
    conditionBefore: condition("condition_before"),
    // Unpaid: since the first Charge for it failed, and why the latest did;
    // cleared once what's owed is taken
    unpaidSince: timestamp("unpaid_since", { withTimezone: true }),
    unpaidReason: text("unpaid_reason"),
    // once Cancelled: when, who it's down to and who did it, whether it was
    // a Late Cancellation, and why, if Empire Cleaning said
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: cancelledBy("cancelled_by"),
    cancelledByAccount: uuid("cancelled_by_account").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    lateCancellation: boolean("late_cancellation"),
    cancellationReason: text("cancellation_reason"),
    // once No Access: when, by whom, and what happened
    noAccessAt: timestamp("no_access_at", { withTimezone: true }),
    noAccessBy: uuid("no_access_by").references(() => staff.id, {
      onDelete: "set null",
    }),
    noAccessReason: text("no_access_reason"),
    // what a Cancelled or No Access Job owes, tax included: the Late
    // Cancellation fee, or 0
    feeCents: integer("fee_cents"),
    ...timestamps,
  },
  (t) => [
    index("jobs_starts_at_idx").on(t.startsAt),
    index("jobs_unpaid_idx")
      .on(t.unpaidSince)
      .where(sql`${t.unpaidSince} is not null`),
  ],
);

export type Job = typeof jobs.$inferSelect;
