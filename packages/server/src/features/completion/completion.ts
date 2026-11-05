import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
} from "drizzle-orm";
import type {
  AdjustmentCorrection,
  AdjustmentProposal,
  AdjustmentView,
  CleanerJob,
  ClientJobDetail,
  ClientPastJob,
  CompletionInput,
  Condition,
  JobCompletion,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock, DAY_MS } from "../../services/clock/index.ts";
import { email, formatMoney, notify } from "../../services/email/index.ts";
import { assignments, onCrew } from "../assignments/assignments.schema.ts";
import { assignmentStatusOf } from "../assignments/places.ts";
import {
  cancellationOf,
  cancelTermsOf,
  planOfJob,
  noAccessOf,
} from "../cancellation/cancellation.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { whyNotBooked } from "../jobs/rules.ts";
import { lockProperty } from "../quotes/quotes.ts";
import { closePendingRequests } from "../reschedule/closing.ts";
import { servicePlanVisits } from "../service-plans/service-plans.schema.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import {
  rescheduleRequestOf,
  rescheduleTermsOf,
} from "../reschedule/reschedule.ts";
import { staff } from "../staff/staff.schema.ts";
import {
  counts,
  paymentOf,
  settleAfterChange,
  settleJob,
  type Settled,
} from "./balance.ts";
import { adjustments, type Adjustment } from "./completion.schema.ts";
import {
  addOnsOfVersions,
  isReduction,
  priceReports,
  quotedJob,
  quotedJobs,
  reportableAddOns,
  signed,
} from "./pricing.ts";
import { cleanOf, serviceNameOf } from "../services/services.ts";
import {
  approvedEmail,
  completionUndoneEmail,
  correctedEmail,
  feeTakenEmail,
  paymentWentThroughEmail,
  proposalEmail,
  receiptEmail,
  unpaidEmail,
} from "./emails.ts";
import { monitoring } from "../../services/monitoring/index.ts";
import { hoursOnSiteOf } from "../jobs/jobs.ts";

// a proposed increase the Client hasn't answered lapses after this long, with
// one reminder this long before it does (ADR-0009)
const ANSWER_DAYS = 7;
const REMINDER_DAYS_BEFORE = 2;

// what an Adjustment changed, by name: "Inside the fridge", "1 extra hour"
const adjustmentItem = (a: Pick<Adjustment, "kind" | "addOnName" | "hours">) =>
  a.kind === "extra_time"
    ? `${a.hours} extra ${a.hours === 1 ? "hour" : "hours"}`
    : a.addOnName!;

// "Inside the oven, done on the day", "1.5 extra hours"
export const adjustmentLabel = (
  a: Pick<Adjustment, "kind" | "addOnName" | "hours">,
) =>
  a.kind === "extra_time"
    ? adjustmentItem(a)
    : `${a.addOnName}, ${a.kind === "add_on_done" ? "done on the day" : "not done"}`;

/**
 * A Property's Condition is what its latest Completed Job reported (#244
 * #7). Once `job` is completed, corrected or undone, with `reported` its
 * report now (null once undone), the Property takes the latest report, or
 * `fallback` when no Completed Job is left. A Job that started after it
 * and has reported keeps the Property as it is: a Condition given since,
 * as a Client asking does, is newer than any report but the latest.
 */
const conditionFromJobs = async (
  tx: Tx,
  job: Pick<Job, "id" | "propertyId" | "startsAt">,
  reported: Condition | null,
  fallback: Condition | null = null,
) => {
  // one at a time at a Property, so an older report never lands last
  await lockProperty(tx, job.propertyId);
  const [latest] = await tx
    .select({ startsAt: jobs.startsAt, condition: jobs.reportedCondition })
    .from(jobs)
    .where(
      and(
        eq(jobs.propertyId, job.propertyId),
        eq(jobs.status, "completed"),
        ne(jobs.id, job.id),
      ),
    )
    .orderBy(desc(jobs.startsAt))
    .limit(1);
  if (latest && latest.startsAt > job.startsAt) return;
  const condition = reported ?? latest?.condition ?? fallback;
  if (!condition) return;
  await tx
    .update(properties)
    .set({ condition })
    .where(eq(properties.id, job.propertyId));
};

