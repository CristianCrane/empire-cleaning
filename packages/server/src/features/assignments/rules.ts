import {
  isOnCrew,
  type AssignmentState,
  type ScheduleDay,
  type ScheduledJob,
  type StaffRole,
} from "@empire-cleaning/models";
import { DAY_MS, HOUR_MS } from "../../services/clock/index.ts";
import { formatWhen } from "../../services/email/index.ts";
import { asClean, isFree } from "../jobs/rules.ts";

// The rules for a Job's crew (ADR-0019), over what the actions load: the
// Job's day of the Schedule, and its Assignments. Each says why something is
// refused, or null when it isn't. They never query: the actions lock and
// load, ask, then write.

// A Job's Cleaners Needed are open to free Cleaners from this many days before
// it starts: who is free is only reliable nearer the day
export const CLEANER_NEEDED_DAYS = 7;

// a Confirmed Assignment can't be Released this close to the Job: the Office needs
// time to find someone else
const RELEASE_CUTOFF_HOURS = 48;

// a Job as its row has it
type Job = { id: string; status: string; startsAt: Date; crewSize: number };

// when a Job starts, from its row or its day of the Schedule (an ISO string)
type When = { startsAt: Date | string };

// an Assignment on a Job, Released ones too
type Assigned = { staffId: string; status: AssignmentState };

// when a Job's Cleaners Needed open to free Cleaners
export const opensAt = (job: When) =>
  new Date(new Date(job.startsAt).getTime() - CLEANER_NEEDED_DAYS * DAY_MS);

export const releaseClosed = (job: Pick<Job, "startsAt">, now: Date) =>
  job.startsAt.getTime() - now.getTime() < RELEASE_CUTOFF_HOURS * HOUR_MS;

const STARTED = "This Job has already started";

// a Job seen at one time and since moved: they're asked to look again (#242)
const moved = (startsAt: Date, seen: Date | undefined) =>
  seen && seen.getTime() !== startsAt.getTime()
    ? `This Job has moved to ${formatWhen(startsAt)}. Please check the new time, then confirm again.`
    : null;

// a booked Job on its day of the Schedule
const onDay = (day: ScheduleDay, jobId: string) =>
  day.jobs.find((job) => job.id === jobId)!;

/**
 * Office Staff Offering a booked Job, on its day of the Schedule, to
 * someone: refused once it has started, to anyone but an active Cleaner, to
 * someone on its crew already, when its crew is whole, and when they aren't
 * free for it, so they could never
 * Confirm it.
 */
export const whyNotOffer = (
  day: ScheduleDay,
  jobId: string,
  member: { id: string; name: string; active: boolean; roles: StaffRole[] },
  now: Date,
) => {
  const job = onDay(day, jobId);
  if (new Date(job.startsAt) <= now) return STARTED;
  if (!member.active || !member.roles.includes("cleaner")) {
    return `${member.name} isn't an active Cleaner`;
  }
  if (job.crew.some((c) => c.id === member.id)) {
    return `${member.name} already has a place on this Job`;
  }
  if (job.crew.length >= job.crewSize) {
    return job.crewSize === 1
      ? "This Job's place is taken"
      : `All ${job.crewSize} places on this Job are taken`;
  }
  if (!isFree(day, member.id, asClean(job))) {
    return `${member.name} isn't free then: they're on another Job or a Site Visit at that time, or have no hours that day`;
  }
  return null;
};

// A Cleaner Confirming the Job they were Offered, on its day of
// the Schedule, at the time they were shown: refused once the Job has
// started, if it has moved, or if they're no longer free for it
export const whyNotConfirm = (
  day: ScheduleDay,
  jobId: string,
  staffId: string,
  seen: Date | undefined,
  now: Date,
) => {
  const job = onDay(day, jobId);
  const startsAt = new Date(job.startsAt);
  if (startsAt <= now) return STARTED;
  const since = moved(startsAt, seen);
  if (since) return since;
  if (!isFree(day, staffId, asClean(job))) {
    return "You're no longer free for this Job. Please release it, or call the Office.";
  }
  return null;
};

// A Cleaner Releasing their Assignment: an Offered one any time, a Confirmed one
// only until 48 hours before the Job
export const whyNotRelease = (
  status: AssignmentState,
  job: Pick<Job, "startsAt">,
  now: Date,
) =>
  status === "confirmed" && releaseClosed(job, now)
    ? `A Confirmed place can't be released within ${RELEASE_CUTOFF_HOURS} hours of the Job. Please call the Office.`
    : null;

// whether a Job's Cleaners Needed are open now: booked, not yet started, and
// within 7 days of starting
export const neededOpen = (job: Pick<Job, "status"> & When, now: Date) =>
  job.status === "booked" &&
  new Date(job.startsAt) > now &&
  opensAt(job) <= now;

/**
 * A Job's Cleaners Needed, on a Job whose Cleaners Needed are open
 * (neededOpen), and the active Cleaners they're open to, in name order: those
 * free for it (isFree) who aren't on its crew, haven't Released it, and
 * haven't said "Not for me". Null when its crew is whole.
 */
export const openingOf = (
  day: ScheduleDay,
  job: ScheduledJob,
  assigned: Assigned[],
  passedBy: string[],
) => {
  const open = job.crewSize - assigned.filter((p) => isOnCrew(p.status)).length;
  if (open <= 0) return null;
  const ruledOut = new Set([...assigned.map((p) => p.staffId), ...passedBy]);
  const clean = asClean(job);
  const openTo = day.available
    .map((c) => c.id)
    .filter((id) => !ruledOut.has(id) && isFree(day, id, clean));
  return { open, openTo };
};

/**
 * A Cleaner taking a Cleaner Needed, at the time they were shown: refused
 * when the Job isn't booked or has started, has moved, needs no Cleaner (not
 * open yet, or someone else took it), or it isn't open to them (they
 * Released it, are on its crew, or aren't free).
 */
export const whyNotTakeCleanerNeeded = (
  job: Job,
  staffId: string,
  opening: { openTo: string[]; assigned: Assigned[] } | undefined,
  seen: Date | undefined,
  now: Date,
) => {
  if (job.status !== "booked" || job.startsAt <= now) {
    return "This Job isn't open any more";
  }
  const since = moved(job.startsAt, seen);
  if (since) return since;
  if (!opening) {
    return opensAt(job) > now
      ? "This Job isn't open to Cleaners yet"
      : "Someone else took this Job";
  }
  if (opening.openTo.includes(staffId)) return null;
  const own = opening.assigned.find((p) => p.staffId === staffId);
  return own?.status === "released"
    ? "You released your place on this Job"
    : own
      ? "You already have a place on this Job"
      : "You're no longer free for this Job";
};
