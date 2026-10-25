import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { quoteOptions, quotes } from "../quotes/quotes.schema.ts";

// the names of the Add-ons on each Job, from the Quote option its Client
// accepted; none for a Job no Quote booked
export const addOnsOf = async (jobIds: string[]) => {
  const byJob = new Map(jobIds.map((id) => [id, [] as string[]]));
  if (jobIds.length === 0) return byJob;
  const rows = await db
    .select({ jobId: quotes.jobId, suggested: quoteOptions.suggested })
    .from(quotes)
    .innerJoin(
      quoteOptions,
      and(
        eq(quoteOptions.quoteId, quotes.id),
        eq(quoteOptions.cleanType, quotes.acceptedCleanType),
      ),
    )
    .where(inArray(quotes.jobId, jobIds));
  for (const { jobId, suggested } of rows) {
    byJob.set(
      jobId!,
      suggested.addOns.map((a) => a.name),
    );
  }
  return byJob;
};
