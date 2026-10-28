import { describe, expect, test } from "vitest";
import type {
  AskedQuoteView,
  NeedsAttentionItem,
  OfficeQuote,
  OfficeQuoteOption,
  PriceList,
  QuoteDraftInput,
  QuoteSummary,
  QuoteView,
} from "@empire-cleaning/models";
import { api, signIn, testClock, testEmail } from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  home,
  setService,
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
  const { body } = await submit(guestAsk({ addOns })).expect(201);
  return body.id as string;
};

const quoteOf = async (office: Agent, id: string) =>
  (await office.get(`/api/quotes/${id}`).expect(200)).body as OfficeQuote;

const startDraft = async (office: Agent, quoteId: string) =>
  (await office.post(`/api/quotes/${quoteId}/revisions`).send({}).expect(201))
    .body as OfficeQuote;

// what a Quote's Draft Revision is now (or, with none, its offer), as a
// PATCH body, with changes
const edit = (
  quote: OfficeQuote,
  changes: Partial<QuoteDraftInput> = {},
): QuoteDraftInput => {
  const revision = (quote.draft ?? quote.offer)!;
  return {
    addOns: revision.addOns.map((a) => a.key),
    crewSize: revision.crewSize,
    depositPercent: revision.depositPercent,
    validityDays: revision.validityDays,
    proposedStart: revision.proposedStart,
    overrides: {
      deep: revision.options[0]!.overrideCents
        ? {
            priceCents: revision.options[0]!.overrideCents,
            reason: revision.options[0]!.overrideReason!,
          }
        : null,
      standard: null,
    },
    ...changes,
  };
};

const save = async (
  office: Agent,
  quote: OfficeQuote,
  changes: Partial<QuoteDraftInput>,
) =>
  (
    await office
      .patch(`/api/quotes/${quote.id}/draft`)
      .send(edit(quote, changes))
      .expect(200)
  ).body as OfficeQuote;

// the Quote's Draft Revision (started now, or the one it has) with a
// proposed time, sent
const sentQuote = async (
  office: Agent,
  quoteId: string,
  changes: Partial<QuoteDraftInput> = {},
) => {
  const draft = (await office.post(`/api/quotes/${quoteId}/revisions`).send({}))
    .body as OfficeQuote;
  await save(office, draft, { proposedStart: nextMonday, ...changes });
  return (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
    .body as OfficeQuote;
};

// a Clean Type's option on the Quote's Draft Revision, or else its offer
const option = (quote: OfficeQuote, cleanType: string): OfficeQuoteOption =>
  (quote.draft ?? quote.offer)!.options.find((o) => o.cleanType === cleanType)!;

describe("drafting a First Clean Quote", () => {
  test("is only for Office Staff", async () => {
    const quoteId = await asked();
    await api().post(`/api/quotes/${quoteId}/revisions`).send({}).expect(401);
    const client = await signIn(casey.email);
    await client.post(`/api/quotes/${quoteId}/revisions`).send({}).expect(403);

    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteId);
    await client.get(`/api/quotes/${draft.id}`).expect(403);
    await client
      .patch(`/api/quotes/${draft.id}/draft`)
      .send(edit(draft))
      .expect(403);
    await client.post(`/api/quotes/${draft.id}/send`).expect(403);
  });

  test("starts from the Suggested Price for both Clean Types, Deep Clean recommended", async () => {
    const quoteId = await asked(["Inside the oven"]);
    const office = await signInAsOffice();
    const { suggested } = await quoteOf(office, quoteId);

    const draft = await startDraft(office, quoteId);

    expect(draft).toMatchObject({
      kind: "one_off",
      status: "draft",
      offer: null,
      revisions: [],
      draft: {
        number: 1,
        status: "draft",
        crewSize: 2,
        depositPercent: 25,
        validityDays: 14,
        proposedStart: null,
        sentAt: null,
        addOns: [{ name: "Inside the oven" }],
      },
    });
    expect(
      draft.draft!.options.map((o) => [o.cleanType, o.recommended]),
    ).toEqual([
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

  test("a Quote drafts one Revision at a time", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteId);

    const again = (
      await office.post(`/api/quotes/${quoteId}/revisions`).send({}).expect(200)
    ).body as OfficeQuote;

    expect(again.draft!.id).toBe(draft.draft!.id);
  });

  test("its first Revision sets its kind, which then can't change", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    await startDraft(office, quoteId);

    const other = await office
      .post(`/api/quotes/${quoteId}/revisions`)
      .send({ kind: "service_plan" })
      .expect(409);

    expect(other.body.message).toBe(
      "This is a one-off Quote: its kind can't change. Start a new Quote for the other.",
    );
    expect((await quoteOf(office, quoteId)).kind).toBe("one_off");
  });

  test("an override needs a reason, and has no lower bound", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteId);

    const refused = await office
      .patch(`/api/quotes/${draft.id}/draft`)
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
    const quoteId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteId);
    const oven = draft.addOnChoices.find((a) => a.name === "Inside the oven")!;

    const saved = await save(office, draft, {
      addOns: [oven.key],
      crewSize: 3,
      depositPercent: 50,
      validityDays: 7,
    });

    expect(saved.draft).toMatchObject({
      crewSize: 3,
      depositPercent: 50,
      validityDays: 7,
    });
    expect(saved.draft!.addOns).toEqual([
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
      .patch(`/api/quotes/${draft.id}/draft`)
      .send(edit(draft, { addOns: [crypto.randomUUID()] }))
      .expect(400);
  });
});

