import { describe, expect, test } from "vitest";
import type {
  NeedsAttentionItem,
  OfficeClientView,
  OfficeJob,
  OfficePropertyView,
  OfficeQuote,
  PlanDayInput,
  PriceList,
  QuoteDraftInput,
  QuoteRequestDetail,
  QuoteSummary,
  QuoteView,
  ServicePlanInput,
  SignedInAccount,
} from "@empire-cleaning/models";
import { dayOf, timeOf } from "#services/clock";
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

// what changes on a Service Plan Draft: its terms, and its first weekday's
// visit, or every weekday's
type PlanEdit = Partial<
  Pick<QuoteDraftInput, "addOns" | "depositPercent" | "validityDays">
> &
  Partial<Omit<ServicePlanInput, "days">> &
  Partial<PlanDayInput> & { days?: PlanDayInput[] };

// a weekday as it is on a Draft, as a PATCH body has it
const dayInput = (quote: OfficeQuote, i: number): PlanDayInput => {
  const day = quote.plan!.days[i]!;
  const option = quote.options[i]!;
  const at = day.startsAt ? new Date(day.startsAt) : null;
  return {
    start: at && { date: dayOf(at), time: timeOf(at) },
    cleanType: day.cleanType,
    crewSize: day.crewSize,
    override:
      option.overrideCents === null
        ? null
        : { priceCents: option.overrideCents, reason: option.overrideReason! },
  };
};

// what a Service Plan Draft is now, as a PATCH body, with changes
const edit = (
  quote: OfficeQuote,
  {
    addOns,
    depositPercent,
    validityDays,
    recurrence,
    discountPercent,
    condition,
    days,
    ...first
  }: PlanEdit = {},
): QuoteDraftInput => {
  const [day, ...others] = quote.plan!.days.map((_, i) => dayInput(quote, i));
  return {
    addOns: addOns ?? quote.addOns.map((a) => a.key),
    depositPercent: depositPercent ?? quote.depositPercent,
    validityDays: validityDays ?? quote.validityDays,
    plan: {
      recurrence: recurrence ?? quote.plan!.recurrence,
      discountPercent: discountPercent ?? quote.plan!.discountPercent,
      condition: condition ?? quote.plan!.condition,
      days: days ?? [{ ...day!, ...first }, ...others],
    },
  };
};

const save = async (office: Agent, quote: OfficeQuote, changes: PlanEdit) =>
  (
    await office
      .patch(`/api/quotes/${quote.id}`)
      .send(edit(quote, changes))
      .expect(200)
  ).body as OfficeQuote;

