import { describe, expect, test } from "vitest";
import type {
  CleanerJob,
  CleanerJobs,
  ClientJob,
  ClientJobDetail,
  NeedsAttentionItem,
  OfficeJob,
  ScheduleDay,
  SignedInAccount,
  Today,
} from "@empire-cleaning/models";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  api,
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import {
  acceptedJob,
  casey,
  guestAsk,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York. Jobs
// here are at 9am on Monday the 12th (14:00 UTC), so cancelling is free
// until 9am on Sunday the 11th.
const STARTS_AT = "2026-01-12T14:00:00Z";
const FREE_UNTIL = "2026-01-11T14:00:00.000Z";
const SUNDAY_8_59AM = new Date("2026-01-11T13:59:00Z");
const SUNDAY_9AM = new Date("2026-01-11T14:00:00Z");
const MONDAY_9_30AM = new Date("2026-01-12T14:30:00Z");

const cleaner = async (name: string) => {
  const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
  const member = await createStaff({ name, email, roles: ["cleaner"] });
  await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
  return { ...member, email };
};

/**
 * Casey's Deep Clean at 9am on Monday the 12th, accepted with a 25% Deposit,
 * with Cory Offered a place and Confirmed on it.
 */
const bookedJob = async ({ crewSize = 1 } = {}) => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const cory = await cleaner("Cory Cleaner");
  await cleaner("Dee Cleaner");

  const job = await acceptedJob({
    startsAt: STARTS_AT,
    byAccountId: me.id,
    crewSize,
  });
  await office
    .post(`/api/jobs/${job.id}/assignments`)
    .send({ staffId: cory.id })
    .expect(201);
  const asCory = await signIn(cory.email);
  const mine = (await asCory.get(`/api/assignments/mine/${job.id}`))
    .body as CleanerJob;
  await asCory.post(`/api/assignments/${mine.assignment.id}/confirm`);

  const client = await signIn(casey.email);
  const deposit = testPayments().charges[0]!.amount;
  return { office, client, asCory, jobId: job.id, deposit };
};

const clientJob = async (client: Agent, jobId: string) =>
  (await client.get(`/api/jobs/mine/${jobId}`).expect(200))
    .body as ClientJobDetail;

const officeJob = async (office: Agent, jobId: string) =>
  (await office.get(`/api/jobs/${jobId}`).expect(200)).body as OfficeJob;

const cancel = (client: Agent, jobId: string, feeCents: number) =>
  client.post(`/api/jobs/mine/${jobId}/cancel`).send({ feeCents });

const noAccess = (
  agent: Agent,
  jobId: string,
  reason = "Nobody home and the gate was locked",
) => agent.post(`/api/assignments/mine/${jobId}/no-access`).send({ reason });

const refunded = () => testPayments().refunds.map((r) => r.amount);

describe("what cancelling costs", () => {
  test("is free, with the Deposit refunded, more than 24 hours ahead", async () => {
    const { client, jobId, deposit } = await bookedJob();
    testClock().set(SUNDAY_8_59AM);

    expect((await clientJob(client, jobId)).cancelTerms).toEqual({
      by: "client",
      late: false,
      feeCents: 0,
      refundCents: deposit,
      freeUntil: FREE_UNTIL,
    });
  });

  test("is the Deposit from 24 hours ahead, a Late Cancellation", async () => {
    const { client, office, jobId, deposit } = await bookedJob();
    testClock().set(SUNDAY_9AM);

    expect((await clientJob(client, jobId)).cancelTerms).toEqual({
      by: "client",
      late: true,
      feeCents: deposit,
      refundCents: 0,
      freeUntil: FREE_UNTIL,
    });
    // Empire Cleaning cancelling refunds it in full, whenever
    expect((await officeJob(office, jobId)).cancelTerms).toEqual({
      client: expect.objectContaining({ late: true, feeCents: deposit }),
      empire: expect.objectContaining({
        late: false,
        feeCents: 0,
        refundCents: deposit,
      }),
    });
  });

  test("isn't offered to the Client once the Job has started", async () => {
    const { client, office, jobId, deposit } = await bookedJob();
    testClock().set(MONDAY_9_30AM);

    expect((await clientJob(client, jobId)).cancelTerms).toBeNull();
    expect(
      (await cancel(client, jobId, deposit).expect(409)).body.message,
    ).toMatch(/already started.*call the Office/);
    // the Office still can
    expect((await officeJob(office, jobId)).cancelTerms).not.toBeNull();
  });
});

