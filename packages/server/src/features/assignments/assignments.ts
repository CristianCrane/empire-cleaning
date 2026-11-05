import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  holdsPlace,
  type AssignmentView,
  type HoldingState,
  type CleanerJob,
  type CleanerJobs,
  type OfficeJob,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import {
  clock,
  dayOf,
  HOUR_MS,
  startOfDay,
} from "../../services/clock/index.ts";
import { email, firstNameOf, notify } from "../../services/email/index.ts";
import {
  cancellationOf,
  cancelTermsOf,
  planOfJob,
  noAccessOf,
} from "../cancellation/cancellation.ts";
import { weeklyBillOfJob } from "../bills/billed-weekly.ts";
import { clients } from "../clients/clients.schema.ts";
import {
  cleanerCompletionsOf,
  officeCompletionOf,
} from "../completion/completion.ts";
import { addOnsOf } from "../jobs/add-ons.ts";
import { hoursOnSiteOf, onSchedule } from "../jobs/jobs.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { jobView, scheduleOn, scheduledJobs } from "../jobs/schedule.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { firstCleanCompleted } from "../quotes/quote-state.ts";
import {
  rescheduleRequestOf,
  rescheduleTermsOf,
} from "../reschedule/reschedule.ts";
import { staff } from "../staff/staff.schema.ts";
import { tellOfficeStaff } from "../staff/staff.ts";
import { assignments, onCrew, type Assignment } from "./assignments.schema.ts";
import { emailOpenPlaces, openToOf, placeReopened } from "./open-places.ts";
import {
  releaseClosed,
  whyNotConfirm,
  whyNotOffer,
  whyNotRelease,
} from "./rules.ts";
import { cleanOf, serviceVersions } from "../services/services.ts";
import { offerEmail, releasedEmail, takenOffEmail } from "./emails.ts";

// a booked Job with its Property
const findJob = async (jobId: string) => {
  const [found] = await db
    .select({ job: jobs, property: properties })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "booked")));
  if (!found) throw new NotFoundError("Job not found");
  return found;
};

// ---- the Office ----

const toView = (
  assignment: Assignment,
  member: { id: string; name: string },
): AssignmentView => ({
  id: assignment.id,
  staff: { id: member.id, name: member.name },
  status: assignment.takenOffAt ? "taken_off" : assignment.status,
  offeredAt: assignment.offeredAt.toISOString(),
  answeredAt: assignment.answeredAt?.toISOString() ?? null,
});

// a Job, on the Schedule or Cancelled, with everyone Offered a place on it,
// the Cleaners who could be, who its Open Places are open to, what cancelling or moving it would cost, any
// request to move it, and once it has
// happened or been Cancelled, how it went and its payment, and whether its
// Property can be offered a Service Plan from it
export const officeJob = async (jobId: string): Promise<OfficeJob> => {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!row) throw new NotFoundError("Job not found");

  const [
    job,
    rows,
    addOns,
    day,
    cleaners,
    completion,
    cancellation,
    noAccess,
    cancelTerms,
    rescheduleTerms,
    rescheduleRequest,
    canOfferServicePlan,
    servicePlanId,
    openTo,
    weeklyBill,
  ] = await Promise.all([
    jobView(jobId),
    db
      .select({ assignment: assignments, member: staff })
      .from(assignments)
      .innerJoin(staff, eq(staff.id, assignments.staffId))
      .where(eq(assignments.jobId, jobId))
      .orderBy(asc(assignments.offeredAt), asc(assignments.createdAt)),
    addOnsOf([jobId]),
    scheduleOn(row.startsAt),
    db
      .select({ id: staff.id, name: staff.name, roles: staff.roles })
      .from(staff)
      .where(eq(staff.active, true))
      .orderBy(asc(staff.name)),
    officeCompletionOf(row),
    cancellationOf(row),
    noAccessOf(row),
    cancelTermsOf(row),
    rescheduleTermsOf(row),
    rescheduleRequestOf(row),
    row.status === "completed" && firstCleanCompleted(row.propertyId),
    planOfJob(jobId),
    openToOf(row),
    weeklyBillOfJob(row, db),
  ]);

  const holding = rows.filter((r) => holdsPlace(r.assignment.status));
  const released = rows.filter((r) => !holdsPlace(r.assignment.status));
  const onJob = new Set(holding.map((r) => r.member.id));
  const hoursOf = new Map(day.available.map((c) => [c.id, c.hours]));

  return {
    ...job,
    completion,
    cancellation,
    noAccess,
    cancelTerms,
    rescheduleTerms,
    rescheduleRequest,
    weeklyBill,
    addOns: addOns.get(jobId)!,
    assignments: [...holding, ...released].map((r) =>
      toView(r.assignment, r.member),
    ),
    openPlaces: Math.max(row.crewSize - holding.length, 0),
    openTo,
    cleaners: cleaners
      .filter((c) => c.roles.includes("cleaner") && !onJob.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, hours: hoursOf.get(c.id) ?? 0 })),
    canOfferServicePlan,
    servicePlanId,
  };
};

