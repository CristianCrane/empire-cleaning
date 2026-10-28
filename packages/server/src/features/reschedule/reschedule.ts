import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import type {
  LocalDateTime,
  RescheduleCost,
  RescheduleRequestView,
  RescheduleTerms,
  RescheduleTimes,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import env from "../../env.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import {
  addDays,
  atTime,
  clock,
  dayOf,
  timeOf,
} from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatMoney,
  formatWhen,
} from "../../services/email/index.ts";
import { assignments } from "../assignments/assignments.schema.ts";
import {
  emailOpenPlaces,
  freeFor,
  placeReopened,
} from "../assignments/open-places.ts";
import { lateFeeOf, planOfJob } from "../cancellation/cancellation.ts";
import { clients } from "../clients/clients.schema.ts";
import { lockDay } from "../jobs/jobs.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { roomFor, roomOn, scheduleFor, whyNoRoom } from "../jobs/schedule.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { warnOfficeOfQuotesWithoutRoom } from "../quotes/quote-room.ts";
import { staff } from "../staff/staff.schema.ts";
import { officeStaffEmails } from "../staff/staff.ts";
import {
  rescheduleRequests,
  type RescheduleRequest,
} from "./reschedule.schema.ts";
import { serviceNameOf } from "../services/services.ts";

// moving a Job is free until this long before it starts; after that it's a
// Late Reschedule (ADR-0010)
export const LATE_RESCHEDULE_HOURS = 24;
const HOUR_MS = 3_600_000;

// a Job can be moved to a day from tomorrow up to this many days ahead
export const RESCHEDULE_DAYS_AHEAD = 56;

// the start times a Job can be moved to, New York time
export const START_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
];

// "the Deep Clean at 41-12 Austin St, 4B, 11375"
const describe = async (job: Job, property: Property) =>
  `the ${await serviceNameOf(job.serviceId)} at ${addressOf(property)}`;

// emails go out after the change is saved; one that fails is logged, and the
// change stands
const notify = async (what: string, send: () => Promise<void>) => {
  try {
    await send();
  } catch (error) {
    console.error(`${what} not sent:`, error);
  }
};

const freeUntilOf = (job: Pick<Job, "startsAt">) =>
  new Date(job.startsAt.getTime() - LATE_RESCHEDULE_HOURS * HOUR_MS);

/**
 * What asking to move a Job costs now, by the Clock (ADR-0010). Free 24
 * hours or more before it starts. Less than that, it's a Late Reschedule:
 * free if none has been confirmed for the Job yet, otherwise a Late
 * Cancellation, with the Deposit amount as the fee, unless an earlier one has
 * made it due already.
 */
const termsOf = async (
  job: Job,
  tx: Tx | typeof db = db,
): Promise<RescheduleTerms> => {
  const freeUntil = freeUntilOf(job);
  const terms = (cost: RescheduleCost, feeCents = 0) => ({
    cost,
    feeCents,
    freeUntil: freeUntil.toISOString(),
  });
  if (clock.now() < freeUntil) return terms("free");

  const [usedFree] = await tx
    .select({ id: rescheduleRequests.id })
    .from(rescheduleRequests)
    .where(
      and(
        eq(rescheduleRequests.jobId, job.id),
        eq(rescheduleRequests.status, "confirmed"),
        ne(rescheduleRequests.cost, "free"),
      ),
    )
    .limit(1);
  if (!usedFree) return terms("free_late");
  return terms(
    "late_cancellation",
    job.rescheduleFeeCents > 0 ? 0 : await lateFeeOf(job.id, tx),
  );
};

const pendingOf = async (jobId: string, tx: Tx | typeof db = db) => {
  const [pending] = await tx
    .select()
    .from(rescheduleRequests)
    .where(
      and(
        eq(rescheduleRequests.jobId, jobId),
        eq(rescheduleRequests.status, "pending"),
      ),
    );
  return pending ?? null;
};

/**
 * What asking to move a booked Job would cost now; null when it can't be
 * moved: it isn't booked, it has started, or a request is already pending.
 */