describe("sending a Quote", () => {
  test("needs a proposed time that's still to come", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteId);

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
    const quoteId = await asked();
    const office = await signInAsOffice();

    const quote = await sentQuote(office, quoteId);

    expect(quote).toMatchObject({
      status: "sent",
      draft: null,
      offer: {
        number: 1,
        status: "sent",
        proposedStart: nextMonday,
        proposedStartsAt: "2026-01-12T14:00:00.000Z",
        sentAt: "2026-01-05T09:00:00.000Z",
      },
    });
    const sent = testEmail().lastTo(casey.email);
    expect(sent.subject).toBe("Your Quote from Empire Cleaning");
    expect(sent.text).toContain("Deep Clean (recommended)");
    // the only link is to the Quote's page, with no token on it
    expect(sent.text.match(/https?:\/\/\S+/g)).toEqual([
      expect.stringMatching(new RegExp(`/portal/quotes/${quote.id}$`)),
    ]);
  });

  test("a Sent Revision never changes", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteId);

    await office
      .patch(`/api/quotes/${quote.id}/draft`)
      .send(edit(quote, { crewSize: 4 }))
      .expect(409);
    await office.post(`/api/quotes/${quote.id}/send`).expect(409);
  });

  test("changing the Price List doesn't change a Sent Quote", async () => {
    const quoteId = await asked(["Inside the oven"]);
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteId);
    const client = await signIn(casey.email);
    const before = (
      await client.get(`/api/quotes/mine/${quote.id}`).expect(200)
    ).body as QuoteView;

    const list = (await office.get("/api/price-list").expect(200))
      .body as PriceList;
    await office
      .put("/api/price-list")
      .send({ ...list, depositPercent: 40 })
      .expect(200);
    await setService(office, "standard", { hourlyRateCents: 9900 });
    await setService(office, "deep", { hourlyRateCents: 9900 });

    const office2 = (await office.get(`/api/quotes/${quote.id}`).expect(200))
      .body as OfficeQuote;
    expect(office2.offer!.options).toEqual(quote.offer!.options);
    expect(office2.offer!.addOns).toEqual(quote.offer!.addOns);
    expect(
      (await client.get(`/api/quotes/mine/${quote.id}`).expect(200)).body,
    ).toEqual(before);
  });
});

