import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import type { AssignmentStatus } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { staff } from "../staff/staff.schema.ts";
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

// who holds each Job's places, Offered or Confirmed, earliest Offered first
export const crewOf = async (jobIds: string[]) => {
  const crews = new Map(
    jobIds.map((id) => [id, [] as { id: string; name: string }[]]),
  );
  if (jobIds.length === 0) return crews;
  const rows = await db
    .select({ jobId: assignments.jobId, id: staff.id, name: staff.name })
    .from(assignments)
    .innerJoin(staff, eq(staff.id, assignments.staffId))
    .where(
      and(
        inArray(assignments.jobId, jobIds),
        ne(assignments.status, "released"),
      ),
    )
    .orderBy(asc(assignments.offeredAt), asc(assignments.createdAt));
  for (const { jobId, id, name } of rows) crews.get(jobId)!.push({ id, name });
  return crews;
};
