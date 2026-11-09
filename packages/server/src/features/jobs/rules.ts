import {
  PICK_MINUTES,
  type DayCapacity,
  type DayTimes,
  type HeldTime,
  type JobStatus,
  type ScheduleDay,
  type ScheduledSiteVisit,
} from "@empire-cleaning/models";
import {
  addDays,
  atTime,
  dayOf,
  HOUR_MS,
  startOfDay,
} from "../../services/clock/index.ts";

// The Schedule's rules, over a day of it as scheduleFor loads it: whether a
// clean has room (roomOn), whether a Staff member is free for one (isFree),
// what they're busy with then (busyWith), and the spans of time they're
// worked out in. They never query: the actions lock and load, ask, then
// write.

// Hours are added in hundredths, so sums of 7.25 and 0.1 never drift
export const hundredths = (hours: number) => Math.round(hours * 100);
export const fromHundredths = (units: number) => units / 100;

// A Site Visit's length as Labour Hours. Lengths are whole quarter-hours,
// so they're exact in hundredths.
export const visitHours = (visit: { minutes: number }) => visit.minutes / 60;

// a clean to find room for; a booked Job being moved gives its id, so it
// doesn't stand in its own way, and so does a Site Visit being moved
export type Clean = {
  startsAt: Date;
  labourHours: number;
  crewSize: number;
  jobId?: string;
  siteVisitId?: string;
};

// Cleans end by midnight, New York, so each is on one day of the Schedule
export const endsByMidnight = (startsAt: Date, hoursOnSite: number) =>
  startsAt.getTime() + hoursOnSite * HOUR_MS <=
  startOfDay(addDays(dayOf(startsAt), 1)).getTime();

// a crew at work: from when to when, in milliseconds, and how many
type CrewSpan = { start: number; end: number; crewSize: number };

const crewSpan = (
  startsAt: Date,
  labourHours: number,
  crewSize: number,
): CrewSpan => {
  const start = startsAt.getTime();
  return { start, end: start + (labourHours / crewSize) * HOUR_MS, crewSize };
};

// a clean's own time on site
const cleanSpan = (clean: Clean) =>
  crewSpan(clean.startsAt, clean.labourHours, clean.crewSize);

// a Job or a held time at work, and a Site Visit, as spans
const jobSpan = (
  job: Pick<HeldTime, "startsAt" | "labourHours" | "crewSize">,
) => crewSpan(new Date(job.startsAt), job.labourHours, job.crewSize);

const visitSpan = (visit: ScheduledSiteVisit) =>
  crewSpan(new Date(visit.startsAt), visitHours(visit), 1);

// a Job as a clean to check at its own time, not counted against itself
export const asClean = (job: {
  id: string;
  startsAt: Date | string;
  labourHours: number;
  crewSize: number;
}): Clean => ({
  startsAt: new Date(job.startsAt),
  labourHours: job.labourHours,
  crewSize: job.crewSize,
  jobId: job.id,
});

// whether two spans of time share any of it
const overlaps = (
  a: { start: number; end: number },
  b: { start: number; end: number },
) => a.start < b.end && a.end > b.start;

// The most crews at work at once between start and end. The count only goes
// up when a crew starts, so it's highest at `start` or at one of their starts.
const crewsBusyDuring = (spans: CrewSpan[], start: number, end: number) => {
  const during = spans.filter((s) => overlaps(s, { start, end }));
  const starts = [
    start,
    ...during.map((s) => s.start).filter((t) => t > start),
  ];
  return Math.max(
    ...starts.map((t) =>
      during
        .filter((s) => s.start <= t && s.end > t)
        .reduce((sum, s) => sum + s.crewSize, 0),
    ),
  );
};

