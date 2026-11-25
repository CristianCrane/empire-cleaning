import {
  clientPaying as clientPayingWords,
  depositAlertOf,
  formats,
} from "@empire-cleaning/models";
import { describe, expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";
import type {
  AcceptOutcome,
  NeedsAttentionItem,
  ClientJob,
  ClientUpcomingJob,
  OfficeClientView,
  OfficePropertyView,
  OfficeQuote,
  PaymentMethodView,
  QuoteDraftInput,
  QuoteView,
  ScheduleDay,
} from "@empire-cleaning/models";
import { db } from "#db";
import { sendDueReminders } from "#features/jobs";
import { charges, settleOpenPayments } from "#features/payments";
import { FAKE_SIGNATURE } from "../../../tests/fakes/payment-gateway.ts";
import { createStaff, deactivateStaff, setUsualWeek } from "#features/staff";
import {
  type Agent,
  api,
  signIn,
  testClock,
  testEmail,
  testMonitoring,
  testPayments,
} from "../../../tests/harness.ts";
import {
  billWeekly,
  bookedJob,
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
  staffMember,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "#features/services";

const { formatMoney } = formats.en;

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

// accepts the offer as last seen, paying with the saved Payment Method
const accept = (
  client: Agent,
  quote: Pick<OfficeQuote, "id" | "offer">,
  service: "deep" | "standard" = "deep",
) =>
  client
    .post(`/api/quotes/mine/${quote.id}/accept`)
    .send({ serviceKey: SEEDED[service], revisionId: quote.offer!.id });

// accepts, paying with a card entered just now in the payment form
const payNow = (
  client: Agent,
  quote: Pick<OfficeQuote, "id" | "offer">,
  service: "deep" | "standard" = "deep",
) =>
  client.post(`/api/quotes/mine/${quote.id}/accept`).send({
    serviceKey: SEEDED[service],
    revisionId: quote.offer!.id,
    paymentToken: testPayments().paymentToken(),
  });

// after the Client's bank asks them to approve the payment
const finalize = (client: Agent, quote: { id: string }) =>
  client.post(`/api/quotes/mine/${quote.id}/accept/finalize`);

// the Client says no
const decline = (client: Agent, quote: { id: string }) =>
  client.post(`/api/quotes/mine/${quote.id}/decline`);

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

// what the Client's Quote page says of their Deposit payment there, which a
// press answers in the same words (#534's UX design, Screen 1d)
const pageSays = async (client: Agent, quote: { id: string }) =>
  depositAlertOf(
    "en",
    (await client.get(`/api/quotes/mine/${quote.id}`).expect(200))
      .body as QuoteView,
  )?.text;

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

  test("of a Revision that's no longer the offer is refused, and nothing is charged", async () => {
    await cleaners();
    const office = await signInAsOffice();
    // Casey's page shows Revision 1, then the Office sends Revision 2
    const seen = await sentQuote(office);
    await revise(office, seen, { crewSize: 1 });
    const client = await signIn(casey.email);
    await addCard(client);

    const refused = await accept(client, seen).expect(409);

    expect(refused.body.message).toBe(
      "This quote was just updated, so nothing was booked. Please reload the page to see it.",
    );
    expect(testPayments().charges).toEqual([]);
    expect((await quoteOf(office, seen.id)).status).toBe("sent");
    // the Office recording it from a stale screen is refused too
    expect(
      (
        await office
          .post(`/api/quotes/${seen.id}/accept`)
          .send({ serviceKey: SEEDED.deep, revisionId: seen.offer!.id })
          .expect(409)
      ).body.message,
    ).toBe(
      "This quote was just updated, so nothing was booked. Please reload the page to see it.",
    );
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
      "When: Monday, January 12 at 9:00\u00a0AM\nWhere: 41-12 Austin St, 4B, 11375\nService: Deep Clean",
    );
    expect(confirmation.text).toContain(
      `deposit of $${(deep.depositCents / 100).toFixed(2)} from your Test card ending 4242`,
    );
    expect(confirmation.text).toContain("http://localhost:5173/portal/details");
  });

  test("tells a Client billed weekly that the rest goes on the week's Bill (#244 #5)", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    const view = async () =>
      (await client.get(`/api/quotes/mine/${quote.id}`).expect(200))
        .body as QuoteView;
    expect((await view()).weeklyBill).toBeNull();
    await billWeekly("on_page");
    expect((await view()).weeklyBill).toBe("on_page");
    const deep = option(quote, "deep");

    await accept(client, quote).expect(200);

    const confirmation = testEmail().lastTo(casey.email);
    expect(confirmation.subject).toBe("You're booked with Empire Cleaning");
    expect(confirmation.text).not.toContain("when the clean is done");
    expect(confirmation.text).toContain(
      `The rest, ${formatMoney(deep.totalCents - deep.depositCents)}, goes on your bill for that week, made the following Monday, which you pay on its page by its due date.`,
    );
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

  test("leads the home's history with the Service booked, not the one asked for", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    expect(quote.service.name).toBe("Standard Clean");

    await accept(client, quote, "deep").expect(200);

    const { quotes } = (
      await office.get(`/api/properties/${quote.property.id}`).expect(200)
    ).body as OfficePropertyView;
    expect(
      quotes.map((q) => [q.headlineServiceName, q.headlineTotalCents]),
    ).toEqual([["Deep Clean", option(quote, "deep").totalCents]]);
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
      .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.deep })
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
      .send({ revisionId: quote.offer!.id, serviceKey: "sparkling" })
      .expect(400);
    const refused = await accept(client, quote).expect(409);
    expect(refused.body.message).toBe("Add a card to accept this quote.");
    // in the language the Client's screen is showing (ADR-0025)
    const enSpanish = await accept(client, quote)
      .set("Accept-Language", "es")
      .expect(409);
    expect(enSpanish.body.message).toBe(
      "Agregue una tarjeta para aceptar esta cotización.",
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
      "Your payment didn't go through. Please try again, or use another card.",
    );
    expect(await pageSays(client, quote)).toBe(refused.body.message);
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

    expect(refused.body.message).toMatch(/that time just got booked up/);
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

    expect(refused.body.message).toMatch(/that time just got booked up/);
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

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
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
    await decline(client, declined).expect(200);
    expect((await accept(client, declined).expect(409)).body.message).toBe(
      "This quote was declined. Ask us for a new one.",
    );

    const newer = await sentQuote(office);
    await accept(client, newer).expect(200);
    expect((await accept(client, newer).expect(409)).body.message).toBe(
      "This quote has already been accepted.",
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

    expect(refused.body.message).toMatch(/^This quote has expired/);
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

    const early = await finalize(client, quote).expect(200);
    // they may have closed the bank's pop-up: pressing again starts over
    expect(early.body.status).toBe("waiting");
    // by when, for which Service: called off 15 minutes from the press
    const until = formats.en.formatTime("2026-01-05T09:15:00.000Z");
    // which the page says, its alert answering the press
    expect(await pageSays(client, quote)).toBe(
      `Your bank hasn't approved your payment yet. Approve it in your bank's app by ${until} to book your Deep Clean, or press Accept and pay to start over: you're only charged once.`,
    );

    testPayments().requireApproval("refused");
    const refused = await finalize(client, quote).expect(409);
    expect(refused.body.message).toBe(
      "Your payment wasn't approved, so nothing was taken. Please try again, or use another card.",
    );
    expect(await pageSays(client, quote)).toBe(refused.body.message);
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

  // a 0% Deposit only saves a card, but a refused one left open could still
  // be confirmed with the secret the browser holds (#534 plan review F1)
  test("a 0% Deposit their bank refused is called off", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, guestAsk(), { depositPercent: 0 });
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);

    testPayments().requireApproval("refused");
    const refused = await finalize(client, quote).expect(409);

    expect([...testPayments().canceled]).toEqual([
      expect.stringMatching(/^seti_/),
    ]);
    // a card, not a payment: nothing was to be taken
    expect(refused.body.message).toBe(
      "Your card wasn't approved, so nothing was booked. Please try again, or use another card.",
    );
    expect(await pageSays(client, quote)).toBe(refused.body.message);
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
      "Sorry, that time got booked up while your bank was approving the payment. We've refunded your deposit. We'll send you a new quote for another time.",
    );
    expect(await pageSays(client, quote)).toBe(refused.body.message);
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
    // their record of it, wherever they are
    const email = testEmail().lastTo(casey.email);
    expect(email.subject).toBe("We've refunded your deposit");
    expect(email.text).toContain(
      "that time got booked up while your bank was approving the payment.",
    );
    expect(email.text).toContain(
      `We've refunded your ${formatMoney(charge!.amount)} deposit to your Test card ending 4242. It can take a few days to reach you.`,
    );
    // and the Office sees it, on the phone with them
    expect((await quoteOf(office, quote.id)).unbookedPayments).toEqual([
      {
        amountCents: charge!.amount,
        endedAt: "2026-01-05T09:00:00.000Z",
        why: "no_room",
      },
    ]);
  });

  test("refunds the Deposit if the Quote expired while the bank was asking", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);
    testClock().set(new Date(quote.offer!.expiresAt!));

    const refused = await finalize(client, quote).expect(409);

    // how it closed: it expired
    expect(refused.body.message).toBe(
      "This quote expired while your bank was approving the payment, so we've refunded your deposit.",
    );
    expect(await pageSays(client, quote)).toBe(refused.body.message);
    expect(testPayments().refunds).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
    expect((await quoteOf(office, quote.id)).status).toBe("expired");
    expect(testEmail().lastTo(casey.email).text).toContain(
      "your quote closed while your bank was approving the payment.",
    );
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

