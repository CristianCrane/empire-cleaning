import { describe, expect, test } from "vitest";
import type { OfficeQuote, QuoteDraftInput } from "@empire-cleaning/models";
import { api, signIn } from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "#features/services";

// A Service priced by area is priced on an area on the Revision (ADR-0018).
// Painting as seeded: 8 h per 1,000 sq ft at $60 an hour, a $300 Minimum
// Charge, and neither Condition nor a Premises Type changes it.

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York
const nextMonday = { date: "2026-01-12", time: "09:00" };

const startDraft = async (office: Agent, quoteId: string) =>
  (await office.post(`/api/quotes/${quoteId}/revisions`).send({}).expect(201))
    .body as OfficeQuote;

// the Draft as it is, with changes, as a PATCH body
const edit = (
  quote: OfficeQuote,
  changes: Partial<QuoteDraftInput> = {},
): QuoteDraftInput => ({
  area: quote.draft!.area,
  addOns: quote.draft!.addOns.map((a) => a.key),
  crewSize: quote.draft!.crewSize,
  depositPercent: quote.draft!.depositPercent,
  validityDays: quote.draft!.validityDays,
  proposedStart: nextMonday,
  overrides: {},
  ...changes,
});

const save = async (office: Agent, quote: OfficeQuote, changes = {}) =>
  (
    await office
      .patch(`/api/quotes/${quote.id}/draft`)
      .send(edit(quote, changes))
      .expect(200)
  ).body as OfficeQuote;

const pricedOf = (quote: OfficeQuote) => {
  const [option] = (quote.draft ?? quote.offer)!.options;
  const { area, homeHours, conditionMultiplier, labourHours, priceCents } =
    option!.suggested;
  return { area, homeHours, conditionMultiplier, labourHours, priceCents };
};

// a home asking for Painting, with a rough idea of the area
const paintingAsk = async (changes: object = {}) =>
  (
    await submit(
      guestAsk({
        serviceKey: SEEDED.painting,
        wantsRegularService: false,
        condition: "heavy",
        ...changes,
      }),
    ).expect(201)
  ).body.id as string;

// the home's findings, as a Site Visit records them, with no visit
const recordFindings = (office: Agent, quote: OfficeQuote) =>
  office
    .post(`/api/properties/${quote.property.id}/findings`)
    .send({
      type: home.type,
      bedrooms: home.bedrooms,
      bathrooms: home.bathrooms,
      storeys: home.storeys,
      pets: home.pets,
      floorArea: null,
      condition: "heavy",
    })
    .expect(201);

