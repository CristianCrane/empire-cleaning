import { describe, expect, test } from "vitest";
import type {
  ClientListItem,
  ClientView,
  OfficeQuote,
  PriceList,
  QuoteSummary,
} from "@empire-cleaning/models";
import { api, signIn, testEmail } from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// prices chosen so every answer below can be checked by hand: commercial
// work at $60 an hour, taxed at 10%; the placeholder Premises Types (Office
// 0.5 h per 1,000 sq ft, Medical 0.8 h); moderate x1, Deep Clean x2
const setPrices = async (office: Agent) => {
  const {
    id: _id,
    version: _version,
    placeholder: _placeholder,
    createdAt: _createdAt,
    createdByName: _createdByName,
    ...input
  } = (await office.get("/api/price-list").expect(200)).body as PriceList;
  await office
    .put("/api/price-list")
    .send({
      ...input,
      commercialHourlyRateCents: 6000,
      taxCommercialPercent: 10,
      minimumChargeCents: 10000,
      conditionModerate: 1,
      conditionHeavy: 1.5,
      deepCleanMultiplier: 2,
    })
    .expect(200);
};

const premisesTypes = async () =>
  Object.fromEntries(
    (
      (await api().get("/api/price-list/premises-types").expect(200)).body as {
        key: string;
        name: string;
      }[]
    ).map((t) => [t.name, t.key]),
  );

const premises = (premisesType: string, changes: object = {}) => ({
  kind: "commercial" as const,
  street: "200 Park Ave S",
  unit: "Floor 3",
  postcode: "10003",
  premisesType,
  floorArea: 4500,
  accessInstructions: "Reception has the key",
  ...changes,
});

// a business asking for cleaning three evenings a week
const businessAsk = (premisesType: string, changes: object = {}) => ({
  contact: casey,
  businessName: "Acme Dental",
  property: { new: premises(premisesType) },
  wantsRegularService: true,
  weekdays: [4, 0, 2],
  preferredTime: "18:00",
  notes: "After the last patient leaves",
  ...changes,
});

const openQuotes = async (office: Agent) =>
  (await office.get("/api/quotes").expect(200)).body as QuoteSummary[];

const detailOf = async (office: Agent, id: string) =>
  (await office.get(`/api/quotes/${id}`).expect(200)).body as OfficeQuote;

// the one Quote open, in full
const onlyQuote = async (office: Agent) => {
  const [quote] = await openQuotes(office);
  return detailOf(office, quote!.id);
};

