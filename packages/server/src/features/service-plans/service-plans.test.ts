import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  AcceptOutcome,
  NeedsAttentionItem,
  OfficePropertyView,
  OfficeQuote,
  OfficeServicePlan,
  PriceList,
  QuoteDraftInput,
  ServicePlanSummary,
  ServicePlanView,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import { completeJob } from "#features/completion";
import { bookJob } from "#features/jobs";
import { charges } from "#features/payments";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import {
  casey,
  completedFirstClean,
  signInAsOffice,
} from "../../../tests/fixtures.ts";
import { generateServicePlanJobs } from "./service-plans.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// The First Clean is done at 11am on Monday 12 January 2026, New York time,
// and the clock is left there, so plan Jobs are generated up to Monday 9
// February. Plans here start at 9am on Monday the 19th, for a crew of 2.
const plansStart = { date: "2026-01-19", time: "09:00" };
const MONDAYS = [
  "2026-01-19T14:00:00.000Z",
  "2026-01-26T14:00:00.000Z",
  "2026-02-02T14:00:00.000Z",
  "2026-02-09T14:00:00.000Z",
];

// Casey's home as a Standard Clean at moderate Condition on the placeholder
// Price List: $206, less the 10% Plan Discount, is $185.40, plus 8.875% tax
const PLAN_PRICE = 18540;
const PLAN_TOTAL = PLAN_PRICE + 1645;
// the 25% Deposit on that
const PLAN_DEPOSIT = 5046;

const firstCleanDone = async () => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const done = await completedFirstClean({ byAccountId: me.id });
  return { office, me, ...done };
};