describe("a new Revision", () => {
  test("starts from the offer's terms, and leaves the Quote Sent until it's sent", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const first = await sentQuote(office, quoteId, { crewSize: 3 });
    const client = await signIn(casey.email);

    const revising = await startDraft(office, quoteId);

    expect(revising).toMatchObject({
      status: "sent",
      draft: { number: 2, crewSize: 3, proposedStart: nextMonday },
      offer: { number: 1 },
    });
    // the Client sees only the offer, and no Draft
    const mine = (await client.get(`/api/quotes/mine/${quoteId}`).expect(200))
      .body as QuoteView;
    expect(mine).toMatchObject({
      status: "sent",
      crewSize: 3,
      updatedAt: null,
    });
    expect(mine.sentAt).toBe(first.offer!.sentAt);
  });

  test("replaces the offer when sent, in the same Quote, with the older one kept as history", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const first = await sentQuote(office, quoteId);
    testClock().advance({ hours: 1 });

    const second = await sentQuote(office, quoteId, { crewSize: 3 });

    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({
      status: "sent",
      draft: null,
      offer: { number: 2, crewSize: 3, sentAt: "2026-01-05T10:00:00.000Z" },
    });
    expect(second.revisions.map((r) => [r.number, r.sentAt])).toEqual([
      [2, "2026-01-05T10:00:00.000Z"],
      [1, "2026-01-05T09:00:00.000Z"],
    ]);
    // never changed: the first is as it was sent
    expect(second.revisions[1]).toEqual(first.revisions[0]);
    const listed = (await office.get("/api/quotes").expect(200))
      .body as QuoteSummary[];
    expect(listed.map((q) => [q.id, q.status])).toEqual([[quoteId, "sent"]]);
    // its email says the Quote has changed, and links to the same Quote
    const sent = testEmail().lastTo(casey.email);
    expect(sent.subject).toBe("Your updated Quote from Empire Cleaning");
    expect(sent.text).toContain("has been updated");
    expect(sent.text).toContain(`/portal/quotes/${quoteId}`);
    // the Client sees only the new offer, which says it was updated
    const client = await signIn(casey.email);
    expect(
      (await client.get(`/api/quotes/mine/${quoteId}`).expect(200)).body,
    ).toMatchObject({
      crewSize: 3,
      sentAt: "2026-01-05T10:00:00.000Z",
      updatedAt: "2026-01-05T10:00:00.000Z",
    });
  });

  test("can't be started once the Quote is Accepted, Declined or Turned Down", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    await sentQuote(office, quoteId);
    const client = await signIn(casey.email);
    await client.post(`/api/quotes/mine/${quoteId}/decline`).expect(200);

    const refused = await office
      .post(`/api/quotes/${quoteId}/revisions`)
      .send({})
      .expect(409);

    expect(refused.body.message).toBe(
      "The Client declined this Quote, so it has ended. They can ask for a new Quote.",
    );
  });
});

describe("a Client's Quotes", () => {
  test("show what they asked for, but never a Draft Revision", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const draft = await startDraft(office, quoteId);
    const client = await signIn(casey.email);

    const asking = (await client.get("/api/quotes/mine").expect(200))
      .body as QuoteSummary[];
    expect(asking).toMatchObject([
      {
        id: quoteId,
        status: "requested",
        asked: { condition: "moderate" },
        headlineTotalCents: null,
        proposedStartsAt: null,
        drafting: false,
      },
    ]);
    // what they asked, Requested still, with nothing of the Draft
    expect(
      (await client.get(`/api/quotes/mine/${draft.id}`).expect(200)).body,
    ).toEqual({
      id: quoteId,
      status: "requested",
      property: {
        id: draft.property.id,
        street: home.street,
        unit: home.unit ?? null,
        postcode: home.postcode,
      },
      asked: expect.objectContaining({ condition: "moderate" }),
      createdAt: draft.createdAt,
      sentAt: null,
      siteVisit: null,
      turnedDownAt: null,
      turnDownReason: null,
    } satisfies AskedQuoteView);

    await save(office, draft, { proposedStart: nextMonday });
    await office.post(`/api/quotes/${draft.id}/send`).expect(200);
    const mine = (await client.get("/api/quotes/mine").expect(200))
      .body as QuoteSummary[];
    expect(mine.map((q) => [q.id, q.status])).toEqual([[draft.id, "sent"]]);
  });

  test("show both Clean Types with tax, Deposit and time on site", async () => {
    const quoteId = await asked(["Inside the oven"]);
    const office = await signInAsOffice();
    const sent = await sentQuote(office, quoteId);
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
    const quoteId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteId);
    await submit(
      guestAsk({
        contact: { ...casey, name: "Drew Client", email: "drew@example.com" },
        property: { new: { ...home, street: "7 Queens Blvd" } },
      }),
    ).expect(201);
    const drew = await signIn("drew@example.com");

    await drew.get(`/api/quotes/mine/${quote.id}`).expect(404);
    await drew.post(`/api/quotes/mine/${quote.id}/decline`).expect(404);
    // only the one Drew asked for
    const mine = (await drew.get("/api/quotes/mine").expect(200))
      .body as QuoteSummary[];
    expect(mine.map((q) => q.property.street)).toEqual(["7 Queens Blvd"]);
  });

  test("can Decline a Sent Quote, which ends it", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteId);
    const client = await signIn(casey.email);

    const declined = await client
      .post(`/api/quotes/mine/${quote.id}/decline`)
      .expect(200);
    expect(declined.body).toMatchObject({
      status: "declined",
      declinedAt: "2026-01-05T09:00:00.000Z",
    });
    await client.post(`/api/quotes/mine/${quote.id}/decline`).expect(409);

    expect((await quoteOf(office, quoteId)).status).toBe("declined");
    await office.post(`/api/quotes/${quoteId}/revisions`).send({}).expect(409);
    // the Client can ask again about the same home: a new Quote
    const again = await submit(guestAsk()).expect(201);
    expect(again.body.id).not.toBe(quoteId);
  });
});

