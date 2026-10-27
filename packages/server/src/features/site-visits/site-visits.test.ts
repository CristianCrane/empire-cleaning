import { describe, expect, test } from "vitest";
import type {
  CleanerSiteVisits,
  ClientSiteVisit,
  DayCapacity,
  OfficePropertyView,
  OfficeQuote,
  OfficeSiteVisit,
  OpenQuoteRequest,
  QuoteRequestDetail,
  ScheduleDay,
} from "@empire-cleaning/models";
import { createStaff, setUsualWeek } from "#features/staff";
import { api, signIn, testEmail } from "../../../tests/harness.ts";
import {
  bookedJob,
  casey,
  guestRequest,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// The test clock starts at 4am on Monday 5 January 2026 in New York.
// Visits here are on Tuesday the 6th, when Cory (a Cleaner) works 8 hours.
const TUESDAY = "2026-01-06";

const premisesTypes = async () =>
  Object.fromEntries(
    (
      (await api().get("/api/price-list/premises-types").expect(200)).body as {
        key: string;
        name: string;
      }[]
    ).map((t) => [t.name, t.key]),
  );

// Acme Dental asking for cleaning three evenings a week
const businessRequest = async () => {
  const { Office } = await premisesTypes();
  await submit({
    contact: casey,
    businessName: "Acme Dental",
    property: {
      new: {
        kind: "commercial",
        street: "200 Park Ave S",
        unit: "Floor 3",
        postcode: "10003",
        premisesType: Office,
        floorArea: null,
      },
    },
    wantsRegularService: true,
    weekdays: [0, 2, 4],
    preferredTime: "18:00",
  }).expect(201);
  return Office!;
};

const cleaner = async (name: string, week = [8, 8, 8, 8, 8, 0, 0]) => {
  const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
  const member = await createStaff({ name, email, roles: ["cleaner"] });
  await setUsualWeek(member.id, week);
  return { ...member, email };
};

// the Office, Olive (Office Staff only), Cory (a Cleaner), and Acme's request
const setUp = async () => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/staff").expect(200)).body as {
    id: string;
  }[];
  const olive = me[0]!;
  const cory = await cleaner("Cory Cleaner");
  const premisesType = await businessRequest();
  const [request] = (await office.get("/api/quote-requests").expect(200))
    .body as OpenQuoteRequest[];
  return { office, olive, cory, premisesType, request: request! };
};

const book = (
  office: Agent,
  propertyId: string,
  staffId: string,
  time = "10:00",
  changes: object = {},
) =>
  office
    .post("/api/site-visits")
    .send({ propertyId, staffId, date: TUESDAY, time, ...changes });

const scheduleDay = async (office: Agent, date = TUESDAY) => {
  const [day] = (
    await office.get(`/api/schedule?from=${date}&to=${date}`).expect(200)
  ).body as ScheduleDay[];
  return day!;
};

const requestOf = async (office: Agent, id: string) =>
  (await office.get(`/api/quote-requests/${id}`).expect(200))
    .body as QuoteRequestDetail;

