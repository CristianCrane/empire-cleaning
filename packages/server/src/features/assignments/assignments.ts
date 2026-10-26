import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import type {
  AssignmentView,
  CleanerJob,
  CleanerJobs,
  OfficeJob,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import env from "../../env.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock, dayOf, startOfDay } from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatWhen,
} from "../../services/email/index.ts";
import {
  cancellationOf,
  cancelTermsOf,
  noAccessOf,
} from "../cancellation/cancellation.ts";
import { clients } from "../clients/clients.schema.ts";
import {
  cleanerCompletionsOf,
  officeCompletionOf,
} from "../completion/completion.ts";
import { addOnsOf } from "../jobs/add-ons.ts";
import { onSchedule } from "../jobs/jobs.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { jobViews, scheduleFor, scheduledJobs } from "../jobs/schedule.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import {
  rescheduleRequestOf,
  rescheduleTermsOf,
} from "../reschedule/reschedule.ts";
import { staff } from "../staff/staff.schema.ts";
import { officeStaffEmails } from "../staff/staff.ts";
import { assignments, type Assignment } from "./assignments.schema.ts";

// a Confirmed place can't be Released this close to the Job: the Office needs
// time to find someone else
export const RELEASE_CUTOFF_HOURS = 48;

const cleanTypeLabel = { deep: "Deep Clean", standard: "Standard Clean" };

// "the Deep Clean at 41-12 Austin St, 4B, 11375, Monday, January 12 at 9:00 AM"
const describe = (job: Job, property: Property) =>
  `the ${cleanTypeLabel[job.cleanType]} at ${addressOf(property)}, ${formatWhen(job.startsAt)}`;

const releaseClosed = (job: Job) =>
  job.startsAt.getTime() - clock.now().getTime() <
  RELEASE_CUTOFF_HOURS * 3_600_000;

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

// emails go out after the change is saved; one that fails is logged, and the
// change stands
const notify = async (what: string, send: () => Promise<void>) => {
  try {
    await send();
  } catch (error) {
    console.error(`${what} not sent:`, error);
  }
};

// ---- the Office ----

const toView = (
  assignment: Assignment,
  member: { id: string; name: string },
): AssignmentView => ({
  id: assignment.id,
  staff: { id: member.id, name: member.name },
  status: assignment.status,
  offeredAt: assignment.offeredAt.toISOString(),
  answeredAt: assignment.answeredAt?.toISOString() ?? null,
});

// a Job, on the Schedule or Cancelled, with everyone Offered a place on it,
// the Cleaners who could be, what cancelling or moving it would cost, any
// request to move it, and once it has
// happened or been Cancelled, how it went and its payment
export const officeJob = async (jobId: string): Promise<OfficeJob> => {
  const [job] = await jobViews(eq(jobs.id, jobId));
  if (!job) throw new NotFoundError("Job not found");

  const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const [
    rows,
    addOns,
    [day],
    cleaners,
    completion,
    cancellation,
    noAccess,
    cancelTerms,
    rescheduleTerms,
    rescheduleRequest,
  ] = await Promise.all([
    db
      .select({ assignment: assignments, member: staff })
      .from(assignments)
      .innerJoin(staff, eq(staff.id, assignments.staffId))
      .where(eq(assignments.jobId, jobId))
      .orderBy(asc(assignments.offeredAt), asc(assignments.createdAt)),
    addOnsOf([jobId]),
    scheduleFor(dayOf(new Date(job.startsAt)), dayOf(new Date(job.startsAt))),
    db
      .select({ id: staff.id, name: staff.name, roles: staff.roles })
      .from(staff)
      .where(eq(staff.active, true))
      .orderBy(asc(staff.name)),
    officeCompletionOf(row!),
    cancellationOf(row!),
    noAccessOf(row!),
    cancelTermsOf(row!),
    rescheduleTermsOf(row!),
    rescheduleRequestOf(row!),
  ]);

  const holding = rows.filter((r) => r.assignment.status !== "released");
  const released = rows.filter((r) => r.assignment.status === "released");
  const onJob = new Set(holding.map((r) => r.member.id));
  const hoursOf = new Map(day!.available.map((c) => [c.id, c.hours]));

  return {
    ...job,
    completion,
    cancellation,
    noAccess,
    cancelTerms,
    rescheduleTerms,
    rescheduleRequest,
    addOns: addOns.get(jobId)!,
    assignments: [...holding, ...released].map((r) =>
      toView(r.assignment, r.member),
    ),
    openPlaces: Math.max(job.crewSize - holding.length, 0),
    cleaners: cleaners
      .filter((c) => c.roles.includes("cleaner") && !onJob.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, hours: hoursOf.get(c.id) ?? 0 })),
  };
};

