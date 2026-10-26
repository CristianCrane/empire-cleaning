import { and, eq, inArray, sum } from "drizzle-orm";
import type {
  CancellationTerms,
  CancelledBy,
  JobCancellation,
  JobNoAccess,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import env from "../../env.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock } from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatMoney,
  formatWhen,
} from "../../services/email/index.ts";
import { assignments } from "../assignments/assignments.schema.ts";
import { clients } from "../clients/clients.schema.ts";
import { paymentOf, settleJob, type Settled } from "../completion/balance.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { charges, refunds } from "../payments/payments.schema.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { staff } from "../staff/staff.schema.ts";
import { officeStaffEmails } from "../staff/staff.ts";

// cancelling is free until this long before a Job starts; after that it's a
// Late Cancellation
export const CANCELLATION_CUTOFF_HOURS = 24;
const HOUR_MS = 3_600_000;

const cleanTypeLabel = { deep: "Deep Clean", standard: "Standard Clean" };

// "the Deep Clean at 41-12 Austin St, 4B, 11375 on Monday, January 12 at 9:00 AM"
const describe = (job: Job, property: Property) =>
  `the ${cleanTypeLabel[job.cleanType]} at ${addressOf(property)} on ${formatWhen(job.startsAt)}`;

// emails go out after the change is saved; one that fails is logged, and the
// change stands
const notify = async (what: string, send: () => Promise<void>) => {
  try {
    await send();
  } catch (error) {
    console.error(`${what} not sent:`, error);
  }
};

const portalLink = (jobId: string) => ({
  href: `${env.CORS_ORIGIN_URL}/portal/jobs/${jobId}`,
  label: "See your clean",
});

const freeUntilOf = (job: Pick<Job, "startsAt">) =>
  new Date(job.startsAt.getTime() - CANCELLATION_CUTOFF_HOURS * HOUR_MS);

// the Deposit taken for a Job, which a Late Cancellation or No Access keeps
// as its fee
export const depositOf = async (jobId: string, tx: Tx | typeof db = db) => {
  const [row] = await tx
    .select({ cents: sum(charges.amountCents).mapWith(Number) })
    .from(charges)
    .where(and(eq(charges.jobId, jobId), eq(charges.kind, "deposit")));
  return row?.cents ?? 0;
};

// what has been taken for a Job, less refunds
const paidOf = async (jobId: string) => {
  const [[taken], [given]] = await Promise.all([
    db
      .select({ cents: sum(charges.amountCents).mapWith(Number) })
      .from(charges)
      .where(eq(charges.jobId, jobId)),
    db
      .select({ cents: sum(refunds.amountCents).mapWith(Number) })
      .from(refunds)
      .innerJoin(charges, eq(charges.id, refunds.chargeId))
      .where(eq(charges.jobId, jobId)),
  ]);
  return (taken?.cents ?? 0) - (given?.cents ?? 0);
};

