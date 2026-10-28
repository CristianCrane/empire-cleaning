import {
  type AnyColumn,
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
  or,
  sum,
} from "drizzle-orm";
import type {
  LocalDateTime,
  OfficeServicePlan,
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
  weekdayOf,
} from "../../services/clock/index.ts";
import { emailOffer } from "../assignments/assignments.ts";
import { assignments } from "../assignments/assignments.schema.ts";
import { billLines, bills } from "../bills/bills.schema.ts";
import { billNumber } from "../bills/bills.ts";
import { clients } from "../clients/clients.schema.ts";
import { paymentOf } from "../completion/balance.ts";
import { bookJob, lockDay, upcomingJobsFor } from "../jobs/jobs.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { jobViews, roomFor } from "../jobs/schedule.ts";
import { charges } from "../payments/payments.schema.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { warnOfficeOfQuotesWithoutRoom } from "../quotes/quote-room.ts";
import {
  quoteRevisions,
  quotes,
  revisionOptions,
  type RevisionOptionRow,
} from "../quotes/quotes.schema.ts";
import { staff } from "../staff/staff.schema.ts";
import { endServicePlan, endTermsOf } from "./ending.ts";
import {
  recordFirstVisits,
  type AcceptedQuote,
  type FirstJobs,
} from "./first-visits.ts";
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
 * transaction, once the first Job on each of its weekdays is booked: the
 * plan, and those Jobs as its first visits. Its Deposit is the caller's to
 * record, against the plan.
 */
export const startServicePlan = async (
  tx: Tx,
  {
    quote,
    firstJobs,
    startedBy,
  }: {
    quote: AcceptedQuote;
    firstJobs: FirstJobs;
    startedBy: string | null;
  },
) => {
  const [plan] = await tx
    .insert(servicePlans)
    .values({
      propertyId: quote.propertyId,
      quoteId: quote.id,
      recurrence: quote.recurrence!,
      startedAt: clock.now(),
      startedBy,
    })
    .returning();
  await recordFirstVisits(tx, plan!.id, quote, firstJobs);
  return plan!;
};

// A plan's weekdays on an Accepted Quote's terms, in order: the options of
// the Revision accepted, each with its first clean's time, its visit and
// price
export const daysOfQuote = (quoteId: string, tx: Tx | typeof db = db) =>
  tx
    .select({ day: revisionOptions })
    .from(revisionOptions)
    .innerJoin(quotes, eq(quotes.sentRevisionId, revisionOptions.revisionId))
    .where(eq(quotes.id, quoteId))
    .orderBy(asc(revisionOptions.position))
    .then((rows) => rows.map((r) => r.day));

type Day = RevisionOptionRow;

// the Property's Service Plan that hasn't Ended, if it has one
export const currentPlanOf = async (
  propertyId: string,
  tx: Tx | typeof db = db,
): Promise<ServicePlan | undefined> => {
  const [plan] = await tx
    .select()
    .from(servicePlans)
    .where(
      and(
        eq(servicePlans.propertyId, propertyId),
        ne(servicePlans.status, "ended"),
      ),
    );
  return plan;
};

// ---- generating Jobs ----

type Offered = { id: string; name: string; email: string };

// how far back to look for a plan's latest Job on the same weekday: a
// fortnight of cleans 6 days a week, and then some
const RECENT_JOBS = 16;

