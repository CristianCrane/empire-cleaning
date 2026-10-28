import { describe, expect, test } from "vitest";
import type {
  SuggestedPrices,
  PriceList,
  PriceListInput,
  OfficeQuote,
  RoomHours,
} from "@empire-cleaning/models";
import { api, signIn } from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  home,
  setService,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "#features/services";

// one Service's Suggested Price on a Quote
const HOMES = [SEEDED.standard, SEEDED.deep, SEEDED.moveInOut];

const priceOf = (suggested: SuggestedPrices, service: "deep" | "standard") =>
  suggested.prices.find((p) => p.serviceKey === SEEDED[service])!;

// figures chosen so every expected answer below can be checked by hand
const figures: PriceListInput = {
  conditionLight: 0.8,
  conditionModerate: 1,
  conditionHeavy: 1.5,
  depositPercent: 25,
  planDiscountPercent: 10,
  quoteValidityDays: 14,
  defaultCrewSize: 2,
  taxFeePercent: 8,
  addOns: [
    {
      name: "Inside the oven",
      hours: 0.5,
      taxExempt: false,
      serviceKeys: HOMES,
      active: true,
    },
    {
      name: "Carpet shampooing",
      hours: 1,
      taxExempt: true,
      serviceKeys: [...HOMES, SEEDED.commercial],
      active: true,
    },
  ],
  premisesTypes: [
    { name: "Office", multiplier: 1, active: true },
    { name: "Medical", multiplier: 1.6, active: true },
  ],
};

type Office = Awaited<ReturnType<typeof signInAsOffice>>;

const getList = async (office: Office) =>
  (await office.get("/api/price-list").expect(200)).body as PriceList;

const save = (office: Office, changes: Partial<PriceListInput> = {}) =>
  office.put("/api/price-list").send({ ...figures, ...changes });

// a home's Services' own figures, chosen alongside the Price List's: a
// Deep Clean takes twice as long as a Standard Clean, part by part
const standardHours: RoomHours = {
  baseHours: 1,
  bedroomHours: 0.5,
  bathroomHours: 0.75,
  extraStoreyHours: 0.5,
  petHours: 0.5,
};
const homeRates = async (
  office: Office,
  changes: {
    hourlyRateCents?: number;
    minimumChargeCents?: number;
    roomHours?: RoomHours;
  } = {},
) => {
  const { roomHours = standardHours, ...rest } = changes;
  const rates = {
    hourlyRateCents: 5000,
    minimumChargeCents: 10000,
    taxOneOffPercent: 8,
    ...rest,
  };
  await setService(office, "standard", { ...rates, roomHours });
  await setService(office, "deep", {
    ...rates,
    roomHours: {
      baseHours: roomHours.baseHours * 2,
      bedroomHours: roomHours.bedroomHours * 2,
      bathroomHours: roomHours.bathroomHours * 2,
      extraStoreyHours: roomHours.extraStoreyHours * 2,
      petHours: roomHours.petHours * 2,
    },
  });
};

// the Add-ons on offer now, keyed by name (a retired one may share a name)
const addOnKeys = async (office: Office) =>
  Object.fromEntries(
    (await getList(office)).addOns
      .filter((a) => a.active)
      .map((a) => [a.name, a.key]),
  );

// what the Office sees for a Quote asked for, by asking and opening it
const detailOf = async (
  office: Office,
  request: ReturnType<typeof guestAsk> = guestAsk(),
) => {
  await submit(request).expect(201);
  const list = (await office.get("/api/quotes")).body;
  const id = list.find(
    (r: { client: { name: string } }) => r.client.name === casey.name,
  ).id;
  return (await office.get(`/api/quotes/${id}`).expect(200))
    .body as OfficeQuote;
};

