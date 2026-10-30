import { describe, expect, test } from "vitest";
import type {
  ClientPastJob,
  NeedsAttentionItem,
  OfficeServicePlan,
  ServicePlanView,
} from "@empire-cleaning/models";
import { completeJob } from "#features/completion";
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
      /Service Plan is On Hold/,
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
        unpaid: true,
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
    const { office, client, planId, jobId } = await heldPlan();

    // On Hold for weeks: 16 February to 2 March come and go unbooked
    testClock().set(new Date("2026-03-03T16:00:00Z"));
    expect(await generateServicePlanJobs()).toBe(0);

    testPayments().failCharges(null);
    await client.post(`/api/jobs/mine/${jobId}/balance/retry`).expect(200);
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

  test("when it's a completed Job's Balance puts the plan On Hold too, and the Office's retry resumes it", async () => {
    const { office, client, planId, jobId, cleanerId } =
      await crewedServicePlan();
    testClock().set(new Date("2026-01-19T16:00:00Z"));
    testPayments().failCharges();
    await completeJob(cleanerId, jobId, { condition: "moderate", reports: [] });

    expect((await clientPlan(client, planId)).status).toBe("on_hold");
    const unpaidNotice = testEmail().lastTo(casey.email);
    expect(unpaidNotice.subject).toBe("We couldn't take your payment");
    expect(unpaidNotice.text).toMatch(/Service Plan is On Hold/);

    testPayments().failCharges(null);
    await office.post(`/api/jobs/${jobId}/balance/retry`).expect(200);
    expect((await clientPlan(client, planId)).status).toBe("active");
    expect(testPayments().charges.at(-1)!.amount).toBe(PLAN_TOTAL);
    expect(testEmail().lastTo(casey.email).text).toMatch(
      /Service Plan is back on/,
    );
  });
});
