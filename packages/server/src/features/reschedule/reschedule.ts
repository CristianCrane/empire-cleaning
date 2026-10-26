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
import { depositOf } from "../cancellation/cancellation.ts";
import { clients } from "../clients/clients.schema.ts";
import { lockDay } from "../jobs/jobs.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { hasRoomFor, scheduleFor } from "../jobs/schedule.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { warnOfficeOfQuotesWithoutRoom } from "../quotes/quote-room.ts";
import { staff } from "../staff/staff.schema.ts";
import { officeStaffEmails } from "../staff/staff.ts";
import {
  rescheduleRequests,
  type RescheduleRequest,
} from "./reschedule.schema.ts";

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

const cleanTypeLabel = { deep: "Deep Clean", standard: "Standard Clean" };

// "the Deep Clean at 41-12 Austin St, 4B, 11375"
const describe = (job: Job, property: Property) =>
  `the ${cleanTypeLabel[job.cleanType]} at ${addressOf(property)}`;

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
 * Cancellation that keeps the Deposit as the fee, unless an earlier one has
 * kept it already.
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
    job.rescheduleFeeCents > 0 ? 0 : await depositOf(job.id, tx),
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
 * its Labour Hours, counting what other pending requests hold, and the
 * start times on offer. Its own day always has room for it.
 */
export const rescheduleTimesFor = async (
  job: Job,
): Promise<RescheduleTimes> => {
  const { from, to } = bookableRange();
  const own = dayOf(job.startsAt);
  const days = (await scheduleFor(from, to))
    .filter(
      (day) =>
        day.date === own ||
        Math.round(day.freeHours * 100) >= Math.round(job.labourHours * 100),
    )
    .map((day) => day.date);
  return { days, times: timesFor(job) };
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
  late_cancellation: "a Late Cancellation, keeping the Deposit as the fee",
};

/**
 * Asks to move a booked Job to a new time, on a day from tomorrow with room
 * for it, at one of the start times on offer. Its Labour Hours are held on
 * that day until Office Staff confirm or turn it down, or the Client
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

    // a move to another day holds its hours there, so two requests (or a
    // request and an acceptance) can't both take its last free hours
    if (to.date !== dayOf(job.startsAt)) {
      await lockDay(tx, to.date);
      const { hasRoom } = await hasRoomFor(to.date, job.labourHours);
      if (!hasRoom) {
        throw new ConflictError(
          "That day has just filled up. Please choose another.",
        );
      }
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

  if (to.date !== dayOf(job.startsAt)) {
    await warnOfficeOfQuotesWithoutRoom(to.date);
  }
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
                `${client.name} has asked to move ${describe(job, property)} from ${formatWhen(job.startsAt)} to ${formatWhen(startsAt)}.`,
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
  await notify(`Reschedule turned down for Job ${jobId}`, () =>
    email.send({
      to: client.email,
      subject: "We couldn't move your clean",
      ...compose(
        [
          `Hi ${firstNameOf(client.name)},`,
          `We're sorry: we can't move ${describe(job, property)} to ${formatWhen(pending.startsAt)}.${reason ? ` ${reason}` : ""}`,
          `It stays booked for ${formatWhen(job.startsAt)}, and there's no charge. You can ask for another time from your account.`,
        ],
        portalLink(jobId),
      ),
    }),
  );
};

/**
 * Office Staff confirm a pending request: the Job moves to its new time, and
 * every place on it is Offered afresh, so the crew each Confirm the new time
 * or Release it. A second Late Reschedule keeps the Deposit as the fee
 * (ADR-0010); nothing is charged now, as the Deposit has been paid. The
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

    const crew = await moveTo(tx, jobId, pending.startsAt, {
      rescheduleFeeCents: job.rescheduleFeeCents + pending.feeCents,
    });
    await tx
      .update(rescheduleRequests)
      .set({ status: "confirmed", answeredAt: now, answeredBy: byAccountId })
      .where(eq(rescheduleRequests.id, pending.id));
    return { ...found, crew };
  });

  const client = await ownerOf(job);
  const costLine =
    pending.cost === "free"
      ? "There's no charge for moving it."
      : pending.cost === "free_late"
        ? `As it was less than ${LATE_RESCHEDULE_HOURS} hours before the clean, it's a Late Reschedule. Your first one is free, and your Deposit still counts towards the price.`
        : pending.feeCents > 0
          ? `As it's a second Late Reschedule, it's a Late Cancellation: your ${formatMoney(pending.feeCents)} Deposit is kept as the fee, and the full price is charged when the clean is done.`
          : "Your Deposit was already kept as the fee for an earlier Late Reschedule, so there's nothing more to pay for moving it.";
  await notify(`Reschedule confirmation for Job ${jobId}`, () =>
    email.send({
      to: client.email,
      subject: "Your clean has moved",
      ...compose(
        [
          `Hi ${firstNameOf(client.name)},`,
          `We've moved ${describe(job, property)} from ${formatWhen(pending.fromStartsAt)} to ${formatWhen(pending.startsAt)}, as you asked.`,
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
 * Moves a locked Job to a new time and Offers every place on it afresh, so
 * the crew each Confirm the new time or Release it. Its day-before reminder
 * goes again, for the new day. Returns the crew, to tell them.
 */
