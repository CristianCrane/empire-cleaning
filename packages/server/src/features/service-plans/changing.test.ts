import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  AcceptOutcome,
  CleanType,
  OfficeQuote,
  QuoteSummary,
  OfficeServicePlan,
  Recurrence,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "#db";
import { offerAssignment } from "#features/assignments/assignments";
import {
  offerServicePlan,
  saveDraft,
  sendQuote,
} from "#features/quotes/quotes";
import { dayOf, timeOf } from "#services/clock";
import {
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import { crewedServicePlan } from "../../../tests/fixtures.ts";
import { jobQuotes } from "../quotes/job-quotes.ts";
import { servicePlans } from "./service-plans.schema.ts";
import { generateServicePlanJobs } from "./service-plans.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// Casey's weekly Standard Clean plan from 9am on Monday 19 January 2026, for
// a crew of 1, its Jobs booked up to 9 February, with a $50.46 Deposit. The
// clock is at 11am on Monday the 12th.
const MONDAYS = [
  "2026-01-19T14:00:00.000Z",
  "2026-01-26T14:00:00.000Z",
  "2026-02-02T14:00:00.000Z",
  "2026-02-09T14:00:00.000Z",
];
const WEDNESDAY_28TH = "2026-01-28T14:00:00.000Z";
const PLAN_TOTAL = 20185;
const PLAN_DEPOSIT = 5046;

const officePlan = async (office: Agent, id: string) =>
  (await office.get(`/api/service-plans/${id}`).expect(200))
    .body as OfficeServicePlan;

const startsOf = (plan: OfficeServicePlan, status = "booked") =>
  plan.jobs.filter((j) => j.status === status).map((j) => j.startsAt);

// a new Service Plan Quote for the plan's home, Sent by the Office
const sentChange = async (
  office: Agent,
  planId: string,
  {
    startsAt,
    recurrence = "fortnightly",
    cleanType = "standard",
    crewSize = 1,
  }: {
    // a weekday's first clean, or each of several weekdays'
    startsAt: string | string[];
    recurrence?: Recurrence;
    cleanType?: CleanType;
    crewSize?: number;
  },
) => {
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const { property } = await officePlan(office, planId);
  const { quote } = await offerServicePlan(property.id, me.id);
  await saveDraft(quote.id, {
    addOns: [],
    depositPercent: quote.draft!.depositPercent,
    validityDays: quote.draft!.validityDays,
    plan: {
      recurrence,
      discountPercent: quote.draft!.plan!.discountPercent,
      condition: "moderate",
      days: [startsAt].flat().map((s) => {
        const at = new Date(s);
        return {
          start: { date: dayOf(at), time: timeOf(at) },
          cleanType,
          crewSize,
          override: null,
        };
      }),
    },
  });
  return sendQuote(quote.id);
};

const accept = async (client: Agent, quoteId: string, cleanType = "standard") =>
  (
    await client
      .post(`/api/quotes/mine/${quoteId}/accept`)
      .send({ cleanType })
      .expect(200)
  ).body as AcceptOutcome;

// what each Job is priced at, tax included
const totalsOf = async (jobIds: string[]) =>
  new Map((await jobQuotes(jobIds)).map((r) => [r.jobId, r.option.totalCents]));

describe("accepting a Service Plan Quote for a home with a plan", () => {
  test("changes the plan from the Quote's time: its Jobs from then on are cancelled free, and it carries on on the new terms", async () => {
    const { office, client, planId, cleanerId } = await crewedServicePlan();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    const third = (await officePlan(office, planId)).jobs[2]!;
    await offerAssignment(third.id, cleanerId, me.id);
    const quote = await sentChange(office, planId, {
      startsAt: WEDNESDAY_28TH,
    });
    const charged = testPayments().charges.length;
    // what Casey sees before accepting
    const offered = (await client.get(`/api/quotes/mine/${quote.id}`)).body;
    expect(offered.changesPlan).toEqual({
      servicePlanId: planId,
      depositCents: PLAN_DEPOSIT,
      replaces: [MONDAYS[2], MONDAYS[3]],
    });

    const outcome = await accept(client, quote.id);

    expect(outcome).toMatchObject({
      status: "accepted",
      quote: { servicePlanId: planId, changedPlan: true, changesPlan: null },
    });
    // no Deposit: the plan's carries over
    expect(testPayments().charges).toHaveLength(charged);
    const plan = await officePlan(office, planId);
    expect(plan).toMatchObject({
      status: "active",
      recurrence: "fortnightly",
      quoteId: quote.id,
      depositCents: PLAN_DEPOSIT,
      days: [{ startsAt: WEDNESDAY_28TH }],
    });
    expect(startsOf(plan)).toEqual([MONDAYS[0], MONDAYS[1], WEDNESDAY_28TH]);
    expect(startsOf(plan, "cancelled")).toEqual([MONDAYS[2], MONDAYS[3]]);
    const cancelled = plan.jobs.find((j) => j.startsAt === MONDAYS[2])!;
    const job = (await office.get(`/api/jobs/${cancelled.id}`).expect(200))
      .body;
    expect(job.cancellation).toMatchObject({
      by: "client",
      late: false,
      feeCents: 0,
      reason: "The Service Plan's terms changed",
    });

    const confirmation = testEmail().lastTo("casey@example.com");
    expect(confirmation.subject).toBe(
      "Your Service Plan with Empire Cleaning has changed",
    );
    expect(confirmation.text).toContain(
      "it's a Standard Clean every 2 weeks, on Wednesdays at 9:00 AM",
    );
    expect(confirmation.text).toContain("are cancelled, at no charge");
    expect(confirmation.text).toContain("Your Deposit stays as it is");
    // Cory holds a place on the 2 February Job, and hears it's off
    const off = testEmail().lastTo("cory@example.com");
    expect(off.subject).toBe("A Job you're on is cancelled");
    expect(off.text).toContain("February 2");

    // it comes round every 2 weeks from the new first Job
    testClock().set(new Date("2026-02-01T12:00:00Z"));
    await generateServicePlanJobs();
    expect(startsOf(await officePlan(office, planId))).toEqual([
      MONDAYS[0],
      MONDAYS[1],
      WEDNESDAY_28TH,
      "2026-02-11T14:00:00.000Z",
      "2026-02-25T14:00:00.000Z",
    ]);
  });

  test("prices Jobs before the change as they were, and those from it on the new terms", async () => {
    const { office, client, planId } = await crewedServicePlan();
    const quote = await sentChange(office, planId, {
      startsAt: WEDNESDAY_28TH,
      recurrence: "weekly",
      cleanType: "deep",
    });
    await accept(client, quote.id, "deep");

    const plan = await officePlan(office, planId);
    expect(plan.days.map((d) => d.cleanType)).toEqual(["deep"]);
    const booked = plan.jobs.filter((j) => j.status === "booked");
    const totals = await totalsOf(booked.map((j) => j.id));
    const before = booked.filter((j) => j.startsAt < WEDNESDAY_28TH);
    const after = booked.filter((j) => j.startsAt >= WEDNESDAY_28TH);
    expect(before.map((j) => j.cleanType)).toEqual(["standard", "standard"]);
    expect(before.map((j) => totals.get(j.id))).toEqual([
      PLAN_TOTAL,
      PLAN_TOTAL,
    ]);
    expect(after.map((j) => j.startsAt)).toEqual([
      WEDNESDAY_28TH,
      "2026-02-04T14:00:00.000Z",
    ]);
    expect(after.map((j) => j.cleanType)).toEqual(["deep", "deep"]);
    const deepTotal = totals.get(after[0]!.id)!;
    expect(deepTotal).toBeGreaterThan(PLAN_TOTAL);
    expect(totals.get(after[1]!.id)).toBe(deepTotal);
    expect(plan.days[0]!.totalCents).toBe(deepTotal);
  });

  test("can take the time of a Job it replaces, which no longer counts against the day", async () => {
    const { office, client, planId } = await crewedServicePlan();
    // both Cleaners at 9am on the 2nd: the plan's own Job takes one
    const quote = await sentChange(office, planId, {
      startsAt: MONDAYS[2]!,
      recurrence: "weekly",
      crewSize: 2,
    });
    // Casey is offered it as bookable, and the Office isn't told it's full
    expect(
      (await client.get(`/api/quotes/mine/${quote.id}`).expect(200)).body
        .bookable,
    ).toEqual(["standard"]);

    await accept(client, quote.id);

    const plan = await officePlan(office, planId);
    expect(startsOf(plan)).toEqual([
      MONDAYS[0],
      MONDAYS[1],
      MONDAYS[2],
      MONDAYS[3],
    ]);
    expect(startsOf(plan, "cancelled")).toEqual([MONDAYS[2], MONDAYS[3]]);
    expect(
      plan.jobs.filter((j) => j.status === "booked").map((j) => j.crewSize),
    ).toEqual([1, 1, 2, 2]);
  });

  test("leaves a plan On Hold until nothing is Unpaid", async () => {
    const { office, client, planId } = await crewedServicePlan();
    await db
      .update(servicePlans)
      .set({ status: "on_hold" })
      .where(eq(servicePlans.id, planId));
    const quote = await sentChange(office, planId, {
      startsAt: WEDNESDAY_28TH,
    });

    await accept(client, quote.id);

    const plan = await officePlan(office, planId);
    expect(plan.status).toBe("on_hold");
    expect(plan.recurrence).toBe("fortnightly");
    testClock().set(new Date("2026-02-01T12:00:00Z"));
    await generateServicePlanJobs();
    expect(startsOf(await officePlan(office, planId))).toEqual([
      MONDAYS[0],
      MONDAYS[1],
      WEDNESDAY_28TH,
    ]);
  });

  test("can be recorded by the Office, charging nothing", async () => {
    const { office, planId } = await crewedServicePlan();
    const quote = await sentChange(office, planId, {
      startsAt: WEDNESDAY_28TH,
    });
    const charged = testPayments().charges.length;

    await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ cleanType: "standard" })
      .expect(200);

    expect(testPayments().charges).toHaveLength(charged);
    expect((await officePlan(office, planId)).quoteId).toBe(quote.id);
  });
});

