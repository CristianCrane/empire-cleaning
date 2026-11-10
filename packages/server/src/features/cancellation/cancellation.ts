import { and, eq, isNull, ne, sum } from "drizzle-orm";
import {
  CANCELLATION_CUTOFF_HOURS,
  catalog,
  type CancellationTerms,
  type CancelledBy,
  HOUR_MS,
  type JobCancellation,
  type JobNoAccess,
} from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock } from "../../services/clock/index.ts";
import { email, notify } from "../../services/email/index.ts";
import { assignments, onCrew } from "../assignments/assignments.schema.ts";
import { mustBeConfirmed, notStarted } from "../assignments/crew.ts";
import { clients } from "../clients/clients.schema.ts";
import {
  paymentOf,
  settleAfterChange,
  type Settled,
} from "../completion/balance.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { callUs, whyNotBooked, whyStarted } from "../jobs/rules.ts";
import { closePendingRequests } from "../reschedule/closing.ts";
import { charges, refunds } from "../payments/payments.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { jobQuotes } from "../quotes/job-quotes.ts";
import { percentOf } from "../quotes/plan-days.ts";
import {
  servicePlans,
  servicePlanVisits,
} from "../service-plans/service-plans.schema.ts";
import { staff } from "../staff/staff.schema.ts";
import { tellOfficeStaff } from "../staff/staff.ts";
import { cleanOf } from "../services/services.ts";
import {
  cancelledEmail,
  crewCancelledEmail,
  noAccessEmail,
  officeCancelledEmail,
  officeNoAccessEmail,
} from "./emails.ts";

// what changed while a Client looked, such as the cost of cancelling: the
// page reloads to show it. In the request's language (ADR-0025)
const changedWords = catalog({
  en: {
    CHANGED_SINCE:
      "Something changed just then. Please check it and try again.",
  },
  es: {
    CHANGED_SINCE:
      "Algo cambió en este momento. Revíselo y vuelva a intentarlo.",
  },
});
export const changedSince = () => changedWords[currentLanguage()].CHANGED_SINCE;

// when a clean starting then enters the Late Cancellation window
export const lateFrom = (startsAt: Date) =>
  new Date(startsAt.getTime() - CANCELLATION_CUTOFF_HOURS * HOUR_MS);

// Until when cancelling a Job is free: 24 hours before it (ADR-0010). A plan
// Job booked later than that is free to skip until it starts, as the Client
// had less than a day's notice of it (#242).
export const freeUntilOf = (
  job: Pick<Job, "startsAt" | "bookedAt">,
  onPlan: boolean,
) => {
  const cutoff = lateFrom(job.startsAt);
  return onPlan && job.bookedAt > cutoff ? job.startsAt : cutoff;
};

// the Deposit taken for a Job, which a Late Cancellation or No Access keeps
// as its fee
const depositOf = async (jobId: string, tx: Tx | typeof db = db) => {
  const [row] = await tx
    .select({ cents: sum(charges.amountCents).mapWith(Number) })
    .from(charges)
    .where(and(eq(charges.jobId, jobId), eq(charges.kind, "deposit")));
  return row?.cents ?? 0;
};

// The Service Plan a Job was generated for; null for a one-off Job, or once
// its plan has Ended: then its last Job holds the plan's Deposit as its own,
// and goes ahead as a one-off Job would.
export const planOfJob = async (jobId: string, tx: Tx | typeof db = db) => {
  const [visit] = await tx
    .select({ planId: servicePlanVisits.servicePlanId })
    .from(servicePlanVisits)
    .innerJoin(
      servicePlans,
      eq(servicePlans.id, servicePlanVisits.servicePlanId),
    )
    .where(
      and(eq(servicePlanVisits.jobId, jobId), ne(servicePlans.status, "ended")),
    );
  return visit?.planId ?? null;
};