const moveTo = async (
  tx: Tx,
  jobId: string,
  startsAt: Date,
  also: Partial<Pick<Job, "rescheduleFeeCents">> = {},
) => {
  await tx
    .update(jobs)
    .set({ startsAt, reminderSentAt: null, ...also })
    .where(eq(jobs.id, jobId));
  return tx
    .update(assignments)
    .set({ status: "offered", offeredAt: clock.now(), answeredAt: null })
    .where(
      and(
        eq(assignments.jobId, jobId),
        inArray(assignments.status, ["offered", "confirmed"]),
      ),
    )
    .returning({ staffId: assignments.staffId });
};

// emails each of a moved Job's crew to Confirm the new time or Release it
const tellCrewOfMove = async (
  job: Job,
  property: Property,
  crew: { staffId: string }[],
  fromStartsAt: Date,
) => {
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
    await notify(`Move of Job ${job.id} to Staff ${member.id}`, () =>
      email.send({
        to: member.email,
        subject: "A Job you're on has moved",
        ...compose(
          [
            `Hi ${firstNameOf(member.name)},`,
            `The ${cleanTypeLabel[job.cleanType]} at ${addressOf(property)} has moved from ${formatWhen(fromStartsAt)} to ${formatWhen(job.startsAt)}.`,
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
 * one: every place is Offered afresh, the reminder goes again, and the
 * Client and the crew are emailed. A new day must have room for the Job's
 * Labour Hours, counting held hours; its own day always has room.
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
    // last free hours
    if (to.date !== dayOf(job.startsAt)) {
      await lockDay(tx, to.date);
      const { hasRoom, freeHours } = await hasRoomFor(to.date, job.labourHours);
      if (!hasRoom) {
        throw new ConflictError(
          `That day doesn't have room: the Job needs ${job.labourHours} Labour Hours and ${Math.max(freeHours, 0)} are free.`,
        );
      }
    }

    const crew = await moveTo(tx, jobId, startsAt);
    return { ...found, crew };
  });

  if (to.date !== dayOf(job.startsAt)) {
    await warnOfficeOfQuotesWithoutRoom(to.date);
  }
  const moved = { ...job, startsAt };
  const client = await ownerOf(job);
  await notify(`Move notice for Job ${jobId}`, () =>
    email.send({
      to: client.email,
      subject: "Your clean has moved",
      ...compose(
        [
          `Hi ${firstNameOf(client.name)},`,
          `We've moved ${describe(job, property)} from ${formatWhen(job.startsAt)} to ${formatWhen(startsAt)}.`,
          "There's no charge for this. If the new time doesn't suit you, you can ask for another from your account, or call us.",
        ],
        portalLink(jobId),
      ),
    }),
  );
  await tellCrewOfMove(moved, property, crew, job.startsAt);
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