// Office Staff record the Client's acceptance, charging their saved card
const recordAccepted = (
  office: Agent,
  quote: Pick<OfficeQuote, "id" | "offer">,
  service: "deep" | "standard" = "deep",
) =>
  office
    .post(`/api/quotes/${quote.id}/accept`)
    .send({ revisionId: quote.offer!.id, serviceKey: SEEDED[service] });

// the Office's line while the Client's bank approves the Deep Clean's
// Deposit, asked at the clock's start (4am)
const payingLine = (quote: OfficeQuote) =>
  `Casey Client is paying the ${formatMoney(option(quote, "deep").depositCents)} deposit online, for the ${option(quote, "deep").serviceName}, waiting on their bank to approve it. If it isn't approved by 4:15\u00a0AM, it's called off and you can record acceptance.`;

// while one payment on a Quote is still going through, nothing else that
// moves money on it starts (#534: the one rule); a Client's bank approving
// a Deposit is one, for 15 minutes from when they pressed
describe("while the Client's bank is approving the Deposit", () => {
  // #534, F15: the attempt waiting on the bank was stored failed, so the
  // page's second press took a second Deposit
  test("pressing again once they've approved books the clean with that payment", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    // approved in their bank's app; back on a page that still says Sent
    testPayments().requireApproval(null);

    const again = await payNow(client, quote).expect(200);

    expect(again.body).toMatchObject({
      status: "accepted",
      quote: { status: "accepted", acceptedServiceKey: SEEDED.deep },
    });
    // the browser's own finalize, and the webhook, find it done
    await finalize(client, quote).expect(200);
    expect(testPayments().charges).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
    expect(await depositCharges()).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("pressing again before approving calls the first payment off and asks for the new one", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    const first = await payNow(client, quote).expect(200);

    const second = await payNow(client, quote).expect(200);

    expect(second.body.status).toBe("needs_approval");
    expect(refOf(second.body)).not.toBe(refOf(first.body));
    expect([...testPayments().canceled]).toEqual([refOf(first.body)]);
    testPayments().requireApproval("approved");
    await finalize(client, quote).expect(200);
    // the first one's webhook, late, books nothing more
    await webhook({
      kind: "deposit_succeeded",
      ref: refOf(first.body),
    }).expect(200);
    expect(testPayments().charges).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("pressing again while their bank is still finishing the first takes nothing more", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    // approved, and the bank is finishing it: it can't be called off
    testPayments().requireApproval("processing");

    const again = await payNow(client, quote).expect(200);

    expect(again.body).toEqual({
      status: "processing",
      message:
        "Your first payment is still going through with your bank, so nothing more was charged. We'll email you as soon as your clean is booked, usually within half an hour.",
    });
    expect(testPayments().paymentAttempts).toHaveLength(1);
    expect(testPayments().charges).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
  });

  // #534's N5: back from their bank's pop-up, they were asked to approve
  // what they just had
  test("coming back once they've approved, while their bank finishes it, asks nothing more", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    testPayments().requireApproval("processing");

    const back = await finalize(client, quote).expect(200);

    expect(back.body).toEqual({
      status: "processing",
      message:
        "We'll email you as soon as your clean is booked, usually within half an hour.",
    });
    expect(testPayments().charges).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
  });

  // #534's UX design, Screen 1b: declined while their bank still asked,
  // the payment stayed open, so approving it later booked a quote they'd
  // said no to
  test("declining calls the payment off first, so approving it later books nothing", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    const first = await payNow(client, quote).expect(200);

    const declined = await decline(client, quote).expect(200);

    expect(declined.body).toMatchObject({ status: "declined", paying: null });
    expect([...testPayments().canceled]).toEqual([refOf(first.body)]);
    await webhook({
      kind: "deposit_succeeded",
      ref: refOf(first.body),
    }).expect(200);
    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    expect(testPayments().charges).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
    // they said no: nothing tells them it wasn't approved
    expect(testEmail().lastTo(casey.email).subject).not.toMatch(/approved/);
  });

  // #534's UX design, Screen 1c: too far on to call off, so it may still
  // book the quote
  test("declining while their bank finishes it is refused, and says why", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    testPayments().requireApproval("processing");

    const refused = await decline(client, quote).expect(409);

    expect(refused.body.message).toBe(
      "Your payment is still going through with your bank, so this quote can't be declined now. We'll email you as soon as your clean is booked, usually within half an hour.",
    );
    expect([...testPayments().canceled]).toEqual([]);
    expect(
      (await client.get(`/api/quotes/mine/${quote.id}`).expect(200)).body,
    ).toMatchObject({ status: "sent", paying: { status: "goingThrough" } });
  });

  test("declining once their bank has just approved it books it, and says so", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    // approved in their bank's app, the page not yet back
    testPayments().requireApproval(null);

    const refused = await decline(client, quote).expect(409);

    expect(refused.body.message).toBe("This quote has already been accepted.");
    expect([...testPayments().canceled]).toEqual([]);
    expect(testPayments().charges).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  // review F17: told "we'll email you", they're emailed whichever way it
  // ends, and can pay again on the same page
  test("a payment their bank refuses after finishing it emails them, and they can pay again", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    testPayments().requireApproval("processing");
    await payNow(client, quote).expect(200);

    testPayments().requireApproval("refused");
    testClock().advance({ minutes: 15 });
    await settleOpenPayments();

    const email = testEmail().lastTo(casey.email);
    expect(email.subject).toBe("Your bank didn't approve your payment");
    expect(email.text).toContain(
      "so nothing was charged, and nothing is booked yet.",
    );
    expect(email.text).toContain(
      "Your quote is still open until Sunday, January 11 at 9:00\u00a0AM, so you can pay again before then.",
    );
    expect((await quoteOf(office, quote.id)).paying).toBeNull();
    testPayments().requireApproval(null);
    await addCard(client);
    await payNow(client, quote).expect(200);
    expect(testPayments().charges).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("a refused payment whose call-off fails is called off on the next read", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);

    testPayments().requireApproval("refused");
    testClock().advance({ minutes: 15 });
    vi.spyOn(testPayments(), "cancelPayment").mockRejectedValueOnce(
      new Error("Stripe is down"),
    );
    await settleOpenPayments();

    // else Casey could still pay it with its secret in the browser
    expect(testPayments().canceled.size).toBe(1);
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "Your bank didn't approve your payment",
    );
  });

  // the Clock runs on more than one server, and Office Staff send changes
  // meanwhile (#534 critical C7)
  test("a payment their bank refused is emailed once, however many settle it at once", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    testPayments().requireApproval("refused");
    testClock().advance({ minutes: 15 });

    await Promise.all([settleOpenPayments(), settleOpenPayments()]);

    const refused = testEmail()
      .to(casey.email)
      .filter((e) => e.subject === "Your bank didn't approve your payment");
    expect(refused).toHaveLength(1);
  });

  test("the Office can't record acceptance meanwhile, and sees why", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);

    expect((await quoteOf(office, quote.id)).paying).toEqual({
      until: "2026-01-05T09:15:00.000Z",
      serviceName: option(quote, "deep").serviceName,
      serviceKey: option(quote, "deep").serviceKey,
      changing: false,
      depositCents: option(quote, "deep").depositCents,
      finishing: false,
    });
    // from a page loaded before Casey started paying
    const refused = await recordAccepted(office, quote).expect(409);

    expect(refused.body.message).toBe(payingLine(quote));
    await finalize(client, quote).expect(200);
    expect(testPayments().charges).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
    expect((await quoteOf(office, quote.id)).paying).toBeNull();
  });

  test("after 15 minutes the Office can record acceptance, calling the payment off", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().requireApproval("pending");
    const waiting = await payNow(client, quote).expect(200);
    testClock().advance({ minutes: 15 });
    expect((await quoteOf(office, quote.id)).paying).toBeNull();

    const recorded = await recordAccepted(office, quote).expect(200);

    expect(recorded.body).toMatchObject({
      paidOnline: false,
      quote: { status: "accepted" },
    });
    expect([...testPayments().canceled]).toEqual([refOf(waiting.body)]);
    expect(testPayments().charges).toHaveLength(1);
    // they get the booking email, not one saying their payment was called off
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "You're booked with Empire Cleaning",
    );
    await finalize(client, quote).expect(200);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  // #534's refactor 2: Office Staff wait out only one the Client holds. One
  // whose acceptance rolled back, so no pending Deposit, no browser has the
  // secret of, and nobody can approve, so the Office's press calls it off
  test("one their acceptance never kept doesn't hold the Office", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().requireApproval("pending");
    const orphan = await payNow(client, quote).expect(200);
    await db.execute(sql`delete from pending_deposits`);

    await recordAccepted(office, quote).expect(200);

    expect([...testPayments().canceled]).toEqual([refOf(orphan.body)]);
    expect(testPayments().charges).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("recorded after 15 minutes, a payment their bank approved meanwhile is the Deposit", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().requireApproval("approved");
    await payNow(client, quote, "deep").expect(200);
    testClock().advance({ minutes: 15 });

    // Jen picks another Service, on a page that hadn't heard
    const recorded = await recordAccepted(office, quote, "standard").expect(
      200,
    );

    expect(recorded.body).toMatchObject({
      paidOnline: true,
      quote: { status: "accepted", acceptedServiceKey: SEEDED.deep },
    });
    expect(testPayments().charges).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("the Clock calls off a payment left unapproved for 15 minutes, and tells the Client", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    const waiting = await payNow(client, quote).expect(200);

    testClock().advance({ minutes: 14 });
    await settleOpenPayments();
    expect([...testPayments().canceled]).toEqual([]);

    testClock().advance({ minutes: 1 });
    await settleOpenPayments();

    expect([...testPayments().canceled]).toEqual([refOf(waiting.body)]);
    const email = testEmail().lastTo(casey.email);
    expect(email.subject).toBe("Your payment wasn't approved in time");
    expect(email.text).toContain(
      `Your bank asked you to approve the ${formatMoney(option(quote, "deep").depositCents)} deposit for your ${option(quote, "deep").serviceName}, and 15 minutes went by without an approval, so we called the payment off. Nothing was charged, and nothing is booked yet.`,
    );
    expect(email.text).toContain(
      "Your quote is still open until Sunday, January 11 at 9:00\u00a0AM, so you can pay again before then.",
    );
    // they approve it in the bank's pop-up, too late
    testPayments().requireApproval(null);
    const late = await finalize(client, quote).expect(409);
    expect(late.body.message).toBe(
      "Your payment wasn't approved, so nothing was taken. Please try again, or use another card.",
    );
    expect(await pageSays(client, quote)).toBe(late.body.message);
    expect(testPayments().charges).toEqual([]);
    await addCard(client);
    await recordAccepted(office, quote).expect(200);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("the Clock books a payment approved when neither the browser nor the webhook came back", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);
    testClock().advance({ minutes: 15 });

    await settleOpenPayments();

    expect((await quoteOf(office, quote.id)).status).toBe("accepted");
    expect(testPayments().charges).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("an approved payment that couldn't be booked or refunded is refunded by the Clock", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    const waiting = await payNow(client, quote).expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    testPayments().failRefunds();
    await finalize(client, quote).expect(409);
    expect(testPayments().refunds).toEqual([]);
    // not on the Office's record until it's back
    expect((await quoteOf(office, quote.id)).unbookedPayments).toEqual([]);
    testPayments().failRefunds(null);

    // the webhook, after, books nothing
    await webhook({
      kind: "deposit_succeeded",
      ref: refOf(waiting.body),
    }).expect(200);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);

    testClock().advance({ minutes: 15 });
    await settleOpenPayments();

    const [charge] = testPayments().charges;
    expect(testPayments().refunds).toEqual([
      expect.objectContaining({ chargeId: charge!.chargeId }),
    ]);
    const sent = await quoteOf(office, quote.id);
    expect(sent.status).toBe("sent");
    // told why once it's back, as when it went back at once (#534 F19)
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "We've refunded your deposit",
    );
    expect(sent.unbookedPayments).toEqual([
      {
        amountCents: charge!.amount,
        endedAt: "2026-01-05T09:15:00.000Z",
        why: "no_room",
      },
    ]);
  });

  test("nothing is refunded if finishing it fails before it's marked done, so a later try books it", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    const waiting = await payNow(client, quote).expect(200);
    // the database refuses to mark the payment finished
    await db.execute(sql`
      create function refuse_settling() returns trigger language plpgsql as
      $$ begin raise exception 'the database is unwell'; end $$`);
    await db.execute(sql`
      create trigger refuse_settling before update on pending_deposits
      for each row execute function refuse_settling()`);
    try {
      await finalize(client, quote).expect(500);
    } finally {
      await db.execute(sql`drop trigger refuse_settling on pending_deposits`);
      await db.execute(sql`drop function refuse_settling`);
    }

    await webhook({
      kind: "deposit_succeeded",
      ref: refOf(waiting.body),
    }).expect(200);

    expect(testPayments().refunds).toEqual([]);
    expect(testPayments().charges).toHaveLength(1);
    expect((await quoteOf(office, quote.id)).status).toBe("accepted");
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("changes can't be sent meanwhile", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    await office.post(`/api/quotes/${quote.id}/revisions`).send({}).expect(201);

    const refused = await office
      .post(`/api/quotes/${quote.id}/send`)
      .expect(409);

    expect(refused.body.message).toBe(
      "Casey Client is paying the deposit online. If it books the quote you sent, your draft is deleted. If it isn't approved by 4:15\u00a0AM, you can send your changes then.",
    );
    expect((await quoteOf(office, quote.id)).draft).not.toBeNull();
  });

  test("changes sent after 15 minutes call the payment off, and the Client is told", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    const waiting = await payNow(client, quote).expect(200);
    testClock().advance({ minutes: 15 });

    await revise(office, quote, { crewSize: 1 });

    expect([...testPayments().canceled]).toEqual([refOf(waiting.body)]);
    const calledOff = testEmail()
      .to(casey.email)
      .find((m) => m.subject === "Your payment wasn't approved in time");
    expect(calledOff?.text).toContain(
      "We've since sent you an updated quote, open until Sunday, January 11 at 9:00\u00a0AM, so you can pay on that one before then.",
    );
    // approved too late, it books nothing
    testPayments().requireApproval(null);
    await finalize(client, quote).expect(409);
    expect(testPayments().charges).toEqual([]);
  });

  test("changes sent after 15 minutes, when their bank approved meanwhile, accept the quote instead", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);
    testClock().advance({ minutes: 15 });
    await office.post(`/api/quotes/${quote.id}/revisions`).send({}).expect(201);

    const sent = await office.post(`/api/quotes/${quote.id}/send`).expect(200);

    // what Casey paid for is booked; the changes aren't sent
    expect(sent.body).toMatchObject({
      status: "accepted",
      acceptedServiceKey: SEEDED.deep,
      draft: null,
    });
    expect((sent.body as OfficeQuote).revisions).toHaveLength(1);
    expect(testPayments().charges).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  // critical review C1: a card saved with nothing to pay has no charge to
  // give back, so no one is told to refund it by hand
  test("a 0% Deposit approved for a day that's since filled gives nothing back, and raises no alarm", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office, guestAsk(), { depositPercent: 0 });
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });

    const finalized = await finalize(client, quote).expect(409);

    expect(testPayments().charges).toEqual([]);
    expect(testMonitoring().signalled("refund_failed")).toEqual([]);
    // nothing was paid, so nothing's said to be refunded
    expect(finalized.body.message).toBe(
      "Sorry, that time got booked up while your bank was approving your card, so nothing was booked. We'll send you a new quote for another time.",
    );
    expect(await pageSays(client, quote)).toBe(finalized.body.message);
  });

  // past 15 minutes, Send calls the payment off first; one it can't, as
  // their bank is finishing it (critical review C2) or the provider wasn't
  // reached for its call-off or its first read (C9, review F28), leaves the
  // changes unsent, rather than close the offer Casey's bank may still
  // approve, charging them and then refunding them
  test.each([
    {
      when: "their bank is still finishing the payment",
      fails: null,
      says: "Casey Client's online payment is still going through with their bank, which usually takes under half an hour. If it books the quote you sent, your draft is deleted. If not, you can send your changes then.",
    },
    {
      when: "calling it off can't reach the provider",
      fails: "cancelPayment",
      says: clientPayingWords.unsure(casey.name, false),
    },
    {
      when: "reading it can't reach the provider",
      fails: "paymentOutcome",
      says: clientPayingWords.unsure(casey.name, false),
    },
  ] as const)(
    "changes can't be sent after 15 minutes while $when",
    async ({ fails, says }) => {
      await cleaners();
      const office = await signInAsOffice();
      const quote = await sentQuote(office);
      const client = await signIn(casey.email);
      testPayments().requireApproval("pending");
      await payNow(client, quote).expect(200);
      testClock().advance({ minutes: 15 });
      await office
        .post(`/api/quotes/${quote.id}/revisions`)
        .send({})
        .expect(201);
      if (fails) {
        vi.spyOn(testPayments(), fails).mockRejectedValueOnce(
          new Error("Stripe is down"),
        );
      } else {
        // approved, and the bank is finishing it: it can't be called off
        testPayments().requireApproval("processing");
      }

      const sent = await office.post(`/api/quotes/${quote.id}/send`);

      // Casey approves it in their bank app: what they paid for is booked,
      // nothing refunded
      testPayments().requireApproval(null);
      await finalize(client, quote);
      expect({
        send: sent.status,
        message: sent.body.message,
        charges: testPayments().charges.length,
        refunds: testPayments().refunds.length,
      }).toEqual({ send: 409, message: says, charges: 1, refunds: 0 });
    },
  );

  // UX review U8: what a press found stays on the Quote's pages, so Record
  // acceptance and Send stay greyed till their bank's done, not live again
  test("a payment their bank is finishing past 15 minutes holds the Quote till it ends", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    testClock().advance({ minutes: 15 });
    // approved, and the bank is finishing it: it can't be called off
    testPayments().requireApproval("processing");

    const recorded = await recordAccepted(office, quote).expect(409);
    const held = (await quoteOf(office, quote.id)).paying;
    await office.post(`/api/quotes/${quote.id}/revisions`).send({}).expect(201);
    const sent = await office.post(`/api/quotes/${quote.id}/send`).expect(409);
    testPayments().requireApproval(null);
    await finalize(client, quote).expect(200);

    expect({
      recorded: recorded.body.message,
      held,
      sent: sent.body.message,
      after: (await quoteOf(office, quote.id)).paying,
      charges: testPayments().charges.length,
    }).toEqual({
      recorded:
        "Casey Client's online payment is still going through with their bank, which usually takes under half an hour, so you can't record acceptance yet. Nothing more was charged.",
      held: {
        until: "2026-01-05T09:15:00.000Z",
        serviceName: option(quote, "deep").serviceName,
        serviceKey: option(quote, "deep").serviceKey,
        changing: false,
        depositCents: option(quote, "deep").depositCents,
        finishing: true,
      },
      sent: "Casey Client's online payment is still going through with their bank, which usually takes under half an hour. If it books the quote you sent, your draft is deleted. If not, you can send your changes then.",
      after: null,
      charges: 1,
    });
  });

  // critical review C8: a call-off that failed for want of the provider
  // (unreachable, a 5xx, a 429) isn't their bank finishing it: Casey's bank
  // is still asking them, so the next press calls it off and records the yes
  test("a call-off that failed while their bank still asks them isn't the bank finishing", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    testClock().advance({ minutes: 15 });
    vi.spyOn(testPayments(), "cancelPayment").mockRejectedValueOnce(
      new Error("Stripe is down"),
    );

    await recordAccepted(office, quote).expect(409);
    const held = (await quoteOf(office, quote.id)).paying;
    const again = await recordAccepted(office, quote);

    expect({
      finishing: held?.finishing ?? false,
      again: again.status,
      calledOff: testPayments().canceled.size,
    }).toEqual({ finishing: false, again: 200, calledOff: 1 });
  });

  // settling looks a moment before Send does, so a press as the 15 minutes
  // end can find the payment inside them, left open, and Send past them,
  // with nothing failing: Send refuses by the time alone, not by what
  // settling tried (critical review C9, pass 7)
  test("a Send pressed as the 15 minutes end leaves the changes unsent", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    const asked = testClock().now().getTime();
    await office.post(`/api/quotes/${quote.id}/revisions`).send({}).expect(201);
    testClock().set(new Date(asked + 15 * 60_000 - 1));
    // settling's read of it, inside the 15 minutes, takes a millisecond
    const gateway = testPayments();
    const read = gateway.paymentOutcome.bind(gateway);
    vi.spyOn(gateway, "paymentOutcome").mockImplementationOnce(async (ref) => {
      testClock().set(new Date(asked + 15 * 60_000));
      return read(ref);
    });

    const sent = await office.post(`/api/quotes/${quote.id}/send`);
    // Casey approves it in their bank app, still open at Stripe
    testPayments().requireApproval(null);
    await finalize(client, quote);

    expect({
      send: sent.status,
      charges: testPayments().charges.length,
      refunds: testPayments().refunds.length,
      message: sent.body.message,
    }).toEqual({
      send: 409,
      charges: 1,
      refunds: 0,
      message: clientPayingWords.unsure(casey.name, false),
    });
  });

  // the wait ends with the outage, as nothing is stored of it: the next
  // press calls the payment off and sends (critical review C9, pass 7)
  test("Send refused for a call-off that didn't land sends on the next press", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    testClock().advance({ minutes: 15 });
    await office.post(`/api/quotes/${quote.id}/revisions`).send({}).expect(201);
    vi.spyOn(testPayments(), "cancelPayment").mockRejectedValueOnce(
      new Error("Stripe is down"),
    );

    const first = await office.post(`/api/quotes/${quote.id}/send`);
    const held = (await quoteOf(office, quote.id)).paying;
    const again = await office.post(`/api/quotes/${quote.id}/send`);

    expect({
      first: first.status,
      held,
      again: again.status,
      calledOff: testPayments().canceled.size,
      charges: testPayments().charges.length,
    }).toEqual({
      first: 409,
      held: null,
      again: 200,
      calledOff: 1,
      charges: 0,
    });
  });

  // clientPaying takes the newest attempt
  // approving with its pending Deposit unsettled. An earlier payment on
  // the Quote, approved as the day filled and given back once refunds
  // work (C3), leaves the Client's next one, still asked, as the open one
  // that holds the pages and Send; on the fake that forgot its answer,
  // the approved one was called off unrefunded (critical review C10)
  test("an earlier payment approved and given back doesn't hide the open one from Send", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);
    const filler = await bookedJob({
      startsAt: "2026-01-12T19:00:00Z",
      labourHours: 7,
    });
    testPayments().failRefunds();
    await finalize(client, quote).expect(409);
    // the day frees up, refunds work again, and Casey pays again
    await db.execute(sql`delete from jobs where id = ${filler.id}`);
    testPayments().failRefunds(null);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    const approving = await db.execute(
      sql`select a.status, p.settled_at is not null as settled from charge_attempts a join pending_deposits p on p.gateway_ref = a.gateway_ref where a.kind = 'deposit' order by a.status`,
    );
    const held = (await quoteOf(office, quote.id)).paying;
    testClock().advance({ minutes: 15 });
    await office.post(`/api/quotes/${quote.id}/revisions`).send({}).expect(201);
    vi.spyOn(testPayments(), "cancelPayment").mockRejectedValueOnce(
      new Error("Stripe is down"),
    );

    const sent = await office.post(`/api/quotes/${quote.id}/send`);

    expect({
      approving: approving.rows,
      held: held?.until,
      charges: testPayments().charges.length,
      refunds: testPayments().refunds.length,
      send: sent.status,
      message: sent.body.message,
    }).toEqual({
      approving: [
        { status: "approving", settled: false },
        { status: "given_back", settled: true },
      ],
      held: "2026-01-05T09:15:00.000Z",
      charges: 1,
      refunds: 1,
      send: 409,
      message: clientPayingWords.unsure(casey.name, false),
    });
  });

  // critical review C3: a payment that's ended (approved, the day full, its
  // refund failed) isn't one the Client is still making
  test("the Office isn't told the Client is paying once the payment's ended unbooked", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote).expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    testPayments().failRefunds();
    await finalize(client, quote).expect(409);
    // Jen calls to offer them another time, as the page promised
    await office.post(`/api/quotes/${quote.id}/revisions`).send({}).expect(201);

    const sent = await office.post(`/api/quotes/${quote.id}/send`);

    expect({
      paying: (await quoteOf(office, quote.id)).paying,
      send: sent.status,
      message: sent.body.message,
    }).toEqual({ paying: null, send: 200, message: undefined });
  });

  // critical review C5: approved in their bank's app, and they never came
  // back to the page; the day filled meanwhile, so they're told, as a paid
  // Deposit's Client is
  test("a 0% Deposit approved after the day filled tells them, when only the webhook comes back", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office, guestAsk(), { depositPercent: 0 });
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    const waiting = await payNow(client, quote).expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    const before = testEmail().to(casey.email).length;

    await webhook({
      kind: "deposit_succeeded",
      ref: refOf(waiting.body),
    }).expect(200);

    expect(testPayments().refunds).toEqual([]);
    const sent = await quoteOf(office, quote.id);
    expect(sent.status).toBe("sent");
    expect(testEmail().to(casey.email)).toHaveLength(before + 1);
    const email = testEmail().lastTo(casey.email);
    expect(email.subject).toBe("We couldn't book your clean");
    expect(email.text).toContain(
      "that time got booked up while your bank was approving your card.",
    );
    expect(email.text).toContain("Nothing was charged to your card.");
    expect(email.text).toContain(
      "We'll send you a new quote for another time.",
    );
    expect(email.text).not.toContain("refunded");
    // and the Office sees it, to be in touch
    expect(sent.unbookedPayments).toEqual([
      { amountCents: 0, endedAt: "2026-01-05T09:00:00.000Z", why: "no_room" },
    ]);
    // Today asks them to make the call the email promises (#534 UX pass 4)
    expect(
      (await needsAttention(office)).filter((i) => i.kind === "quote_no_room"),
    ).toEqual([
      expect.objectContaining({
        quote: expect.objectContaining({ id: quote.id }),
      }),
    ]);
  });
});

