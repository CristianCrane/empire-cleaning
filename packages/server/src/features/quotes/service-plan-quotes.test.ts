import { describe, expect, test } from "vitest";
import type {
  NeedsAttentionItem,
  OfficeClientView,
  OfficeJob,
  OfficeQuote,
  PriceList,
  QuoteDraftInput,
  QuoteRequestDetail,
  QuoteSummary,
  QuoteView,
  SignedInAccount,
} from "@empire-cleaning/models";
import { signIn, testClock, testEmail } from "../../../tests/harness.ts";
import {
  casey,
  completedFirstClean,
  guestRequest,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// The First Clean is done at 11am on Monday 12 January 2026, New York time,
// and the clock is left there. Plans here start at 9am on Monday the 19th.
const plansStart = { date: "2026-01-19", time: "09:00" };

// Casey's home (2 bedrooms, 1.5 bathrooms, pets) as a Standard Clean at
// moderate Condition on the placeholder Price List: 3.625 hours, rounded up
// to 3.75, at $55 an hour is $206, plus 8.875% tax.
const STANDARD_MODERATE = 20600;
// at heavy Condition (x1.4): 5.075 hours, so 5.25, is $289
const STANDARD_HEAVY = 28900;

const firstCleanDone = async (
  options: Omit<Parameters<typeof completedFirstClean>[0], "byAccountId"> = {},
) => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const done = await completedFirstClean({ byAccountId: me.id, ...options });
  return { office, ...done };
};

// a Service Plan Draft offered for the home unprompted
const startPlan = async (office: Agent, propertyId: string) =>
  (
    await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(201)
  ).body as OfficeQuote;

// what a Service Plan Draft is now, as a PATCH body, with changes
const edit = (
  quote: OfficeQuote,
  changes: Partial<QuoteDraftInput> = {},
): QuoteDraftInput => ({
  addOns: quote.addOns.map((a) => a.key),
  crewSize: quote.crewSize,
  depositPercent: quote.depositPercent,
  validityDays: quote.validityDays,
  proposedStart: quote.proposedStart,
  overrides: { deep: null, standard: null },
  plan: quote.plan && {
    recurrence: quote.plan.recurrence,
    cleanType: quote.plan.cleanType,
    discountPercent: quote.plan.discountPercent,
    condition: quote.plan.condition,
  },
  ...changes,
});

const save = async (
  office: Agent,
  quote: OfficeQuote,
  changes: Partial<QuoteDraftInput>,
) =>
  (
    await office
      .patch(`/api/quotes/${quote.id}`)
      .send(edit(quote, changes))
      .expect(200)
  ).body as OfficeQuote;