const jobWithOwner = async (jobId: string) => {
  const [found] = await db
    .select({ job: jobs, property: properties, client: clients })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(jobs.id, jobId));
  if (!found) throw new NotFoundError("Job not found");
  return found;
};

// tells the Client a Job they owe on couldn't be charged, the first time it
// becomes Unpaid
const sendUnpaid = async (jobId: string, settled: Settled) => {
  const { job, property, client } = await jobWithOwner(jobId);
  const payment = await paymentOf(job);
  await notify(`Unpaid notice for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      ...unpaidEmail({
        name: client.name,
        jobId,
        clean: await cleanOf(job, property),
        owedCents: payment.owedCents,
        paymentMethod: payment.paymentMethod,
        held: settled.plan === "held",
      }),
    }),
  );
};

// ---- the Cleaner completing ----

/**
 * The assigned Cleaner marks a Job Completed on site, with the Condition they
 * found and anything different on the day (ADR-0009): reductions count at
 * once, increases wait on the Office. Then the Balance is charged and the
 * Client emailed a receipt; if it can't be charged, the Job is Unpaid.
 *
 * Only someone with a Confirmed place may, once every place is Confirmed and
 * the Job has started.
 */
export const completeJob = async (
  staffId: string,
  jobId: string,
  input: CompletionInput,
) => {
  const [mine] = await db
    .select({ status: assignments.status })
    .from(assignments)
    .where(
      and(
        eq(assignments.jobId, jobId),
        eq(assignments.staffId, staffId),
        onCrew(),
      ),
    );
  if (!mine) throw new NotFoundError("Job not found");
  if (mine.status !== "confirmed") {
    throw new ConflictError("Confirm your place on this Job first");
  }

  const quoted = await quotedJob(jobId);
  const priced = await priceReports(quoted, input.reports);
  const now = clock.now();

  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for("update");
    if (job!.status !== "booked") {
      throw new ConflictError(whyNotBooked(job!.status, "completed"));
    }
    if (job!.startsAt > now) {
      throw new ConflictError("This Job hasn't started yet");
    }
    const status = (await assignmentStatusOf([job!], tx)).get(jobId);
    if (status !== "assigned") {
      throw new ConflictError(
        "Every place on this Job must be Confirmed before it can be Completed. Please call the Office.",
      );
    }

    const [property] = await tx
      .select()
      .from(properties)
      .where(eq(properties.id, job!.propertyId));
    await tx
      .update(jobs)
      .set({
        status: "completed",
        completedAt: now,
        completedBy: staffId,
        reportedCondition: input.condition,
        conditionBefore: property!.condition,
      })
      .where(eq(jobs.id, jobId));
    await closePendingRequests(tx, [jobId]);
    await conditionFromJobs(tx, job!, input.condition);

    if (priced.length > 0) {
      await tx.insert(adjustments).values(
        input.reports.map((report, i) => ({
          jobId,
          kind: report.kind,
          ...priced[i]!,
          reason: report.reason,
          status: isReduction(report.kind)
            ? ("applied" as const)
            : ("reported" as const),
          ...signed(
            report.kind,
            priced[i]!.workedOutCents,
            priced[i]!.taxExempt,
            quoted.suggested,
          ),
          reportedBy: staffId,
          reportedAt: now,
        })),
      );
    }
  });

  const settled = await settleAfterChange(jobId);
  await sendReceipt(jobId, settled);
  if (settled.becameUnpaid) await sendUnpaid(jobId, settled);
};

// the Client's receipt for a Completed Job
const sendReceipt = async (jobId: string, settled: Settled) => {
  const { job, property, client } = await jobWithOwner(jobId);
  const [payment, rows] = await Promise.all([
    paymentOf(job),
    db.select().from(adjustments).where(eq(adjustments.jobId, jobId)),
  ]);
  const deposit = payment.charges
    .filter((c) => c.kind === "deposit")
    .reduce((sum, c) => sum + c.amountCents, 0);
  await notify(`Receipt for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      ...receiptEmail({
        name: client.name,
        jobId,
        clean: await cleanOf(job, property),
        quotedCents: payment.quotedCents,
        adjustments: rows.filter(counts).map((a) => ({
          label: adjustmentLabel(a),
          totalCents: a.totalCents,
        })),
        totalCents: payment.totalCents,
        rescheduleFeeCents: payment.rescheduleFeeCents,
        depositCents: deposit,
        owedCents: payment.owedCents,
        settled,
      }),
    }),
  );
};

