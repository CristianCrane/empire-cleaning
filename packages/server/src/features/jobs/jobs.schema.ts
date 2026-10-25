import { sql } from "drizzle-orm";
import {
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
import { condition, properties } from "../properties/properties.schema.ts";
import { staff } from "../staff/staff.schema.ts";

export const cleanType = pgEnum("clean_type", ["standard", "deep"]);

// booked, then Completed by its assigned Staff; No Access and cancellation
// come with their ticket (#11)
export const jobStatus = pgEnum("job_status", ["booked", "completed"]);

// A single cleaning visit at one Property, booked for a confirmed time. The
// Schedule is every booked or Completed Job. Accepting a Quote (#8) and
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
