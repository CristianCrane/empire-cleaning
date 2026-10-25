import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { ClientJob, CleanType } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { properties } from "../properties/properties.schema.ts";
import { jobs } from "./jobs.schema.ts";

// Jobs on the Schedule, taking up their day's hours: booked or Completed
export const onSchedule = () => inArray(jobs.status, ["booked", "completed"]);

type NewJob = {
  propertyId: string;
  cleanType: CleanType;
  startsAt: Date;
  labourHours: number;
  crewSize: number;
};

// Holds a day of the Schedule until the transaction ends, so that checking it
// has room (hasRoomFor) and booking onto it happen as one: two acceptances for
// the same day take turns rather than both fitting into the last free hours.
export const lockDay = async (tx: Tx, day: string) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`schedule ${day}`}))`,
  );
};

// puts a Job on the Schedule. Accepting a Quote calls this once it has locked
// the day, checked it has room and taken the Deposit.
export const bookJob = async (job: NewJob, tx: Tx | typeof db = db) => {
  const [booked] = await tx
    .insert(jobs)
    .values({ ...job, bookedAt: clock.now() })
    .returning();
  return booked!;
};

// a Client's booked Jobs still to come, soonest first
export const upcomingJobsFor = async (
  clientId: string,
): Promise<ClientJob[]> => {
  const rows = await db
    .select({ job: jobs, property: properties })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(
      and(
        eq(properties.clientId, clientId),
        eq(jobs.status, "booked"),
        gt(jobs.startsAt, clock.now()),
      ),
    )
    .orderBy(asc(jobs.startsAt));
  return rows.map(({ job, property }) => ({
    id: job.id,
    startsAt: job.startsAt.toISOString(),
    cleanType: job.cleanType,
    crewSize: job.crewSize,
    hoursOnSite: Math.round((job.labourHours / job.crewSize) * 100) / 100,
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
    },
  }));
};