describe("a Quote for a Service priced by area", () => {
  test("is priced on the Client's rough area, ignoring Condition", async () => {
    const office = await signInAsOffice();
    const draft = await startDraft(office, await paintingAsk({ area: 1200 }));

    expect(draft.asked!.area).toBe(1200);
    expect(draft.areaFrom).toEqual({ sqFt: 1200, source: "asked" });
    expect(draft.draft!.area).toBeNull();
    // 1.2 x 8 h = 9.6 h, to the quarter-hour, at $60
    expect(pricedOf(draft)).toEqual({
      area: 1200,
      homeHours: [{ label: "1,200 sq ft ÷ 1,000 × 8 h", hours: 9.6 }],
      conditionMultiplier: 1,
      labourHours: 9.75,
      priceCents: 58500,
    });
  });

  test("is priced on the area Office Staff type instead", async () => {
    const office = await signInAsOffice();
    const draft = await startDraft(office, await paintingAsk({ area: 1200 }));

    const saved = await save(office, draft, { area: 2000 });

    expect(saved.draft!.area).toBe(2000);
    expect(pricedOf(saved)).toMatchObject({
      area: 2000,
      labourHours: 16,
      priceCents: 96000,
    });
  });

  test("is the Minimum Charge until an area is known, and can't be Sent without one", async () => {
    const office = await signInAsOffice();
    const draft = await startDraft(office, await paintingAsk());
    await recordFindings(office, draft);
    const saved = await save(office, draft);

    expect(pricedOf(saved)).toMatchObject({
      area: null,
      homeHours: [{ label: "Area not recorded yet", hours: 0 }],
      priceCents: 30000,
    });
    const refused = await office
      .post(`/api/quotes/${draft.id}/send`)
      .expect(400);
    expect(refused.body.details).toContainEqual(
      expect.objectContaining({
        path: "area",
        issue: "Enter the area to price it on",
      }),
    );

    await save(office, saved, { area: 900 });
    const sent = (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
      .body as OfficeQuote;
    expect(sent.offer!.area).toBe(900);
  });

  test("at a home without its rooms can't become a cleaning Quote until they're recorded", async () => {
    const office = await signInAsOffice();
    const {
      bedrooms: _b,
      bathrooms: _ba,
      storeys: _s,
      pets: _p,
      ...roomless
    } = home;
    const draft = await startDraft(
      office,
      await paintingAsk({ property: { new: roomless } }),
    );

    const cleaning = await save(office, draft, {
      serviceKey: SEEDED.moveInOut,
    });

    expect(pricedOf(cleaning)).toMatchObject({
      homeHours: [{ label: "Rooms not recorded yet", hours: 0 }],
      priceCents: 10000,
    });
    const refused = await office
      .post(`/api/quotes/${draft.id}/send`)
      .expect(409);
    expect(refused.body.message).toBe(
      "This home's rooms aren't recorded yet, so the Quote can't be sent. Record them on the Property, then send it.",
    );
    const property = `/api/properties/${draft.property.id}`;
    await office.patch(property).send({ bedrooms: 2 }).expect(400);
    await office
      .patch(property)
      .send({ bedrooms: 2, bathrooms: 1, storeys: 1, pets: false })
      .expect(200);
    await save(office, cleaning, { serviceKey: SEEDED.moveInOut });
    await office.post(`/api/quotes/${draft.id}/send`).expect(200);
  });

  test("keeps a Sent Revision's area for the next one", async () => {
    const office = await signInAsOffice();
    const draft = await startDraft(office, await paintingAsk({ area: 1200 }));
    await recordFindings(office, draft);
    await save(office, draft);
    const sent = (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
      .body as OfficeQuote;
    // fixed on sending, though Office Staff typed none
    expect(sent.offer!.area).toBe(1200);

    const next = await startDraft(office, draft.id);

    expect(next.draft!.area).toBe(1200);
    expect(pricedOf(next)).toMatchObject({ area: 1200, labourHours: 9.75 });
  });

  test("at business premises ignores their Premises Type", async () => {
    const office = await signInAsOffice();
    const types = Object.fromEntries(
      (
        (await api().get("/api/price-list/premises-types").expect(200))
          .body as { key: string; name: string }[]
      ).map((t) => [t.name, t.key]),
    );
    const { body } = await submit({
      contact: casey,
      businessName: "Acme Dental",
      property: {
        new: {
          kind: "commercial",
          street: "200 Park Ave S",
          postcode: "10003",
          premisesType: types.Medical,
          floorArea: 2000,
        },
      },
      serviceKey: SEEDED.painting,
      wantsRegularService: false,
    }).expect(201);

    const draft = await startDraft(office, body.id);

    expect(draft.areaFrom).toEqual({ sqFt: 2000, source: "property" });
    expect(pricedOf(draft)).toMatchObject({
      homeHours: [{ label: "2,000 sq ft ÷ 1,000 × 8 h", hours: 16 }],
      conditionMultiplier: 1,
      labourHours: 16,
    });
  });

  test("keeps no area asked for a Service priced from a home's rooms", async () => {
    const office = await signInAsOffice();
    const { body } = await submit(guestAsk({ area: 1200 })).expect(201);

    const quote = (await office.get(`/api/quotes/${body.id}`).expect(200))
      .body as OfficeQuote;

    expect(quote.asked!.area).toBeNull();
    expect(quote.suggested.prices.map((p) => p.area)).toEqual([null, null]);
  });
});
