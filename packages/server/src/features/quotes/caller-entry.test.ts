import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  ClientListItem,
  OfficeClientView,
  OfficeQuote,
} from "@empire-cleaning/models";
import { db } from "#db";
import { accounts } from "#features/auth";
import { api, signIn, testEmail } from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "#features/services";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York
const nextMonday = { date: "2026-01-12", time: "09:00" };

const caller = { name: "Pat Phoner", phone: "(718) 555-0123" };

// what Office Staff enter for a caller: a new home, moderate, no Add-ons
const entry = (who: object, changes: object = {}) => ({
  ...who,
  property: { new: home },
  serviceKey: SEEDED.standard,
  condition: "moderate",
  wantsRegularService: false,
  addOns: [],
  notes: "Called in; prefers mornings",
  ...changes,
});

const enter = (office: Agent, body: object) =>
  office.post("/api/quotes/caller").send(body);

const officeQuote = async (office: Agent, id: string) =>
  (await office.get(`/api/quotes/${id}`).expect(200)).body as OfficeQuote;

const clientNamed = async (office: Agent, name: string) =>
  (
    (await office.get("/api/clients").expect(200)).body
      .clients as ClientListItem[]
  ).filter((c) => c.name === name);

// a Client's homes, from their page
const propertiesOf = async (office: Agent, clientId: string) =>
  (
    (await office.get(`/api/clients/${clientId}`).expect(200))
      .body as OfficeClientView
  ).properties;

// gives the Draft a proposed time, then tries to send it
const send = async (office: Agent, quote: OfficeQuote) => {
  await office
    .patch(`/api/quotes/${quote.id}/draft`)
    .send({
      addOns: [],
      crewSize: quote.draft!.crewSize,
      depositPercent: quote.draft!.depositPercent,
      validityDays: quote.draft!.validityDays,
      proposedStart: nextMonday,
      overrides: {},
    })
    .expect(200);
  return await office.post(`/api/quotes/${quote.id}/send`);
};

describe("Office Staff entering a caller's ask", () => {
  test("is only for Office Staff", async () => {
    await enter(api() as unknown as Agent, entry({ contact: caller })).expect(
      401,
    );
    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    await enter(client, entry({ contact: caller })).expect(403);
  });

  test("starts a one-off Quote for a new Client, a Draft holding what they asked, with no receipt and no Account", async () => {
    const office = await signInAsOffice();

    const { body } = await enter(
      office,
      entry({ contact: { ...caller, email: "Pat@Example.com" } }),
    ).expect(201);

    const quote = await officeQuote(office, body.quoteId);
    expect(quote).toMatchObject({
      kind: "one_off",
      status: "draft",
      origin: "caller",
      asked: { notes: "Called in; prefers mornings", condition: "moderate" },
      client: {
        name: "Pat Phoner",
        email: "pat@example.com",
        phone: "(718) 555-0123",
      },
      property: { street: "41-12 Austin St" },
      draft: { number: 1, status: "draft" },
      offer: null,
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

  test("for a new Client with an existing Client's email adds the Quote to that Client, unchanged", async () => {
    const office = await signInAsOffice();
    await submit(guestAsk()).expect(201);

    await enter(
      office,
      entry(
        { contact: { ...caller, email: casey.email } },
        { property: { new: { ...home, street: "35-06 Ditmars Blvd" } } },
      ),
    ).expect(201);

    const [existing] = await clientNamed(office, "Casey Client");
    expect(existing).toMatchObject({ phone: casey.phone });
    expect(await propertiesOf(office, existing!.id)).toHaveLength(2);
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

    // that home's Quote is open, a Draft
    const waiting = await enter(
      office,
      entry(
        { clientId: client.id },
        { property: { existing: properties[0]!.id } },
      ),
    ).expect(409);
    expect(waiting.body.message).toBe(
      "This home has a Quote open already: carry on with that one.",
    );

    await enter(
      office,
      entry(
        { clientId: client.id },
        { property: { new: { ...home, street: "1 Nudge Lane", unit: null } } },
      ),
    ).expect(201);
    expect(await propertiesOf(office, client.id)).toHaveLength(2);
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
    await submit(guestAsk()).expect(201);
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
    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    const me = (await client.get("/api/clients/me").expect(200)).body;
    await client
      .patch(`/api/clients/${me.id}`)
      .send({ ...caller, email: null })
      .expect(403);
  });
});