// a 0% Deposit charges nothing, but a card entered just now is saved only
// once their bank approves it, and approving it books the Quote, so it's
// held as a payment is: the one rule, for 15 minutes (#534's UX design
// review U40, U41, U44). Before, nothing held it: a new press left the first
// standing, the Office could record acceptance meanwhile, and nothing ended
// the wait
describe("while the Client's bank is approving the card for a 0% Deposit", () => {
  const zeroQuote = async (office: Agent) =>
    sentQuote(office, guestAsk(), { depositPercent: 0 });
  const mine = async (client: Agent, id: string) =>
    (await client.get(`/api/quotes/mine/${id}`).expect(200)).body as QuoteView;

  test("their page says so till the wait ends, and pressing again calls the first off", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await zeroQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    const first = await payNow(client, quote).expect(200);
    expect((await mine(client, quote.id)).paying).toEqual({
      status: "approving",
      until: "2026-01-05T09:15:00.000Z",
      serviceKey: SEEDED.deep,
      depositCents: 0,
    });

    const second = await payNow(client, quote).expect(200);

    expect(second.body.status).toBe("needs_approval");
    expect([...testPayments().canceled]).toEqual([refOf(first.body)]);
    testPayments().requireApproval("approved");
    await finalize(client, quote).expect(200);
    expect(testPayments().charges).toEqual([]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  test("pressing again while their bank is still finishing the first books nothing twice", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await zeroQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    testPayments().requireApproval("processing");

    const again = await payNow(client, quote).expect(200);

    expect(again.body).toEqual({
      status: "processing",
      message:
        "Your bank is still finishing approving your card, so nothing is booked twice. We'll email you as soon as your clean is booked, usually within half an hour.",
    });
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
  });

  test("declining calls the card's approval off first, so approving it later books nothing", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await zeroQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    const first = await payNow(client, quote).expect(200);

    await decline(client, quote).expect(200);

    expect([...testPayments().canceled]).toEqual([refOf(first.body)]);
    await webhook({
      kind: "deposit_succeeded",
      ref: refOf(first.body),
    }).expect(200);
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
  });

  test("declining while their bank finishes approving the card is refused, in its words", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await zeroQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);
    testPayments().requireApproval("processing");

    const refused = await decline(client, quote).expect(409);

    expect(refused.body.message).toBe(
      "Your bank is still finishing approving your card, so this quote can't be declined now. We'll email you as soon as your clean is booked, usually within half an hour.",
    );
    expect((await mine(client, quote.id)).status).toBe("sent");
  });

  test("the Office can't record acceptance meanwhile, and sees why", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await zeroQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().requireApproval("pending");
    await payNow(client, quote).expect(200);

    expect((await quoteOf(office, quote.id)).paying).toEqual({
      until: "2026-01-05T09:15:00.000Z",
      serviceName: option(quote, "deep").serviceName,
      serviceKey: option(quote, "deep").serviceKey,
      changing: false,
      depositCents: 0,
      finishing: false,
    });
    const refused = await recordAccepted(office, quote).expect(409);

    expect(refused.body.message).toBe(
      `Casey Client is accepting online, for the ${option(quote, "deep").serviceName}, waiting on their bank to approve their card. If it isn't approved by 4:15 AM, it's called off and you can record acceptance.`,
    );
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
  });

  test("the Clock calls it off after 15 minutes, and tells the Client", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await zeroQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    const waiting = await payNow(client, quote).expect(200);
    testClock().advance({ minutes: 15 });

    await settleOpenPayments();

    expect([...testPayments().canceled]).toEqual([refOf(waiting.body)]);
    const email = testEmail().lastTo(casey.email);
    expect(email.subject).toBe("Your card wasn't approved in time");
    expect(email.text).toContain(
      "Your bank asked you to approve your card, and 15 minutes went by without an approval, so we called it off. Nothing is booked yet.",
    );
    expect(email.text).toContain(
      "Your quote is still open until Sunday, January 11 at 9:00 AM, so you can accept it again before then.",
    );
    expect((await mine(client, quote.id)).paying).toEqual({
      status: "notApproved",
      at: "2026-01-05T09:00:00.000Z",
      serviceKey: SEEDED.deep,
      depositCents: 0,
    });
    expect((await quoteOf(office, quote.id)).paying).toBeNull();
  });

  // a $0 card save never gets a Charge, so it mustn't stay open as one
  // taken that no Charge records yet, nor be told of again on each Clock run
  test("one approved after the day filled is told of once, and holds nothing after", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await zeroQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    const waiting = await payNow(client, quote).expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    await webhook({
      kind: "deposit_succeeded",
      ref: refOf(waiting.body),
    }).expect(200);
    const told = testEmail().to(casey.email).length;

    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    await settleOpenPayments();

    expect(testEmail().to(casey.email)).toHaveLength(told);
    expect((await mine(client, quote.id)).paying).toMatchObject({
      status: "refunded",
      why: "no_room",
      depositCents: 0,
    });
    expect((await quoteOf(office, quote.id)).paying).toBeNull();
    expect(testPayments().refunds).toEqual([]);
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
    // a 500: reported (ADR-0007)
    expect(testMonitoring().errors).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({
          cause: expect.objectContaining({ message: "the database is unwell" }),
        }),
        context: {
          method: "POST",
          path: `/api/quotes/mine/${quote.id}/accept`,
        },
      }),
    ]);
  });

  test("a Deposit taken but not booked, and not refunded, is the refund_failed signal", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().failRefunds();
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
    expect(testMonitoring().signalled("refund_failed")).toEqual([
      expect.objectContaining({
        urgency: "urgent",
        context: expect.objectContaining({
          chargeId: charge!.chargeId,
          quoteId: quote.id,
        }),
      }),
    ]);
  });

  test("books and takes nothing if the payment provider can't be reached", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().goDown();

    expect((await accept(client, quote).expect(409)).body.message).toBe(
      "Something went wrong taking the payment, so nothing was booked. Please try again in a few minutes.",
    );
    expect(
      (
        await office
          .post(`/api/quotes/${quote.id}/accept`)
          .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.deep })
          .expect(409)
      ).body.message,
    ).toBe(
      "Something went wrong taking the payment, so nothing was booked. Please try again in a few minutes.",
    );

    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "sent",
    );
    expect((await scheduleOn(office, MONDAY)).jobs).toEqual([]);
    expect(await depositCharges()).toEqual([]);
    testPayments().goDown(false);
    await accept(client, quote).expect(200);
  });
});

