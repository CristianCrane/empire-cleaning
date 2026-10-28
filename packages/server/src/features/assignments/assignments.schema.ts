import { sql } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { staff } from "../staff/staff.schema.ts";

export const assignmentStatus = pgEnum("assignment_status", [
  "offered",
  "confirmed",
  "released",
]);

// A Staff member's place on a Job, made separately from booking: Offered by
// Office Staff to a named Cleaner, or Confirmed at once by a Cleaner taking
// an Open Place (ADR-0019). Offered until they Confirm or Release it; a
// Released one is kept so the Office can see who let a place go, and frees
// that place. Office Staff removing someone deletes their row instead.
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
    ...timestamps,
  },
  (t) => [
    index("assignments_job_id_idx").on(t.jobId),
    index("assignments_staff_id_idx").on(t.staffId),
    // one place per person on a Job, though they may be Offered it again
    // after Releasing it
    uniqueIndex("assignments_one_place_per_staff")
      .on(t.jobId, t.staffId)
      .where(sql`${t.status} <> 'released'`),
  ],
);

export type Assignment = typeof assignments.$inferSelect;

// A Cleaner saying an Open Place on a Job is "Not for me" (ADR-0019): it
// leaves their list, and they're never emailed about it again
export const openPlacePasses = pgTable(
  "open_place_passes",
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

// Which Cleaners have been emailed about a Job's Open Places, so each is
// told once. Cleared when a place on the Job opens again, so it's new to
// them once more.
export const openPlaceEmails = pgTable(
  "open_place_emails",
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

// The day (New York) each Cleaner's morning email of Open Places was last
// considered, sent or not, so it goes at most once a day
export const openPlaceDigests = pgTable("open_place_digests", {
  staffId: uuid("staff_id")
    .primaryKey()
    .references(() => staff.id, { onDelete: "cascade" }),
  day: date("day", { mode: "string" }).notNull(),
});