const sentPlan = async (
  office: Agent,
  propertyId: string,
  changes: Partial<QuoteDraftInput> = {},
) => {
  const draft = (
    await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(201)
  ).body as OfficeQuote;
  await office
    .patch(`/api/quotes/${draft.id}`)
    .send({
      addOns: [],
      crewSize: draft.crewSize,
      depositPercent: draft.depositPercent,
      validityDays: draft.validityDays,
      proposedStart: plansStart,
      overrides: { deep: null, standard: null },
      plan: {
        recurrence: "weekly",
        cleanType: draft.plan!.cleanType,
        discountPercent: draft.plan!.discountPercent,
        condition: draft.plan!.condition,
      },
      ...changes,
    })
    .expect(200);
  return (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
    .body as OfficeQuote;
};

const accept = (client: Agent, quote: OfficeQuote, cleanType = "standard") =>
  client.post(`/api/quotes/mine/${quote.id}/accept`).send({ cleanType });

// Casey accepts a weekly Standard Clean plan with the card saved at their
// First Clean; `beforeQuote` runs once the First Clean is done
const startedPlan = async (
  changes: Partial<QuoteDraftInput> = {},
  beforeQuote?: (office: Agent) => Promise<unknown>,
) => {
  const first = await firstCleanDone();
  await beforeQuote?.(first.office);
  const quote = await sentPlan(first.office, first.propertyId, changes);
  const client = await signIn(casey.email);
  const outcome = (await accept(client, quote).expect(200))
    .body as AcceptOutcome;
  if (outcome.status !== "accepted") throw new Error("not accepted");
  return { ...first, client, quote, planId: outcome.quote.servicePlanId! };
};

const officePlan = async (office: Agent, id: string) =>
  (await office.get(`/api/service-plans/${id}`).expect(200))
    .body as OfficeServicePlan;

const clientPlan = async (client: Agent, id: string) =>
  (await client.get(`/api/service-plans/mine/${id}`).expect(200))
    .body as ServicePlanView;

const needsAttention = async (office: Agent) =>
  (await office.get("/api/dashboard/needs-attention").expect(200))
    .body as NeedsAttentionItem[];

const startsOf = (plan: OfficeServicePlan) => plan.jobs.map((j) => j.startsAt);

describe("accepting a Service Plan Quote", () => {
  test("takes one Deposit, held by the plan, books its first Job, and puts its Jobs 4 weeks ahead on the Schedule", async () => {
    const { office, client, quote, planId } = await startedPlan();

    const plan = await officePlan(office, planId);
    expect(plan).toMatchObject({
      status: "active",
      recurrence: "weekly",
      cleanType: "standard",
      crewSize: 2,
      totalCents: PLAN_TOTAL,
      depositCents: PLAN_DEPOSIT,
      quoteId: quote.id,
      client: { name: casey.name },
      unplaced: [],
    });
    expect(startsOf(plan)).toEqual(MONDAYS);
    expect(plan.jobs.every((j) => j.cleanType === "standard")).toBe(true);

    // the Deposit is the plan's, not its first Job's
    const deposits = await db
      .select()
      .from(charges)
      .where(eq(charges.servicePlanId, planId));
    expect(deposits).toEqual([
      expect.objectContaining({
        kind: "deposit",
        amountCents: PLAN_DEPOSIT,
        jobId: null,
      }),
    ]);
    expect(testPayments().charges.at(-1)!.amount).toBe(PLAN_DEPOSIT);

    expect(
      (await clientPlan(client, planId)).upcoming.map((j) => j.startsAt),
    ).toEqual(MONDAYS);
  });

  test("sends one confirmation for the plan, and none for the Jobs it generates", async () => {
    await startedPlan();

    const sent = testEmail().sent.filter((m) => m.to === casey.email);
    const confirmations = sent.filter((m) =>
      /Service Plan .* has started/.test(m.subject),
    );
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]!.text).toContain(
      "a Standard Clean at 41-12 Austin St",
    );
    expect(confirmations[0]!.text).toContain(
      "every week, on Mondays at 9:00 AM",
    );
    expect(confirmations[0]!.text).toContain("$50.46");
    expect(sent.filter((m) => /booked/i.test(m.subject))).toHaveLength(1);
  });

  test("leaves the Quote Sent and starts nothing if the Deposit fails", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    const client = await signIn(casey.email);
    testPayments().failCharges("card_declined");

    await accept(client, quote).expect(409);

    const after = (await office.get(`/api/quotes/${quote.id}`).expect(200))
      .body as OfficeQuote;
    expect(after.status).toBe("sent");
    expect(after.servicePlanId).toBeNull();
    const home = (await office.get(`/api/properties/${propertyId}`).expect(200))
      .body as OfficePropertyView;
    expect(home.servicePlan).toBeNull();
  });

  test("leaves the Quote Sent if the first Job's day has no room", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    await bookJob({
      propertyId,
      cleanType: "deep",
      startsAt: new Date(MONDAYS[0]!),
      labourHours: 8,
      crewSize: 2,
    });
    const client = await signIn(casey.email);

    const refused = await accept(client, quote).expect(409);
    expect(refused.body.message).toMatch(/booked up/);
    expect(
      (
        (await office.get(`/api/quotes/${quote.id}`).expect(200))
          .body as OfficeQuote
      ).status,
    ).toBe("sent");
  });

  test("is for the plan's own Clean Type", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    const client = await signIn(casey.email);

    const refused = await accept(client, quote, "deep").expect(409);
    expect(refused.body.message).toBe(
      "This Service Plan is for a Standard Clean.",
    );
  });

  test("can be recorded by the Office, charging the saved card", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);

    await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ cleanType: "standard" })
      .expect(200);

    const home = (await office.get(`/api/properties/${propertyId}`).expect(200))
      .body as OfficePropertyView;
    expect(home.servicePlan).toMatchObject({
      status: "active",
      recurrence: "weekly",
      nextStartsAt: MONDAYS[0],
    });
  });

  test("for a home that has a plan changes that plan, rather than starting another", async () => {
    const { office, propertyId, client, planId } = await startedPlan();
    testClock().advance({ days: 1 });
    const another = await sentPlan(office, propertyId, {
      proposedStart: { date: "2026-01-21", time: "09:00" },
    });

    const outcome = (await accept(client, another).expect(200))
      .body as AcceptOutcome;
    expect(outcome).toMatchObject({
      status: "accepted",
      quote: { servicePlanId: planId },
    });
    expect((await officePlan(office, planId)).quoteId).toBe(another.id);
  });
});