describe("the Price List", () => {
  test("starts with placeholder figures, to be replaced", async () => {
    const office = await signInAsOffice();

    const list = await getList(office);

    expect(list).toMatchObject({
      version: 1,
      placeholder: true,
      conditionLight: 0.85,
      conditionModerate: 1,
      conditionHeavy: 1.4,
      depositPercent: 25,
      planDiscountPercent: 10,
      quoteValidityDays: 14,
      defaultCrewSize: 2,
      taxFeePercent: 8.875,
    });
    expect(list.addOns.map((a) => a.name)).toEqual([
      "Inside the oven",
      "Inside the fridge",
      "Inside the cabinets",
      "Interior windows",
    ]);
  });

  test("is only for Office Staff to read and change", async () => {
    const client = await signIn("casey@example.com");

    expect((await api().get("/api/price-list")).status).toBe(401);
    expect((await api().put("/api/price-list").send(figures)).status).toBe(401);
    expect((await client.get("/api/price-list")).status).toBe(403);
    expect((await client.put("/api/price-list").send(figures)).status).toBe(
      403,
    );
  });

  test("every save is a new version, recording who made it", async () => {
    const office = await signInAsOffice();
    await getList(office);

    const saved = await save(office, { depositPercent: 30 }).expect(200);

    expect(saved.body).toMatchObject({
      version: 2,
      placeholder: false,
      depositPercent: 30,
      createdByName: "Olive Owner",
    });
    expect(await getList(office)).toMatchObject({ version: 2 });
  });

  test("explains what's wrong, field by field", async () => {
    const office = await signInAsOffice();

    const res = await save(office, {
      conditionHeavy: 99,
      taxFeePercent: 40,
      depositPercent: 12.5,
      addOns: [
        {
          name: "",
          hours: -1,
          taxExempt: false,
          serviceKeys: HOMES,
          active: true,
        },
      ],
    });

    expect(res.status).toBe(400);
    const issues = Object.fromEntries(
      res.body.details.map((d: { path: string; issue: string }) => [
        d.path,
        d.issue,
      ]),
    );
    expect(issues).toMatchObject({
      conditionHeavy: "A multiplier can't be more than 10",
      taxFeePercent: "That's higher than any sales tax",
      depositPercent: "Use a whole percentage",
      "addOns.0.name": "Name the Add-on",
      "addOns.0.hours": "Hours can't be negative",
    });
  });

  test("won't have two live Add-ons with the same name", async () => {
    const office = await signInAsOffice();

    const res = await save(office, {
      addOns: [
        {
          name: "Oven",
          hours: 0.5,
          taxExempt: false,
          serviceKeys: HOMES,
          active: true,
        },
        {
          name: "oven",
          hours: 1,
          taxExempt: false,
          serviceKeys: HOMES,
          active: true,
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatchObject({
      path: "addOns.1.name",
      issue: "Another Add-on already has this name",
    });
  });

  test("never deletes an Add-on: leaving one out retires it", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    const keys = await addOnKeys(office);

    await save(office, {
      addOns: [
        {
          key: keys["Inside the oven"],
          name: "Inside the oven",
          hours: 0.5,
          taxExempt: false,
          serviceKeys: HOMES,
          active: true,
        },
      ],
    }).expect(200);

    const { addOns } = await getList(office);
    expect(addOns.filter((a) => a.active).map((a) => a.name)).toEqual([
      "Inside the oven",
    ]);
    // the one left out is kept, with the same key; so are the placeholders
    // the first save replaced
    const retired = addOns.filter((a) => !a.active);
    expect(retired.map((a) => a.name)).toEqual(
      expect.arrayContaining(["Carpet shampooing", "Interior windows"]),
    );
    expect(retired.find((a) => a.name === "Carpet shampooing")?.key).toBe(
      keys["Carpet shampooing"],
    );
  });

  test("won't take an Add-on it has never heard of", async () => {
    const office = await signInAsOffice();

    const res = await save(office, {
      addOns: [
        {
          key: "00000000-0000-4000-8000-000000000000",
          name: "Ghost",
          hours: 1,
          taxExempt: false,
          serviceKeys: HOMES,
          active: true,
        },
      ],
    });

    expect(res.status).toBe(400);
  });

  test("offers Clients the names of live Add-ons, and never their prices", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    const keys = await addOnKeys(office);
    await save(office, {
      addOns: [
        {
          key: keys["Inside the oven"],
          name: "Inside the oven",
          hours: 0.5,
          taxExempt: false,
          serviceKeys: HOMES,
          active: false,
        },
        {
          key: keys["Carpet shampooing"],
          name: "Carpet shampooing",
          hours: 1,
          taxExempt: true,
          serviceKeys: HOMES,
          active: true,
        },
      ],
    }).expect(200);

    // open to Guests: the landing page's form lists them
    const res = await api().get(
      `/api/price-list/add-ons?service=${SEEDED.standard}`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { key: keys["Carpet shampooing"], name: "Carpet shampooing" },
    ]);
  });
});

describe("Premises Types", () => {
  const premisesKeys = async (office: Office) =>
    Object.fromEntries(
      (await getList(office)).premisesTypes
        .filter((t) => t.active)
        .map((t) => [t.name, t.key]),
    );

  test("start as Office, Retail, Medical and Other, against an office", async () => {
    const office = await signInAsOffice();

    const list = await getList(office);

    expect(list.premisesTypes.map((t) => [t.name, t.multiplier])).toEqual([
      ["Office", 1],
      ["Retail", 0.8],
      ["Medical", 1.6],
      ["Other", 1.2],
    ]);
  });

  test("can be added, renamed, given new multipliers and retired, keeping their keys", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    const keys = await premisesKeys(office);

    await save(office, {
      premisesTypes: [
        {
          key: keys["Office"],
          name: "Offices",
          multiplier: 1.2,
          active: true,
        },
        { name: "Gym", multiplier: 1.4, active: true },
      ],
    }).expect(200);

    const { premisesTypes } = await getList(office);
    expect(premisesTypes.filter((t) => t.active)).toEqual([
      {
        key: keys["Office"],
        name: "Offices",
        multiplier: 1.2,
        active: true,
      },
      {
        key: expect.any(String),
        name: "Gym",
        multiplier: 1.4,
        active: true,
      },
    ]);
    // left out, so retired, never deleted
    expect(premisesTypes.find((t) => t.key === keys["Medical"])).toEqual({
      key: keys["Medical"],
      name: "Medical",
      multiplier: 1.6,
      active: false,
    });
  });

  test("must leave at least one on offer, with distinct names", async () => {
    const office = await signInAsOffice();

    const none = await save(office, {
      premisesTypes: [{ name: "Office", multiplier: 1, active: false }],
    });
    const twice = await save(office, {
      premisesTypes: [
        { name: "Office", multiplier: 1, active: true },
        { name: "office", multiplier: 1.2, active: true },
      ],
    });
    const unknown = await save(office, {
      premisesTypes: [
        {
          key: "00000000-0000-4000-8000-000000000000",
          name: "Ghost",
          multiplier: 1,
          active: true,
        },
      ],
    });

    expect(none.body.details).toContainEqual({
      path: "premisesTypes",
      issue: "Offer at least one Premises Type",
    });
    expect(twice.body.details).toContainEqual({
      path: "premisesTypes.1.name",
      issue: "Another Premises Type already has this name",
    });
    expect(unknown.status).toBe(400);
  });

  test("are offered by name to anyone, only those on offer", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    const keys = await premisesKeys(office);
    await save(office, {
      premisesTypes: [
        {
          key: keys["Office"],
          name: "Office",
          multiplier: 1,
          active: true,
        },
        {
          key: keys["Medical"],
          name: "Medical",
          multiplier: 1.6,
          active: false,
        },
      ],
    }).expect(200);

    const res = await api().get("/api/price-list/premises-types").expect(200);

    expect(res.body).toEqual([{ key: keys["Office"], name: "Office" }]);
  });
});