/**
 * Office Staff Offer a place on a booked Job to an active Cleaner, who is
 * emailed. Office Staff who are Cleaners too may take a place themselves,
 * which is Confirmed at once: there's nobody to ask. Refused once the Job has
 * started, when every place is held, when the Cleaner already holds one, or
 * when they aren't free for it (ADR-0019), so they could never Confirm it.
 */
export const offerAssignment = async (
  jobId: string,
  staffId: string,
  byAccountId: string,
): Promise<OfficeJob> => {
  const offered = await db.transaction(async (tx) => {
    // one change to a Job's places at a time, so two Offers can't both take
    // its last place
    const [job] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "booked")))
      .for("update");
    if (!job) throw new NotFoundError("Job not found");

    // theirs too, so two Offers at once can't overlap
    const [member] = await tx
      .select()
      .from(staff)
      .where(eq(staff.id, staffId))
      .for("update");
    if (!member) throw new NotFoundError("Staff member not found");

    const day = await scheduleOn(job.startsAt, tx);
    const refusal = whyNotOffer(day, jobId, member, clock.now());
    if (refusal) throw new ConflictError(refusal);

    const self = member.accountId === byAccountId;
    const now = clock.now();
    await tx.insert(assignments).values({
      jobId,
      staffId,
      status: self ? "confirmed" : "offered",
      offeredAt: now,
      answeredAt: self ? now : null,
    });
    return { member, self };
  });

  if (!offered.self) {
    const { job, property } = await findJob(jobId);
    await emailOffer(offered.member, job, property);
  }
  return officeJob(jobId);
};

// tells a Cleaner they've been offered a place, once it's saved
export const emailOffer = (
  member: { id: string; name: string; email: string },
  job: Job,
  property: Property,
) =>
  notify(`Offer of Job ${job.id} to Staff ${member.id}`, async () =>
    email.send({
      to: member.email,
      ...offerEmail({
        name: member.name,
        jobId: job.id,
        clean: await cleanOf(job, property),
      }),
    }),
  );

// Office Staff take someone off a Job, Offered or Confirmed, opening their
// place to everyone free for it but them, as a Release does (#242): Office
// Staff can still Offer it to them. They're emailed unless they took
// themselves off, and so is anyone free for it, if the Job is within 48 hours
export const removeAssignment = async (
  jobId: string,
  assignmentId: string,
  byAccountId: string,
): Promise<OfficeJob> => {
  const { job, property } = await findJob(jobId);
  const removed = await db.transaction(async (tx) => {
    // one change to a Job's places at a time, as Offering takes
    await tx.select().from(jobs).where(eq(jobs.id, jobId)).for("update");
    const now = clock.now();
    const [removed] = await tx
      .update(assignments)
      .set({ status: "released", answeredAt: now, takenOffAt: now })
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.jobId, jobId),
          onCrew(),
        ),
      )
      .returning();
    return removed;
  });
  if (!removed) throw new NotFoundError("Assignment not found");
  await placeReopened(jobId);

  const [member] = await db
    .select()
    .from(staff)
    .where(eq(staff.id, removed.staffId));
  if (member && member.accountId !== byAccountId) {
    await notify(`Removal from Job ${jobId} to Staff ${member.id}`, async () =>
      email.send({
        to: member.email,
        ...takenOffEmail({
          name: member.name,
          clean: await cleanOf(job, property),
        }),
      }),
    );
  }
  await notify(`Open Places email for Job ${jobId}`, async () => {
    await emailOpenPlaces();
  });
  return officeJob(jobId);
};

// ---- the Cleaner ----