// ---- views ----

const toView = (a: Adjustment): AdjustmentView => ({
  id: a.id,
  kind: a.kind,
  addOnName: a.addOnName,
  hours: a.hours,
  reason: a.reason,
  status: a.status,
  workedOutCents: a.workedOutCents,
  priceCents: a.priceCents,
  taxCents: a.taxCents,
  totalCents: a.totalCents,
  officeReason: a.officeReason,
  reportedAt: a.reportedAt.toISOString(),
  proposedAt: a.proposedAt?.toISOString() ?? null,
  answeredAt: a.answeredAt?.toISOString() ?? null,
  lapsesAt:
    a.status === "proposed" && a.proposedAt
      ? new Date(a.proposedAt.getTime() + ANSWER_DAYS * DAY_MS).toISOString()
      : null,
});

const adjustmentsOf = (jobId: string) =>
  db
    .select()
    .from(adjustments)
    .where(eq(adjustments.jobId, jobId))
    .orderBy(asc(adjustments.reportedAt), asc(adjustments.createdAt));

// a Completed Job's completion, for the Office; null while it's booked
export const officeCompletionOf = async (
  job: Job,
): Promise<JobCompletion | null> => {
  if (job.status !== "completed") return null;
  const [rows, payment, [by]] = await Promise.all([
    adjustmentsOf(job.id),
    paymentOf(job),
    job.completedBy
      ? db
          .select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(eq(staff.id, job.completedBy))
      : [],
  ]);
  return {
    completedAt: job.completedAt!.toISOString(),
    completedBy: by ?? null,
    condition: job.reportedCondition!,
    adjustments: rows.map(toView),
    payment,
  };
};

type CleanerExtras = Pick<
  CleanerJob,
  "outcome" | "reportable" | "completion" | "noAccess"
> & { assigned: boolean };

// what the Cleaner area shows about completing each Job: whether every
// place is Confirmed, what can be reported, and once Completed, what was; or
// once No Access, what happened
export const cleanerCompletionsOf = async (
  list: Job[],
): Promise<Map<string, CleanerExtras>> => {
  const ids = list.map((j) => j.id);
  if (ids.length === 0) return new Map();
  const booked = list.filter((j) => j.status === "booked").map((j) => j.id);
  const [assigned, rows, names, quoted] = await Promise.all([
    assignmentStatusOf(list),
    db.select().from(adjustments).where(inArray(adjustments.jobId, ids)),
    db
      .select({ id: staff.id, name: staff.name })
      .from(staff)
      .where(
        inArray(
          staff.id,
          list
            .flatMap((j) => [j.completedBy, j.noAccessBy])
            .filter((id) => id !== null),
        ),
      ),
    quotedJobs(booked),
  ]);
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  const addOns = await addOnsOfVersions([
    ...new Set([...quoted.values()].map((q) => q.priceListId)),
  ]);

  const extras = list.map((job): [string, CleanerExtras] => {
    const completed = job.status === "completed";
    const noAccess = job.status === "no_access";
    return [
      job.id,
      {
        assigned: assigned.get(job.id) === "assigned",
        outcome: completed ? "completed" : noAccess ? "no_access" : null,
        reportable: quoted.has(job.id)
          ? reportableAddOns(quoted.get(job.id)!, addOns)
          : { quoted: [], others: [] },
        completion: completed
          ? {
              completedAt: job.completedAt!.toISOString(),
              completedBy: job.completedBy
                ? (nameOf.get(job.completedBy) ?? null)
                : null,
              condition: job.reportedCondition!,
              reports: rows
                .filter((r) => r.jobId === job.id)
                .map((r) => ({
                  kind: r.kind,
                  addOnName: r.addOnName,
                  hours: r.hours,
                  reason: r.reason,
                })),
            }
          : null,
        noAccess: noAccess
          ? {
              recordedAt: job.noAccessAt!.toISOString(),
              recordedBy: job.noAccessBy
                ? (nameOf.get(job.noAccessBy) ?? null)
                : null,
              reason: job.noAccessReason ?? "",
            }
          : null,
      },
    ];
  });
  return new Map(extras);
};

