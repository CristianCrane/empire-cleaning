import { describe, expect, test } from "vitest";
import type {
  AcceptOutcome,
  ClientJobDetail,
  LocalDateTime,
  OfficeQuote,
  OfficeServicePlan,
  PlanDayInput,
  QuoteDraftInput,
  QuoteView,
  SignedInAccount,
} from "@empire-cleaning/models";
import { bookJob } from "#features/jobs";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  api,
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import {
  casey,
  completedFirstClean,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { generateServicePlanJobs } from "./service-plans.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// The First Clean is done at 11am on Monday 12 January 2026, New York time,
// and the clock is left there, so plan Jobs are generated up to Monday 9
// February. Cory and Bea work 8 hours each weekday.
const MONDAY = { date: "2026-01-19", time: "09:00" };
const WEDNESDAY = { date: "2026-01-21", time: "13:00" };
const MONDAYS = [
  "2026-01-19T14:00:00.000Z",
  "2026-01-26T14:00:00.000Z",
  "2026-02-02T14:00:00.000Z",
  "2026-02-09T14:00:00.000Z",
];
const WEDNESDAYS = [
  "2026-01-21T18:00:00.000Z",
  "2026-01-28T18:00:00.000Z",
  "2026-02-04T18:00:00.000Z",
];

const firstCleanDone = async () => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const done = await completedFirstClean({ byAccountId: me.id });
  return { office, me, ...done };
};

const day = (
  start: LocalDateTime | null,
  changes: Partial<PlanDayInput> = {},
): PlanDayInput => ({
  start,
  cleanType: "standard",
  crewSize: 1,
  override: null,
  ...changes,
});

// a Standard Clean on Mondays, and a Deep Clean for a crew of 2 on
// Wednesdays afternoons
const MONDAY_AND_WEDNESDAY = [
  day(MONDAY),
  day(WEDNESDAY, { cleanType: "deep", crewSize: 2 }),
];

const draftPlan = async (office: Agent, propertyId: string) =>
  (
    await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(201)
  ).body as OfficeQuote;

const body = (
  draft: OfficeQuote,
  days: PlanDayInput[],
  recurrence: "weekly" | "fortnightly" = "weekly",
): QuoteDraftInput => ({
  addOns: [],
  depositPercent: draft.draft!.depositPercent,
  validityDays: draft.draft!.validityDays,
  plan: {
    recurrence,
    discountPercent: draft.draft!.plan!.discountPercent,
    condition: "moderate",
    days,
  },
});

const save = (
  office: Agent,
  draft: OfficeQuote,
  days: PlanDayInput[],
  recurrence?: "weekly" | "fortnightly",
) =>
  office
    .patch(`/api/quotes/${draft.id}/draft`)
    .send(body(draft, days, recurrence));

