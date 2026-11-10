import { sql } from "drizzle-orm";
import { crewStates } from "@empire-cleaning/models";
import {
  type AnyPgColumn,
  date,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/timestamps.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { staff } from "../staff/staff.schema.ts";

export const assignmentStatus = pgEnum("assignment_status", [
  "offered",
  "confirmed",
  "released",
]);

// Assignments that put someone on their Job's crew (crewStates), as SQL.
// Written with no parameters, so the index below is built from it too.
export const onCrew = (status: AnyPgColumn = assignments.status) =>
  sql<boolean>`${status} in (${sql.raw(crewStates.map((s) => `'${s}'`).join(", "))})`;

// A Staff member on a Job's crew, made separately from booking: Offered by
// Office Staff to a named Cleaner, or Confirmed at once by a Cleaner taking
// a Cleaner Needed (ADR-0019). Offered until they Confirm or Release it; a
// Released one is kept so the Office can see who let the Job go, and leaves
// a Cleaner Needed. Office Staff taking someone off Releases it for them, so
// that Cleaner Needed isn't open to them either (#242).
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    status: assignmentStatus("status").notNull().default("offered"),
    // by the Clock
    offeredAt: timestamp("offered_at", { withTimezone: true }).notNull(),
    // when it was Confirmed or Released
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    // when Office Staff took them off, Releasing it
    takenOffAt: timestamp("taken_off_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("assignments_job_id_idx").on(t.jobId),
    index("assignments_staff_id_idx").on(t.staffId),
    // on a Job's crew once per person, though they may be Offered it again
    // after Releasing it
    uniqueIndex("assignments_once_per_crew")
      .on(t.jobId, t.staffId)
      .where(onCrew(t.status)),
  ],
);

export type Assignment = typeof assignments.$inferSelect;

// A Cleaner saying a Cleaner Needed on a Job is "Not for me" (ADR-0019): it
// leaves their list, and they're never emailed about it again
export const cleanerNeededPasses = pgTable(
  "cleaner_needed_passes",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    // by the Clock
    passedAt: timestamp("passed_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.staffId] })],
);

// Which Cleaners have been emailed about a Job's Cleaners Needed, so each
// is told once. Cleared when the Job needs a Cleaner again, so it's new to
// them once more.
export const cleanerNeededEmails = pgTable(
  "cleaner_needed_emails",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    // by the Clock
    emailedAt: timestamp("emailed_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.staffId] })],
);

// The day (New York) each Cleaner's morning email of Cleaners Needed was last
// considered, sent or not, so it goes at most once a day
export const cleanerNeededDigests = pgTable("cleaner_needed_digests", {
  staffId: uuid("staff_id")
    .primaryKey()
    .references(() => staff.id, { onDelete: "cascade" }),
  day: date("day", { mode: "string" }).notNull(),
});
