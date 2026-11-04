import {
  holdsPlace,
  type AssignmentState,
  type ScheduleDay,
  type ScheduledJob,
  type StaffRole,
} from "@empire-cleaning/models";
import { DAY_MS, HOUR_MS } from "../../services/clock/index.ts";
import { formatWhen } from "../../services/email/index.ts";
import { isFree } from "../jobs/schedule.ts";

// The rules for places on a Job (ADR-0019), over what the actions load: the
// Job's day of the Schedule, and its Assignments. Each says why something is
// refused, or null when it isn't. They never query: the actions lock and
// load, ask, then write.

// A Job's Open Places are open to free Cleaners from this many days before
// it starts: who is free is only reliable nearer the day
export const OPEN_PLACE_DAYS = 7;

// a Confirmed place can't be Released this close to the Job: the Office needs
// time to find someone else
const RELEASE_CUTOFF_HOURS = 48;

type Job = { id: string; status: string; startsAt: Date; crewSize: number };

// an Assignment on a Job, Released ones too
type Place = { staffId: string; status: AssignmentState };

// when a Job's Open Places open to free Cleaners
export const opensAt = (job: Pick<Job, "startsAt">) =>
  new Date(job.startsAt.getTime() - OPEN_PLACE_DAYS * DAY_MS);

export const releaseClosed = (job: Pick<Job, "startsAt">, now: Date) =>
  job.startsAt.getTime() - now.getTime() < RELEASE_CUTOFF_HOURS * HOUR_MS;

// a Job seen at one time and since moved: they're asked to look again (#242)
const moved = (job: Pick<Job, "startsAt">, seen: Date | undefined) =>
  seen && seen.getTime() !== job.startsAt.getTime()
    ? `This Job has moved to ${formatWhen(job.startsAt)}. Please check the new time, then confirm again.`
    : null;

// a Job as isFree checks it: at its own time, not counted against itself
const cleanOf = (job: ScheduledJob) => ({
  startsAt: new Date(job.startsAt),
  labourHours: job.labourHours,
  crewSize: job.crewSize,
  jobId: job.id,
});

// a booked Job on its day of the Schedule
const onDay = (day: ScheduleDay, job: Pick<Job, "id">) =>
  day.jobs.find((j) => j.id === job.id)!;

/**
 * Office Staff Offering a place on a booked Job to someone: refused once it
 * has started, to anyone but an active Cleaner, to someone who holds a place
 * on it already, when every place is held, and when they aren't free for it,
 * so they could never Confirm it.
 */
export const whyNotOffer = (
  day: ScheduleDay,
  job: Job,
  member: { id: string; name: string; active: boolean; roles: StaffRole[] },
  now: Date,
) => {
  if (job.startsAt <= now) return "This Job has already started";
  if (!member.active || !member.roles.includes("cleaner")) {
    return `${member.name} isn't an active Cleaner`;
  }
  const scheduled = onDay(day, job);
  if (scheduled.crew.some((c) => c.id === member.id)) {
    return `${member.name} already has a place on this Job`;
  }
  if (scheduled.crew.length >= job.crewSize) {
    return job.crewSize === 1
      ? "This Job's place is taken"
      : `All ${job.crewSize} places on this Job are taken`;
  }
  if (!isFree(day, member.id, cleanOf(scheduled))) {
    return `${member.name} isn't free then: they're on another Job or a Site Visit at that time, or have no hours that day`;
  }
  return null;
};

// A Cleaner Confirming the place they were Offered, at the time they were
// shown: refused once the Job has started, if it has moved, or if they're no
// longer free for it
export const whyNotConfirm = (
  day: ScheduleDay,
  job: Job,
  staffId: string,
  seen: Date | undefined,
  now: Date,
) => {
  if (job.startsAt <= now) return "This Job has already started";
  const since = moved(job, seen);
  if (since) return since;
  if (!isFree(day, staffId, cleanOf(onDay(day, job)))) {
    return "You're no longer free for this Job. Please release it, or call the Office.";
  }
  return null;
};

// A Cleaner Releasing their place: an Offered one any time, a Confirmed one
// only until 48 hours before the Job
export const whyNotRelease = (
  status: AssignmentState,
  job: Pick<Job, "startsAt">,
  now: Date,
) =>
  status === "confirmed" && releaseClosed(job, now)
    ? `A Confirmed place can't be released within ${RELEASE_CUTOFF_HOURS} hours of the Job. Please call the Office.`
    : null;

// whether a Job's Open Places are open now: booked, not yet started, and
// within 7 days of starting
export const placesOpen = (job: Pick<Job, "status" | "startsAt">, now: Date) =>
  job.status === "booked" && job.startsAt > now && opensAt(job) <= now;

/**
 * A Job's Open Places, on a Job whose places are open (placesOpen), and the
 * active Cleaners they're open to, in name order: those free for it (isFree)
 * who hold no place on it, haven't Released one, and haven't said "Not for
 * me". Null when every place is held.
 */
export const openingOf = (
  day: ScheduleDay,
  job: ScheduledJob,
  places: Place[],
  passedBy: string[],
) => {
  const open = job.crewSize - places.filter((p) => holdsPlace(p.status)).length;
  if (open <= 0) return null;
  const ruledOut = new Set([...places.map((p) => p.staffId), ...passedBy]);
  const clean = cleanOf(job);
  const openTo = day.available
    .map((c) => c.id)
    .filter((id) => !ruledOut.has(id) && isFree(day, id, clean));
  return { open, openTo };
};

/**
 * A Cleaner taking an Open Place, at the time they were shown: refused when
 * the Job isn't booked or has started, has moved, has no Open Place (not
 * open yet, or someone else took it), or it isn't open to them (they
 * Released a place on it, hold one, or aren't free).
 */
export const whyNotTakeOpenPlace = (
  job: Job,
  staffId: string,
  opening: { openTo: string[]; places: Place[] } | undefined,
  seen: Date | undefined,
  now: Date,
) => {
  if (job.status !== "booked" || job.startsAt <= now) {
    return "This Job isn't open any more";
  }
  const since = moved(job, seen);
  if (since) return since;
  if (!opening) {
    return opensAt(job) > now
      ? "This Job isn't open to Cleaners yet"
      : "Someone else took this Job";
  }
  if (opening.openTo.includes(staffId)) return null;
  const own = opening.places.find((p) => p.staffId === staffId);
  return own?.status === "released"
    ? "You released your place on this Job"
    : own
      ? "You already have a place on this Job"
      : "You're no longer free for this Job";
};