describe("Add-ons per Service", () => {
  test("only those for the Service asked for can be chosen; the form names the Service", async () => {
    const office = await signInAsOffice();
    await save(office, {
      addOns: [
        {
          name: "Inside the oven",
          hours: 0.5,
          taxExempt: false,
          serviceKeys: HOMES,
          active: true,
        },
        {
          name: "Interior windows",
          hours: 1,
          taxExempt: false,
          serviceKeys: [...HOMES, SEEDED.commercial],
          active: true,
        },
        {
          name: "Breakroom fridge",
          hours: 0.5,
          taxExempt: false,
          serviceKeys: [SEEDED.commercial],
          active: true,
        },
      ],
    }).expect(200);
    const keys = await addOnKeys(office);

    const res = await api()
      .get(`/api/price-list/add-ons?service=${SEEDED.standard}`)
      .expect(200);
    const forBusiness = await submit(
      guestAsk({ addOns: [keys["Breakroom fridge"]!] }),
    );

    expect(res.body.map((a: { name: string }) => a.name)).toEqual([
      "Inside the oven",
      "Interior windows",
    ]);
    expect(forBusiness.status).toBe(400);
    expect(
      (await getList(office)).addOns
        .filter((a) => a.active)
        .map((a) => [a.name, a.serviceKeys.length]),
    ).toEqual([
      ["Inside the oven", 3],
      ["Interior windows", 4],
      ["Breakroom fridge", 1],
    ]);
    // the form always names the Service
    await api().get("/api/price-list/add-ons").expect(400);
    // and any Service's, by its key
    const commercial = await api()
      .get(`/api/price-list/add-ons?service=${SEEDED.commercial}`)
      .expect(200);
    expect(commercial.body.map((a: { name: string }) => a.name)).toEqual([
      "Interior windows",
      "Breakroom fridge",
    ]);
  });
});

