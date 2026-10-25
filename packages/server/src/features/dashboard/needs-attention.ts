import { inArray } from "drizzle-orm";
import type { NeedsAttentionItem, ScheduledJob } from "@empire-cleaning/models";
import { unassignedJobsWithin } from "../assignments/assignments.ts";
import {
  jobsWithReportedAdjustments,
  unpaidJobs,
} from "../completion/completion.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { scheduledJobs } from "../jobs/schedule.ts";
import { quoteRequestsAwaitingQuote } from "../quote-requests/quote-requests.ts";
import { noRoomSince, quotesWithoutRoom } from "../quotes/quote-room.ts";
import { quotesExpiringWithin } from "../quotes/quote-state.ts";

type Source = () => Promise<NeedsAttentionItem[]>;

const quoteRequests: Source = async () =>
  (await quoteRequestsAwaitingQuote()).map((quoteRequest) => ({
    kind: "quote_request",
    since: quoteRequest.createdAt,
    quoteRequest,
  }));

// booked Jobs within 48 hours whose places aren't all Confirmed, soonest
// first: someone has to be found for them
const unassignedJobs: Source = async () =>
  (await unassignedJobsWithin(48)).map(({ job, since }) => ({
    kind: "job_unassigned",
    since,
    job,
  }));

// the Schedule's view of these Jobs, by id
const jobsById = async (ids: string[]) =>
  new Map(
    (ids.length === 0 ? [] : await scheduledJobs(inArray(jobs.id, ids))).map(
      (job): [string, ScheduledJob] => [job.id, job],
    ),
  );

// Completed Jobs whose Balance couldn't be charged, longest Unpaid first:
// the Office chases them
const unpaidJobsSource: Source = async () => {
  const unpaid = await unpaidJobs();
  const byId = await jobsById(unpaid.map((u) => u.jobId));
  return unpaid.map(({ jobId, since, owedCents, reason }) => ({
    kind: "job_unpaid",
    since,
    job: byId.get(jobId)!,
    owedCents,
    reason,
  }));
};

// Completed Jobs with increases reported by their Cleaner, earliest first:
// the Office proposes them to the Client or dismisses them
const reportedAdjustments: Source = async () => {
  const reported = await jobsWithReportedAdjustments();
  const byId = await jobsById(reported.map((r) => r.jobId));
  return reported.map(({ jobId, since, count }) => ({
    kind: "adjustments_reported",
    since,
    job: byId.get(jobId)!,
    count,
  }));
};

// Sent Quotes Expiring within 48 hours, soonest first; each counts from when
// it came within 48 hours
const EXPIRING_HOURS = 48;
const expiringQuotes: Source = async () =>
  (await quotesExpiringWithin(EXPIRING_HOURS)).map((quote) => ({
    kind: "quote_expiring",
    since: new Date(
      Math.max(
        Date.parse(quote.sentAt!),
        Date.parse(quote.expiresAt!) - EXPIRING_HOURS * 3_600_000,
      ),
    ).toISOString(),
    quote,
  }));

// Sent Quotes whose day has filled up under them, soonest proposed first:
// their Clients can't accept them, so they need another time
const quotesWithoutRoomSource: Source = async () =>
  Promise.all(
    (await quotesWithoutRoom()).map(async (quote) => ({
      kind: "quote_no_room" as const,
      since: await noRoomSince(quote),
      quote,
    })),
  );

// Where each kind of item comes from, in the order the Office should deal
// with them. A ticket adding a kind adds its type to NeedsAttentionItem and
// its source here; each source returns its own items in the order to deal
// with them.
const sources: Source[] = [
  unassignedJobs,
  unpaidJobsSource,
  reportedAdjustments,
  quotesWithoutRoomSource,
  quoteRequests,
  expiringQuotes,
];

// everything waiting on the Office, a kind at a time
export const needsAttention = async (): Promise<NeedsAttentionItem[]> =>
  (await Promise.all(sources.map((source) => source()))).flat();
