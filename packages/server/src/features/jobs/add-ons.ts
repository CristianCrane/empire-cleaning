import { db } from "../../db/index.ts";
import { jobQuotes } from "../quotes/job-quotes.ts";

// the names of the Add-ons on each Job, from the Quote option its Client
// accepted (its Service Plan's, for a plan Job); none for a Job no Quote
// booked
export const addOnsOf = async (jobIds: string[]) => {
  const byJob = new Map(jobIds.map((id) => [id, [] as string[]]));
  if (jobIds.length === 0) return byJob;
  const rows = await jobQuotes(jobIds, db);
  for (const { jobId, option } of rows) {
    byJob.set(
      jobId,
      option.suggested.addOns.map((a) => a.name),
    );
  }
  return byJob;
};
