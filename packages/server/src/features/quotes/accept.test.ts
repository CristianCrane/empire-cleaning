import { describe, expect, test } from "vitest";
import type {
  ClientJob,
  OfficeQuote,
  PaymentMethodView,
  QuoteDraftInput,
  QuoteRequestDetail,
  QuoteView,
  ScheduleDay,
} from "@empire-cleaning/models";
import { db } from "#db";
import { sendDueReminders } from "#features/jobs";
import { charges } from "#features/payments";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  api,
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import {
  bookedJob,
  casey,
  guestRequest,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York; Quotes
// here propose 9am on Monday 12 January (14:00 UTC)
const MONDAY = "2026-01-12";
const nextMonday = { date: MONDAY, time: "09:00" };

// Cleaners with 8 hours each on weekdays, so a day has room unless a test
// fills it
const cleaners = async (count = 2) => {
  for (let i = 1; i <= count; i++) {
    const member = await createStaff({
      name: `Cleaner ${i}`,
      email: `cleaner${i}@example.com`,
      roles: ["cleaner"],
    });
    await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
  }
};

// a Guest's Quote Request, Quoted and Sent by the Office
const sentQuote = async (
  office: Agent,
  request = guestRequest(),
  changes: Partial<QuoteDraftInput> = {},
) => {
  const { body } = await submit(request).expect(201);
  const draft = (
    await office
      .post("/api/quotes")
      .send({ quoteRequestId: body.id })
      .expect(201)
  ).body as OfficeQuote;
  await office
    .patch(`/api/quotes/${draft.id}`)
    .send({
      addOns: [],
      crewSize: draft.crewSize,
      depositPercent: draft.depositPercent,
      validityDays: draft.validityDays,
      proposedStart: nextMonday,
      overrides: { deep: null, standard: null },
      ...changes,
    })
    .expect(200);
  return (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
    .body as OfficeQuote;
};

// the Client puts a card into the card form and saves it
const addCard = async (client: Agent) => {
  const form = (
    await client.post("/api/payment-methods/mine/card-form").expect(200)
  ).body as { form: string; secret: string };
  return (
    await client
      .put("/api/payment-methods/mine")
      .send({ token: form.secret })
      .expect(200)
  ).body as PaymentMethodView;
};

const accept = (client: Agent, quote: { id: string }, cleanType = "deep") =>
  client.post(`/api/quotes/mine/${quote.id}/accept`).send({ cleanType });

const option = (quote: OfficeQuote, cleanType: string) =>
  quote.options.find((o) => o.cleanType === cleanType)!;

const scheduleOn = async (office: Agent, day: string) =>
  (
    (await office.get(`/api/schedule?from=${day}&to=${day}`).expect(200))
      .body as ScheduleDay[]
  )[0]!;

const requestDetail = async (office: Agent, id: string) =>
  (await office.get(`/api/quote-requests/${id}`).expect(200))
    .body as QuoteRequestDetail;

const depositCharges = () => db.select().from(charges);

describe("a Client's Payment Method", () => {
  test("is saved from the provider's card form, a new one replacing the last", async () => {
    await submit(guestRequest()).expect(201);
    const client = await signIn(casey.email);
    expect(
      (await client.get("/api/payment-methods/mine").expect(200)).body,
    ).toBeNull();

    const form = await client
      .post("/api/payment-methods/mine/card-form")
      .expect(200);
    expect(form.body).toEqual({ form: "test", secret: expect.any(String) });

    expect(await addCard(client)).toEqual({
      label: "Test card ending 4242",
      savedAt: "2026-01-05T09:00:00.000Z",
    });
    testClock().advance({ days: 1 });
    await addCard(client);

    expect(
      (await client.get("/api/payment-methods/mine").expect(200)).body,
    ).toMatchObject({ savedAt: "2026-01-06T09:00:00.000Z" });
    expect(testPayments().paymentMethods).toHaveLength(2);
  });

  test("needs a card form the provider set up", async () => {
    await submit(guestRequest()).expect(201);
    const client = await signIn(casey.email);

    const refused = await client
      .put("/api/payment-methods/mine")
      .send({ token: "made-up" })
      .expect(409);

    expect(refused.body.message).toBe(
      "Your card wasn't set up. Please enter it again.",
    );
    await client.put("/api/payment-methods/mine").send({}).expect(400);
  });

  test("is only the Client's own business", async () => {
    await api().get("/api/payment-methods/mine").expect(401);
    await api().post("/api/payment-methods/mine/card-form").expect(401);
    // Office Staff never handle card details
    const office = await signInAsOffice();
    await office.post("/api/payment-methods/mine/card-form").expect(403);
    await office
      .put("/api/payment-methods/mine")
      .send({ token: "x" })
      .expect(403);
  });
});

describe("accepting a First Clean Quote", () => {
  test("charges the Deposit and books the Job with the Clean Type chosen", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    const standard = option(quote, "standard");

    const accepted = await accept(client, quote, "standard").expect(200);

    expect(accepted.body).toMatchObject({
      status: "accepted",
      acceptedAt: "2026-01-05T09:00:00.000Z",
      acceptedCleanType: "standard",
    } satisfies Partial<QuoteView>);
    expect(testPayments().charges).toEqual([
      expect.objectContaining({
        paymentMethodId: testPayments().paymentMethods[0]!.paymentMethodId,
        amount: standard.depositCents,
        description: expect.stringContaining("Deposit: Standard Clean"),
      }),
    ]);
    expect(await depositCharges()).toEqual([
      expect.objectContaining({
        kind: "deposit",
        amountCents: standard.depositCents,
        gatewayRef: testPayments().charges[0]!.chargeId,
      }),
    ]);

    const monday = await scheduleOn(office, MONDAY);
    expect(monday.jobs).toEqual([
      expect.objectContaining({
        startsAt: "2026-01-12T14:00:00.000Z",
        cleanType: "standard",
        labourHours: standard.labourHours,
        crewSize: quote.crewSize,
        client: expect.objectContaining({ name: casey.name }),
      }),
    ]);
    expect(
      (await office.get(`/api/quotes/${quote.id}`).expect(200)).body,
    ).toMatchObject({ status: "accepted", acceptedCleanType: "standard" });
  });

  test("emails the Client a booking confirmation", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    const deep = option(quote, "deep");

    await accept(client, quote).expect(200);

    const confirmation = testEmail().lastTo(casey.email);
    expect(confirmation.subject).toBe("You're booked with Empire Cleaning");
    expect(confirmation.text).toContain(
      "a Deep Clean at 41-12 Austin St, 4B, 11375 on Monday, January 12",
    );
    expect(confirmation.text).toContain(
      `Deposit of $${(deep.depositCents / 100).toFixed(2)} from your Test card ending 4242`,
    );
    expect(confirmation.text).toContain("http://localhost:5173/portal/details");
  });

  test("still books if the confirmation can't be emailed", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testEmail().failSending();

    await accept(client, quote).expect(200);

    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("closes the request: it takes no more Quotes, and the home can be asked about again", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);

    await accept(client, quote).expect(200);

    expect((await requestDetail(office, quote.quoteRequestId)).state).toBe(
      "booked",
    );
    expect((await office.get("/api/quote-requests").expect(200)).body).toEqual(
      [],
    );
    await office
      .post("/api/quotes")
      .send({ quoteRequestId: quote.quoteRequestId })
      .expect(409);
    await submit(guestRequest()).expect(201);
  });

  test("needs the signed-in Client whose Quote it is", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    await submit(
      guestRequest({
        contact: { ...casey, name: "Drew Client", email: "drew@example.com" },
        property: { new: { ...home, street: "7 Queens Blvd" } },
      }),
    ).expect(201);
    const drew = await signIn("drew@example.com");
    await addCard(drew);

    await api()
      .post(`/api/quotes/mine/${quote.id}/accept`)
      .send({ cleanType: "deep" })
      .expect(401);
    await accept(drew, quote).expect(404);
    await accept(office, quote).expect(403);
    expect(testPayments().charges).toEqual([]);
  });

  test("needs a Clean Type and a saved Payment Method", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);

    await accept(client, quote, "sparkling").expect(400);
    const refused = await accept(client, quote).expect(409);
    expect(refused.body.message).toBe(
      "Add a Payment Method to accept this Quote.",
    );
  });

  test("leaves the Quote Sent and books nothing if the Deposit fails", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().failCharges("card_declined");

    const refused = await accept(client, quote).expect(409);

    expect(refused.body.message).toBe(
      "Your card couldn't be charged, so nothing has been booked. Please try another card.",
    );
    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "sent",
    );
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
    expect(await depositCharges()).toEqual([]);
    expect(
      testEmail()
        .to(casey.email)
        .map((e) => e.subject),
    ).not.toContain("You're booked with Empire Cleaning");

    // with another card it goes through
    testPayments().failCharges(null);
    await addCard(client);
    await accept(client, quote).expect(200);
  });

  test("charges nothing and books nothing if the day has no room left", async () => {
    // 8 hours on Monday, nearly all booked
    await cleaners(1);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);

    const refused = await accept(client, quote).expect(409);

    expect(refused.body.message).toMatch(/that time has just been booked up/);
    expect(testPayments().charges).toEqual([]);
    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "sent",
    );
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("gives the last free hours to one of two acceptances at once", async () => {
    // room on Monday for one of the two
    await cleaners(1);
    const office = await signInAsOffice();
    const first = await sentQuote(office);
    const second = await sentQuote(
      office,
      guestRequest({
        contact: { ...casey, name: "Drew Client", email: "drew@example.com" },
        property: { new: { ...home, street: "7 Queens Blvd" } },
      }),
    );
    expect(option(first, "deep").labourHours).toBeGreaterThan(4);
    const casey_ = await signIn(casey.email);
    const drew = await signIn("drew@example.com");
    await addCard(casey_);
    await addCard(drew);

    const results = await Promise.all([
      accept(casey_, first),
      accept(drew, second),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(testPayments().charges).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("with a 0% Deposit charges nothing now, and still books", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, guestRequest(), {
      depositPercent: 0,
    });
    const client = await signIn(casey.email);
    await addCard(client);

    await accept(client, quote).expect(200);

    expect(testPayments().charges).toEqual([]);
    expect(await depositCharges()).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("is only for a Sent Quote that hasn't Expired", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const declined = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    await client.post(`/api/quotes/mine/${declined.id}/decline`).expect(200);
    expect((await accept(client, declined).expect(409)).body.message).toBe(
      "This Quote was declined, so it can't be accepted.",
    );

    const superseded = await sentQuote(office);
    const newer = (
      await office
        .post("/api/quotes")
        .send({ quoteRequestId: superseded.quoteRequestId })
        .expect(201)
    ).body as OfficeQuote;
    await office
      .patch(`/api/quotes/${newer.id}`)
      .send({
        addOns: [],
        crewSize: 2,
        depositPercent: 25,
        validityDays: 14,
        proposedStart: nextMonday,
        overrides: { deep: null, standard: null },
      })
      .expect(200);
    await office.post(`/api/quotes/${newer.id}/send`).expect(200);
    expect((await accept(client, superseded).expect(409)).body.message).toBe(
      "A newer Quote replaces this one, so it can't be accepted.",
    );

    await accept(client, newer).expect(200);
    expect((await accept(client, newer).expect(409)).body.message).toBe(
      "This Quote has already been accepted.",
    );
    expect(testPayments().charges).toHaveLength(1);
  });

  test("is too late once the Quote has Expired", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testClock().set(new Date(quote.expiresAt!));

    const refused = await accept(client, quote).expect(409);

    expect(refused.body.message).toMatch(/^This Quote has expired/);
    expect(testPayments().charges).toEqual([]);
  });
});

