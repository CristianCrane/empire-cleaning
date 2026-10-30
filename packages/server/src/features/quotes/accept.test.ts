import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import type {
  AcceptOutcome,
  NeedsAttentionItem,
  ClientJob,
  ClientUpcomingJob,
  OfficeClientView,
  OfficeQuote,
  PaymentMethodView,
  QuoteDraftInput,
  QuoteView,
  ScheduleDay,
} from "@empire-cleaning/models";
import { db } from "#db";
import { sendDueReminders } from "#features/jobs";
import { charges } from "#features/payments";
import { FAKE_SIGNATURE } from "../../../tests/fakes/payment-gateway.ts";
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
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "#features/services";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York; Quotes
// here propose 9am on Monday 12 January (14:00 UTC)
const MONDAY = "2026-01-12";
const nextMonday = { date: MONDAY, time: "09:00" };

// Cleaners with 8 hours each on weekdays, or as many as given, so a day has
// room unless a test fills it
const cleaners = async (count = 2, hours = 8) => {
  for (let i = 1; i <= count; i++) {
    const member = await createStaff({
      name: `Cleaner ${i}`,
      email: `cleaner${i}@example.com`,
      roles: ["cleaner"],
    });
    await setUsualWeek(member.id, [hours, hours, hours, hours, hours, 0, 0]);
  }
};