// ---- the Office reviewing and correcting ----

// a Completed Job's Adjustment
const findAdjustment = async (jobId: string, adjustmentId: string) => {
  const [found] = await db
    .select({ adjustment: adjustments, job: jobs })
    .from(adjustments)
    .innerJoin(jobs, eq(jobs.id, adjustments.jobId))
    .where(
      and(
        eq(adjustments.id, adjustmentId),
        eq(adjustments.jobId, jobId),
        eq(jobs.status, "completed"),
      ),
    );
  if (!found) throw new NotFoundError("Adjustment not found");
  return found;
};

/**
 * Office Staff propose a reported increase to the Client, at its worked-out
 * price or at one they set (before tax) with a reason, and the Client is
 * emailed to approve or decline it within 7 days.
 */
export const proposeAdjustment = async (
  jobId: string,
  adjustmentId: string,
  proposal: AdjustmentProposal,
  byAccountId: string,
) => {
  const { adjustment } = await findAdjustment(jobId, adjustmentId);
  if (adjustment.status !== "reported") {
    throw new ConflictError("This Adjustment has already been reviewed");
  }
  const quoted = await quotedJob(jobId);
  const priceCents = proposal.priceCents ?? adjustment.workedOutCents;
  const overridden = priceCents !== adjustment.workedOutCents;
  const now = clock.now();

  const [proposed] = await db
    .update(adjustments)
    .set({
      ...signed(
        adjustment.kind,
        priceCents,
        adjustment.taxExempt,
        quoted.suggested,
      ),
      officeReason: overridden ? (proposal.reason ?? null) : null,
      status: "proposed",
      reviewedBy: byAccountId,
      reviewedAt: now,
      proposedAt: now,
    })
    .where(
      and(eq(adjustments.id, adjustmentId), eq(adjustments.status, "reported")),
    )
    .returning();
  if (!proposed) {
    throw new ConflictError("This Adjustment has already been reviewed");
  }

  const { job, property, client } = await jobWithOwner(jobId);
  await notify(`Proposal of Adjustment ${adjustmentId}`, () =>
    sendProposal(client, job, property, proposed, "proposed"),
  );
};

const sendProposal = async (
  client: Client,
  job: Job,
  property: Property,
  adjustment: Adjustment,
  why: "proposed" | "reminder",
) => {
  const by = new Date(adjustment.proposedAt!.getTime() + ANSWER_DAYS * DAY_MS);
  return email.send({
    to: client.email,
    ...proposalEmail({
      name: client.name,
      jobId: job.id,
      clean: await cleanOf(job, property),
      label: adjustmentLabel(adjustment),
      reason: adjustment.reason,
      totalCents: adjustment.totalCents,
      answerBy: by,
      reminder: why === "reminder",
    }),
  });
};

// Office Staff decide a reported increase shouldn't be charged
export const dismissAdjustment = async (
  jobId: string,
  adjustmentId: string,
  reason: string | null,
  byAccountId: string,
) => {
  await findAdjustment(jobId, adjustmentId);
  const [dismissed] = await db
    .update(adjustments)
    .set({
      status: "dismissed",
      officeReason: reason,
      reviewedBy: byAccountId,
      reviewedAt: clock.now(),
    })
    .where(
      and(eq(adjustments.id, adjustmentId), eq(adjustments.status, "reported")),
    )
    .returning();
  if (!dismissed) {
    throw new ConflictError("This Adjustment has already been reviewed");
  }
};

