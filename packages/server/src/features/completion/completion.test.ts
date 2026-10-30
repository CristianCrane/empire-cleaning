import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  AcceptOutcome,
  CleanerJob,
  ClientJob,
  ClientJobDetail,
  ClientPastJob,
  CompletionInput,
  NeedsAttentionItem,
  OfficeJob,
  OfficeQuote,
  PriceList,
  Today,
} from "@empire-cleaning/models";
import { db } from "#db";
import { chaseProposedAdjustments } from "#features/completion";
import { properties } from "#features/properties";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  api,
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "#features/services";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York. Jobs
// here are at 9am on Monday the 12th (14:00 UTC), with "Inside the oven" on
// the Quote; tests complete them at 11am that day.
const MONDAY_11AM = new Date("2026-01-12T16:00:00Z");

// the placeholder Price List: $55 an hour, tax 8.875%. Half an hour's Add-on
// is $27.50 + $2.44 tax; an extra hour is $55 + $4.88.
const HALF_HOUR_ADD_ON = 2994;
const EXTRA_HOUR = 5988;

const cleaner = async (name: string) => {
  const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
  const member = await createStaff({ name, email, roles: ["cleaner"] });
  await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
  return { ...member, email, signIn: () => signIn(email) };
};

const keyOf = (list: PriceList, name: string) =>
  list.addOns.find((a) => a.name === name)!.key;

type Booked = {
  office: Agent;
  client: Agent;
  cory: Awaited<ReturnType<typeof cleaner>> & { agent: Agent };
  jobId: string;
  quote: OfficeQuote;
  list: PriceList;
};

/**
 * Casey's Deep Clean, Quoted with "Inside the oven" for one Cleaner, Cory,
 * accepted with a card entered there and then, and Cory Confirmed on it.
 */