// a Quote a Guest asked for, its first Revision drafted and Sent by the Office
const sentQuote = async (
  office: Agent,
  request = guestAsk(),
  changes: Partial<QuoteDraftInput> = {},
) => {
  const { body } = await submit(request).expect(201);
  const draft = (
    await office.post(`/api/quotes/${body.id}/revisions`).send({}).expect(201)
  ).body as OfficeQuote;
  await office
    .patch(`/api/quotes/${draft.id}/draft`)
    .send({
      addOns: [],
      crewSize: draft.draft!.crewSize,
      depositPercent: draft.draft!.depositPercent,
      validityDays: draft.draft!.validityDays,
      proposedStart: nextMonday,
      overrides: {},
      ...changes,
    })
    .expect(200);
  return (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
    .body as OfficeQuote;
};

// a new Revision of a Sent Quote, with these changes, sent
const revise = async (
  office: Agent,
  quote: OfficeQuote,
  changes: Record<string, unknown>,
) => {
  const draft = (
    await office.post(`/api/quotes/${quote.id}/revisions`).send({}).expect(201)
  ).body as OfficeQuote;
  await office
    .patch(`/api/quotes/${quote.id}/draft`)
    .send({
      addOns: [],
      crewSize: draft.draft!.crewSize,
      depositPercent: draft.draft!.depositPercent,
      validityDays: draft.draft!.validityDays,
      proposedStart: draft.draft!.proposedStart,
      overrides: {},
      ...changes,
    })
    .expect(200);
  return (await office.post(`/api/quotes/${quote.id}/send`).expect(200))
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

// accepts, paying with the saved Payment Method
const accept = (
  client: Agent,
  quote: { id: string },
  service: "deep" | "standard" = "deep",
) =>
  client
    .post(`/api/quotes/mine/${quote.id}/accept`)
    .send({ serviceKey: SEEDED[service] });

// accepts, paying with a card entered just now in the payment form
const payNow = (
  client: Agent,
  quote: { id: string },
  service: "deep" | "standard" = "deep",
) =>
  client.post(`/api/quotes/mine/${quote.id}/accept`).send({
    serviceKey: SEEDED[service],
    paymentToken: testPayments().paymentToken(),
  });

// after the Client's bank asks them to approve the payment
const finalize = (client: Agent, quote: { id: string }) =>
  client.post(`/api/quotes/mine/${quote.id}/accept/finalize`);

// what the provider's webhook would send
const webhook = (event: unknown, signature = FAKE_SIGNATURE) =>
  api()
    .post("/api/payments/webhook")
    .set("content-type", "application/json")
    .set("x-fake-signature", signature)
    .send(JSON.stringify(event));

// the fake's id for the payment waiting on approval, from its secret
const refOf = (outcome: AcceptOutcome) => {
  if (outcome.status !== "needs_approval") throw new Error("not waiting");
  return outcome.secret.replace(/_secret$/, "");
};

const option = (quote: OfficeQuote, service: "deep" | "standard") =>
  quote.offer!.options.find((o) => o.serviceKey === SEEDED[service])!;

const scheduleOn = async (office: Agent, day: string) =>
  (
    (await office.get(`/api/schedule?from=${day}&to=${day}`).expect(200))
      .body as ScheduleDay[]
  )[0]!;

const quoteOf = async (office: Agent, id: string) =>
  (await office.get(`/api/quotes/${id}`).expect(200)).body as OfficeQuote;

const depositCharges = () => db.select().from(charges);

describe("a Client's Payment Method", () => {
  test("is saved from the provider's card form, a new one replacing the last", async () => {
    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    expect(
      (await client.get("/api/payment-methods/mine").expect(200)).body,
    ).toBeNull();

    const form = await client
      .post("/api/payment-methods/mine/card-form")
      .expect(200);
    expect(form.body).toEqual({ form: "test", secret: expect.any(String) });

    // saving it is agreeing to later Charges, which the form says
    expect(await addCard(client)).toEqual({
      label: "Test card ending 4242",
      savedAt: "2026-01-05T09:00:00.000Z",
      consentedAt: "2026-01-05T09:00:00.000Z",
    });
    testClock().advance({ days: 1 });
    await addCard(client);

    expect(
      (await client.get("/api/payment-methods/mine").expect(200)).body,
    ).toMatchObject({ savedAt: "2026-01-06T09:00:00.000Z" });
    expect(testPayments().paymentMethods).toHaveLength(2);
  });

  test("needs a card form the provider set up", async () => {
    await submit(guestAsk()).expect(201);
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
  test("charges the Deposit and books the Job with the Service chosen", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    const standard = option(quote, "standard");

    const accepted = await accept(client, quote, "standard").expect(200);

    expect(accepted.body).toMatchObject({
      status: "accepted",
      quote: {
        status: "accepted",
        acceptedAt: "2026-01-05T09:00:00.000Z",
        acceptedServiceKey: SEEDED.standard,
      } satisfies Partial<QuoteView>,
    });
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
        serviceName: "Standard Clean",
        labourHours: standard.labourHours,
        crewSize: quote.offer!.crewSize,
        client: expect.objectContaining({ name: casey.name }),
      }),
    ]);
    expect(
      (await office.get(`/api/quotes/${quote.id}`).expect(200)).body,
    ).toMatchObject({
      status: "accepted",
      acceptedServiceKey: SEEDED.standard,
    });
  });

  test("takes the latest Sent Revision, not one still being drafted", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const first = await sentQuote(office);
    const revised = await revise(office, first, { crewSize: 1 });
    // a third, drafted but not sent
    await office.post(`/api/quotes/${first.id}/revisions`).send({}).expect(201);
    const client = await signIn(casey.email);
    await addCard(client);

    await accept(client, revised).expect(200);

    const deep = option(revised, "deep");
    expect(testPayments().charges[0]!.amount).toBe(deep.depositCents);
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([
      expect.objectContaining({ crewSize: 1, labourHours: deep.labourHours }),
    ]);
    // the unsent one can never be sent now
    const accepted = await quoteOf(office, first.id);
    expect(accepted).toMatchObject({
      status: "accepted",
      draft: null,
      offer: { number: 2 },
    });
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
      "When: Monday, January 12 at 9:00 AM\nWhere: 41-12 Austin St, 4B, 11375\nService: Deep Clean",
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

  test("closes the Quote: it takes no more Revisions, and the home can be asked about again", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);

    await accept(client, quote).expect(200);

    expect((await quoteOf(office, quote.id)).status).toBe("accepted");
    expect((await office.get("/api/quotes").expect(200)).body).toEqual([]);
    await office.post(`/api/quotes/${quote.id}/revisions`).send({}).expect(409);
    await submit(guestAsk()).expect(201);
  });

  test("shows the home's Job booked on the Client screen", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);

    await accept(client, quote).expect(200);

    const { properties } = (
      await office.get(`/api/clients/${quote.client.id}`).expect(200)
    ).body as OfficeClientView;
    expect(properties.map((p) => p.status)).toEqual([
      { kind: "job_booked", startsAt: "2026-01-12T14:00:00.000Z" },
    ]);
  });

  test("needs the signed-in Client whose Quote it is", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    await submit(
      guestAsk({
        contact: { ...casey, name: "Drew Client", email: "drew@example.com" },
        property: { new: { ...home, street: "7 Queens Blvd" } },
      }),
    ).expect(201);
    const drew = await signIn("drew@example.com");
    await addCard(drew);

    await api()
      .post(`/api/quotes/mine/${quote.id}/accept`)
      .send({ serviceKey: SEEDED.deep })
      .expect(401);
    await accept(drew, quote).expect(404);
    await accept(office, quote).expect(403);
    expect(testPayments().charges).toEqual([]);
  });

  test("needs one of its Services, and a card entered now or saved before", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);

    await client
      .post(`/api/quotes/mine/${quote.id}/accept`)
      .send({ serviceKey: "sparkling" })
      .expect(400);
    const refused = await accept(client, quote).expect(409);
    expect(refused.body.message).toBe("Enter a card to accept this Quote.");
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
    await cleaners(2, 4);
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

  test("charges nothing and books nothing if no crew is free at its time", async () => {
    // 16 hours on Monday, but both Cleaners are at another home from 9 to 10
    await cleaners();
    await bookedJob({ startsAt: "2026-01-12T14:00:00Z", labourHours: 2 });
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    expect(
      (
        (await client.get(`/api/quotes/mine/${quote.id}`).expect(200))
          .body as QuoteView
      ).bookable,
    ).toEqual([]);

    const refused = await accept(client, quote).expect(409);

    expect(refused.body.message).toMatch(/that time has just been booked up/);
    expect(testPayments().charges).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("gives the last free hours to one of two acceptances at once", async () => {
    // room on Monday for one of the two
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const first = await sentQuote(office);
    const second = await sentQuote(
      office,
      guestAsk({
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
    const quote = await sentQuote(office, guestAsk(), {
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

    const newer = await sentQuote(office);
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
    testClock().set(new Date(quote.offer!.expiresAt!));

    const refused = await accept(client, quote).expect(409);

    expect(refused.body.message).toMatch(/^This Quote has expired/);
    expect(testPayments().charges).toEqual([]);
  });
});

describe("paying the Deposit with a card entered just now", () => {
  test("takes the Deposit and saves the card by the same payment", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);

    const accepted = await payNow(client, quote).expect(200);

    expect(accepted.body.status).toBe("accepted");
    const [saved] = testPayments().paymentMethods;
    expect(testPayments().charges).toEqual([
      expect.objectContaining({
        paymentMethodId: saved!.paymentMethodId,
        amount: option(quote, "deep").depositCents,
      }),
    ]);
    // it's their Payment Method now, for the Balance
    expect(
      (await client.get("/api/payment-methods/mine").expect(200)).body,
    ).toEqual({
      label: "Test card ending 4242",
      savedAt: "2026-01-05T09:00:00.000Z",
      consentedAt: "2026-01-05T09:00:00.000Z",
    });
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "You're booked with Empire Cleaning",
    );
  });

  test("doesn't save a declined card", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().failCharges("card_declined");

    await payNow(client, quote).expect(409);

    expect(
      (await client.get("/api/payment-methods/mine").expect(200)).body,
    ).toBeNull();
  });

  test("waits for the bank's approval, then books once it's given", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");

    const waiting = await payNow(client, quote).expect(200);

    expect(waiting.body).toEqual({
      status: "needs_approval",
      secret: expect.any(String),
    });
    // nothing booked or taken while the bank asks
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
    expect(testPayments().charges).toEqual([]);
    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "sent",
    );

    const finalized = await finalize(client, quote).expect(200);

    expect(finalized.body).toMatchObject({
      status: "accepted",
      quote: { status: "accepted", acceptedServiceKey: SEEDED.deep },
    });
    expect(testPayments().charges).toHaveLength(1);
    expect(await depositCharges()).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
    expect(
      (await client.get("/api/payment-methods/mine").expect(200)).body,
    ).toMatchObject({ label: "Test card ending 4242" });
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "You're booked with Empire Cleaning",
    );
    // a second finalize finds it done
    await finalize(client, quote).expect(200);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("books nothing if the bank refuses, or hasn't answered yet", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);

    const early = await finalize(client, quote).expect(409);
    expect(early.body.message).toBe(
      "Your bank hasn't approved the payment yet. Please approve it and try again.",
    );

    testPayments().requireApproval("refused");
    const refused = await finalize(client, quote).expect(409);
    expect(refused.body.message).toBe(
      "Your bank didn't approve the payment, so nothing has been booked. Please try again, or use another card.",
    );
    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "sent",
    );
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
    expect(testPayments().charges).toEqual([]);

    // they can try again
    testPayments().requireApproval(null);
    await payNow(client, quote).expect(200);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("refunds the Deposit if the day filled up while the bank was asking", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });

    const refused = await finalize(client, quote).expect(409);

    expect(refused.body.message).toBe(
      "Sorry, that time was booked up while your bank was approving the payment. We've refunded your Deposit and we'll be in touch with another time.",
    );
    const [charge] = testPayments().charges;
    expect(testPayments().refunds).toEqual([
      expect.objectContaining({
        chargeId: charge!.chargeId,
        amount: charge!.amount,
      }),
    ]);
    expect(await depositCharges()).toEqual([]);
    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "sent",
    );
  });

  test("refunds the Deposit if the Quote was accepted another way meanwhile", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);
    // the Office records it by phone with the saved card
    await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ serviceKey: SEEDED.deep })
      .expect(200);

    await finalize(client, quote).expect(200);

    // two payments taken, the late one given back
    expect(testPayments().charges).toHaveLength(2);
    expect(testPayments().refunds).toEqual([
      expect.objectContaining({
        chargeId: testPayments().charges[1]!.chargeId,
      }),
    ]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("refunds the Deposit if a new Revision was sent while the bank was asking", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);
    await revise(office, quote, { crewSize: 1 });

    const refused = await finalize(client, quote).expect(409);

    expect(refused.body.message).toBe(
      "This Quote was updated while your bank was approving the payment, so we've refunded your Deposit. Please look at the new Quote.",
    );
    expect(testPayments().refunds).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
    expect((await quoteOf(office, quote.id)).status).toBe("sent");
  });

  test("is booked by the provider's webhook if the browser never comes back", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    const waiting = await payNow(client, quote).expect(200);

    await webhook({
      kind: "deposit_succeeded",
      ref: refOf(waiting.body),
    }).expect(200);

    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "accepted",
    );
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
    // the browser coming back later changes nothing
    await finalize(client, quote).expect(200);
    await webhook({
      kind: "deposit_succeeded",
      ref: refOf(waiting.body),
    }).expect(200);
    expect(testPayments().charges).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("refuses a webhook that isn't signed by the provider", async () => {
    await webhook(
      { kind: "deposit_succeeded", ref: "pi_fake_1" },
      "forged",
    ).expect(400);
    await webhook({ kind: "something_else" }).expect(200);
  });
});