describe("a Service Plan's Jobs", () => {
  test("come within reach as the Clock advances, each date once", async () => {
    const { office, planId } = await startedPlan({
      plan: {
        recurrence: "fortnightly",
        cleanType: "standard",
        discountPercent: 10,
        condition: "moderate",
      },
    });
    expect(startsOf(await officePlan(office, planId))).toEqual([
      MONDAYS[0],
      MONDAYS[2],
    ]);

    testClock().advance({ days: 14 });
    expect(await generateServicePlanJobs()).toBe(1);
    expect(await generateServicePlanJobs()).toBe(0);
    expect(startsOf(await officePlan(office, planId))).toEqual([
      MONDAYS[0],
      MONDAYS[2],
      "2026-02-16T14:00:00.000Z",
    ]);
  });

  test("keep their time across the clocks changing", async () => {
    const { office, planId } = await startedPlan();

    // New York's clocks go forward on 8 March: 9am is then 13:00 UTC
    testClock().advance({ days: 35 });
    await generateServicePlanJobs();
    expect(startsOf(await officePlan(office, planId)).slice(-2)).toEqual([
      "2026-03-09T13:00:00.000Z",
      "2026-03-16T13:00:00.000Z",
    ]);
  });

  test("are Offered to the crew of the plan's previous Job", async () => {
    const { office, me, planId } = await startedPlan();
    const cory = (await officePlan(office, planId)).jobs;
    const dee = await createStaff({
      name: "Dee Cleaner",
      email: "dee@example.com",
      roles: ["cleaner"],
    });
    await setUsualWeek(dee.id, [8, 8, 8, 8, 8, 0, 0]);
    const latest = cory.at(-1)!;
    const { id: coryId } = (
      (await office.get("/api/staff").expect(200)).body as {
        id: string;
        name: string;
      }[]
    ).find((s) => s.name === "Cory Cleaner")!;
    await offerAssignment(latest.id, coryId, me.id);
    await offerAssignment(latest.id, dee.id, me.id);

    testClock().advance({ days: 7 });
    await generateServicePlanJobs();

    const next = (await officePlan(office, planId)).jobs.at(-1)!;
    expect(next.startsAt).toBe("2026-02-16T14:00:00.000Z");
    expect(next.crew.map((c) => c.name).sort()).toEqual([
      "Cory Cleaner",
      "Dee Cleaner",
    ]);
    expect(next.assignment).toBe("unassigned");
    expect(testEmail().lastTo("dee@example.com").subject).toBe(
      "You've been offered a Job",
    );
  });

  test("on a day with no room are booked nothing, and wait for the Office to book or skip", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    // the 2nd of February is full
    await bookJob({
      propertyId,
      cleanType: "deep",
      startsAt: new Date(MONDAYS[2]!),
      labourHours: 16,
      crewSize: 2,
    });
    const client = await signIn(casey.email);
    const outcome = (await accept(client, quote).expect(200))
      .body as AcceptOutcome;
    if (outcome.status !== "accepted") throw new Error("not accepted");
    const planId = outcome.quote.servicePlanId!;

    const plan = await officePlan(office, planId);
    expect(startsOf(plan)).toEqual([MONDAYS[0], MONDAYS[1], MONDAYS[3]]);
    expect(plan.unplaced).toEqual([
      expect.objectContaining({ dueOn: "2026-02-02" }),
    ]);
    const [visit] = plan.unplaced;
    expect(await needsAttention(office)).toContainEqual(
      expect.objectContaining({
        kind: "plan_visit_unplaced",
        visit,
        plan: expect.objectContaining({
          id: planId,
          client: expect.objectContaining({ name: casey.name }),
        }),
      }),
    );

    // a full day is refused, then the Tuesday is booked as a plan Job
    const full = await office
      .post(`/api/service-plans/${planId}/visits/${visit!.id}/book`)
      .send({ date: "2026-02-02", time: "13:00" })
      .expect(409);
    expect(full.body.message).toMatch(/doesn't have room/);
    const booked = (
      await office
        .post(`/api/service-plans/${planId}/visits/${visit!.id}/book`)
        .send({ date: "2026-02-03", time: "10:00" })
        .expect(200)
    ).body as OfficeServicePlan;
    expect(startsOf(booked)).toContain("2026-02-03T15:00:00.000Z");
    expect(booked.unplaced).toEqual([]);
    expect(
      (await needsAttention(office)).filter(
        (i) => i.kind === "plan_visit_unplaced",
      ),
    ).toEqual([]);
    await office
      .post(`/api/service-plans/${planId}/visits/${visit!.id}/skip`)
      .expect(409);
  });

  test("at a time with no crew free are booked nothing, though the hours are", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    // on the 2nd of February, both Cleaners are at another Job from 9 to 10
    await bookJob({
      propertyId,
      cleanType: "deep",
      startsAt: new Date(MONDAYS[2]!),
      labourHours: 2,
      crewSize: 2,
    });
    const client = await signIn(casey.email);
    const outcome = (await accept(client, quote).expect(200))
      .body as AcceptOutcome;
    if (outcome.status !== "accepted") throw new Error("not accepted");
    const planId = outcome.quote.servicePlanId!;

    const plan = await officePlan(office, planId);
    expect(startsOf(plan)).toEqual([MONDAYS[0], MONDAYS[1], MONDAYS[3]]);
    expect(plan.unplaced).toEqual([
      expect.objectContaining({ dueOn: "2026-02-02" }),
    ]);

    // the Office can't book it then either, but can once they've gone
    const [visit] = plan.unplaced;
    const book = (time: string) =>
      office
        .post(`/api/service-plans/${planId}/visits/${visit!.id}/book`)
        .send({ date: "2026-02-02", time });
    expect((await book("09:30").expect(409)).body.message).toMatch(
      /no crew free then/,
    );
    await book("10:00").expect(200);
  });

  test("can be skipped by the Office when there's no room", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    await bookJob({
      propertyId,
      cleanType: "deep",
      startsAt: new Date(MONDAYS[1]!),
      labourHours: 16,
      crewSize: 2,
    });
    await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ cleanType: "standard" })
      .expect(200);
    const home = (await office.get(`/api/properties/${propertyId}`).expect(200))
      .body as OfficePropertyView;
    const planId = home.servicePlan!.id;
    const [visit] = (await officePlan(office, planId)).unplaced;

    const skipped = (
      await office
        .post(`/api/service-plans/${planId}/visits/${visit!.id}/skip`)
        .expect(200)
    ).body as OfficeServicePlan;
    expect(skipped.unplaced).toEqual([]);
    expect(startsOf(skipped)).toEqual([MONDAYS[0], MONDAYS[2], MONDAYS[3]]);
  });
});

