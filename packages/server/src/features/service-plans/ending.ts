import { and, desc, eq, inArray, sum } from "drizzle-orm";
import type { EndPlanTerms } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock } from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import {
  CANCELLATION_CUTOFF_HOURS,
  tellCrew,
} from "../cancellation/cancellation.ts";
import { clients } from "../clients/clients.schema.ts";
import { settleJob, type Settled } from "../completion/balance.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { charges } from "../payments/payments.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { officeStaffEmails } from "../staff/staff.ts";
import { officePlanEndedEmail, planEndedEmail } from "./emails.ts";
import {
  servicePlans,
  servicePlanVisits,
  type ServicePlan,
} from "./service-plans.schema.ts";

const HOUR_MS = 3_600_000;

// a plan's Jobs, latest first
const jobsOf = async (tx: Tx | typeof db, planId: string) =>
  (
    await tx
      .select({ job: jobs })
      .from(servicePlanVisits)
      .innerJoin(jobs, eq(jobs.id, servicePlanVisits.jobId))
      .where(eq(servicePlanVisits.servicePlanId, planId))
      .orderBy(desc(jobs.startsAt))
  ).map((r) => r.job);

// the Deposit the plan holds
const heldDepositOf = async (tx: Tx | typeof db, planId: string) => {
  const [row] = await tx
    .select({ cents: sum(charges.amountCents).mapWith(Number) })
    .from(charges)
    .where(and(eq(charges.servicePlanId, planId), eq(charges.kind, "deposit")));
  return row?.cents ?? 0;
};

// What Ending does to the plan's Jobs, by the Clock: the booked ones more
// than 24 hours out are cancelled, as skipping them would be free; the rest
// go ahead. The final Job is the latest that goes ahead or has happened, a
// fee counting as having happened, so the Deposit pays what's owed first;
// or failing that the latest of all: a plan always has its first.
const planOf = (planJobs: Job[]) => {
  const now = clock.now().getTime();
  const cancelled = planJobs.filter(
    (j) =>
      j.status === "booked" &&
      j.startsAt.getTime() - CANCELLATION_CUTOFF_HOURS * HOUR_MS > now,
  );
  const goingAhead = planJobs.filter(
    (j) => j.status === "booked" && !cancelled.includes(j),
  );
  const happened = (j: Job) =>
    !cancelled.includes(j) &&
    (j.status !== "cancelled" || (j.feeCents ?? 0) > 0);
  const finalJob = planJobs.find(happened) ?? planJobs[0]!;
  return { cancelled, goingAhead, finalJob, freeToo: !happened(finalJob) };
};

const toTerms = (
  { cancelled, goingAhead, finalJob, freeToo }: ReturnType<typeof planOf>,
  depositCents: number,
): EndPlanTerms => ({
  cancelled: cancelled.map((j) => j.startsAt.toISOString()).reverse(),
  goingAhead: goingAhead.map((j) => j.startsAt.toISOString()).reverse(),
  depositCents,
  deposit:
    finalJob.status === "booked" && !freeToo
      ? "comes_off"
      : freeToo
        ? "refunded"
        : "goes_towards",
  // as it will be once Ended
  finalJob: {
    id: finalJob.id,
    startsAt: finalJob.startsAt.toISOString(),
    status: cancelled.includes(finalJob) ? "cancelled" : finalJob.status,
  },
});

// what Ending the plan would do now; null once it has Ended
export const endTermsOf = async (
  plan: ServicePlan,
): Promise<EndPlanTerms | null> => {
  if (plan.status === "ended") return null;
  const [planJobs, depositCents] = await Promise.all([
    jobsOf(db, plan.id),
    heldDepositOf(db, plan.id),
  ]);
  return toTerms(planOf(planJobs), depositCents);
};

type Ending = {
  // the Jobs going ahead that the person Ending it was shown, by when they
  // start
  goingAhead: string[];
  byAccountId: string;
  // the Client themselves, in the portal, rather than Office Staff
  byClient: boolean;
};