describe("booking a Site Visit", () => {
  test("books one Staff member for 30 minutes, emails the Client and shows on the request, the Schedule and the portal", async () => {
    const { office, olive, request } = await setUp();
    expect((await requestOf(office, request.id)).siteVisit).toBe("needed");

    const res = await book(office, request.propertyId, olive.id);

    expect(res.status).toBe(201);
    const visit = res.body as OfficeSiteVisit;
    expect(visit).toMatchObject({
      status: "booked",
      startsAt: "2026-01-06T15:00:00.000Z",
      minutes: 30,
      visitor: { id: olive.id, name: "Olive Owner" },
      client: { businessName: "Acme Dental" },
      property: { kind: "commercial", street: "200 Park Ave S" },
    });
    const sent = testEmail().lastTo(casey.email);
    expect(sent.subject).toBe("Your Site Visit is booked");
    expect(sent.text).toContain("Tuesday, January 6 at 10:00 AM");
    expect(sent.text).toContain("Olive from Empire Cleaning");
    expect(sent.text).toContain("There's no charge");

    const detail = await requestOf(office, request.id);
    expect(detail.siteVisit).toBe("booked");
    expect(detail.bookedSiteVisit?.id).toBe(visit.id);
    const [listed] = (await office.get("/api/quote-requests").expect(200))
      .body as OpenQuoteRequest[];
    expect(listed!.siteVisit).toBe("booked");

    const day = await scheduleDay(office);
    expect(day.siteVisits).toMatchObject([
      { id: visit.id, takesRoom: false, visitor: { name: "Olive Owner" } },
    ]);

    const asCasey = await signIn(casey.email);
    const mine = (await asCasey.get("/api/site-visits/mine").expect(200))
      .body as ClientSiteVisit[];
    expect(mine).toEqual([
      {
        id: visit.id,
        startsAt: "2026-01-06T15:00:00.000Z",
        minutes: 30,
        property: {
          id: request.propertyId,
          street: "200 Park Ave S",
          unit: "Floor 3",
          postcode: "10003",
        },
        visitorName: "Olive",
      },
    ]);
  });

  test("by a Cleaner takes room like a one-person Job, its length as its Labour Hours", async () => {
    const { office, cory, request } = await setUp();

    await book(office, request.propertyId, cory.id, "09:00", {
      minutes: 90,
    }).expect(201);

    const day = await scheduleDay(office);
    expect(day).toMatchObject({
      staffHours: 8,
      bookedHours: 1.5,
      freeHours: 6.5,
      siteVisits: [{ takesRoom: true, minutes: 90 }],
    });
    // Cory is the only Cleaner, so no crew is free for a Job then
    const room = (
      await office
        .get(
          `/api/schedule/capacity?date=${TUESDAY}&time=10:00&labourHours=1&crewSize=1`,
        )
        .expect(200)
    ).body as DayCapacity;
    expect(room).toMatchObject({ hasHours: true, hasCrew: false });
  });

  test("by a Cleaner is refused where the day has no room, or they have no hours", async () => {
    const { office, cory, request } = await setUp();
    await bookedJob({
      startsAt: "2026-01-06T14:00:00Z",
      labourHours: 8,
      crewSize: 1,
    });

    const full = await book(office, request.propertyId, cory.id, "15:00");
    expect(full.status).toBe(409);
    expect(full.body.message).toContain("doesn't have room");

    // Saturday is a day off for Cory, who isn't Office Staff
    const dayOff = await book(office, request.propertyId, cory.id, "10:00", {
      date: "2026-01-10",
    });
    expect(dayOff.status).toBe(409);
    expect(dayOff.body.message).toBe(
      "Cory Cleaner has no Available Hours that day, so they can't make a Site Visit then.",
    );
  });

  test("by Office Staff takes no room, and is refused only over their other Site Visits", async () => {
    const { office, olive, request } = await setUp();
    // a full day: Office Staff still visit
    await bookedJob({ startsAt: "2026-01-06T14:00:00Z", labourHours: 8 });
    await book(office, request.propertyId, olive.id, "10:00").expect(201);

    // another business, at a time overlapping Olive's visit
    await submit(
      guestRequest({ contact: { ...casey, email: "zed@example.com" } }),
    ).expect(201);
    const requests = (await office.get("/api/quote-requests").expect(200))
      .body as OpenQuoteRequest[];
    const home = requests.find((r) => r.property.kind === "residential")!;
    const clash = await book(office, home.propertyId, olive.id, "10:15");
    expect(clash.status).toBe(409);
    expect(clash.body.message).toBe(
      "Olive Owner has another Site Visit then, at 10:00 AM.",
    );
    await book(office, home.propertyId, olive.id, "10:30").expect(201);
    expect((await requestOf(office, home.id)).siteVisit).toBe("booked");
  });

  test("allows one booked at a time per Property, in the future, for 15 minutes to 8 hours", async () => {
    const { office, olive, request } = await setUp();
    await book(office, request.propertyId, olive.id).expect(201);

    const again = await book(office, request.propertyId, olive.id, "14:00");
    expect(again.status).toBe(409);

    const past = await office.post("/api/site-visits").send({
      propertyId: request.propertyId,
      staffId: olive.id,
      date: "2026-01-02",
      time: "10:00",
    });
    expect(past.status).toBe(409);

    const odd = await book(office, request.propertyId, olive.id, "14:00", {
      minutes: 20,
    });
    expect(odd.status).toBe(400);
    expect(odd.body.details[0].issue).toBe(
      "Use quarter hours, like 30 or 45 minutes",
    );
  });

  test("is for Office Staff only", async () => {
    const { request, olive } = await setUp();
    const asCasey = await signIn(casey.email);
    await book(asCasey, request.propertyId, olive.id).expect(403);
  });
});