const sentPlan = async (
  office: Agent,
  propertyId: string,
  days = MONDAY_AND_WEDNESDAY,
) => {
  const draft = await draftPlan(office, propertyId);
  await save(office, draft, days).expect(200);
  return (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
    .body as OfficeQuote;
};

const accept = (client: Agent, quoteId: string) =>
  client.post(`/api/quotes/mine/${quoteId}/accept`).send({});

const officePlan = async (office: Agent, id: string) =>
  (await office.get(`/api/service-plans/${id}`).expect(200))
    .body as OfficeServicePlan;

const startedPlan = async (days = MONDAY_AND_WEDNESDAY) => {
  const first = await firstCleanDone();
  const quote = await sentPlan(first.office, first.propertyId, days);
  const client = await signIn(casey.email);
  const outcome = (await accept(client, quote.id).expect(200))
    .body as AcceptOutcome;
  if (outcome.status !== "accepted") throw new Error("not accepted");
  return { ...first, client, quote, planId: outcome.quote.servicePlanId! };
};

const booked = (plan: OfficeServicePlan) =>
  plan.jobs.filter((j) => j.status === "booked");

// a percentage, to the cent, halves up
const percent = (cents: number, of: number) =>
  Math.floor((cents * of + 50) / 100);

describe("a Service Plan Quote on several weekdays", () => {
  test("gives each weekday its own time and visit, priced as each would be, with the round's total and a Deposit for one clean on each", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await draftPlan(office, propertyId);

    const saved = (await save(office, draft, MONDAY_AND_WEDNESDAY).expect(200))
      .body as OfficeQuote;

    const [monday, wednesday] = saved.draft!.options;
    expect(saved.draft!.plan!.days).toMatchObject([
      { startsAt: MONDAYS[0], cleanType: "standard", crewSize: 1 },
      { startsAt: WEDNESDAYS[0], cleanType: "deep", crewSize: 2 },
    ]);
    expect(monday).toMatchObject({ cleanType: "standard", hoursOnSite: 3.75 });
    expect(wednesday!.cleanType).toBe("deep");
    expect(wednesday!.hoursOnSite).toBe(wednesday!.labourHours / 2);
    expect(wednesday!.totalCents).toBeGreaterThan(monday!.totalCents);
    expect(saved.draft!.plan).toMatchObject({
      recurrence: "weekly",
      roundTotalCents: monday!.totalCents + wednesday!.totalCents,
      // each weekday's own 25%, added up
      depositCents:
        percent(monday!.totalCents, 25) + percent(wednesday!.totalCents, 25),
    });
    // the plan's first clean is the earliest
    expect(saved.draft!.proposedStartsAt).toBe(MONDAYS[0]);
    // and each weekday has both Clean Types priced to choose between
    expect(
      saved.draft!.planChoices!.map((d) => d.map((c) => c.option.cleanType)),
    ).toEqual([
      ["standard", "deep"],
      ["standard", "deep"],
    ]);
  });

  test("each weekday's price can be overridden on its own", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await draftPlan(office, propertyId);

    const saved = (
      await save(office, draft, [
        day(MONDAY),
        day(WEDNESDAY, {
          override: { priceCents: 30000, reason: "Busy Wednesdays" },
        }),
      ]).expect(200)
    ).body as OfficeQuote;

    expect(saved.draft!.options.map((o) => o.overrideCents)).toEqual([
      null,
      30000,
    ]);
    // 10% off $300
    expect(saved.draft!.options[1]!.priceCents).toBe(27000);
  });

  test("on several weekdays comes round every week", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await draftPlan(office, propertyId);

    const refused = await save(
      office,
      draft,
      MONDAY_AND_WEDNESDAY,
      "fortnightly",
    ).expect(400);
    expect(refused.body.details).toContainEqual(
      expect.objectContaining({ path: "plan.recurrence" }),
    );
  });

  test("has each weekday once, all within a week of the first clean", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await draftPlan(office, propertyId);

    const twice = await save(office, draft, [
      day(MONDAY),
      day({ date: "2026-01-26", time: "13:00" }),
    ]).expect(400);
    expect(twice.body.details).toContainEqual(
      expect.objectContaining({
        path: "plan.days.1.start",
        issue: expect.stringMatching(/on that weekday/),
      }),
    );

    const apart = await save(office, draft, [
      day(MONDAY),
      day({ date: "2026-01-27", time: "09:00" }),
    ]).expect(400);
    expect(apart.body.details).toContainEqual(
      expect.objectContaining({ path: "plan.days.1.start" }),
    );
  });

  test("can't be Sent until every weekday has a time, and each clean ends by midnight", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await draftPlan(office, propertyId);

    await save(office, draft, [day(MONDAY), day(null)]).expect(200);
    const untimed = await office
      .post(`/api/quotes/${draft.id}/send`)
      .expect(400);
    expect(untimed.body.details).toContainEqual(
      expect.objectContaining({ path: "plan.days.1.start" }),
    );

    // 3.75 hours from 9pm is past midnight
    await save(office, draft, [
      day(MONDAY),
      day({ date: "2026-01-21", time: "21:00" }),
    ]).expect(200);
    const late = await office.post(`/api/quotes/${draft.id}/send`).expect(400);
    expect(late.body.details).toContainEqual(
      expect.objectContaining({
        path: "plan.days.1.start",
        issue: expect.stringMatching(/midnight/),
      }),
    );
  });

  test("is Sent with its weekdays earliest first, and the Client sees each, the round's total and the Deposit", async () => {
    const { office, propertyId } = await firstCleanDone();
    // entered Wednesday first
    const quote = await sentPlan(office, propertyId, [
      MONDAY_AND_WEDNESDAY[1]!,
      MONDAY_AND_WEDNESDAY[0]!,
    ]);
    const client = await signIn(casey.email);

    const view = (await client.get(`/api/quotes/mine/${quote.id}`).expect(200))
      .body as QuoteView;

    expect(view.options.map((o) => o.cleanType)).toEqual(["standard", "deep"]);
    expect(view.plan!.days.map((d) => d.startsAt)).toEqual([
      MONDAYS[0],
      WEDNESDAYS[0],
    ]);
    expect(view.plan!.roundTotalCents).toBe(
      view.options[0]!.totalCents + view.options[1]!.totalCents,
    );
    expect(view.bookable).toEqual(["deep", "standard"]);

    const sent = testEmail()
      .to(casey.email)
      .find((m) => /Service Plan Quote/.test(m.subject))!;
    expect(sent.text).toContain(
      "every week: a Standard Clean on Mondays at 9:00 AM and a Deep Clean on Wednesdays at 1:00 PM",
    );
    expect(sent.text).toContain(`Wednesday: $`);
  });
});