/**
 * Whether a clean has room on a day of the Schedule. It must end by
 * midnight (endsByMidnight), and then two rules:
 *
 * - Hours: the day's free Cleaner hours, after the Jobs booked that day and
 *   the hours held for pending Reschedule Requests, cover its Labour Hours.
 *   A Job moving within its own day always has them.
 * - Headcount (#62): the Crew Sizes of the Jobs at work during its time on
 *   site, and of held new times, plus its own Crew Size, are no more than
 *   that day's Cleaners with Available Hours. Anyone available that day is
 *   taken to be free at any time of it. Only time on site counts, not travel.
 *
 * Completed and No Access Jobs count as they did. A Job being moved isn't
 * counted against itself, at its booked time or a time held for it. Site
 * Visits that take room (#73) count like Jobs with a Crew Size of one, and
 * one being moved isn't counted against itself either.
 */
export const roomOn = (day: ScheduleDay, clean: Clean): DayCapacity => {
  const { startsAt, labourHours, crewSize, jobId, siteVisitId } = clean;
  const ownDay = day.jobs.some((job) => job.id === jobId);
  // what it holds on this day already, moving onto it from another
  const ownHeld = day.held
    .filter((h) => h.jobId === jobId && !ownDay)
    .reduce((sum, h) => sum + hundredths(h.labourHours), 0);
  // a Site Visit's own hours, if it's on this day already and takes room
  const ownVisit = day.siteVisits
    .filter((v) => v.id === siteVisitId && v.takesRoom)
    .reduce((sum, v) => sum + hundredths(visitHours(v)), 0);
  const hasHours =
    ownDay ||
    hundredths(day.freeHours) + ownHeld + ownVisit >= hundredths(labourHours);

  const spans = [
    ...day.jobs.filter((job) => job.id !== jobId).map(jobSpan),
    ...day.held.filter((h) => h.jobId !== jobId).map(jobSpan),
    ...day.siteVisits
      .filter((v) => v.takesRoom && v.id !== siteVisitId)
      .map(visitSpan),
  ];
  const own = cleanSpan(clean);
  const crewsBusy = crewsBusyDuring(spans, own.start, own.end);
  const cleaners = day.available.length;
  const hasCrew = crewsBusy + crewSize <= cleaners;
  const inTime = endsByMidnight(startsAt, labourHours / crewSize);

  return {
    date: day.date,
    startsAt: startsAt.toISOString(),
    labourHours,
    crewSize,
    staffHours: day.staffHours,
    bookedHours: day.bookedHours,
    heldHours: day.heldHours,
    freeHours: day.freeHours,
    hasHours,
    cleaners,
    crewsBusy,
    hasCrew,
    endsByMidnight: inTime,
    hasRoom: inTime && hasHours && hasCrew,
  };
};

// every start the Schedule's pickers offer on a day: "00:00", "00:30", …
const pickTimes = Array.from({ length: (24 * 60) / PICK_MINUTES }, (_, i) => {
  const minutes = i * PICK_MINUTES;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});

// the starts a picker offers on a day of the Schedule
export const startsOn = (day: ScheduleDay) =>
  pickTimes.map((time) => atTime(day.date, time));

/**
 * The starts on each of these days of the Schedule (startsOn) where a clean
 * would find no crew free, as `hasCrew` says of it there (roomOn's, or a
 * Quote's cleanRooms'): the times the Office's pickers mark. Only the
 * headcount: a day's hours show in its header.
 */
export const startsWithoutCrew = (
  days: ScheduleDay[],
  hasCrew: (day: ScheduleDay, startsAt: Date) => boolean,
): DayTimes[] =>
  days.map((day) => {
    const starts = startsOn(day);
    return {
      date: day.date,
      times: pickTimes.filter((_, i) => !hasCrew(day, starts[i]!)),
    };
  });

