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
import { eq } from "drizzle-orm";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import { recordNoAccess } from "#features/cancellation";
import { bookJob } from "#features/jobs";
import { createStaff, setUsualWeek, staff } from "#features/staff";
import {
  type Agent,
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
import { findService, SEEDED } from "#features/services";

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
  crewSize: 1,
  override: null,
  ...changes,
});

// a Standard Clean on Mondays, and on Wednesday afternoons for a crew of 2
const MONDAY_AND_WEDNESDAY = [day(MONDAY), day(WEDNESDAY, { crewSize: 2 })];

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
    serviceKey: draft.draft!.serviceKey,
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

const accept = (client: Agent, quote: Pick<OfficeQuote, "id" | "offer">) =>
  client
    .post(`/api/quotes/mine/${quote.id}/accept`)
    .send({ revisionId: quote.offer!.id });

const officePlan = async (office: Agent, id: string) =>
  (await office.get(`/api/service-plans/${id}`).expect(200))
    .body as OfficeServicePlan;

const startedPlan = async (days = MONDAY_AND_WEDNESDAY) => {
  const first = await firstCleanDone();
  const quote = await sentPlan(first.office, first.propertyId, days);
  const client = await signIn(casey.email);
  const outcome = (await accept(client, quote).expect(200))
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
  test("a Draft's weekdays each have their room, in the order typed, once timed", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await draftPlan(office, propertyId);
    // Wednesday typed before Monday, and a third weekday not timed yet
    const saved = (
      await save(office, draft, [
        day(WEDNESDAY, { crewSize: 2 }),
        day(MONDAY),
        day(null),
      ]).expect(200)
    ).body as OfficeQuote;
    expect(saved.draft!.options.map((o) => o.room)).toMatchObject([
      { date: WEDNESDAY.date, crewSize: 2, hasRoom: true },
      { date: MONDAY.date, crewSize: 1, hasRoom: true },
      null,
    ]);
  });

  test("gives each weekday its own time and visit, priced as each would be, with the round's total and a Deposit for one clean on each", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await draftPlan(office, propertyId);

    const saved = (await save(office, draft, MONDAY_AND_WEDNESDAY).expect(200))
      .body as OfficeQuote;

    const [monday, wednesday] = saved.draft!.options;
    expect(saved.draft!.plan!.days).toMatchObject([
      { startsAt: MONDAYS[0], serviceKey: SEEDED.standard, crewSize: 1 },
      { startsAt: WEDNESDAYS[0], serviceKey: SEEDED.standard, crewSize: 2 },
    ]);
    expect(monday).toMatchObject({
      serviceKey: SEEDED.standard,
      hoursOnSite: 3.75,
    });
    expect(wednesday!.serviceKey).toBe(SEEDED.standard);
    // on site for half as long, to the hundredth
    expect(wednesday!.hoursOnSite).toBe(1.88);
    // a bigger crew takes less time, for the same price
    expect(wednesday!.totalCents).toBe(monday!.totalCents);
    expect(saved.draft!.plan).toMatchObject({
      recurrence: "weekly",
      roundTotalCents: monday!.totalCents + wednesday!.totalCents,
      // each weekday's own 25%, added up
      depositCents:
        percent(monday!.totalCents, 25) + percent(wednesday!.totalCents, 25),
    });
    // the plan's first clean is the earliest
    expect(saved.draft!.proposedStartsAt).toBe(MONDAYS[0]);
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
        issue: expect.stringMatching(/already has a clean on that day/),
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

    expect(view.options.map((o) => o.serviceKey)).toEqual([
      SEEDED.standard,
      SEEDED.standard,
    ]);
    expect(view.plan!.days.map((d) => d.startsAt)).toEqual([
      MONDAYS[0],
      WEDNESDAYS[0],
    ]);
    expect(view.plan!.roundTotalCents).toBe(
      view.options[0]!.totalCents + view.options[1]!.totalCents,
    );
    expect(view.bookable).toEqual([SEEDED.standard]);

    const sent = testEmail()
      .to(casey.email)
      .find((m) => /cleaning plan quote/.test(m.subject))!;
    expect(sent.text).toContain(
      "a Standard Clean every week, on Mondays at 9:00 AM and Wednesdays at 1:00 PM",
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
      { startsAt: MONDAYS[0], serviceName: "Standard Clean", crewSize: 1 },
      { startsAt: WEDNESDAYS[0], serviceName: "Standard Clean", crewSize: 2 },
    ]);
    expect(plan.roundTotalCents).toBe(quote.offer!.plan!.roundTotalCents);
    const jobs = booked(plan);
    expect(jobs.map((j) => j.startsAt)).toEqual(
      [...MONDAYS, ...WEDNESDAYS].sort(),
    );
    expect(jobs.map((j) => [j.serviceName, j.crewSize]).slice(0, 2)).toEqual([
      ["Standard Clean", 1],
      ["Standard Clean", 2],
    ]);

    testClock().advance({ days: 3 });
    expect(await generateServicePlanJobs()).toBe(1);
    expect(booked(await officePlan(office, planId)).at(-1)!.startsAt).toBe(
      "2026-02-11T18:00:00.000Z",
    );

    const confirmation = testEmail()
      .sent.filter((m) => m.to === casey.email)
      .find((m) => /has started/.test(m.subject))!;
    expect(confirmation.text).toContain(
      "a Standard Clean at 41-12 Austin St, 4B, 11375 every week, on Mondays at 9:00 AM and Wednesdays at 1:00 PM",
    );
  });

  test("is refused unless the first clean on each weekday has room", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    // both Cleaners' day on the first Wednesday
    await bookJob({
      propertyId,
      serviceId: (await findService(SEEDED.deep)).id,
      startsAt: new Date(WEDNESDAYS[0]!),
      labourHours: 16,
      crewSize: 2,
    });
    const client = await signIn(casey.email);

    const view = (await client.get(`/api/quotes/mine/${quote.id}`).expect(200))
      .body as QuoteView;
    expect(view.bookable).toEqual([]);
    const refused = await accept(client, quote).expect(409);
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
    // its price had the Plan Discount taken off, which its page says
    expect(job.planDiscountPercent).toBe(plan.discountPercent);
    expect(fee).toBeLessThan(plan.depositCents);

    await client
      .post(`/api/jobs/mine/${wednesday.id}/cancel`)
      .send({ feeCents: fee })
      .expect(200);
    expect(testPayments().charges.at(-1)!.amount).toBe(fee);
  });
});