describe("accepting a Service Plan Quote on several weekdays", () => {
  test("books the first clean on each, takes one Deposit for them all, and generates Jobs on each weekday every week", async () => {
    const { office, quote, planId } = await startedPlan();

    expect(testPayments().charges.at(-1)!.amount).toBe(
      quote.offer!.plan!.depositCents,
    );
    const plan = await officePlan(office, planId);
    expect(plan.depositCents).toBe(quote.offer!.plan!.depositCents);
    expect(plan.days).toMatchObject([
      { startsAt: MONDAYS[0], cleanType: "standard", crewSize: 1 },
      { startsAt: WEDNESDAYS[0], cleanType: "deep", crewSize: 2 },
    ]);
    expect(plan.roundTotalCents).toBe(quote.offer!.plan!.roundTotalCents);
    const jobs = booked(plan);
    expect(jobs.map((j) => j.startsAt)).toEqual(
      [...MONDAYS, ...WEDNESDAYS].sort(),
    );
    expect(jobs.map((j) => [j.cleanType, j.crewSize]).slice(0, 2)).toEqual([
      ["standard", 1],
      ["deep", 2],
    ]);

    testClock().advance({ days: 3 });
    expect(await generateServicePlanJobs()).toBe(1);
    expect(booked(await officePlan(office, planId)).at(-1)!.startsAt).toBe(
      "2026-02-11T18:00:00.000Z",
    );

    const confirmation = testEmail()
      .sent.filter((m) => m.to === casey.email)
      .find((m) => /has started/.test(m.subject))!;
    expect(confirmation.text).toContain("on Mondays at 9:00 AM");
    expect(confirmation.text).toContain("on Wednesdays at 1:00 PM");
  });

  test("is refused unless the first clean on each weekday has room", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    // both Cleaners' day on the first Wednesday
    await bookJob({
      propertyId,
      cleanType: "deep",
      startsAt: new Date(WEDNESDAYS[0]!),
      labourHours: 16,
      crewSize: 2,
    });
    const client = await signIn(casey.email);

    const view = (await client.get(`/api/quotes/mine/${quote.id}`).expect(200))
      .body as QuoteView;
    expect(view.bookable).toEqual([]);
    const refused = await accept(client, quote.id).expect(409);
    expect(refused.body.message).toMatch(/booked up/);
    expect(
      (
        (await office.get(`/api/quotes/${quote.id}`).expect(200))
          .body as OfficeQuote
      ).status,
    ).toBe("sent");
  });
});

describe("a plan Job's fee", () => {
  test("is the Deposit percentage of that Job's own price", async () => {
    const { client, office, planId } = await startedPlan();
    const plan = await officePlan(office, planId);
    const wednesday = booked(plan).find((j) => j.startsAt === WEDNESDAYS[0])!;
    // within 24 hours of it
    testClock().set(new Date("2026-01-20T20:00:00Z"));

    const job = (await client.get(`/api/jobs/mine/${wednesday.id}`).expect(200))
      .body as ClientJobDetail;
    const fee = percent(plan.days[1]!.totalCents, 25);
    expect(job.cancelTerms).toMatchObject({ late: true, feeCents: fee });
    expect(fee).toBeLessThan(plan.depositCents);

    await client
      .post(`/api/jobs/mine/${wednesday.id}/cancel`)
      .send({ feeCents: fee })
      .expect(200);
    expect(testPayments().charges.at(-1)!.amount).toBe(fee);
  });
});