export const rescheduleTermsOf = async (
  job: Job,
): Promise<RescheduleTerms | null> => {
  if (job.status !== "booked" || job.startsAt <= clock.now()) return null;
  if (await pendingOf(job.id)) return null;
  return termsOf(job);
};

const toView = (request: RescheduleRequest): RescheduleRequestView => ({
  id: request.id,
  status: request.status,
  fromStartsAt: request.fromStartsAt.toISOString(),
  startsAt: request.startsAt.toISOString(),
  cost: request.cost,
  feeCents: request.feeCents,
  requestedAt: request.requestedAt.toISOString(),
  byClient: request.byClient,
  answeredAt: request.answeredAt?.toISOString() ?? null,
  reason: request.reason,
});

// a Job's latest Reschedule Request, pending or answered; null if none
export const rescheduleRequestOf = async (
  job: Job,
): Promise<RescheduleRequestView | null> => {
  const [latest] = await db
    .select()
    .from(rescheduleRequests)
    .where(eq(rescheduleRequests.jobId, job.id))
    .orderBy(
      desc(rescheduleRequests.requestedAt),
      desc(rescheduleRequests.createdAt),
    )
    .limit(1);
  return latest ? toView(latest) : null;
};

// the first and last days a Job can be moved to, from now
const bookableRange = () => {
  const from = addDays(dayOf(clock.now()), 1);
  return { from, to: addDays(from, RESCHEDULE_DAYS_AHEAD - 1) };
};

// the start times on offer for a Job, with its own time-of-day, so it can
// keep its time on another day
const timesFor = (job: Job) =>
  [...new Set([...START_TIMES, timeOf(job.startsAt)])].sort();

/**
 * The times a booked Job can be moved to: days from tomorrow with room for
 * its Labour Hours, counting what other pending requests hold, each with the
 * start times on offer that have a crew free (#62). Its own day always has
 * the hours for it.
 */
export const rescheduleTimesFor = async (
  job: Job,
): Promise<RescheduleTimes> => {
  const { from, to } = bookableRange();
  const days = (await scheduleFor(from, to))
    .map((day) => ({
      date: day.date,
      times: timesFor(job).filter(
        (time) =>
          roomOn(day, {
            startsAt: atTime(day.date, time),
            labourHours: job.labourHours,
            crewSize: job.crewSize,
            jobId: job.id,
          }).hasRoom,
      ),
    }))
    .filter((day) => day.times.length > 0);
  return { days };
};

// ---- asking ----

type Asking = {
  // the cost the person asking was shown
  cost: RescheduleCost;
  byAccountId: string | null;
  // the Client themselves, in the portal, rather than Office Staff
  byClient: boolean;
};

const costLabel: Record<RescheduleCost, string> = {
  free: "free",
  free_late: "a Late Reschedule, free as the Job's first",
  late_cancellation: "a Late Cancellation, with the Deposit amount as the fee",
};

/**
 * Asks to move a booked Job to a new time, from tomorrow, with room for it
 * (the hours that day, and a crew then), at one of the start times on offer.
 * A crew is held at that time, and on another day its Labour Hours, until Office Staff confirm or turn it down, or the Client
 * withdraws it. Refused if what it costs isn't what the person asking was
 * shown, as when the 24-hour cut-off has passed since.
 *
 * The Office is emailed when the Client asks themselves.
 */
