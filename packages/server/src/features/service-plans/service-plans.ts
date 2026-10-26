import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  max,
  min,
  ne,
  sum,
} from "drizzle-orm";
import type {
  LocalDateTime,
  OfficeServicePlan,
  QuoteOption,
  Recurrence,
  ServicePlanSummary,
  ServicePlanView,
  UnplacedVisit,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import {
  addDays,
  atTime,
  clock,
  dayOf,
  timeOf,
} from "../../services/clock/index.ts";
import { emailOffer } from "../assignments/assignments.ts";
import { assignments } from "../assignments/assignments.schema.ts";
import { clients } from "../clients/clients.schema.ts";
import { bookJob, lockDay, upcomingJobsFor } from "../jobs/jobs.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { hasRoomFor, jobViews } from "../jobs/schedule.ts";
import { charges } from "../payments/payments.schema.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { warnOfficeOfQuotesWithoutRoom } from "../quotes/quote-room.ts";
import { quoteOptions, quotes, type Quote } from "../quotes/quotes.schema.ts";
import { staff } from "../staff/staff.schema.ts";
import {
  servicePlans,
  servicePlanVisits,
  type ServicePlan,
} from "./service-plans.schema.ts";

const INTERVAL_DAYS: Record<Recurrence, number> = {
  weekly: 7,
  fortnightly: 14,
  four_weekly: 28,
};

// how far ahead a plan's Jobs are put on the Schedule: every recurrence has
// at least one showing, and the Office has a month's notice of a full day
export const HORIZON_DAYS = 28;

// ---- starting ----

/**
 * Starts a Service Plan from its accepted Quote, inside the acceptance's
 * transaction, once its first Job is booked: the plan, and that Job as its
 * first visit. Its Deposit is the caller's to record, against the plan.
 */
export const startServicePlan = async (
  tx: Tx,
  {
    quote,
    option,
    firstJob,
    startedBy,
  }: {
    quote: Quote;
    option: QuoteOption;
    firstJob: Job;
    startedBy: string | null;
  },
) => {
  const now = clock.now();
  const [plan] = await tx
    .insert(servicePlans)
    .values({
      propertyId: quote.propertyId,
      quoteId: quote.id,
      recurrence: quote.recurrence!,
      cleanType: option.cleanType,
      labourHours: option.labourHours,
      crewSize: quote.crewSize,
      firstStartsAt: firstJob.startsAt,
      startedAt: now,
      startedBy,
    })
    .returning();
  await tx.insert(servicePlanVisits).values({
    servicePlanId: plan!.id,
    dueOn: dayOf(firstJob.startsAt),
    jobId: firstJob.id,
    generatedAt: now,
  });
  return plan!;
};

// whether the Property has a Service Plan that hasn't Ended
export const hasServicePlan = async (propertyId: string, tx: Tx | typeof db) =>
  (
    await tx
      .select({ id: servicePlans.id })
      .from(servicePlans)
      .where(
        and(
          eq(servicePlans.propertyId, propertyId),
          ne(servicePlans.status, "ended"),
        ),
      )
  ).length > 0;

// ---- generating Jobs ----

type Offered = { id: string; name: string; email: string };

// The Cleaners holding places on the plan's latest booked Job, Offered or
// Confirmed, who are still active Cleaners: each is Offered a place on the
// new one, so the Client tends to see the same faces.
const offerPreviousCrew = async (
  tx: Tx,
  plan: ServicePlan,
  job: Job,
): Promise<Offered[]> => {
  const [previous] = await tx
    .select({ jobId: servicePlanVisits.jobId })
    .from(servicePlanVisits)
    .innerJoin(jobs, eq(jobs.id, servicePlanVisits.jobId))
    .where(
      and(
        eq(servicePlanVisits.servicePlanId, plan.id),
        ne(jobs.id, job.id),
        ne(jobs.status, "cancelled"),
      ),
    )
    .orderBy(desc(jobs.startsAt))
    .limit(1);
  if (!previous) return [];

  const crew = await tx
    .select({ id: staff.id, name: staff.name, email: staff.email })
    .from(assignments)
    .innerJoin(staff, eq(staff.id, assignments.staffId))
    .where(
      and(
        eq(assignments.jobId, previous.jobId!),
        ne(assignments.status, "released"),
        eq(staff.active, true),
        arrayContains(staff.roles, ["cleaner"]),
      ),
    )
    .orderBy(asc(assignments.offeredAt), asc(assignments.createdAt))
    .limit(job.crewSize);
  if (crew.length === 0) return [];

  const now = clock.now();
  await tx.insert(assignments).values(
    crew.map((member) => ({
      jobId: job.id,
      staffId: member.id,
      status: "offered" as const,
      offeredAt: now,
    })),
  );
  return crew;
};

// once saved: the crew Offered places are emailed, and the Office is told of
// Sent Quotes the booking left without room
const afterBooking = async (
  job: Job,
  offered: Offered[],
  property: Property,
) => {
  for (const member of offered) await emailOffer(member, job, property);
  await warnOfficeOfQuotesWithoutRoom(dayOf(job.startsAt));
};

// Books a plan's visit on `day` at its usual time, inside a transaction: when
// the day still has room for its Labour Hours, and the time is still to come.
// The day is held until the transaction ends, as accepting a Quote holds it.
const bookOnto = async (
  tx: Tx,
  plan: ServicePlan,
  startsAt: Date,
): Promise<{ job: Job; offered: Offered[] } | null> => {
  if (startsAt <= clock.now()) return null;
  const day = dayOf(startsAt);
  await lockDay(tx, day);
  const { hasRoom } = await hasRoomFor(day, plan.labourHours);
  if (!hasRoom) return null;
  const job = await bookJob(
    {
      propertyId: plan.propertyId,
      cleanType: plan.cleanType,
      startsAt,
      labourHours: plan.labourHours,
      crewSize: plan.crewSize,
    },
    tx,
  );
  return { job, offered: await offerPreviousCrew(tx, plan, job) };
};

// The plan's next visit, if it falls within the horizon: booked if its day
// has room, otherwise kept unplaced for the Office. One visit per
// transaction, holding the plan, so two runs take turns and the second finds
// it done.
const generateNext = async (planId: string) =>
  db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(servicePlans)
      .where(
        and(eq(servicePlans.id, planId), eq(servicePlans.status, "active")),
      )
      .for("update");
    if (!plan) return null;

    const [{ last }] = (await tx
      .select({ last: max(servicePlanVisits.dueOn) })
      .from(servicePlanVisits)
      .where(eq(servicePlanVisits.servicePlanId, planId))) as [
      { last: string | null },
    ];
    const day = addDays(
      last ?? dayOf(plan.firstStartsAt),
      INTERVAL_DAYS[plan.recurrence],
    );
    const now = clock.now();
    if (day > addDays(dayOf(now), HORIZON_DAYS)) return null;

    const booked = await bookOnto(
      tx,
      plan,
      atTime(day, timeOf(plan.firstStartsAt)),
    );
    await tx.insert(servicePlanVisits).values({
      servicePlanId: planId,
      dueOn: day,
      jobId: booked?.job.id ?? null,
      generatedAt: now,
    });
    return { booked };
  });

