import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  AcceptOutcome,
  DayTimes,
  OfficeQuote,
  QuoteSummary,
  OfficeServicePlan,
  Recurrence,
  SignedInAccount,
} from "@empire-cleaning/models";
import { dayOf, timeOf } from "@empire-cleaning/models";
import { db } from "#db";
import { findClientByEmail } from "#features/clients";
import { paymentMethods } from "#features/payments";
import { offerAssignment } from "#features/assignments";
import { offerServicePlan, saveDraft, sendQuote } from "#features/quotes";
import {
  type Agent,
  testClock,
  testEmail,
  refusingInserts,
  testPayments,
} from "../../../tests/harness.ts";
import {
  billWeekly,
  casey,
  crewedServicePlan,
} from "../../../tests/fixtures.ts";
import { jobQuotes } from "../quotes/job-quotes.ts";
import { servicePlans } from "./service-plans.schema.ts";
import { generateServicePlanJobs } from "./service-plans.ts";
import { SEEDED } from "#features/services";

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

// a new Service Plan Quote for the plan's home, saved as a Draft by the
// Office
const draftedChange = async (
  office: Agent,
  planId: string,
  {
    startsAt,
    recurrence = "fortnightly",
    service = "standard",
    crewSize = 1,
  }: {
    // a weekday's first clean, or each of several weekdays'
    startsAt: string | string[];
    recurrence?: Recurrence;
    service?: "deep" | "standard";
    crewSize?: number;
  },
) => {
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const { property } = await officePlan(office, planId);
  const { quote } = await offerServicePlan(property.id, me.id);
  return saveDraft(quote.id, {
    addOns: [],
    depositPercent: quote.draft!.depositPercent,
    validityDays: quote.draft!.validityDays,
    plan: {
      serviceKey: SEEDED[service],
      recurrence,
      discountPercent: quote.draft!.plan!.discountPercent,
      condition: "moderate",
      days: [startsAt].flat().map((s) => {
        const at = new Date(s);
        return {
          start: { date: dayOf(at), time: timeOf(at) },
          crewSize,
          override: null,
        };
      }),
    },
  });
};

// such a Quote, Sent
const sentChange = async (
  office: Agent,
  planId: string,
  terms: Parameters<typeof draftedChange>[2],
) => sendQuote((await draftedChange(office, planId, terms)).id);

const accept = async (
  client: Agent,
  quote: Pick<OfficeQuote, "id" | "offer">,
  service: "deep" | "standard" = "standard",
) =>
  (
    await client
      .post(`/api/quotes/mine/${quote.id}/accept`)
      .send({ revisionId: quote.offer!.id, serviceKey: SEEDED[service] })
      .expect(200)
  ).body as AcceptOutcome;

// what each Job is priced at, tax included
const totalsOf = async (jobIds: string[]) =>
  new Map((await jobQuotes(jobIds)).map((r) => [r.jobId, r.option.totalCents]));