export const requestReschedule = async (
  jobId: string,
  to: LocalDateTime,
  asking: Asking,
) => {
  const startsAt = atTime(to.date, to.time);
  const { job, property } = await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ job: jobs, property: properties })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(eq(jobs.id, jobId))
      .for("update", { of: jobs });
    if (!found) throw new NotFoundError("Job not found");
    const { job } = found;
    if (job.status !== "booked") {
      throw new ConflictError("This Job is no longer booked, so it can't move");
    }
    if (job.startsAt <= clock.now()) {
      throw new ConflictError(
        asking.byClient
          ? "Your clean has already started, so it can't be moved. Please call the Office."
          : "This Job has already started, so it can't be moved",
      );
    }
    if (await pendingOf(jobId, tx)) {
      throw new ConflictError(
        "There's already a request to move this clean. Withdraw it first to ask for another time.",
      );
    }

    const { from, to: last } = bookableRange();
    if (to.date < from || to.date > last) {
      throw new ConflictError(
        `Choose a day from tomorrow up to ${RESCHEDULE_DAYS_AHEAD / 7} weeks ahead`,
      );
    }
    if (!timesFor(job).includes(to.time)) {
      throw new ConflictError("Choose one of the start times on offer");
    }
    if (startsAt.getTime() === job.startsAt.getTime()) {
      throw new ConflictError("That's when the clean is already booked");
    }

    const terms = await termsOf(job, tx);
    if (terms.cost !== asking.cost) {
      throw new ConflictError(
        terms.cost === "free"
          ? "What moving costs has changed. Please check and send it again."
          : `It's now less than ${LATE_RESCHEDULE_HOURS} hours before the clean, so moving it is ${costLabel[terms.cost]}. Please check and send it again.`,
      );
    }

    // the new time holds a crew, and on another day the hours, so two
    // requests (or a request and an acceptance) can't both take the last
    await lockDay(tx, to.date);
    const { hasRoom } = await roomFor({
      startsAt,
      labourHours: job.labourHours,
      crewSize: job.crewSize,
      jobId,
    });
    if (!hasRoom) {
      throw new ConflictError(
        "That time has just filled up. Please choose another.",
      );
    }

    await tx.insert(rescheduleRequests).values({
      jobId,
      fromStartsAt: job.startsAt,
      startsAt,
      cost: terms.cost,
      feeCents: terms.feeCents,
      requestedAt: clock.now(),
      requestedBy: asking.byAccountId,
      byClient: asking.byClient,
    });
    return found;
  });

  await warnOfficeOfQuotesWithoutRoom(to.date);
  if (asking.byClient) {
    const client = await ownerOf(job);
    await notify(
      `Reschedule Request for Job ${jobId} to the Office`,
      async () => {
        for (const address of await officeStaffEmails()) {
          await email.send({
            to: address,
            subject: `${client.name} asked to move a Job`,
            ...compose(
              [
                `${client.name} has asked to move ${await describe(job, property)} from ${formatWhen(job.startsAt)} to ${formatWhen(startsAt)}.`,
                `It's ${costLabel[asking.cost]}. The new time is held for them until you confirm it or turn it down.`,
              ],
              officeLink(jobId),
            ),
          });
        }
      },
    );
  }
};

const officeLink = (jobId: string) => ({
  href: `${env.CORS_ORIGIN_URL}/office/jobs/${jobId}`,
  label: "See the Job",
});

const portalLink = (jobId: string) => ({
  href: `${env.CORS_ORIGIN_URL}/portal/jobs/${jobId}`,
  label: "See your clean",
});

const ownerOf = async (job: Job) => {
  const [found] = await db
    .select({ client: clients })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, job.propertyId));
  return found!.client;
};

// ---- answering ----

// a booked Job and its pending request, held until the transaction ends
const lockPending = async (tx: Tx, jobId: string) => {
  const [found] = await tx
    .select({ job: jobs, property: properties })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(eq(jobs.id, jobId))
    .for("update", { of: jobs });
  if (!found) throw new NotFoundError("Job not found");
  const pending =
    found.job.status === "booked" ? await pendingOf(jobId, tx) : null;
  if (!pending) {
    throw new ConflictError("There's no request to move this Job waiting");
  }
  return { ...found, pending };
};

/**
 * The Client withdraws their pending request: the Job keeps its time, the
 * held hours are freed, and it costs nothing.
 */
export const withdrawReschedule = async (
  jobId: string,
  byAccountId: string,
) => {
  await db.transaction(async (tx) => {
    const { pending } = await lockPending(tx, jobId);
    await tx
      .update(rescheduleRequests)
      .set({
        status: "withdrawn",
        answeredAt: clock.now(),
        answeredBy: byAccountId,
      })
      .where(eq(rescheduleRequests.id, pending.id));
  });
};

/**
 * Office Staff turn down a pending request, saying why if they like: the
 * Job keeps its time, the held hours are freed, it costs nothing, and the
 * Client is emailed.
 */