describe("a Client asking to change their plan", () => {
  test("reaches the Office as a Requested Quote for the home, made a Service Plan Quote that changes the plan", async () => {
    const { office, client, planId } = await crewedServicePlan();
    const { property } = await officePlan(office, planId);

    await client
      .post("/api/quotes/ask")
      .send({
        property: { existing: property.id },
        condition: "moderate",
        wantsRegularService: true,
        notes: "Could we move to Wednesdays, every 2 weeks?",
      })
      .expect(201);

    const [listed] = (await office.get("/api/quotes").expect(200))
      .body as QuoteSummary[];
    const requested = (
      await office.get(`/api/quotes/${listed!.id}`).expect(200)
    ).body as OfficeQuote;
    expect(requested).toMatchObject({
      status: "requested",
      asked: { notes: "Could we move to Wednesdays, every 2 weeks?" },
      homePlanId: planId,
    });
    const draft = (
      await office
        .post(`/api/quotes/${listed!.id}/revisions`)
        .send({ kind: "service_plan" })
        .expect(201)
    ).body as OfficeQuote;
    expect(draft.changesPlan).toMatchObject({ servicePlanId: planId });
    await office
      .patch(`/api/quotes/${draft.id}/draft`)
      .send({
        addOns: [],
        depositPercent: draft.draft!.depositPercent,
        validityDays: draft.draft!.validityDays,
        plan: {
          recurrence: "fortnightly",
          discountPercent: draft.draft!.plan!.discountPercent,
          condition: draft.draft!.plan!.condition,
          days: [
            {
              start: { date: "2026-01-28", time: "09:00" },
              cleanType: "standard",
              crewSize: 1,
              override: null,
            },
          ],
        },
      })
      .expect(200);
    await office.post(`/api/quotes/${draft.id}/send`).expect(200);

    await accept(client, draft.id);

    expect((await officePlan(office, planId)).quoteId).toBe(draft.id);
    // answered: it no longer waits for the Office
    expect((await office.get("/api/quotes").expect(200)).body).toEqual([]);
  });
});
