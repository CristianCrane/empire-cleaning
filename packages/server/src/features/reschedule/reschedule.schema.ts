import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";

export const rescheduleStatus = pgEnum("reschedule_status", [
  "pending",
  "confirmed",
  "turned_down",
  "withdrawn",
]);

// what moving costs, judged when it's asked (ADR-0010)
export const rescheduleCost = pgEnum("reschedule_cost", [
  "free",
  "free_late",
  "late_cancellation",
]);

// A Client's proposal to move a booked Job to a new time, made in the portal
// or by Office Staff for them. While pending, the new time's Labour Hours are
// held on its day; the Job keeps its time until Office Staff confirm it.
export const rescheduleRequests = pgTable(
  "reschedule_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: rescheduleStatus("status").notNull().default("pending"),
    // the Job's time when it was asked, and the time asked for
    fromStartsAt: timestamp("from_starts_at", { withTimezone: true }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    cost: rescheduleCost("cost").notNull(),
    // the Deposit kept if it's a Late Cancellation, tax included; 0 otherwise
    feeCents: integer("fee_cents").notNull(),
    // by the Clock
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    requestedBy: uuid("requested_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    // the Client themselves, in the portal, rather than Office Staff
    byClient: boolean("by_client").notNull(),
    // when it was confirmed, turned down or withdrawn, and by whom
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    answeredBy: uuid("answered_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    // why Office Staff turned it down, told to the Client
    reason: text("reason"),
    ...timestamps,
  },
  (t) => [
    index("reschedule_requests_job_id_idx").on(t.jobId),
    index("reschedule_requests_starts_at_idx")
      .on(t.startsAt)
      .where(sql`${t.status} = 'pending'`),
    // one request waiting per Job
    uniqueIndex("reschedule_requests_one_pending_per_job")
      .on(t.jobId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export type RescheduleRequest = typeof rescheduleRequests.$inferSelect;
