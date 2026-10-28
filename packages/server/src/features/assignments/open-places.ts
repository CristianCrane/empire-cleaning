import {
  and,
  arrayContains,
  asc,
  eq,
  gt,
  inArray,
  lt,
  lte,
  ne,
} from "drizzle-orm";
import type { OpenPlace } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock, dayOf, timeOf } from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { cleanerHours } from "../jobs/schedule.ts";
import { properties } from "../properties/properties.schema.ts";
import { serviceVersions } from "../services/services.ts";
import { openPlacesEmail } from "./emails.ts";
import { siteVisits } from "../site-visits/site-visits.schema.ts";
import { staff } from "../staff/staff.schema.ts";
import {
  assignments,
  openPlaceDigests,
  openPlaceEmails,
  openPlacePasses,
} from "./assignments.schema.ts";

// A Job's Open Places are open to free Cleaners from this many days before
// it starts (ADR-0019): who is free is only reliable nearer the day
export const OPEN_PLACE_DAYS = 7;

// an Open Place on a Job starting this close is emailed at once, not in the
// next morning's email
export const URGENT_OPEN_PLACE_HOURS = 48;

// the morning email of Open Places goes out from this time, New York
export const OPEN_PLACES_EMAIL_TIME = "07:00";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// when a Job's Open Places open to free Cleaners
export const opensAt = (job: Pick<Job, "startsAt">) =>
  new Date(job.startsAt.getTime() - OPEN_PLACE_DAYS * DAY_MS);

// from when to when a Job's crew are at work there, in milliseconds
const onSite = (job: Pick<Job, "startsAt" | "labourHours" | "crewSize">) => {
  const start = job.startsAt.getTime();
  return { start, end: start + (job.labourHours / job.crewSize) * HOUR_MS };
};

type Span = { start: number; end: number };

// The times each Staff member is busy from `from` to `to`: a place they
// hold on a booked Job (Offered or Confirmed), or a booked Site Visit they're
// making. A Job being moved can leave itself out.
const busyTimes = async (
  staffIds: string[],
  from: Date,
  to: Date,
  exceptJobId?: string,
) => {
  const busy = new Map(staffIds.map((id) => [id, [] as Span[]]));
  if (staffIds.length === 0) return busy;
  const [held, visits] = await Promise.all([
    db
      .select({ staffId: assignments.staffId, job: jobs })
      .from(assignments)
      .innerJoin(jobs, eq(jobs.id, assignments.jobId))
      .where(
        and(
          inArray(assignments.staffId, staffIds),
          ne(assignments.status, "released"),
          eq(jobs.status, "booked"),
          gt(jobs.startsAt, new Date(from.getTime() - DAY_MS)),
          lt(jobs.startsAt, to),
          exceptJobId ? ne(jobs.id, exceptJobId) : undefined,
        ),
      ),
    db
      .select({
        staffId: siteVisits.staffId,
        startsAt: siteVisits.startsAt,
        minutes: siteVisits.minutes,
      })
      .from(siteVisits)
      .where(
        and(
          inArray(siteVisits.staffId, staffIds),
          eq(siteVisits.status, "booked"),
          gt(siteVisits.startsAt, new Date(from.getTime() - DAY_MS)),
          lt(siteVisits.startsAt, to),
        ),
      ),
  ]);
  for (const { staffId, job } of held) busy.get(staffId)!.push(onSite(job));
  for (const { staffId, startsAt, minutes } of visits) {
    const start = startsAt!.getTime();
    busy.get(staffId!)!.push({ start, end: start + minutes * 60_000 });
  }
  return busy;
};

const overlaps = (spans: Span[], { start, end }: Span) =>
  spans.some((s) => s.start < end && s.end > start);

/**
 * Which of these Staff are free for a Job at a time, as ADR-0019 has it:
 * Available Hours that day, and no Job or Site Visit of theirs overlapping
 * its time on site. The Job itself doesn't count against them, so a moved
 * Job's crew can be checked at its new time. Stricter than room on the
 * Schedule, which takes anyone with hours to be free all day.
 */
export const freeFor = async (
  staffIds: string[],
  job: Pick<Job, "id" | "startsAt" | "labourHours" | "crewSize">,
) => {
  const day = dayOf(job.startsAt);
  const span = onSite(job);
  const [hours, busy] = await Promise.all([
    cleanerHours([day]),
    busyTimes(staffIds, job.startsAt, new Date(span.end), job.id),
  ]);
  const withHours = new Set(hours.get(day)!.map((c) => c.id));
  return new Set(
    staffIds.filter(
      (id) => withHours.has(id) && !overlaps(busy.get(id)!, span),
    ),
  );
};

/**
 * Every booked Job within 7 days, not yet started, with places nobody holds,
 * soonest first, and the active Cleaners each is open to: those free for it
 * (freeFor) who hold no place on it, haven't Released one, and haven't said
 * "Not for me". Worked out when asked, never stored, so someone who becomes
 * free later sees them, and a filled place leaves everyone's list at once.
 */