export const turnDownReschedule = async (
  jobId: string,
  reason: string | null,
  byAccountId: string,
) => {
  const { job, property, pending } = await db.transaction(async (tx) => {
    const found = await lockPending(tx, jobId);
    await tx
      .update(rescheduleRequests)
      .set({
        status: "turned_down",
        answeredAt: clock.now(),
        answeredBy: byAccountId,
        reason,
      })
      .where(eq(rescheduleRequests.id, found.pending.id));
    return found;
  });

  const client = await ownerOf(job);
  await notify(`Reschedule turned down for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      subject: "We couldn't move your clean",
      ...compose(
        [
          `Hi ${firstNameOf(client.name)},`,
          `We're sorry: we can't move ${await describe(job, property)} to ${formatWhen(pending.startsAt)}.${reason ? ` ${reason}` : ""}`,
          `It stays booked for ${formatWhen(job.startsAt)}, and there's no charge. You can ask for another time from your account.`,
        ],
        portalLink(jobId),
      ),
    }),
  );
};

/**
 * Office Staff confirm a pending request: the Job moves to its new time, and
 * its crew are Offered it afresh, keeping their places unless they aren't
 * free then (moveTo). A second Late Reschedule makes the Deposit amount due as a
 * fee (ADR-0010), charged with the Balance on completion: a one-off Job's
 * Deposit is kept as it, and a plan Job, which has none, pays it then. Refused
 * if the time asked for no longer has room, as when a Cleaner's hours that
 * day were cut since. The
 * Client and the crew are emailed.
 */
export const confirmReschedule = async (jobId: string, byAccountId: string) => {
  const { job, property, pending, crew } = await db.transaction(async (tx) => {
    const found = await lockPending(tx, jobId);
    const { job, pending } = found;
    const now = clock.now();
    if (job.startsAt <= now) {
      throw new ConflictError(
        "This Job has already started at its booked time, so it can't move. Turn the request down instead.",
      );
    }
    if (pending.startsAt <= now) {
      throw new ConflictError(
        "The time asked for has passed. Turn the request down instead.",
      );
    }
    // what it held may no longer be enough: fewer Cleaners or hours that day
    await lockDay(tx, dayOf(pending.startsAt));
    const room = await roomFor({
      startsAt: pending.startsAt,
      labourHours: job.labourHours,
      crewSize: job.crewSize,
      jobId,
    });
    if (!room.hasRoom) {
      throw new ConflictError(
        `${whyNoRoom(room)} Turn the request down, or give a Cleaner hours that day.`,
      );
    }

    const crew = await moveTo(tx, job, pending.startsAt, {
      rescheduleFeeCents: job.rescheduleFeeCents + pending.feeCents,
    });
    await tx
      .update(rescheduleRequests)
      .set({ status: "confirmed", answeredAt: now, answeredBy: byAccountId })
      .where(eq(rescheduleRequests.id, pending.id));
    return { ...found, crew };
  });

  const client = await ownerOf(job);
  const onPlan = (await planOfJob(jobId)) !== null;
  const costLine =
    pending.cost === "free"
      ? "There's no charge for moving it."
      : pending.cost === "free_late"
        ? `As it was less than ${LATE_RESCHEDULE_HOURS} hours before the clean, it's a Late Reschedule. Your first one is free${onPlan ? "" : ", and your Deposit still counts towards the price"}.`
        : pending.feeCents > 0
          ? onPlan
            ? `As it's a second Late Reschedule, it's a Late Cancellation, with a ${formatMoney(pending.feeCents)} fee (the same as your plan's Deposit), charged with the price when the clean is done.`
            : `As it's a second Late Reschedule, it's a Late Cancellation: your ${formatMoney(pending.feeCents)} Deposit is kept as the fee, and the full price is charged when the clean is done.`
          : onPlan
            ? "An earlier Late Reschedule already made the fee due, so there's nothing more to pay for moving it."
            : "Your Deposit was already kept as the fee for an earlier Late Reschedule, so there's nothing more to pay for moving it.";
  await notify(`Reschedule confirmation for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      subject: "Your clean has moved",
      ...compose(
        [
          `Hi ${firstNameOf(client.name)},`,
          `We've moved ${await describe(job, property)} from ${formatWhen(pending.fromStartsAt)} to ${formatWhen(pending.startsAt)}, as you asked.`,
          costLine,
        ],
        portalLink(jobId),
      ),
    }),
  );

  await tellCrewOfMove(
    { ...job, startsAt: pending.startsAt },
    property,
    crew,
    pending.fromStartsAt,
  );
};

