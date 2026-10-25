import { describe, expect, test } from "vitest";
import type {
  NeedsAttentionItem,
  OfficeQuote,
  PriceList,
  QuoteDraftInput,
  QuoteRequestDetail,
  QuoteSummary,
  QuoteView,
} from "@empire-cleaning/models";
import { api, signIn, testClock, testEmail } from "../../../tests/harness.ts";
import {
  casey,
  guestRequest,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York; 9am on
// Monday 12 January is 14:00 UTC
const nextMonday = { date: "2026-01-12", time: "09:00" };

const asked = async (addOnNames: string[] = []) => {
  const offered = (await api().get("/api/price-list/add-ons").expect(200))
    .body as { key: string; name: string }[];
  const addOns = offered
    .filter((a) => addOnNames.includes(a.name))
    .map((a) => a.key);
  const { body } = await submit(guestRequest({ addOns })).expect(201);
  return body.id as string;
};

const requestDetail = async (office: Agent, id: string) =>
  (await office.get(`/api/quote-requests/${id}`).expect(200))
    .body as QuoteRequestDetail;

const startDraft = async (office: Agent, quoteRequestId: string) =>
  (await office.post("/api/quotes").send({ quoteRequestId }).expect(201))
    .body as OfficeQuote;

// what a Draft is now, as a PATCH body, with changes
const edit = (
  quote: OfficeQuote,
  changes: Partial<QuoteDraftInput> = {},
): QuoteDraftInput => ({
  addOns: quote.addOns.map((a) => a.key),
  crewSize: quote.crewSize,
  depositPercent: quote.depositPercent,
  validityDays: quote.validityDays,
  proposedStart: quote.proposedStart,
  overrides: {
    deep: quote.options[0]!.overrideCents
      ? {
          priceCents: quote.options[0]!.overrideCents,
          reason: quote.options[0]!.overrideReason!,
        }
      : null,
    standard: null,
  },
  ...changes,
});

const save = async (
  office: Agent,
  quote: OfficeQuote,
  changes: Partial<QuoteDraftInput>,
) =>
  (
    await office
      .patch(`/api/quotes/${quote.id}`)
      .send(edit(quote, changes))
      .expect(200)
  ).body as OfficeQuote;

// the request's Draft (started now, or the one it has) with a proposed
// time, sent
const sentQuote = async (
  office: Agent,
  quoteRequestId: string,
  changes: Partial<QuoteDraftInput> = {},
) => {
  const draft = (await office.post("/api/quotes").send({ quoteRequestId }))
    .body as OfficeQuote;
  await save(office, draft, { proposedStart: nextMonday, ...changes });
  return (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
    .body as OfficeQuote;
};

const option = (
  quote: { options: OfficeQuote["options"] },
  cleanType: string,
) => quote.options.find((o) => o.cleanType === cleanType)!;

describe("drafting a First Clean Quote", () => {
  test("is only for Office Staff", async () => {
    const quoteRequestId = await asked();
    await api().post("/api/quotes").send({ quoteRequestId }).expect(401);
    const client = await signIn(casey.email);
    await client.post("/api/quotes").send({ quoteRequestId }).expect(403);

    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteRequestId);
    await client.get(`/api/quotes/${draft.id}`).expect(403);
    await client.patch(`/api/quotes/${draft.id}`).send(edit(draft)).expect(403);
    await client.post(`/api/quotes/${draft.id}/send`).expect(403);
  });

  test("starts from the Suggested Price for both Clean Types, Deep Clean recommended", async () => {
    const quoteRequestId = await asked(["Inside the oven"]);
    const office = await signInAsOffice();
    const { suggested } = await requestDetail(office, quoteRequestId);

    const draft = await startDraft(office, quoteRequestId);

    expect(draft).toMatchObject({
      status: "draft",
      crewSize: 2,
      depositPercent: 25,
      validityDays: 14,
      proposedStart: null,
      sentAt: null,
      addOns: [{ name: "Inside the oven" }],
    });
    expect(draft.options.map((o) => [o.cleanType, o.recommended])).toEqual([
      ["deep", true],
      ["standard", false],
    ]);
    expect(option(draft, "deep")).toMatchObject({
      suggested: suggested.deep,
      overrideCents: null,
      priceCents: suggested.deep.priceCents,
      taxCents: suggested.deep.taxCents,
      totalCents: suggested.deep.totalCents,
      labourHours: suggested.deep.labourHours,
      hoursOnSite: suggested.deep.labourHours / 2,
    });
    expect(option(draft, "standard").totalCents).toBe(
      suggested.standard.totalCents,
    );
  });

  test("a request has one Draft at a time", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteRequestId);

    const again = await office
      .post("/api/quotes")
      .send({ quoteRequestId })
      .expect(200);

    expect(again.body.id).toBe(draft.id);
  });

  test("an override needs a reason, and has no lower bound", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteRequestId);

    const refused = await office
      .patch(`/api/quotes/${draft.id}`)
      .send(
        edit(draft, {
          overrides: {
            deep: { priceCents: 5000, reason: " " },
            standard: null,
          },
        }),
      )
      .expect(400);
    expect(refused.body.details).toContainEqual(
      expect.objectContaining({
        path: "overrides.deep.reason",
        issue: "Say why you're changing the Suggested Price",
      }),
    );

    // below the $100 Minimum Charge
    const saved = await save(office, draft, {
      overrides: {
        deep: { priceCents: 5000, reason: "Friend of the owner" },
        standard: null,
      },
    });
    expect(option(saved, "deep")).toMatchObject({
      suggested: option(draft, "deep").suggested,
      overrideCents: 5000,
      overrideReason: "Friend of the owner",
      priceCents: 5000,
      // 8.875%, to the cent
      taxCents: 444,
      totalCents: 5444,
    });
    expect(option(saved, "standard")).toMatchObject({
      overrideCents: null,
      priceCents: option(draft, "standard").priceCents,
    });
  });

  test("Add-ons, Crew Size, Deposit and validity can be changed", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteRequestId);
    const oven = draft.addOnChoices.find((a) => a.name === "Inside the oven")!;

    const saved = await save(office, draft, {
      addOns: [oven.key],
      crewSize: 3,
      depositPercent: 50,
      validityDays: 7,
    });

    expect(saved).toMatchObject({
      crewSize: 3,
      depositPercent: 50,
      validityDays: 7,
    });
    expect(saved.addOns).toEqual([
      // 0.5 h at $55, plus 8.875% tax
      { key: oven.key, name: "Inside the oven", totalCents: 2994 },
    ]);
    const deep = option(saved, "deep");
    expect(deep.labourHours).toBe(option(draft, "deep").labourHours + 0.5);
    expect(deep.hoursOnSite).toBe(
      Math.round((deep.labourHours / 3) * 100) / 100,
    );
    expect(deep.depositCents).toBe(Math.round(deep.totalCents / 2));

    await office
      .patch(`/api/quotes/${draft.id}`)
      .send(edit(draft, { addOns: [crypto.randomUUID()] }))
      .expect(400);
  });
});