const bookedJob = async ({
  crewSize = 1,
  depositPercent = 25,
} = {}): Promise<Booked> => {
  const office = await signInAsOffice();
  const cory = await cleaner("Cory Cleaner");
  await cleaner("Dee Cleaner");
  const list = (await office.get("/api/price-list").expect(200))
    .body as PriceList;

  const { body } = await submit(guestAsk()).expect(201);
  const draft = (
    await office.post(`/api/quotes/${body.id}/revisions`).send({}).expect(201)
  ).body as OfficeQuote;
  await office
    .patch(`/api/quotes/${draft.id}/draft`)
    .send({
      addOns: [keyOf(list, "Inside the oven")],
      crewSize,
      depositPercent,
      validityDays: 7,
      proposedStart: { date: "2026-01-12", time: "09:00" },
      overrides: {},
    })
    .expect(200);
  const quote = (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
    .body as OfficeQuote;

  const client = await signIn(casey.email);
  const outcome = (
    await client
      .post(`/api/quotes/mine/${quote.id}/accept`)
      .send({
        serviceKey: SEEDED.deep,
        paymentToken: testPayments().paymentToken(),
      })
      .expect(200)
  ).body as AcceptOutcome;
  expect(outcome.status).toBe("accepted");
  const [job] = (await client.get("/api/jobs/mine").expect(200))
    .body as ClientJob[];

  await office
    .post(`/api/jobs/${job!.id}/assignments`)
    .send({ staffId: cory.id })
    .expect(201);
  const agent = await cory.signIn();
  const mine = (await agent.get(`/api/assignments/mine/${job!.id}`))
    .body as CleanerJob;
  await agent.post(`/api/assignments/${mine.assignment.id}/confirm`);

  testClock().set(MONDAY_11AM);
  return {
    office,
    client,
    cory: { ...cory, agent },
    jobId: job!.id,
    quote,
    list,
  };
};

const deepOf = (quote: OfficeQuote) =>
  quote.offer!.options.find((o) => o.serviceKey === SEEDED.deep)!;

const complete = (
  agent: Agent,
  jobId: string,
  input: Partial<CompletionInput> = {},
) =>
  agent
    .post(`/api/assignments/mine/${jobId}/complete`)
    .send({ condition: "moderate", reports: [], ...input });

const officeJob = async (office: Agent, jobId: string) =>
  (await office.get(`/api/jobs/${jobId}`).expect(200)).body as OfficeJob;

const clientJob = async (client: Agent, jobId: string) =>
  (await client.get(`/api/jobs/mine/${jobId}`).expect(200))
    .body as ClientJobDetail;

const needsAttention = async (office: Agent) =>
  (await office.get("/api/dashboard/needs-attention").expect(200))
    .body as NeedsAttentionItem[];

const amounts = () => testPayments().charges.map((c) => c.amount);
const refunded = () => testPayments().refunds.map((r) => r.amount);

describe("completing a Job", () => {
  test("is only for a Cleaner with a Confirmed place", async () => {
    const { office, jobId } = await bookedJob();
    const dee = await signIn("dee@example.com");

    await complete(dee, jobId).expect(404);
    await complete(office, jobId).expect(403);
    await api()
      .post(`/api/assignments/mine/${jobId}/complete`)
      .send({ condition: "moderate", reports: [] })
      .expect(401);
  });

  test("waits for the Cleaner to Confirm, every place to be Confirmed, and the Job to start", async () => {
    const { office, cory, jobId } = await bookedJob({ crewSize: 2 });

    // the second place is open: Unassigned
    const unassigned = await complete(cory.agent, jobId).expect(409);
    expect(unassigned.body.message).toMatch(/every place .* Confirmed/i);
    expect(
      (
        (await cory.agent.get(`/api/assignments/mine/${jobId}`))
          .body as CleanerJob
      ).canComplete,
    ).toBe(false);

    // Dee is Offered it, before the Job, but hasn't Confirmed
    testClock().set(new Date("2026-01-12T13:00:00Z"));
    const dee = await createStaff({
      name: "Dee Two",
      email: "dee2@example.com",
      roles: ["cleaner"],
    });
    await office
      .post(`/api/jobs/${jobId}/assignments`)
      .send({ staffId: dee.id })
      .expect(201);
    const asDee = await signIn("dee2@example.com");
    expect((await complete(asDee, jobId).expect(409)).body.message).toMatch(
      /Confirm your place/,
    );
    const deeJob = (await asDee.get(`/api/assignments/mine/${jobId}`))
      .body as CleanerJob;
    await asDee.post(`/api/assignments/${deeJob.assignment.id}/confirm`);

    // not before it starts
    testClock().set(new Date("2026-01-12T13:59:00Z"));
    expect((await complete(cory.agent, jobId).expect(409)).body.message).toBe(
      "This Job hasn't started yet",
    );
    testClock().set(new Date("2026-01-12T14:00:00Z"));
    expect(
      (
        (await cory.agent.get(`/api/assignments/mine/${jobId}`))
          .body as CleanerJob
      ).canComplete,
    ).toBe(true);
    await complete(cory.agent, jobId).expect(200);
  });

  test("charges the Balance, emails a receipt and records the Condition", async () => {
    const { office, cory, jobId, quote } = await bookedJob();
    const deep = deepOf(quote);

    const seen = (
      await complete(cory.agent, jobId, { condition: "heavy" }).expect(200)
    ).body as CleanerJob;

    expect(seen).toMatchObject({
      outcome: "completed",
      canComplete: false,
      completion: {
        completedAt: MONDAY_11AM.toISOString(),
        completedBy: "Cory Cleaner",
        condition: "heavy",
        reports: [],
      },
    });
    // the Deposit, then the rest
    expect(amounts()).toEqual([
      deep.depositCents,
      deep.totalCents - deep.depositCents,
    ]);

    const job = await officeJob(office, jobId);
    expect(job.status).toBe("completed");
    expect(job.completion).toMatchObject({
      completedBy: { id: cory.id, name: "Cory Cleaner" },
      condition: "heavy",
      adjustments: [],
      payment: {
        quotedCents: deep.totalCents,
        adjustmentsCents: 0,
        totalCents: deep.totalCents,
        paidCents: deep.totalCents,
        owedCents: 0,
        paymentMethod: "Test card ending 4242",
        unpaid: null,
      },
    });
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, job.property.id));
    expect(property!.condition).toBe("heavy");

    const receipt = testEmail().lastTo(casey.email);
    expect(receipt.subject).toBe("Your clean is done: your receipt");
    expect(receipt.text).toContain(
      `http://localhost:5173/portal/jobs/${jobId}`,
    );
    expect(receipt.text).toMatch(/We've charged \$[\d,.]+ to your Test card/);

    // Today shows it done
    const today = (await office.get("/api/dashboard/today").expect(200))
      .body as Today;
    expect(today.jobs.find((j) => j.id === jobId)?.outcome).toBe("completed");

    // and once only
    expect((await complete(cory.agent, jobId).expect(409)).body.message).toBe(
      "This Job has already been Completed",
    );
  });
});