describe("accepting a Service Plan Quote for a home with a plan", () => {
  // the slowest server test, ~3.6 s in a full run where the median takes
  // 0.3 s, so with two checkouts' runs at once it passed Vitest's 5 s. Its own
  // 10 s: it crews a plan, sends and accepts a change to it, which cancels
  // Jobs and emails each person, and books the plan on. #316 brought it down
  // only 0.2 s
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

    const outcome = await accept(client, quote);

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
      // what happened, which each reader's words say (#395)
      withPlan: "changed",
      reason: null,
    });

    const confirmation = testEmail().lastTo("casey@example.com");
    expect(confirmation.subject).toBe(
      "Your cleaning plan with Empire Cleaning has changed",
    );
    expect(confirmation.text).toContain(
      "it's a Standard Clean every 2 weeks, on Wednesdays at 9:00 AM",
    );
    expect(confirmation.text).toContain("are cancelled, at no charge");
    expect(confirmation.text).toContain("Your deposit stays as it is");
    // Cory is on the 2 February Job, and hears it's off
    const off = testEmail().lastTo("cory@example.com");
    expect(off.subject).toBe("A job you're on is cancelled");
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
  }, 10_000);

  test("tells a Client billed weekly that each week's cleans go on one Bill (#244 #5)", async () => {
    const { office, client, planId } = await crewedServicePlan();
    await billWeekly("automatic");
    const quote = await sentChange(office, planId, {
      startsAt: WEDNESDAY_28TH,
    });
    const offered = (await client.get(`/api/quotes/mine/${quote.id}`)).body;
    expect(offered.weeklyBill).toBe("automatic");

    await accept(client, quote);

    const confirmation = testEmail().lastTo(casey.email);
    expect(confirmation.subject).toBe(
      "Your cleaning plan with Empire Cleaning has changed",
    );
    expect(confirmation.text).not.toContain("when it's done");
    expect(confirmation.text).toContain(
      "Each clean is now $201.85. Each week's cleans go on one bill, made the following Monday and charged to your card.",
    );
  });

  test("prices Jobs before the change as they were, and those from it on the new terms", async () => {
    const { office, client, planId } = await crewedServicePlan();
    const quote = await sentChange(office, planId, {
      startsAt: WEDNESDAY_28TH,
      recurrence: "weekly",
      service: "deep",
    });
    await accept(client, quote, "deep");

    const plan = await officePlan(office, planId);
    expect(plan.days.map((d) => d.serviceName)).toEqual(["Deep Clean"]);
    const booked = plan.jobs.filter((j) => j.status === "booked");
    const totals = await totalsOf(booked.map((j) => j.id));
    const before = booked.filter((j) => j.startsAt < WEDNESDAY_28TH);
    const after = booked.filter((j) => j.startsAt >= WEDNESDAY_28TH);
    expect(before.map((j) => j.serviceName)).toEqual([
      "Standard Clean",
      "Standard Clean",
    ]);
    expect(before.map((j) => totals.get(j.id))).toEqual([
      PLAN_TOTAL,
      PLAN_TOTAL,
    ]);
    expect(after.map((j) => j.startsAt)).toEqual([
      WEDNESDAY_28TH,
      "2026-02-04T14:00:00.000Z",
    ]);
    expect(after.map((j) => j.serviceName)).toEqual([
      "Deep Clean",
      "Deep Clean",
    ]);
    const deepTotal = totals.get(after[0]!.id)!;
    expect(deepTotal).toBeGreaterThan(PLAN_TOTAL);
    expect(totals.get(after[1]!.id)).toBe(deepTotal);
    expect(plan.days[0]!.totalCents).toBe(deepTotal);
  });

  test("a Draft is told the time of a Job it replaces has room, as accepting would", async () => {
    const { office, planId } = await crewedServicePlan();
    // both Cleaners at 9am on the 2nd: the plan's own Job takes one
    const draft = await draftedChange(office, planId, {
      startsAt: MONDAYS[2]!,
      recurrence: "weekly",
      crewSize: 2,
    });
    const viewed = (await office.get(`/api/quotes/${draft.id}`).expect(200))
      .body as OfficeQuote;
    expect(viewed.draft!.options.map((o) => o.room)).toMatchObject([
      { date: "2026-02-02", hasRoom: true, crewsBusy: 0 },
    ]);
  });

  test("a Draft's picker marks the starts without a crew free as accepting would count them", async () => {
    const { office, planId } = await crewedServicePlan();
    // both Cleaners from 9am on the 2nd: the plan's own Job, 9am for a crew
    // of 1, takes one
    const draft = await draftedChange(office, planId, {
      startsAt: MONDAYS[2]!,
      recurrence: "weekly",
      crewSize: 2,
    });
    const marked = async (weekday: number) =>
      (
        (
          await office
            .get(
              `/api/quotes/${draft.id}/draft/starts?from=2026-02-02&to=2026-02-02&weekday=${weekday}`,
            )
            .expect(200)
        ).body as DayTimes[]
      )[0]!.times;

    // from 9 it replaces the plan's Job; from 9:30 it doesn't, as that Job
    // starts before it, and it's still on
    const times = await marked(0);
    expect(times).not.toContain("08:00");
    expect(times).not.toContain("09:00");
    expect(times).toContain("09:30");
  });

  test("a Draft's picker counts the replaced Jobs from its earliest weekday, as saved", async () => {
    const { office, planId } = await crewedServicePlan();
    // Sunday the 1st first, then Monday the 2nd: the Sunday's start replaces
    // the plan's Monday Job, whenever on the Monday the second weekday starts
    const draft = await draftedChange(office, planId, {
      startsAt: ["2026-02-01T14:00:00.000Z", MONDAYS[2]!],
      recurrence: "weekly",
      crewSize: 2,
    });
    const { times } = (
      (
        await office
          .get(
            `/api/quotes/${draft.id}/draft/starts?from=2026-02-02&to=2026-02-02&weekday=1`,
          )
          .expect(200)
      ).body as DayTimes[]
    )[0]!;
    expect(times).not.toContain("09:30");

    await office
      .get(`/api/quotes/${draft.id}/draft/starts?from=2026-02-02&to=2026-02-01`)
      .expect(400);
    // a weekday it hasn't, or none, is refused rather than shown as free;
    // an empty one too, rather than read as the first
    for (const weekday of ["&weekday=7", "&weekday=2", "", "&weekday="]) {
      await office
        .get(
          `/api/quotes/${draft.id}/draft/starts?from=2026-02-02&to=2026-02-02${weekday}`,
        )
        .expect(400);
    }
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
    ).toEqual([SEEDED.standard]);

    await accept(client, quote);

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

    await accept(client, quote);

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

  test("starting beyond the 28 days booked, keeps booking the old terms up to its start (#242)", async () => {
    const { office, client, planId } = await crewedServicePlan();
    const quote = await sentChange(office, planId, {
      startsAt: "2026-03-04T14:00:00.000Z",
      recurrence: "weekly",
    });
    await accept(client, quote);

    testClock().set(new Date("2026-02-14T17:00:00Z"));
    await generateServicePlanJobs();

    // Mondays up to the change, then Wednesdays up to 28 days ahead (New
    // York is on daylight saving time from 8 March)
    expect(startsOf(await officePlan(office, planId))).toEqual([
      ...MONDAYS,
      "2026-02-16T14:00:00.000Z",
      "2026-02-23T14:00:00.000Z",
      "2026-03-02T14:00:00.000Z",
      "2026-03-04T14:00:00.000Z",
      "2026-03-11T13:00:00.000Z",
    ]);
  });

  test("accepted while On Hold, books the old terms up to its start once it resumes (#242)", async () => {
    const { office, client, planId } = await crewedServicePlan();
    await db
      .update(servicePlans)
      .set({ status: "on_hold" })
      .where(eq(servicePlans.id, planId));
    const quote = await sentChange(office, planId, {
      startsAt: "2026-03-04T14:00:00.000Z",
      recurrence: "weekly",
    });
    await accept(client, quote);

    testClock().set(new Date("2026-02-15T17:00:00Z"));
    await db
      .update(servicePlans)
      .set({ status: "active" })
      .where(eq(servicePlans.id, planId));
    await generateServicePlanJobs();

    expect(startsOf(await officePlan(office, planId))).toEqual([
      ...MONDAYS,
      "2026-02-16T14:00:00.000Z",
      "2026-02-23T14:00:00.000Z",
      "2026-03-02T14:00:00.000Z",
      "2026-03-04T14:00:00.000Z",
      "2026-03-11T13:00:00.000Z",
    ]);
  });

  test("can take a time held for moving a Job it replaces, and closes that request (#242)", async () => {
    const { office, client, planId } = await crewedServicePlan();
    // only Cory works on Wednesday the 4th: room for one crew at a time
    const staff = (await office.get("/api/staff").expect(200)).body as {
      id: string;
      email: string;
    }[];
    const bea = staff.find((s) => s.email === "bea@example.com")!;
    await office
      .put(`/api/staff/${bea.id}/exceptions/2026-02-04`)
      .send({ hours: 0 })
      .expect(200);
    // Casey asks to move the 9 February clean to 9am on the 4th
    const ninth = (await officePlan(office, planId)).jobs[3]!;
    await client
      .post(`/api/jobs/mine/${ninth.id}/reschedule-request`)
      .send({ date: "2026-02-04", time: "09:00", cost: "free" })
      .expect(201);

    // new terms from 9am on the 4th replace the 9 February clean
    const quote = await sentChange(office, planId, {
      startsAt: "2026-02-04T14:00:00.000Z",
      recurrence: "weekly",
    });
    expect((await accept(client, quote)).status).toBe("accepted");

    expect(startsOf(await officePlan(office, planId))).toContain(
      "2026-02-04T14:00:00.000Z",
    );
    const replaced = (await office.get(`/api/jobs/${ninth.id}`).expect(200))
      .body;
    expect(replaced.rescheduleRequest.status).toBe("closed");
  });

  test("can be recorded by the Office, charging nothing", async () => {
    const { office, planId } = await crewedServicePlan();
    const quote = await sentChange(office, planId, {
      startsAt: WEDNESDAY_28TH,
    });
    const charged = testPayments().charges.length;

    await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.standard })
      .expect(200);

    expect(testPayments().charges).toHaveLength(charged);
    expect((await officePlan(office, planId)).quoteId).toBe(quote.id);
  });
});