describe("Office Staff recording acceptance on a Client's behalf", () => {
  test("charges the Client's saved Payment Method and books the Job", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    expect(
      (await office.get(`/api/quotes/${quote.id}`).expect(200)).body
        .paymentMethod,
    ).toMatchObject({ label: "Test card ending 4242" });

    const accepted = await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ cleanType: "deep" })
      .expect(200);

    expect(accepted.body).toMatchObject({
      status: "accepted",
      acceptedCleanType: "deep",
    });
    expect(testPayments().charges).toEqual([
      expect.objectContaining({ amount: option(quote, "deep").depositCents }),
    ]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "You're booked with Empire Cleaning",
    );
  });

  test("needs the Client to have added a Payment Method", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    expect(quote.paymentMethod).toBeNull();

    const refused = await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ cleanType: "deep" })
      .expect(409);

    expect(refused.body.message).toBe(
      "Casey Client hasn't added a Payment Method yet. Email them a link to add one.",
    );
  });

  test("tells the Office why a Deposit failed", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    await addCard(await signIn(casey.email));
    testPayments().failCharges("insufficient_funds");

    const refused = await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ cleanType: "deep" })
      .expect(409);

    expect(refused.body.message).toBe(
      "The Deposit couldn't be charged to Casey Client's Test card ending 4242 (insufficient_funds), so nothing has been booked.",
    );
  });

  test("can't accept a Draft", async () => {
    const office = await signInAsOffice();
    const { body } = await submit(guestRequest()).expect(201);
    const draft = (
      await office.post("/api/quotes").send({ quoteRequestId: body.id })
    ).body as OfficeQuote;
    await addCard(await signIn(casey.email));

    const refused = await office
      .post(`/api/quotes/${draft.id}/accept`)
      .send({ cleanType: "deep" })
      .expect(409);
    expect(refused.body.message).toBe(
      "Send the Quote before recording its acceptance.",
    );
  });

  test("is only for Office Staff", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);

    await client
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ cleanType: "deep" })
      .expect(403);
    await client
      .post("/api/payment-methods/requests")
      .send({ clientId: quote.client.id })
      .expect(403);
  });

  test("can email the Client a link to add a Payment Method themselves", async () => {
    const office = await signInAsOffice();
    const quote = await sentQuote(office);

    const sent = await office
      .post("/api/payment-methods/requests")
      .send({ clientId: quote.client.id })
      .expect(200);

    expect(sent.body).toEqual({ sentTo: casey.email });
    const email = testEmail().lastTo(casey.email);
    expect(email.subject).toBe("Add a Payment Method for Empire Cleaning");
    // a plain link, with no sign-in power (ADR-0006)
    expect(email.text).toContain("http://localhost:5173/portal/payment-method");
    expect(email.text).not.toMatch(/token=/);
    await office
      .post("/api/payment-methods/requests")
      .send({ clientId: "7f6b6f5e-35a4-4f43-8f1e-1d2c3b4a5f60" })
      .expect(404);
  });
});