const send = async (
  office: Agent,
  draft: OfficeQuote,
  changes: Partial<QuoteDraftInput> = {},
) => {
  await save(office, draft, { proposedStart: plansStart, ...changes });
  return (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
    .body as OfficeQuote;
};

const sentPlan = async (
  office: Agent,
  propertyId: string,
  changes: Partial<QuoteDraftInput> = {},
) => send(office, await startPlan(office, propertyId), changes);

const requestDetail = async (office: Agent, id: string) =>
  (await office.get(`/api/quote-requests/${id}`).expect(200))
    .body as QuoteRequestDetail;

// Casey asks again about the same home, as a signed-in Client would
const askAgain = async () => {
  const { body } = await submit(guestRequest()).expect(201);
  return body.id as string;
};

const officeQuote = async (office: Agent, id: string) =>
  (await office.get(`/api/quotes/${id}`).expect(200)).body as OfficeQuote;

const needsAttention = async (office: Agent) =>
  (await office.get("/api/dashboard/needs-attention").expect(200))
    .body as NeedsAttentionItem[];

const plansDue = async (office: Agent) =>
  (await needsAttention(office)).filter((i) => i.kind === "service_plan_due");

// the tax on a price before tax, to the cent, halves up
const tax = (cents: number, percent: number) =>
  Math.floor((cents * percent * 1000 + 50_000) / 100_000);

describe("starting a Service Plan Quote", () => {
  test("is refused until the home's First Clean is Completed", async () => {
    const office = await signInAsOffice();
    const { body } = await submit(guestRequest()).expect(201);
    const { property } = await requestDetail(office, body.id);

    const fromRequest = await office
      .post("/api/quotes")
      .send({ quoteRequestId: body.id, kind: "service_plan" })
      .expect(409);
    expect(fromRequest.body.message).toMatch(/First Clean is Completed/);
    const fromHome = await office
      .post("/api/quotes")
      .send({ propertyId: property.id, kind: "service_plan" })
      .expect(409);
    expect(fromHome.body.message).toMatch(/First Clean is Completed/);
    expect((await requestDetail(office, body.id)).firstCleanCompleted).toBe(
      false,
    );
  });

  test("a one-off Quote always answers a Quote Request", async () => {
    const { office, propertyId } = await firstCleanDone();

    await office
      .post("/api/quotes")
      .send({ propertyId, kind: "one_off" })
      .expect(400);
    await office.post("/api/quotes").send({ propertyId }).expect(400);
  });

  test("sending is refused once the First Clean's completion is undone", async () => {
    const { office, propertyId, job } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);
    await save(office, draft, { proposedStart: plansStart });

    // the completion was a mistake: the First Clean is booked again
    await office.delete(`/api/jobs/${job.id}/completion`).expect(200);

    const refused = await office
      .post(`/api/quotes/${draft.id}/send`)
      .expect(409);
    expect(refused.body.message).toMatch(/First Clean is Completed/);
  });

  test("can be offered for the home, unprompted, once its First Clean is Completed", async () => {
    const { office, propertyId, quoteRequestId } = await firstCleanDone();

    const draft = await startPlan(office, propertyId);
    expect(draft).toMatchObject({
      kind: "service_plan",
      status: "draft",
      quoteRequestId: null,
      property: { id: propertyId },
    });

    // asking again gives the same Draft
    const again = await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(200);
    expect(again.body.id).toBe(draft.id);
    // and it isn't filed under the First Clean's request
    expect(
      (await requestDetail(office, quoteRequestId)).quotes.map((q) => q.kind),
    ).toEqual(["one_off"]);
  });

  test("the First Clean's request is booked, so takes no more Quotes of either kind", async () => {
    const { office, quoteRequestId } = await firstCleanDone();

    expect(await requestDetail(office, quoteRequestId)).toMatchObject({
      state: "booked",
      firstCleanCompleted: true,
    });
    for (const kind of ["one_off", "service_plan"]) {
      const refused = await office
        .post("/api/quotes")
        .send({ quoteRequestId, kind })
        .expect(409);
      expect(refused.body.message).toMatch(/booked/);
    }
  });

  test("can answer a Quote Request asking for regular cleaning", async () => {
    const { office, propertyId } = await firstCleanDone();
    const asked = await askAgain();

    const draft = (
      await office
        .post("/api/quotes")
        .send({ quoteRequestId: asked, kind: "service_plan" })
        .expect(201)
    ).body as OfficeQuote;
    expect(draft).toMatchObject({
      kind: "service_plan",
      quoteRequestId: asked,
    });

    // the request has its Draft, and the home its Service Plan Draft
    await office
      .post("/api/quotes")
      .send({ quoteRequestId: asked })
      .expect(409);
    await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(409);
  });

  test("defaults to a Standard Clean at moderate Condition every 2 weeks, with the Price List's Plan Discount and no Add-ons, beside the First Clean's findings", async () => {
    // the Cleaner found the home heavy: the plan still assumes moderate
    const { office, propertyId, job } = await firstCleanDone({
      condition: "heavy",
    });

    const draft = await startPlan(office, propertyId);

    expect(draft.addOns).toEqual([]);
    expect(draft.options.map((o) => o.cleanType)).toEqual(["standard"]);
    const [option] = draft.options;
    expect(option!.suggested).toMatchObject({
      cleanType: "standard",
      conditionMultiplier: 1,
      labourHours: 3.75,
      priceCents: STANDARD_MODERATE,
    });
    // 10% off $206 is $20.60
    const perJob = STANDARD_MODERATE - 2060;
    expect(option).toMatchObject({
      overrideCents: null,
      priceCents: perJob,
      taxCents: tax(perJob, 8.875),
      totalCents: perJob + tax(perJob, 8.875),
      labourHours: 3.75,
    });
    const oneOffTotal = STANDARD_MODERATE + tax(STANDARD_MODERATE, 8.875);
    expect(draft.plan).toEqual({
      recurrence: "fortnightly",
      cleanType: "standard",
      discountPercent: 10,
      condition: "moderate",
      oneOffPriceCents: STANDARD_MODERATE,
      oneOffTaxCents: tax(STANDARD_MODERATE, 8.875),
      oneOffTotalCents: oneOffTotal,
      discountCents: 2060,
      savingCents: oneOffTotal - option!.totalCents,
    });
    expect(draft.firstClean).toEqual({
      job: {
        id: job.id,
        startsAt: job.startsAt.toISOString(),
        cleanType: "deep",
      },
      completedAt: "2026-01-12T16:00:00.000Z",
      condition: "heavy",
      adjustments: [],
    });
  });
});

