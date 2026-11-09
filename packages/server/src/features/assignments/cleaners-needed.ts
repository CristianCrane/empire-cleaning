import { and, arrayContains, asc, eq, inArray, lt } from "drizzle-orm";
import type { CleanerNeeded } from "@empire-cleaning/models";
import { addDays, dayOf, HOUR_MS, timeOf } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock } from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { scheduleFor } from "../jobs/schedule.ts";
import { cleanersNeededEmail } from "./emails.ts";
import { staff } from "../staff/staff.schema.ts";
import {
  assignments,
  cleanerNeededDigests,
  cleanerNeededEmails,
  cleanerNeededPasses,
} from "./assignments.schema.ts";
import {
  CLEANER_NEEDED_DAYS,
  openingOf,
  opensAt,
  neededOpen,
  whyNotTakeCleanerNeeded,
} from "./rules.ts";
import { monitoring } from "../../services/monitoring/index.ts";

// a Cleaner Needed on a Job starting this close is emailed at once, not in the
// next morning's email
const URGENT_HOURS = 48;

// the morning email of Cleaners Needed goes out from this time, New York
const MORNING_EMAIL_TIME = "07:00";

// Each Job's Assignments, Released ones too, and who said "Not for me" to it
const assignedTo = async (jobIds: string[], tx: Tx | typeof db) => {
  // one after the other, as a transaction's queries share one connection
  // (ADR-0024)
  const assigned = await tx
    .select({
      jobId: assignments.jobId,
      staffId: assignments.staffId,
      status: assignments.status,
    })
    .from(assignments)
    .where(inArray(assignments.jobId, jobIds));
  const passes = await tx
    .select()
    .from(cleanerNeededPasses)
    .where(inArray(cleanerNeededPasses.jobId, jobIds));
  return { assigned, passes };
};

/**
 * Every Job whose Cleaners Needed are open now (neededOpen: booked, within 7
 * days, not yet started) that needs Cleaners, soonest first, and the active
 * Cleaners each is open to (openingOf). Worked out when asked, never stored,
 * so someone who becomes free later sees them, and a Job with its whole crew leaves
 * everyone's list at once.
 */
const openings = async (jobId?: string, tx: Tx | typeof db = db) => {
  const now = clock.now();
  const today = dayOf(now);
  // a day over the window: the week the clocks spring forward is an hour
  // short of seven days, so now + 7 days can fall on the day after
  const days = await scheduleFor(
    today,
    addDays(today, CLEANER_NEEDED_DAYS + 1),
    tx,
  );
  const soon = days
    .flatMap((day) =>
      day.jobs
        .filter((job) => (!jobId || job.id === jobId) && neededOpen(job, now))
        .map((job) => ({ day, job })),
    )
    .sort(
      (a, b) =>
        Date.parse(a.job.startsAt) - Date.parse(b.job.startsAt) ||
        (a.job.id < b.job.id ? -1 : 1),
    );
  if (soon.length === 0) return [];

  const { assigned, passes } = await assignedTo(
    soon.map((s) => s.job.id),
    tx,
  );
  return soon.flatMap(({ day, job }) => {
    const onJob = assigned.filter((p) => p.jobId === job.id);
    const passedBy = passes
      .filter((p) => p.jobId === job.id)
      .map((p) => p.staffId);
    const opening = openingOf(day, job, onJob, passedBy);
    return opening ? [{ job, assigned: onJob, ...opening }] : [];
  });
};

type Opening = Awaited<ReturnType<typeof openings>>[number];

const toCleanersNeeded = (open: Opening[]): CleanerNeeded[] =>
  open.map(({ job }) => ({
    jobId: job.id,
    startsAt: job.startsAt,
    serviceName: job.serviceName,
    hoursOnSite: job.hoursOnSite,
    crewSize: job.crewSize,
    postcode: job.property.postcode,
  }));

// the Cleaners Needed open to a Cleaner now, soonest first
export const cleanersNeededFor = async (staffId: string) =>
  toCleanersNeeded(
    (await openings()).filter((o) => o.openTo.includes(staffId)),
  );