describe("a Quote asked for business premises", () => {
  test("records the business, its premises and when it wants cleaning, with no Condition", async () => {
    const office = await signInAsOffice();
    const { Office } = await premisesTypes();

    const res = await submit(businessAsk(Office!));

    expect(res.status).toBe(201);
    expect(res.body.emailedTo).toBe(casey.email);
    expect(testEmail().lastTo(casey.email).text).toContain(
      "200 Park Ave S, Floor 3, 10003",
    );
    const detail = await onlyQuote(office);
    expect(detail).toMatchObject({
      asked: {
        condition: null,
        wantsRegularService: true,
        weekdays: [0, 2, 4],
        preferredTime: "18:00",
        notes: "After the last patient leaves",
        addOns: [],
      },
      client: { name: casey.name, businessName: "Acme Dental" },
      property: {
        kind: "commercial",
        street: "200 Park Ave S",
        premisesType: { key: Office, name: "Office" },
        floorArea: 4500,
        condition: null,
        accessInstructions: "Reception has the key",
      },
    });
    const [listed] = await openQuotes(office);
    expect(listed).toMatchObject({
      client: { businessName: "Acme Dental" },
      property: { kind: "commercial" },
      siteVisit: "needed",
    });
  });

  test("may be for a one-off clean, with no days or time", async () => {
    const office = await signInAsOffice();
    const { Retail } = await premisesTypes();

    await submit(
      businessAsk(Retail!, {
        wantsRegularService: false,
        weekdays: [],
        preferredTime: null,
        property: { new: premises(Retail!, { floorArea: null }) },
      }),
    ).expect(201);

    expect(await onlyQuote(office)).toMatchObject({
      asked: { wantsRegularService: false, weekdays: [], preferredTime: null },
      property: { floorArea: null },
    });
  });

  test("needs the business's name, and for regular cleaning its days and time", async () => {
    const { Office } = await premisesTypes();

    const res = await submit(
      businessAsk(Office!, {
        businessName: "  ",
        weekdays: [],
        preferredTime: null,
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        { path: "businessName", issue: "Enter the business's name" },
        { path: "weekdays", issue: "Choose the days you want cleaned" },
        { path: "preferredTime", issue: "Choose a time" },
      ]),
    );
  });

  test("states no Condition or Add-ons: a Site Visit finds those", async () => {
    const { Office } = await premisesTypes();

    const res = await submit(
      businessAsk(Office!, {
        condition: "heavy",
        addOns: ["00000000-0000-4000-8000-000000000000"],
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(["condition", "addOns"]),
    );
  });

  test("must choose a Premises Type on offer", async () => {
    const office = await signInAsOffice();
    await setPrices(office);
    const list = (await office.get("/api/price-list")).body as PriceList;
    const medical = list.premisesTypes.find((t) => t.name === "Medical")!;
    await office
      .put("/api/price-list")
      .send({
        ...list,
        premisesTypes: list.premisesTypes.filter((t) => t !== medical),
      })
      .expect(200);

    const retired = await submit(businessAsk(medical.key));
    const unknown = await submit(
      businessAsk("00000000-0000-4000-8000-000000000000"),
    );

    for (const res of [retired, unknown]) {
      expect(res.status).toBe(400);
      expect(res.body.details).toContainEqual(
        expect.objectContaining({
          path: "property.new.premisesType",
          issue: "Choose from the types of premises listed",
        }),
      );
    }
  });

  test("a signed-in Client's names their business if they have no name for it yet, and never renames it", async () => {
    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    const { Office } = await premisesTypes();
    const { contact: _contact, ...asClient } = businessAsk(Office!);

    await submit(asClient, client).expect(201);
    await submit(
      {
        ...asClient,
        businessName: "Another Name",
        property: { new: premises(Office!, { street: "1 Other St" }) },
      },
      client,
    ).expect(201);

    const me = (await client.get("/api/clients/me").expect(200))
      .body as ClientView;
    expect(me.businessName).toBe("Acme Dental");
    expect(me.properties.map((p) => p.kind)).toEqual([
      "residential",
      "commercial",
      "commercial",
    ]);
  });

  test("from a Guest with an existing Client's email leaves that Client's name for their business alone", async () => {
    const office = await signInAsOffice();
    await submit(guestAsk()).expect(201);
    const { Office } = await premisesTypes();

    await submit(businessAsk(Office!)).expect(201);

    const [listed] = (await office.get("/api/clients").expect(200))
      .body as ClientListItem[];
    expect(listed!.businessName).toBeNull();
  });

  test("for an address the Client already has as their home is refused", async () => {
    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    const { Office } = await premisesTypes();
    const { contact: _contact, ...asClient } = businessAsk(Office!, {
      property: {
        new: premises(Office!, {
          street: home.street,
          unit: home.unit,
          postcode: home.postcode,
        }),
      },
    });

    const res = await submit(asClient, client);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "41-12 Austin St, 4B, 11375 is already your home: choose it from the list to ask about it.",
    );
  });

  test("again, while one is waiting, is refused in the words for premises", async () => {
    const { Office } = await premisesTypes();
    await submit(businessAsk(Office!)).expect(201);

    const res = await submit(businessAsk(Office!));

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "You've already asked us for a Quote for these premises. We'll email it to casey@example.com soon.",
    );
  });
});