const send = async (
  office: Agent,
  draft: OfficeQuote,
  changes: PlanEdit = {},
) => {
  await save(office, draft, { start: plansStart, ...changes });
  return (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
    .body as OfficeQuote;
};

const sentPlan = async (
  office: Agent,
  propertyId: string,
  changes: PlanEdit = {},
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
    await save(office, draft, { start: plansStart });

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
      discountPercent: 10,
      condition: "moderate",
      days: [
        {
          startsAt: null,
          cleanType: "standard",
          crewSize: draft.crewSize,
          oneOffPriceCents: STANDARD_MODERATE,
          oneOffTaxCents: tax(STANDARD_MODERATE, 8.875),
          oneOffTotalCents: oneOffTotal,
          discountCents: 2060,
          savingCents: oneOffTotal - option!.totalCents,
        },
      ],
      roundTotalCents: option!.totalCents,
      depositCents: option!.depositCents,
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
      recurrence: "weekly",
      condition: "heavy",
    });

    expect(saved.plan).toMatchObject({
      recurrence: "weekly",
      condition: "heavy",
      days: [{ oneOffPriceCents: STANDARD_HEAVY, discountCents: 2890 }],
    });
    expect(saved.options[0]!.priceCents).toBe(STANDARD_HEAVY - 2890);
  });

  test("can be a plan of Deep Cleans, with only the Deep Clean's price to override", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);
    const saved = await save(office, draft, { cleanType: "deep" });

    expect(saved.options.map((o) => o.cleanType)).toEqual(["deep"]);
    const [option] = saved.options;
    expect(option).toMatchObject({ recommended: false });
    expect(option!.suggested.cleanType).toBe("deep");
    const oneOff = option!.suggested.priceCents;
    expect(oneOff).toBeGreaterThan(STANDARD_MODERATE);
    expect(saved.plan!.days).toMatchObject([
      {
        cleanType: "deep",
        oneOffPriceCents: oneOff,
        discountCents: Math.floor((oneOff * 10 + 50) / 100),
      },
    ]);

    // each weekday's price is overridden on that weekday
    const standard = await office
      .patch(`/api/quotes/${draft.id}`)
      .send({
        ...edit(saved),
        overrides: {
          deep: null,
          standard: { priceCents: 30000, reason: "x" },
        },
      })
      .expect(400);
    expect(standard.body.details).toContainEqual(
      expect.objectContaining({ path: "overrides.standard" }),
    );
    const overridden = await save(office, saved, {
      override: { priceCents: 40000, reason: "Big home" },
    });
    expect(overridden.options[0]).toMatchObject({
      overrideCents: 40000,
      priceCents: 36000,
    });
  });

  test("shows the plan priced as each Clean Type to choose between, until it's Sent", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);
    const oven = draft.addOnChoices.find((a) => a.name === "Inside the oven")!;

    const saved = await save(office, draft, {
      addOns: [oven.key],
      override: { priceCents: 25000, reason: "Big garden room" },
    });

    const [standard, deep] = saved.planChoices![0]!;
    // its own Clean Type as saved, override and all
    expect(standard).toEqual({
      option: saved.options[0],
      day: saved.plan!.days[0],
    });
    expect(standard!.day).toMatchObject({
      cleanType: "standard",
      oneOffPriceCents: 25000,
      discountCents: 2500,
    });
    // the other at its Suggested Price, with the same terms and Add-ons
    expect(deep!.option).toMatchObject({
      cleanType: "deep",
      overrideCents: null,
    });
    expect(deep!.option.suggested.addOns).toMatchObject([
      { name: "Inside the oven" },
    ]);
    const oneOff = deep!.option.suggested.priceCents;
    expect(deep!.day).toMatchObject({
      cleanType: "deep",
      oneOffPriceCents: oneOff,
      discountCents: Math.floor((oneOff * 10 + 50) / 100),
    });

    // choosing it makes it the plan's
    const chosen = await save(office, saved, {
      override: null,
      cleanType: "deep",
    });
    expect(chosen.options).toEqual([deep!.option]);
    expect(chosen.planChoices![0]!.map((c) => c.option.cleanType)).toEqual([
      "standard",
      "deep",
    ]);

    const sent = await send(office, chosen);
    expect(sent.planChoices).toBeNull();
  });

  test("the Plan Discount is overridable, and comes off an overridden price", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);

    const saved = await save(office, draft, {
      override: { priceCents: 25000, reason: "Big garden room" },
      recurrence: "four_weekly",
      discountPercent: 15,
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
      days: [
        {
          oneOffPriceCents: 25000,
          oneOffTotalCents: 25000 + tax(25000, 8.875),
          discountCents: 3750,
        },
      ],
    });
  });

  test("recurring Add-ons are in the one-off price and the Plan Discount comes off them too", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);
    const oven = draft.addOnChoices.find((a) => a.name === "Inside the oven")!;

    const saved = await save(office, draft, { addOns: [oven.key] });

    // half an hour more: 4.25 hours is $233.75, so $234
    expect(saved.addOns).toMatchObject([{ name: "Inside the oven" }]);
    expect(saved.plan!.days).toMatchObject([
      { oneOffPriceCents: 23400, discountCents: 2340 },
    ]);
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
    expect(draft.plan!.days).toMatchObject([
      {
        oneOffTaxCents: tax(STANDARD_MODERATE, 8.875),
        savingCents:
          STANDARD_MODERATE +
          tax(STANDARD_MODERATE, 8.875) -
          (perJob + tax(perJob, 4.5)),
      },
    ]);
  });

  test("needs its plan terms, and a one-off Quote has none", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);

    const missing = await office
      .patch(`/api/quotes/${draft.id}`)
      .send({ ...edit(draft), plan: null })
      .expect(400);
    expect(missing.body.details).toContainEqual(
      expect.objectContaining({ path: "plan" }),
    );

    await office
      .patch(`/api/quotes/${draft.id}`)
      .send(
        edit(draft, {
          recurrence: "monthly" as "weekly",
          discountPercent: 101,
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
      planChoices: null,
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
    await send(office, draft, { recurrence: "weekly", cleanType: "deep" });
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
      discountPercent: 10,
      days: [
        {
          startsAt: "2026-01-19T14:00:00.000Z",
          cleanType: "standard",
          crewSize: view.crewSize,
          oneOffPriceCents: 20600,
          oneOffTaxCents: 1828,
          oneOffTotalCents: 22428,
          discountCents: 2060,
          savingCents: 2243,
        },
      ],
      roundTotalCents: 20185,
      depositCents: 5046,
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
        {
          recurrence: "fortnightly",
          days: [
            { startsAt: "2026-01-19T14:00:00.000Z", cleanType: "standard" },
          ],
        },
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
      .send({
        addOns: [],
        crewSize: oneOffDraft.crewSize,
        depositPercent: oneOffDraft.depositPercent,
        validityDays: oneOffDraft.validityDays,
        proposedStart: plansStart,
        overrides: { deep: null, standard: null },
      } satisfies QuoteDraftInput)
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
      recurrence: "weekly",
      discountPercent: 12,
      condition: "light",
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
      start: { date: "2026-02-16", time: "09:00" },
    });
    expect(again.status).toBe("sent");
  });

  test("Expires like any Quote, and the Office can send another", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId, { validityDays: 3 });

    testClock().advance({ days: 3 });

    expect((await officeQuote(office, quote.id)).status).toBe("expired");
    await sentPlan(office, propertyId, {
      start: { date: "2026-01-26", time: "09:00" },
    });
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

  test("from the Property, whose page lists its requests, its Quotes, Drafts included, and its Jobs", async () => {
    const { office, propertyId, job } = await firstCleanDone();
    await startPlan(office, propertyId);
    const other = await submit(
      guestRequest({ property: { new: { ...home, street: "9 Elm St" } } }),
    ).expect(201);

    const property = (
      await office.get(`/api/properties/${propertyId}`).expect(200)
    ).body as OfficePropertyView;

    expect(property).toMatchObject({
      street: home.street,
      client: { name: casey.name },
      firstCleanCompleted: true,
    });
    expect(property.quotes.map((q) => [q.kind, q.status])).toEqual([
      ["service_plan", "draft"],
      ["one_off", "accepted"],
    ]);
    expect(property.jobs.map((j) => [j.id, j.status])).toEqual([
      [job.id, "completed"],
    ]);
    expect(property.quoteRequests).toHaveLength(1);
    expect(property.quoteRequests[0]!.id).not.toBe(other.body.id);
  });
});

describe("the Client screen", () => {
  const homesOf = async (office: Agent, clientId: string) =>
    (
      (await office.get(`/api/clients/${clientId}`).expect(200))
        .body as OfficeClientView
    ).properties.map((p) => [p.street, p.status]);

  test("lists each home with where it stands", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);
    await submit(
      guestRequest({ property: { new: { ...home, street: "9 Elm St" } } }),
    ).expect(201);

    // a Draft isn't sent, so the First Clean is the latest news
    expect(await homesOf(office, draft.client.id)).toEqual([
      [home.street, { kind: "first_clean_done" }],
      ["9 Elm St", { kind: "request_waiting" }],
    ]);

    await send(office, draft);
    expect((await homesOf(office, draft.client.id))[0]).toEqual([
      home.street,
      { kind: "quote_sent", quoteKind: "service_plan" },
    ]);
  });

  test("puts a request waiting on the Office before an open Quote", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await sentPlan(office, propertyId);
    await askAgain();

    expect((await homesOf(office, draft.client.id))[0]).toEqual([
      home.street,
      { kind: "request_waiting" },
    ]);
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
      start: { date: "2026-01-26", time: "09:00" },
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
