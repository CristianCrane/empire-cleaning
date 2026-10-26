import { inArray } from "drizzle-orm";
import type { NeedsAttentionItem, ScheduledJob } from "@empire-cleaning/models";
import { unassignedJobsWithin } from "../assignments/assignments.ts";
import {
  jobsWithReportedAdjustments,
  unpaidJobs,
} from "../completion/completion.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { jobViews } from "../jobs/schedule.ts";
import { quoteRequestsAwaitingQuote } from "../quote-requests/quote-requests.ts";
import { noRoomSince, quotesWithoutRoom } from "../quotes/quote-room.ts";
import {
  quotesExpiringWithin,
  servicePlansDue,
} from "../quotes/quote-state.ts";
import { pendingRescheduleRequests } from "../reschedule/reschedule.ts";
import { unplacedVisits } from "../service-plans/service-plans.ts";

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
    (ids.length === 0 ? [] : await jobViews(inArray(jobs.id, ids))).map(
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

// pending Reschedule Requests, earliest asked first: the Client is waiting,
// and the new time's hours are held until the Office answers
const rescheduleRequests: Source = async () => {
  const pending = await pendingRescheduleRequests();
  const byId = await jobsById(pending.map((p) => p.jobId));
  return pending.map(({ jobId, request }) => ({
    kind: "reschedule_requested",
    since: request.requestedAt,
    job: byId.get(jobId)!,
    request,
  }));
};

// homes whose First Clean is done, for Clients who wanted regular visits and
// haven't been offered a Service Plan yet, earliest done first
const servicePlansDueSource: Source = async () => {
  const due = await servicePlansDue();
  const byId = await jobsById(due.map((d) => d.jobId));
  return due.map(({ jobId, since }) => ({
    kind: "service_plan_due",
    since: since.toISOString(),
    job: byId.get(jobId)!,
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

// dates Service Plans came round with no room, soonest due first: the Office
// books each at another time with the Client, or skips it
const unplacedVisitsSource: Source = async () =>
  (await unplacedVisits()).map(({ visit, plan }) => ({
    kind: "plan_visit_unplaced",
    since: visit.since,
    plan,
    visit,
  }));

// Where each kind of item comes from, in the order the Office should deal
// with them. A ticket adding a kind adds its type to NeedsAttentionItem and
// its source here; each source returns its own items in the order to deal
// with them.
const sources: Source[] = [
  unassignedJobs,
  rescheduleRequests,
  unplacedVisitsSource,
  unpaidJobsSource,
  reportedAdjustments,
  quotesWithoutRoomSource,
  quoteRequests,
  servicePlansDueSource,
  expiringQuotes,
];

// everything waiting on the Office, a kind at a time
export const needsAttention = async (): Promise<NeedsAttentionItem[]> =>
  (await Promise.all(sources.map((source) => source()))).flat();