describe("Expiry", () => {
  test("comes at the end of the validity period", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteId, {
      proposedStart: { date: "2026-03-02", time: "09:00" },
      validityDays: 7,
    });
    const client = await signIn(casey.email);
    expect(quote.offer!.expiresAt).toBe("2026-01-12T09:00:00.000Z");

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
    const quoteId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteId);

    expect(quote.offer!.expiresAt).toBe(quote.offer!.proposedStartsAt);
    testClock().set(new Date(quote.offer!.proposedStartsAt!));
    expect(
      (await office.get(`/api/quotes/${quote.id}`).expect(200)).body.status,
    ).toBe("expired");
  });

  test("can be revived by Office Staff sending a new Revision", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const first = await sentQuote(office, quoteId);

    testClock().set(new Date(first.offer!.expiresAt!));
    expect((await quoteOf(office, quoteId)).status).toBe("expired");

    const revived = await sentQuote(office, quoteId, {
      proposedStart: { date: "2026-01-20", time: "09:00" },
    });
    expect(revived).toMatchObject({
      id: quoteId,
      status: "sent",
      offer: { number: 2 },
    });
  });

  test("stays on the Office's list for 30 days, to be revived", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const first = await sentQuote(office, quoteId);
    const listed = async () =>
      (
        (await office.get("/api/quotes").expect(200)).body as QuoteSummary[]
      ).map((q) => [q.id, q.status]);

    const expiry = new Date(first.offer!.expiresAt!).getTime();
    testClock().set(new Date(expiry + 30 * 86_400_000 - 60_000));
    expect(await listed()).toEqual([[quoteId, "expired"]]);
    testClock().set(new Date(expiry + 30 * 86_400_000));
    expect(await listed()).toEqual([]);
  });

  test("lets the Client ask again, which starts a new Quote", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const first = await sentQuote(office, quoteId);
    const refused = await submit(guestAsk()).expect(409);
    expect(refused.body.message).toBe(
      "We've sent you a Quote for this home already: you'll find it in your account.",
    );

    testClock().set(new Date(first.offer!.expiresAt!));
    const again = await submit(guestAsk()).expect(201);

    expect(again.body.id).not.toBe(quoteId);
    expect((await quoteOf(office, again.body.id)).status).toBe("requested");
  });

  test("can't be revived while a newer Quote of its kind is open", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const first = await sentQuote(office, quoteId);
    testClock().set(new Date(first.offer!.expiresAt!));
    const newer = await submit(guestAsk()).expect(201);

    const whileRequested = await office
      .post(`/api/quotes/${quoteId}/revisions`)
      .send({})
      .expect(409);
    expect(whileRequested.body.message).toBe(
      "A newer one-off Quote is open for this home: carry on with that one.",
    );

    await startDraft(office, newer.body.id);
    await office.post(`/api/quotes/${quoteId}/revisions`).send({}).expect(409);
    // stood aside for the newer one
    expect((await quoteOf(office, quoteId)).status).toBe("expired");
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

  test("shows a Quote asked for until a Revision of it is Sent", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    expect((await items(office)).map((i) => i.kind)).toEqual([
      "quote_requested",
    ]);
    await startDraft(office, quoteId);
    expect((await items(office)).map((i) => i.kind)).toEqual([
      "quote_requested",
    ]);

    await sentQuote(office, quoteId);

    expect(await items(office)).toEqual([]);
  });

  test("shows Sent Quotes within 48 hours of Expiring", async () => {
    const quoteId = await asked();
    const office = await signInAsOffice();
    const quote = await sentQuote(office, quoteId, {
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