describe("moving and cancelling a Site Visit", () => {
  test("moves it to a new time, emailing the Client; it doesn't stand in its own way", async () => {
    const { office, cory, request } = await setUp();
    // 7.5 of Cory's 8 hours booked, and his visit takes the rest
    await bookedJob({
      startsAt: "2026-01-06T13:00:00Z",
      labourHours: 7.5,
      crewSize: 1,
    });
    const visit = (
      await book(office, request.propertyId, cory.id, "16:00").expect(201)
    ).body as OfficeSiteVisit;

    const moved = await office
      .post(`/api/site-visits/${visit.id}/move`)
      .send({ date: TUESDAY, time: "16:30", staffId: cory.id, minutes: 30 });

    expect(moved.status).toBe(200);
    expect(moved.body.startsAt).toBe("2026-01-06T21:30:00.000Z");
    const sent = testEmail().lastTo(casey.email);
    expect(sent.subject).toBe("Your Site Visit has moved");
    expect(sent.text).toContain(
      "from Tuesday, January 6 at 4:00 PM to Tuesday, January 6 at 4:30 PM",
    );

    // but it can't grow past the day's hours
    const longer = await office
      .post(`/api/site-visits/${visit.id}/move`)
      .send({ date: TUESDAY, time: "16:30", staffId: cory.id, minutes: 60 });
    expect(longer.status).toBe(409);
  });

  test("cancels it, emailing the Client; it leaves the Schedule and the request needs one again", async () => {
    const { office, olive, request } = await setUp();
    const visit = (await book(office, request.propertyId, olive.id).expect(201))
      .body as OfficeSiteVisit;

    const res = await office.post(`/api/site-visits/${visit.id}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "Your Site Visit is cancelled",
    );
    expect((await scheduleDay(office)).siteVisits).toEqual([]);
    expect((await requestOf(office, request.id)).siteVisit).toBe("needed");
    await office.post(`/api/site-visits/${visit.id}/cancel`).expect(409);
  });
});

describe("Site Visit findings", () => {
  const draftQuote = async (office: Agent, quoteRequestId: string) => {
    const { body } = await office
      .post("/api/quotes")
      .send({ quoteRequestId })
      .expect(201);
    const quote = body as OfficeQuote;
    await office
      .patch(`/api/quotes/${quote.id}`)
      .send({
        addOns: [],
        crewSize: quote.crewSize,
        depositPercent: quote.depositPercent,
        validityDays: quote.validityDays,
        proposedStart: { date: "2026-01-12", time: "18:00" },
        overrides: { deep: null, standard: null },
      })
      .expect(200);
    return quote.id;
  };

  test("update the premises' details and mark the visit Done; only then can a Quote be Sent", async () => {
    const { office, olive, request, premisesType } = await setUp();
    const visit = (await book(office, request.propertyId, olive.id).expect(201))
      .body as OfficeSiteVisit;
    const quoteId = await draftQuote(office, request.id);
    const draft = (await office.get(`/api/quotes/${quoteId}`).expect(200))
      .body as OfficeQuote;
    expect(draft.needsSiteVisit).toBe(true);
    const early = await office.post(`/api/quotes/${quoteId}/send`);
    expect(early.status).toBe(409);
    expect(early.body.message).toContain("haven't had a Site Visit");

    const res = await office
      .post(`/api/site-visits/${visit.id}/findings`)
      .send({
        premisesType,
        floorArea: 4500,
        condition: "heavy",
        officeNotes: "Two treatment rooms need extra care",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "done",
      property: { floorArea: 4500, condition: "heavy" },
      officeNotes: "Two treatment rooms need extra care",
    });
    const home = (
      await office.get(`/api/properties/${request.propertyId}`).expect(200)
    ).body as OfficePropertyView;
    expect(home).toMatchObject({
      findingsRecorded: true,
      officeNotes: "Two treatment rooms need extra care",
      siteVisits: [{ id: visit.id, status: "done" }],
    });
    expect((await requestOf(office, request.id)).siteVisit).toBeNull();
    // the Quote prices from the details found on its next save
    await office.patch(`/api/quotes/${quoteId}`).send({
      addOns: [],
      crewSize: draft.crewSize,
      depositPercent: draft.depositPercent,
      validityDays: draft.validityDays,
      proposedStart: { date: "2026-01-12", time: "18:00" },
      overrides: { deep: null, standard: null },
    });
    await office.post(`/api/quotes/${quoteId}/send`).expect(200);
    // a Done visit stays as it was
    await office
      .post(`/api/site-visits/${visit.id}/findings`)
      .send({ premisesType, floorArea: 4500, condition: "light" })
      .expect(409);
  });

  test("need the floor area and Condition of business premises", async () => {
    const { office, olive, request, premisesType } = await setUp();
    const visit = (await book(office, request.propertyId, olive.id).expect(201))
      .body as OfficeSiteVisit;

    const res = await office
      .post(`/api/site-visits/${visit.id}/findings`)
      .send({ premisesType });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path)).toEqual([
      "floorArea",
      "condition",
    ]);
  });

  test("of a home record its rooms and Condition", async () => {
    const office = await signInAsOffice();
    const [olive] = (await office.get("/api/staff").expect(200)).body as {
      id: string;
    }[];
    await submit(guestRequest()).expect(201);
    const [request] = (await office.get("/api/quote-requests").expect(200))
      .body as OpenQuoteRequest[];
    // a home needs none, but may have one
    expect(request!.siteVisit).toBeNull();
    const visit = (
      await book(office, request!.propertyId, olive!.id).expect(201)
    ).body as OfficeSiteVisit;

    const res = await office
      .post(`/api/site-visits/${visit.id}/findings`)
      .send({
        type: "house",
        bedrooms: 3,
        bathrooms: 2,
        storeys: 2,
        pets: false,
        floorArea: null,
        condition: "light",
      });

    expect(res.status).toBe(200);
    expect(res.body.property).toMatchObject({
      kind: "residential",
      type: "house",
      bedrooms: 3,
      condition: "light",
    });
  });

  test("can be recorded with no visit booked, for premises the Office knows", async () => {
    const { office, olive, request, premisesType } = await setUp();
    const findings = { premisesType, floorArea: 3000, condition: "moderate" };

    const res = await office
      .post(`/api/properties/${request.propertyId}/findings`)
      .send(findings);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: "done",
      startsAt: null,
      visitor: null,
      property: { floorArea: 3000, condition: "moderate" },
    });
    expect((await requestOf(office, request.id)).findingsRecorded).toBe(true);
    expect(testEmail().to(casey.email)).toHaveLength(1); // the receipt only

    // with one booked, they're recorded there
    await book(office, request.propertyId, olive.id).expect(201);
    await office
      .post(`/api/properties/${request.propertyId}/findings`)
      .send(findings)
      .expect(409);
  });
});

describe("a Cleaner's own Site Visits", () => {
  test("show in their day", async () => {
    const { office, cory, request } = await setUp();
    await book(office, request.propertyId, cory.id, "09:00", {
      date: "2026-01-05",
    }).expect(201);

    const asCory = await signIn(cory.email);
    const mine = (await asCory.get("/api/site-visits/visiting").expect(200))
      .body as CleanerSiteVisits;

    expect(mine.upcoming).toEqual([]);
    expect(mine.today).toMatchObject([
      {
        startsAt: "2026-01-05T14:00:00.000Z",
        minutes: 30,
        client: { businessName: "Acme Dental", phone: casey.phone },
        property: { street: "200 Park Ave S" },
      },
    ]);
  });
});
