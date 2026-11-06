import { describe, expect, test } from "vitest";
import type {
  NeedsAttentionItem,
  OfficeQuote,
  QuoteSummary,
} from "@empire-cleaning/models";
import { type Agent, api, signIn, testEmail } from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  holdingProperty,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

// the test clock starts at 4am on Monday 5 January 2026 in New York
const nextMonday = { date: "2026-01-12", time: "09:00" };

const turnDown = (office: Agent, id: string, reason = "out_of_area") =>
  office.post(`/api/quotes/${id}/turn-down`).send({ reason });

const asked = async () => {
  const { body } = await submit(guestAsk()).expect(201);
  return body.id as string;
};

const draftOf = async (office: Agent, id: string) =>
  (await office.post(`/api/quotes/${id}/revisions`).send({}).expect(201))
    .body as OfficeQuote;

// saves the Draft as it is, for next Monday
const saveFor = (office: Agent, draft: OfficeQuote) =>
  office.patch(`/api/quotes/${draft.id}/draft`).send({
    addOns: [],
    crewSize: draft.draft!.crewSize,
    depositPercent: draft.draft!.depositPercent,
    validityDays: draft.draft!.validityDays,
    proposedStart: nextMonday,
    overrides: {},
  });

describe("Turning Down a Quote", () => {
  test("closes a Requested Quote with a reason, and emails the Client", async () => {
    const id = await asked();
    const office = await signInAsOffice();

    const turned = (await turnDown(office, id).expect(200)).body as OfficeQuote;

    expect(turned).toMatchObject({
      status: "turned_down",
      kind: null,
      turnedDownAt: "2026-01-05T09:00:00.000Z",
      turnDownReason: "out_of_area",
    });
    const sent = testEmail().lastTo(casey.email);
    expect(sent.subject).toBe("About your Quote from Empire Cleaning");
    expect(sent.text).toContain(
      "we can't quote for it: it's outside the area we clean.",
    );
    expect(sent.text).toContain(`/portal/quotes/${id}`);
    // closed: off the Office's open list and Needs attention
    expect((await office.get("/api/quotes").expect(200)).body).toEqual([]);
    const waiting = (
      (await office.get("/api/dashboard/needs-attention").expect(200))
        .body as NeedsAttentionItem[]
    ).filter((i) => i.kind === "quote_requested");
    expect(waiting).toEqual([]);
    // the Client sees it, and can ask again: a new Quote
    const client = await signIn(casey.email);
    const mine = (await client.get("/api/quotes/mine").expect(200))
      .body as QuoteSummary[];
    expect(mine.map((q) => [q.id, q.status, q.turnDownReason])).toEqual([
      [id, "turned_down", "out_of_area"],
    ]);
    expect(
      (await client.get(`/api/quotes/mine/${id}`).expect(200)).body,
    ).toMatchObject({
      status: "turned_down",
      sentAt: null,
      turnedDownAt: "2026-01-05T09:00:00.000Z",
      turnDownReason: "out_of_area",
    });
    const again = await submit(guestAsk()).expect(201);
    expect(again.body.id).not.toBe(id);
  });

  test("can close a Draft whose first Revision isn't Sent", async () => {
    const id = await asked();
    const office = await signInAsOffice();
    await draftOf(office, id);

    const turned = (await turnDown(office, id, "no_capacity").expect(200))
      .body as OfficeQuote;

    expect(turned).toMatchObject({
      status: "turned_down",
      kind: "one_off",
      turnDownReason: "no_capacity",
    });
    expect(testEmail().lastTo(casey.email).text).toContain(
      "we don't have room for it at the moment",
    );
    // final
    await office.post(`/api/quotes/${id}/revisions`).send({}).expect(409);
    await turnDown(office, id).expect(409);
  });

  test("is refused once a Revision has been Sent", async () => {
    const id = await asked();
    const office = await signInAsOffice();
    const draft = await draftOf(office, id);
    await saveFor(office, draft).expect(200);
    await office.post(`/api/quotes/${id}/send`).expect(200);
    // even while a newer Revision is being drafted
    await draftOf(office, id);

    const refused = await turnDown(office, id).expect(409);

    expect(refused.body.message).toBe(
      "A Revision of this Quote has been sent, so it can't be Turned Down: the Client declines it, or it Expires.",
    );
  });

  test("drops the Draft, which can then be neither saved nor sent", async () => {
    const id = await asked();
    const office = await signInAsOffice();
    const draft = await draftOf(office, id);

    const turned = (await turnDown(office, id).expect(200)).body as OfficeQuote;

    expect(turned.draft).toBeNull();
    const saved = await saveFor(office, draft).expect(409);
    expect(saved.body.message).toBe(
      "This Quote was Turned Down. The Client can ask for a new Quote.",
    );
    await office.post(`/api/quotes/${id}/send`).expect(409);
  });

  test("waits its turn behind a send, and is then refused", async () => {
    const id = await asked();
    const office = await signInAsOffice();
    const draft = await draftOf(office, id);
    await saveFor(office, draft).expect(200);

    const [sent, turned] = await holdingProperty(draft.property.id, [
      () => office.post(`/api/quotes/${id}/send`),
      () => turnDown(office, id),
    ]);

    expect(sent!.status).toBe(200);
    expect(turned!.status).toBe(409);
    expect(turned!.body.message).toBe(
      "A Revision of this Quote has been sent, so it can't be Turned Down: the Client declines it, or it Expires.",
    );
    expect(
      (await office.get(`/api/quotes/${id}`).expect(200)).body,
    ).toMatchObject({ status: "sent", turnedDownAt: null });
  });

  test("needs one of the reasons", async () => {
    const id = await asked();
    const office = await signInAsOffice();

    const refused = await turnDown(office, id, "too far").expect(400);

    expect(refused.body.details[0]).toMatchObject({
      path: "reason",
      issue: "Choose why: out of area, out of scope or no capacity",
    });
  });

  test("emails nobody when the Office entered the Client without an email", async () => {
    const office = await signInAsOffice();
    const { body } = await office
      .post("/api/quotes/caller")
      .send({
        ...guestAsk(),
        contact: { name: "Pat Phoner", phone: "(718) 555-0123", email: null },
      })
      .expect(201);
    const before = testEmail().sent.length;

    await turnDown(office, body.quoteId, "out_of_scope").expect(200);

    expect(testEmail().sent).toHaveLength(before);
  });

  test("is only for Office Staff", async () => {
    const id = await asked();
    const client = await signIn(casey.email);

    await turnDown(api() as unknown as Agent, id).expect(401);
    await turnDown(client, id).expect(403);
  });
});