const propertyOf = async (propertyId: string) => {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId));
  return property!;
};

/**
 * Puts every active Service Plan's Jobs on the Schedule as the Clock
 * advances, up to HORIZON_DAYS ahead, each on its recurrence's weekday at its
 * first Job's time. A date whose day has no room is booked nothing, and
 * waits under Needs attention for the Office. Safe to run as often as you
 * like, and on more than one server: each date is generated once. Only the
 * plan given, if one is.
 *
 * Nothing calls this but the timer in src/index.ts, accepting a plan (and
 * tests). Returns how many dates were generated.
 */
export const generateServicePlanJobs = async (planId?: string) => {
  const plans = await db
    .select({ id: servicePlans.id, propertyId: servicePlans.propertyId })
    .from(servicePlans)
    .where(
      and(
        eq(servicePlans.status, "active"),
        planId ? eq(servicePlans.id, planId) : undefined,
      ),
    );

  let generated = 0;
  for (const plan of plans) {
    try {
      for (;;) {
        const next = await generateNext(plan.id);
        if (!next) break;
        generated += 1;
        if (next.booked) {
          const { job, offered } = next.booked;
          await afterBooking(job, offered, await propertyOf(plan.propertyId));
        }
      }
    } catch (error) {
      console.error(`Jobs for Service Plan ${plan.id} not generated:`, error);
    }
  }
  return generated;
};

// ---- unplaced visits ----

const findVisit = async (tx: Tx, planId: string, visitId: string) => {
  const [found] = await tx
    .select({ visit: servicePlanVisits, plan: servicePlans })
    .from(servicePlanVisits)
    .innerJoin(
      servicePlans,
      eq(servicePlans.id, servicePlanVisits.servicePlanId),
    )
    .where(
      and(
        eq(servicePlanVisits.id, visitId),
        eq(servicePlanVisits.servicePlanId, planId),
      ),
    )
    .for("update");
  if (!found) throw new NotFoundError("Visit not found");
  if (found.visit.jobId || found.visit.skippedAt) {
    throw new ConflictError(
      found.visit.jobId
        ? "This visit has already been booked."
        : "This visit was skipped.",
    );
  }
  if (found.plan.status === "ended") {
    throw new ConflictError("This Service Plan has Ended.");
  }
  return found;
};

