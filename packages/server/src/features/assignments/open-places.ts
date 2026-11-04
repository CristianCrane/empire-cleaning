import { and, arrayContains, asc, eq, inArray, lt } from "drizzle-orm";
import type { OpenPlace } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import {
  addDays,
  clock,
  dayOf,
  HOUR_MS,
  timeOf,
} from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { scheduleFor } from "../jobs/schedule.ts";
import { openPlacesEmail } from "./emails.ts";
import { staff } from "../staff/staff.schema.ts";
import {
  assignments,
  openPlaceDigests,
  openPlaceEmails,
  openPlacePasses,
} from "./assignments.schema.ts";
import {
  OPEN_PLACE_DAYS,
  openingOf,
  opensAt,
  placesOpen,
  whyNotTakeOpenPlace,
} from "./rules.ts";
import { monitoring } from "../../services/monitoring/index.ts";

// an Open Place on a Job starting this close is emailed at once, not in the
// next morning's email
const URGENT_OPEN_PLACE_HOURS = 48;

// the morning email of Open Places goes out from this time, New York
const OPEN_PLACES_EMAIL_TIME = "07:00";

// Each Job's Assignments, Released ones too, and who said "Not for me" to it
const placesOn = async (jobIds: string[], tx: Tx | typeof db) => {
  // one after the other, as a transaction's queries share one connection
  // (ADR-0024)
  const places = await tx
    .select({
      jobId: assignments.jobId,
      staffId: assignments.staffId,
      status: assignments.status,
    })
    .from(assignments)
    .where(inArray(assignments.jobId, jobIds));
  const passes = await tx
    .select()
    .from(openPlacePasses)
    .where(inArray(openPlacePasses.jobId, jobIds));
  return { places, passes };
};

/**
 * Every Job whose places are open now (placesOpen: booked, within 7 days,
 * not yet started) with places nobody holds, soonest first, and the active
 * Cleaners each is open to (openingOf). Worked out when asked, never stored,
 * so someone who becomes free later sees them, and a filled place leaves
 * everyone's list at once.
 */
const openings = async (jobId?: string, tx: Tx | typeof db = db) => {
  const now = clock.now();
  const today = dayOf(now);
  const days = await scheduleFor(today, addDays(today, OPEN_PLACE_DAYS), tx);
  const soon = days
    .flatMap((day) =>
      day.jobs
        .filter(
          (job) =>
            (!jobId || job.id === jobId) &&
            placesOpen({ ...job, startsAt: new Date(job.startsAt) }, now),
        )
        .map((job) => ({ day, job })),
    )
    .sort(
      (a, b) =>
        Date.parse(a.job.startsAt) - Date.parse(b.job.startsAt) ||
        (a.job.id < b.job.id ? -1 : 1),
    );
  if (soon.length === 0) return [];

  const { places, passes } = await placesOn(
    soon.map((s) => s.job.id),
    tx,
  );
  return soon.flatMap(({ day, job }) => {
    const onJob = places.filter((p) => p.jobId === job.id);
    const passedBy = passes
      .filter((p) => p.jobId === job.id)
      .map((p) => p.staffId);
    const opening = openingOf(day, job, onJob, passedBy);
    return opening ? [{ job, places: onJob, ...opening }] : [];
  });
};

type Opening = Awaited<ReturnType<typeof openings>>[number];

const toOpenPlaces = (open: Opening[]): OpenPlace[] =>
  open.map(({ job }) => ({
    jobId: job.id,
    startsAt: job.startsAt,
    serviceName: job.serviceName,
    hoursOnSite: job.hoursOnSite,
    crewSize: job.crewSize,
    postcode: job.property.postcode,
  }));

// the Open Places open to a Cleaner now, soonest first
export const openPlacesFor = async (staffId: string) =>
  toOpenPlaces((await openings()).filter((o) => o.openTo.includes(staffId)));

// one Open Place open to a Cleaner; to anyone else it doesn't exist
export const openPlaceFor = async (staffId: string, jobId: string) => {
  const [place] = toOpenPlaces(
    (await openings(jobId)).filter((o) => o.openTo.includes(staffId)),
  );
  if (!place) throw new NotFoundError("Job not found");
  return place;
};

// a Job's Open Places as Office Staff see them: when they open, how many
// free Cleaners they're open to now, and who said "Not for me"
export const openToOf = async (
  job: Pick<Job, "id" | "startsAt" | "status">,
) => {
  const [[opening], passedBy] = await Promise.all([
    job.status === "booked" ? openings(job.id) : [],
    db
      .select({ id: staff.id, name: staff.name })
      .from(openPlacePasses)
      .innerJoin(staff, eq(staff.id, openPlacePasses.staffId))
      .where(eq(openPlacePasses.jobId, job.id))
      .orderBy(asc(openPlacePasses.passedAt), asc(staff.name)),
  ]);
  return {
    opensAt: opensAt(job).toISOString(),
    opened: opensAt(job) <= clock.now(),
    cleaners: opening?.openTo.length ?? 0,
    passedBy,
  };
};