// ---- moving: confirming a request, or the Office moving a Job itself ----

/**
 * Moves a locked Job to a new time. Its crew are Offered the new time
 * afresh and keep their places, so each Confirms it or Releases it, except
 * anyone not free then (ADR-0019), whose places open. Its day-before
 * reminder goes again, for the new day. Returns who kept a place and who
 * lost one, to tell them.
 */
const moveTo = async (
  tx: Tx,
  job: Job,
  startsAt: Date,
  also: Partial<Pick<Job, "rescheduleFeeCents">> = {},
) => {
  await tx
    .update(jobs)
    .set({ startsAt, reminderSentAt: null, ...also })
    .where(eq(jobs.id, job.id));
  const holding = await tx
    .select({ id: assignments.id, staffId: assignments.staffId })
    .from(assignments)
    .where(
      and(
        eq(assignments.jobId, job.id),
        inArray(assignments.status, ["offered", "confirmed"]),
      ),
    );
  const free = await freeFor(
    holding.map((h) => h.staffId),
    { ...job, startsAt },
  );
  const kept = holding.filter((h) => free.has(h.staffId));
  const lost = holding.filter((h) => !free.has(h.staffId));
  if (kept.length > 0) {
    await tx
      .update(assignments)
      .set({ status: "offered", offeredAt: clock.now(), answeredAt: null })
      .where(
        inArray(
          assignments.id,
          kept.map((h) => h.id),
        ),
      );
  }
  if (lost.length > 0) {
    await tx.delete(assignments).where(
      inArray(
        assignments.id,
        lost.map((h) => h.id),
      ),
    );
  }
  return { kept, lost };
};

// Emails each of a moved Job's crew: those who kept a place, to Confirm the
// new time or Release it, and those not free then, that they're off it.
// Then anyone the Job's Open Places are open to hears of it afresh.
const tellCrewOfMove = async (
  job: Job,
  property: Property,
  { kept, lost }: Awaited<ReturnType<typeof moveTo>>,
  fromStartsAt: Date,
) => {
  await placeReopened(job.id);
  await notify(`Open Places email for Job ${job.id}`, async () => {
    await emailOpenPlaces();
  });
  await tellLost(job, property, lost, fromStartsAt);
  const crew = kept;
  if (crew.length === 0) return;
  const members = await db
    .select()
    .from(staff)
    .where(
      inArray(
        staff.id,
        crew.map((c) => c.staffId),
      ),
    )
    .orderBy(asc(staff.name));
  for (const member of members) {
    await notify(`Move of Job ${job.id} to Staff ${member.id}`, async () =>
      email.send({
        to: member.email,
        subject: "A Job you're on has moved",
        ...compose(
          [
            `Hi ${firstNameOf(member.name)},`,
            `The ${await serviceNameOf(job.serviceId)} at ${addressOf(property)} has moved from ${formatWhen(fromStartsAt)} to ${formatWhen(job.startsAt)}.`,
            "Please confirm your place at the new time, or release it if you can't make it.",
          ],
          {
            href: `${env.CORS_ORIGIN_URL}/cleaner/jobs/${job.id}`,
            label: "See the Job",
          },
        ),
      }),
    );
  }
};

/**
 * Office Staff move a booked Job straight to a new time, from the Schedule
 * (#52). It's the Office's own action, not a Reschedule Request: nothing is
 * held, and it costs the Client nothing. Otherwise it works like confirming
 * one: the crew are Offered the new time afresh (moveTo), the reminder goes
 * again, and the
 * Client and the crew are emailed. The new time must have room: a new day
 * the Job's Labour Hours, counting held hours (its own day always has), and
 * a crew free then.
 *
 * Refused once the Job has started or isn't booked, and while a Reschedule
 * Request for it is waiting: that's answered first.
 */