/**
 * Office Staff book a visit its day had no room for at another time they've
 * agreed with the Client, as its plan's Job: the new day must have room, and
 * the previous Job's crew is Offered places, as for any plan Job.
 */
export const bookVisit = async (
  planId: string,
  visitId: string,
  { date, time }: LocalDateTime,
) => {
  const booked = await db.transaction(async (tx) => {
    const { plan } = await findVisit(tx, planId, visitId);
    const startsAt = atTime(date, time);
    if (startsAt <= clock.now()) {
      throw new ConflictError("Choose a time that's still to come.");
    }
    const booked = await bookOnto(tx, plan, startsAt);
    if (!booked) {
      throw new ConflictError(
        "That day doesn't have room for this Job. Choose another.",
      );
    }
    await tx
      .update(servicePlanVisits)
      .set({ jobId: booked.job.id })
      .where(eq(servicePlanVisits.id, visitId));
    return { ...booked, propertyId: plan.propertyId };
  });
  await afterBooking(
    booked.job,
    booked.offered,
    await propertyOf(booked.propertyId),
  );
  return officeServicePlan(planId);
};

// Office Staff skip a visit there was no room for: nothing is booked for it
export const skipVisit = async (planId: string, visitId: string) => {
  await db.transaction(async (tx) => {
    await findVisit(tx, planId, visitId);
    await tx
      .update(servicePlanVisits)
      .set({ skippedAt: clock.now() })
      .where(eq(servicePlanVisits.id, visitId));
  });
  return officeServicePlan(planId);
};

const unplacedOf = (where = undefined as ReturnType<typeof eq> | undefined) =>
  db
    .select({ visit: servicePlanVisits, plan: servicePlans })
    .from(servicePlanVisits)
    .innerJoin(
      servicePlans,
      eq(servicePlans.id, servicePlanVisits.servicePlanId),
    )
    .where(
      and(
        isNull(servicePlanVisits.jobId),
        isNull(servicePlanVisits.skippedAt),
        ne(servicePlans.status, "ended"),
        where,
      ),
    )
    .orderBy(asc(servicePlanVisits.dueOn));

const toUnplaced = (visit: {
  id: string;
  dueOn: string;
  generatedAt: Date;
}): UnplacedVisit => ({
  id: visit.id,
  dueOn: visit.dueOn,
  since: visit.generatedAt.toISOString(),
});

// every visit waiting for the Office to book or skip, soonest due first,
// with its plan
export const unplacedVisits = async () => {
  const rows = await unplacedOf();
  const summaries = await summariesOf(rows.map((r) => r.plan));
  const owners = await ownersOf(rows.map((r) => r.plan.propertyId));
  return rows.map(({ visit, plan }) => ({
    visit: toUnplaced(visit),
    plan: { ...summaries.get(plan.id)!, client: owners.get(plan.propertyId)! },
  }));
};

// ---- views ----

const ownersOf = async (propertyIds: string[]) => {
  if (propertyIds.length === 0) return new Map<string, never>();
  const rows = await db
    .select({ propertyId: properties.id, id: clients.id, name: clients.name })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(inArray(properties.id, propertyIds));
  return new Map(
    rows.map(({ propertyId, id, name }) => [propertyId, { id, name }]),
  );
};

// each plan's Jobs, by visit
const planJobs = (planId: string) =>
  inArray(
    jobs.id,
    db
      .select({ id: servicePlanVisits.jobId })
      .from(servicePlanVisits)
      .where(
        and(
          eq(servicePlanVisits.servicePlanId, planId),
          isNotNull(servicePlanVisits.jobId),
        ),
      ),
  );

const summariesOf = async (plans: ServicePlan[]) => {
  const ids = [...new Set(plans.map((p) => p.id))];
  if (ids.length === 0) return new Map<string, ServicePlanSummary>();
  const [homes, next] = await Promise.all([
    db
      .select()
      .from(properties)
      .where(
        inArray(
          properties.id,
          plans.map((p) => p.propertyId),
        ),
      ),
    db
      .select({
        planId: servicePlanVisits.servicePlanId,
        startsAt: min(jobs.startsAt),
      })
      .from(servicePlanVisits)
      .innerJoin(jobs, eq(jobs.id, servicePlanVisits.jobId))
      .where(
        and(
          inArray(servicePlanVisits.servicePlanId, ids),
          eq(jobs.status, "booked"),
          gt(jobs.startsAt, clock.now()),
        ),
      )
      .groupBy(servicePlanVisits.servicePlanId),
  ]);
  const homeOf = new Map(homes.map((h) => [h.id, h]));
  const nextOf = new Map(next.map((n) => [n.planId, n.startsAt]));
  return new Map(
    plans.map((plan): [string, ServicePlanSummary] => {
      const home = homeOf.get(plan.propertyId)!;
      return [
        plan.id,
        {
          id: plan.id,
          status: plan.status,
          recurrence: plan.recurrence,
          cleanType: plan.cleanType,
          property: {
            id: home.id,
            street: home.street,
            unit: home.unit,
            postcode: home.postcode,
          },
          nextStartsAt: nextOf.get(plan.id)?.toISOString() ?? null,
        },
      ];
    }),
  );
};