// the Jobs a Cleaner holds a place on, booked or Completed, from the start of
// today, soonest first
const cleanerJobs = async (
  staffId: string,
  jobId?: string,
): Promise<CleanerJob[]> => {
  const mine = await db
    .select({ assignment: assignments, job: jobs, property: properties })
    .from(assignments)
    .innerJoin(jobs, eq(jobs.id, assignments.jobId))
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(
      and(
        eq(assignments.staffId, staffId),
        onCrew(),
        onSchedule(),
        gte(jobs.startsAt, startOfDay(dayOf(clock.now()))),
        jobId ? eq(jobs.id, jobId) : undefined,
      ),
    )
    .orderBy(asc(jobs.startsAt));
  if (mine.length === 0) return [];

  const jobIds = mine.map((m) => m.job.id);
  const [crews, owners, addOns, completions] = await Promise.all([
    db
      .select({
        jobId: assignments.jobId,
        name: staff.name,
        status: assignments.status,
      })
      .from(assignments)
      .innerJoin(staff, eq(staff.id, assignments.staffId))
      .where(and(inArray(assignments.jobId, jobIds), onCrew()))
      .orderBy(asc(assignments.offeredAt), asc(assignments.createdAt)),
    db
      .select({ propertyId: properties.id, client: clients })
      .from(properties)
      .innerJoin(clients, eq(clients.id, properties.clientId))
      .where(
        inArray(
          properties.id,
          mine.map((m) => m.property.id),
        ),
      ),
    addOnsOf(jobIds),
    cleanerCompletionsOf(mine.map((m) => m.job)),
  ]);
  const versions = await serviceVersions(mine.map((m) => m.job.serviceId));
  const now = clock.now();
  const clientOf = new Map(owners.map((o) => [o.propertyId, o.client]));
  const today = dayOf(clock.now());

  return mine.map(({ assignment, job, property }) => {
    const client = clientOf.get(property.id)!;
    const status = assignment.status as HoldingState;
    const { assigned, ...completion } = completions.get(job.id)!;
    return {
      id: job.id,
      startsAt: job.startsAt.toISOString(),
      serviceName: versions.get(job.serviceId)!.name,
      hoursOnSite: hoursOnSiteOf(job),
      addOns: addOns.get(job.id)!,
      property: {
        street: property.street,
        unit: property.unit,
        postcode: property.postcode,
        accessInstructions: property.accessInstructions,
      },
      client: {
        firstName: firstNameOf(client.name),
        phone: dayOf(job.startsAt) === today ? client.phone : null,
      },
      crew: crews
        .filter((c) => c.jobId === job.id)
        .map((c) => ({
          name: c.name,
          status: c.status as HoldingState,
        })),
      assignment: {
        id: assignment.id,
        status,
        canRelease:
          job.status === "booked" &&
          (status === "offered" || !releaseClosed(job, now)),
      },
      ...completion,
      started: job.startsAt <= now,
      canComplete:
        status === "confirmed" &&
        assigned &&
        job.status === "booked" &&
        job.startsAt <= now,
      canRecordNoAccess:
        status === "confirmed" &&
        job.status === "booked" &&
        job.startsAt <= now,
    };
  });
};

// a Cleaner's Jobs today and to come
export const jobsAssignedTo = async (staffId: string): Promise<CleanerJobs> => {
  const mine = await cleanerJobs(staffId);
  const today = dayOf(clock.now());
  return {
    today: mine.filter((job) => dayOf(new Date(job.startsAt)) === today),
    upcoming: mine.filter((job) => dayOf(new Date(job.startsAt)) !== today),
  };
};

// one Job a Cleaner holds a place on; to anyone else it doesn't exist
export const jobAssignedTo = async (staffId: string, jobId: string) => {
  const [job] = await cleanerJobs(staffId, jobId);
  if (!job) throw new NotFoundError("Job not found");
  return job;
};