/**
 * The fee for a Late Cancellation or No Access of a Job, or a second Late
 * Reschedule of it: the Deposit amount. A one-off Job's own Deposit is kept
 * as the fee. A plan Job has none of its own, so the fee is the Deposit
 * percentage of its own price, as its Quote set them, charged afresh; the
 * plan's held Deposit is untouched (ADR-0013). So it stays once the plan
 * has Ended, for its Jobs going ahead: the final Job's fee comes out of the
 * plan's Deposit it now holds, and the rest is refunded (#241).
 */
export const lateFeeOf = async (jobId: string, tx: Tx | typeof db = db) => {
  const [visit] = await tx
    .select({ planId: servicePlanVisits.servicePlanId })
    .from(servicePlanVisits)
    .where(eq(servicePlanVisits.jobId, jobId));
  if (!visit) return depositOf(jobId, tx);
  const [{ revision, option }] = (await jobQuotes([jobId], tx)) as [
    Awaited<ReturnType<typeof jobQuotes>>[number],
  ];
  return percentOf(option.totalCents, revision.depositPercent);
};

// what has been taken for a Job, less refunds; and what those made in the
// provider's dashboard took off what it owes, as settling counts them
const paidOf = async (jobId: string) => {
  const [[taken], given] = await Promise.all([
    db
      .select({ cents: sum(charges.amountCents).mapWith(Number) })
      .from(charges)
      .where(eq(charges.jobId, jobId)),
    db
      .select({
        atProvider: refunds.atProvider,
        cents: sum(refunds.amountCents).mapWith(Number),
      })
      .from(refunds)
      .innerJoin(charges, eq(charges.id, refunds.chargeId))
      .where(and(eq(charges.jobId, jobId), isNull(refunds.failedAt)))
      .groupBy(refunds.atProvider),
  ]);
  const refunded = (atProvider: boolean) =>
    given.find((g) => g.atProvider === atProvider)?.cents ?? 0;
  return {
    paidCents: (taken?.cents ?? 0) - refunded(false) - refunded(true),
    refundedAtProviderCents: refunded(true),
  };
};

// what cancelling a Job costs, by the Clock: the Late Cancellation fee, if
// the Client cancels less than 24 hours before it starts (freeUntilOf);
// nothing otherwise. A fee already due for a Late Reschedule (ADR-0010) stays
// due, however early the Client cancels, but nothing more is charged.
const feeOf = (
  job: Job,
  onPlan: boolean,
  by: CancelledBy,
  lateFeeCents: number,
) => {
  const late = by === "client" && clock.now() > freeUntilOf(job, onPlan);
  const kept = by === "client" ? job.rescheduleFeeCents : 0;
  return { late, feeCents: Math.max(late ? lateFeeCents : 0, kept) };
};

/**
 * What cancelling a booked Job would cost now, either way: the Client's
 * (themselves or through the Office) and Empire Cleaning's. Null once it
 * isn't booked.
 */
export const cancelTermsOf = async (
  job: Job,
): Promise<Record<CancelledBy, CancellationTerms> | null> => {
  if (job.status !== "booked") return null;
  const [lateFeeCents, { paidCents, refundedAtProviderCents }, plan] =
    await Promise.all([lateFeeOf(job.id), paidOf(job.id), planOfJob(job.id)]);
  const onPlan = plan !== null;
  const terms = (by: CancelledBy): CancellationTerms => {
    const { late, feeCents } = feeOf(job, onPlan, by, lateFeeCents);
    return {
      by,
      late,
      feeCents,
      refundCents: Math.max(
        paidCents - Math.max(feeCents - refundedAtProviderCents, 0),
        0,
      ),
      freeUntil: freeUntilOf(job, onPlan).toISOString(),
    };
  };
  return { client: terms("client"), empire: terms("empire") };
};

// ---- cancelling ----

type Cancellation = {
  by: CancelledBy;
  // the fee the person cancelling was shown
  feeCents: number;
  reason: string | null;
  byAccountId: string;
  // the Client themselves, in the portal, rather than Office Staff
  byClient: boolean;
};