describe("drafting a Service Plan Quote", () => {
  test("the Condition can be changed from moderate", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);

    const saved = await save(office, draft, {
      plan: {
        recurrence: "weekly",
        cleanType: "standard",
        discountPercent: 10,
        condition: "heavy",
      },
    });

    expect(saved.plan).toMatchObject({
      recurrence: "weekly",
      condition: "heavy",
      oneOffPriceCents: STANDARD_HEAVY,
      discountCents: 2890,
    });
    expect(saved.options[0]!.priceCents).toBe(STANDARD_HEAVY - 2890);
  });

  test("can be a plan of Deep Cleans, with only the Deep Clean's price to override", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);
    const deepPlan = { ...edit(draft).plan!, cleanType: "deep" as const };

    const saved = await save(office, draft, { plan: deepPlan });

    expect(saved.options.map((o) => o.cleanType)).toEqual(["deep"]);
    const [option] = saved.options;
    expect(option).toMatchObject({ recommended: false });
    expect(option!.suggested.cleanType).toBe("deep");
    const oneOff = option!.suggested.priceCents;
    expect(oneOff).toBeGreaterThan(STANDARD_MODERATE);
    expect(saved.plan).toMatchObject({
      cleanType: "deep",
      oneOffPriceCents: oneOff,
      discountCents: Math.floor((oneOff * 10 + 50) / 100),
    });

    const standard = await office
      .patch(`/api/quotes/${draft.id}`)
      .send(
        edit(saved, {
          overrides: {
            deep: null,
            standard: { priceCents: 30000, reason: "x" },
          },
        }),
      )
      .expect(400);
    expect(standard.body.details).toContainEqual(
      expect.objectContaining({ path: "overrides.standard" }),
    );
    const overridden = await save(office, saved, {
      overrides: {
        deep: { priceCents: 40000, reason: "Big home" },
        standard: null,
      },
    });
    expect(overridden.options[0]).toMatchObject({
      overrideCents: 40000,
      priceCents: 36000,
    });
  });

  test("the Plan Discount is overridable, and comes off an overridden price", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);

    const saved = await save(office, draft, {
      overrides: {
        deep: null,
        standard: { priceCents: 25000, reason: "Big garden room" },
      },
      plan: {
        recurrence: "four_weekly",
        cleanType: "standard",
        discountPercent: 15,
        condition: "moderate",
      },
    });

    // 15% off $250 is $37.50
    const perJob = 25000 - 3750;
    expect(saved.options[0]).toMatchObject({
      overrideCents: 25000,
      overrideReason: "Big garden room",
      priceCents: perJob,
      totalCents: perJob + tax(perJob, 8.875),
    });
    expect(saved.options[0]!.suggested.priceCents).toBe(STANDARD_MODERATE);
    expect(saved.plan).toMatchObject({
      recurrence: "four_weekly",
      discountPercent: 15,
      oneOffPriceCents: 25000,
      oneOffTotalCents: 25000 + tax(25000, 8.875),
      discountCents: 3750,
    });
  });

  test("recurring Add-ons are in the one-off price and the Plan Discount comes off them too", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);
    const oven = draft.addOnChoices.find((a) => a.name === "Inside the oven")!;

    const saved = await save(office, draft, { addOns: [oven.key] });

    // half an hour more: 4.25 hours is $233.75, so $234
    expect(saved.addOns).toMatchObject([{ name: "Inside the oven" }]);
    expect(saved.plan).toMatchObject({
      oneOffPriceCents: 23400,
      discountCents: 2340,
    });
    expect(saved.options[0]!.priceCents).toBe(23400 - 2340);
  });

  test("each Job is taxed at the Service Plan rate, the one-off price at the one-off rate", async () => {
    const { office, propertyId } = await firstCleanDone();
    const {
      id: _,
      version,
      createdAt,
      createdByName,
      placeholder,
      ...list
    } = (await office.get("/api/price-list").expect(200)).body as PriceList;
    await office
      .put("/api/price-list")
      .send({ ...list, taxServicePlanPercent: 4.5 })
      .expect(200);

    const draft = await startPlan(office, propertyId);

    const perJob = STANDARD_MODERATE - 2060;
    expect(draft.options[0]).toMatchObject({
      taxCents: tax(perJob, 4.5),
      totalCents: perJob + tax(perJob, 4.5),
    });
    expect(draft.plan).toMatchObject({
      oneOffTaxCents: tax(STANDARD_MODERATE, 8.875),
      savingCents:
        STANDARD_MODERATE +
        tax(STANDARD_MODERATE, 8.875) -
        (perJob + tax(perJob, 4.5)),
    });
  });

  test("needs its plan terms, and a one-off Quote has none", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);

    const missing = await office
      .patch(`/api/quotes/${draft.id}`)
      .send(edit(draft, { plan: null }))
      .expect(400);
    expect(missing.body.details).toContainEqual(
      expect.objectContaining({ path: "plan" }),
    );

    await office
      .patch(`/api/quotes/${draft.id}`)
      .send(
        edit(draft, {
          plan: {
            recurrence: "monthly" as "weekly",
            cleanType: "standard",
            discountPercent: 101,
            condition: "moderate",
          },
        }),
      )
      .expect(400);

    const { body } = await submit(
      guestRequest({ property: { new: { ...home, street: "9 Elm St" } } }),
    ).expect(201);
    const oneOff = (
      await office
        .post("/api/quotes")
        .send({ quoteRequestId: body.id })
        .expect(201)
    ).body as OfficeQuote;
    expect(oneOff).toMatchObject({
      kind: "one_off",
      plan: null,
      firstClean: null,
    });
    const withPlan = await office
      .patch(`/api/quotes/${oneOff.id}`)
      .send(edit(draft))
      .expect(400);
    expect(withPlan.body.details).toContainEqual(
      expect.objectContaining({ path: "plan" }),
    );
  });
});

