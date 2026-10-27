import { and, desc, eq, gte, inArray, isNull, ne, sum } from "drizzle-orm";
import type { PlanChange } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError } from "../../middleware/errors.ts";
import { clock, dayOf } from "../../services/clock/index.ts";
import { tellCrew } from "../cancellation/cancellation.ts";
import { settleJob } from "../completion/balance.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { charges } from "../payments/payments.schema.ts";
import type { Quote } from "../quotes/quotes.schema.ts";
import {
  servicePlans,
  servicePlanVisits,
  type ServicePlan,
} from "./service-plans.schema.ts";
import { recordFirstVisits, type FirstJobs } from "./first-visits.ts";

// the plan's booked Jobs from `startsAt` on, latest first
const bookedFrom = async (tx: Tx | typeof db, planId: string, startsAt: Date) =>
  (
    await tx
      .select({ job: jobs })
      .from(servicePlanVisits)
      .innerJoin(jobs, eq(jobs.id, servicePlanVisits.jobId))
      .where(
        and(
          eq(servicePlanVisits.servicePlanId, planId),
          eq(jobs.status, "booked"),
          gte(jobs.startsAt, startsAt),
        ),
      )
      .orderBy(desc(jobs.startsAt))
  ).map((r) => r.job);

// the booked Jobs a plan's new terms starting at `startsAt` would replace,
// soonest first, as a Quote changing them shows them
export const replacedBy = async (planId: string, startsAt: Date) =>
  (await bookedFrom(db, planId, startsAt)).reverse();

/**
 * Holds a plan whose terms are changing from `startsAt`, inside the
 * acceptance's transaction, with its booked Jobs from then on, which the new
 * terms replace: the Jobs first, then the plan, in the order settling a
 * Job's money and Ending hold them, so they never wait on each other.
 */
export const holdForChange = async (
  tx: Tx,
  planId: string,
  startsAt: Date,
): Promise<{ plan: ServicePlan; replaced: Job[] }> => {
  const ids = (await bookedFrom(tx, planId, startsAt)).map((j) => j.id);
  const replaced =
    ids.length === 0
      ? []
      : await tx
          .select()
          .from(jobs)
          .where(inArray(jobs.id, ids))
          .orderBy(desc(jobs.startsAt))
          .for("update");
  const [plan] = await tx
    .select()
    .from(servicePlans)
    .where(eq(servicePlans.id, planId))
    .for("update");
  // generating may have booked one in between
  const now = (await bookedFrom(tx, planId, startsAt)).map((j) => j.id);
  if (now.join() !== ids.join()) {
    throw new ConflictError("Something changed just then. Please try again.");
  }
  return { plan: plan!, replaced };
};

/**
 * Puts a plan on an accepted Service Plan Quote's terms, inside the
 * acceptance's transaction, once the first Job on each of its weekdays is
 * booked, the earliest at the Quote's proposed time: its booked Jobs from
 * then on (held by holdForChange) are cancelled free, and dates from then on
 * still waiting for the Office are dropped. Jobs before it go ahead, priced
 * as they were. The new terms may have more weekdays or fewer. Its Deposit
 * stays as it is, and so does its status: a plan On Hold carries on, on the
 * new terms, once nothing is Unpaid.
 */
export const changeServicePlanTerms = async (
  tx: Tx,
  {
    plan,
    replaced,
    quote,
    firstJobs,
    changedBy,
  }: {
    plan: ServicePlan;
    replaced: Job[];
    quote: Quote;
    firstJobs: FirstJobs;
    changedBy: string | null;
  },
) => {
  const from = quote.proposedStartsAt!;
  const now = clock.now();
  for (const job of replaced) {
    await tx
      .update(jobs)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: "client",
        cancelledByAccount: changedBy,
        lateCancellation: false,
        cancellationReason: "The Service Plan's terms changed",
        // a fee a Late Reschedule made due stays due, as when skipping
        feeCents: job.rescheduleFeeCents,
      })
      .where(eq(jobs.id, job.id));
  }
  await tx
    .update(servicePlanVisits)
    .set({ skippedAt: now })
    .where(
      and(
        eq(servicePlanVisits.servicePlanId, plan.id),
        isNull(servicePlanVisits.jobId),
        isNull(servicePlanVisits.skippedAt),
        gte(servicePlanVisits.dueOn, dayOf(from)),
      ),
    );
  const [changed] = await tx
    .update(servicePlans)
    .set({ quoteId: quote.id, recurrence: quote.recurrence! })
    .where(eq(servicePlans.id, plan.id))
    .returning();
  await recordFirstVisits(tx, plan.id, quote, firstJobs);
  return changed!;
};

// once the change is saved: a fee a replaced Job owes is charged, and its
// crew hear it's off
export const afterTermsChanged = async (replaced: Job[]) => {
  for (const job of replaced) {
    if (job.rescheduleFeeCents > 0) await settleJob(job.id);
  }
  for (const job of replaced) await tellCrew(job);
};

/**
 * What accepting a Service Plan Quote for the home would do to its plan,
 * while the Quote is a Draft or Sent: null if the home has no plan, so the
 * Quote would start one. Its booked Jobs from `startsAt` on would be
 * replaced (none while a Draft has no time yet), and its Deposit carries
 * over.
 */
export const planChangeOf = async (
  propertyId: string,
  startsAt: Date | null,
): Promise<PlanChange | null> => {
  const plan = await currentPlanIdOf(propertyId);
  if (!plan) return null;
  const [replaced, [deposit]] = await Promise.all([
    startsAt ? replacedBy(plan.id, startsAt) : [],
    db
      .select({ cents: sum(charges.amountCents).mapWith(Number) })
      .from(charges)
      .where(
        and(eq(charges.servicePlanId, plan.id), eq(charges.kind, "deposit")),
      ),
  ]);
  return {
    servicePlanId: plan.id,
    depositCents: deposit?.cents ?? 0,
    replaces: replaced.map((j) => j.startsAt.toISOString()),
  };
};

// the home's plan that hasn't Ended, if it has one
const currentPlanIdOf = async (propertyId: string) => {
  const [plan] = await db
    .select({ id: servicePlans.id })
    .from(servicePlans)
    .where(
      and(
        eq(servicePlans.propertyId, propertyId),
        ne(servicePlans.status, "ended"),
      ),
    );
  return plan;
};

// the Jobs a Service Plan Quote for the home, starting at `startsAt`, would
// replace, which don't count against its room: its plan's booked Jobs from
// then on, or none if it has no plan
export const jobsReplacedAt = async (propertyId: string, startsAt: Date) => {
  const plan = await currentPlanIdOf(propertyId);
  if (!plan) return [];
  return (await replacedBy(plan.id, startsAt)).map((j) => j.id);
};