// after a correction moves money, the Client hears what changed
const sendCorrection = async (jobId: string, settled: Settled) => {
  if (
    settled.chargedCents === 0 &&
    settled.refundedCents === 0 &&
    !settled.failure
  ) {
    return;
  }
  const { job, property, client } = await jobWithOwner(jobId);
  const payment = await paymentOf(job);
  if (job.status !== "completed") {
    await notify(`Fee notice for Job ${jobId}`, async () =>
      email.send({
        to: client.email,
        ...feeTakenEmail({
          name: client.name,
          jobId,
          clean: await cleanOf(job, property),
          feeCents: job.feeCents ?? 0,
          owedCents: payment.owedCents,
          settled,
        }),
      }),
    );
    return;
  }
  await notify(`Correction notice for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      ...correctedEmail({
        name: client.name,
        jobId,
        clean: await cleanOf(job, property),
        totalCents: payment.totalCents,
        owedCents: payment.owedCents,
        settled,
      }),
    }),
  );
};

const settleAfterCorrection = async (jobId: string, item: string) => {
  const settled = await settleAfterChange(jobId, item);
  await sendCorrection(jobId, settled);
  if (settled.becameUnpaid) await sendUnpaid(jobId, settled);
};

/**
 * Office Staff correct an Adjustment's price (before tax), with a reason, and
 * the difference is charged or refunded. A reduction stays a reduction, and
 * an approved increase can only be lowered: the Client agreed to that much.
 * One still with the Office or the Client is proposed or dismissed instead.
 */
export const correctAdjustment = async (
  jobId: string,
  adjustmentId: string,
  correction: AdjustmentCorrection,
  byAccountId: string,
) => {
  const { adjustment } = await findAdjustment(jobId, adjustmentId);
  if (adjustment.status !== "applied" && adjustment.status !== "approved") {
    throw new ConflictError(
      "Only an Adjustment that counts towards the price can be corrected",
    );
  }
  if (
    adjustment.status === "approved" &&
    correction.priceCents > adjustment.priceCents
  ) {
    throw new ConflictError(
      `The Client approved ${formatMoney(adjustment.totalCents)}, so it can't be raised`,
    );
  }
  const quoted = await quotedJob(jobId);
  await db
    .update(adjustments)
    .set({
      ...signed(
        adjustment.kind,
        correction.priceCents,
        adjustment.taxExempt,
        quoted.suggested,
      ),
      officeReason: correction.reason,
      reviewedBy: byAccountId,
      reviewedAt: clock.now(),
    })
    .where(eq(adjustments.id, adjustmentId));
  await settleAfterCorrection(
    jobId,
    `${adjustmentItem(adjustment)}, price corrected`,
  );
};

// Office Staff take an Adjustment off, whatever its state; the difference is
// charged or refunded
export const removeAdjustment = async (jobId: string, adjustmentId: string) => {
  const { adjustment } = await findAdjustment(jobId, adjustmentId);
  await db.delete(adjustments).where(eq(adjustments.id, adjustmentId));
  await settleAfterCorrection(
    jobId,
    `${adjustmentItem(adjustment)}, taken off`,
  );
};

const completedJob = async (jobId: string) => {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "completed")));
  if (!job) throw new ConflictError("This Job hasn't been Completed");
  return job;
};

// a Job that can owe money: Completed, or Cancelled or No Access with a fee
// to charge, as a plan Job's is
const owingJob = async (jobId: string) => {
  const [job] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.id, jobId),
        inArray(jobs.status, ["completed", "cancelled", "no_access"]),
      ),
    );
  if (!job) throw new ConflictError("This Job hasn't been Completed");
  return job;
};

// Office Staff correct the Condition reported, and the Property's with it
// while it's the latest report there (conditionFromJobs)
export const correctCondition = async (jobId: string, condition: Condition) => {
  const job = await completedJob(jobId);
  await db.transaction(async (tx) => {
    await tx
      .update(jobs)
      .set({ reportedCondition: condition })
      .where(eq(jobs.id, jobId));
    await conditionFromJobs(tx, job, condition);
  });
};

/**
 * Office Staff undo a completion made by mistake: the Job is booked again,
 * its Adjustments are gone, the Property's Condition is the latest report
 * left there, or as it was before this one (conditionFromJobs), and
 * everything charged but the Deposit is refunded. Its Assignments stand, so
 * the Cleaner can complete it again.
 */