/**
 * Cancels a booked Job: it leaves the Schedule, and the Client is refunded
 * their Deposit unless it was a Late Cancellation, which keeps it as the fee.
 * Cancelling a plan Job skips it, and the plan carries on; a Late
 * Cancellation of one charges its fee now, and if that fails the Job is
 * Unpaid. Refused if what it costs isn't what the person cancelling was shown, as
 * when the 24-hour cut-off has passed since. A Client can't cancel once it
 * has started; Office Staff can.
 *
 * The Client is emailed, and so is everyone on its crew; the
 * Office is too when the Client cancelled it themselves.
 */
export const cancelJob = async (jobId: string, cancellation: Cancellation) => {
  const { job, late, feeCents } = await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for("update");
    if (!job) throw new NotFoundError("Job not found");
    if (job.status !== "booked") {
      throw new ConflictError(whyNotBooked(job.status, "cancelled"));
    }
    if (cancellation.byClient && job.startsAt <= clock.now()) {
      throw new ConflictError(`${whyStarted("cancelled")} ${callUs()}`);
    }

    const onPlan = (await planOfJob(jobId, tx)) !== null;
    const { late, feeCents } = feeOf(
      job,
      onPlan,
      cancellation.by,
      await lateFeeOf(jobId, tx),
    );
    if (feeCents !== cancellation.feeCents) {
      throw new ConflictError(changedSince());
    }

    await tx
      .update(jobs)
      .set({
        status: "cancelled",
        cancelledAt: clock.now(),
        cancelledBy: cancellation.by,
        cancelledByAccount: cancellation.byAccountId,
        lateCancellation: late,
        // a reason is ours to give; the Client's own cancellation has none
        cancellationReason:
          cancellation.by === "empire" ? cancellation.reason : null,
        feeCents,
      })
      .where(eq(jobs.id, jobId));
    await closePendingRequests(tx, [jobId]);
    return { job, late, feeCents };
  });

  const settled = await settleAfterChange(jobId);
  const onPlan = (await planOfJob(jobId)) !== null;
  await sendCancelled(jobId, settled, onPlan);
  await tellCrew(job);
  if (cancellation.byClient) {
    await tellOffice(job, { late, feeCents, onPlan, settled });
  }
};

const ownerOf = async (job: Job) => {
  const [found] = await db
    .select({ property: properties, client: clients })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, job.propertyId));
  return found!;
};

