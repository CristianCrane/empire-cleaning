import {
  and,
  arrayContains,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type {
  DayCapacity,
  HeldTime,
  ScheduleDay,
  ScheduledJob,
  ScheduledSiteVisit,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
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
import { siteVisits } from "../site-visits/site-visits.schema.ts";
import { siteVisitViews } from "../site-visits/views.ts";
import {
  staff,
  staffAvailabilityExceptions,
  staffUsualHours,
} from "../staff/staff.schema.ts";
import { hoursOnSiteOf, onSchedule } from "./jobs.ts";
import {
  asClean,
  fromHundredths,
  hundredths,
  isFree,
  roomOn,
  visitHours,
  withoutReplaced,
  type Clean,
} from "./rules.ts";
import { jobs } from "./jobs.schema.ts";
import { serviceVersions } from "../services/services.ts";

// the first and last of some days, in whatever order they come
const spanOf = (days: string[]) => {
  const sorted = [...days].sort();
  return { first: sorted[0]!, last: sorted.at(-1)! };
};

// an instant on one of the days from the first of these to the last, New
// York's
export const onDays = (column: PgColumn, days: string[]) => {
  const { first, last } = spanOf(days);
  return and(
    gte(column, startOfDay(first)),
    lt(column, startOfDay(addDays(last, 1))),
  );
};

// each active Cleaner's hours on each day of the range: an exception for the
// day if there is one, otherwise their usual hours for that weekday. Only
// Cleaners count: Labour Hours are cleaning time.
const cleanerHours = async (days: string[], tx: Tx | typeof db = db) => {
  const cleaners = await tx
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

  // one after the other, as a transaction's queries share one connection
  // (ADR-0024)
  const usual = await tx
    .select()
    .from(staffUsualHours)
    .where(inArray(staffUsualHours.staffId, ids));
  const exceptions = await tx
    .select()
    .from(staffAvailabilityExceptions)
    .where(
      and(
        inArray(staffAvailabilityExceptions.staffId, ids),
        gte(staffAvailabilityExceptions.date, spanOf(days).first),
        lt(staffAvailabilityExceptions.date, addDays(spanOf(days).last, 1)),
      ),
    );
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
  tx: Tx | typeof db = db,
): Promise<ScheduledJob[]> => {
  const rows = await tx
    .select({ job: jobs, property: properties, client: clients })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(where)
    .orderBy(jobs.startsAt);
  const assignment = await assignmentStatusOf(
    rows.map((r) => r.job),
    tx,
  );
  const crews = await crewOf(
    rows.map((r) => r.job.id),
    tx,
  );
  const versions = await serviceVersions(
    rows.map((r) => r.job.serviceId),
    tx,
  );
  const now = clock.now();

  return rows.map(({ job, property, client }) => ({
    id: job.id,
    startsAt: job.startsAt.toISOString(),
    serviceName: versions.get(job.serviceId)!.name,
    status: job.status,
    labourHours: job.labourHours,
    crewSize: job.crewSize,
    hoursOnSite: hoursOnSiteOf(job),
    client: {
      id: client.id,
      name: client.name,
      businessName: client.businessName,
    },
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
export const scheduledJobs = (
  where: SQL | undefined,
  tx: Tx | typeof db = db,
) => jobViews(and(onSchedule(), where), tx);

// the booked Jobs starting on the days of the range, by day, earliest first
const bookedJobs = async (days: string[], tx: Tx | typeof db) => {
  const byDay = new Map(days.map((day) => [day, [] as ScheduledJob[]]));
  const booked = await scheduledJobs(onDays(jobs.startsAt, days), tx);
  for (const job of booked) {
    byDay.get(dayOf(new Date(job.startsAt)))?.push(job);
  }
  return byDay;
};

// The new times pending Reschedule Requests hold on each day of the range
// for booked Jobs still to start (one that has started can't move), and the
// Labour Hours they hold there. A Job moving to another time on its own day
// holds a crew at that time, but no hours: its hours are booked there
// already.
const heldTimes = async (days: string[], tx: Tx | typeof db) => {
  const byDay = new Map(
    days.map((day) => [day, { units: 0, held: [] as HeldTime[] }]),
  );
  const pending = await tx
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
        gt(jobs.startsAt, clock.now()),
        onDays(rescheduleRequests.startsAt, days),
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

// The booked and Done Site Visits on each day of the range (#73), earliest
// first. One by a Cleaner with Available Hours that day takes room like a
// Job with a Crew Size of one; one by Office Staff alone takes none, and nor
// does one whose findings were recorded before its time, as nobody will go
// (#242).
const siteVisitsOn = async (
  days: string[],
  hours: Awaited<ReturnType<typeof cleanerHours>>,
  tx: Tx | typeof db,
) => {
  const byDay = new Map(days.map((day) => [day, [] as ScheduledSiteVisit[]]));
  const visits = await siteVisitViews(
    and(
      inArray(siteVisits.status, ["booked", "done"]),
      onDays(siteVisits.startsAt, days),
    ),
    tx,
  );
  for (const visit of visits) {
    const date = dayOf(new Date(visit.startsAt!));
    byDay.get(date)?.push({
      ...visit,
      startsAt: visit.startsAt!,
      takesRoom:
        hours.get(date)!.some((c) => c.id === visit.visitor?.id) &&
        !(visit.doneAt && visit.doneAt < visit.startsAt!),
    });
  }
  return byDay;
};

// the Schedule for the days from `from` to `to`, both included
export const scheduleFor = async (
  from: string,
  to: string,
  tx: Tx | typeof db = db,
): Promise<ScheduleDay[]> => {
  const days = daysFrom(from, to);
  const hours = await cleanerHours(days, tx);
  const booked = await bookedJobs(days, tx);
  const holds = await heldTimes(days, tx);
  const visits = await siteVisitsOn(days, hours, tx);

  return days.map((date) => {
    const available = hours.get(date)!;
    const dayJobs = booked.get(date)!;
    const dayVisits = visits.get(date)!;
    const staffUnits = available.reduce((sum, c) => sum + c.units, 0);
    const bookedUnits =
      dayJobs.reduce((sum, job) => sum + hundredths(job.labourHours), 0) +
      dayVisits
        .filter((v) => v.takesRoom)
        .reduce((sum, v) => sum + hundredths(visitHours(v)), 0);
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
      siteVisits: dayVisits,
    };
  });
};

// the day of the Schedule an instant is on
export const scheduleOn = async (instant: Date, tx: Tx | typeof db = db) => {
  const date = dayOf(instant);
  const [day] = await scheduleFor(date, date, tx);
  return day!;
};

// Whether a clean has room at its time, as roomOn says. Reschedule Requests
// (#20), moving a Job (#52) and Service Plan Jobs (#14) ask this in their
// transaction, holding the day (lockDay) while they book. Jobs it replaces
// count as gone (withoutReplaced).
export const roomFor = async (
  clean: Clean,
  tx: Tx | typeof db = db,
  replacing: string[] = [],
): Promise<DayCapacity> => {
  const day = await scheduleOn(clean.startsAt, tx);
  return roomOn(withoutReplaced(day, replacing), clean);
};

// Which of these Staff are free for a Job at its time, as isFree says. Moving
// a Job, and a Service Plan Offering its next clean to the last crew, ask
// this in their transaction.
export const freeFor = async (
  staffIds: string[],
  job: { id: string; startsAt: Date; labourHours: number; crewSize: number },
  tx: Tx | typeof db = db,
) => {
  const day = await scheduleOn(job.startsAt, tx);
  const clean = asClean(job);
  return new Set(staffIds.filter((id) => isFree(day, id, clean)));
};
