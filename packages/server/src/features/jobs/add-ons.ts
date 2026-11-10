import type { Language } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { addOnNamesIn } from "../price-list/price-list.ts";
import { jobQuotes } from "../quotes/job-quotes.ts";

// the names of the Add-ons on each Job, from the Quote option its Client
// accepted (its Service Plan's, for a plan Job), as a reader of `lang` reads
// them (ADR-0025); none for a Job no Quote booked
export const addOnsOf = async (jobIds: string[], lang: Language) => {
  const byJob = new Map(jobIds.map((id) => [id, [] as string[]]));
  if (jobIds.length === 0) return byJob;
  const [rows, nameOf] = await Promise.all([
    jobQuotes(jobIds, db),
    addOnNamesIn(lang),
  ]);
  for (const { jobId, option } of rows) {
    byJob.set(jobId, option.suggested.addOns.map(nameOf));
  }
  return byJob;
};
