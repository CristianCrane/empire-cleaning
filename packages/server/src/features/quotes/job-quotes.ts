import { and, eq, inArray, or } from "drizzle-orm";
import { db, type Tx } from "../../db/index.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { servicePlanVisits } from "../service-plans/service-plans.schema.ts";
import { quoteOptions, quotes } from "./quotes.schema.ts";

// The Quote each Job is priced from, with the option its Client accepted: the
// one-off Quote that booked it, or, for a Service Plan's Job, the plan's
// Quote whose terms its visit was generated on (which booked the first Job on
// those terms too, so that one matches once).
export const jobQuotes = (jobIds: string[], tx: Tx | typeof db = db) =>
  tx
    .select({ jobId: jobs.id, quote: quotes, option: quoteOptions })
    .from(jobs)
    .leftJoin(servicePlanVisits, eq(servicePlanVisits.jobId, jobs.id))
    .innerJoin(
      quotes,
      or(eq(quotes.jobId, jobs.id), eq(quotes.id, servicePlanVisits.quoteId)),
    )
    .innerJoin(
      quoteOptions,
      and(
        eq(quoteOptions.quoteId, quotes.id),
        eq(quoteOptions.cleanType, quotes.acceptedCleanType),
      ),
    )
    .where(inArray(jobs.id, jobIds));
