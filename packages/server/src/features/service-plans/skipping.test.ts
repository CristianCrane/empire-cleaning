import { describe, expect, test } from "vitest";
import type {
  ClientJobDetail,
  NeedsAttentionItem,
  OfficeJob,
  OfficeServicePlan,
} from "@empire-cleaning/models";
import { confirmAssignment } from "#features/assignments/assignments";
import { completeJob } from "#features/completion/completion";
import {
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import { casey, crewedServicePlan } from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// The First Clean is done at 11am on Monday 12 January 2026, New York time,
// and the clock is left there. The plan is weekly from 9am on Monday the
// 19th, for a crew of 1, so its first Job can be skipped free until 9am on
// Sunday the 18th.
const SUNDAY_8_59AM = new Date("2026-01-18T13:59:00Z");
const SUNDAY_10AM = new Date("2026-01-18T15:00:00Z");
const MONDAY_9_30AM = new Date("2026-01-19T14:30:00Z");

// Casey's home as a Standard Clean plan: $185.40 plus 8.875% tax, and the
// 25% Deposit on that
const PLAN_TOTAL = 20185;
const PLAN_DEPOSIT = 5046;

const CORY = "cory@example.com";

// Casey's plan, with Cory Confirmed on its first Job
const startedPlan = crewedServicePlan;

const officePlan = async (office: Agent, id: string) =>
  (await office.get(`/api/service-plans/${id}`).expect(200))
    .body as OfficeServicePlan;

const clientJob = async (client: Agent, jobId: string) =>
  (await client.get(`/api/jobs/mine/${jobId}`).expect(200))
    .body as ClientJobDetail;

const officeJob = async (office: Agent, jobId: string) =>
  (await office.get(`/api/jobs/${jobId}`).expect(200)).body as OfficeJob;

const skip = (client: Agent, jobId: string, feeCents: number) =>
  client.post(`/api/jobs/mine/${jobId}/cancel`).send({ feeCents });

// the Charges taken since the plan's Deposit
const chargesAfterDeposit = () => testPayments().charges.slice(3);

describe("skipping a plan Job", () => {
  test("more than 24 hours ahead is free, and the plan carries on", async () => {
    const { office, client, planId, jobId } = await startedPlan();
    testClock().set(SUNDAY_8_59AM);

    const job = await clientJob(client, jobId);
    expect(job.servicePlanId).toBe(planId);
    expect(job.cancelTerms).toEqual(
      expect.objectContaining({ late: false, feeCents: 0, refundCents: 0 }),
    );

    await skip(client, jobId, 0).expect(200);

    expect(chargesAfterDeposit()).toEqual([]);
    expect(testPayments().refunds).toEqual([]);
    const plan = await officePlan(office, planId);
    expect(plan.status).toBe("active");
    expect(plan.depositCents).toBe(PLAN_DEPOSIT);
    expect(plan.jobs.find((j) => j.id === jobId)!.status).toBe("cancelled");
    expect(plan.jobs.filter((j) => j.status === "booked").length).toBe(3);

    const toClient = testEmail().lastTo(casey.email);
    expect(toClient.subject).toBe("Your clean is skipped");
    expect(toClient.text).toMatch(/no charge for skipping/);
    expect(toClient.text).toMatch(/Service Plan carries on/);
    expect(toClient.text).not.toMatch(/request a Quote/);
  });

  test("within 24 hours charges the plan's Deposit amount as the fee, leaving the Deposit held", async () => {
    const { office, client, planId, jobId } = await startedPlan();
    testClock().set(SUNDAY_10AM);

    expect((await clientJob(client, jobId)).cancelTerms).toEqual(
      expect.objectContaining({
        late: true,
        feeCents: PLAN_DEPOSIT,
        refundCents: 0,
      }),
    );
    await skip(client, jobId, PLAN_DEPOSIT).expect(200);

    expect(chargesAfterDeposit()).toEqual([
      expect.objectContaining({
        amount: PLAN_DEPOSIT,
        description: expect.stringMatching(/^Late Cancellation fee: /),
      }),
    ]);
    expect(testPayments().refunds).toEqual([]);
    const { cancellation } = await clientJob(client, jobId);
    expect(cancellation).toEqual(
      expect.objectContaining({ late: true, feeCents: PLAN_DEPOSIT }),
    );
    expect(cancellation!.payment).toEqual(
      expect.objectContaining({
        charges: [
          expect.objectContaining({ kind: "fee", amountCents: PLAN_DEPOSIT }),
        ],
        paidCents: PLAN_DEPOSIT,
        owedCents: 0,
        unpaid: null,
      }),
    );
    expect((await officePlan(office, planId)).depositCents).toBe(PLAN_DEPOSIT);

    const toClient = testEmail().lastTo(casey.email);
    expect(toClient.text).toMatch(/Late Cancellation, with a \$50\.46 fee/);
    expect(toClient.text).toMatch(
      /We've charged it to your Test card ending 4242/,
    );
  });

  test("is refused, not charged, when it has become late since the Client looked", async () => {
    const { client, jobId } = await startedPlan();
    testClock().set(SUNDAY_10AM);

    expect((await skip(client, jobId, 0).expect(409)).body.message).toMatch(
      /Late Cancellation, with a \$50\.46 fee/,
    );
    expect(chargesAfterDeposit()).toEqual([]);
  });

  test("leaves the Job Unpaid when the fee can't be charged, until it's retried", async () => {
    const { office, client, jobId } = await startedPlan();
    testClock().set(SUNDAY_10AM);
    testPayments().failCharges();

    await skip(client, jobId, PLAN_DEPOSIT).expect(200);

    const { cancellation } = await clientJob(client, jobId);
    expect(cancellation!.payment.unpaid).not.toBeNull();
    expect(cancellation!.payment.owedCents).toBe(PLAN_DEPOSIT);
    const attention = (
      await office.get("/api/dashboard/needs-attention").expect(200)
    ).body as NeedsAttentionItem[];
    expect(attention).toContainEqual(
      expect.objectContaining({ kind: "job_unpaid" }),
    );
    expect(testEmail().lastTo(casey.email).text).toMatch(
      /couldn't charge it to your Test card ending 4242/,
    );

    testPayments().failCharges(null);
    await client.post(`/api/jobs/mine/${jobId}/balance/retry`).expect(200);

    const after = await clientJob(client, jobId);
    expect(after.cancellation!.payment).toEqual(
      expect.objectContaining({ owedCents: 0, unpaid: null }),
    );
    expect(chargesAfterDeposit().map((c) => c.amount)).toEqual([PLAN_DEPOSIT]);
  });

  test("by Office Staff for the Client follows the same policy; for Empire Cleaning it's free", async () => {
    const { office, jobId } = await startedPlan();
    testClock().set(SUNDAY_10AM);

    const { cancelTerms, servicePlanId } = await officeJob(office, jobId);
    expect(servicePlanId).not.toBeNull();
    expect(cancelTerms!.client.feeCents).toBe(PLAN_DEPOSIT);
    expect(cancelTerms!.empire.feeCents).toBe(0);

    await office
      .post(`/api/jobs/${jobId}/cancel`)
      .send({ by: "client", feeCents: PLAN_DEPOSIT })
      .expect(200);
    expect(chargesAfterDeposit().map((c) => c.amount)).toEqual([PLAN_DEPOSIT]);
  });

  test("for Empire Cleaning charges nothing", async () => {
    const { office, jobId } = await startedPlan();
    testClock().set(SUNDAY_10AM);

    await office
      .post(`/api/jobs/${jobId}/cancel`)
      .send({ by: "empire", feeCents: 0, reason: "A Cleaner is ill" })
      .expect(200);
    expect(chargesAfterDeposit()).toEqual([]);
    expect(testEmail().lastTo(casey.email).text).toMatch(
      /Service Plan carries on/,
    );
  });
});

describe("No Access on a plan Job", () => {
  test("charges the plan's Deposit amount as the fee, leaving the Deposit held", async () => {
    const { office, client, planId, jobId } = await startedPlan();
    testClock().set(MONDAY_9_30AM);

    await (
      await signIn(CORY)
    )
      .post(`/api/assignments/mine/${jobId}/no-access`)
      .send({ reason: "Nobody home and the gate was locked" })
      .expect(200);

    expect(chargesAfterDeposit()).toEqual([
      expect.objectContaining({
        amount: PLAN_DEPOSIT,
        description: expect.stringMatching(/^No Access fee: /),
      }),
    ]);
    const { noAccess } = await clientJob(client, jobId);
    expect(noAccess!.feeCents).toBe(PLAN_DEPOSIT);
    expect(noAccess!.payment.charges).toEqual([
      expect.objectContaining({ kind: "fee", amountCents: PLAN_DEPOSIT }),
    ]);
    expect((await officePlan(office, planId)).depositCents).toBe(PLAN_DEPOSIT);
    expect(testEmail().lastTo(casey.email).text).toMatch(
      /Service Plan carries on/,
    );
  });
});

describe("a second Late Reschedule of a plan Job", () => {
  test("adds the plan's Deposit amount as a fee, charged with the price on completion", async () => {
    const { office, client, jobId, cleanerId } = await startedPlan();
    const move = async (date: string, cost: string) => {
      await client
        .post(`/api/jobs/mine/${jobId}/reschedule-request`)
        .send({ date, time: "09:00", cost })
        .expect(201);
      await office
        .post(`/api/jobs/${jobId}/reschedule-request/confirm`)
        .expect(200);
    };

    // late, but the first: free
    testClock().set(SUNDAY_10AM);
    expect((await clientJob(client, jobId)).rescheduleTerms).toEqual(
      expect.objectContaining({ cost: "free_late", feeCents: 0 }),
    );
    await move("2026-01-20", "free_late");

    // late again: a Late Cancellation, though the Job still moves
    testClock().set(new Date("2026-01-19T15:00:00Z"));
    expect((await clientJob(client, jobId)).rescheduleTerms).toEqual(
      expect.objectContaining({
        cost: "late_cancellation",
        feeCents: PLAN_DEPOSIT,
      }),
    );
    await move("2026-01-21", "late_cancellation");
    expect(chargesAfterDeposit()).toEqual([]);

    // the moved Job's crew Confirm the new time, and it's done
    const mine = (await office.get(`/api/jobs/${jobId}`).expect(200))
      .body as OfficeJob;
    await confirmAssignment(cleanerId, mine.assignments[0]!.id);
    testClock().set(new Date("2026-01-21T16:00:00Z"));
    await completeJob(cleanerId, jobId, { condition: "moderate", reports: [] });

    expect(chargesAfterDeposit().map((c) => c.amount)).toEqual([
      PLAN_TOTAL + PLAN_DEPOSIT,
    ]);
  });
});