describe("a Sent Service Plan Quote", () => {
  test("emails the Client the Clean Type and the saving, with a plain link to it", async () => {
    const { office, propertyId } = await firstCleanDone();

    const quote = await sentPlan(office, propertyId);

    const sent = testEmail().lastTo(casey.email);
    expect(sent.subject).toBe("Your Service Plan Quote from Empire Cleaning");
    expect(sent.text).toContain("a Standard Clean every 2 weeks");
    expect(sent.text).toContain("$201.85 a clean, saving $22.43");
    expect(sent.text).toContain("one-off price of $224.28");
    expect(sent.text.match(/https?:\/\/\S+/g)).toEqual([
      expect.stringMatching(new RegExp(`/portal/quotes/${quote.id}$`)),
    ]);

    testClock().advance({ hours: 1 });
    const draft = await startPlan(office, propertyId);
    await send(office, draft, {
      plan: { ...edit(draft).plan!, recurrence: "weekly", cleanType: "deep" },
    });
    expect(testEmail().lastTo(casey.email).text).toContain(
      "a Deep Clean every week",
    );
  });

  test("the Client sees the one-off price, the Plan Discount and the per-Job price", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    const client = await signIn(casey.email);

    const view = (await client.get(`/api/quotes/mine/${quote.id}`).expect(200))
      .body as QuoteView;

    expect(view).toMatchObject({
      kind: "service_plan",
      quoteRequestId: null,
      status: "sent",
      proposedStartsAt: "2026-01-19T14:00:00.000Z",
      bookable: ["standard"],
    });
    expect(view.options).toEqual([
      expect.objectContaining({
        cleanType: "standard",
        priceCents: 18540,
        totalCents: 20185,
        // 25% of each Job's total
        depositCents: 5046,
      }),
    ]);
    // the Condition it's priced for is the Office's working
    expect(view.plan).toEqual({
      recurrence: "fortnightly",
      cleanType: "standard",
      discountPercent: 10,
      oneOffPriceCents: 20600,
      oneOffTaxCents: 1828,
      oneOffTotalCents: 22428,
      discountCents: 2060,
      savingCents: 2243,
    });

    const mine = (await client.get("/api/quotes/mine").expect(200))
      .body as QuoteSummary[];
    expect(
      mine.map((q) => [q.kind, q.status, q.headlineTotalCents, q.plan]),
    ).toEqual([
      [
        "service_plan",
        "sent",
        20185,
        { recurrence: "fortnightly", cleanType: "standard" },
      ],
      ["one_off", "accepted", expect.any(Number), null],
    ]);
  });

  test("never changes, and a new one Supersedes only it, not the home's open one-off Quote", async () => {
    const { office, propertyId } = await firstCleanDone();
    const asked = await askAgain();
    const oneOffDraft = (
      await office
        .post("/api/quotes")
        .send({ quoteRequestId: asked })
        .expect(201)
    ).body as OfficeQuote;
    await office
      .patch(`/api/quotes/${oneOffDraft.id}`)
      .send({ ...edit(oneOffDraft, { proposedStart: plansStart }), plan: null })
      .expect(200);
    const oneOff = (
      await office.post(`/api/quotes/${oneOffDraft.id}/send`).expect(200)
    ).body as OfficeQuote;
    const quote = await sentPlan(office, propertyId);

    // side by side
    expect((await officeQuote(office, oneOff.id)).status).toBe("sent");
    await office
      .patch(`/api/quotes/${quote.id}`)
      .send(edit(quote, { crewSize: 3 }))
      .expect(409);

    testClock().advance({ hours: 1 });
    const newer = await sentPlan(office, propertyId, {
      plan: {
        recurrence: "weekly",
        cleanType: "standard",
        discountPercent: 12,
        condition: "light",
      },
    });

    expect(newer.status).toBe("sent");
    expect((await officeQuote(office, quote.id)).status).toBe("superseded");
    expect((await officeQuote(office, oneOff.id)).status).toBe("sent");
    expect((await requestDetail(office, asked)).state).toBe("quoted");
  });

  test("offered unprompted, never books, re-opens or ends a request", async () => {
    const { office, propertyId, quoteRequestId } = await firstCleanDone();
    const asked = await askAgain();

    const quote = await sentPlan(office, propertyId);

    expect((await requestDetail(office, asked)).state).toBe("awaiting_quote");
    expect((await requestDetail(office, quoteRequestId)).state).toBe("booked");
    const client = await signIn(casey.email);
    await client.post(`/api/quotes/mine/${quote.id}/decline`).expect(200);
    expect((await requestDetail(office, asked)).state).toBe("awaiting_quote");
    expect((await requestDetail(office, quoteRequestId)).state).toBe("booked");
  });

  test("answering a request, quotes it, and Declined ends it", async () => {
    const { office } = await firstCleanDone();
    const asked = await askAgain();
    const draft = (
      await office
        .post("/api/quotes")
        .send({ quoteRequestId: asked, kind: "service_plan" })
        .expect(201)
    ).body as OfficeQuote;

    const quote = await send(office, draft);
    expect((await requestDetail(office, asked)).state).toBe("quoted");

    const client = await signIn(casey.email);
    await client.post(`/api/quotes/mine/${quote.id}/decline`).expect(200);
    expect((await requestDetail(office, asked)).state).toBe("ended");
    await office
      .post("/api/quotes")
      .send({ quoteRequestId: asked, kind: "service_plan" })
      .expect(409);
  });

  test("once Declined, the Office can offer the home a plan again", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    const client = await signIn(casey.email);

    const declined = (
      await client.post(`/api/quotes/mine/${quote.id}/decline`).expect(200)
    ).body as QuoteView;
    expect(declined.status).toBe("declined");

    testClock().advance({ days: 30 });
    const again = await sentPlan(office, propertyId, {
      proposedStart: { date: "2026-02-16", time: "09:00" },
    });
    expect(again.status).toBe("sent");
  });

  test("Expires like any Quote, and the Office can send another", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId, { validityDays: 3 });

    testClock().advance({ days: 3 });

    expect((await officeQuote(office, quote.id)).status).toBe("expired");
    await sentPlan(office, propertyId, {
      proposedStart: { date: "2026-01-26", time: "09:00" },
    });
  });

  test("can't be accepted yet", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    const client = await signIn(casey.email);

    await client
      .post(`/api/quotes/mine/${quote.id}/accept`)
      .send({ cleanType: "standard" })
      .expect(409);
    await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ cleanType: "standard" })
      .expect(409);
    expect((await officeQuote(office, quote.id)).status).toBe("sent");
  });
});