// one Cleaner Needed open to a Cleaner; to anyone else it doesn't exist
export const cleanerNeededFor = async (staffId: string, jobId: string) => {
  const [needed] = toCleanersNeeded(
    (await openings(jobId)).filter((o) => o.openTo.includes(staffId)),
  );
  if (!needed) throw new NotFoundError("Job not found");
  return needed;
};

// a Job's Cleaners Needed as Office Staff see them: when they open, how many
// free Cleaners they're open to now, and who said "Not for me"
export const openToOf = async (
  job: Pick<Job, "id" | "startsAt" | "status">,
) => {
  const [[opening], passedBy] = await Promise.all([
    job.status === "booked" ? openings(job.id) : [],
    db
      .select({ id: staff.id, name: staff.name })
      .from(cleanerNeededPasses)
      .innerJoin(staff, eq(staff.id, cleanerNeededPasses.staffId))
      .where(eq(cleanerNeededPasses.jobId, job.id))
      .orderBy(asc(cleanerNeededPasses.passedAt), asc(staff.name)),
  ]);
  return {
    opensAt: opensAt(job).toISOString(),
    opened: opensAt(job) <= clock.now(),
    cleaners: opening?.openTo.length ?? 0,
    passedBy,
  };
};

/**
 * A Cleaner takes a Cleaner Needed, at the time they were shown (`seen`):
 * first to Confirm wins. Under the Job's lock, so two can't both take its
 * last one, it checks again that the Job still needs a Cleaner and is still
 * open to them, and that it hasn't moved, and refuses otherwise. Their
 * Assignment is Confirmed at once.
 */
export const confirmCleanerNeeded = async (
  staffId: string,
  jobId: string,
  seen?: Date,
) => {
  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for("update");
    // and theirs, so they can't take two Jobs at once that overlap
    await tx.select().from(staff).where(eq(staff.id, staffId)).for("update");
    if (!job) throw new NotFoundError("Job not found");
    const [opening] = await openings(jobId, tx);
    const refusal = whyNotTakeCleanerNeeded(
      job,
      staffId,
      opening,
      seen,
      clock.now(),
    );
    if (refusal) throw new ConflictError(refusal);

    const now = clock.now();
    await tx.insert(assignments).values({
      jobId,
      staffId,
      status: "confirmed",
      offeredAt: now,
      answeredAt: now,
    });
  });
};

// A Cleaner says a Cleaner Needed open to them is "Not for me": it leaves their
// list, and they're never emailed about it again. Saying it twice changes
// nothing. To anyone it isn't open to, it doesn't exist.
export const passCleanerNeeded = async (staffId: string, jobId: string) => {
  const [passed] = await db
    .select()
    .from(cleanerNeededPasses)
    .where(
      and(
        eq(cleanerNeededPasses.jobId, jobId),
        eq(cleanerNeededPasses.staffId, staffId),
      ),
    );
  if (passed) return;
  const [opening] = await openings(jobId);
  if (!opening?.openTo.includes(staffId)) {
    throw new NotFoundError("Job not found");
  }
  await db
    .insert(cleanerNeededPasses)
    .values({ jobId, staffId, passedAt: clock.now() })
    .onConflictDoNothing();
};

// A Job needs a Cleaner again: everyone it's open to hears of it afresh
export const cleanerNeededAgain = async (jobId: string) => {
  await db
    .delete(cleanerNeededEmails)
    .where(eq(cleanerNeededEmails.jobId, jobId));
};

// ---- emails ----

const sendList = async (
  member: { id: string; name: string; email: string },
  soon: boolean,
  jobs: CleanerNeeded[],
) =>
  email.send({
    to: member.email,
    ...cleanersNeededEmail({ name: member.name, soon, jobs }),
  });