export const undoCompletion = async (jobId: string) => {
  const job = await completedJob(jobId);
  await db.transaction(async (tx) => {
    await tx.delete(adjustments).where(eq(adjustments.jobId, jobId));
    await tx
      .update(jobs)
      .set({
        status: "booked",
        completedAt: null,
        completedBy: null,
        reportedCondition: null,
        conditionBefore: null,
        unpaidSince: null,
        unpaidReason: null,
      })
      .where(eq(jobs.id, jobId));
    await conditionFromJobs(tx, job, null, job.conditionBefore);
  });
  const settled = await settleAfterChange(jobId);

  const { property, client } = await jobWithOwner(jobId);
  await notify(`Undone completion notice for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      ...completionUndoneEmail({
        name: client.name,
        clean: await cleanOf(job, property),
        settled,
      }),
    }),
  );
};

// tries again to take what an Unpaid Job owes; says why if it still can't
export const retryBalance = async (jobId: string) => {
  const job = await owingJob(jobId);
  if (!job.unpaidSince) return;
  const settled = await settleJob(jobId);
  if (settled.failure) {
    throw new ConflictError(
      `It still couldn't be charged (${settled.failure})`,
    );
  }
  await sendCorrection(jobId, settled);
};

// ---- the Client ----

// the Client's Jobs, through their Properties
export const ownJob = async (clientId: string, jobId: string) => {
  const [found] = await db
    .select({ job: jobs, property: properties })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(and(eq(jobs.id, jobId), eq(properties.clientId, clientId)));
  if (!found) throw new NotFoundError("Job not found");
  return found;
};

const clientJobOf = async (job: Job, property: Property) => ({
  id: job.id,
  startsAt: job.startsAt.toISOString(),
  serviceName: await serviceNameOf(job.serviceId),
  crewSize: job.crewSize,
  hoursOnSite: hoursOnSiteOf(job),
  property: {
    id: property.id,
    street: property.street,
    unit: property.unit,
    postcode: property.postcode,
  },
});

// what the Client sees of a Job's Adjustments: none still with the Office
const shownToClient = (a: Pick<AdjustmentView, "status">) =>
  a.status !== "reported" && a.status !== "dismissed";

// one of the Client's Jobs: what cancelling or moving it would cost while
// it's still to come, its receipt once Completed, or how it ended
export const clientJob = async (
  clientId: string,
  jobId: string,
): Promise<ClientJobDetail> => {
  const { job, property } = await ownJob(clientId, jobId);
  const [
    completion,
    cancellation,
    noAccess,
    terms,
    rescheduleTerms,
    rescheduleRequest,
    servicePlanId,
    payment,
    quoted,
  ] = await Promise.all([
    officeCompletionOf(job),
    cancellationOf(job),
    noAccessOf(job),
    cancelTermsOf(job),
    rescheduleTermsOf(job),
    rescheduleRequestOf(job),
    planOfJob(job.id),
    paymentOf(job),
    // without a Quote to say, no extras are shown
    quotedJob(job.id).catch(() => null),
  ]);
  return {
    ...(await clientJobOf(job, property)),
    status: job.status,
    payment,
    addOns: quoted?.suggested.addOns.map((a) => a.name) ?? [],
    completion: completion && {
      completedAt: completion.completedAt,
      condition: completion.condition,
      adjustments: completion.adjustments.filter(shownToClient),
      payment: completion.payment,
    },
    cancellation,
    noAccess: noAccess && {
      recordedAt: noAccess.recordedAt,
      reason: noAccess.reason,
      feeCents: noAccess.feeCents,
      payment: noAccess.payment,
    },
    // once it has started, it's the Office's to cancel
    cancelTerms: job.startsAt > clock.now() ? (terms?.client ?? null) : null,
    rescheduleTerms,
    rescheduleRequest,
    servicePlanId,
    planDiscountPercent: quoted?.planDiscountPercent ?? null,
  };
};