describe("a Client's upcoming Jobs", () => {
  test("are their own booked Jobs still to come, soonest first", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const later = await sentQuote(office, guestRequest(), {
      proposedStart: { date: "2026-01-20", time: "13:30" },
    });
    const sooner = await sentQuote(
      office,
      guestRequest({ property: { new: { ...home, unit: "5C" } } }),
    );
    // someone else's
    await bookedJob({ startsAt: "2026-01-12T15:00:00Z", labourHours: 2 });
    const client = await signIn(casey.email);
    await addCard(client);
    await accept(client, later, "standard").expect(200);
    await accept(client, sooner).expect(200);

    const jobs = (await client.get("/api/jobs/mine").expect(200))
      .body as ClientJob[];

    expect(jobs).toEqual([
      {
        id: expect.any(String),
        startsAt: "2026-01-12T14:00:00.000Z",
        cleanType: "deep",
        crewSize: 2,
        hoursOnSite: option(sooner, "deep").hoursOnSite,
        property: expect.objectContaining({ unit: "5C" }),
      },
      expect.objectContaining({
        startsAt: "2026-01-20T18:30:00.000Z",
        cleanType: "standard",
      }),
    ]);

    testClock().set(new Date("2026-01-12T14:00:00Z"));
    expect(
      ((await client.get("/api/jobs/mine").expect(200)).body as ClientJob[])
        .length,
    ).toBe(1);
    await office.get("/api/jobs/mine").expect(403);
  });
});

