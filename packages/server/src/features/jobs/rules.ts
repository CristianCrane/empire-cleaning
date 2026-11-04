import type {
  DayCapacity,
  HeldTime,
  ScheduleDay,
  ScheduledSiteVisit,
} from "@empire-cleaning/models";
import {
  addDays,
  dayOf,
  HOUR_MS,
  startOfDay,
} from "../../services/clock/index.ts";

// The Schedule's rules, over a day of it as scheduleFor loads it: whether a
// clean has room (roomOn), whether a Staff member is free for one (isFree),
// and the spans of time they're worked out in. They never query: the
// actions lock and load, ask, then write.

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

/**
 * Whether a Staff member is free for a clean on a day of the Schedule, as
 * ADR-0019 has it: Available Hours that day, and no booked Job they hold a
 * place on, or booked Site Visit of theirs, overlapping its time on site. A
 * Job being moved isn't counted against itself, so its crew can be checked
 * at its new time. Stricter than room (roomOn), which takes anyone with
 * hours to be free all day. Only the clean's own day counts: every clean
 * ends by midnight (endsByMidnight). A Site Visit needn't, but one running
 * past midnight into a Job early the next day isn't counted against it.
 */
export const isFree = (day: ScheduleDay, staffId: string, clean: Clean) => {
  if (!day.available.some((c) => c.id === staffId)) return false;
  const own = cleanSpan(clean);
  const busy = [
    ...day.jobs
      .filter(
        (job) =>
          job.status === "booked" &&
          job.id !== clean.jobId &&
          job.crew.some((c) => c.id === staffId),
      )
      .map(jobSpan),
    ...day.siteVisits
      .filter((v) => v.status === "booked" && v.visitor?.id === staffId)
      .map(visitSpan),
  ];
  return !busy.some((span) => overlaps(span, own));
};

export const ENDS_BY_MIDNIGHT =
  "Cleans end by midnight: choose an earlier start time";

// why a clean has no room, for Office Staff
export const whyNoRoom = (room: DayCapacity) => {
  if (!room.endsByMidnight) return ENDS_BY_MIDNIGHT;
  if (!room.hasHours) {
    return `That day doesn't have room: the Job needs ${room.labourHours} Labour Hours and ${Math.max(room.freeHours, 0)} are free.`;
  }
  const free = Math.max(room.cleaners - room.crewsBusy, 0);
  return `Not enough Cleaners are free then: the Job needs ${room.crewSize}, and ${free} of the ${room.cleaners} available that day ${free === 1 ? "is" : "are"}.`;
};

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