/**
 * Ends a Service Plan, for good: its booked Jobs more than 24 hours out are
 * cancelled free, and those within 24 hours go ahead. Its Deposit becomes
 * its final Job's own, counting towards that Job's price as a one-off Job's
 * Deposit does: if that Job has already happened, what it doesn't need is
 * refunded now. It never generates Jobs again, and its Property may start
 * another plan. Refused if the Jobs going ahead aren't what the person
 * Ending it was shown, as when one has come within 24 hours since.
 *
 * The Client is emailed, and so is the crew of each Job cancelled; the
 * Office is too when the Client Ended it themselves.
 */
export const endServicePlan = async (planId: string, ending: Ending) => {
  const ended = await db.transaction(async (tx) => {
    // its Jobs held before the plan, in the order settling a Job's money
    // holds them, so the two never wait on each other
    const ids = (await jobsOf(tx, planId)).map((j) => j.id);
    const planJobs =
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
    if (!plan) throw new NotFoundError("Service Plan not found");
    if (plan.status === "ended") {
      throw new ConflictError("This Service Plan has already Ended.");
    }
    // generating may have booked one in between
    if ((await jobsOf(tx, planId)).length !== ids.length) {
      throw new ConflictError("Something changed just then. Please try again.");
    }
    const what = planOf(planJobs);
    const terms = toTerms(what, await heldDepositOf(tx, planId));
    if (terms.goingAhead.join() !== [...ending.goingAhead].sort().join()) {
      throw new ConflictError(
        "Something has changed since you looked: a clean is now less than 24 hours away, so it goes ahead. Please check and confirm again.",
      );
    }

    const now = clock.now();
    for (const job of what.cancelled) {
      await tx
        .update(jobs)
        .set({
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: "client",
          cancelledByAccount: ending.byAccountId,
          lateCancellation: false,
          cancellationReason: "The Service Plan Ended",
          // a fee a Late Reschedule made due stays due, as when skipping
          feeCents: job.rescheduleFeeCents,
        })
        .where(eq(jobs.id, job.id));
    }
    await tx
      .update(charges)
      .set({ jobId: what.finalJob.id, servicePlanId: null })
      .where(
        and(eq(charges.servicePlanId, planId), eq(charges.kind, "deposit")),
      );
    await tx
      .update(servicePlans)
      .set({ status: "ended", endedAt: now, endedBy: ending.byAccountId })
      .where(eq(servicePlans.id, planId));
    return { plan, ...what, terms };
  });

  for (const job of ended.cancelled) {
    if (job.rescheduleFeeCents > 0) await settleJob(job.id);
  }
  const settled = await settleJob(ended.finalJob.id);
  for (const job of ended.cancelled) await tellCrew(job);
  await tellClient(ended.plan, ended.terms, settled);
  if (ending.byClient) await tellOffice(ended.plan, ended.terms);
};

// emails go out after the change is saved; one that fails is logged, and the
// change stands
const notify = async (what: string, send: () => Promise<void>) => {
  try {
    await send();
  } catch (error) {
    console.error(`${what} not sent:`, error);
  }
};

const ownerOf = async (plan: ServicePlan) => {
  const [found] = await db
    .select({ property: properties, client: clients })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, plan.propertyId));
  return found!;
};

const tellClient = async (
  plan: ServicePlan,
  terms: EndPlanTerms,
  settled: Settled,
) => {
  const { property, client } = await ownerOf(plan);
  await notify(`End of Service Plan ${plan.id} notice`, () =>
    email.send({
      to: client.email,
      ...planEndedEmail({
        name: client.name,
        address: addressOf(property),
        planId: plan.id,
        terms,
        settled,
        cutoffHours: CANCELLATION_CUTOFF_HOURS,
      }),
    }),
  );
};

// the Office hears when a Client Ends their plan themselves
const tellOffice = async (plan: ServicePlan, terms: EndPlanTerms) => {
  const { property, client } = await ownerOf(plan);
  await notify(`End of Service Plan ${plan.id} to the Office`, async () => {
    for (const to of await officeStaffEmails()) {
      await email.send({
        to,
        ...officePlanEndedEmail({
          client: client.name,
          address: addressOf(property),
          planId: plan.id,
          terms,
        }),
      });
    }
  });
};
