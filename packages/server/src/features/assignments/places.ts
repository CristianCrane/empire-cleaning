import { and, count, eq, inArray } from "drizzle-orm";
import type { AssignmentStatus } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { assignments } from "./assignments.schema.ts";

// how many of each Job's places are Confirmed
const confirmedPlaces = async (jobIds: string[]) => {
  if (jobIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ jobId: assignments.jobId, confirmed: count() })
    .from(assignments)
    .where(
      and(
        inArray(assignments.jobId, jobIds),
        eq(assignments.status, "confirmed"),
      ),
    )
    .groupBy(assignments.jobId);
  return new Map(rows.map((r) => [r.jobId, r.confirmed]));
};

// each Job's Assignment status: Unassigned until every place on its crew is
// Confirmed
export const assignmentStatusOf = async (
  jobs: { id: string; crewSize: number }[],
) => {
  const confirmed = await confirmedPlaces(jobs.map((j) => j.id));
  return new Map(
    jobs.map((job): [string, AssignmentStatus] => [
      job.id,
      (confirmed.get(job.id) ?? 0) >= job.crewSize ? "assigned" : "unassigned",
    ]),
  );
};