// #241, finding 5
describe("a change to a plan whose replaced Job owes a fee", () => {
  test("stands when the fee can't be recorded, leaving that Job Unpaid until a retry takes it once", async () => {
    const { office, client, planId, jobId } = await crewedServicePlan();
    const move = async (date: string, cost: string) => {
      await client
        .post(`/api/jobs/mine/${jobId}/reschedule-request`)
        .send({ date, time: "09:00", cost })
        .expect(201);
      await office
        .post(`/api/jobs/${jobId}/reschedule-request/confirm`)
        .expect(200);
    };
    // two Late Reschedules: the second makes the Deposit amount due as a fee
    testClock().set(new Date("2026-01-18T15:00:00Z"));
    await move("2026-01-20", "free_late");
    testClock().set(new Date("2026-01-19T15:00:00Z"));
    await move("2026-01-22", "late_cancellation");
    const quote = await sentChange(office, planId, {
      startsAt: "2026-01-21T14:00:00.000Z",
    });
    const charged = testPayments().charges.length;

    await refusingInserts("charges", () => accept(client, quote));

    expect((await officePlan(office, planId)).quoteId).toBe(quote.id);
    const replaced = (await office.get(`/api/jobs/${jobId}`).expect(200))
      .body as {
      status: string;
      cancellation: { payment: { unpaid: unknown } };
    };
    expect(replaced.status).toBe("cancelled");
    expect(replaced.cancellation.payment.unpaid).not.toBeNull();

    await office.post(`/api/jobs/${jobId}/balance/retry`).expect(200);
    expect(
      testPayments()
        .charges.slice(charged)
        .map((c) => c.amount),
    ).toEqual([PLAN_DEPOSIT]);
  });
});