describe("changing a plan's terms", () => {
  test("can drop and add weekdays from the new Quote's first clean on", async () => {
    const { office, client, propertyId, planId } = await startedPlan();

    // from Friday the 30th: Fridays only
    const change = await sentPlan(office, propertyId, [
      day({ date: "2026-01-30", time: "10:00" }),
    ]);
    await accept(client, change.id).expect(200);

    const plan = await officePlan(office, planId);
    expect(plan.days.map((d) => d.startsAt)).toEqual([
      "2026-01-30T15:00:00.000Z",
    ]);
    expect(booked(plan).map((j) => j.startsAt)).toEqual([
      MONDAYS[0],
      WEDNESDAYS[0],
      MONDAYS[1],
      WEDNESDAYS[1],
      "2026-01-30T15:00:00.000Z",
      "2026-02-06T15:00:00.000Z",
    ]);
    expect(
      plan.jobs.filter((j) => j.status === "cancelled").map((j) => j.startsAt),
    ).toEqual([MONDAYS[2], WEDNESDAYS[2], MONDAYS[3]].sort());

    // and back to two weekdays, from Monday 2 February
    const again = await sentPlan(office, propertyId, [
      day({ date: "2026-02-02", time: "09:00" }),
      day({ date: "2026-02-06", time: "10:00" }),
    ]);
    await accept(client, again.id).expect(200);
    expect(
      booked(await officePlan(office, planId))
        .slice(-3)
        .map((j) => j.startsAt),
    ).toEqual([
      "2026-02-02T14:00:00.000Z",
      "2026-02-06T15:00:00.000Z",
      "2026-02-09T14:00:00.000Z",
    ]);
  });
});

// The test clock starts at 4am on Monday 5 January 2026 in New York.
describe("a commercial Service Plan", () => {
  const premises = async () => {
    const office = await signInAsOffice();
    const cory = await createStaff({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
    });
    await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 8, 0]);
    const types = (
      await api().get("/api/price-list/premises-types").expect(200)
    ).body as { key: string; name: string }[];
    const premisesType = types.find((t) => t.name === "Office")!.key;
    const { body } = await submit({
      contact: casey,
      businessName: "Acme Dental",
      property: {
        new: {
          kind: "commercial",
          street: "200 Park Ave S",
          unit: "Floor 3",
          postcode: "10003",
          premisesType,
          floorArea: null,
        },
      },
      wantsRegularService: true,
      weekdays: [0, 2, 4],
      preferredTime: "18:00",
    }).expect(201);
    return { office, premisesType, quoteId: body.id as string };
  };

  const evenings = [
    day({ date: "2026-01-12", time: "18:00" }),
    day({ date: "2026-01-14", time: "18:00" }),
    day({ date: "2026-01-16", time: "18:00" }),
  ];

  test("needs no First Clean, only the Site Visit's findings, to be Sent and accepted", async () => {
    const { office, premisesType, quoteId } = await premises();

    // the business asked for regular cleaning: its Quote is made a Service
    // Plan Quote, whose Draft can be written at any time
    const draft = (
      await office
        .post(`/api/quotes/${quoteId}/revisions`)
        .send({ kind: "service_plan" })
        .expect(201)
    ).body as OfficeQuote;
    const propertyId = draft.property.id;
    await save(office, draft, evenings).expect(200);
    const unseen = await office
      .post(`/api/quotes/${draft.id}/send`)
      .expect(409);
    expect(unseen.body.message).toMatch(/Site Visit/);

    await office
      .post(`/api/properties/${propertyId}/findings`)
      .send({ premisesType, floorArea: 3000, condition: "moderate" })
      .expect(201);
    // priced again for the premises as found
    await save(office, draft, evenings).expect(200);
    const sent = (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
      .body as OfficeQuote;
    expect(sent.offer!.plan!.days).toHaveLength(3);
    expect(sent.firstClean).toBeNull();

    // Casey saves a card on accepting
    const client = await signIn(casey.email);
    const outcome = (
      await client
        .post(`/api/quotes/mine/${sent.id}/accept`)
        .send({ paymentToken: testPayments().paymentToken() })
        .expect(200)
    ).body as AcceptOutcome;
    expect(outcome).toMatchObject({ status: "accepted" });
    if (outcome.status !== "accepted") return;
    const plan = await officePlan(office, outcome.quote.servicePlanId!);
    expect(
      booked(plan)
        .slice(0, 3)
        .map((j) => j.startsAt),
    ).toEqual([
      "2026-01-12T23:00:00.000Z",
      "2026-01-14T23:00:00.000Z",
      "2026-01-16T23:00:00.000Z",
    ]);
  });
});
