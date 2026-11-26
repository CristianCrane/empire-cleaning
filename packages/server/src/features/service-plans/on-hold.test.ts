import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "#db";
import type {
  ClientPastJob,
  NeedsAttentionItem,
  OfficeServicePlan,
  ServicePlanView,
} from "@empire-cleaning/models";
import { completeJob } from "#features/completion";
import { settleOpenPayments } from "#features/payments";
import {
  type Agent,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import { casey, crewedServicePlan } from "../../../tests/fixtures.ts";
import { generateServicePlanJobs } from "./service-plans.ts";

// Casey's weekly plan from 9am on Monday 19 January 2026, its Jobs booked up
// to 9 February, with a $50.46 Deposit, the fee for skipping late
const SUNDAY_10AM = new Date("2026-01-18T15:00:00Z");
const PLAN_TOTAL = 20185;
const PLAN_DEPOSIT = 5046;

const officePlan = async (office: Agent, id: string) =>
  (await office.get(`/api/service-plans/${id}`).expect(200))
    .body as OfficeServicePlan;

const clientPlan = async (client: Agent, id: string) =>
  (await client.get(`/api/service-plans/mine/${id}`).expect(200))
    .body as ServicePlanView;

const needsAttention = async (office: Agent) =>
  (await office.get("/api/dashboard/needs-attention").expect(200))
    .body as NeedsAttentionItem[];

// Casey skips the first Job late on a declined card, so its fee is Unpaid
const heldPlan = async () => {
  const started = await crewedServicePlan();
  testClock().set(SUNDAY_10AM);
  testPayments().failCharges();
  await started.client
    .post(`/api/jobs/mine/${started.jobId}/cancel`)
    .send({ feeCents: PLAN_DEPOSIT })
    .expect(200);
  return started;
};

describe("a plan Job left Unpaid", () => {
  test("puts its plan On Hold, under Needs attention", async () => {
    const { office, client, planId, jobId } = await heldPlan();

    const plan = await clientPlan(client, planId);
    expect(plan.status).toBe("on_hold");
    expect(plan.unpaid).toEqual([
      {
        jobId,
        startsAt: "2026-01-19T14:00:00.000Z",
        owedCents: PLAN_DEPOSIT,
        // a new card puts it right
        kind: "declined",
      },
    ]);
    expect(await needsAttention(office)).toContainEqual(
      expect.objectContaining({
        kind: "plan_on_hold",
        since: SUNDAY_10AM.toISOString(),
        owedCents: PLAN_DEPOSIT,
        plan: expect.objectContaining({
          id: planId,
          client: expect.objectContaining({ name: casey.name }),
        }),
      }),
    );
    expect(testEmail().lastTo(casey.email).text).toMatch(
      /Until it's paid, we won't book more cleans on your plan\./,
    );
    // their past cleans show it Skipped, its fee Unpaid, latest first
    const past = (await client.get("/api/jobs/mine/past").expect(200))
      .body as ClientPastJob[];
    expect(past).toEqual([
      expect.objectContaining({
        id: jobId,
        status: "cancelled",
        skipped: true,
        completedAt: null,
        totalCents: 0,
        feeCents: PLAN_DEPOSIT,
        unpaid: expect.objectContaining({ kind: "declined" }),
      }),
      // its First Clean, before the plan
      expect.objectContaining({ status: "completed", skipped: false }),
    ]);
  });

  test("books no new Jobs while On Hold, though those booked go ahead", async () => {
    const { office, planId } = await heldPlan();
    const before = (await officePlan(office, planId)).jobs;

    // a week on, 16 February would come within reach
    testClock().set(new Date("2026-01-19T16:00:00Z"));
    expect(await generateServicePlanJobs()).toBe(0);

    const after = (await officePlan(office, planId)).jobs;
    expect(after.map((j) => j.id)).toEqual(before.map((j) => j.id));
    expect(after.filter((j) => j.status === "booked").length).toBe(3);
  });

  test("resumes its plan once paid, booking Jobs again from the next date to come", async () => {
    const { office, client, planId } = await heldPlan();

    // On Hold for weeks: 16 February to 2 March come and go unbooked
    testClock().set(new Date("2026-03-03T16:00:00Z"));
    expect(await generateServicePlanJobs()).toBe(0);

    testPayments().failCharges(null);
    await client.post("/api/payments/mine/retry").expect(200);
    expect((await clientPlan(client, planId)).status).toBe("active");
    expect(
      (await needsAttention(office)).filter((i) => i.kind === "plan_on_hold"),
    ).toEqual([]);

    await generateServicePlanJobs();
    const plan = await officePlan(office, planId);
    expect(plan.unplaced).toEqual([]);
    expect(
      plan.jobs.map((j) => j.startsAt).filter((s) => s > "2026-02-10"),
    ).toEqual([
      "2026-03-09T13:00:00.000Z",
      "2026-03-16T13:00:00.000Z",
      "2026-03-23T13:00:00.000Z",
      "2026-03-30T13:00:00.000Z",
    ]);
  });

  test("resuming less than a day before its next date books it, tells the Client, and lets them skip it free (#242)", async () => {
    const { client, planId } = await heldPlan();

    // paid at 3pm on Sunday 15 February: Monday's 9am clean comes next
    testClock().set(new Date("2026-02-15T20:00:00Z"));
    testPayments().failCharges(null);
    await client.post("/api/payments/mine/retry").expect(200);
    await generateServicePlanJobs();

    const monday = (await clientPlan(client, planId)).upcoming.find(
      (j) => j.startsAt === "2026-02-16T14:00:00.000Z",
    )!;
    const booked = testEmail().lastTo(casey.email);
    expect(booked.subject).toBe("Your next clean is booked");
    expect(booked.text).toContain("Monday, February 16 at 9:00\u00a0AM");
    expect(booked.text).toContain("you can skip it for free");
    const { cancelTerms } = (
      await client.get(`/api/jobs/mine/${monday.id}`).expect(200)
    ).body as { cancelTerms: { late: boolean; feeCents: number } };
    expect(cancelTerms).toMatchObject({ late: false, feeCents: 0 });
  });

  test("held while the provider was down, then declined, says so in the late notice", async () => {
    const { client, planId, cleanerId, jobId } = await crewedServicePlan();
    testClock().set(new Date("2026-01-19T16:00:00Z"));
    testPayments().goDown();
    await completeJob(cleanerId, jobId, { condition: "moderate", reports: [] });
    // held, on a payment we try again ourselves: nothing for the Client to do
    expect((await clientPlan(client, planId)).unpaid).toEqual([
      expect.objectContaining({ jobId, kind: "waiting" }),
    ]);
    testPayments().goDown(false);
    testPayments().failCharges();

    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    const notice = testEmail().lastTo(casey.email);
    expect(notice.subject).toBe("We couldn't take your payment");
    expect(notice.text).toMatch(
      /Until it's paid, we won't book more cleans on your plan\./,
    );
  });

  test("when it's a completed Job's Balance puts the plan On Hold too, and the Office's retry resumes it", async () => {
    const { office, client, planId, jobId, cleanerId } =
      await crewedServicePlan();
    testClock().set(new Date("2026-01-19T16:00:00Z"));
    testPayments().failCharges();
    await completeJob(cleanerId, jobId, { condition: "moderate", reports: [] });

    expect((await clientPlan(client, planId)).status).toBe("on_hold");
    const unpaidNotice = testEmail().lastTo(casey.email);
    expect(unpaidNotice.subject).toBe("We couldn't take your payment");
    expect(unpaidNotice.text).toMatch(
      /Until it's paid, we won't book more cleans on your plan\./,
    );

    testPayments().failCharges(null);
    await office.post(`/api/jobs/${jobId}/balance/retry`).expect(200);
    expect((await clientPlan(client, planId)).status).toBe("active");
    expect(testPayments().charges.at(-1)!.amount).toBe(PLAN_TOTAL);
    expect(testEmail().lastTo(casey.email).text).toMatch(
      /cleaning plan is back on/,
    );
  });
});

// critical review C10: saving a card answers with what it took, and
// Your card says "Paid." when that's some and nothing it lists is left. A
// payment the provider couldn't be reached for is left too, Pending, and
// Your card doesn't list it (we try it again ourselves), so the answer must
// say so, as it says of one still processing
describe("saving a card that takes one payment while another can't reach the provider", () => {
  test("doesn't answer as though all of it was taken", async () => {
    const { office, client, planId, jobId } = await heldPlan();
    // the next Monday's clean skipped late on the same declined card
    const second = (await officePlan(office, planId)).jobs.find(
      (j) => j.startsAt === "2026-01-26T14:00:00.000Z",
    )!;
    testClock().set(new Date("2026-01-25T15:00:00Z"));
    await client
      .post(`/api/jobs/mine/${second.id}/cancel`)
      .send({ feeCents: PLAN_DEPOSIT })
      .expect(200);
    const owed = (
      (await client.get("/api/jobs/mine/past").expect(200))
        .body as ClientPastJob[]
    ).filter((j) => j.unpaid);
    expect(owed.map((j) => j.id).sort()).toEqual([jobId, second.id].sort());

    // a new card: the first fee goes through, then the provider goes down
    testPayments().failCharges(null);
    const held = testPayments().holdNextCharge();
    const form = (
      await client.post("/api/payment-methods/mine/card-form").expect(200)
    ).body as { secret: string };
    const saving = client
      .put("/api/payment-methods/mine")
      .send({ token: form.secret })
      .then((r) => r);
    await held.reached;
    testPayments().goDown();
    held.release();
    const res = await saving;
    testPayments().goDown(false);
    expect(res.status).toBe(200);

    // one fee taken, the other left Pending, on a reason Your card doesn't
    // list (we try it again ourselves)
    const left = (
      (await client.get("/api/jobs/mine/past").expect(200))
        .body as ClientPastJob[]
    ).filter((j) => j.unpaid);
    expect(left).toEqual([
      expect.objectContaining({
        unpaid: expect.objectContaining({ kind: "waiting" }),
      }),
    ]);
    expect(res.body.took).toHaveLength(1);
    // the one the payment service couldn't reach is still to come, so the
    // answer names it going through, at what it owes, as it does for
    // "processing", and Your card doesn't read Paid (review F20)
    expect(res.body.goingThrough).toEqual([
      expect.objectContaining({
        kind: "clean",
        id: left[0]!.id,
        cents: left[0]!.owedCents,
      }),
    ]);
  });
});

// critical review C10, its retry half: Try this card again, in the same
// spot, answers as saving a card does, not with a 409
describe("Try this card again, taking one payment while another can't reach the provider", () => {
  test("answers what it took, and that the rest is still going through", async () => {
    const { office, client, planId } = await heldPlan();
    const second = (await officePlan(office, planId)).jobs.find(
      (j) => j.startsAt === "2026-01-26T14:00:00.000Z",
    )!;
    testClock().set(new Date("2026-01-25T15:00:00Z"));
    await client
      .post(`/api/jobs/mine/${second.id}/cancel`)
      .send({ feeCents: PLAN_DEPOSIT })
      .expect(200);

    testPayments().failCharges(null);
    const held = testPayments().holdNextCharge();
    const retrying = client.post("/api/payments/mine/retry").then((r) => r);
    await held.reached;
    testPayments().goDown();
    held.release();
    const res = await retrying;
    testPayments().goDown(false);

    expect(res.status).toBe(200);
    expect(res.body.took).toHaveLength(1);
    // the other fee, named at what it owes (review F20)
    const left = (
      (await client.get("/api/jobs/mine/past").expect(200))
        .body as ClientPastJob[]
    ).filter((j) => j.unpaid);
    expect(res.body.goingThrough).toEqual([
      expect.objectContaining({
        kind: "clean",
        id: left[0]!.id,
        cents: left[0]!.owedCents,
      }),
    ]);
  });
});

// critical review C12: a retry that errored on our side (retryJob threw,
// so retryUnpaidJobsFor pushes NOT_SETTLED, completion.ts) leaves the Job
// Unpaid for the reason it had, which nothing tries again by itself, so
// it isn't going through: the press answers 409, saying to try later, or
// Your card, its alert still up, would say nothing of it
describe("Try this card again, when trying a payment again errors on our side", () => {
  test("says it couldn't try again, not that it's going through", async () => {
    const { client, jobId } = await heldPlan();
    testPayments().failCharges(null);
    // recording the Charge fails, as a database error would
    await db.execute(sql`
      create or replace function c12_fail() returns trigger
      language plpgsql as $$ begin raise exception 'C12: our own error'; end $$`);
    await db.execute(sql`
      create trigger c12_fail before insert on charges
      for each row execute function c12_fail()`);
    const asked = testPayments().paymentAttempts.length;
    let res;
    try {
      res = await client.post("/api/payments/mine/retry");
    } finally {
      await db.execute(sql`drop trigger if exists c12_fail on charges`);
      await db.execute(sql`drop function if exists c12_fail()`);
    }

    // still Unpaid, as before the press, and still theirs to read
    const owed = (
      (await client.get("/api/jobs/mine/past").expect(200))
        .body as ClientPastJob[]
    ).find((j) => j.id === jobId)!;
    expect(owed.unpaid).toMatchObject({ kind: "declined" });
    // the provider took it before our error: the next press records that
    // and asks for nothing more
    expect(testPayments().paymentAttempts.length).toBe(asked + 1);
    expect(
      (await client.post("/api/payments/mine/retry").expect(200)).body,
    ).toMatchObject({ took: [expect.objectContaining({ id: jobId })] });
    expect(testPayments().paymentAttempts.length).toBe(asked + 1);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("We couldn't try again. Please try later.");
  });
});
