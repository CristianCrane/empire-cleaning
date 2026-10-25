import type { CleanType } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { jobs } from "./jobs.schema.ts";

type NewJob = {
  propertyId: string;
  cleanType: CleanType;
  startsAt: Date;
  labourHours: number;
  crewSize: number;
};

// puts a Job on the Schedule. Accepting a Quote (#8) will call this once it
// has checked the day has room (hasRoomFor) and taken the Deposit.
export const bookJob = async (job: NewJob) => {
  const [booked] = await db.insert(jobs).values(job).returning();
  return booked!;
};