describe("where the Office offers a Service Plan", () => {
  test("from the First Clean, once it's Completed", async () => {
    const { office, job } = await firstCleanDone();

    const done = (await office.get(`/api/jobs/${job.id}`).expect(200))
      .body as OfficeJob;
    expect(done.canOfferServicePlan).toBe(true);

    await office.delete(`/api/jobs/${job.id}/completion`).expect(200);
    const booked = (await office.get(`/api/jobs/${job.id}`).expect(200))
      .body as OfficeJob;
    expect(booked.canOfferServicePlan).toBe(false);
  });

  test("from the Client, whose homes list their Quotes, Drafts included, and Jobs", async () => {
    const { office, propertyId, job } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);
    const { body } = await submit(
      guestRequest({ property: { new: { ...home, street: "9 Elm St" } } }),
    ).expect(201);

    const client = (
      await office.get(`/api/clients/${draft.client.id}`).expect(200)
    ).body as OfficeClientView;

    expect(
      client.properties.map((p) => [p.street, p.firstCleanCompleted]),
    ).toEqual([
      [home.street, true],
      ["9 Elm St", false],
    ]);
    expect(client.quotes.map((q) => [q.kind, q.status])).toEqual([
      ["service_plan", "draft"],
      ["one_off", "accepted"],
    ]);
    expect(client.jobs.map((j) => [j.id, j.status])).toEqual([
      [job.id, "completed"],
    ]);
    expect(client.quoteRequests.map((r) => r.id)).toContain(body.id);
  });
});