const sendCancelled = async (
  jobId: string,
  settled: Settled,
  onPlan: boolean,
) => {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const { property, client } = await ownerOf(job!);
  await notify(`Cancellation notice for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      ...cancelledEmail(client.preferredLanguage, {
        name: client.name,
        jobId,
        clean: await cleanOf(job!, property),
        by: job!.cancelledBy === "empire" ? "empire" : "client",
        reason: job!.cancellationReason,
        onPlan,
        late: job!.lateCancellation ?? false,
        feeCents: job!.feeCents ?? 0,
        settled,
      }),
    }),
  );
};

// everyone on a Job's crew hears it's off
export const tellCrew = async (job: Job) => {
  const { property } = await ownerOf(job);
  const crew = await db
    .select({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      preferredLanguage: staff.preferredLanguage,
    })
    .from(assignments)
    .innerJoin(staff, eq(staff.id, assignments.staffId))
    .where(and(eq(assignments.jobId, job.id), onCrew()));
  for (const member of crew) {
    await notify(
      `Cancellation of Job ${job.id} to Staff ${member.id}`,
      async () =>
        email.send({
          to: member.email,
          ...crewCancelledEmail(member.preferredLanguage, {
            name: member.name,
            clean: await cleanOf(job, property),
          }),
        }),
    );
  }
};

// the Office hears when a Client cancels a Job themselves
const tellOffice = async (
  job: Job,
  {
    late,
    feeCents,
    onPlan,
    settled,
  }: { late: boolean; feeCents: number; onPlan: boolean; settled: Settled },
) => {
  const { property, client } = await ownerOf(job);
  await tellOfficeStaff(
    `Cancellation of Job ${job.id} to the Office`,
    async () =>
      officeCancelledEmail({
        client: client.name,
        jobId: job.id,
        clean: await cleanOf(job, property),
        onPlan,
        late,
        feeCents,
        settled,
      }),
  );
};

// ---- No Access ----

/**
 * The assigned Cleaner records that they couldn't get into the Property,
 * saying what happened. The Job isn't Completed and is charged like a Late
 * Cancellation: the Deposit is kept as the fee, or for a plan Job, the fee
 * is charged now. The Client and the Office are emailed.
 *
 * Only someone Confirmed on it may, once the Job has started; the
 * rest of the crew needn't have Confirmed.
 */
export const recordNoAccess = async (
  staffId: string,
  jobId: string,
  reason: string,
) => {
  await mustBeConfirmed(staffId, jobId);

  const job = await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for("update");
    if (job!.status !== "booked") {
      throw new ConflictError(whyNotBooked(job!.status, "no_access"));
    }
    if (job!.startsAt > clock.now()) {
      throw new ConflictError(notStarted());
    }
    await tx
      .update(jobs)
      .set({
        status: "no_access",
        noAccessAt: clock.now(),
        noAccessBy: staffId,
        noAccessReason: reason,
        feeCents: await lateFeeOf(jobId, tx),
      })
      .where(eq(jobs.id, jobId));
    await closePendingRequests(tx, [jobId]);
    return job!;
  });

  const settled = await settleAfterChange(jobId);
  const onPlan = (await planOfJob(jobId)) !== null;
  const [after] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const { property, client } = await ownerOf(job);
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));

  await notify(`No Access notice for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      ...noAccessEmail(client.preferredLanguage, {
        name: client.name,
        jobId,
        clean: await cleanOf(job, property),
        reason,
        feeCents: after!.feeCents!,
        onPlan,
        settled,
      }),
    }),
  );
  await tellOfficeStaff(`No Access of Job ${jobId} to the Office`, async () =>
    officeNoAccessEmail({
      cleaner: member!.name,
      client: client.name,
      jobId,
      clean: await cleanOf(job, property),
      reason,
      onPlan,
      settled,
    }),
  );
};

// ---- views ----

// a Job cancelled as its plan ended or changed (ending.ts, changing.ts): the
// Client's doing, with the plan's reason, where a skip has none
export const cancelledWithPlan = (
  job: Pick<Job, "cancelledBy" | "cancellationReason">,
) => job.cancelledBy === "client" && job.cancellationReason !== null;

// a Cancelled Job's cancellation; null otherwise
export const cancellationOf = async (
  job: Job,
): Promise<JobCancellation | null> => {
  if (job.status !== "cancelled") return null;
  return {
    cancelledAt: job.cancelledAt!.toISOString(),
    by: job.cancelledBy!,
    withPlan: cancelledWithPlan(job),
    late: job.lateCancellation ?? false,
    reason: job.cancellationReason,
    feeCents: job.feeCents ?? 0,
    payment: await paymentOf(job),
  };
};

// a No Access Job's record of it; null otherwise
export const noAccessOf = async (job: Job): Promise<JobNoAccess | null> => {
  if (job.status !== "no_access") return null;
  const [payment, [by]] = await Promise.all([
    paymentOf(job),
    job.noAccessBy
      ? db
          .select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(eq(staff.id, job.noAccessBy))
      : [],
  ]);
  return {
    recordedAt: job.noAccessAt!.toISOString(),
    recordedBy: by ?? null,
    reason: job.noAccessReason ?? "",
    feeCents: job.feeCents ?? 0,
    payment,
  };
};