// #241, finding 9: Ending a plan doesn't change what its Jobs still going
// ahead owe as a fee
describe("a plan Job going ahead after its plan Ended", () => {
  // Ended on Tuesday the 20th at 2pm: Monday's clean has started, and
  // Wednesday's is within 24 hours, so both go ahead; Wednesday's is the
  // final Job, and holds the plan's Deposit. Cory is Confirmed on Monday's
  const ended = async () => {
    const started = await startedPlan();
    const plan = await officePlan(started.office, started.planId);
    const monday = booked(plan).find((j) => j.startsAt === MONDAYS[0])!;
    const wednesday = booked(plan).find((j) => j.startsAt === WEDNESDAYS[0])!;
    const [cory] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.email, "cory@example.com"));
    const offered = await offerAssignment(monday.id, cory!.id, started.me.id);
    await confirmAssignment(cory!.id, offered.assignments[0]!.id);
    testClock().set(new Date("2026-01-20T19:00:00Z"));
    await started.client
      .post(`/api/service-plans/mine/${started.planId}/end`)
      .send({ goingAhead: [MONDAYS[0], WEDNESDAYS[0]] })
      .expect(200);
    return {
      ...started,
      coryId: cory!.id,
      monday,
      wednesday,
      shares: plan.days.map((d) => percent(d.totalCents, 25)),
      depositCents: plan.depositCents,
    };
  };

  test("No Access on one that isn't final charges its own share of the Deposit", async () => {
    const { office, coryId, monday, shares } = await ended();
    const charged = testPayments().charges.length;

    await recordNoAccess(coryId, monday.id, "Nobody home");

    expect(
      testPayments()
        .charges.slice(charged)
        .map((c) => c.amount),
    ).toEqual([shares[0]]);
    expect(
      (await office.get(`/api/jobs/${monday.id}`).expect(200)).body.noAccess
        .feeCents,
    ).toBe(shares[0]);
  });

  test("a Late Cancellation of the final one keeps only its own share, and refunds the rest", async () => {
    const { client, wednesday, shares, depositCents } = await ended();

    const job = (await client.get(`/api/jobs/mine/${wednesday.id}`).expect(200))
      .body as ClientJobDetail;
    expect(job.cancelTerms).toMatchObject({
      late: true,
      feeCents: shares[1],
      refundCents: depositCents - shares[1]!,
    });
    await client
      .post(`/api/jobs/mine/${wednesday.id}/cancel`)
      .send({ feeCents: shares[1] })
      .expect(200);

    expect(testPayments().refunds.map((r) => r.amount)).toEqual([
      depositCents - shares[1]!,
    ]);
  });

  test("a second Late Reschedule of the final one costs its own share", async () => {
    const { office, client, wednesday, shares } = await ended();
    // late, but the first: free, to Thursday
    await client
      .post(`/api/jobs/mine/${wednesday.id}/reschedule-request`)
      .send({ date: "2026-01-22", time: "13:00", cost: "free_late" })
      .expect(201);
    await office
      .post(`/api/jobs/${wednesday.id}/reschedule-request/confirm`)
      .expect(200);

    testClock().set(new Date("2026-01-21T20:00:00Z"));
    const job = (await client.get(`/api/jobs/mine/${wednesday.id}`).expect(200))
      .body as ClientJobDetail;
    expect(job.rescheduleTerms).toMatchObject({
      cost: "late_cancellation",
      feeCents: shares[1],
    });
  });
});

describe("changing a plan's terms", () => {
  test("can drop and add weekdays from the new Quote's first clean on", async () => {
    const { office, client, propertyId, planId } = await startedPlan();

    // from Friday the 30th: Fridays only
    const change = await sentPlan(office, propertyId, [
      day({ date: "2026-01-30", time: "10:00" }),
    ]);
    await accept(client, change).expect(200);

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
    ).toEqual([MONDAYS[2]!, WEDNESDAYS[2]!, MONDAYS[3]!].sort());

    // and back to two weekdays, from Monday 2 February
    const again = await sentPlan(office, propertyId, [
      day({ date: "2026-02-02", time: "09:00" }),
      day({ date: "2026-02-06", time: "10:00" }),
    ]);
    await accept(client, again).expect(200);
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
      serviceKey: SEEDED.commercial,
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
    expect(unseen.body.message).toMatch(/site visit/);

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
        .send({
          revisionId: sent.offer!.id,
          paymentToken: testPayments().paymentToken(),
        })
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
