import { describe, expect, test } from "vitest";
import type {
  OfficeJob,
  OfficeQuote,
  QuoteDraftInput,
  SignedInAccount,
} from "@empire-cleaning/models";
import { signIn } from "../../../tests/harness.ts";
import {
  completedFirstClean,
  guestAsk,
  setService,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "#features/services";

// Quotes are for the Service asked for (ADR-0018)

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York
const nextMonday = { date: "2026-01-12", time: "09:00" };

const ask = async (serviceKey?: string) =>
  (await submit(guestAsk({ serviceKey })).expect(201)).body.id as string;

const startDraft = async (office: Agent, quoteId: string) =>
  (await office.post(`/api/quotes/${quoteId}/revisions`).send({}).expect(201))
    .body as OfficeQuote;

// the Draft as it is, with changes, as a PATCH body
const edit = (
  quote: OfficeQuote,
  changes: Partial<QuoteDraftInput> = {},
): QuoteDraftInput => ({
  addOns: quote.draft!.addOns.map((a) => a.key),
  crewSize: quote.draft!.crewSize,
  depositPercent: quote.draft!.depositPercent,
  validityDays: quote.draft!.validityDays,
  proposedStart: quote.draft!.proposedStart,
  overrides: {},
  ...changes,
});

const optionsOf = (quote: OfficeQuote) =>
  (quote.draft ?? quote.offer)!.options.map((o) => [
    o.serviceName,
    o.recommended,
  ]);

const firstCleanDone = async (serviceKey?: string) => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const done = await completedFirstClean({ byAccountId: me.id, serviceKey });
  return { office, ...done };
};

describe("a one-off Quote", () => {
  test("is for a home's first Service when the ask names none, recommending a Deep Clean for a first visit", async () => {
    const office = await signInAsOffice();
    const draft = await startDraft(office, await ask());

    expect(draft.service.name).toBe("Standard Clean");
    expect(draft.asked!.service.name).toBe("Standard Clean");
    expect(optionsOf(draft)).toEqual([
      ["Deep Clean", true],
      ["Standard Clean", false],
    ]);
    expect(draft.suggested.prices.map((p) => p.serviceName)).toEqual([
      "Deep Clean",
      "Standard Clean",
    ]);
  });

  test("offers only the Service asked for when it recommends none", async () => {
    const office = await signInAsOffice();
    const draft = await startDraft(office, await ask(SEEDED.moveInOut));

    expect(draft.service.name).toBe("Move-in/out Clean");
    expect(optionsOf(draft)).toEqual([["Move-in/out Clean", false]]);
  });

  test("can't be asked for a Service not offered for the kind of Property", async () => {
    const refused = await submit(
      guestAsk({ serviceKey: SEEDED.commercial }),
    ).expect(400);

    expect(refused.body.details).toContainEqual(
      expect.objectContaining({
        path: "serviceKey",
        issue: "Choose from the Services listed",
      }),
    );
  });

  test("offers no first-visit recommendation once a Job at the Property is Completed", async () => {
    const { office } = await firstCleanDone();
    const draft = await startDraft(office, await ask());

    expect(optionsOf(draft)).toEqual([["Standard Clean", false]]);
  });

  test("books the Service chosen, named on its Job", async () => {
    const { office, job } = await firstCleanDone(SEEDED.moveInOut);

    const booked = (await office.get(`/api/jobs/${job.id}`).expect(200))
      .body as OfficeJob;
    expect(booked.serviceName).toBe("Move-in/out Clean");
  });
});

describe("open Quotes at one Property", () => {
  test("can be for different Services side by side, but only one for each", async () => {
    await ask();
    await ask(SEEDED.moveInOut);

    const again = await submit(guestAsk()).expect(409);
    expect(again.body.message).toMatch(/already asked us for a Quote/);
  });

  test("a Requested one holds the Service Plan Quote only if its Service can recur", async () => {
    const { office, propertyId } = await firstCleanDone();
    // Move-in/out can't be on a plan
    await ask(SEEDED.moveInOut);
    const plan = await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(201);
    expect((plan.body as OfficeQuote).kind).toBe("service_plan");

    // a Standard Clean can, and the plan's Quote is open
    const refused = await submit(guestAsk()).expect(409);
    expect(refused.body.message).toMatch(/already asked us for a Quote/);
  });

  test("Office Staff can change a Draft's Service, unless that one has a Quote open", async () => {
    const office = await signInAsOffice();
    const standard = await startDraft(office, await ask());
    const moving = await startDraft(office, await ask(SEEDED.moveInOut));

    const changed = (
      await office
        .patch(`/api/quotes/${standard.id}/draft`)
        .send(edit(standard, { serviceKey: SEEDED.deep }))
        .expect(200)
    ).body as OfficeQuote;
    expect(changed.service.name).toBe("Deep Clean");
    expect(changed.draft!.serviceKey).toBe(SEEDED.deep);
    expect(optionsOf(changed)).toEqual([["Deep Clean", false]]);
    // what was asked stays as it was
    expect(changed.asked!.service.name).toBe("Standard Clean");

    const taken = await office
      .patch(`/api/quotes/${moving.id}/draft`)
      .send(edit(moving, { serviceKey: SEEDED.deep }))
      .expect(409);
    expect(taken.body.message).toBe(
      "This home has a Deep Clean Quote open already: carry on with that one.",
    );

    const notHere = await office
      .patch(`/api/quotes/${moving.id}/draft`)
      .send(edit(moving, { serviceKey: SEEDED.commercial }))
      .expect(400);
    expect(notHere.body.details).toContainEqual(
      expect.objectContaining({ path: "serviceKey" }),
    );
  });
});

describe("the First Clean and Site Visit follow the Service", () => {
  test("a Completed Move-in/out Clean isn't a First Clean, so no Service Plan yet", async () => {
    const { office, propertyId } = await firstCleanDone(SEEDED.moveInOut);

    const refused = await office
      .post("/api/quotes")
      .send({ propertyId, kind: "service_plan" })
      .expect(409);
    expect(refused.body.message).toBe(
      "A Service Plan can only start once this home's First Clean is Completed.",
    );
  });

  test("a Quote for a Service that needs a Site Visit can't be Sent until its findings are recorded", async () => {
    const office = await signInAsOffice();
    await setService(office, "moveInOut", { needsSiteVisit: true });
    const draft = await startDraft(office, await ask(SEEDED.moveInOut));
    expect(draft).toMatchObject({ needsSiteVisit: true, siteVisit: "needed" });

    await office
      .patch(`/api/quotes/${draft.id}/draft`)
      .send(edit(draft, { proposedStart: nextMonday }))
      .expect(200);
    const refused = await office
      .post(`/api/quotes/${draft.id}/send`)
      .expect(409);
    expect(refused.body.message).toBe(
      "This home hasn't had a Site Visit, so the Quote can't be sent. Record its findings on the Property, then send it.",
    );
  });
});