// The Cleaners holding places on the plan's latest booked Job on the same
// weekday (or failing that its latest), Offered or Confirmed, who are still
// active Cleaners: each is Offered a place on the new one, so the Client
// tends to see the same faces.
const offerPreviousCrew = async (
  tx: Tx,
  plan: ServicePlan,
  job: Job,
): Promise<Offered[]> => {
  const recent = await tx
    .select({ id: jobs.id, startsAt: jobs.startsAt })
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
    .limit(RECENT_JOBS);
  const weekday = weekdayOf(dayOf(job.startsAt));
  const previous =
    recent.find((j) => weekdayOf(dayOf(j.startsAt)) === weekday) ?? recent[0];
  if (!previous) return [];

  const crew = await tx
    .select({ id: staff.id, name: staff.name, email: staff.email })
    .from(assignments)
    .innerJoin(staff, eq(staff.id, assignments.staffId))
    .where(
      and(
        eq(assignments.jobId, previous.id),
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

// Books a visit on one of the plan's weekdays at `startsAt`, inside a
// transaction: when it still has room (the Labour Hours on its day, and a
// crew then), and is still to come. The day is held until the transaction
// ends, as accepting a Quote holds it.
const bookOnto = async (
  tx: Tx,
  plan: ServicePlan,
  day: Day,
  startsAt: Date,
): Promise<{ job: Job; offered: Offered[] } | null> => {
  if (startsAt <= clock.now()) return null;
  await lockDay(tx, dayOf(startsAt));
  const { hasRoom } = await roomFor({
    startsAt,
    labourHours: day.labourHours,
    crewSize: day.crewSize,
  });
  if (!hasRoom) return null;
  const job = await bookJob(
    {
      propertyId: plan.propertyId,
      serviceId: day.serviceId,
      startsAt,
      labourHours: day.labourHours,
      crewSize: day.crewSize,
    },
    tx,
  );
  return { job, offered: await offerPreviousCrew(tx, plan, job) };
};

// The plan's next visit, the soonest due of its weekdays', if it falls
// within the horizon: booked if its day has room, otherwise kept unplaced for
// the Office. One visit per transaction, holding the plan, so two runs take
// turns and the second finds it done.
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

    const [days, lasts] = await Promise.all([
      daysOfQuote(plan.quoteId, tx),
      tx
        .select({
          position: servicePlanVisits.position,
          last: max(servicePlanVisits.dueOn),
        })
        .from(servicePlanVisits)
        .where(
          and(
            eq(servicePlanVisits.servicePlanId, planId),
            // counting on from the first date on its current terms
            eq(servicePlanVisits.quoteId, plan.quoteId),
          ),
        )
        .groupBy(servicePlanVisits.position),
    ]);
    const lastOf = new Map(lasts.map((l) => [l.position, l.last!]));
    const now = clock.now();
    const every = INTERVAL_DAYS[plan.recurrence];

    // each weekday's next date, the soonest first
    const [next] = days
      .map((day) => {
        const at = (on: string) => atTime(on, timeOf(day.startsAt!));
        let on = addDays(
          lastOf.get(day.position) ?? dayOf(day.startsAt!),
          every,
        );
        // dates that came and went while it was On Hold are never generated
        while (at(on) <= now) on = addDays(on, every);
        return { day, on, startsAt: at(on) };
      })
      .sort((a, b) => a.on.localeCompare(b.on));
    if (!next || next.on > addDays(dayOf(now), HORIZON_DAYS)) return null;

    const booked = await bookOnto(tx, plan, next.day, next.startsAt);
    await tx.insert(servicePlanVisits).values({
      servicePlanId: planId,
      quoteId: plan.quoteId,
      position: next.day.position,
      dueOn: next.on,
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
 * advances, up to HORIZON_DAYS ahead, on each of its weekdays as it comes
 * round, at the time of the first clean there. A date with no room then (the hours that day, or a crew
 * at that time) is booked nothing, and
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
 * agreed with the Client, as its plan's Job: the new time must have room, and
 * the previous Job's crew is Offered places, as for any plan Job.
 */
export const bookVisit = async (
  planId: string,
  visitId: string,
  { date, time }: LocalDateTime,
) => {
  const booked = await db.transaction(async (tx) => {
    const { plan, visit } = await findVisit(tx, planId, visitId);
    const startsAt = atTime(date, time);
    if (startsAt <= clock.now()) {
      throw new ConflictError("Choose a time that's still to come.");
    }
    // the visit of the weekday it came round on, on the terms it did
    const day = (await daysOfQuote(visit.quoteId, tx)).find(
      (d) => d.position === visit.position,
    )!;
    const booked = await bookOnto(tx, plan, day, startsAt);
    if (!booked) {
      throw new ConflictError(
        "That time doesn't have room for this Job: not enough free Cleaner hours that day, or no crew free then. Choose another.",
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
    .select({
      propertyId: properties.id,
      id: clients.id,
      name: clients.name,
      businessName: clients.businessName,
    })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(inArray(properties.id, propertyIds));
  return new Map(rows.map(({ propertyId, ...client }) => [propertyId, client]));
};

// each plan's Jobs, by visit
const planJobs = (planId: string, column: AnyColumn = jobs.id) =>
  inArray(
    column,
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
  const [homes, next, days] = await Promise.all([
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
    db
      .select({
        quoteId: quotes.id,
        startsAt: revisionOptions.startsAt,
        suggested: revisionOptions.suggested,
      })
      .from(revisionOptions)
      .innerJoin(quotes, eq(quotes.sentRevisionId, revisionOptions.revisionId))
      .where(
        inArray(
          quotes.id,
          plans.map((p) => p.quoteId),
        ),
      )
      .orderBy(asc(revisionOptions.position)),
  ]);
  const homeOf = new Map(homes.map((h) => [h.id, h]));
  const nextOf = new Map(next.map((n) => [n.planId, n.startsAt]));
  const daysOf = Map.groupBy(days, (d) => d.quoteId);
  return new Map(
    plans.map((plan): [string, ServicePlanSummary] => {
      const home = homeOf.get(plan.propertyId)!;
      return [
        plan.id,
        {
          id: plan.id,
          status: plan.status,
          recurrence: plan.recurrence,
          days: daysOf.get(plan.quoteId)!.map((d) => ({
            startsAt: d.startsAt!.toISOString(),
            serviceName: d.suggested.serviceName,
          })),
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

// its Jobs that are Unpaid, soonest first, with what each owes
const unpaidOf = async (planId: string) => {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(planJobs(planId), isNotNull(jobs.unpaidSince)))
    .orderBy(asc(jobs.startsAt));
  return Promise.all(
    rows.map(async (job) => ({
      jobId: job.id,
      startsAt: job.startsAt.toISOString(),
      owedCents: (await paymentOf(job)).owedCents,
    })),
  );
};

// the Unpaid Bills with any of its Jobs on them (ADR-0016), oldest Unpaid
// first, with when each became Unpaid
const unpaidBillsOf = async (planId: string) =>
  (
    await db
      .selectDistinct({
        billId: bills.id,
        number: bills.number,
        totalCents: bills.totalCents,
        since: bills.unpaidSince,
      })
      .from(bills)
      .innerJoin(billLines, eq(billLines.billId, bills.id))
      .where(
        and(planJobs(planId, billLines.jobId), isNotNull(bills.unpaidSince)),
      )
      .orderBy(asc(bills.unpaidSince))
  ).map(({ number, since, ...bill }) => ({
    ...bill,
    number: billNumber(number),
    since: since!.toISOString(),
  }));

// a plan's terms and price, from the Quote it was accepted from
const detailOf = async (
  plan: ServicePlan,
): Promise<Omit<ServicePlanView, "upcoming">> => {
  const [
    [summary],
    [quote],
    days,
    [deposit],
    unpaid,
    unpaidBills,
    endTerms,
    [owner],
  ] = await Promise.all([
    summariesOf([plan]).then((m) => [m.get(plan.id)!]),
    db
      .select({ planDiscountPercent: quoteRevisions.planDiscountPercent })
      .from(quotes)
      .innerJoin(quoteRevisions, eq(quoteRevisions.id, quotes.sentRevisionId))
      .where(eq(quotes.id, plan.quoteId)),
    daysOfQuote(plan.quoteId),
    db
      .select({ cents: sum(charges.amountCents).mapWith(Number) })
      .from(charges)
      .where(
        and(
          // held by the plan, or by its final Job once it has Ended
          or(
            eq(charges.servicePlanId, plan.id),
            planJobs(plan.id, charges.jobId),
          ),
          eq(charges.kind, "deposit"),
        ),
      ),
    unpaidOf(plan.id),
    unpaidBillsOf(plan.id),
    endTermsOf(plan),
    db
      .select({
        billedWeeklyFrom: clients.billedWeeklyFrom,
        billPayment: clients.billPayment,
      })
      .from(properties)
      .innerJoin(clients, eq(clients.id, properties.clientId))
      .where(eq(properties.id, plan.propertyId)),
  ]);
  return {
    ...summary!,
    days: days.map((day) => ({
      startsAt: day.startsAt!.toISOString(),
      serviceName: day.suggested.serviceName,
      crewSize: day.crewSize,
      labourHours: day.labourHours,
      hoursOnSite: Math.round((day.labourHours / day.crewSize) * 100) / 100,
      priceCents: day.priceCents,
      taxCents: day.taxCents,
      totalCents: day.totalCents,
    })),
    startedAt: plan.startedAt.toISOString(),
    discountPercent: quote!.planDiscountPercent!,
    roundTotalCents: days.reduce((total, day) => total + day.totalCents, 0),
    // every weekday has the same
    addOns: days[0]!.suggested.addOns.map((a) => a.name),
    depositCents: deposit?.cents ?? 0,
    quoteId: plan.quoteId,
    unpaid,
    unpaidBills: unpaidBills.map(({ since: _, ...bill }) => bill),
    weeklyBill: owner!.billedWeeklyFrom ? owner!.billPayment : null,
    endTerms,
    endedAt: plan.endedAt?.toISOString() ?? null,
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
    client: {
      id: client.id,
      name: client.name,
      businessName: client.businessName,
    },
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

// the plan each Quote started or changed, for those that did
export const servicePlansOfQuotes = async (quoteIds: string[]) => {
  if (quoteIds.length === 0) return new Map<string, string>();
  const rows = await db
    .selectDistinct({
      id: servicePlanVisits.servicePlanId,
      quoteId: servicePlanVisits.quoteId,
    })
    .from(servicePlanVisits)
    .where(inArray(servicePlanVisits.quoteId, quoteIds));
  return new Map(rows.map((r) => [r.quoteId, r.id]));
};

// ---- On Hold and Ending ----

// plans On Hold, with what their Unpaid Jobs owe, the longest On Hold first
export const plansOnHold = async () => {
  const held = await db
    .select()
    .from(servicePlans)
    .where(eq(servicePlans.status, "on_hold"));
  const [summaries, owners] = await Promise.all([
    summariesOf(held),
    ownersOf(held.map((p) => p.propertyId)),
  ]);
  const items = await Promise.all(
    held.map(async (plan) => {
      const [[first], unpaid, unpaidBills] = await Promise.all([
        db
          .select({ since: min(jobs.unpaidSince) })
          .from(jobs)
          .where(planJobs(plan.id)),
        unpaidOf(plan.id),
        unpaidBillsOf(plan.id),
      ]);
      const since = [first?.since?.toISOString(), unpaidBills[0]?.since].filter(
        (s) => s !== undefined,
      );
      return {
        since: since.sort()[0] ?? plan.updatedAt.toISOString(),
        plan: {
          ...summaries.get(plan.id)!,
          client: owners.get(plan.propertyId)!,
        },
        owedCents: unpaid.reduce((total, u) => total + u.owedCents, 0),
        bills: unpaidBills.map((b) => b.number),
      };
    }),
  );
  return items.sort((a, b) => a.since.localeCompare(b.since));
};

// the Client Ends one of their plans; anyone else's doesn't exist for them
export const clientEndServicePlan = async (
  clientId: string,
  planId: string,
  ending: Parameters<typeof endServicePlan>[1],
) => {
  await findPlan(and(eq(servicePlans.id, planId), eq(clients.id, clientId)));
  await endServicePlan(planId, ending);
  return clientServicePlan(clientId, planId);
};
