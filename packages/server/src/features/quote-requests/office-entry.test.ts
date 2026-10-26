import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  ClientListItem,
  OfficeClientView,
  OfficeQuote,
  QuoteRequestDetail,
} from "@empire-cleaning/models";
import { db } from "#db";
import { accounts } from "#features/auth";
import { api, signIn, testEmail } from "../../../tests/harness.ts";
import {
  casey,
  guestRequest,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York
const nextMonday = { date: "2026-01-12", time: "09:00" };

const caller = { name: "Pat Phoner", phone: "(718) 555-0123" };

// what Office Staff enter for a caller: a new home, moderate, no Add-ons
const entry = (who: object, changes: object = {}) => ({
  ...who,
  property: { new: home },
  condition: "moderate",
  wantsRegularService: false,
  addOns: [],
  notes: "Called in; prefers mornings",
  ...changes,
});

const enter = (office: Agent, body: object) =>
  office.post("/api/quote-requests/office").send(body);

const officeQuote = async (office: Agent, id: string) =>
  (await office.get(`/api/quotes/${id}`).expect(200)).body as OfficeQuote;

const clientNamed = async (office: Agent, name: string) =>
  (
    (await office.get("/api/clients").expect(200)).body as ClientListItem[]
  ).filter((c) => c.name === name);

// gives the Draft a proposed time, then tries to send it
const send = async (office: Agent, quote: OfficeQuote) => {
  await office
    .patch(`/api/quotes/${quote.id}`)
    .send({
      addOns: [],
      crewSize: quote.crewSize,
      depositPercent: quote.depositPercent,
      validityDays: quote.validityDays,
      proposedStart: nextMonday,
      overrides: { deep: null, standard: null },
    })
    .expect(200);
  return await office.post(`/api/quotes/${quote.id}/send`);
};

describe("Office Staff entering a caller's Quote Request", () => {
  test("is only for Office Staff", async () => {
    await enter(api() as unknown as Agent, entry({ contact: caller })).expect(
      401,
    );
    await submit(guestRequest()).expect(201);
    const client = await signIn(casey.email);
    await enter(client, entry({ contact: caller })).expect(403);
  });

  test("records the request for a new Client and opens a one-off Quote Draft answering it, with no receipt and no Account", async () => {
    const office = await signInAsOffice();

    const { body } = await enter(
      office,
      entry({ contact: { ...caller, email: "Pat@Example.com" } }),
    ).expect(201);

    const quote = await officeQuote(office, body.quoteId);
    expect(quote).toMatchObject({
      kind: "one_off",
      status: "draft",
      quoteRequestId: body.quoteRequestId,
      client: { name: "Pat Phoner", email: "pat@example.com" },
    });
    const request = (
      await office.get(`/api/quote-requests/${body.quoteRequestId}`).expect(200)
    ).body as QuoteRequestDetail;
    expect(request).toMatchObject({
      notes: "Called in; prefers mornings",
      client: { phone: "(718) 555-0123" },
      property: { street: "41-12 Austin St" },
    });
    expect(testEmail().to("pat@example.com")).toEqual([]);
    expect(
      await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, "pat@example.com")),
    ).toEqual([]);
  });

  test("takes a new Client without an email, whose Quote can't be sent until one is added", async () => {
    const office = await signInAsOffice();
    const { body } = await enter(office, entry({ contact: caller })).expect(
      201,
    );
    const quote = await officeQuote(office, body.quoteId);
    expect(quote.client.email).toBeNull();

    const refused = await send(office, quote);
    expect(refused.status).toBe(409);
    expect(refused.body.message).toBe(
      "Pat Phoner has no email yet, so the Quote can't be sent. Add their email on their Client screen, then send it.",
    );

    await office
      .patch(`/api/clients/${quote.client.id}`)
      .send({ ...caller, email: "pat@example.com" })
      .expect(200);
    expect((await send(office, quote)).status).toBe(200);
    expect(testEmail().lastTo("pat@example.com").subject).toBe(
      "Your Quote from Empire Cleaning",
    );
  });

  test("for a new Client with an existing Client's email adds the request to that Client, unchanged", async () => {
    const office = await signInAsOffice();
    await submit(guestRequest()).expect(201);

    await enter(
      office,
      entry(
        { contact: { ...caller, email: casey.email } },
        { property: { new: { ...home, street: "35-06 Ditmars Blvd" } } },
      ),
    ).expect(201);

    const [existing] = await clientNamed(office, "Casey Client");
    expect(existing).toMatchObject({ phone: casey.phone, propertyCount: 2 });
    expect(await clientNamed(office, "Pat Phoner")).toEqual([]);
  });

  test("for an existing Client, for one of their homes or a new one", async () => {
    const office = await signInAsOffice();
    const { body: first } = await enter(
      office,
      entry({ contact: caller }),
    ).expect(201);
    const { client } = await officeQuote(office, first.quoteId);
    const { properties } = (
      await office.get(`/api/clients/${client.id}`).expect(200)
    ).body as OfficeClientView;

    // that home's request is waiting on its Quote
    const waiting = await enter(
      office,
      entry(
        { clientId: client.id },
        { property: { existing: properties[0]!.id } },
      ),
    ).expect(409);
    expect(waiting.body.message).toBe(
      "This home has a Quote Request waiting already: answer that one from Requests.",
    );

    await enter(
      office,
      entry(
        { clientId: client.id },
        { property: { new: { ...home, street: "1 Nudge Lane", unit: null } } },
      ),
    ).expect(201);
    const [pat] = await clientNamed(office, "Pat Phoner");
    expect(pat!.propertyCount).toBe(2);
  });

  test("needs a Client chosen or entered, and checks a new Client's details", async () => {
    const office = await signInAsOffice();

    const neither = await enter(office, entry({})).expect(400);
    expect(neither.body.details).toContainEqual(
      expect.objectContaining({
        path: "clientId",
        issue: "Choose a Client, or enter a new one",
      }),
    );
    const bad = await enter(
      office,
      entry({ contact: { name: "", phone: "555", email: "nope" } }),
    ).expect(400);
    expect(bad.body.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining([
        "contact.name",
        "contact.phone",
        "contact.email",
      ]),
    );
  });
});

describe("Office Staff editing a Client's contact details", () => {
  test("can't take another Client's email, or remove one", async () => {
    const office = await signInAsOffice();
    await submit(guestRequest()).expect(201);
    const { body } = await enter(
      office,
      entry({ contact: { ...caller, email: "pat@example.com" } }),
    ).expect(201);
    const { client } = await officeQuote(office, body.quoteId);

    const taken = await office
      .patch(`/api/clients/${client.id}`)
      .send({ ...caller, email: casey.email })
      .expect(400);
    expect(taken.body.details).toContainEqual(
      expect.objectContaining({
        path: "email",
        issue: "That email is already used by another Client",
      }),
    );

    const kept = (
      await office
        .patch(`/api/clients/${client.id}`)
        .send({ ...caller, name: "Pat Caller", email: null })
        .expect(200)
    ).body as OfficeClientView;
    expect(kept).toMatchObject({
      name: "Pat Caller",
      email: "pat@example.com",
    });
  });

  test("is only for Office Staff", async () => {
    await submit(guestRequest()).expect(201);
    const client = await signIn(casey.email);
    const me = (await client.get("/api/clients/me").expect(200)).body;
    await client
      .patch(`/api/clients/${me.id}`)
      .send({ ...caller, email: null })
      .expect(403);
  });
});
