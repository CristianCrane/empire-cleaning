import {
  and,
  arrayContains,
  eq,
  gte,
  inArray,
  lt,
  type SQL,
} from "drizzle-orm";
import type {
  DayCapacity,
  HeldTime,
  ScheduleDay,
  ScheduledJob,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import {
  addDays,
  clock,
  dayOf,
  daysFrom,
  startOfDay,
  weekdayOf,
} from "../../services/clock/index.ts";
import { assignmentStatusOf, crewOf } from "../assignments/places.ts";
import { clients } from "../clients/clients.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { rescheduleRequests } from "../reschedule/reschedule.schema.ts";
import {
  staff,
  staffAvailabilityExceptions,
  staffUsualHours,
} from "../staff/staff.schema.ts";
import { onSchedule } from "./jobs.ts";
import { jobs } from "./jobs.schema.ts";

// Hours are added in hundredths, so sums of 7.25 and 0.1 never drift
const hundredths = (hours: number) => Math.round(hours * 100);
const fromHundredths = (units: number) => units / 100;

// each active Cleaner's hours on each day of the range: an exception for the
// day if there is one, otherwise their usual hours for that weekday. Only
// Cleaners count: Labour Hours are cleaning time.
const cleanerHours = async (days: string[]) => {
  const cleaners = await db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(and(eq(staff.active, true), arrayContains(staff.roles, ["cleaner"])))
    .orderBy(staff.name);
  const ids = cleaners.map((c) => c.id);
  const byDay = new Map(
    days.map((day) => [
      day,
      [] as { id: string; name: string; units: number }[],
    ]),
  );
  if (ids.length === 0) return byDay;

  const [usual, exceptions] = await Promise.all([
    db
      .select()
      .from(staffUsualHours)
      .where(inArray(staffUsualHours.staffId, ids)),
    db
      .select()
      .from(staffAvailabilityExceptions)
      .where(
        and(
          inArray(staffAvailabilityExceptions.staffId, ids),
          gte(staffAvailabilityExceptions.date, days[0]!),
          lt(staffAvailabilityExceptions.date, addDays(days.at(-1)!, 1)),
        ),
      ),
  ]);
  const usualOf = new Map(
    usual.map((u) => [`${u.staffId} ${u.weekday}`, hundredths(u.hours)]),
  );
  const exceptionOf = new Map(
    exceptions.map((e) => [`${e.staffId} ${e.date}`, hundredths(e.hours)]),
  );

  for (const day of days) {
    for (const { id, name } of cleaners) {
      const units =
        exceptionOf.get(`${id} ${day}`) ??
        usualOf.get(`${id} ${weekdayOf(day)}`) ??
        0;
      if (units > 0) byDay.get(day)!.push({ id, name, units });
    }
  }
  return byDay;
};

// Jobs as the Office sees them, earliest first, whether or not they're on
// the Schedule
export const jobViews = async (
  where: SQL | undefined,
): Promise<ScheduledJob[]> => {
  const rows = await db
    .select({ job: jobs, property: properties, client: clients })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(where)
    .orderBy(jobs.startsAt);
  const [assignment, crews] = await Promise.all([
    assignmentStatusOf(rows.map((r) => r.job)),
    crewOf(rows.map((r) => r.job.id)),
  ]);
  const now = clock.now();

  return rows.map(({ job, property, client }) => ({
    id: job.id,
    startsAt: job.startsAt.toISOString(),
    cleanType: job.cleanType,
    status: job.status,
    labourHours: job.labourHours,
    crewSize: job.crewSize,
    hoursOnSite: Math.round((job.labourHours / job.crewSize) * 100) / 100,
    client: { id: client.id, name: client.name },
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
    },
    assignment: assignment.get(job.id)!,
    crew: crews.get(job.id)!,
    movable: job.status === "booked" && job.startsAt > now,
  }));
};

// Jobs on the Schedule as the Office sees them, earliest first
export const scheduledJobs = (where: SQL | undefined) =>
  jobViews(and(onSchedule(), where));

// the booked Jobs starting on the days of the range, by day, earliest first
const bookedJobs = async (days: string[]) => {
  const byDay = new Map(days.map((day) => [day, [] as ScheduledJob[]]));
  const booked = await scheduledJobs(
    and(
      gte(jobs.startsAt, startOfDay(days[0]!)),
      lt(jobs.startsAt, startOfDay(addDays(days.at(-1)!, 1))),
    ),
  );
  for (const job of booked) {
    byDay.get(dayOf(new Date(job.startsAt)))?.push(job);
  }
  return byDay;
};