const findPlan = async (where: ReturnType<typeof and>) => {
  const [found] = await db
    .select({ plan: servicePlans, client: clients })
    .from(servicePlans)
    .innerJoin(properties, eq(properties.id, servicePlans.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(where);
  if (!found) throw new NotFoundError("Service Plan not found");
  return found;
};

// a plan's terms and price, from the Quote it was accepted from
const detailOf = async (
  plan: ServicePlan,
): Promise<Omit<ServicePlanView, "upcoming">> => {
  const [[summary], [priced], [deposit]] = await Promise.all([
    summariesOf([plan]).then((m) => [m.get(plan.id)!]),
    db
      .select({ quote: quotes, option: quoteOptions })
      .from(quotes)
      .innerJoin(quoteOptions, eq(quoteOptions.quoteId, quotes.id))
      .where(eq(quotes.id, plan.quoteId)),
    db
      .select({ cents: sum(charges.amountCents).mapWith(Number) })
      .from(charges)
      .where(
        and(eq(charges.servicePlanId, plan.id), eq(charges.kind, "deposit")),
      ),
  ]);
  const { quote, option } = priced!;
  return {
    ...summary!,
    firstStartsAt: plan.firstStartsAt.toISOString(),
    startedAt: plan.startedAt.toISOString(),
    crewSize: plan.crewSize,
    labourHours: plan.labourHours,
    hoursOnSite: Math.round((plan.labourHours / plan.crewSize) * 100) / 100,
    discountPercent: quote.planDiscountPercent!,
    priceCents: option.priceCents,
    taxCents: option.taxCents,
    totalCents: option.totalCents,
    addOns: option.suggested.addOns.map((a) => a.name),
    depositCents: deposit?.cents ?? 0,
    quoteId: quote.id,
  };
};

// the Client's Service Plans that haven't Ended, by when they started
export const clientServicePlans = async (
  clientId: string,
): Promise<ServicePlanSummary[]> => {
  const rows = await db
    .select({ plan: servicePlans })
    .from(servicePlans)
    .innerJoin(properties, eq(properties.id, servicePlans.propertyId))
    .where(
      and(eq(properties.clientId, clientId), ne(servicePlans.status, "ended")),
    )
    .orderBy(asc(servicePlans.startedAt));
  const summaries = await summariesOf(rows.map((r) => r.plan));
  return rows.map(({ plan }) => summaries.get(plan.id)!);
};

// one of the Client's Service Plans; anyone else's doesn't exist for them
export const clientServicePlan = async (
  clientId: string,
  planId: string,
): Promise<ServicePlanView> => {
  const { plan } = await findPlan(
    and(eq(servicePlans.id, planId), eq(clients.id, clientId)),
  );
  const [detail, upcoming] = await Promise.all([
    detailOf(plan),
    upcomingJobsFor(clientId, planJobs(plan.id)),
  ]);
  return { ...detail, upcoming };
};

export const officeServicePlan = async (
  planId: string,
): Promise<OfficeServicePlan> => {
  const { plan, client } = await findPlan(and(eq(servicePlans.id, planId)));
  const [detail, planned, unplaced] = await Promise.all([
    detailOf(plan),
    jobViews(planJobs(plan.id)),
    unplacedOf(eq(servicePlanVisits.servicePlanId, plan.id)),
  ]);
  return {
    ...detail,
    client: { id: client.id, name: client.name },
    jobs: planned,
    unplaced: unplaced.map(({ visit }) => toUnplaced(visit)),
  };
};

// the Property's Service Plan, unless it has none or it has Ended
export const propertyServicePlan = async (propertyId: string) => {
  const [plan] = await db
    .select()
    .from(servicePlans)
    .where(
      and(
        eq(servicePlans.propertyId, propertyId),
        ne(servicePlans.status, "ended"),
      ),
    );
  if (!plan) return null;
  return (await summariesOf([plan])).get(plan.id)!;
};

// the plan each Quote started, for those that started one
export const servicePlansOfQuotes = async (quoteIds: string[]) => {
  if (quoteIds.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: servicePlans.id, quoteId: servicePlans.quoteId })
    .from(servicePlans)
    .where(inArray(servicePlans.quoteId, quoteIds));
  return new Map(rows.map((r) => [r.quoteId, r.id]));
};