// The Cleaners whose morning email is due: from 7am, the first time this
// asks each day. Every active Cleaner's day is used up then, whether or not
// they get one, so a Job opening later waits for the next morning (unless
// it's within 48 hours).
const morningEmailsDue = async (today: string, time: string) => {
  if (time < MORNING_EMAIL_TIME) return new Set<string>();
  const cleaners = await db
    .select({ id: staff.id })
    .from(staff)
    .where(
      and(eq(staff.active, true), arrayContains(staff.roles, ["cleaner"])),
    );
  if (cleaners.length === 0) return new Set<string>();
  const due = await db
    .insert(cleanerNeededDigests)
    .values(cleaners.map((c) => ({ staffId: c.id, day: today })))
    .onConflictDoUpdate({
      target: cleanerNeededDigests.staffId,
      set: { day: today },
      setWhere: lt(cleanerNeededDigests.day, today),
    })
    .returning({ staffId: cleanerNeededDigests.staffId });
  return new Set(due.map((d) => d.staffId));
};

/**
 * Emails Cleaners about Cleaners Needed they haven't heard of. From 7am New
 * York, once a day, each Cleaner with a Job newly open to them gets one
 * email listing all their Cleaners Needed, new ones first. A Cleaner Needed
 * on a Job starting within 48 hours is emailed at once, at any hour. Jobs
 * they said "Not for me" to are never included. Safe to run as often as you
 * like, and on more than one server: each Job is claimed for each Cleaner before its
 * email goes, and let go again if the email fails.
 *
 * The timer in src/scheduler.ts calls this, and so do changes that leave a
 * Cleaner Needed.
 */
export const emailCleanersNeeded = async () => {
  const now = clock.now();
  const digestDue = await morningEmailsDue(dayOf(now), timeOf(now));
  const open = await openings();
  const staffIds = [...new Set(open.flatMap((o) => o.openTo))];
  if (staffIds.length === 0) return 0;

  const [members, emailed] = await Promise.all([
    db
      .select({ id: staff.id, name: staff.name, email: staff.email })
      .from(staff)
      .where(inArray(staff.id, staffIds)),
    db
      .select()
      .from(cleanerNeededEmails)
      .where(
        inArray(
          cleanerNeededEmails.jobId,
          open.map((o) => o.job.id),
        ),
      ),
  ]);
  const told = new Set(emailed.map((e) => `${e.jobId} ${e.staffId}`));
  const urgentBy = now.getTime() + URGENT_HOURS * HOUR_MS;

  let sent = 0;
  for (const member of members) {
    const theirs = open.filter((o) => o.openTo.includes(member.id));
    const fresh = theirs.filter((o) => !told.has(`${o.job.id} ${member.id}`));
    if (fresh.length === 0) continue;

    const digest = digestDue.has(member.id);
    const urgent = fresh.filter((o) => Date.parse(o.job.startsAt) <= urgentBy);
    const telling = digest ? fresh : urgent;
    if (telling.length === 0) continue;

    const claimed = await db
      .insert(cleanerNeededEmails)
      .values(
        telling.map((o) => ({
          jobId: o.job.id,
          staffId: member.id,
          emailedAt: now,
        })),
      )
      .onConflictDoNothing()
      .returning({ jobId: cleanerNeededEmails.jobId });
    const claimedIds = new Set(claimed.map((c) => c.jobId));
    const isNew = (o: Opening) => claimedIds.has(o.job.id);
    if (claimedIds.size === 0) continue;

    try {
      if (digest) {
        await sendList(
          member,
          false,
          toCleanersNeeded([
            ...theirs.filter(isNew),
            ...theirs.filter((o) => !isNew(o)),
          ]),
        );
      } else {
        await sendList(member, true, toCleanersNeeded(theirs.filter(isNew)));
      }
      sent += 1;
    } catch (error) {
      monitoring.error(error, {
        what: `Cleaners Needed email to Staff ${member.id} not sent`,
      });
      await db
        .delete(cleanerNeededEmails)
        .where(
          and(
            eq(cleanerNeededEmails.staffId, member.id),
            inArray(cleanerNeededEmails.jobId, [...claimedIds]),
          ),
        );
    }
  }
  return sent;
};
