import type {
  AssignmentState,
  AssignmentStatus,
  JobStatus,
} from "@empire-cleaning/models";
import { StatusBadge } from "@empire-cleaning/ui";
import {
  assignmentStateLabel,
  assignmentStateTone,
  crewLabel,
  crewTone,
  jobLabelOf,
  jobStatusTone,
  screenWords,
} from "./format.ts";

const { jobStatusLabel } = screenWords.en;

// how a Job's statuses read, the same on every screen

export function JobStatusBadge({ status }: { status: JobStatus }) {
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
  return (
    <StatusBadge tone={assignmentStateTone[state]}>
      {assignmentStateLabel[state]}
    </StatusBadge>
  );
}