// #241, finding 11: a plan change takes no Deposit, but its Balances still
// need a card
describe("accepting a change to a plan without a saved card", () => {
  const withoutCard = async () => {
    const plan = await crewedServicePlan();
    const casey = (await findClientByEmail("casey@example.com"))!;
    await db
      .delete(paymentMethods)
      .where(eq(paymentMethods.clientId, casey.id));
    const quote = await sentChange(plan.office, plan.planId, {
      startsAt: WEDNESDAY_28TH,
    });
    return { ...plan, quote };
  };
  const savedCard = async (client: Agent) =>
    (await client.get("/api/payment-methods/mine").expect(200)).body as {
      label: string;
    } | null;

  test("saves the card the Client enters, taking nothing", async () => {
    const { client, planId, office, quote } = await withoutCard();
    const charged = testPayments().charges.length;

    await client
      .post(`/api/quotes/mine/${quote.id}/accept`)
      .send({
        revisionId: quote.offer!.id,
        serviceKey: SEEDED.standard,
        paymentToken: testPayments().paymentToken("mastercard"),
      })
      .expect(200);

    expect(await savedCard(client)).toMatchObject({
      label: "Test card ending 4444",
    });
    expect(testPayments().charges).toHaveLength(charged);
    expect((await officePlan(office, planId)).quoteId).toBe(quote.id);
  });

  test("saves it once the Client's bank approves it, and changes the plan", async () => {
    const { client, planId, office, quote } = await withoutCard();
    testPayments().requireApproval("approved");

    const outcome = (
      await client
        .post(`/api/quotes/mine/${quote.id}/accept`)
        .send({
          revisionId: quote.offer!.id,
          serviceKey: SEEDED.standard,
          paymentToken: testPayments().paymentToken(),
        })
        .expect(200)
    ).body as AcceptOutcome;
    expect(outcome.status).toBe("needs_approval");
    await client
      .post(`/api/quotes/mine/${quote.id}/accept/finalize`)
      .expect(200);

    expect(await savedCard(client)).toMatchObject({
      label: "Test card ending 4242",
    });
    const plan = await officePlan(office, planId);
    expect(plan.quoteId).toBe(quote.id);
    expect(startsOf(plan)).toContain(WEDNESDAY_28TH);
  });

  test("needs a card from the Client", async () => {
    const { client, quote } = await withoutCard();

    expect(
      (
        await client
          .post(`/api/quotes/mine/${quote.id}/accept`)
          .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.standard })
          .expect(409)
      ).body.message,
    ).toBe("Add a card to accept this quote.");
  });

  test("can't be recorded by the Office", async () => {
    const { office, quote } = await withoutCard();

    expect(
      (
        await office
          .post(`/api/quotes/${quote.id}/accept`)
          .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.standard })
          .expect(409)
      ).body.message,
    ).toBe(
      "Casey Client hasn't added a card yet. Email them a link to add one.",
    );
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
        serviceKey: SEEDED.standard,
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
          serviceKey: SEEDED.standard,
          recurrence: "fortnightly",
          discountPercent: draft.draft!.plan!.discountPercent,
          condition: draft.draft!.plan!.condition,
          days: [
            {
              start: { date: "2026-01-28", time: "09:00" },
              crewSize: 1,
              override: null,
            },
          ],
        },
      })
      .expect(200);
    const sent = (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
      .body as OfficeQuote;

    await accept(client, sent);

    expect((await officePlan(office, planId)).quoteId).toBe(draft.id);
    // answered: it no longer waits for the Office
    expect((await office.get("/api/quotes").expect(200)).body).toEqual([]);
  });
});