describe("the Suggested Price for business premises", () => {
  test("is the floor area's hours for its Premises Type, at the commercial rate and tax", async () => {
    const office = await signInAsOffice();
    await setPrices(office);
    const { Office } = await premisesTypes();
    await submit(businessAsk(Office!)).expect(201);

    const { suggested } = await onlyQuote(office);

    // 4,500 sq ft / 1,000 x 0.5 h = 2.25 h, moderate (none recorded yet)
    expect(suggested.standard).toMatchObject({
      propertyKind: "commercial",
      homeHours: [
        { label: "Office: 4,500 sq ft ÷ 1,000 × 0.5 h", hours: 2.25 },
      ],
      conditionMultiplier: 1,
      labourHours: 2.25,
      hourlyRateCents: 6000,
      // 2.25 h x $60 = $135, taxed at 10%
      priceCents: 13500,
      taxPercent: 10,
      taxCents: 1350,
      totalCents: 14850,
    });
    // x2 for a Deep Clean: 4.5 h = $270
    expect(suggested.deep).toMatchObject({
      labourHours: 4.5,
      priceCents: 27000,
      totalCents: 29700,
    });
  });

  test("is the Minimum Charge until the floor area is known", async () => {
    const office = await signInAsOffice();
    await setPrices(office);
    const { Office } = await premisesTypes();
    await submit(
      businessAsk(Office!, {
        property: { new: premises(Office!, { floorArea: null }) },
      }),
    ).expect(201);

    const { suggested } = await onlyQuote(office);

    expect(suggested.standard).toMatchObject({
      homeHours: [{ label: "Floor area not recorded yet (Office)", hours: 0 }],
      minimumApplied: true,
      priceCents: 10000,
    });
  });

  test("follows the Office's corrections to the premises", async () => {
    const office = await signInAsOffice();
    await setPrices(office);
    const { Office, Medical } = await premisesTypes();
    await submit(businessAsk(Office!)).expect(201);
    const { id, property } = await onlyQuote(office);

    const res = await office
      .patch(`/api/properties/${property.id}`)
      .send({ premisesType: Medical, floorArea: 2500, condition: "heavy" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      kind: "commercial",
      premisesType: { name: "Medical" },
      floorArea: 2500,
      condition: "heavy",
    });
    // 2,500 / 1,000 x 0.8 h = 2 h, x1.5 heavy = 3 h = $180
    const { suggested } = await detailOf(office, id);
    expect(suggested.standard).toMatchObject({
      labourHours: 3,
      priceCents: 18000,
    });
  });

  test("corrections are a Property's own kind: no rooms for premises", async () => {
    const office = await signInAsOffice();
    const { Office } = await premisesTypes();
    await submit(businessAsk(Office!)).expect(201);
    const { property } = await onlyQuote(office);

    const rooms = await office
      .patch(`/api/properties/${property.id}`)
      .send({ bedrooms: 3 });
    const unknownType = await office
      .patch(`/api/properties/${property.id}`)
      .send({ premisesType: "00000000-0000-4000-8000-000000000000" });

    expect(rooms.status).toBe(400);
    expect(unknownType.status).toBe(400);
  });
});

describe("Office Staff and business Clients", () => {
  test("enter a business caller's ask, drafting a Quote with Add-ons offered for businesses, taxed at the commercial rate", async () => {
    const office = await signInAsOffice();
    await setPrices(office);
    const { Office } = await premisesTypes();
    const list = (await office.get("/api/price-list")).body as PriceList;

    const { body } = await office
      .post("/api/quotes/caller")
      .send({
        contact: { name: "Pat Phoner", phone: "(718) 555-0123", email: null },
        businessName: "Phoner & Co",
        property: { new: premises(Office!) },
        wantsRegularService: false,
        notes: null,
      })
      .expect(201);

    const quote = (await office.get(`/api/quotes/${body.quoteId}`).expect(200))
      .body as OfficeQuote;
    expect(quote.client).toMatchObject({
      name: "Pat Phoner",
      businessName: "Phoner & Co",
    });
    // the placeholder Add-ons: only Interior windows is for businesses too
    expect(quote.addOnChoices.map((a) => a.name)).toEqual(["Interior windows"]);
    const deep = quote.draft!.options.find((o) => o.cleanType === "deep")!;
    expect(deep).toMatchObject({
      priceCents: 27000,
      taxCents: 2700,
      totalCents: 29700,
    });

    const oven = list.addOns.find((a) => a.name === "Inside the oven")!;
    const refused = await office.patch(`/api/quotes/${quote.id}/draft`).send({
      addOns: [oven.key],
      crewSize: quote.draft!.crewSize,
      depositPercent: quote.draft!.depositPercent,
      validityDays: quote.draft!.validityDays,
      proposedStart: null,
      overrides: { deep: null, standard: null },
    });
    expect(refused.status).toBe(400);
  });

  test("find a Client by their business's name, listed by it, and can correct it", async () => {
    const office = await signInAsOffice();
    await submit(
      guestAsk({
        contact: { ...casey, name: "Zed Zimmer", email: "zed@example.com" },
      }),
    ).expect(201);
    const { Office } = await premisesTypes();
    await submit(businessAsk(Office!)).expect(201);

    const all = (await office.get("/api/clients").expect(200))
      .body as ClientListItem[];
    const found = (await office.get("/api/clients?q=dental").expect(200))
      .body as ClientListItem[];

    // Acme Dental before Zed Zimmer
    expect(all.map((c) => c.businessName ?? c.name)).toEqual([
      "Acme Dental",
      "Zed Zimmer",
    ]);
    expect(found.map((c) => c.name)).toEqual([casey.name]);

    await office
      .patch(`/api/clients/${found[0]!.id}`)
      .send({ ...casey, businessName: "Acme Dental Group" })
      .expect(200);
    const [renamed] = (await office.get("/api/clients?q=dental").expect(200))
      .body as ClientListItem[];
    expect(renamed!.businessName).toBe("Acme Dental Group");
  });
});
