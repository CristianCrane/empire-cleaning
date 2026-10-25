import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
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

// A Staff member's place on a Job, Offered by Office Staff separately from
// booking. Offered until they Confirm or Release it; a Released one is kept so
// the Office can see who let a place go, and frees that place. Office Staff
// removing someone deletes their row instead.
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