describe("completing a plan Job", () => {
  const completeFirst = async (
    started: Awaited<ReturnType<typeof startedPlan>>,
    reports: Parameters<typeof completeJob>[2]["reports"] = [],
  ) => {
    const { office, me, planId } = started;
    const [first] = (await officePlan(office, planId)).jobs;
    const [{ id: cleanerId }] = (await office.get("/api/staff").expect(200))
      .body as { id: string }[];
    const offered = await offerAssignment(first!.id, cleanerId!, me.id);
    await confirmAssignment(cleanerId!, offered.assignments[0]!.id);
    testClock().set(new Date("2026-01-19T16:00:00Z"));
    await completeJob(cleanerId!, first!.id, {
      condition: "moderate",
      reports,
    });
    return first!.id;
  };

  test("charges its full discounted price: the plan's Deposit doesn't come off it", async () => {
    const started = await startedPlan({ crewSize: 1 });
    await completeFirst(started);

    expect(testPayments().charges.at(-1)!.amount).toBe(PLAN_TOTAL);
  });

  test("prices Adjustments at the full rate, taxed as a Service Plan Job", async () => {
    const started = await startedPlan({ crewSize: 1 }, async (office) => {
      const list = (await office.get("/api/price-list").expect(200))
        .body as PriceList;
      await office
        .put("/api/price-list")
        .send({ ...list, taxServicePlanPercent: 5 })
        .expect(200);
    });
    const jobId = await completeFirst(started, [
      { kind: "extra_time", hours: 1, reason: "Heavy grease in the kitchen" },
    ]);

    const job = (await started.office.get(`/api/jobs/${jobId}`).expect(200))
      .body as { completion: { adjustments: unknown[] } };
    // $55 an hour, no Plan Discount, plus 5% tax
    expect(job.completion.adjustments).toEqual([
      expect.objectContaining({ workedOutCents: 5500, totalCents: 5775 }),
    ]);
  });
});

describe("the Client's Service Plans", () => {
  test("list each plan with its next Job, and show its terms and upcoming Jobs", async () => {
    const { client, planId } = await startedPlan();

    const plans = (await client.get("/api/service-plans/mine").expect(200))
      .body as ServicePlanSummary[];
    expect(plans).toEqual([
      expect.objectContaining({
        id: planId,
        recurrence: "weekly",
        cleanType: "standard",
        nextStartsAt: MONDAYS[0],
      }),
    ]);

    const plan = await clientPlan(client, planId);
    expect(plan).toMatchObject({
      discountPercent: 10,
      priceCents: PLAN_PRICE,
      totalCents: PLAN_TOTAL,
      depositCents: PLAN_DEPOSIT,
      firstStartsAt: MONDAYS[0],
    });
    expect(plan.upcoming).toHaveLength(4);
  });

  test("are theirs alone", async () => {
    const { office, planId } = await startedPlan();
    await office.get(`/api/service-plans/mine/${planId}`).expect(403);
    const other = await signIn("someone@example.com");
    await other.get(`/api/service-plans/mine/${planId}`).expect(403);
  });
});