// what cancelling a Job costs, by the Clock: the Deposit, if the Client
// cancels within 24 hours of it starting; nothing otherwise. A Deposit
// already kept by a Late Reschedule (ADR-0010) stays kept, however early
// the Client cancels, but nothing more is charged.
const feeOf = (job: Job, by: CancelledBy, depositCents: number) => {
  const late = by === "client" && clock.now() >= freeUntilOf(job);
  const kept = by === "client" ? job.rescheduleFeeCents : 0;
  return { late, feeCents: Math.max(late ? depositCents : 0, kept) };
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
  const [depositCents, paidCents] = await Promise.all([
    depositOf(job.id),
    paidOf(job.id),
  ]);
  const terms = (by: CancelledBy): CancellationTerms => {
    const { late, feeCents } = feeOf(job, by, depositCents);
    return {
      by,
      late,
      feeCents,
      refundCents: Math.max(paidCents - feeCents, 0),
      freeUntil: freeUntilOf(job).toISOString(),
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
 * Refused if what it costs isn't what the person cancelling was shown, as
 * when the 24-hour cut-off has passed since. A Client can't cancel once it
 * has started; Office Staff can.
 *
 * The Client is emailed, and so is everyone holding a place on it; the
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
      throw new ConflictError(
        job.status === "cancelled"
          ? "This Job has already been cancelled"
          : "This Job has already happened, so it can't be cancelled",
      );
    }
    if (cancellation.byClient && job.startsAt <= clock.now()) {
      throw new ConflictError(
        "Your clean has already started, so it can't be cancelled here. Please call the Office.",
      );
    }

    const { late, feeCents } = feeOf(
      job,
      cancellation.by,
      await depositOf(jobId, tx),
    );
    if (feeCents !== cancellation.feeCents) {
      throw new ConflictError(
        late
          ? `It's now less than ${CANCELLATION_CUTOFF_HOURS} hours before the clean, so cancelling is a Late Cancellation: the ${formatMoney(feeCents)} Deposit is kept as the fee. Please check and confirm again.`
          : "What cancelling costs has changed. Please check and confirm again.",
      );
    }

    await tx
      .update(jobs)
      .set({
        status: "cancelled",
        cancelledAt: clock.now(),
        cancelledBy: cancellation.by,
        cancelledByAccount: cancellation.byAccountId,
        lateCancellation: late,
        cancellationReason: cancellation.reason,
        feeCents,
      })
      .where(eq(jobs.id, jobId));
    return { job, late, feeCents };
  });

  const settled = await settleJob(jobId);
  await sendCancelled(jobId, settled);
  await tellCrew(job);
  if (cancellation.byClient) await tellOffice(job, late, feeCents);
};

const ownerOf = async (job: Job) => {
  const [found] = await db
    .select({ property: properties, client: clients })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, job.propertyId));
  return found!;
};

// what was refunded, as a line for the Client
const refundLine = (settled: Settled) =>
  settled.refundedCents > 0
    ? [
        `We've refunded ${formatMoney(settled.refundedCents)} to your ${settled.paymentMethod ?? "card"}. It can take a few days to reach you.`,
      ]
    : [];

const sendCancelled = async (jobId: string, settled: Settled) => {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const { property, client } = await ownerOf(job!);
  const what = describe(job!, property);
  const lines =
    job!.cancelledBy === "empire"
      ? [
          `We're sorry: we've had to cancel ${what}.${job!.cancellationReason ? ` ${job!.cancellationReason}` : ""}`,
          "You won't be charged anything for it.",
        ]
      : [
          `We've cancelled ${what}, as you asked.`,
          job!.lateCancellation && job!.feeCents! > 0
            ? `As it was less than ${CANCELLATION_CUTOFF_HOURS} hours before the clean, it's a Late Cancellation: your ${formatMoney(job!.feeCents!)} Deposit is kept as the fee.`
            : job!.feeCents! > 0
              ? `Your ${formatMoney(job!.feeCents!)} Deposit was already kept as the fee for a Late Reschedule, so there's nothing more to pay.`
              : "There's no charge for cancelling.",
        ];
  await notify(`Cancellation notice for Job ${jobId}`, () =>
    email.send({
      to: client.email,
      subject: "Your clean is cancelled",
      ...compose(
        [
          `Hi ${firstNameOf(client.name)},`,
          ...lines,
          ...refundLine(settled),
          "To book another clean, request a Quote from your account.",
        ],
        portalLink(jobId),
      ),
    }),
  );
};

// everyone holding a place on a Job hears it's off
const tellCrew = async (job: Job) => {
  const { property } = await ownerOf(job);
  const crew = await db
    .select({ id: staff.id, name: staff.name, email: staff.email })
    .from(assignments)
    .innerJoin(staff, eq(staff.id, assignments.staffId))
    .where(
      and(
        eq(assignments.jobId, job.id),
        inArray(assignments.status, ["offered", "confirmed"]),
      ),
    );
  for (const member of crew) {
    await notify(`Cancellation of Job ${job.id} to Staff ${member.id}`, () =>
      email.send({
        to: member.email,
        subject: "A Job you're on is cancelled",
        ...compose(
          [
            `Hi ${firstNameOf(member.name)},`,
            `We've cancelled ${describe(job, property)}. You don't need to go.`,
          ],
          { href: `${env.CORS_ORIGIN_URL}/cleaner`, label: "See your Jobs" },
        ),
      }),
    );
  }
};

