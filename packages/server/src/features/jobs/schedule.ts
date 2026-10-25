import { and, arrayContains, eq, gte, inArray, lt } from "drizzle-orm";
import type {
  DayCapacity,
  ScheduleDay,
  ScheduledJob,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import {
  addDays,
  dayOf,
  daysFrom,
  startOfDay,
  weekdayOf,
} from "../../services/clock/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import {
  staff,
  staffAvailabilityExceptions,
  staffUsualHours,
} from "../staff/staff.schema.ts";
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

// the booked Jobs starting on the days of the range, by day, earliest first
const bookedJobs = async (days: string[]) => {
  const rows = await db
    .select({ job: jobs, property: properties, client: clients })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(
      and(
        eq(jobs.status, "booked"),
        gte(jobs.startsAt, startOfDay(days[0]!)),
        lt(jobs.startsAt, startOfDay(addDays(days.at(-1)!, 1))),
      ),
    )
    .orderBy(jobs.startsAt);

  const byDay = new Map(days.map((day) => [day, [] as ScheduledJob[]]));
  for (const { job, property, client } of rows) {
    byDay.get(dayOf(job.startsAt))?.push({
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
    });
  }
  return byDay;
};

// the Schedule for the days from `from` to `to`, both included
export const scheduleFor = async (
  from: string,
  to: string,
): Promise<ScheduleDay[]> => {
  const days = daysFrom(from, to);
  const [hours, booked] = await Promise.all([
    cleanerHours(days),
    bookedJobs(days),
  ]);

  return days.map((date) => {
    const available = hours.get(date)!;
    const dayJobs = booked.get(date)!;
    const staffUnits = available.reduce((sum, c) => sum + c.units, 0);
    const bookedUnits = dayJobs.reduce(
      (sum, job) => sum + hundredths(job.labourHours),
      0,
    );
    return {
      date,
      staffHours: fromHundredths(staffUnits),
      bookedHours: fromHundredths(bookedUnits),
      freeHours: fromHundredths(staffUnits - bookedUnits),
      available: available.map(({ id, name, units }) => ({
        id,
        name,
        hours: fromHundredths(units),
      })),
      jobs: dayJobs,
    };
  });
};

// Whether a day has enough free Staff hours for a booking of this many Labour
// Hours, counting the Jobs already booked that day. Accepting a Quote (#8)
// and Reschedule Requests (#20) ask this.
export const hasRoomFor = async (
  date: string,
  labourHours: number,
): Promise<DayCapacity> => {
  const [day] = await scheduleFor(date, date);
  const { staffHours, bookedHours, freeHours } = day!;
  return {
    date,
    labourHours,
    staffHours,
    bookedHours,
    freeHours,
    hasRoom: hundredths(freeHours) >= hundredths(labourHours),
  };
};