describe("the Client cancelling", () => {
  test("more than 24 hours ahead refunds the Deposit and takes the Job off the Schedule", async () => {
    const { client, office, asCory, jobId, deposit } = await bookedJob();
    testClock().set(SUNDAY_8_59AM);
    const before = (
      await office.get("/api/schedule?from=2026-01-12&to=2026-01-12")
    ).body as ScheduleDay[];

    const seen = (await cancel(client, jobId, 0).expect(200))
      .body as ClientJobDetail;

    expect(seen).toMatchObject({
      status: "cancelled",
      cancelTerms: null,
      cancellation: {
        cancelledAt: SUNDAY_8_59AM.toISOString(),
        by: "client",
        late: false,
        reason: null,
        feeCents: 0,
        payment: { paidCents: 0, owedCents: 0 },
      },
    });
    expect(refunded()).toEqual([deposit]);

    // off the Schedule, its hours free again, and gone from everyone's lists
    const [day] = (
      await office.get("/api/schedule?from=2026-01-12&to=2026-01-12")
    ).body as ScheduleDay[];
    expect(day!.jobs).toEqual([]);
    expect(day!.freeHours).toBeGreaterThan(before[0]!.freeHours);
    expect((await client.get("/api/jobs/mine")).body as ClientJob[]).toEqual(
      [],
    );
    const coryJobs = (await asCory.get("/api/assignments/mine"))
      .body as CleanerJobs;
    expect([...coryJobs.today, ...coryJobs.upcoming]).toEqual([]);
    // the Office still sees it
    expect((await officeJob(office, jobId)).cancellation).toMatchObject({
      by: "client",
      late: false,
    });

    const email = testEmail().lastTo(casey.email);
    expect(email.subject).toBe("Your clean is cancelled");
    expect(email.text).toContain("There's no charge for cancelling.");
    expect(email.text).toMatch(/We've refunded \$[\d.]+ to your Test card/);
    expect(testEmail().lastTo("cory@example.com").text).toMatch(
      /We've cancelled the Deep Clean .* You don't need to go\./,
    );
    expect(testEmail().lastTo("olive@example.com").subject).toBe(
      "Casey Client cancelled a Job",
    );
  });

  test("within 24 hours keeps the Deposit as the fee", async () => {
    const { client, jobId, deposit } = await bookedJob();
    testClock().set(SUNDAY_9AM);

    const seen = (await cancel(client, jobId, deposit).expect(200))
      .body as ClientJobDetail;

    expect(seen.cancellation).toMatchObject({
      late: true,
      feeCents: deposit,
      payment: { paidCents: deposit, owedCents: 0 },
    });
    expect(refunded()).toEqual([]);
    expect(testEmail().lastTo(casey.email).text).toContain(
      "it's a Late Cancellation: your",
    );
  });

  test("is refused, not charged, when it has become late since they looked", async () => {
    const { client, jobId, deposit } = await bookedJob();
    testClock().set(SUNDAY_8_59AM);
    const { cancelTerms } = await clientJob(client, jobId);
    expect(cancelTerms!.feeCents).toBe(0);

    testClock().set(SUNDAY_9AM);
    const refused = await cancel(client, jobId, 0).expect(409);
    expect(refused.body.message).toMatch(
      /less than 24 hours .* Late Cancellation/,
    );
    expect((await clientJob(client, jobId)).status).toBe("booked");
    await cancel(client, jobId, deposit).expect(200);
  });

  test("is only for the Job's own Client, once", async () => {
    const { office, asCory, jobId } = await bookedJob();
    const other = {
      name: "Ollie Other",
      email: "ollie@example.com",
      phone: "(646) 555-0199",
    };
    await submit(guestAsk({ contact: other })).expect(201);

    await cancel(await signIn(other.email), jobId, 0).expect(404);
    await cancel(asCory, jobId, 0).expect(403);
    await api()
      .post(`/api/jobs/mine/${jobId}/cancel`)
      .send({ feeCents: 0 })
      .expect(401);

    const client = await signIn(casey.email);
    await cancel(client, jobId, 0).expect(200);
    expect((await cancel(client, jobId, 0).expect(409)).body.message).toBe(
      "This Job has already been cancelled",
    );
    await office
      .post(`/api/jobs/${jobId}/cancel`)
      .send({ by: "empire", feeCents: 0 })
      .expect(409);
  });
});

describe("Office Staff cancelling", () => {
  test("on the Client's behalf follows the same policy, without emailing the Office", async () => {
    const { office, jobId, deposit } = await bookedJob();
    testClock().set(SUNDAY_9AM);
    const sentToOffice = testEmail().to("olive@example.com").length;

    const job = (
      await office
        .post(`/api/jobs/${jobId}/cancel`)
        .send({ by: "client", feeCents: deposit })
        .expect(200)
    ).body as OfficeJob;

    expect(job.status).toBe("cancelled");
    expect(job.cancellation).toMatchObject({
      by: "client",
      late: true,
      feeCents: deposit,
    });
    expect(refunded()).toEqual([]);
    expect(testEmail().to("olive@example.com")).toHaveLength(sentToOffice);
  });

  test("for Empire Cleaning refunds the Deposit in full, even after the Job has started", async () => {
    const { office, jobId, deposit } = await bookedJob();
    testClock().set(MONDAY_9_30AM);

    const job = (
      await office
        .post(`/api/jobs/${jobId}/cancel`)
        .send({
          by: "empire",
          feeCents: 0,
          reason: "Our crew's van broke down.",
        })
        .expect(200)
    ).body as OfficeJob;

    expect(job.cancellation).toMatchObject({
      by: "empire",
      late: false,
      feeCents: 0,
      reason: "Our crew's van broke down.",
      payment: { paidCents: 0 },
    });
    expect(refunded()).toEqual([deposit]);
    const email = testEmail().lastTo(casey.email);
    expect(email.text).toContain(
      "we've had to cancel the Deep Clean at 41-12 Austin St",
    );
    expect(email.text).toContain("Our crew's van broke down.");
    expect(email.text).toContain("You won't be charged anything for it.");
  });

  test("is for Office Staff only, saying who it's down to", async () => {
    const { office, client, asCory, jobId } = await bookedJob();

    await client
      .post(`/api/jobs/${jobId}/cancel`)
      .send({ by: "empire", feeCents: 0 })
      .expect(403);
    await asCory
      .post(`/api/jobs/${jobId}/cancel`)
      .send({ by: "empire", feeCents: 0 })
      .expect(403);
    await office
      .post(`/api/jobs/${jobId}/cancel`)
      .send({ feeCents: 0 })
      .expect(400);
  });
});

describe("No Access", () => {
  test("keeps the Deposit as the fee, and the Job isn't Completed", async () => {
    const { office, client, asCory, jobId, deposit } = await bookedJob();
    testClock().set(MONDAY_9_30AM);

    const seen = (await noAccess(asCory, jobId).expect(200)).body as CleanerJob;

    expect(seen).toMatchObject({
      outcome: "no_access",
      canComplete: false,
      canRecordNoAccess: false,
      completion: null,
      noAccess: {
        recordedAt: MONDAY_9_30AM.toISOString(),
        recordedBy: "Cory Cleaner",
        reason: "Nobody home and the gate was locked",
      },
    });
    expect(refunded()).toEqual([]);
    expect(testPayments().charges.map((c) => c.amount)).toEqual([deposit]);

    const job = await officeJob(office, jobId);
    expect(job).toMatchObject({
      status: "no_access",
      completion: null,
      cancelTerms: null,
      noAccess: {
        recordedBy: { name: "Cory Cleaner" },
        feeCents: deposit,
        payment: { paidCents: deposit, owedCents: 0 },
      },
    });
    expect((await clientJob(client, jobId)).noAccess).toMatchObject({
      feeCents: deposit,
      reason: "Nobody home and the gate was locked",
    });
    const today = (await office.get("/api/dashboard/today").expect(200))
      .body as Today;
    expect(today.jobs.find((j) => j.id === jobId)?.outcome).toBe("no_access");

    const email = testEmail().lastTo(casey.email);
    expect(email.subject).toBe("We couldn't get in for your clean");
    expect(email.text).toContain('("Nobody home and the gate was locked")');
    expect(email.text).toContain("As with a Late Cancellation, your");
    expect(testEmail().lastTo("olive@example.com").subject).toBe(
      "No Access at 41-12 Austin St, 4B, 11375",
    );

    // and it can't then be Completed, cancelled or recorded again
    await asCory
      .post(`/api/assignments/mine/${jobId}/complete`)
      .send({ condition: "moderate", reports: [] })
      .expect(409);
    await office
      .post(`/api/jobs/${jobId}/cancel`)
      .send({ by: "empire", feeCents: 0 })
      .expect(409);
    expect((await noAccess(asCory, jobId).expect(409)).body.message).toBe(
      "No Access has already been recorded for this Job",
    );
  });

  test("is for a Cleaner with a Confirmed place, once the Job has started", async () => {
    const { office, client, jobId } = await bookedJob();
    const asDee = await signIn("dee@example.com");

    testClock().set(new Date("2026-01-12T13:59:00Z"));
    const before = (await signIn("cory@example.com"))
      .post(`/api/assignments/mine/${jobId}/no-access`)
      .send({ reason: "Locked out" });
    expect((await before.expect(409)).body.message).toBe(
      "This Job hasn't started yet",
    );

    testClock().set(MONDAY_9_30AM);
    await noAccess(asDee, jobId).expect(404);
    await noAccess(office, jobId).expect(403);
    await noAccess(client, jobId).expect(403);
    const asCory = await signIn("cory@example.com");
    await asCory
      .post(`/api/assignments/mine/${jobId}/no-access`)
      .send({ reason: " " })
      .expect(400);
  });

  test("doesn't wait for the rest of the crew to Confirm, and leaves Needs attention", async () => {
    const { office, asCory, jobId } = await bookedJob({ crewSize: 2 });
    testClock().set(MONDAY_9_30AM);

    const job = (await asCory.get(`/api/assignments/mine/${jobId}`))
      .body as CleanerJob;
    expect(job.canComplete).toBe(false);
    expect(job.canRecordNoAccess).toBe(true);
    const unassigned = async () =>
      (
        (await office.get("/api/dashboard/needs-attention").expect(200))
          .body as NeedsAttentionItem[]
      ).filter((i) => i.kind === "job_unassigned");
    expect(await unassigned()).toHaveLength(1);

    await noAccess(asCory, jobId).expect(200);
    expect(await unassigned()).toEqual([]);
  });

  test("is refused for an Offered place not yet Confirmed", async () => {
    const { office, jobId } = await bookedJob({ crewSize: 2 });
    const dee = (await office.get(`/api/jobs/${jobId}`)).body as OfficeJob;
    await office
      .post(`/api/jobs/${jobId}/assignments`)
      .send({ staffId: dee.cleaners.find((c) => c.name === "Dee Cleaner")!.id })
      .expect(201);
    testClock().set(MONDAY_9_30AM);

    const asDee = await signIn("dee@example.com");
    expect((await noAccess(asDee, jobId).expect(409)).body.message).toBe(
      "Confirm your place on this Job first",
    );
  });
});