describe("sending a Quote", () => {
  test("needs a proposed time that's still to come", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteRequestId);

    const none = await office.post(`/api/quotes/${draft.id}/send`).expect(400);
    expect(none.body.details[0]).toMatchObject({
      path: "proposedStart",
      issue: "Choose a proposed time",
    });

    await save(office, draft, {
      proposedStart: { date: "2026-01-02", time: "09:00" },
    });
    const past = await office.post(`/api/quotes/${draft.id}/send`).expect(400);
    expect(past.body.details[0].issue).toBe(
      "Choose a time that's still to come",
    );
  });

  test("emails the Client a plain link to the Quote", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();

    const quote = await sentQuote(office, quoteRequestId);

    expect(quote).toMatchObject({
      status: "sent",
      proposedStart: nextMonday,
      proposedStartsAt: "2026-01-12T14:00:00.000Z",
      sentAt: "2026-01-05T09:00:00.000Z",
    });
    const sent = testEmail().lastTo(casey.email);
    expect(sent.subject).toBe("Your Quote from Empire Cleaning");
    expect(sent.text).toContain("Deep Clean (recommended)");
    // the only link is to the Quote's page, with no token on it
    expect(sent.text.match(/https?:\/\/\S+/g)).toEqual([
      expect.stringMatching(new RegExp(`/portal/quotes/${quote.id}$`)),
    ]);
  });

  test("a Sent Quote never changes", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteRequestId);

    await office
      .patch(`/api/quotes/${quote.id}`)
      .send(edit(quote, { crewSize: 4 }))
      .expect(409);
    await office.post(`/api/quotes/${quote.id}/send`).expect(409);
  });

  test("changing the Price List doesn't change a Sent Quote", async () => {
    const quoteRequestId = await asked(["Inside the oven"]);
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteRequestId);
    const client = await signIn(casey.email);
    const before = (
      await client.get(`/api/quotes/mine/${quote.id}`).expect(200)
    ).body as QuoteView;

    const list = (await office.get("/api/price-list").expect(200))
      .body as PriceList;
    await office
      .put("/api/price-list")
      .send({ ...list, hourlyRateCents: 9900, depositPercent: 40 })
      .expect(200);

    const office2 = (await office.get(`/api/quotes/${quote.id}`).expect(200))
      .body as OfficeQuote;
    expect(office2.options).toEqual(quote.options);
    expect(office2.addOns).toEqual(quote.addOns);
    expect(
      (await client.get(`/api/quotes/mine/${quote.id}`).expect(200)).body,
    ).toEqual(before);
  });

  test("sending another Supersedes the open one", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const first = await sentQuote(office, quoteRequestId);

    const second = await sentQuote(office, quoteRequestId, { crewSize: 3 });

    const { quotes } = await requestDetail(office, quoteRequestId);
    expect(quotes.map((q) => [q.id, q.status])).toEqual([
      [second.id, "sent"],
      [first.id, "superseded"],
    ]);
  });
});