describe("Adjustments", () => {
  test("take a quoted Add-on that wasn't done off at once, at its quoted price", async () => {
    const { cory, client, jobId, quote, list } = await bookedJob();
    const deep = deepOf(quote);

    await complete(cory.agent, jobId, {
      reports: [
        {
          kind: "add_on_not_done",
          addOnKey: keyOf(list, "Inside the oven"),
          reason: "The oven was in use",
        },
      ],
    }).expect(200);

    expect(amounts()[1]).toBe(
      deep.totalCents - HALF_HOUR_ADD_ON - deep.depositCents,
    );
    const { completion } = await clientJob(client, jobId);
    expect(completion!.adjustments).toEqual([
      expect.objectContaining({
        kind: "add_on_not_done",
        addOnName: "Inside the oven",
        reason: "The oven was in use",
        status: "applied",
        totalCents: -HALF_HOUR_ADD_ON,
      }),
    ]);
    expect(testEmail().lastTo(casey.email).text).toContain(
      "Inside the oven, not done: -$29.94",
    );
  });

  test("refund a negative Balance", async () => {
    const { cory, jobId, quote, list } = await bookedJob({
      depositPercent: 100,
    });

    await complete(cory.agent, jobId, {
      reports: [
        {
          kind: "add_on_not_done",
          addOnKey: keyOf(list, "Inside the oven"),
          reason: "No access to the kitchen",
        },
      ],
    }).expect(200);

    expect(amounts()).toEqual([deepOf(quote).totalCents]);
    expect(refunded()).toEqual([HALF_HOUR_ADD_ON]);
    expect(testEmail().lastTo(casey.email).text).toContain(
      "We've refunded $29.94",
    );
  });

  test("are priced from the Price List, never by the Cleaner, and increases wait for the Office", async () => {
    const { office, cory, client, jobId, quote, list } = await bookedJob();
    const deep = deepOf(quote);

    await complete(cory.agent, jobId, {
      reports: [
        {
          kind: "add_on_done",
          addOnKey: keyOf(list, "Inside the fridge"),
          reason: "The Client asked on the day",
        },
        { kind: "extra_time", hours: 1, reason: "Heavy grease in the kitchen" },
      ],
    }).expect(200);

    // charged at the quoted price meanwhile
    expect(amounts()[1]).toBe(deep.totalCents - deep.depositCents);
    const job = await officeJob(office, jobId);
    expect(job.completion!.adjustments).toEqual([
      expect.objectContaining({
        kind: "add_on_done",
        addOnName: "Inside the fridge",
        status: "reported",
        workedOutCents: 2750,
        totalCents: HALF_HOUR_ADD_ON,
      }),
      expect.objectContaining({
        kind: "extra_time",
        hours: 1,
        status: "reported",
        workedOutCents: 5500,
        totalCents: EXTRA_HOUR,
      }),
    ]);
    expect(await needsAttention(office)).toContainEqual(
      expect.objectContaining({
        kind: "adjustments_reported",
        since: MONDAY_11AM.toISOString(),
        count: 2,
      }),
    );

    // the Cleaner sees what they reported, but never a price
    const seen = (await cory.agent.get(`/api/assignments/mine/${jobId}`))
      .body as CleanerJob;
    expect(seen.completion!.reports).toHaveLength(2);
    expect(JSON.stringify(seen)).not.toMatch(/cents|price/i);

    // and the Client sees nothing still with the Office
    expect((await clientJob(client, jobId)).completion!.adjustments).toEqual(
      [],
    );
  });

  test("refuse Add-ons that can't be reported that way", async () => {
    const { cory, jobId, list } = await bookedJob();
    const oven = keyOf(list, "Inside the oven");
    const fridge = keyOf(list, "Inside the fridge");

    const onQuote = await complete(cory.agent, jobId, {
      reports: [{ kind: "add_on_done", addOnKey: oven, reason: "x" }],
    }).expect(409);
    expect(onQuote.body.message).toBe("That Add-on can't be added to this Job");
    const notOnQuote = await complete(cory.agent, jobId, {
      reports: [{ kind: "add_on_not_done", addOnKey: fridge, reason: "x" }],
    }).expect(409);
    expect(notOnQuote.body.message).toBe("That Add-on isn't on this Job");
    await complete(cory.agent, jobId, {
      reports: [{ kind: "extra_time", hours: 0.3, reason: "x" }],
    }).expect(400);
    await complete(cory.agent, jobId, {
      reports: [{ kind: "extra_time", hours: 1, reason: " " }],
    }).expect(400);
  });

  test("proposed by the Office are charged once the Client approves, with a receipt", async () => {
    const { office, cory, client, jobId, quote, list } = await bookedJob();
    const deep = deepOf(quote);
    await complete(cory.agent, jobId, {
      reports: [
        {
          kind: "add_on_done",
          addOnKey: keyOf(list, "Inside the fridge"),
          reason: "The Client asked on the day",
        },
        { kind: "extra_time", hours: 1, reason: "Heavy grease" },
      ],
    }).expect(200);
    const [fridge, time] = (await officeJob(office, jobId)).completion!
      .adjustments;

    // only Office Staff review them
    await client
      .post(`/api/jobs/${jobId}/adjustments/${time!.id}/propose`)
      .send({})
      .expect(403);

    // at the worked-out price
    await office
      .post(`/api/jobs/${jobId}/adjustments/${time!.id}/propose`)
      .send({})
      .expect(200);
    const proposal = testEmail().lastTo(casey.email);
    expect(proposal.subject).toBe("Please approve extra work on your clean");
    expect(proposal.text).toContain("1 extra hour (Heavy grease)");
    expect(proposal.text).toContain("$59.88");
    expect(proposal.text).toContain(`/portal/jobs/${jobId}`);

    // at a price the Office sets, which needs a reason
    await office
      .post(`/api/jobs/${jobId}/adjustments/${fridge!.id}/propose`)
      .send({ priceCents: 2000 })
      .expect(400);
    const after = (
      await office
        .post(`/api/jobs/${jobId}/adjustments/${fridge!.id}/propose`)
        .send({ priceCents: 2000, reason: "Goodwill" })
        .expect(200)
    ).body as OfficeJob;
    expect(after.completion!.adjustments[0]).toMatchObject({
      status: "proposed",
      priceCents: 2000,
      taxCents: 178,
      totalCents: 2178,
      officeReason: "Goodwill",
      lapsesAt: "2026-01-19T16:00:00.000Z",
    });
    await office
      .post(`/api/jobs/${jobId}/adjustments/${fridge!.id}/propose`)
      .send({})
      .expect(409);

    const past = (await client.get("/api/jobs/mine/past").expect(200))
      .body as ClientPastJob[];
    expect(past).toEqual([
      expect.objectContaining({
        id: jobId,
        status: "completed",
        skipped: false,
        feeCents: 0,
        awaitingAnswer: 2,
        unpaid: false,
      }),
    ]);

    // approving charges it, declining doesn't
    const approved = (
      await client
        .post(`/api/jobs/mine/${jobId}/adjustments/${time!.id}/approve`)
        .expect(200)
    ).body as ClientJobDetail;
    expect(amounts().at(-1)).toBe(EXTRA_HOUR);
    expect(approved.completion!.payment).toMatchObject({
      totalCents: deep.totalCents + EXTRA_HOUR,
      owedCents: 0,
    });
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "Your receipt for extra work",
    );
    await client
      .post(`/api/jobs/mine/${jobId}/adjustments/${fridge!.id}/decline`)
      .expect(200);
    await client
      .post(`/api/jobs/mine/${jobId}/adjustments/${fridge!.id}/approve`)
      .expect(409);
    expect(amounts()).toHaveLength(3);
  });

  test("the Office dismisses are never shown to the Client or charged", async () => {
    const { office, cory, client, jobId } = await bookedJob();
    await complete(cory.agent, jobId, {
      reports: [{ kind: "extra_time", hours: 0.5, reason: "Ran over" }],
    }).expect(200);
    const [time] = (await officeJob(office, jobId)).completion!.adjustments;

    await office
      .post(`/api/jobs/${jobId}/adjustments/${time!.id}/dismiss`)
      .send({ reason: "Our estimate was short" })
      .expect(200);

    expect((await clientJob(client, jobId)).completion!.adjustments).toEqual(
      [],
    );
    expect(await needsAttention(office)).not.toContainEqual(
      expect.objectContaining({ kind: "adjustments_reported" }),
    );
    expect(amounts()).toHaveLength(2);
  });

  test("lapse after 7 days unanswered, with a reminder 2 days before", async () => {
    const { office, cory, client, jobId } = await bookedJob();
    await complete(cory.agent, jobId, {
      reports: [{ kind: "extra_time", hours: 1, reason: "Ran over" }],
    }).expect(200);
    const [time] = (await officeJob(office, jobId)).completion!.adjustments;
    await office
      .post(`/api/jobs/${jobId}/adjustments/${time!.id}/propose`)
      .send({})
      .expect(200);
    const sent = testEmail().sent.length;

    testClock().set(new Date("2026-01-17T15:59:00Z"));
    await chaseProposedAdjustments();
    expect(testEmail().sent).toHaveLength(sent);

    testClock().set(new Date("2026-01-17T16:00:00Z"));
    await chaseProposedAdjustments();
    await chaseProposedAdjustments();
    expect(testEmail().sent).toHaveLength(sent + 1);
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "Reminder: please approve extra work on your clean",
    );

    testClock().set(new Date("2026-01-19T16:00:00Z"));
    // too late, even before the timer lapses it
    expect(
      (
        await client
          .post(`/api/jobs/mine/${jobId}/adjustments/${time!.id}/approve`)
          .expect(409)
      ).body.message,
    ).toBe("This has lapsed, so it won't be charged.");
    await chaseProposedAdjustments();
    expect(
      (await clientJob(client, jobId)).completion!.adjustments[0]!.status,
    ).toBe("lapsed");
    expect(amounts()).toHaveLength(2);
  });
});