// the Client's Jobs no longer going ahead, latest first: Completed,
// Cancelled (a plan clean they cancelled is Skipped) and No Access
export const pastJobsFor = async (
  clientId: string,
): Promise<ClientPastJob[]> => {
  const rows = await db
    .select({
      job: jobs,
      property: properties,
      planId: servicePlanVisits.servicePlanId,
    })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .leftJoin(servicePlanVisits, eq(servicePlanVisits.jobId, jobs.id))
    .where(
      and(
        eq(properties.clientId, clientId),
        inArray(jobs.status, ["completed", "cancelled", "no_access"]),
      ),
    )
    .orderBy(desc(jobs.startsAt));
  const waiting =
    rows.length === 0
      ? []
      : await db
          .select({ jobId: adjustments.jobId })
          .from(adjustments)
          .where(
            and(
              inArray(
                adjustments.jobId,
                rows.map((r) => r.job.id),
              ),
              eq(adjustments.status, "proposed"),
            ),
          );
  return Promise.all(
    rows.map(async ({ job, property, planId }) => ({
      ...(await clientJobOf(job, property)),
      status: job.status as ClientPastJob["status"],
      skipped:
        job.status === "cancelled" &&
        job.cancelledBy === "client" &&
        planId !== null,
      completedAt: job.completedAt?.toISOString() ?? null,
      totalCents:
        job.status === "completed" ? (await paymentOf(job)).totalCents : 0,
      feeCents: job.status === "completed" ? 0 : (job.feeCents ?? 0),
      unpaid: job.unpaidSince !== null,
      owedCents: job.unpaidSince ? (await paymentOf(job)).owedCents : 0,
      awaitingAnswer: waiting.filter((w) => w.jobId === job.id).length,
    })),
  );
};

/**
 * The Client approves or declines an increase proposed to them, until it
 * lapses. Approving charges it at once, as the rest of the Balance, with a
 * receipt; if it can't be charged, the Job is Unpaid.
 */
export const answerAdjustment = async (
  clientId: string,
  jobId: string,
  adjustmentId: string,
  approve: boolean,
) => {
  await ownJob(clientId, jobId);
  const { adjustment } = await findAdjustment(jobId, adjustmentId);
  const now = clock.now();
  const lapsed =
    adjustment.proposedAt &&
    now.getTime() >= adjustment.proposedAt.getTime() + ANSWER_DAYS * DAY_MS;
  if (adjustment.status !== "proposed" || lapsed) {
    throw new ConflictError(
      lapsed || adjustment.status === "lapsed"
        ? "This has lapsed, so it won't be charged."
        : "You've already answered this.",
    );
  }
  const [answered] = await db
    .update(adjustments)
    .set({ status: approve ? "approved" : "declined", answeredAt: now })
    .where(
      and(eq(adjustments.id, adjustmentId), eq(adjustments.status, "proposed")),
    )
    .returning();
  if (!answered) throw new ConflictError("You've already answered this.");
  if (!approve) return;

  const settled = await settleAfterChange(jobId, adjustmentItem(answered));
  const { job, property, client } = await jobWithOwner(jobId);
  const payment = await paymentOf(job);
  await notify(`Receipt for Adjustment ${adjustmentId}`, async () =>
    email.send({
      to: client.email,
      ...approvedEmail({
        name: client.name,
        jobId,
        clean: await cleanOf(job, property),
        label: adjustmentLabel(answered),
        amountCents: answered.totalCents,
        totalCents: payment.totalCents,
        owedCents: payment.owedCents,
        settled,
      }),
    }),
  );
  if (settled.becameUnpaid) await sendUnpaid(jobId, settled);
};

// the Client tries their Unpaid Job's Balance again
export const clientRetryBalance = async (clientId: string, jobId: string) => {
  await ownJob(clientId, jobId);
  const job = await owingJob(jobId);
  if (!job.unpaidSince) return;
  const settled = await settleJob(jobId);
  if (settled.failure) {
    throw new ConflictError(
      "Your card still couldn't be charged. Please update your Payment Method, or try another card.",
    );
  }
};

