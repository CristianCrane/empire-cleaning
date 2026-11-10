import type {
  AssignmentState,
  AssignmentStatus,
  JobStatus,
} from "@empire-cleaning/models";
import { StatusBadge } from "@empire-cleaning/ui";
import {
  assignmentStateTone,
  crewLabel,
  crewTone,
  jobLabelOf,
  jobStatusTone,
} from "./format.ts";
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

// where someone stands on a Job's crew
export function AssignmentStateBadge({ state }: { state: AssignmentState }) {
  const { assignmentStateLabel } = useShared();
  return (
    <StatusBadge tone={assignmentStateTone[state]}>
      {assignmentStateLabel[state]}
    </StatusBadge>
  );
}