describe("when something goes wrong mid-way", () => {
  test("refunds the Deposit if the booking can't be saved after it's taken", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    // the database refuses to record the Charge, after the Deposit is taken
    await db.execute(sql`
      create function refuse_charges() returns trigger language plpgsql as
      $$ begin raise exception 'the database is unwell'; end $$`);
    await db.execute(sql`
      create trigger refuse_charges before insert on charges
      for each row execute function refuse_charges()`);
    try {
      await accept(client, quote).expect(500);
    } finally {
      await db.execute(sql`drop trigger refuse_charges on charges`);
      await db.execute(sql`drop function refuse_charges`);
    }

    const [charge] = testPayments().charges;
    expect(testPayments().refunds).toEqual([
      expect.objectContaining({
        chargeId: charge!.chargeId,
        amount: charge!.amount,
      }),
    ]);
    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "sent",
    );
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
  });

  test("books and takes nothing if the payment provider can't be reached", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().goDown();

    await accept(client, quote).expect(500);
    await office
      .post(`/api/quotes/${quote.id}/accept`)
      .send({ serviceKey: SEEDED.deep })
      .expect(500);

    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "sent",
    );
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
    expect(await depositCharges()).toEqual([]);
    testPayments().goDown(false);
    await accept(client, quote).expect(200);
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
      .send({ serviceKey: SEEDED.deep })
      .expect(200);

    expect(accepted.body).toMatchObject({
      status: "accepted",
      acceptedServiceKey: SEEDED.deep,
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
      .send({ serviceKey: SEEDED.deep })
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
      .send({ serviceKey: SEEDED.deep })
      .expect(409);

    expect(refused.body.message).toBe(
      "The Deposit couldn't be charged to Casey Client's Test card ending 4242 (insufficient_funds), so nothing has been booked.",
    );
  });

  test("can't accept a Draft", async () => {
    const office = await signInAsOffice();
    const { body } = await submit(guestAsk()).expect(201);
    const draft = (
      await office.post(`/api/quotes/${body.id}/revisions`).send({})
    ).body as OfficeQuote;
    await addCard(await signIn(casey.email));

    const refused = await office
      .post(`/api/quotes/${draft.id}/accept`)
      .send({ serviceKey: SEEDED.deep })
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
      .send({ serviceKey: SEEDED.deep })
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
    // room for a crew of 2 at 9am alongside someone else's at 10am
    await cleaners(4);
    const office = await signInAsOffice();
    const later = await sentQuote(office, guestAsk(), {
      proposedStart: { date: "2026-01-20", time: "13:30" },
    });
    const sooner = await sentQuote(
      office,
      guestAsk({ property: { new: { ...home, unit: "5C" } } }),
    );
    // someone else's
    await bookedJob({ startsAt: "2026-01-12T15:00:00Z", labourHours: 2 });
    const client = await signIn(casey.email);
    await addCard(client);
    await accept(client, later, "standard").expect(200);
    await accept(client, sooner).expect(200);

    const jobs = (await client.get("/api/jobs/mine").expect(200))
      .body as ClientUpcomingJob[];

    expect(jobs).toEqual([
      {
        id: expect.any(String),
        startsAt: "2026-01-12T14:00:00.000Z",
        serviceName: "Deep Clean",
        crewSize: 2,
        hoursOnSite: option(sooner, "deep").hoursOnSite,
        property: expect.objectContaining({ unit: "5C" }),
        servicePlanId: null,
        movingTo: null,
      },
      expect.objectContaining({
        startsAt: "2026-01-20T18:30:00.000Z",
        serviceName: "Standard Clean",
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
      "your clean is tomorrow.\n\nWhen: Monday, January 12 at 9:00 AM\nWhere: 41-12 Austin St, 4B, 11375\nService: Deep Clean",
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

describe("when a Quote's day fills up before it's accepted", () => {
  const needsAttention = async (office: Agent) =>
    (await office.get("/api/dashboard/needs-attention").expect(200))
      .body as NeedsAttentionItem[];

  const drewRequest = () =>
    guestAsk({
      contact: { ...casey, name: "Drew Client", email: "drew@example.com" },
      property: { new: { ...home, street: "7 Queens Blvd" } },
    });

  test("the Quote shows which Services still fit, and none once nothing does", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    const ownView = async () =>
      (await client.get(`/api/quotes/mine/${quote.id}`).expect(200))
        .body as QuoteView;
    expect((await ownView()).bookable).toEqual([SEEDED.deep, SEEDED.standard]);

    // room left for exactly the Standard Clean
    const standard = option(quote, "standard").labourHours;
    await bookedJob({
      startsAt: "2026-01-12T19:00:00Z",
      labourHours: 8 - standard,
    });
    expect((await ownView()).bookable).toEqual([SEEDED.standard]);
    expect(
      (
        (await office.get(`/api/quotes/${quote.id}`).expect(200))
          .body as OfficeQuote
      ).bookable,
    ).toEqual([SEEDED.standard]);

    await bookedJob({ startsAt: "2026-01-12T21:00:00Z", labourHours: 0.25 });
    expect((await ownView()).bookable).toEqual([]);

    // a closed Quote can't be booked at all
    await client.post(`/api/quotes/mine/${quote.id}/decline`).expect(200);
    expect((await ownView()).bookable).toEqual([]);
  });

  test("is under Needs attention until the Office sends another time", async () => {
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    testClock().set(new Date("2026-01-06T15:00:00Z"));
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 8 });

    const items = (await needsAttention(office)).filter(
      (i) => i.kind === "quote_no_room",
    );
    expect(items).toEqual([
      {
        kind: "quote_no_room",
        // when the booking that filled the day was made
        since: "2026-01-06T15:00:00.000Z",
        quote: expect.objectContaining({ id: quote.id, status: "sent" }),
      },
    ]);

    // a new Revision for Tuesday replaces it
    const draft = (
      await office
        .post(`/api/quotes/${quote.id}/revisions`)
        .send({})
        .expect(201)
    ).body as OfficeQuote;
    await office
      .patch(`/api/quotes/${draft.id}/draft`)
      .send({
        addOns: [],
        crewSize: draft.draft!.crewSize,
        depositPercent: draft.draft!.depositPercent,
        validityDays: draft.draft!.validityDays,
        proposedStart: { date: "2026-01-13", time: "09:00" },
        overrides: {},
      })
      .expect(200);
    await office.post(`/api/quotes/${draft.id}/send`).expect(200);

    expect(
      (await needsAttention(office)).filter((i) => i.kind === "quote_no_room"),
    ).toEqual([]);
  });

  test("the Office is emailed when a booking crowds out another Quote for that day", async () => {
    // room on Monday for exactly one Deep Clean
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const caseys = await sentQuote(office);
    const drews = await sentQuote(office, drewRequest());
    await bookedJob({
      startsAt: "2026-01-12T19:00:00Z",
      labourHours: 8 - option(drews, "deep").labourHours,
    });
    const drew = await signIn("drew@example.com");
    await addCard(drew);

    await accept(drew, drews).expect(200);

    const notice = testEmail().lastTo("olive@example.com");
    expect(notice.subject).toBe("A Quote needs another time");
    expect(notice.text).toContain("Casey Client: 41-12 Austin St, 4B, 11375");
    expect(notice.text).toContain("/office");
    // and Casey's Quote can't be taken
    expect(
      (
        (await office.get(`/api/quotes/${caseys.id}`).expect(200))
          .body as OfficeQuote
      ).bookable,
    ).toEqual([]);
  });

  test("the Office isn't emailed when the other Quotes for that day still fit", async () => {
    // a crew for each, both at 9am
    await cleaners(4);
    const office = await signInAsOffice();
    await sentQuote(office);
    const drews = await sentQuote(office, drewRequest());
    const drew = await signIn("drew@example.com");
    await addCard(drew);

    await accept(drew, drews).expect(200);

    expect(
      testEmail()
        .to("olive@example.com")
        .filter((m) => m.subject.includes("another time")),
    ).toEqual([]);
  });
});