// Settles a Job again, and tells its Client the payment went through: as
// after a new Payment Method, or a payment nobody heard the end of
// (ADR-0022). One that still fails stays Unpaid, and isn't told again.
export const retryJob = async (jobId: string) => {
  const settled = await settleJob(jobId);
  if (
    settled.failure ||
    (settled.chargedCents === 0 && settled.refundedCents === 0)
  ) {
    return;
  }
  const { job, property, client } = await jobWithOwner(jobId);
  const payment = await paymentOf(job);
  await notify(`Payment notice for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      ...paymentWentThroughEmail({
        name: client.name,
        jobId,
        clean: await cleanOf(job, property),
        owedCents: payment.owedCents,
        settled,
      }),
    }),
  );
};

// After a Client saves a new Payment Method, tries each of their Unpaid Jobs
// again with it
export const retryUnpaidJobsFor = async (clientId: string) => {
  const unpaid = await db
    .select({ id: jobs.id })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(and(eq(properties.clientId, clientId), isNotNull(jobs.unpaidSince)));
  for (const { id } of unpaid) {
    try {
      await retryJob(id);
    } catch (error) {
      // the rest are still tried; this one stays Unpaid
      monitoring.error(error, { what: `Unpaid Job ${id} not retried` });
    }
  }
};

// ---- the Clock ----

/**
 * Reminds each Client of an increase proposed to them that they haven't
 * answered, once, 2 days before it lapses; and lapses those unanswered after
 * 7 days, which leaves the Job at its price without them. Safe to run as
 * often as you like: each is claimed before its email goes.
 *
 * Nothing calls this but the timer in src/scheduler.ts (and tests).
 */
export const chaseProposedAdjustments = async () => {
  const now = clock.now();
  await db
    .update(adjustments)
    .set({ status: "lapsed", answeredAt: now })
    .where(
      and(
        eq(adjustments.status, "proposed"),
        lte(
          adjustments.proposedAt,
          new Date(now.getTime() - ANSWER_DAYS * DAY_MS),
        ),
      ),
    );

  const due = await db
    .select({ adjustment: adjustments })
    .from(adjustments)
    .where(
      and(
        eq(adjustments.status, "proposed"),
        isNull(adjustments.reminderSentAt),
        lte(
          adjustments.proposedAt,
          new Date(
            now.getTime() - (ANSWER_DAYS - REMINDER_DAYS_BEFORE) * DAY_MS,
          ),
        ),
      ),
    );
  for (const { adjustment } of due) {
    const [claimed] = await db
      .update(adjustments)
      .set({ reminderSentAt: now })
      .where(
        and(
          eq(adjustments.id, adjustment.id),
          isNull(adjustments.reminderSentAt),
        ),
      )
      .returning({ id: adjustments.id });
    if (!claimed) continue;
    const { job, property, client } = await jobWithOwner(adjustment.jobId);
    try {
      await sendProposal(client, job, property, adjustment, "reminder");
    } catch (error) {
      monitoring.error(error, {
        what: `reminder for Adjustment ${adjustment.id} not sent`,
      });
      await db
        .update(adjustments)
        .set({ reminderSentAt: null })
        .where(eq(adjustments.id, adjustment.id));
    }
  }
};

// ---- Needs attention ----

// Unpaid Jobs, longest Unpaid first
export const unpaidJobs = async () => {
  const rows = await db
    .select()
    .from(jobs)
    .where(isNotNull(jobs.unpaidSince))
    .orderBy(asc(jobs.unpaidSince));
  return Promise.all(
    rows.map(async (job) => ({
      jobId: job.id,
      since: job.unpaidSince!.toISOString(),
      reason: job.unpaidReason ?? "",
      owedCents: (await paymentOf(job)).owedCents,
    })),
  );
};

// Jobs with increases waiting on the Office, earliest reported first
export const jobsWithReportedAdjustments = async () => {
  const rows = await db
    .select({ jobId: adjustments.jobId, reportedAt: adjustments.reportedAt })
    .from(adjustments)
    .where(eq(adjustments.status, "reported"))
    .orderBy(asc(adjustments.reportedAt));
  const byJob = new Map<string, { since: string; count: number }>();
  for (const { jobId, reportedAt } of rows) {
    const known = byJob.get(jobId);
    if (known) known.count += 1;
    else byJob.set(jobId, { since: reportedAt.toISOString(), count: 1 });
  }
  return [...byJob].map(([jobId, item]) => ({ jobId, ...item }));
};
