import type { AssignmentStatus, JobStatus } from "@empire-cleaning/models";
import { StatusBadge } from "@empire-cleaning/ui";
import { crewLabel, crewTone, jobLabelOf, jobStatusTone } from "./format.ts";
import { useShared } from "./words.ts";

// how a Job's statuses read, the same on every screen

// in the screen's language: the Office's English, the portal's its
// Client's (ADR-0025)
export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { jobStatusLabel } = useShared();
  return (
    <StatusBadge tone={jobStatusTone[status]}>
      {jobStatusLabel[status]}
    </StatusBadge>
  );
}

export function CrewBadge({ assignment }: { assignment: AssignmentStatus }) {
  return (
    <StatusBadge tone={crewTone[assignment]}>
      {crewLabel[assignment]}
    </StatusBadge>
  );
}

// a Job's status on a list's row, plain when it's as it should be (booked
// with a whole crew, done, or called off), so a list whose Tab or Section
// says which it holds badges only the Job that needs cleaners
export const jobStatus = (job: {
  status: JobStatus;
  assignment: AssignmentStatus;
}) => ({
  badge: <JobBadge job={job} />,
  plain: job.status !== "booked" || job.assignment === "assigned",
});

// for Office Staff: how it went, or while it's booked, whether its crew is
// whole
export function JobBadge({
  job,
}: {
  job: { status: JobStatus; assignment: AssignmentStatus };
}) {
  const { label, tone } = jobLabelOf(job);
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