describe("a Client's Quotes", () => {
  test("never include Drafts", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteRequestId);
    const client = await signIn(casey.email);

    expect((await client.get("/api/quotes/mine").expect(200)).body).toEqual([]);
    await client.get(`/api/quotes/mine/${draft.id}`).expect(404);

    await save(office, draft, { proposedStart: nextMonday });
    await office.post(`/api/quotes/${draft.id}/send`).expect(200);
    const mine = (await client.get("/api/quotes/mine").expect(200))
      .body as QuoteSummary[];
    expect(mine.map((q) => [q.id, q.status])).toEqual([[draft.id, "sent"]]);
  });

  test("show both Clean Types with tax, Deposit and time on site", async () => {
    const quoteRequestId = await asked(["Inside the oven"]);
    const office = await signInAsOffice();
    const sent = await sentQuote(office, quoteRequestId);
    const client = await signIn(casey.email);

    const quote = (await client.get(`/api/quotes/mine/${sent.id}`).expect(200))
      .body as QuoteView;

    expect(quote).toMatchObject({
      status: "sent",
      property: { street: home.street },
      crewSize: 2,
      depositPercent: 25,
      proposedStartsAt: "2026-01-12T14:00:00.000Z",
      expiresAt: "2026-01-12T14:00:00.000Z",
      addOns: [{ name: "Inside the oven", totalCents: 2994 }],
    });
    const deep = option(sent, "deep");
    expect(quote.options[0]).toEqual({
      cleanType: "deep",
      recommended: true,
      labourHours: deep.labourHours,
      hoursOnSite: deep.hoursOnSite,
      priceCents: deep.priceCents,
      taxCents: deep.taxCents,
      totalCents: deep.totalCents,
      depositCents: deep.depositCents,
    });
    // nothing about how the Office priced it
    expect(quote.options[0]).not.toHaveProperty("suggested");
  });

  test("are only their own", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteRequestId);
    await submit(
      guestRequest({
        contact: { ...casey, name: "Drew Client", email: "drew@example.com" },
        property: { new: { ...home, street: "7 Queens Blvd" } },
      }),
    ).expect(201);
    const drew = await signIn("drew@example.com");

    await drew.get(`/api/quotes/mine/${quote.id}`).expect(404);
    await drew.post(`/api/quotes/mine/${quote.id}/decline`).expect(404);
    expect((await drew.get("/api/quotes/mine").expect(200)).body).toEqual([]);
  });

  test("can Decline a Sent Quote, which ends the request", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteRequestId);
    const client = await signIn(casey.email);

    const declined = await client
      .post(`/api/quotes/mine/${quote.id}/decline`)
      .expect(200);
    expect(declined.body).toMatchObject({
      status: "declined",
      declinedAt: "2026-01-05T09:00:00.000Z",
    });
    await client.post(`/api/quotes/mine/${quote.id}/decline`).expect(409);

    expect((await requestDetail(office, quoteRequestId)).state).toBe("ended");
    await office.post("/api/quotes").send({ quoteRequestId }).expect(409);
    // the Client can ask again about the same home
    await submit(guestRequest()).expect(201);
  });
});