// The new times pending Reschedule Requests hold on each day of the range
// for booked Jobs, and the Labour Hours they hold there. A Job moving to
// another time on its own day holds a crew at that time, but no hours: its
// hours are booked there already.
const heldTimes = async (days: string[]) => {
  const byDay = new Map(
    days.map((day) => [day, { units: 0, held: [] as HeldTime[] }]),
  );
  const pending = await db
    .select({
      jobId: jobs.id,
      startsAt: rescheduleRequests.startsAt,
      jobStartsAt: jobs.startsAt,
      labourHours: jobs.labourHours,
      crewSize: jobs.crewSize,
    })
    .from(rescheduleRequests)
    .innerJoin(jobs, eq(jobs.id, rescheduleRequests.jobId))
    .where(
      and(
        eq(rescheduleRequests.status, "pending"),
        eq(jobs.status, "booked"),
        gte(rescheduleRequests.startsAt, startOfDay(days[0]!)),
        lt(rescheduleRequests.startsAt, startOfDay(addDays(days.at(-1)!, 1))),
      ),
    );
  for (const request of pending) {
    const day = byDay.get(dayOf(request.startsAt))!;
    const { jobId, startsAt, labourHours, crewSize } = request;
    day.held.push({
      jobId,
      startsAt: startsAt.toISOString(),
      labourHours,
      crewSize,
    });
    if (dayOf(startsAt) !== dayOf(request.jobStartsAt)) {
      day.units += hundredths(labourHours);
    }
  }
  return byDay;
};

// the Schedule for the days from `from` to `to`, both included
export const scheduleFor = async (
  from: string,
  to: string,
): Promise<ScheduleDay[]> => {
  const days = daysFrom(from, to);
  const [hours, booked, holds] = await Promise.all([
    cleanerHours(days),
    bookedJobs(days),
    heldTimes(days),
  ]);

  return days.map((date) => {
    const available = hours.get(date)!;
    const dayJobs = booked.get(date)!;
    const staffUnits = available.reduce((sum, c) => sum + c.units, 0);
    const bookedUnits = dayJobs.reduce(
      (sum, job) => sum + hundredths(job.labourHours),
      0,
    );
    const { units: heldUnits, held } = holds.get(date)!;
    return {
      date,
      staffHours: fromHundredths(staffUnits),
      bookedHours: fromHundredths(bookedUnits),
      heldHours: fromHundredths(heldUnits),
      freeHours: fromHundredths(staffUnits - bookedUnits - heldUnits),
      available: available.map(({ id, name, units }) => ({
        id,
        name,
        hours: fromHundredths(units),
      })),
      jobs: dayJobs,
      held,
    };
  });
};

// a clean to find room for; a booked Job being moved gives its id, so it
// doesn't stand in its own way
export type Clean = {
  startsAt: Date;
  labourHours: number;
  crewSize: number;
  jobId?: string;
};

const HOUR_MS = 3_600_000;

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

// The most crews at work at once between start and end. The count only goes
// up when a crew starts, so it's highest at `start` or at one of their starts.
const crewsBusyDuring = (spans: CrewSpan[], start: number, end: number) => {
  const during = spans.filter((s) => s.start < end && s.end > start);
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
 * Whether a clean has room on a day of the Schedule, by two rules:
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
 * counted against itself, at its booked time or a time held for it.
 */
export const roomOn = (day: ScheduleDay, clean: Clean): DayCapacity => {
  const { startsAt, labourHours, crewSize, jobId } = clean;
  const ownDay = day.jobs.some((job) => job.id === jobId);
  // what it holds on this day already, moving onto it from another
  const ownHeld = day.held
    .filter((h) => h.jobId === jobId && !ownDay)
    .reduce((sum, h) => sum + hundredths(h.labourHours), 0);
  const hasHours =
    ownDay || hundredths(day.freeHours) + ownHeld >= hundredths(labourHours);

  const spans = [
    ...day.jobs
      .filter((job) => job.id !== jobId)
      .map((job) =>
        crewSpan(new Date(job.startsAt), job.labourHours, job.crewSize),
      ),
    ...day.held
      .filter((h) => h.jobId !== jobId)
      .map((h) => crewSpan(new Date(h.startsAt), h.labourHours, h.crewSize)),
  ];
  const own = crewSpan(startsAt, labourHours, crewSize);
  const crewsBusy = crewsBusyDuring(spans, own.start, own.end);
  const cleaners = day.available.length;
  const hasCrew = crewsBusy + crewSize <= cleaners;

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
    hasRoom: hasHours && hasCrew,
  };
};

// why a clean has no room, for Office Staff
export const whyNoRoom = (room: DayCapacity) => {
  if (!room.hasHours) {
    return `That day doesn't have room: the Job needs ${room.labourHours} Labour Hours and ${Math.max(room.freeHours, 0)} are free.`;
  }
  const free = Math.max(room.cleaners - room.crewsBusy, 0);
  return `Not enough Cleaners are free then: the Job needs ${room.crewSize}, and ${free} of the ${room.cleaners} available that day ${free === 1 ? "is" : "are"}.`;
};

// Whether a clean has room at its time, as roomOn says. Accepting a Quote
// (#8), Reschedule Requests (#20), moving a Job (#52) and Service Plan Jobs
// (#14) ask this, holding the day (lockDay) while they book. Jobs it
// replaces, as a plan's new terms replace its booked Jobs (#15), count as
// gone.
export const roomFor = async (
  clean: Clean,
  replacing: string[] = [],
): Promise<DayCapacity> => {
  const date = dayOf(clean.startsAt);
  const [day] = await scheduleFor(date, date);
  const gone = day!.jobs.filter((job) => replacing.includes(job.id));
  return roomOn(
    {
      ...day!,
      jobs: day!.jobs.filter((job) => !gone.includes(job)),
      freeHours: fromHundredths(
        gone.reduce(
          (free, job) => free + hundredths(job.labourHours),
          hundredths(day!.freeHours),
        ),
      ),
    },
    clean,
  );
};