/**
 * Office Staff Offer a place on a booked Job to an active Cleaner, who is
 * emailed. Office Staff who are Cleaners too may take a place themselves,
 * which is Confirmed at once: there's nobody to ask. Refused once the Job has
 * started, when every place is held, or when the Cleaner already holds one.
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
    if (job.startsAt <= clock.now()) {
      throw new ConflictError("This Job has already started");
    }

    const [member] = await tx.select().from(staff).where(eq(staff.id, staffId));
    if (!member) throw new NotFoundError("Staff member not found");
    if (!member.active || !member.roles.includes("cleaner")) {
      throw new ConflictError(`${member.name} isn't an active Cleaner`);
    }

    const holding = await tx
      .select({ staffId: assignments.staffId })
      .from(assignments)
      .where(
        and(eq(assignments.jobId, jobId), ne(assignments.status, "released")),
      );
    if (holding.some((h) => h.staffId === staffId)) {
      throw new ConflictError(`${member.name} already has a place on this Job`);
    }
    if (holding.length >= job.crewSize) {
      throw new ConflictError(
        job.crewSize === 1
          ? "This Job's place is taken"
          : `All ${job.crewSize} places on this Job are taken`,
      );
    }

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
    const { member } = offered;
    await notify(`Offer of Job ${jobId} to Staff ${member.id}`, () =>
      email.send({
        to: member.email,
        subject: "You've been offered a Job",
        ...compose(
          [
            `Hi ${firstNameOf(member.name)},`,
            `You've been offered a place on ${describe(job, property)}.`,
            "Please confirm it, or release it if you can't make it.",
          ],
          {
            href: `${env.CORS_ORIGIN_URL}/cleaner/jobs/${jobId}`,
            label: "See the Job",
          },
        ),
      }),
    );
  }
  return officeJob(jobId);
};

// Office Staff take someone off a Job, Offered or Confirmed, freeing their
// place; they're emailed unless they took themselves off
export const removeAssignment = async (
  jobId: string,
  assignmentId: string,
  byAccountId: string,
): Promise<OfficeJob> => {
  const { job, property } = await findJob(jobId);
  const [removed] = await db
    .delete(assignments)
    .where(
      and(
        eq(assignments.id, assignmentId),
        eq(assignments.jobId, jobId),
        ne(assignments.status, "released"),
      ),
    )
    .returning();
  if (!removed) throw new NotFoundError("Assignment not found");

  const [member] = await db
    .select()
    .from(staff)
    .where(eq(staff.id, removed.staffId));
  if (member && member.accountId !== byAccountId) {
    await notify(`Removal from Job ${jobId} to Staff ${member.id}`, () =>
      email.send({
        to: member.email,
        subject: "You're no longer on a Job",
        ...compose(
          [
            `Hi ${firstNameOf(member.name)},`,
            `The Office has taken you off ${describe(job, property)}. You don't need to go.`,
          ],
          { href: `${env.CORS_ORIGIN_URL}/cleaner`, label: "See your Jobs" },
        ),
      }),
    );
  }
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
        ne(assignments.status, "released"),
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
      .where(
        and(
          inArray(assignments.jobId, jobIds),
          ne(assignments.status, "released"),
        ),
      )
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
  const now = clock.now();
  const clientOf = new Map(owners.map((o) => [o.propertyId, o.client]));
  const today = dayOf(clock.now());

  return mine.map(({ assignment, job, property }) => {
    const client = clientOf.get(property.id)!;
    const status = assignment.status as "offered" | "confirmed";
    const { assigned, ...completion } = completions.get(job.id)!;
    return {
      id: job.id,
      startsAt: job.startsAt.toISOString(),
      cleanType: job.cleanType,
      hoursOnSite: Math.round((job.labourHours / job.crewSize) * 100) / 100,
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
          status: c.status as "offered" | "confirmed",
        })),
      assignment: {
        id: assignment.id,
        status,
        canRelease:
          job.status === "booked" &&
          (status === "offered" || !releaseClosed(job)),
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

// the Cleaner's own Assignment, Offered or Confirmed, with its Job
const ownAssignment = async (staffId: string, assignmentId: string) => {
  const [found] = await db
    .select({ assignment: assignments, job: jobs, property: properties })
    .from(assignments)
    .innerJoin(jobs, eq(jobs.id, assignments.jobId))
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(
      and(
        eq(assignments.id, assignmentId),
        eq(assignments.staffId, staffId),
        ne(assignments.status, "released"),
      ),
    );
  if (!found) throw new NotFoundError("Assignment not found");
  return found;
};

// the Cleaner takes the place they were Offered; Confirming again changes
// nothing
export const confirmAssignment = async (
  staffId: string,
  assignmentId: string,
): Promise<CleanerJob> => {
  const { assignment } = await ownAssignment(staffId, assignmentId);
  await db
    .update(assignments)
    .set({ status: "confirmed", answeredAt: clock.now() })
    .where(
      and(eq(assignments.id, assignmentId), eq(assignments.status, "offered")),
    );
  return jobAssignedTo(staffId, assignment.jobId);
};

/**
 * The Cleaner gives up their place, freeing it, and the Office is emailed to
 * find someone else. An Offered place can be Released at any time; a
 * Confirmed one only until 48 hours before the Job.
 */
export const releaseAssignment = async (
  staffId: string,
  assignmentId: string,
) => {
  const { assignment, job, property } = await ownAssignment(
    staffId,
    assignmentId,
  );
  if (assignment.status === "confirmed" && releaseClosed(job)) {
    throw new ConflictError(
      `A Confirmed place can't be released within ${RELEASE_CUTOFF_HOURS} hours of the Job. Please call the Office.`,
    );
  }
  const [released] = await db
    .update(assignments)
    .set({ status: "released", answeredAt: clock.now() })
    .where(
      and(
        eq(assignments.id, assignmentId),
        eq(assignments.status, assignment.status),
      ),
    )
    .returning();
  // taken off by the Office, or Released, meanwhile
  if (!released) throw new NotFoundError("Assignment not found");

  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));
  await notify(`Release of Job ${job.id} by Staff ${staffId}`, async () => {
    for (const to of await officeStaffEmails()) {
      await email.send({
        to,
        subject: `${member!.name} released a place on a Job`,
        ...compose(
          [
            `${member!.name} has released their place on ${describe(job, property)}.`,
            "The place is free for someone else.",
          ],
          {
            href: `${env.CORS_ORIGIN_URL}/office/jobs/${job.id}`,
            label: "Offer the place",
          },
        ),
      });
    }
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
      lte(jobs.startsAt, new Date(now.getTime() + hours * 3_600_000)),
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
        Date.parse(job.startsAt) - hours * 3_600_000,
      ),
    ).toISOString(),
  }));
};
