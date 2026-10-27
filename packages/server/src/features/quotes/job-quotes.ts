import { and, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "../../db/index.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { servicePlanVisits } from "../service-plans/service-plans.schema.ts";
import { quoteOptions, quotes } from "./quotes.schema.ts";

// The Quote each Job is priced from, with the option its Client accepted: the
// one-off Quote that booked it, or, for a Service Plan's Job, the plan's
// Quote whose terms its visit was generated on, with that visit's weekday.
export const jobQuotes = async (jobIds: string[], tx: Tx | typeof db = db) => {
  if (jobIds.length === 0) return [];
  const [oneOff, planned] = await Promise.all([
    tx
      .select({ jobId: jobs.id, quote: quotes, option: quoteOptions })
      .from(jobs)
      .innerJoin(
        quotes,
        and(eq(quotes.jobId, jobs.id), eq(quotes.kind, "one_off")),
      )
      .innerJoin(
        quoteOptions,
        and(
          eq(quoteOptions.quoteId, quotes.id),
          eq(quoteOptions.cleanType, quotes.acceptedCleanType),
        ),
      )
      .where(inArray(jobs.id, jobIds)),
    tx
      .select({
        jobId: servicePlanVisits.jobId,
        quote: quotes,
        option: quoteOptions,
      })
      .from(servicePlanVisits)
      .innerJoin(quotes, eq(quotes.id, servicePlanVisits.quoteId))
      .innerJoin(
        quoteOptions,
        and(
          eq(quoteOptions.quoteId, quotes.id),
          eq(quoteOptions.position, servicePlanVisits.position),
        ),
      )
      .where(inArray(servicePlanVisits.jobId, jobIds)),
  ]);
  return [...oneOff, ...planned.map((row) => ({ ...row, jobId: row.jobId! }))];
};