describe("the reminder the day before a Job", () => {
  const reminders = () =>
    testEmail()
      .to(casey.email)
      .filter((e) => e.subject === "Your clean is tomorrow");

  const bookedForMonday = async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    await accept(client, quote).expect(200);
  };

  test("goes from 8am New York on the day before, once", async () => {
    await bookedForMonday();

    // Sunday 11 January, 7:59am in New York
    testClock().set(new Date("2026-01-11T12:59:00Z"));
    expect(await sendDueReminders()).toBe(0);

    testClock().set(new Date("2026-01-11T13:00:00Z"));
    expect(await sendDueReminders()).toBe(1);
    expect(await sendDueReminders()).toBe(0);

    const [reminder] = reminders();
    expect(reminder!.text).toContain(
      "your Deep Clean at 41-12 Austin St, 4B, 11375 is tomorrow, Monday, January 12",
    );
    expect(reminder!.text).toContain("http://localhost:5173/portal/details");
  });

  test("isn't sent on the day itself, or two days before", async () => {
    await bookedForMonday();

    testClock().set(new Date("2026-01-10T20:00:00Z"));
    expect(await sendDueReminders()).toBe(0);
    testClock().set(new Date("2026-01-12T13:00:00Z"));
    expect(await sendDueReminders()).toBe(0);
    expect(reminders()).toEqual([]);
  });

  test("isn't sent for a Job booked the day before: its confirmation has just gone", async () => {
    // Sunday 11 January at noon in New York
    testClock().set(new Date("2026-01-11T17:00:00Z"));
    await bookedForMonday();

    expect(await sendDueReminders()).toBe(0);
  });

  test("is tried again next time if the email can't go", async () => {
    await bookedForMonday();
    testClock().set(new Date("2026-01-11T13:00:00Z"));
    testEmail().failSending();

    expect(await sendDueReminders()).toBe(0);
    testEmail().sendNormally();
    expect(await sendDueReminders()).toBe(1);
    expect(reminders()).toHaveLength(1);
  });
});
