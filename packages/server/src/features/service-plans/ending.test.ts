import { describe, expect, test } from "vitest";
import type {
  ClientJobDetail,
  OfficeServicePlan,
  ServicePlanSummary,
  ServicePlanView,
} from "@empire-cleaning/models";
import { completeJob } from "#features/completion/completion";
import {
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import { casey, crewedServicePlan } from "../../../tests/fixtures.ts";
import { generateServicePlanJobs } from "./service-plans.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// Casey's weekly plan from 9am on Monday 19 January 2026, its Jobs booked up
// to 9 February, with a $50.46 Deposit
const MONDAYS = [
  "2026-01-19T14:00:00.000Z",
  "2026-01-26T14:00:00.000Z",
  "2026-02-02T14:00:00.000Z",
  "2026-02-09T14:00:00.000Z",
];
const SUNDAY_10AM = new Date("2026-01-18T15:00:00Z");
const PLAN_TOTAL = 20185;
const PLAN_DEPOSIT = 5046;

const clientPlan = async (client: Agent, id: string) =>
  (await client.get(`/api/service-plans/mine/${id}`).expect(200))
    .body as ServicePlanView;

const officePlan = async (office: Agent, id: string) =>
  (await office.get(`/api/service-plans/${id}`).expect(200))
    .body as OfficeServicePlan;

const end = (client: Agent, planId: string, goingAhead: string[]) =>
  client.post(`/api/service-plans/mine/${planId}/end`).send({ goingAhead });

// the Charges taken since the plan's Deposit
const chargesAfterDeposit = () => testPayments().charges.slice(3);

describe("Ending a Service Plan", () => {
  test("more than 24 hours before its next Job cancels them all free, and refunds the Deposit", async () => {
    const { office, client, planId } = await crewedServicePlan();

    const { endTerms } = await clientPlan(client, planId);
    expect(endTerms).toEqual({
      cancelled: MONDAYS,
      goingAhead: [],
      depositCents: PLAN_DEPOSIT,
      deposit: "refunded",
      finalJob: expect.objectContaining({
        startsAt: MONDAYS[3],
        status: "cancelled",
      }),
    });

    const ended = (await end(client, planId, []).expect(200))
      .body as ServicePlanView;
    expect(ended.status).toBe("ended");
    expect(ended.endTerms).toBeNull();
    expect(ended.endedAt).not.toBeNull();
    expect(ended.upcoming).toEqual([]);

    const plan = await officePlan(office, planId);
    expect(plan.jobs.map((j) => j.status)).toEqual(Array(4).fill("cancelled"));
    expect(chargesAfterDeposit()).toEqual([]);
    expect(testPayments().refunds.map((r) => r.amount)).toEqual([PLAN_DEPOSIT]);

    const toClient = testEmail().lastTo(casey.email);
    expect(toClient.subject).toBe("Your Service Plan has Ended");
    expect(toClient.text).toMatch(/cancelled the cleans it had booked, free/);
    expect(toClient.text).toMatch(/refunded \$50\.46/);
    expect(testEmail().lastTo("olive@example.com").subject).toMatch(
      /Ended their Service Plan/,
    );
  });

  test("never books its Jobs again, and the home may start another plan", async () => {
    const { client, planId } = await crewedServicePlan();
    await end(client, planId, []).expect(200);

    testClock().set(new Date("2026-02-10T16:00:00Z"));
    expect(await generateServicePlanJobs()).toBe(0);
    expect(
      (await client.get("/api/service-plans/mine").expect(200))
        .body as ServicePlanSummary[],
    ).toEqual([]);
    await end(client, planId, []).expect(409);
  });

  test("within 24 hours of a Job lets it go ahead, taking the Deposit off its price", async () => {
    const { client, planId, jobId, cleanerId } = await crewedServicePlan();
    testClock().set(SUNDAY_10AM);

    const { endTerms } = await clientPlan(client, planId);
    expect(endTerms).toEqual(
      expect.objectContaining({
        cancelled: MONDAYS.slice(1),
        goingAhead: [MONDAYS[0]],
        finalJob: expect.objectContaining({ id: jobId, status: "booked" }),
      }),
    );
    await end(client, planId, [MONDAYS[0]!]).expect(200);
    expect(testPayments().refunds).toEqual([]);
    expect(testEmail().lastTo(casey.email).text).toMatch(
      /\$50\.46 Deposit comes off the price of your clean/,
    );

    // it's a one-off Job now: its own Deposit, and no plan to skip
    const job = (await client.get(`/api/jobs/mine/${jobId}`).expect(200))
      .body as ClientJobDetail;
    expect(job.servicePlanId).toBeNull();
    expect(job.cancelTerms).toEqual(
      expect.objectContaining({ late: true, feeCents: PLAN_DEPOSIT }),
    );

    testClock().set(new Date("2026-01-19T16:00:00Z"));
    await completeJob(cleanerId, jobId, { condition: "moderate", reports: [] });
    expect(chargesAfterDeposit().map((c) => c.amount)).toEqual([
      PLAN_TOTAL - PLAN_DEPOSIT,
    ]);
  });

  test("is refused, changing nothing, when a Job has come within 24 hours since the Client looked", async () => {
    const { client, planId } = await crewedServicePlan();
    testClock().set(SUNDAY_10AM);

    expect((await end(client, planId, []).expect(409)).body.message).toMatch(
      /less than 24 hours away, so it goes ahead/,
    );
    expect((await clientPlan(client, planId)).status).toBe("active");
  });

  test("after a Job is done refunds the Deposit, its last Job having been paid", async () => {
    const { client, planId, jobId, cleanerId } = await crewedServicePlan();
    testClock().set(new Date("2026-01-19T16:00:00Z"));
    await completeJob(cleanerId, jobId, { condition: "moderate", reports: [] });

    const { endTerms } = await clientPlan(client, planId);
    expect(endTerms!.finalJob).toEqual(
      expect.objectContaining({ id: jobId, status: "completed" }),
    );
    await end(client, planId, []).expect(200);
    expect(testPayments().refunds.map((r) => r.amount)).toEqual([PLAN_DEPOSIT]);
  });

  test("while On Hold pays the Unpaid fee from the Deposit, rather than refunding it", async () => {
    const { client, planId, jobId } = await crewedServicePlan();
    testClock().set(SUNDAY_10AM);
    testPayments().failCharges();
    await client
      .post(`/api/jobs/mine/${jobId}/cancel`)
      .send({ feeCents: PLAN_DEPOSIT })
      .expect(200);
    testPayments().failCharges(null);

    const { endTerms } = await clientPlan(client, planId);
    expect(endTerms).toEqual(
      expect.objectContaining({
        cancelled: MONDAYS.slice(1),
        deposit: "goes_towards",
        finalJob: expect.objectContaining({ id: jobId }),
      }),
    );
    await end(client, planId, []).expect(200);

    expect(testPayments().refunds).toEqual([]);
    expect(chargesAfterDeposit()).toEqual([]);
    const job = (await client.get(`/api/jobs/mine/${jobId}`).expect(200))
      .body as ClientJobDetail;
    expect(job.cancellation!.payment).toEqual(
      expect.objectContaining({ owedCents: 0, unpaid: null }),
    );
  });

  test("by Office Staff for the Client", async () => {
    const { office, planId } = await crewedServicePlan();
    const before = testEmail().sent.length;

    const plan = (
      await office
        .post(`/api/service-plans/${planId}/end`)
        .send({ goingAhead: [] })
        .expect(200)
    ).body as OfficeServicePlan;
    expect(plan.status).toBe("ended");

    const sent = testEmail().sent.slice(before);
    expect(sent.map((e) => e.subject)).toContain("Your Service Plan has Ended");
    expect(sent.map((e) => e.subject)).not.toContainEqual(
      expect.stringMatching(/Ended their Service Plan/),
    );
  });

  test("is the Client's own to do", async () => {
    const { office, client, planId } = await crewedServicePlan();
    await end(office, planId, []).expect(403);
    await end(await signIn("someone@example.com"), planId, []).expect(403);
    expect((await clientPlan(client, planId)).status).toBe("active");
  });
});