// #241, finding 1: a Deposit the provider took, but whose reply was lost,
// is found on the next try instead of taken again
describe("trying again after the Deposit's reply was lost", () => {
  const depositsAtProvider = () =>
    testPayments().charges.filter((c) => c.description.startsWith("Deposit"));

  test("the Office's second try takes no second Deposit", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    await addCard(await signIn(casey.email));
    const acceptForCasey = () =>
      office
        .post(`/api/quotes/${quote.id}/accept`)
        .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.deep });
    testPayments().loseNextReply();

    await acceptForCasey().expect(409);
    await acceptForCasey().expect(200);

    expect(depositsAtProvider()).toHaveLength(1);
    expect(await depositCharges()).toEqual([
      expect.objectContaining({
        gatewayRef: depositsAtProvider()[0]!.chargeId,
      }),
    ]);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
  });

  // #534, F13, for a Deposit off a saved card: the second try sent the
  // first's request again, on the card the Client had then
  test("the Office's second try, after the Client saved another card, takes the Deposit from that card", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    const acceptForCasey = () =>
      office
        .post(`/api/quotes/${quote.id}/accept`)
        .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.deep });
    testPayments().goDown();
    await acceptForCasey().expect(409);
    testPayments().goDown(false);
    await addCard(client);

    // the first may still be running at the provider for a quarter hour
    expect((await acceptForCasey().expect(409)).body.message).toBe(
      "Something went wrong taking the payment, so nothing was booked. Please try again in a few minutes.",
    );
    testClock().advance({ minutes: 15 });
    await acceptForCasey().expect(200);

    expect(depositsAtProvider()).toEqual([
      expect.objectContaining({
        paymentMethodId: testPayments().paymentMethods.at(-1)!.paymentMethodId,
      }),
    ]);
  });

  // and so for a card typed in: it's never the saved card asked before
  test("the Client's second try with a card typed in, after one on their saved card, takes the Deposit from the card typed in", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    const saved = testPayments().paymentMethods.at(-1)!;
    testPayments().goDown();
    await accept(client, quote).expect(409);
    testPayments().goDown(false);

    await payNow(client, quote).expect(409);
    testClock().advance({ minutes: 15 });
    await payNow(client, quote).expect(200);

    const typedIn = testPayments().paymentMethods.at(-1)!;
    expect(typedIn.paymentMethodId).not.toBe(saved.paymentMethodId);
    expect(depositsAtProvider()).toEqual([
      expect.objectContaining({ paymentMethodId: typedIn.paymentMethodId }),
    ]);
  });

  test("the Client's second try with their saved card takes no second Deposit", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().loseNextReply();

    await accept(client, quote).expect(409);
    await accept(client, quote).expect(200);

    expect(depositsAtProvider()).toHaveLength(1);
    expect(await depositCharges()).toHaveLength(1);
  });

  test("the Client's second try with a card entered again takes no second Deposit, and saves the first card", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().loseNextReply();

    await payNow(client, quote).expect(409);
    await payNow(client, quote).expect(200);

    expect(depositsAtProvider()).toHaveLength(1);
    expect(
      (await client.get("/api/payment-methods/mine").expect(200)).body,
    ).toMatchObject({ label: "Test card ending 4242" });
  });

  test("with nobody trying again, a quarter of an hour on, open payments give it back", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().loseNextReply();
    await accept(client, quote).expect(409);

    await settleOpenPayments();
    expect(testPayments().refunds).toEqual([]);
    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    await settleOpenPayments();

    const [lost] = depositsAtProvider();
    expect(testPayments().refunds).toEqual([
      expect.objectContaining({
        chargeId: lost!.chargeId,
        amount: lost!.amount,
      }),
    ]);
    // accepting later takes a Deposit afresh
    await accept(client, quote).expect(200);
    expect(depositsAtProvider()).toHaveLength(2);
    expect(await depositCharges()).toEqual([
      expect.objectContaining({
        gatewayRef: depositsAtProvider()[1]!.chargeId,
      }),
    ]);
  });

  // #534, review F13: sent again, it would take the first option's Deposit,
  // only to give it back
  test("one for another option, accepted once the provider is back, is never taken", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().goDown();
    await accept(client, quote, "deep").expect(409);
    testPayments().goDown(false);

    // within the quarter hour it may still be on its way, so not yet
    await accept(client, quote, "standard").expect(409);
    testClock().advance({ minutes: 15 });
    await accept(client, quote, "standard").expect(200);

    expect(testPayments().refunds).toEqual([]);
    expect(depositsAtProvider()).toHaveLength(1);
    expect(await depositCharges()).toEqual([
      expect.objectContaining({
        gatewayRef: depositsAtProvider()[0]!.chargeId,
      }),
    ]);
  });

  // #534: an attempt never heard of is looked up, not sent again, once
  // nobody wants the Deposit it asked for
  test("one that never reached the provider, with nobody trying again, isn't taken a quarter of an hour on", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().goDown();
    await accept(client, quote).expect(409);
    testPayments().goDown(false);

    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    await settleOpenPayments();

    expect(depositsAtProvider()).toEqual([]);
    expect(testPayments().refunds).toEqual([]);
    // accepting later takes the Deposit
    await accept(client, quote).expect(200);
    expect(depositsAtProvider()).toHaveLength(1);
    expect(await depositCharges()).toEqual([
      expect.objectContaining({
        gatewayRef: depositsAtProvider()[0]!.chargeId,
      }),
    ]);
  });

  // #534, review F8: given back, it would be the Client charged twice
  // while the refund goes through
  test("a day later, once the provider has forgotten the key, a Deposit taken from a card entered then is the Deposit, and saves that card", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, guestAsk(), { validityDays: 7 });
    const client = await signIn(casey.email);
    testPayments().loseNextReply();
    await payNow(client, quote).expect(409);

    testClock().advance({ hours: 25 });
    testPayments().forgetKeys();
    await payNow(client, quote).expect(200);

    const [lost] = depositsAtProvider();
    expect(depositsAtProvider()).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
    expect(await depositCharges()).toEqual([
      expect.objectContaining({ gatewayRef: lost!.chargeId }),
    ]);
    expect(
      (await client.get("/api/payment-methods/mine").expect(200)).body,
    ).toMatchObject({ label: "Test card ending 4242" });
  });

  // #534, review F9: a second taken while the first is still the
  // Client's would be them charged twice
  test("one for another option that can't be given back takes no second Deposit", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().loseNextReply();
    await accept(client, quote, "deep").expect(409);
    testPayments().failRefunds();

    await accept(client, quote, "standard").expect(409);

    expect(depositsAtProvider()).toHaveLength(1);
    expect(await depositCharges()).toEqual([]);
    // given back, the other option's Deposit is taken
    testPayments().failRefunds(null);
    await accept(client, quote, "standard").expect(200);
    expect(testPayments().refunds).toHaveLength(1);
    expect(depositsAtProvider()).toHaveLength(2);
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
      .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.deep })
      .expect(200);

    expect(accepted.body).toMatchObject({
      quote: { status: "accepted", acceptedServiceKey: SEEDED.deep },
      paidOnline: false,
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
      .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.deep })
      .expect(409);

    expect(refused.body.message).toBe(
      "Casey Client hasn't added a card yet. Email them a link to add one.",
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
      .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.deep })
      .expect(409);

    expect(refused.body.message).toBe(
      "Casey Client's Test card ending 4242 didn't go through (there wasn't enough money in the account), so nothing was booked. Email them a link to add another card.",
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
      .send({ revisionId: draft.draft!.id, serviceKey: SEEDED.deep })
      .expect(409);
    expect(refused.body.message).toBe(
      "This quote hasn't been sent yet. Send it first.",
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
      .send({ revisionId: quote.offer!.id, serviceKey: SEEDED.deep })
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
    expect(email.subject).toBe("Add a card for Empire Cleaning");
    // a plain link, with no sign-in power (ADR-0006)
    expect(email.text).toContain("http://localhost:5173/portal/payment-method");
    expect(email.text).not.toMatch(/token=/);
    await office
      .post("/api/payment-methods/requests")
      .send({ clientId: "7f6b6f5e-35a4-4f43-8f1e-1d2c3b4a5f60" })
      .expect(404);
  });

  test("tells a Client billed weekly, in the link's email, that the rest goes on their Bill (#244 #5)", async () => {
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    await billWeekly("on_page");

    await office
      .post("/api/payment-methods/requests")
      .send({ clientId: quote.client.id })
      .expect(200);
    expect(testEmail().lastTo(casey.email).text).toContain(
      "We take the deposit when you book, and the rest goes on your bill for that week, made the following Monday, which you pay on its page by its due date.",
    );
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
      "your clean is tomorrow.\n\nWhen: Monday, January 12 at 9:00\u00a0AM\nWhere: 41-12 Austin St, 4B, 11375\nService: Deep Clean",
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
    // Sunday 11 January at 8:30am in New York, half an hour before the
    // Quote Expires
    testClock().set(new Date("2026-01-11T13:30:00Z"));
    await bookedForMonday();

    // at noon
    testClock().set(new Date("2026-01-11T17:00:00Z"));
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

const needsAttention = async (office: Agent) =>
  (await office.get("/api/dashboard/needs-attention").expect(200))
    .body as NeedsAttentionItem[];

describe("when a Quote's day fills up before it's accepted", () => {
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
    await decline(client, quote).expect(200);
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
    expect(notice.subject).toBe("A quote needs another time");
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

  test("the Office is emailed when a Cleaner's usual week, or their leaving, crowds out a Quote (#242)", async () => {
    // room on Monday for one Deep Clean, with both Cleaners' hours
    await cleaners(1, 4);
    const cory = await staffMember("Cory Cleaner", {
      usualWeek: [4, 4, 4, 4, 4, 0, 0],
    });
    const office = await signInAsOffice();
    await sentQuote(office);
    const toldOffice = () =>
      testEmail()
        .to("olive@example.com")
        .filter((m) => m.subject === "A quote needs another time");

    // Tuesdays off: Monday still fits
    await setUsualWeek(cory.id, [4, 0, 4, 4, 4, 0, 0]);
    expect(toldOffice()).toEqual([]);
    // Mondays off: it doesn't
    await setUsualWeek(cory.id, [0, 0, 4, 4, 4, 0, 0]);
    expect(toldOffice()).toHaveLength(1);

    await setUsualWeek(cory.id, [4, 4, 4, 4, 4, 0, 0]);
    await deactivateStaff(cory.id);
    expect(toldOffice()).toHaveLength(2);
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

// a Deposit whose card's bank finishes it on its first reply, with nothing
// to approve, is kept as one going through, not one to approve: the Client
// told so, the Office too, and booked once it's done (#534's F21)
describe("a Deposit their bank finishes from its first reply", () => {
  const paid = async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().finishCards();
    const pressed = await payNow(client, quote).expect(200);
    const [ref] = (
      await db.execute(
        sql`select gateway_ref from charge_attempts where kind = 'deposit'`,
      )
    ).rows.map((r) => r.gateway_ref as string);
    return { office, quote, client, pressed, ref: ref! };
  };

  test("says it's going through, to the Client and the Office, and the webhook books it once", async () => {
    const { office, quote, pressed, ref } = await paid();
    const held = (await quoteOf(office, quote.id)).paying;
    testPayments().finishCards(false);

    await webhook({ kind: "deposit_succeeded", ref }).expect(200);

    expect({
      pressed: pressed.body,
      finishing: held?.finishing,
      charges: testPayments().charges.length,
      jobs: (await scheduleOn(office, MONDAY)).jobs.length,
    }).toEqual({
      pressed: {
        status: "processing",
        message:
          "We'll email you as soon as your clean is booked, usually within half an hour.",
      },
      finishing: true,
      charges: 1,
      jobs: 1,
    });
  });

  test("with neither the webhook nor the browser back, the Clock books it", async () => {
    const { office } = await paid();
    testPayments().finishCards(false);

    testClock().advance({ minutes: 16 });
    await settleOpenPayments();

    expect(testPayments().charges).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
  });
});

// "approved, and their bank finishing it" is kept as processing by card
// (#534): a Deposit's is still the Client's pending one, which a second
// press, the webhook and the Clock each read as it is, never as an
// off-session Charge to look up, give back and ask again (#534's critical
// review C1)
describe("a Deposit their bank is finishing", () => {
  const finishing = async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    const first = await payNow(client, quote).expect(200);
    testPayments().requireApproval("processing");
    await payNow(client, quote).expect(200);
    // as the bank's reply, once approved, keeps it
    await db.execute(
      sql`update charge_attempts set status = 'processing', processing_by = 'card' where kind = 'deposit' and status = 'approving'`,
    );
    return { office, quote, client, ref: refOf(first.body) };
  };

  test("pressing again while it finishes says it's going through, and asks for nothing more", async () => {
    const { client, quote } = await finishing();

    const again = await payNow(client, quote).expect(200);

    expect(testPayments().paymentAttempts).toHaveLength(1);
    expect(again.body.status).toBe("processing");
  });

  test("pressing again once it's finished books it once, and gives nothing back", async () => {
    const { office, client, quote, ref } = await finishing();
    // their bank finished it: taken, as Stripe says on any read
    testPayments().requireApproval(null);
    await testPayments().paymentOutcome(ref);

    await payNow(client, quote).expect(200);
    await webhook({ kind: "deposit_succeeded", ref }).expect(200);
    testClock().advance({ minutes: 16 });
    await settleOpenPayments();

    expect(testPayments().charges).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
  });

  test("finished with neither the browser nor the webhook back, the Clock books it and gives nothing back", async () => {
    const { office, ref } = await finishing();
    testPayments().requireApproval(null);
    await testPayments().paymentOutcome(ref);

    testClock().advance({ minutes: 16 });
    await settleOpenPayments();

    expect(testPayments().charges).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
  });
});

// the Office's Deposit, charged to the saved card with the Client away, and
// left processing by the card's bank: it has no pending Deposit of the
// Client's, so it's read as the Charge it is, not given back and asked again
// (#534's critical review C7)
describe("the Office's Deposit charge, left processing", () => {
  test("pressing Record acceptance again once it's gone through books the clean with it", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    await addCard(await signIn(casey.email));
    testPayments().failCharges("processing");
    await recordAccepted(office, quote);
    testPayments().failCharges(null);
    testPayments().clearCharges();

    await recordAccepted(office, quote).expect(200);

    expect(testPayments().charges).toHaveLength(1);
    expect((await scheduleOn(office, MONDAY)).jobs).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
  });

  // it may still take their money, so declining waits, as it does for their
  // own payment their bank is finishing; once it's through, unbooked, it's
  // given back as any Deposit no booking recorded is, and they may decline
  // (#534 critical review C9)
  test("the Client can't decline the Quote while it may still go through", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().failCharges("processing");
    await recordAccepted(office, quote);
    testPayments().failCharges(null);

    expect((await decline(client, quote).expect(409)).body.message).toBe(
      "A deposit payment for this quote is still going through with your bank, so this quote can't be declined now. Please try again later.",
    );
    testPayments().clearCharges();
    testClock().advance({ minutes: 16 });
    await settleOpenPayments();
    expect(testPayments().charges).toHaveLength(1);
    expect(testPayments().refunds).toEqual([
      expect.objectContaining({ amount: testPayments().charges[0]!.amount }),
    ]);
    await decline(client, quote).expect(200);
  });
});

// where the Client's latest Deposit payment on a Quote stands, as their
// Quote's page, their list of quotes and the Office's page read it (#534):
// each said "Your quote is ready" with Accept and pay, whatever their bank
// was doing with the payment, and nothing once it ended
describe("the Client's Deposit payment, as their pages read it", () => {
  const mine = async (client: Agent, id: string) =>
    (await client.get(`/api/quotes/mine/${id}`).expect(200)).body as QuoteView;
  const listed = async (client: Agent, id: string) =>
    (
      (await client.get("/api/quotes/mine").expect(200)).body as {
        id: string;
        paying: unknown;
        headlineServiceName: string | null;
      }[]
    ).find((q) => q.id === id)!;
  const standard = (quote: OfficeQuote) => ({
    serviceKey: SEEDED.standard,
    depositCents: option(quote, "standard").depositCents,
  });

  test("while their bank finishes it, it's going through, for the clean they paid for", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote, "standard").expect(200);
    testPayments().requireApproval("processing");
    await finalize(client, quote).expect(200);

    const going = { status: "goingThrough", ...standard(quote) };
    expect((await mine(client, quote.id)).paying).toEqual(going);
    expect(await listed(client, quote.id)).toMatchObject({
      paying: going,
      headlineServiceName: option(quote, "standard").serviceName,
    });
  });

  test("while their bank asks them to approve it, it's approving until the wait ends", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote, "standard").expect(200);

    expect((await mine(client, quote.id)).paying).toEqual({
      status: "approving",
      until: "2026-01-05T09:15:00.000Z",
      ...standard(quote),
    });
  });

  // #534 review F9: their page said it was going through, with nothing to
  // do, as they were told to try again in a few minutes, and the Office's
  // page said nothing; pressing again reads it, and books with it (#241)
  test("one whose reply never came isn't going through, on their pages or the Office's, as pressing again reads it", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    await addCard(client);
    testPayments().loseNextReply();
    await accept(client, quote, "standard").expect(409);

    expect((await mine(client, quote.id)).paying).toBeNull();
    expect((await listed(client, quote.id)).paying).toBeNull();
    expect((await quoteOf(office, quote.id)).paying).toBeNull();
    await accept(client, quote, "standard").expect(200);
  });

  test("past the wait, never approved, on their page and the Office's", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await payNow(client, quote, "standard").expect(200);
    testClock().advance({ minutes: 16 });

    const ended = {
      status: "notApproved",
      at: "2026-01-05T09:00:00.000Z",
      ...standard(quote),
    };
    expect((await mine(client, quote.id)).paying).toEqual(ended);
    expect((await quoteOf(office, quote.id)).paymentEnded).toEqual(ended);
    // the same once the Clock has called it off
    await settleOpenPayments();
    expect((await mine(client, quote.id)).paying).toEqual(ended);
  });

  test("a card their bank declined says why, on their page and the Office's", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().failCharges("insufficient_funds");
    await payNow(client, quote, "standard").expect(409);

    const failed = {
      status: "failed",
      at: "2026-01-05T09:00:00.000Z",
      why: "there wasn't enough money in the account",
      ...standard(quote),
    };
    expect((await mine(client, quote.id)).paying).toEqual(failed);
    expect((await quoteOf(office, quote.id)).paymentEnded).toEqual(failed);
  });

  test("a Deposit refunded as the time filled up says so, and when", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote, "standard").expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    await finalize(client, quote).expect(409);

    expect((await mine(client, quote.id)).paying).toEqual({
      status: "refunded",
      why: "no_room",
      at: "2026-01-05T09:00:00.000Z",
      ...standard(quote),
    });
  });

  // with nothing booked, there's no clean to list it by, so it's listed by
  // its quote, which says why, with its refund: the money came back
  // (#534's UX design, Screen 4)
  test("a Deposit refunded as the time filled up is in their payment history, with its refund, by its quote", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote, "standard").expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    // their bank approves it minutes on, when it's taken and given back:
    // dated then, not when they paid
    testClock().advance({ minutes: 5 });
    await finalize(client, quote).expect(409);

    const { depositCents } = standard(quote);
    const byQuote = {
      job: null,
      servicePlanId: null,
      bill: null,
      quote: { id: quote.id, serviceName: "Standard Clean" },
      clearing: false,
      item: null,
    };
    // newest first: the refund, given back the moment it was taken
    expect((await client.get("/api/payments/mine").expect(200)).body).toEqual([
      {
        id: expect.any(String),
        at: "2026-01-05T09:05:00.000Z",
        kind: "refund",
        amountCents: -depositCents,
        ...byQuote,
      },
      {
        id: expect.any(String),
        at: "2026-01-05T09:05:00.000Z",
        kind: "deposit",
        amountCents: depositCents,
        ...byQuote,
      },
    ]);
  });

  test("none once a newer Revision is sent, as it was for the last offer", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().failCharges("card_declined");
    await payNow(client, quote, "standard").expect(409);
    testPayments().failCharges(null);

    await revise(office, quote, { validityDays: 10 });

    expect((await mine(client, quote.id)).paying).toBeNull();
    expect((await quoteOf(office, quote.id)).paymentEnded).toBeNull();
  });

  // a refund shows on the Quote while it isn't booked, a newer Revision
  // too, as that's why it wasn't; once it's booked, with no payment of its
  // own (no Deposit), its page says that instead
  test("a refund stays on a newer Revision, and goes once it's booked", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote, "standard").expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    await finalize(client, quote).expect(409);
    testPayments().requireApproval(null);

    const tuesday = await revise(office, quote, {
      depositPercent: 0,
      proposedStart: { date: "2026-01-13", time: "09:00" },
    });
    const refunded = (await mine(client, quote.id)).paying;
    await payNow(client, tuesday, "standard").expect(200);

    expect({
      refunded: refunded?.status,
      booked: (await mine(client, quote.id)).paying,
      listed: (await listed(client, quote.id)).paying,
    }).toEqual({ refunded: "refunded", booked: null, listed: null });
  });

  // Home draws a Time unavailable quote as its own card, about the payment
  // refunded on it, so it names the clean that payment was for
  test("a Time unavailable quote's row says nothing can be booked, and leads with the clean refunded", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote, "standard").expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    await finalize(client, quote).expect(409);

    expect(await listed(client, quote.id)).toMatchObject({
      bookable: [],
      headlineServiceName: option(quote, "standard").serviceName,
    });
  });

  // once updated, what's on offer is the new version's, so the row leads
  // with it, as it would with no payment, and Home's alert names the clean
  // refunded, by its own name (#534's UX design, Screen 2)
  test("a refund on an updated quote leads its row with what's on offer now, and names the clean refunded", async () => {
    // 8 hours on Monday
    await cleaners(2, 4);
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote, "standard").expect(200);
    await bookedJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 7 });
    await finalize(client, quote).expect(409);

    const tuesday = await revise(office, quote, {
      proposedStart: { date: "2026-01-13", time: "09:00" },
    });

    expect(await listed(client, quote.id)).toMatchObject({
      paying: { status: "refunded" },
      payingServiceName: option(quote, "standard").serviceName,
      bookable: tuesday.offer!.options.map((o) => o.serviceKey),
      headlineServiceName: tuesday.offer!.options[0]!.serviceName,
    });
    expect(tuesday.offer!.options[0]!.serviceKey).toBe(SEEDED.deep);
  });

  // nothing is on offer once it's closed, so its card names the clean the
  // refund under it is for (#534's UX review U37)
  test("a quote that expired as its deposit was refunded leads with the clean refunded", async () => {
    await cleaners();
    const office = await signInAsOffice();
    const quote = await sentQuote(office);
    const client = await signIn(casey.email);
    testPayments().requireApproval("approved");
    await payNow(client, quote, "standard").expect(200);
    testClock().set(new Date(quote.offer!.expiresAt!));
    await finalize(client, quote).expect(409);

    expect(await listed(client, quote.id)).toMatchObject({
      status: "expired",
      paying: { status: "refunded" },
      bookable: null,
      headlineServiceName: option(quote, "standard").serviceName,
    });
    expect(quote.offer!.options[0]!.serviceKey).not.toBe(SEEDED.standard);
  });
});