describe("Expiry", () => {
  test("comes at the end of the validity period", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteRequestId, {
      proposedStart: { date: "2026-03-02", time: "09:00" },
      validityDays: 7,
    });
    const client = await signIn(casey.email);
    expect(quote.expiresAt).toBe("2026-01-12T09:00:00.000Z");

    testClock().set(new Date("2026-01-12T08:59:00Z"));
    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "sent",
    );
    testClock().set(new Date("2026-01-12T09:00:00Z"));
    expect((await client.get(`/api/quotes/mine/${quote.id}`)).body.status).toBe(
      "expired",
    );
    await client.post(`/api/quotes/mine/${quote.id}/decline`).expect(409);
  });

  test("comes at the proposed time if that's sooner", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteRequestId);

    expect(quote.expiresAt).toBe(quote.proposedStartsAt);
    testClock().set(new Date(quote.proposedStartsAt!));
    expect(
      (await office.get(`/api/quotes/${quote.id}`).expect(200)).body.status,
    ).toBe("expired");
  });

  test("puts the request back to awaiting a Quote, for the Office to send another", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const first = await sentQuote(office, quoteRequestId);
    expect((await requestDetail(office, quoteRequestId)).state).toBe("quoted");

    testClock().set(new Date(first.expiresAt!));
    expect((await requestDetail(office, quoteRequestId)).state).toBe(
      "awaiting_quote",
    );

    await sentQuote(office, quoteRequestId, {
      proposedStart: { date: "2026-01-20", time: "09:00" },
    });
    const { quotes } = await requestDetail(office, quoteRequestId);
    expect(quotes.map((q) => q.status)).toEqual(["sent", "expired"]);
  });
});

describe("Needs attention", () => {
  // with no Cleaners here every Sent Quote's day has no room, which is its
  // own kind of item (accept.test.ts): these tests leave it out
  const items = async (office: Agent) =>
    (
      (await office.get("/api/dashboard/needs-attention").expect(200))
        .body as NeedsAttentionItem[]
    ).filter((i) => i.kind !== "quote_no_room");

  test("drops a request once its Quote is Sent", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    await startDraft(office, quoteRequestId);
    expect((await items(office)).map((i) => i.kind)).toEqual(["quote_request"]);

    await sentQuote(office, quoteRequestId);

    expect(await items(office)).toEqual([]);
  });

  test("shows Sent Quotes within 48 hours of Expiring", async () => {
    const quoteRequestId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteRequestId, {
      proposedStart: { date: "2026-03-02", time: "09:00" },
    });
    // Expires on 19 January at 09:00 UTC
    testClock().set(new Date("2026-01-17T08:59:00Z"));
    expect(await items(office)).toEqual([]);

    testClock().set(new Date("2026-01-17T09:00:00Z"));
    expect(await items(office)).toEqual([
      {
        kind: "quote_expiring",
        since: "2026-01-17T09:00:00.000Z",
        quote: expect.objectContaining({
          id: quote.id,
          status: "sent",
          client: expect.objectContaining({ name: casey.name }),
          expiresAt: "2026-01-19T09:00:00.000Z",
        }),
      },
    ]);
  });
});