// the Office hears when a Client cancels a Job themselves
const tellOffice = async (job: Job, late: boolean, feeCents: number) => {
  const { property, client } = await ownerOf(job);
  await notify(`Cancellation of Job ${job.id} to the Office`, async () => {
    for (const to of await officeStaffEmails()) {
      await email.send({
        to,
        subject: `${client.name} cancelled a Job`,
        ...compose(
          [
            `${client.name} has cancelled ${describe(job, property)}.`,
            late
              ? "It was a Late Cancellation, so the Deposit is kept as the fee."
              : feeCents > 0
                ? "It was more than 24 hours ahead, but a Late Reschedule had already kept the Deposit as the fee."
                : "It was more than 24 hours ahead, so the Deposit has been refunded.",
          ],
          {
            href: `${env.CORS_ORIGIN_URL}/office/jobs/${job.id}`,
            label: "See the Job",
          },
        ),
      });
    }
  });
};

// ---- No Access ----

/**
 * The assigned Cleaner records that they couldn't get into the Property,
 * saying what happened. The Job isn't Completed and is charged like a Late
 * Cancellation: the Deposit is kept as the fee. The Client and the Office
 * are emailed.
 *
 * Only someone with a Confirmed place may, once the Job has started; the
 * rest of the crew needn't have Confirmed.
 */
export const recordNoAccess = async (
  staffId: string,
  jobId: string,
  reason: string,
) => {
  const [mine] = await db
    .select({ status: assignments.status })
    .from(assignments)
    .where(
      and(
        eq(assignments.jobId, jobId),
        eq(assignments.staffId, staffId),
        inArray(assignments.status, ["offered", "confirmed"]),
      ),
    );
  if (!mine) throw new NotFoundError("Job not found");
  if (mine.status !== "confirmed") {
    throw new ConflictError("Confirm your place on this Job first");
  }

  const job = await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for("update");
    if (job!.status !== "booked") {
      throw new ConflictError(
        job!.status === "no_access"
          ? "No Access has already been recorded for this Job"
          : "This Job is no longer booked",
      );
    }
    if (job!.startsAt > clock.now()) {
      throw new ConflictError("This Job hasn't started yet");
    }
    await tx
      .update(jobs)
      .set({
        status: "no_access",
        noAccessAt: clock.now(),
        noAccessBy: staffId,
        noAccessReason: reason,
        feeCents: await depositOf(jobId, tx),
      })
      .where(eq(jobs.id, jobId));
    return job!;
  });

  const settled = await settleJob(jobId);
  const [after] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const { property, client } = await ownerOf(job);
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));

  await notify(`No Access notice for Job ${jobId}`, () =>
    email.send({
      to: client.email,
      subject: "We couldn't get in for your clean",
      ...compose(
        [
          `Hi ${firstNameOf(client.name)},`,
          `Our team came for ${describe(job, property)}, but couldn't get in ("${reason}").`,
          after!.feeCents! > 0
            ? `As with a Late Cancellation, your ${formatMoney(after!.feeCents!)} Deposit is kept as the fee.`
            : "There's no charge for it.",
          ...refundLine(settled),
          "To book another clean, request a Quote from your account. Please check your Access Instructions first.",
        ],
        portalLink(jobId),
      ),
    }),
  );
  await notify(`No Access of Job ${jobId} to the Office`, async () => {
    for (const to of await officeStaffEmails()) {
      await email.send({
        to,
        subject: `No Access at ${addressOf(property)}`,
        ...compose(
          [
            `${member!.name} couldn't get in for ${describe(job, property)} ("${reason}").`,
            `${client.name} has been told, and the Deposit is kept as the fee.`,
          ],
          {
            href: `${env.CORS_ORIGIN_URL}/office/jobs/${jobId}`,
            label: "See the Job",
          },
        ),
      });
    }
  });
};

// ---- views ----

// a Cancelled Job's cancellation; null otherwise
export const cancellationOf = async (
  job: Job,
): Promise<JobCancellation | null> => {
  if (job.status !== "cancelled") return null;
  return {
    cancelledAt: job.cancelledAt!.toISOString(),
    by: job.cancelledBy!,
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
