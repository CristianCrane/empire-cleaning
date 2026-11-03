import { emailOpenPlaces } from "#features/assignments";
import { chaseBills, makeDueBills } from "#features/bills";
import {
  chaseProposedAdjustments,
  sendDueReviewRequests,
} from "#features/completion";
import { sendDueReminders } from "#features/jobs";
import { settleOpenPayments } from "#features/payments";
import { generateServicePlanJobs } from "#features/service-plans";
import { monitoring } from "#services/monitoring";

export type ScheduledJob = { name: string; run: () => Promise<unknown> };

// day-before reminders go out from 8am; looking every 10 minutes sends them
// soon after, and running twice (or on two servers) sends nothing twice
export const TICK_MS = 10 * 60 * 1000;

// and so do reminders and lapses of increases proposed to Clients, and
// Service Plans' Jobs coming within reach of the Schedule, each Monday's
// weekly Bills, reminders for Bills paid on their page and those late, and
// Open Places for Cleaners: each morning from 7am, and soon ones at once;
// and Google review requests, the day after a Client's first clean; and
// payments the provider never answered, a quarter of an hour on
const scheduledJobs: ScheduledJob[] = [
  { name: "reminders", run: sendDueReminders },
  { name: "proposed Adjustments", run: chaseProposedAdjustments },
  { name: "Service Plan Jobs", run: () => generateServicePlanJobs() },
  { name: "weekly Bills", run: makeDueBills },
  { name: "Bill chasing", run: chaseBills },
  { name: "Open Places", run: emailOpenPlaces },
  { name: "review requests", run: sendDueReviewRequests },
  { name: "open payments", run: settleOpenPayments },
];

// runs every job at once; one failing doesn't stop the others. The heartbeat
// checks in only when all of them succeeded, so a failing job is noticed like
// a stopped timer (ADR-0007), and the error says which
export const tick = async (jobs: ScheduledJob[] = scheduledJobs) => {
  const results = await Promise.allSettled(jobs.map((job) => job.run()));
  let allSucceeded = true;
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      allSucceeded = false;
      monitoring.error(result.reason, { job: jobs[i]!.name });
    }
  });
  if (allSucceeded) monitoring.heartbeat();
};