export const openings = async (jobId?: string) => {
  const now = clock.now();
  const soon = await db
    .select({ job: jobs, property: properties })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(
      and(
        eq(jobs.status, "booked"),
        gt(jobs.startsAt, now),
        lte(jobs.startsAt, new Date(now.getTime() + OPEN_PLACE_DAYS * DAY_MS)),
        jobId ? eq(jobs.id, jobId) : undefined,
      ),
    )
    .orderBy(asc(jobs.startsAt), asc(jobs.id));
  if (soon.length === 0) return [];

  const jobIds = soon.map((s) => s.job.id);
  const [places, passes, hours] = await Promise.all([
    db
      .select({
        jobId: assignments.jobId,
        staffId: assignments.staffId,
        status: assignments.status,
      })
      .from(assignments)
      .where(inArray(assignments.jobId, jobIds)),
    db
      .select()
      .from(openPlacePasses)
      .where(inArray(openPlacePasses.jobId, jobIds)),
    cleanerHours([...new Set(soon.map((s) => dayOf(s.job.startsAt)))]),
  ]);
  const cleaners = [...new Set([...hours.values()].flat().map((c) => c.id))];
  const latest = Math.max(...soon.map((s) => onSite(s.job).end));
  const busy = await busyTimes(cleaners, now, new Date(latest));

  return soon.flatMap(({ job, property }) => {
    const onJob = places.filter((p) => p.jobId === job.id);
    const holding = onJob.filter((p) => p.status !== "released");
    const open = job.crewSize - holding.length;
    if (open <= 0) return [];
    const ruledOut = new Set([
      ...onJob.map((p) => p.staffId),
      ...passes.filter((p) => p.jobId === job.id).map((p) => p.staffId),
    ]);
    const span = onSite(job);
    const openTo = hours
      .get(dayOf(job.startsAt))!
      .map((c) => c.id)
      .filter((id) => !ruledOut.has(id) && !overlaps(busy.get(id)!, span));
    return [{ job, property, open, openTo }];
  });
};

type Opening = Awaited<ReturnType<typeof openings>>[number];

const toOpenPlaces = async (open: Opening[]): Promise<OpenPlace[]> => {
  const versions = await serviceVersions(open.map((o) => o.job.serviceId));
  return open.map(({ job, property }) => ({
    jobId: job.id,
    startsAt: job.startsAt.toISOString(),
    serviceName: versions.get(job.serviceId)!.name,
    hoursOnSite: Math.round((job.labourHours / job.crewSize) * 100) / 100,
    crewSize: job.crewSize,
    postcode: property.postcode,
  }));
};

// the Open Places open to a Cleaner now, soonest first
export const openPlacesFor = async (staffId: string) =>
  toOpenPlaces((await openings()).filter((o) => o.openTo.includes(staffId)));

// one Open Place open to a Cleaner; to anyone else it doesn't exist
export const openPlaceFor = async (staffId: string, jobId: string) => {
  const [place] = await toOpenPlaces(
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
 * A Cleaner takes an Open Place: first to Confirm wins. Under the Job's
 * lock, so two can't both take its last place, it checks again that the
 * place is still open and still open to them, and refuses otherwise. Their
 * place is Confirmed at once.
 */
export const confirmOpenPlace = async (staffId: string, jobId: string) => {
  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for("update");
    // and theirs, so they can't take two Jobs at once that overlap
    await tx.select().from(staff).where(eq(staff.id, staffId)).for("update");
    if (!job) throw new NotFoundError("Job not found");
    if (job.status !== "booked" || job.startsAt <= clock.now()) {
      throw new ConflictError("This Job isn't open any more");
    }

    const [opening] = await openings(jobId);
    if (!opening) {
      const now = clock.now();
      throw new ConflictError(
        opensAt(job) > now
          ? "This Job isn't open to Cleaners yet"
          : "Someone else took this Job",
      );
    }
    if (!opening.openTo.includes(staffId)) {
      const [own] = await tx
        .select()
        .from(assignments)
        .where(
          and(eq(assignments.jobId, jobId), eq(assignments.staffId, staffId)),
        );
      throw new ConflictError(
        own?.status === "released"
          ? "You released your place on this Job"
          : own
            ? "You already have a place on this Job"
            : "You're no longer free for this Job",
      );
    }

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

// A Cleaner says an Open Place is "Not for me": it leaves their list, and
// they're never emailed about it again. Saying it twice changes nothing.
export const passOpenPlace = async (staffId: string, jobId: string) => {
  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "booked")));
  if (!job) throw new NotFoundError("Job not found");
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
 * The timer in src/index.ts calls this, and so do changes that open a place.
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
    const urgent = fresh.filter((o) => o.job.startsAt.getTime() <= urgentBy);
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
          await toOpenPlaces([
            ...theirs.filter(isNew),
            ...theirs.filter((o) => !isNew(o)),
          ]),
        );
      } else {
        await sendList(member, true, await toOpenPlaces(theirs.filter(isNew)));
      }
      sent += 1;
    } catch (error) {
      console.error(`Open Places email to Staff ${member.id} not sent:`, error);
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