describe("an Unpaid Job", () => {
  test("is one whose Balance couldn't be charged: the Client is emailed and the Office told", async () => {
    const { office, cory, client, jobId, quote } = await bookedJob();
    const deep = deepOf(quote);
    testPayments().failCharges("card_declined");

    await complete(cory.agent, jobId).expect(200);

    const job = await officeJob(office, jobId);
    expect(job.completion!.payment).toMatchObject({
      owedCents: deep.totalCents - deep.depositCents,
      unpaid: { since: MONDAY_11AM.toISOString(), reason: "card_declined" },
    });
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "We couldn't take your payment",
    );
    expect(await needsAttention(office)).toContainEqual(
      expect.objectContaining({
        kind: "job_unpaid",
        since: MONDAY_11AM.toISOString(),
        owedCents: deep.totalCents - deep.depositCents,
        reason: "card_declined",
      }),
    );
    expect(
      ((await client.get("/api/jobs/mine/past")).body as ClientPastJob[])[0]!
        .unpaid,
    ).toBe(true);

    // retrying with the same card still fails
    expect(
      (await client.post(`/api/jobs/mine/${jobId}/balance/retry`).expect(409))
        .body.message,
    ).toMatch(/still couldn't be charged/);
  });

  test("is retried when the Client saves a new Payment Method", async () => {
    const { office, cory, client, jobId, quote } = await bookedJob();
    const deep = deepOf(quote);
    testPayments().failCharges();
    await complete(cory.agent, jobId).expect(200);
    testPayments().failCharges(null);

    const form = (await client.post("/api/payment-methods/mine/card-form"))
      .body as { secret: string };
    await client
      .put("/api/payment-methods/mine")
      .send({ token: form.secret })
      .expect(200);

    expect(amounts()).toEqual([
      deep.depositCents,
      deep.totalCents - deep.depositCents,
    ]);
    expect((await officeJob(office, jobId)).completion!.payment.unpaid).toBe(
      null,
    );
    expect(await needsAttention(office)).not.toContainEqual(
      expect.objectContaining({ kind: "job_unpaid" }),
    );
  });

  test("can be retried by the Client or the Office", async () => {
    const { office, cory, client, jobId } = await bookedJob();
    testPayments().failCharges();
    await complete(cory.agent, jobId).expect(200);
    testPayments().failCharges(null);

    await client.post(`/api/jobs/mine/${jobId}/balance/retry`).expect(200);
    expect((await clientJob(client, jobId)).completion!.payment.unpaid).toBe(
      null,
    );
    // nothing left to retry
    await office.post(`/api/jobs/${jobId}/balance/retry`).expect(200);
    expect(amounts()).toHaveLength(2);
  });

  test("includes one whose approved increase couldn't be charged", async () => {
    const { office, cory, client, jobId } = await bookedJob();
    await complete(cory.agent, jobId, {
      reports: [{ kind: "extra_time", hours: 1, reason: "Ran over" }],
    }).expect(200);
    const [time] = (await officeJob(office, jobId)).completion!.adjustments;
    await office
      .post(`/api/jobs/${jobId}/adjustments/${time!.id}/propose`)
      .send({})
      .expect(200);
    testPayments().failCharges();

    const after = (
      await client
        .post(`/api/jobs/mine/${jobId}/adjustments/${time!.id}/approve`)
        .expect(200)
    ).body as ClientJobDetail;

    expect(after.completion!.payment).toMatchObject({
      owedCents: EXTRA_HOUR,
      unpaid: { reason: "card_declined" },
    });
  });
});

