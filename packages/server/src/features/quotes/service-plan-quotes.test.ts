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
  guestAsk,
  home,
  setService,
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

// the Revision being drafted, or with none, the offer
const working = (quote: OfficeQuote) => (quote.draft ?? quote.offer)!;

// a weekday as it is on a Draft, as a PATCH body has it
const dayInput = (quote: OfficeQuote, i: number): PlanDayInput => {
  const day = working(quote).plan!.days[i]!;
  const option = working(quote).options[i]!;
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
  const revision = working(quote);
  const [day, ...others] = revision.plan!.days.map((_, i) =>
    dayInput(quote, i),
  );
  return {
    addOns: addOns ?? revision.addOns.map((a) => a.key),
    depositPercent: depositPercent ?? revision.depositPercent,
    validityDays: validityDays ?? revision.validityDays,
    plan: {
      recurrence: recurrence ?? revision.plan!.recurrence,
      discountPercent: discountPercent ?? revision.plan!.discountPercent,
      condition: condition ?? revision.plan!.condition,
      days: days ?? [{ ...day!, ...first }, ...others],
    },
  };
};

const save = async (office: Agent, quote: OfficeQuote, changes: PlanEdit) =>
  (
    await office
      .patch(`/api/quotes/${quote.id}/draft`)
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

// Casey asks again about the same home, as a signed-in Client would
const askAgain = async () => {
  const { body } = await submit(guestAsk()).expect(201);
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
    const { body } = await submit(guestAsk()).expect(201);
    const { property } = await officeQuote(office, body.id);

    const fromRequest = await office
      .post(`/api/quotes/${body.id}/revisions`)
      .send({ kind: "service_plan" })
      .expect(409);
    expect(fromRequest.body.message).toMatch(/First Clean is Completed/);
    const fromHome = await office
      .post("/api/quotes")
      .send({ propertyId: property.id, kind: "service_plan" })
      .expect(409);
    expect(fromHome.body.message).toMatch(/First Clean is Completed/);
    expect((await officeQuote(office, body.id)).firstCleanCompleted).toBe(
      false,
    );
  });

  test("a one-off Quote starts from what a Client asks for", async () => {
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
    const { office, propertyId, quoteId } = await firstCleanDone();

    const draft = await startPlan(office, propertyId);
    expect(draft).toMatchObject({
      kind: "service_plan",
      status: "draft",
      origin: "office",
      asked: null,
      property: { id: propertyId },
      draft: { number: 1 },
    });

    // asking again gives the same Draft
    const again = await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(200);
    expect(again.body.id).toBe(draft.id);
    // nobody asked, so the Client sees nothing of it until it's Sent
    const client = await signIn(casey.email);
    await client.get(`/api/quotes/mine/${draft.id}`).expect(404);
    // once it's Sent, one open at a time
    await send(office, draft);
    await client.get(`/api/quotes/mine/${draft.id}`).expect(200);
    const refused = await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(409);
    expect(refused.body.message).toBe(
      "This home has a Service Plan Quote, or a Quote asked for, open already: carry on with that one.",
    );
    // a Quote of its own: the First Clean's is as it was
    expect(await officeQuote(office, quoteId)).toMatchObject({
      kind: "one_off",
      status: "accepted",
    });
  });

  test("the First Clean's Quote is Accepted, so takes no more Revisions of either kind", async () => {
    const { office, quoteId } = await firstCleanDone();

    expect(await officeQuote(office, quoteId)).toMatchObject({
      status: "accepted",
      firstCleanCompleted: true,
    });
    for (const kind of ["one_off", "service_plan"]) {
      const refused = await office
        .post(`/api/quotes/${quoteId}/revisions`)
        .send({ kind })
        .expect(409);
      expect(refused.body.message).toMatch(/booked/);
    }
  });

  test("can't be offered unprompted while the home has a Quote asked for", async () => {
    const { office, propertyId } = await firstCleanDone();
    await askAgain();

    await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(409);
  });

  test("can be what a Client asking for regular cleaning is offered", async () => {
    const { office, propertyId } = await firstCleanDone();
    const asked = await askAgain();

    const draft = (
      await office
        .post(`/api/quotes/${asked}/revisions`)
        .send({ kind: "service_plan" })
        .expect(201)
    ).body as OfficeQuote;
    expect(draft).toMatchObject({
      id: asked,
      kind: "service_plan",
      origin: "client",
      asked: { wantsRegularService: true },
    });

    // the Quote has its Draft, and the home its Service Plan Quote
    const again = (
      await office.post(`/api/quotes/${asked}/revisions`).send({}).expect(200)
    ).body as OfficeQuote;
    expect(again.draft!.id).toBe(draft.draft!.id);
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

    expect(draft.draft!.addOns).toEqual([]);
    expect(draft.draft!.options.map((o) => o.cleanType)).toEqual(["standard"]);
    const [option] = draft.draft!.options;
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
    expect(draft.draft!.plan).toEqual({
      recurrence: "fortnightly",
      discountPercent: 10,
      condition: "moderate",
      days: [
        {
          startsAt: null,
          cleanType: "standard",
          crewSize: draft.draft!.crewSize,
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

    expect(saved.draft!.plan).toMatchObject({
      recurrence: "weekly",
      condition: "heavy",
      days: [{ oneOffPriceCents: STANDARD_HEAVY, discountCents: 2890 }],
    });
    expect(saved.draft!.options[0]!.priceCents).toBe(STANDARD_HEAVY - 2890);
  });

  test("can be a plan of Deep Cleans, with only the Deep Clean's price to override", async () => {
    const { office, propertyId } = await firstCleanDone();
    const draft = await startPlan(office, propertyId);
    const saved = await save(office, draft, { cleanType: "deep" });

    expect(saved.draft!.options.map((o) => o.cleanType)).toEqual(["deep"]);
    const [option] = saved.draft!.options;
    expect(option).toMatchObject({ recommended: false });
    expect(option!.suggested.cleanType).toBe("deep");
    const oneOff = option!.suggested.priceCents;
    expect(oneOff).toBeGreaterThan(STANDARD_MODERATE);
    expect(saved.draft!.plan!.days).toMatchObject([
      {
        cleanType: "deep",
        oneOffPriceCents: oneOff,
        discountCents: Math.floor((oneOff * 10 + 50) / 100),
      },
    ]);

    // each weekday's price is overridden on that weekday
    const standard = await office
      .patch(`/api/quotes/${draft.id}/draft`)
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
    expect(overridden.draft!.options[0]).toMatchObject({
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

    const [standard, deep] = saved.draft!.planChoices![0]!;
    // its own Clean Type as saved, override and all
    expect(standard).toEqual({
      option: saved.draft!.options[0],
      day: saved.draft!.plan!.days[0],
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
    expect(chosen.draft!.options).toEqual([deep!.option]);
    expect(
      chosen.draft!.planChoices![0]!.map((c) => c.option.cleanType),
    ).toEqual(["standard", "deep"]);

    const sent = await send(office, chosen);
    expect(sent.offer!.planChoices).toBeNull();
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
    expect(saved.draft!.options[0]).toMatchObject({
      overrideCents: 25000,
      overrideReason: "Big garden room",
      priceCents: perJob,
      totalCents: perJob + tax(perJob, 8.875),
    });
    expect(saved.draft!.options[0]!.suggested.priceCents).toBe(
      STANDARD_MODERATE,
    );
    expect(saved.draft!.plan).toMatchObject({
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
    expect(saved.draft!.addOns).toMatchObject([{ name: "Inside the oven" }]);
    expect(saved.draft!.plan!.days).toMatchObject([
      { oneOffPriceCents: 23400, discountCents: 2340 },
    ]);
    expect(saved.draft!.options[0]!.priceCents).toBe(23400 - 2340);
  });

  test("each Job is taxed at the Service Plan rate, the one-off price at the one-off rate", async () => {
    const { office, propertyId } = await firstCleanDone();
    await setService(office, "standard", { taxPlanPercent: 4.5 });

    const draft = await startPlan(office, propertyId);

    const perJob = STANDARD_MODERATE - 2060;
    expect(draft.draft!.options[0]).toMatchObject({
      taxCents: tax(perJob, 4.5),
      totalCents: perJob + tax(perJob, 4.5),
    });
    expect(draft.draft!.plan!.days).toMatchObject([
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
      .patch(`/api/quotes/${draft.id}/draft`)
      .send({ ...edit(draft), plan: null })
      .expect(400);
    expect(missing.body.details).toContainEqual(
      expect.objectContaining({ path: "plan" }),
    );

    await office
      .patch(`/api/quotes/${draft.id}/draft`)
      .send(
        edit(draft, {
          recurrence: "monthly" as "weekly",
          discountPercent: 101,
        }),
      )
      .expect(400);

    const { body } = await submit(
      guestAsk({ property: { new: { ...home, street: "9 Elm St" } } }),
    ).expect(201);
    const oneOff = (
      await office.post(`/api/quotes/${body.id}/revisions`).send({}).expect(201)
    ).body as OfficeQuote;
    expect(oneOff).toMatchObject({
      kind: "one_off",
      firstClean: null,
      draft: { plan: null, planChoices: null },
    });
    const withPlan = await office
      .patch(`/api/quotes/${oneOff.id}/draft`)
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

    // a new Revision says it's been updated
    testClock().advance({ hours: 1 });
    const draft = (
      await office
        .post(`/api/quotes/${quote.id}/revisions`)
        .send({})
        .expect(201)
    ).body as OfficeQuote;
    await send(office, draft, { recurrence: "weekly", cleanType: "deep" });
    const updated = testEmail().lastTo(casey.email);
    expect(updated.subject).toBe(
      "Your updated Service Plan Quote from Empire Cleaning",
    );
    expect(updated.text).toContain("has been updated: a Deep Clean every week");
  });

  test("the Client sees the one-off price, the Plan Discount and the per-Job price", async () => {
    const { office, propertyId } = await firstCleanDone();
    const quote = await sentPlan(office, propertyId);
    const client = await signIn(casey.email);

    const view = (await client.get(`/api/quotes/mine/${quote.id}`).expect(200))
      .body as QuoteView;

    expect(view).toMatchObject({
      kind: "service_plan",
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

  test("never changes, and a new Revision replaces only its offer, not the home's open one-off Quote", async () => {
    const { office, propertyId } = await firstCleanDone();
    const asked = await askAgain();
    const oneOffDraft = (
      await office.post(`/api/quotes/${asked}/revisions`).send({}).expect(201)
    ).body as OfficeQuote;
    await office
      .patch(`/api/quotes/${oneOffDraft.id}/draft`)
      .send({
        addOns: [],
        crewSize: oneOffDraft.draft!.crewSize,
        depositPercent: oneOffDraft.draft!.depositPercent,
        validityDays: oneOffDraft.draft!.validityDays,
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
      .patch(`/api/quotes/${quote.id}/draft`)
      .send(edit(quote, { crewSize: 3 }))
      .expect(409);

    testClock().advance({ hours: 1 });
    const revising = (
      await office
        .post(`/api/quotes/${quote.id}/revisions`)
        .send({})
        .expect(201)
    ).body as OfficeQuote;
    // it starts from the offer's terms
    expect(revising.draft!.plan).toMatchObject({
      recurrence: "fortnightly",
      days: [{ startsAt: "2026-01-19T14:00:00.000Z" }],
    });
    const newer = await send(office, revising, {
      recurrence: "weekly",
      discountPercent: 12,
      condition: "light",
    });

    expect(newer).toMatchObject({
      id: quote.id,
      status: "sent",
      offer: { number: 2, plan: { recurrence: "weekly", discountPercent: 12 } },
    });
    expect(newer.revisions[1]!.headlineTotalCents).toBe(
      quote.offer!.plan!.roundTotalCents,
    );
    expect((await officeQuote(office, oneOff.id)).status).toBe("sent");
  });

  test("offered unprompted, is a Quote of its own: Declining it changes no other", async () => {
    const { office, propertyId, quoteId } = await firstCleanDone();

    const quote = await sentPlan(office, propertyId);

    const client = await signIn(casey.email);
    await client.post(`/api/quotes/mine/${quote.id}/decline`).expect(200);
    expect((await officeQuote(office, quote.id)).status).toBe("declined");
    expect((await officeQuote(office, quoteId)).status).toBe("accepted");
    // and the Client can ask again
    await askAgain();
  });

  test("made from a Quote asked for, Declined, takes no more Revisions", async () => {
    const { office } = await firstCleanDone();
    const asked = await askAgain();
    const draft = (
      await office
        .post(`/api/quotes/${asked}/revisions`)
        .send({ kind: "service_plan" })
        .expect(201)
    ).body as OfficeQuote;

    const quote = await send(office, draft);
    expect(quote).toMatchObject({ id: asked, status: "sent" });

    const client = await signIn(casey.email);
    await client.post(`/api/quotes/mine/${quote.id}/decline`).expect(200);
    expect((await officeQuote(office, asked)).status).toBe("declined");
    await office
      .post(`/api/quotes/${asked}/revisions`)
      .send({ kind: "service_plan" })
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

  test("from the Property, whose page lists its Quotes, Drafts included, and its Jobs", async () => {
    const { office, propertyId, job } = await firstCleanDone();
    await startPlan(office, propertyId);
    // another home's Quote isn't listed
    await submit(
      guestAsk({ property: { new: { ...home, street: "9 Elm St" } } }),
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
      guestAsk({ property: { new: { ...home, street: "9 Elm St" } } }),
    ).expect(201);

    // a Draft isn't sent, so the First Clean is the latest news
    expect(await homesOf(office, draft.client.id)).toEqual([
      [home.street, { kind: "first_clean_done" }],
      ["9 Elm St", { kind: "quote_requested" }],
    ]);

    await send(office, draft);
    expect((await homesOf(office, draft.client.id))[0]).toEqual([
      home.street,
      { kind: "quote_sent", quoteKind: "service_plan" },
    ]);
  });

  test("puts a Quote asked for, waiting on the Office, before an open Quote", async () => {
    const { office, propertyId } = await firstCleanDone();
    // asked for, and being drafted as a one-off Quote
    const asked = await askAgain();
    await office.post(`/api/quotes/${asked}/revisions`).send({}).expect(201);
    const plan = await sentPlan(office, propertyId);

    expect((await homesOf(office, plan.client.id))[0]).toEqual([
      home.street,
      { kind: "quote_requested" },
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
