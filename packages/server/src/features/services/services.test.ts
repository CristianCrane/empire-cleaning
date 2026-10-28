import { describe, expect, test } from "vitest";
import type {
  OfficeQuote,
  Service,
  ServiceInput,
} from "@empire-cleaning/models";
import { api, signIn } from "../../../tests/harness.ts";
import {
  guestAsk,
  setService,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "./services.ts";

type Office = Awaited<ReturnType<typeof signInAsOffice>>;

const painting: ServiceInput = {
  name: "Painting",
  description: "Walls and ceilings, inside.",
  offeredFor: "both",
  method: "area",
  roomHours: null,
  hoursPerThousandSqFt: 6,
  hourlyRateCents: 7000,
  minimumChargeCents: 30000,
  taxOneOffPercent: 0,
  taxPlanPercent: null,
  conditionApplies: false,
  canRecur: false,
  needsSiteVisit: true,
  firstVisitServiceKey: null,
  active: true,
};

const list = async (office: Office) =>
  (await office.get("/api/services").expect(200)).body as Service[];

const issuesOf = (body: { details: { path: string; issue: string }[] }) =>
  Object.fromEntries(body.details.map((d) => [d.path, d.issue]));

// what the Office sees for a Quote asked for
const askedQuote = async (office: Office) => {
  const { body } = await submit(guestAsk()).expect(201);
  return (await office.get(`/api/quotes/${body.id}`).expect(200))
    .body as OfficeQuote;
};

describe("Services", () => {
  test("start as Standard, Deep and Move-in/out for homes, and commercial cleaning by area", async () => {
    const office = await signInAsOffice();

    const services = await list(office);

    expect(
      services.map((s) => [s.name, s.offeredFor, s.method, s.active]),
    ).toEqual([
      ["Standard Clean", "homes", "rooms", true],
      ["Deep Clean", "homes", "rooms", true],
      ["Move-in/out Clean", "homes", "rooms", true],
      ["Commercial cleaning", "businesses", "area", true],
    ]);
    expect(services[0]).toMatchObject({
      key: SEEDED.standard,
      roomHours: {
        baseHours: 1,
        bedroomHours: 0.5,
        bathroomHours: 0.75,
        extraStoreyHours: 0.5,
        petHours: 0.5,
      },
      hourlyRateCents: 5500,
      minimumChargeCents: 10000,
      taxOneOffPercent: 8.875,
      taxPlanPercent: 8.875,
      canRecur: true,
      needsSiteVisit: false,
      firstVisitServiceKey: SEEDED.deep,
    });
    expect(services[2]).toMatchObject({
      canRecur: false,
      taxPlanPercent: null,
    });
    expect(services[3]).toMatchObject({
      hoursPerThousandSqFt: 0.5,
      roomHours: null,
      needsSiteVisit: true,
    });
  });

  test("are only for Office Staff to read and change", async () => {
    const client = await signIn("casey@example.com");

    expect((await api().get("/api/services")).status).toBe(401);
    expect((await client.get("/api/services")).status).toBe(403);
    expect((await client.post("/api/services").send(painting)).status).toBe(
      403,
    );
  });

  test("can be added, at the end of the list", async () => {
    const office = await signInAsOffice();

    const added = (
      await office.post("/api/services").send(painting).expect(201)
    ).body as Service;

    expect(added).toMatchObject({
      ...painting,
      key: expect.any(String),
      createdByName: "Olive Owner",
    });
    expect((await list(office)).map((s) => s.name).at(-1)).toBe("Painting");
  });

  test("every save is a new version with the same key, keeping its place", async () => {
    const office = await signInAsOffice();
    const before = (await list(office))[1]!;

    const roomHours = { ...before.roomHours!, bathroomHours: 1.5 };
    const saved = await setService(office, "deep", { roomHours });

    expect(saved).toMatchObject({ key: before.key, roomHours });
    expect(saved.id).not.toBe(before.id);
    expect(saved.version).toBeGreaterThan(before.version);
    expect((await list(office)).map((s) => s.name)[1]).toBe("Deep Clean");
  });

  test("are retired rather than deleted, and still listed", async () => {
    const office = await signInAsOffice();

    await setService(office, "moveInOut", { active: false });

    expect(
      (await list(office)).find((s) => s.key === SEEDED.moveInOut),
    ).toMatchObject({ active: false, name: "Move-in/out Clean" });
  });

  test("explain what's wrong, field by field", async () => {
    const office = await signInAsOffice();

    const res = await office.post("/api/services").send({
      ...painting,
      name: "",
      method: "rooms",
      roomHours: null,
      canRecur: true,
      taxPlanPercent: null,
      hourlyRateCents: 0,
    });

    expect(res.status).toBe(400);
    expect(issuesOf(res.body)).toMatchObject({
      name: "Name the Service",
      hourlyRateCents: "The hourly rate must be at least $1",
      roomHours: "Enter how long each part of a home takes",
      offeredFor: "Price it by area to offer it for business premises",
      taxPlanPercent: "Enter a tax rate",
    });
  });

  test("keep only their own method's figure, and a plan rate only if they can recur", async () => {
    const office = await signInAsOffice();

    const added = (
      await office
        .post("/api/services")
        .send({
          ...painting,
          roomHours: {
            baseHours: 1,
            bedroomHours: 1,
            bathroomHours: 1,
            extraStoreyHours: 1,
            petHours: 1,
          },
          taxPlanPercent: 8,
        })
        .expect(201)
    ).body as Service;

    expect(added).toMatchObject({ roomHours: null, taxPlanPercent: null });
  });

  test("won't have two live Services with the same name, or recommend themselves or a stranger", async () => {
    const office = await signInAsOffice();

    const twice = await office
      .post("/api/services")
      .send({ ...painting, name: "deep clean" });
    const unknown = await office.post("/api/services").send({
      ...painting,
      firstVisitServiceKey: "00000000-0000-4000-8000-000000000000",
    });
    const deep = (await list(office))[1]!;
    const itself = await office
      .put(`/api/services/${deep.key}`)
      .send({ ...painting, name: deep.name, firstVisitServiceKey: deep.key });

    expect(issuesOf(twice.body)).toEqual({
      name: "Another Service already has this name",
    });
    expect(issuesOf(unknown.body)).toEqual({
      firstVisitServiceKey: "Choose from the Services listed",
    });
    expect(issuesOf(itself.body)).toEqual({
      firstVisitServiceKey: "Recommend a different Service, or none",
    });
  });

  test("aren't found when there is no such Service", async () => {
    const office = await signInAsOffice();

    const missing = "00000000-0000-4000-8000-000000000000";

    expect((await office.get(`/api/services/${missing}`)).status).toBe(404);
    expect(
      (await office.put(`/api/services/${missing}`).send(painting)).status,
    ).toBe(404);
  });
});

describe("the Suggested Price, from Services", () => {
  test("is each Clean Type's Service's own hours, rate and tax", async () => {
    const office = await signInAsOffice();
    await setService(office, "standard", {
      hourlyRateCents: 4000,
      taxOneOffPercent: 5,
    });
    await setService(office, "deep", {
      roomHours: {
        baseHours: 2,
        bedroomHours: 1,
        bathroomHours: 1.5,
        extraStoreyHours: 1,
        petHours: 1,
      },
    });

    const { suggested } = await askedQuote(office);

    // the placeholder home: 1 + 2 x 0.5 + 1.5 x 0.75 + 0 + 0.5 = 3.625 h,
    // up to 3.75 h; x $40 = $150, taxed at 5%
    expect(suggested.standard).toMatchObject({
      serviceName: "Standard Clean",
      labourHours: 3.75,
      priceCents: 15000,
      taxPercent: 5,
    });
    // its own hours, each twice as long: 7.25 h, at its own $55 and 8.875%
    expect(suggested.deep).toMatchObject({
      serviceName: "Deep Clean",
      labourHours: 7.25,
      hourlyRateCents: 5500,
      taxPercent: 8.875,
    });
  });
});
