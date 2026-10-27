import type { Tx } from "../../db/index.ts";
import { clock, dayOf } from "../../services/clock/index.ts";
import type { Job } from "../jobs/jobs.schema.ts";
import type { Quote } from "../quotes/quotes.schema.ts";
import { servicePlanVisits } from "./service-plans.schema.ts";

// the first Job booked on each of a Quote's weekdays, by its position
export type FirstJobs = { position: number; job: Job }[];

// each first Job as its weekday's first visit on the Quote's terms
export const recordFirstVisits = async (
  tx: Tx,
  planId: string,
  quote: Quote,
  firstJobs: FirstJobs,
) => {
  const now = clock.now();
  await tx.insert(servicePlanVisits).values(
    firstJobs.map(({ position, job }) => ({
      servicePlanId: planId,
      quoteId: quote.id,
      position,
      dueOn: dayOf(job.startsAt),
      jobId: job.id,
      generatedAt: now,
    })),
  );
};
