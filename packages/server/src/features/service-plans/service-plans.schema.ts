import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";
import { cleanType, jobs } from "../jobs/jobs.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { quotes, recurrence } from "../quotes/quotes.schema.ts";

// active, generating Jobs; On Hold and Ended are #15's
export const servicePlanStatus = pgEnum("service_plan_status", [
  "active",
  "on_hold",
  "ended",
]);

// A recurring arrangement at one Property, started by accepting a Service
// Plan Quote, which holds its price (ADR-0011). It generates Jobs of its Clean
// Type every week, 2 weeks or 4 weeks from its first Job, on the same weekday
// at the same time. Its Deposit is a Charge of its own, held for its life.
export const servicePlans = pgTable(
  "service_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    // the Quote it was accepted from, which prices its Jobs
    quoteId: uuid("quote_id")
      .notNull()
      .unique()
      .references(() => quotes.id, { onDelete: "restrict" }),
    status: servicePlanStatus("status").notNull().default("active"),
    recurrence: recurrence("recurrence").notNull(),
    cleanType: cleanType("clean_type").notNull(),
    labourHours: numeric("labour_hours", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    crewSize: integer("crew_size").notNull(),
    // its first Job's time, which every later one repeats
    firstStartsAt: timestamp("first_starts_at", {
      withTimezone: true,
    }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    startedBy: uuid("started_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    // one plan at a time per Property, until it Ends
    uniqueIndex("service_plans_one_per_property")
      .on(t.propertyId)
      .where(sql`${t.status} <> 'ended'`),
  ],
);

// Each date a Service Plan's recurrence comes round, once generated: booked
// as a Job, or, when its day had no room, waiting for the Office to book it
// at another time or skip it. One row per date, so generating twice (or on
// two servers) books nothing twice.
export const servicePlanVisits = pgTable(
  "service_plan_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    servicePlanId: uuid("service_plan_id")
      .notNull()
      .references(() => servicePlans.id, { onDelete: "cascade" }),
    // the day the recurrence comes round, New York
    dueOn: date("due_on").notNull(),
    jobId: uuid("job_id")
      .unique()
      .references(() => jobs.id, { onDelete: "restrict" }),
    // by the Clock: when it was generated
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
    // when the Office skipped it, with no Job booked
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("service_plan_visits_one_per_day").on(t.servicePlanId, t.dueOn),
    index("service_plan_visits_unplaced_idx")
      .on(t.generatedAt)
      .where(sql`${t.jobId} is null and ${t.skippedAt} is null`),
  ],
);

export type ServicePlan = typeof servicePlans.$inferSelect;
export type ServicePlanVisit = typeof servicePlanVisits.$inferSelect;