describe("Office Staff correcting a completion", () => {
  test("change an Adjustment's price, charging or refunding the difference", async () => {
    const { office, cory, jobId, list } = await bookedJob();
    await complete(cory.agent, jobId, {
      reports: [
        {
          kind: "add_on_not_done",
          addOnKey: keyOf(list, "Inside the oven"),
          reason: "Oven in use",
        },
      ],
    }).expect(200);
    const [oven] = (await officeJob(office, jobId)).completion!.adjustments;

    await office
      .patch(`/api/jobs/${jobId}/adjustments/${oven!.id}`)
      .send({ priceCents: 1000 })
      .expect(400);
    // a smaller reduction: the Client pays the difference
    const after = (
      await office
        .patch(`/api/jobs/${jobId}/adjustments/${oven!.id}`)
        .send({ priceCents: 1000, reason: "Part of it was done" })
        .expect(200)
    ).body as OfficeJob;

    expect(after.completion!.adjustments[0]).toMatchObject({
      priceCents: -1000,
      taxCents: -89,
      totalCents: -1089,
      officeReason: "Part of it was done",
    });
    expect(amounts().at(-1)).toBe(HALF_HOUR_ADD_ON - 1089);
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "We've corrected the price of your clean",
    );
  });

  test("lower an approved increase but never raise it", async () => {
    const { office, cory, client, jobId } = await bookedJob();
    await complete(cory.agent, jobId, {
      reports: [{ kind: "extra_time", hours: 1, reason: "Ran over" }],
    }).expect(200);
    const [time] = (await officeJob(office, jobId)).completion!.adjustments;
    await office
      .post(`/api/jobs/${jobId}/adjustments/${time!.id}/propose`)
      .send({})
      .expect(200);
    await client
      .post(`/api/jobs/mine/${jobId}/adjustments/${time!.id}/approve`)
      .expect(200);

    await office
      .patch(`/api/jobs/${jobId}/adjustments/${time!.id}`)
      .send({ priceCents: 6000, reason: "More" })
      .expect(409);
    await office
      .patch(`/api/jobs/${jobId}/adjustments/${time!.id}`)
      .send({ priceCents: 2750, reason: "Half was our fault" })
      .expect(200);
    expect(refunded()).toEqual([EXTRA_HOUR - 2994]);
  });

  test("remove an Adjustment", async () => {
    const { office, cory, jobId, list } = await bookedJob();
    await complete(cory.agent, jobId, {
      reports: [
        {
          kind: "add_on_not_done",
          addOnKey: keyOf(list, "Inside the oven"),
          reason: "Wrong Job",
        },
      ],
    }).expect(200);
    const [oven] = (await officeJob(office, jobId)).completion!.adjustments;

    await office
      .delete(`/api/jobs/${jobId}/adjustments/${oven!.id}`)
      .expect(200);

    expect(amounts().at(-1)).toBe(HALF_HOUR_ADD_ON);
    expect((await officeJob(office, jobId)).completion!.adjustments).toEqual(
      [],
    );
  });

  test("correct the Condition reported", async () => {
    const { office, cory, jobId } = await bookedJob();
    await complete(cory.agent, jobId, { condition: "heavy" }).expect(200);

    const after = (
      await office
        .patch(`/api/jobs/${jobId}/completion`)
        .send({ condition: "light" })
        .expect(200)
    ).body as OfficeJob;

    expect(after.completion!.condition).toBe("light");
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, after.property.id));
    expect(property!.condition).toBe("light");
  });

  test("undo it, refunding all but the Deposit, so it can be completed again", async () => {
    const { office, cory, client, jobId, quote } = await bookedJob();
    const deep = deepOf(quote);
    await complete(cory.agent, jobId, { condition: "heavy" }).expect(200);

    const after = (
      await office.delete(`/api/jobs/${jobId}/completion`).expect(200)
    ).body as OfficeJob;

    expect(after).toMatchObject({ status: "booked", completion: null });
    expect(refunded()).toEqual([deep.totalCents - deep.depositCents]);
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, after.property.id));
    expect(property!.condition).toBe("moderate");
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "A correction to your clean",
    );
    expect((await clientJob(client, jobId)).status).toBe("booked");

    await complete(cory.agent, jobId).expect(200);
    expect(amounts().at(-1)).toBe(deep.totalCents - deep.depositCents);
  });

  test("is only for Office Staff", async () => {
    const { cory, client, jobId } = await bookedJob();
    await complete(cory.agent, jobId).expect(200);

    await client.delete(`/api/jobs/${jobId}/completion`).expect(403);
    await cory.agent
      .patch(`/api/jobs/${jobId}/completion`)
      .send({ condition: "light" })
      .expect(403);
  });
});

describe("a Client's past Jobs", () => {
  test("are their own Completed Jobs, latest first, each with its receipt", async () => {
    const { cory, client, jobId, quote } = await bookedJob();
    expect((await client.get("/api/jobs/mine/past").expect(200)).body).toEqual(
      [],
    );
    await complete(cory.agent, jobId).expect(200);

    const past = (await client.get("/api/jobs/mine/past").expect(200))
      .body as ClientPastJob[];
    expect(past).toEqual([
      expect.objectContaining({
        id: jobId,
        completedAt: MONDAY_11AM.toISOString(),
        totalCents: deepOf(quote).totalCents,
        unpaid: false,
        awaitingAnswer: 0,
      }),
    ]);
    const detail = await clientJob(client, jobId);
    expect(detail.completion).not.toHaveProperty("completedBy");
    expect(detail.completion!.payment.charges.map((c) => c.kind)).toEqual([
      "deposit",
      "balance",
    ]);

    // nobody else's
    await createStaff({
      name: "Someone Else",
      email: "else@example.com",
      roles: ["cleaner"],
    });
    const other = await signIn("else@example.com");
    await other.get(`/api/jobs/mine/${jobId}`).expect(403);
  });
});
