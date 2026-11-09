import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { AssignmentStatus } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { staff } from "../staff/staff.schema.ts";
import { assignments, onCrew } from "./assignments.schema.ts";

// how many of each Job's crew are Confirmed
const confirmedOn = async (jobIds: string[], tx: Tx | typeof db) => {
  if (jobIds.length === 0) return new Map<string, number>();
  const rows = await tx
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

// each Job's Assignment status: Unassigned until its whole crew is
// Confirmed
export const assignmentStatusOf = async (
  jobs: { id: string; crewSize: number }[],
  tx: Tx | typeof db = db,
) => {
  const confirmed = await confirmedOn(
    jobs.map((j) => j.id),
    tx,
  );
  return new Map(
    jobs.map((job): [string, AssignmentStatus] => [
      job.id,
      (confirmed.get(job.id) ?? 0) >= job.crewSize ? "assigned" : "unassigned",
    ]),
  );
};

// who is on each Job's crew, Offered or Confirmed, earliest Offered first
export const crewOf = async (jobIds: string[], tx: Tx | typeof db = db) => {
  const crews = new Map(
    jobIds.map((id) => [id, [] as { id: string; name: string }[]]),
  );
  if (jobIds.length === 0) return crews;
  const rows = await tx
    .select({ jobId: assignments.jobId, id: staff.id, name: staff.name })
    .from(assignments)
    .innerJoin(staff, eq(staff.id, assignments.staffId))
    .where(and(inArray(assignments.jobId, jobIds), onCrew()))
    .orderBy(asc(assignments.offeredAt), asc(assignments.createdAt));
  for (const { jobId, id, name } of rows) crews.get(jobId)!.push({ id, name });
  return crews;
};

// Refuses a Cleaner acting on a Job as its crew (completing it, recording
// No Access) until their Assignment is Confirmed; to anyone not on its crew,
// the Job doesn't exist
export const mustBeConfirmed = async (staffId: string, jobId: string) => {
  const [mine] = await db
    .select({ status: assignments.status })
    .from(assignments)
    .where(
      and(
        eq(assignments.jobId, jobId),
        eq(assignments.staffId, staffId),
        onCrew(),
      ),
    );
  if (!mine) throw new NotFoundError("Job not found");
  if (mine.status !== "confirmed") {
    throw new ConflictError("Confirm this job first.");
  }
};