export const moveJob = async (jobId: string, to: LocalDateTime) => {
  const startsAt = atTime(to.date, to.time);
  const { job, property, crew } = await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ job: jobs, property: properties })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(eq(jobs.id, jobId))
      .for("update", { of: jobs });
    if (!found) throw new NotFoundError("Job not found");
    const { job } = found;
    const now = clock.now();
    if (job.status !== "booked") {
      throw new ConflictError("This Job is no longer booked, so it can't move");
    }
    if (job.startsAt <= now) {
      throw new ConflictError("This Job has already started, so it can't move");
    }
    if (startsAt <= now) {
      throw new ConflictError("Choose a time that's still to come");
    }
    if (startsAt.getTime() === job.startsAt.getTime()) {
      throw new ConflictError("That's when the Job is already booked");
    }
    if (await pendingOf(jobId, tx)) {
      throw new ConflictError(
        "The Client has asked to move this Job. Confirm or turn down their request first.",
      );
    }

    // as asking does, so a move and another booking can't both take a day's
    // last free hours or crew
    await lockDay(tx, to.date);
    const room = await roomFor({
      startsAt,
      labourHours: job.labourHours,
      crewSize: job.crewSize,
      jobId,
    });
    if (!room.hasRoom) throw new ConflictError(whyNoRoom(room));

    const crew = await moveTo(tx, job, startsAt);
    return { ...found, crew };
  });

  await warnOfficeOfQuotesWithoutRoom(to.date);
  const moved = { ...job, startsAt };
  const client = await ownerOf(job);
  await notify(`Move notice for Job ${jobId}`, async () =>
    email.send({
      to: client.email,
      subject: "Your clean has moved",
      ...compose(
        [
          `Hi ${firstNameOf(client.name)},`,
          `We've moved ${await describe(job, property)} from ${formatWhen(job.startsAt)} to ${formatWhen(startsAt)}.`,
          "There's no charge for this. If the new time doesn't suit you, you can ask for another from your account, or call us.",
        ],
        portalLink(jobId),
      ),
    }),
  );
  await tellCrewOfMove(moved, property, crew, job.startsAt);
};

// emails each of a moved Job's crew who isn't free at its new time that
// their place has gone
const tellLost = async (
  job: Job,
  property: Property,
  lost: { staffId: string }[],
  fromStartsAt: Date,
) => {
  if (lost.length === 0) return;
  const members = await db
    .select()
    .from(staff)
    .where(
      inArray(
        staff.id,
        lost.map((c) => c.staffId),
      ),
    )
    .orderBy(asc(staff.name));
  for (const member of members) {
    await notify(`Move of Job ${job.id} off Staff ${member.id}`, async () =>
      email.send({
        to: member.email,
        subject: "You're no longer on a Job",
        ...compose(
          [
            `Hi ${firstNameOf(member.name)},`,
            `The ${await serviceNameOf(job.serviceId)} at ${addressOf(property)} has moved from ${formatWhen(fromStartsAt)} to ${formatWhen(job.startsAt)}, when you aren't free, so you're no longer on it. You don't need to go.`,
          ],
          { href: `${env.CORS_ORIGIN_URL}/cleaner`, label: "See your Jobs" },
        ),
      }),
    );
  }
};

// ---- the Office's list ----

// pending requests for booked Jobs, earliest asked first: the Office
// confirms or turns them down
export const pendingRescheduleRequests = async () =>
  (
    await db
      .select({ request: rescheduleRequests })
      .from(rescheduleRequests)
      .innerJoin(jobs, eq(jobs.id, rescheduleRequests.jobId))
      .where(
        and(
          eq(rescheduleRequests.status, "pending"),
          eq(jobs.status, "booked"),
        ),
      )
      .orderBy(
        asc(rescheduleRequests.requestedAt),
        asc(rescheduleRequests.createdAt),
      )
  ).map(({ request }) => ({ jobId: request.jobId, request: toView(request) }));