// The Cleaner's own place, Offered or Confirmed, on a booked Job, held with
// its Job until the transaction ends: one change to a Job's places at a
// time, as Offering and moving it take (#242). A place on a Cancelled Job,
// or one taken off them, is gone.
const lockOwn = async (tx: Tx, staffId: string, assignmentId: string) => {
  const [mine] = await tx
    .select({ jobId: assignments.jobId })
    .from(assignments)
    .where(
      and(eq(assignments.id, assignmentId), eq(assignments.staffId, staffId)),
    );
  if (!mine) throw new NotFoundError("Assignment not found");
  // held first, then read afresh, so a move or removal meanwhile is seen
  await tx
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.id, mine.jobId))
    .for("update");
  const [found] = await tx
    .select({ assignment: assignments, job: jobs, property: properties })
    .from(assignments)
    .innerJoin(jobs, eq(jobs.id, assignments.jobId))
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(
      and(
        eq(assignments.id, assignmentId),
        eq(assignments.staffId, staffId),
        onCrew(),
        eq(jobs.status, "booked"),
      ),
    );
  if (!found) throw new NotFoundError("Assignment not found");
  return found;
};

// taken off by the Office, or freed by a day off, meanwhile
const gone = () => new NotFoundError("Assignment not found");

/**
 * The Cleaner takes the place they were Offered, at the time they were
 * shown (`seen`): if the Job has moved since, they're asked to look again
 * (#242). Refused once the Job has started, or if they're no longer free
 * for it (ADR-0019). Confirming again changes nothing.
 */
export const confirmAssignment = async (
  staffId: string,
  assignmentId: string,
  seen?: Date,
): Promise<CleanerJob> => {
  const jobId = await db.transaction(async (tx) => {
    const { assignment, job } = await lockOwn(tx, staffId, assignmentId);
    if (assignment.status === "confirmed") return job.id;
    // theirs too, so they can't take two Jobs at once that overlap
    await tx.select().from(staff).where(eq(staff.id, staffId)).for("update");
    const day = await scheduleOn(job.startsAt, tx);
    const refusal = whyNotConfirm(day, job.id, staffId, seen, clock.now());
    if (refusal) throw new ConflictError(refusal);
    const [confirmed] = await tx
      .update(assignments)
      .set({ status: "confirmed", answeredAt: clock.now() })
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.status, "offered"),
        ),
      )
      .returning();
    if (!confirmed) throw gone();
    return job.id;
  });
  return jobAssignedTo(staffId, jobId);
};

/**
 * The Cleaner gives up their place, and it opens to every free Cleaner but
 * them (ADR-0019); the Office is emailed. An Offered place can be Released
 * at any time; a Confirmed one only until 48 hours before the Job.
 */
export const releaseAssignment = async (
  staffId: string,
  assignmentId: string,
) => {
  const { job, property } = await db.transaction(async (tx) => {
    const found = await lockOwn(tx, staffId, assignmentId);
    const refusal = whyNotRelease(
      found.assignment.status,
      found.job,
      clock.now(),
    );
    if (refusal) throw new ConflictError(refusal);
    const [released] = await tx
      .update(assignments)
      .set({ status: "released", answeredAt: clock.now() })
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.status, found.assignment.status),
        ),
      )
      .returning();
    if (!released) throw gone();
    return found;
  });
  await placeReopened(job.id);

  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));
  await tellOfficeStaff(
    `Release of Job ${job.id} by Staff ${staffId}`,
    async () =>
      releasedEmail({
        cleaner: member!.name,
        jobId: job.id,
        clean: await cleanOf(job, property),
      }),
  );
  await notify(`Open Places email for Job ${job.id}`, async () => {
    await emailOpenPlaces();
  });
};

// Booked Jobs from the start of today to `hours` from now whose places
// aren't all Confirmed, soonest first. Each needs attention from when it came
// within `hours` of starting, or was booked, whichever is later.
export const unassignedJobsWithin = async (hours: number) => {
  const now = clock.now();
  const soon = await scheduledJobs(
    and(
      gte(jobs.startsAt, startOfDay(dayOf(now))),
      lte(jobs.startsAt, new Date(now.getTime() + hours * HOUR_MS)),
    ),
  );
  const unassigned = soon.filter(
    (job) => job.status === "booked" && job.assignment === "unassigned",
  );
  if (unassigned.length === 0) return [];

  const booked = await db
    .select({ id: jobs.id, bookedAt: jobs.bookedAt })
    .from(jobs)
    .where(
      inArray(
        jobs.id,
        unassigned.map((j) => j.id),
      ),
    );
  const bookedAt = new Map(booked.map((b) => [b.id, b.bookedAt.getTime()]));
  return unassigned.map((job) => ({
    job,
    since: new Date(
      Math.max(
        bookedAt.get(job.id)!,
        Date.parse(job.startsAt) - hours * HOUR_MS,
      ),
    ).toISOString(),
  }));
};