describe("the Suggested Price", () => {
  test("is worked out for each Service offered, before tax and with it", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    await homeRates(office);

    // 2 bedrooms, 1.5 bathrooms, 1 floor, pets: 1 + 1 + 1.125 + 0 + 0.5 = 3.625 h
    const { suggested } = await detailOf(office);

    // standard: 3.625 h rounds up to 3.75 h; x $50 = $187.50, to $188; 8% tax
    expect(priceOf(suggested, "standard")).toMatchObject({
      serviceKey: SEEDED.standard,
      labourHours: 3.75,
      workedOutCents: 18800,
      minimumApplied: false,
      priceCents: 18800,
      taxPercent: 8,
      taxCents: 1504,
      totalCents: 20304,
    });
    // deep: each part takes twice as long, 7.25 h (already a quarter); x $50
    // = $362.50, to $363
    expect(priceOf(suggested, "deep")).toMatchObject({
      serviceKey: SEEDED.deep,
      labourHours: 7.25,
      priceCents: 36300,
      taxCents: 2904,
      totalCents: 39204,
    });
    expect(suggested.priceListVersion).toBe(2);
    // the working is shown: the home's hours by part
    expect(
      priceOf(suggested, "standard").homeHours.map((p) => p.hours),
    ).toEqual([1, 1, 1.125, 0, 0.5]);
  });

  test("adds Add-on hours after the multipliers, never multiplied by them", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    await homeRates(office);
    const oven = (await addOnKeys(office))["Inside the oven"];

    const { suggested } = await detailOf(office, guestAsk({ addOns: [oven!] }));

    // standard: 3.625 + 0.5 = 4.125 h, up to 4.25 h = $212.50, to $213
    expect(priceOf(suggested, "standard").labourHours).toBe(4.25);
    expect(priceOf(suggested, "standard").priceCents).toBe(21300);
    // deep: 3.625 x 2 + 0.5 = 7.75 h, not (3.625 + 0.5) x 2 = 8.25 h
    expect(priceOf(suggested, "deep").labourHours).toBe(7.75);
    expect(priceOf(suggested, "deep").priceCents).toBe(38800);
    expect(priceOf(suggested, "standard").addOns).toEqual([
      expect.objectContaining({ name: "Inside the oven", hours: 0.5 }),
    ]);
  });

  test("doesn't tax a tax-exempt Add-on's share of the price", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    await homeRates(office);
    const carpet = (await addOnKeys(office))["Carpet shampooing"];

    const { suggested } = await detailOf(
      office,
      guestAsk({ addOns: [carpet!] }),
    );

    // 3.625 + 1 = 4.625 h, up to 4.75 h = $237.50, to $238. Carpet's 1 h at
    // $50 is exempt, leaving $188 to tax at 8%: $15.04
    expect(priceOf(suggested, "standard").priceCents).toBe(23800);
    expect(priceOf(suggested, "standard").taxCents).toBe(1504);
    expect(priceOf(suggested, "standard").totalCents).toBe(25304);
  });

  test("is never below the Minimum Charge, and says when it was applied", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    await homeRates(office);

    // a studio with one bathroom, light: (1 + 0 + 0.75) x 0.8 = 1.4 h, up to 1.5 h = $75
    const { suggested } = await detailOf(
      office,
      guestAsk({
        condition: "light",
        property: {
          new: {
            ...home,
            bedrooms: 0,
            bathrooms: 1,
            pets: false,
            storeys: 1,
          },
        },
      }),
    );

    expect(priceOf(suggested, "standard")).toMatchObject({
      labourHours: 1.5,
      workedOutCents: 7500,
      minimumApplied: true,
      priceCents: 10000,
      taxCents: 800,
      totalCents: 10800,
    });
  });

  test("rounds hours up to the quarter-hour exactly, even where decimals wobble", async () => {
    const office = await signInAsOffice();
    // 3 x 0.4 h + 0.55 h is exactly 1.75 h, but 1.7500000000000002 in floating
    // point, which would wrongly round up to 2 h
    await homeRates(office, {
      minimumChargeCents: 0,
      roomHours: {
        ...standardHours,
        baseHours: 0,
        bedroomHours: 0.4,
        bathroomHours: 0.55,
      },
    });

    const { suggested } = await detailOf(
      office,
      guestAsk({
        property: {
          new: { ...home, bedrooms: 3, bathrooms: 1, pets: false, storeys: 1 },
        },
      }),
    );

    // 1.75 h x $50 = $87.50, to $88
    expect(priceOf(suggested, "standard").labourHours).toBe(1.75);
    expect(priceOf(suggested, "standard").priceCents).toBe(8800);
  });

  test("uses the home's current Condition, as the Office corrected it", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    await homeRates(office);
    const detail = await detailOf(office);
    expect(priceOf(detail.suggested, "standard").conditionMultiplier).toBe(1);

    await office
      .patch(`/api/properties/${detail.property.id}`)
      .send({ condition: "heavy" })
      .expect(200);
    const after = (await office.get(`/api/quotes/${detail.id}`).expect(200))
      .body as OfficeQuote;

    // 3.625 x 1.5 = 5.4375 h, up to 5.5 h = $275
    // as asked
    expect(after.asked!.condition).toBe("moderate");
    expect(priceOf(after.suggested, "standard")).toMatchObject({
      conditionMultiplier: 1.5,
      labourHours: 5.5,
      priceCents: 27500,
    });
  });

  test("follows the Price List and Services as they are now, so a change affects new calculations", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    await homeRates(office);
    const before = await detailOf(office);

    await homeRates(office, { hourlyRateCents: 6000 });
    const after = (await office.get(`/api/quotes/${before.id}`).expect(200))
      .body as OfficeQuote;

    expect(priceOf(before.suggested, "standard").priceCents).toBe(18800);
    // 3.75 h x $60 = $225
    expect(priceOf(after.suggested, "standard").priceCents).toBe(22500);
  });

  test("still prices an Add-on that has since been retired", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    await homeRates(office);
    const oven = (await addOnKeys(office))["Inside the oven"];
    const before = await detailOf(office, guestAsk({ addOns: [oven!] }));

    await save(office, { addOns: [] }).expect(200);
    const after = (await office.get(`/api/quotes/${before.id}`).expect(200))
      .body as OfficeQuote;

    expect(after.asked!.addOns).toEqual([
      { key: oven, name: "Inside the oven" },
    ]);
    expect(priceOf(after.suggested, "standard").labourHours).toBe(4.25);
  });
});