/**
 * What a Staff member is busy with during a clean's time on site, on its
 * day of the Schedule (which has its Jobs and Site Visits earliest first):
 * the earliest booked Site Visit of theirs overlapping it, else the
 * earliest booked Job they're on the crew of. Null when nothing is. A Done
 * Site Visit doesn't count, even one recorded Done before its time (roomOn,
 * unlike this, still counts one Done at or after its time: its hours were
 * spent). A Job or Site Visit being moved isn't counted against itself.
 */
export const busyWith = (
  day: ScheduleDay,
  staffId: string,
  clean: Clean,
): { what: "site_visit" | "job"; startsAt: string } | null => {
  const own = cleanSpan(clean);
  const visit = day.siteVisits.find(
    (v) =>
      v.status === "booked" &&
      v.id !== clean.siteVisitId &&
      v.visitor?.id === staffId &&
      overlaps(visitSpan(v), own),
  );
  if (visit) return { what: "site_visit", startsAt: visit.startsAt };
  const job = day.jobs.find(
    (job) =>
      job.status === "booked" &&
      job.id !== clean.jobId &&
      job.crew.some((c) => c.id === staffId) &&
      overlaps(jobSpan(job), own),
  );
  return job ? { what: "job", startsAt: job.startsAt } : null;
};

/**
 * Whether a Staff member is free for a clean on a day of the Schedule, as
 * ADR-0019 has it: Available Hours that day, and busy with nothing then
 * (busyWith). Stricter than room (roomOn), which takes anyone with hours to
 * be free all day. Only the clean's own day counts: every clean ends by
 * midnight (endsByMidnight).
 */
export const isFree = (day: ScheduleDay, staffId: string, clean: Clean) =>
  day.available.some((c) => c.id === staffId) && !busyWith(day, staffId, clean);

// A day as it is once some of its booked Jobs are replaced, as a plan's new
// terms replace them (#15): they're gone, and so are the times held for
// moving them (#242). Their hours are free again, and so are a held time's
// moving one here from another day.
export const withoutReplaced = (
  day: ScheduleDay,
  replacing: string[],
): ScheduleDay => {
  const gone = day.jobs.filter((job) => replacing.includes(job.id));
  // a time held for moving one from another day holds its hours here too
  const goneHeld = day.held.filter((h) => replacing.includes(h.jobId));
  const heldHere = goneHeld.filter((h) => !gone.some((j) => j.id === h.jobId));
  return {
    ...day,
    jobs: day.jobs.filter((job) => !gone.includes(job)),
    held: day.held.filter((h) => !goneHeld.includes(h)),
    freeHours: fromHundredths(
      [...gone, ...heldHere].reduce(
        (free, job) => free + hundredths(job.labourHours),
        hundredths(day.freeHours),
      ),
    ),
  };
};

// a time asked for that has already passed
export const PASSED = "That time has passed. Pick a later time.";

// what happened to a Job that isn't booked any more
type Ended = Exclude<JobStatus, "booked">;
const ended: Record<Ended, string> = {
  completed: "This clean is done",
  cancelled: "This clean was cancelled",
  no_access: "The cleaner couldn't get in for this clean",
};
const already: Record<Ended, string> = {
  completed: "This clean is already done.",
  cancelled: "This clean is already cancelled.",
  no_access: "We already know the cleaner couldn't get in.",
};
// what someone can't do to a clean that has ended or started
const canDo: Record<Ended | "moved" | "offered" | "confirmed", string> = {
  completed: "mark it done",
  cancelled: "cancel it",
  no_access: "say the cleaner couldn't get in",
  moved: "move it",
  offered: "offer it to anyone",
  confirmed: "confirm it",
};

// Why a Job that isn't booked can't be `doing`: what happened to it, or
// that it already was
export const whyNotBooked = (status: Ended, doing: Ended | "moved") =>
  status === doing
    ? already[status]
    : `${ended[status]}, so you can't ${canDo[doing]}.`;

// why a Job that has started can't be `doing`
export const whyStarted = (doing: keyof typeof canDo) =>
  `This clean has already started, so you can't ${canDo[doing]}.`;