/**
 * A Cleaner takes an Open Place, at the time they were shown (`seen`):
 * first to Confirm wins. Under the Job's lock, so two can't both take its
 * last place, it checks again that the place is still open and still open to
 * them, and that the Job hasn't moved, and refuses otherwise. Their place is
 * Confirmed at once.
 */
export const confirmOpenPlace = async (
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
    const refusal = whyNotTakeOpenPlace(
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

// A Cleaner says an Open Place open to them is "Not for me": it leaves their
// list, and they're never emailed about it again. Saying it twice changes
// nothing. To anyone it isn't open to, it doesn't exist.
export const passOpenPlace = async (staffId: string, jobId: string) => {
  const [passed] = await db
    .select()
    .from(openPlacePasses)
    .where(
      and(
        eq(openPlacePasses.jobId, jobId),
        eq(openPlacePasses.staffId, staffId),
      ),
    );
  if (passed) return;
  const [opening] = await openings(jobId);
  if (!opening?.openTo.includes(staffId)) {
    throw new NotFoundError("Job not found");
  }
  await db
    .insert(openPlacePasses)
    .values({ jobId, staffId, passedAt: clock.now() })
    .onConflictDoNothing();
};

// A place on a Job opened again: everyone it's open to hears of it afresh
export const placeReopened = async (jobId: string) => {
  await db.delete(openPlaceEmails).where(eq(openPlaceEmails.jobId, jobId));
};

// ---- emails ----

const sendList = async (
  member: { id: string; name: string; email: string },
  soon: boolean,
  places: OpenPlace[],
) =>
  email.send({
    to: member.email,
    ...openPlacesEmail({ name: member.name, soon, places }),
  });

// The Cleaners whose morning email is due: from 7am, the first time this
// asks each day. Every active Cleaner's day is used up then, whether or not
// they get one, so a place opening later waits for the next morning (unless
// it's within 48 hours).
const morningEmailsDue = async (today: string, time: string) => {
  if (time < OPEN_PLACES_EMAIL_TIME) return new Set<string>();
  const cleaners = await db
    .select({ id: staff.id })
    .from(staff)
    .where(
      and(eq(staff.active, true), arrayContains(staff.roles, ["cleaner"])),
    );
  if (cleaners.length === 0) return new Set<string>();
  const due = await db
    .insert(openPlaceDigests)
    .values(cleaners.map((c) => ({ staffId: c.id, day: today })))
    .onConflictDoUpdate({
      target: openPlaceDigests.staffId,
      set: { day: today },
      setWhere: lt(openPlaceDigests.day, today),
    })
    .returning({ staffId: openPlaceDigests.staffId });
  return new Set(due.map((d) => d.staffId));
};

/**
 * Emails Cleaners about Open Places they haven't heard of. From 7am New
 * York, once a day, each Cleaner with a newly open place gets one email
 * listing all their Open Places, new ones first. An Open Place on a Job
 * starting within 48 hours is emailed at once, at any hour. Places they said
 * "Not for me" to are never included. Safe to run as often as you like, and
 * on more than one server: each place is claimed for each Cleaner before its
 * email goes, and let go again if the email fails.
 *
 * The timer in src/scheduler.ts calls this, and so do changes that open a place.
 */
export const emailOpenPlaces = async () => {
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
      .from(openPlaceEmails)
      .where(
        inArray(
          openPlaceEmails.jobId,
          open.map((o) => o.job.id),
        ),
      ),
  ]);
  const told = new Set(emailed.map((e) => `${e.jobId} ${e.staffId}`));
  const urgentBy = now.getTime() + URGENT_OPEN_PLACE_HOURS * HOUR_MS;

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
      .insert(openPlaceEmails)
      .values(
        telling.map((o) => ({
          jobId: o.job.id,
          staffId: member.id,
          emailedAt: now,
        })),
      )
      .onConflictDoNothing()
      .returning({ jobId: openPlaceEmails.jobId });
    const claimedIds = new Set(claimed.map((c) => c.jobId));
    const isNew = (o: Opening) => claimedIds.has(o.job.id);
    if (claimedIds.size === 0) continue;

    try {
      if (digest) {
        await sendList(
          member,
          false,
          toOpenPlaces([
            ...theirs.filter(isNew),
            ...theirs.filter((o) => !isNew(o)),
          ]),
        );
      } else {
        await sendList(member, true, toOpenPlaces(theirs.filter(isNew)));
      }
      sent += 1;
    } catch (error) {
      monitoring.error(error, {
        what: `Open Places email to Staff ${member.id} not sent`,
      });
      await db
        .delete(openPlaceEmails)
        .where(
          and(
            eq(openPlaceEmails.staffId, member.id),
            inArray(openPlaceEmails.jobId, [...claimedIds]),
          ),
        );
    }
  }
  return sent;
};