describe("Add-ons asked for on a Quote", () => {
  test("are chosen by key from those on offer, and shown to the Office", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    const keys = await addOnKeys(office);

    const detail = await detailOf(
      office,
      guestAsk({
        addOns: [keys["Carpet shampooing"]!, keys["Inside the oven"]!],
      }),
    );

    // in the Price List's order, however they were sent
    expect(detail.asked!.addOns.map((a) => a.name)).toEqual([
      "Inside the oven",
      "Carpet shampooing",
    ]);
  });

  test("can't be ones that aren't on offer", async () => {
    const office = await signInAsOffice();
    await save(office).expect(200);
    const oven = (await addOnKeys(office))["Inside the oven"];
    await save(office, { addOns: [] }).expect(200);

    const retired = await submit(guestAsk({ addOns: [oven!] }));
    const unknown = await submit(
      guestAsk({ addOns: ["00000000-0000-4000-8000-000000000000"] }),
    );

    for (const res of [retired, unknown]) {
      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatchObject({
        path: "addOns.0",
        issue: "Choose from the Add-ons listed",
      });
    }
  });

  test("are optional", async () => {
    const office = await signInAsOffice();

    const detail = await detailOf(office);

    expect(detail.asked!.addOns).toEqual([]);
  });
});

describe("a Quote asked for, in full", () => {
  test("is for Office Staff only", async () => {
    const office = await signInAsOffice();
    const { id } = await detailOf(office);
    const client = await signIn("casey@example.com");

    expect((await api().get(`/api/quotes/${id}`)).status).toBe(401);
    expect((await client.get(`/api/quotes/${id}`)).status).toBe(403);
  });

  test("is not found when there is no such Quote", async () => {
    const office = await signInAsOffice();

    const res = await office.get(
      "/api/quotes/00000000-0000-4000-8000-000000000000",
    );

    expect(res.status).toBe(404);
  });
});