describe("Needs attention", () => {
  test("nudges the Office to offer a plan once a First Clean is done for a Client who wanted regular visits", async () => {
    const { office, propertyId, job } = await firstCleanDone();

    expect(await plansDue(office)).toEqual([
      {
        kind: "service_plan_due",
        since: "2026-01-12T16:00:00.000Z",
        job: expect.objectContaining({ id: job.id, status: "completed" }),
      },
    ]);

    // a Draft isn't an offer
    const draft = await startPlan(office, propertyId);
    expect(await plansDue(office)).toHaveLength(1);

    const quote = await send(office, draft, { validityDays: 3 });
    expect(await plansDue(office)).toEqual([]);

    // unanswered and Expired, it's due again
    testClock().advance({ days: 3 });
    expect(await plansDue(office)).toHaveLength(1);

    const again = await sentPlan(office, propertyId, {
      proposedStart: { date: "2026-01-26", time: "09:00" },
    });
    const client = await signIn(casey.email);
    await client.post(`/api/quotes/mine/${again.id}/decline`).expect(200);
    expect(quote.id).not.toBe(again.id);
    expect(await plansDue(office)).toEqual([]);
  });

  test("doesn't nudge for a Client who only wanted the one clean", async () => {
    const { office } = await firstCleanDone({ wantsRegularService: false });

    expect(await plansDue(office)).toEqual([]);
  });
});
