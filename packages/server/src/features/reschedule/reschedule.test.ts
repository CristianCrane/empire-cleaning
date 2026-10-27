import { describe, expect, test } from "vitest";
import type {
  CleanerJob,
  ClientJobDetail,
  NeedsAttentionItem,
  OfficeJob,
  RescheduleCost,
  RescheduleTimes,
  ScheduleDay,
  SignedInAccount,
} from "@empire-cleaning/models";
import { createStaff, setUsualWeek } from "#features/staff/staff";
import {
  api,
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import {
  acceptedJob,
  bookedJob as otherJob,
  casey,
  guestAsk,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York. The Job
// here is at 9am on Monday the 12th (14:00 UTC), so moving it is free until
// 9am on Sunday the 11th. Cory and Dee each work 8 hours on weekdays, so a
// weekday has 16 hours of Cleaner time.
const STARTS_AT = "2026-01-12T14:00:00Z";
const FREE_UNTIL = "2026-01-11T14:00:00.000Z";
const SUNDAY_8_59AM = new Date("2026-01-11T13:59:00Z");
const SUNDAY_9AM = new Date("2026-01-11T14:00:00Z");
// Wednesday the 14th at 10am, and Thursday the 15th at 10am
const WEDNESDAY = { date: "2026-01-14", time: "10:00" };
const WEDNESDAY_10AM = "2026-01-14T15:00:00.000Z";
const THURSDAY = { date: "2026-01-15", time: "10:00" };
const THURSDAY_10AM = "2026-01-15T15:00:00.000Z";

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
const bookedJob = async () => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const cory = await cleaner("Cory Cleaner");
  await cleaner("Dee Cleaner");

  const job = await acceptedJob({ startsAt: STARTS_AT, byAccountId: me.id });
  await office
    .post(`/api/jobs/${job.id}/assignments`)
    .send({ staffId: cory.id })
    .expect(201);
  const asCory = await signIn(cory.email);
  await confirmPlace(asCory, job.id);

  const client = await signIn(casey.email);
  const deposit = testPayments().charges[0]!.amount;
  return { office, client, asCory, jobId: job.id, job, deposit };
};

const confirmPlace = async (asCleaner: Agent, jobId: string) => {
  const mine = (await asCleaner.get(`/api/assignments/mine/${jobId}`))
    .body as CleanerJob;
  await asCleaner
    .post(`/api/assignments/${mine.assignment.id}/confirm`)
    .expect(200);
};

const clientJob = async (client: Agent, jobId: string) =>
  (await client.get(`/api/jobs/mine/${jobId}`).expect(200))
    .body as ClientJobDetail;

const officeJob = async (office: Agent, jobId: string) =>
  (await office.get(`/api/jobs/${jobId}`).expect(200)).body as OfficeJob;

const ask = (
  client: Agent,
  jobId: string,
  to: { date: string; time: string },
  cost: RescheduleCost = "free",
) =>
  client
    .post(`/api/jobs/mine/${jobId}/reschedule-request`)
    .send({ ...to, cost });

const confirm = (office: Agent, jobId: string) =>
  office.post(`/api/jobs/${jobId}/reschedule-request/confirm`);

const scheduleDay = async (office: Agent, date: string) =>
  (
    (await office.get(`/api/schedule?from=${date}&to=${date}`).expect(200))
      .body as ScheduleDay[]
  )[0]!;

const complete = (asCleaner: Agent, jobId: string) =>
  asCleaner
    .post(`/api/assignments/mine/${jobId}/complete`)
    .send({ condition: "moderate", reports: [] });

describe("the times a Job can move to", () => {
  test("are the days from tomorrow with room for it, at the start times on offer", async () => {
    const { client, job } = await bookedJob();
    // Tuesday the 13th is full
    await otherJob({ startsAt: "2026-01-13T14:00:00Z", labourHours: 16 });

    const times = (
      await client.get(`/api/jobs/mine/${job.id}/reschedule-times`).expect(200)
    ).body as RescheduleTimes;

    // from Tuesday the 6th, weekdays only (nobody works weekends), never the
    // full Tuesday, but always the Job's own Monday
    expect(times.days.slice(0, 8).map((d) => d.date)).toEqual([
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
      "2026-01-12",
      "2026-01-14",
      "2026-01-15",
      "2026-01-16",
    ]);
    expect(times.days.at(-1)!.date <= "2026-03-02").toBe(true);
    expect(times.days[0]!.times).toEqual([
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
    ]);
  });

  test("come with what moving costs, until it's asked", async () => {
    const { client, office, jobId } = await bookedJob();
    expect((await clientJob(client, jobId)).rescheduleTerms).toEqual({
      cost: "free",
      feeCents: 0,
      freeUntil: FREE_UNTIL,
    });

    await ask(client, jobId, WEDNESDAY).expect(201);
    expect((await clientJob(client, jobId)).rescheduleTerms).toBeNull();
    expect((await officeJob(office, jobId)).rescheduleTerms).toBeNull();
  });
});

describe("asking to move a Job", () => {
  test("holds the new time's hours while it's pending, and tells the Office", async () => {
    const { client, office, jobId, job } = await bookedJob();

    const seen = (await ask(client, jobId, WEDNESDAY).expect(201))
      .body as ClientJobDetail;

    expect(seen.startsAt).toBe(new Date(STARTS_AT).toISOString());
    expect(seen.rescheduleRequest).toMatchObject({
      status: "pending",
      fromStartsAt: new Date(STARTS_AT).toISOString(),
      startsAt: WEDNESDAY_10AM,
      cost: "free",
      feeCents: 0,
      byClient: true,
      answeredAt: null,
    });
    // held on Wednesday, still booked on Monday
    const wednesday = await scheduleDay(office, "2026-01-14");
    expect(wednesday.heldHours).toBe(job.labourHours);
    expect(wednesday.freeHours).toBe(16 - job.labourHours);
    expect((await scheduleDay(office, "2026-01-12")).jobs).toHaveLength(1);

    const email = testEmail().lastTo("olive@example.com");
    expect(email.subject).toBe("Casey Client asked to move a Job");
    expect(email.text).toContain("Wednesday, January 14 at 10:00 AM");

    const items = (await office.get("/api/dashboard/needs-attention"))
      .body as NeedsAttentionItem[];
    expect(items).toContainEqual(
      expect.objectContaining({
        kind: "reschedule_requested",
        job: expect.objectContaining({ id: jobId }),
        request: expect.objectContaining({ startsAt: WEDNESDAY_10AM }),
      }),
    );
  });

  test("can't take hours another request holds", async () => {
    const { client, jobId, job } = await bookedJob();
    // Wednesday has room for this Job once, not twice; the other Job is at
    // 7pm, clear of its crew
    await otherJob({
      startsAt: "2026-01-15T00:00:00Z",
      labourHours: 16 - job.labourHours * 1.5,
    });
    const other = await otherJob({
      startsAt: "2026-01-16T14:00:00Z",
      labourHours: job.labourHours,
    });
    const office = await signIn("olive@example.com");

    await ask(client, jobId, WEDNESDAY).expect(201);
    const refused = await office
      .post(`/api/jobs/${other.id}/reschedule-request`)
      .send({ ...WEDNESDAY, cost: "free" })
      .expect(409);
    expect(refused.body.message).toBe(
      "That time has just filled up. Please choose another.",
    );
    const times = (
      await office.get(`/api/jobs/${other.id}/reschedule-times`).expect(200)
    ).body as RescheduleTimes;
    expect(times.days.map((d) => d.date)).not.toContain("2026-01-14");
  });

  test("to another time on its own day needs no more room", async () => {
    const { client, office, jobId } = await bookedJob();
    await otherJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 10 });

    await ask(client, jobId, { date: "2026-01-12", time: "08:00" }).expect(201);
    expect((await scheduleDay(office, "2026-01-12")).heldHours).toBe(0);
  });

  test("can't take a crew another request holds at that time", async () => {
    const { client, office, jobId } = await bookedJob();
    // another Client's crew of 2 asks for Wednesday at 10am first, there
    // until 11am
    const other = await otherJob({
      startsAt: "2026-01-16T14:00:00Z",
      labourHours: 2,
    });
    await office
      .post(`/api/jobs/${other.id}/reschedule-request`)
      .send({ ...WEDNESDAY, cost: "free" })
      .expect(201);

    const refused = await ask(client, jobId, WEDNESDAY).expect(409);
    expect(refused.body.message).toBe(
      "That time has just filled up. Please choose another.",
    );
    // the Client isn't offered it, but Wednesday's later times still
    const times = (
      await client.get(`/api/jobs/mine/${jobId}/reschedule-times`).expect(200)
    ).body as RescheduleTimes;
    const wednesday = times.days.find((d) => d.date === "2026-01-14")!;
    expect(wednesday.times).not.toContain("10:00");
    expect(wednesday.times).toContain("11:00");
    await ask(client, jobId, { date: "2026-01-14", time: "11:00" }).expect(201);
  });

  test("leaves out a day with no crew free at any time on offer", async () => {
    const { client, jobId } = await bookedJob();
    // a crew of 2 all Wednesday, 7am to 7pm, on 24 of the 16 hours: the day
    // is short of hours too, but a crew of 2 at 7pm would still need both
    await otherJob({ startsAt: "2026-01-14T12:00:00Z", labourHours: 24 });

    const times = (
      await client.get(`/api/jobs/mine/${jobId}/reschedule-times`).expect(200)
    ).body as RescheduleTimes;
    expect(times.days.map((d) => d.date)).not.toContain("2026-01-14");
  });

  test("only for a time on offer, one at a time", async () => {
    const { client, jobId } = await bookedJob();
    await otherJob({ startsAt: "2026-01-13T14:00:00Z", labourHours: 16 });

    expect(
      (
        await ask(client, jobId, { date: "2026-01-13", time: "10:00" }).expect(
          409,
        )
      ).body.message,
    ).toBe("That time has just filled up. Please choose another.");
    expect(
      (
        await ask(client, jobId, { date: "2026-01-14", time: "10:30" }).expect(
          409,
        )
      ).body.message,
    ).toBe("Choose one of the start times on offer");
    expect(
      (
        await ask(client, jobId, { date: "2026-01-05", time: "10:00" }).expect(
          409,
        )
      ).body.message,
    ).toMatch(/from tomorrow/);
    expect(
      (
        await ask(client, jobId, { date: "2026-01-12", time: "09:00" }).expect(
          409,
        )
      ).body.message,
    ).toBe("That's when the clean is already booked");

    await ask(client, jobId, WEDNESDAY).expect(201);
    expect(
      (await ask(client, jobId, THURSDAY).expect(409)).body.message,
    ).toMatch(/already a request/);
  });

  test("is only for the Job's own Client", async () => {
    const { asCory, jobId } = await bookedJob();
    const other = {
      name: "Ollie Other",
      email: "ollie@example.com",
      phone: "(646) 555-0199",
    };
    await submit(guestAsk({ contact: other })).expect(201);

    await ask(await signIn(other.email), jobId, WEDNESDAY).expect(404);
    await ask(asCory, jobId, WEDNESDAY).expect(403);
    await api()
      .post(`/api/jobs/mine/${jobId}/reschedule-request`)
      .send({ ...WEDNESDAY, cost: "free" })
      .expect(401);
  });

  test("can be done by Office Staff for the Client, without emailing the Office", async () => {
    const { office, jobId } = await bookedJob();
    const sent = testEmail().sent.length;

    const seen = (
      await office
        .post(`/api/jobs/${jobId}/reschedule-request`)
        .send({ ...WEDNESDAY, cost: "free" })
        .expect(201)
    ).body as OfficeJob;

    expect(seen.rescheduleRequest).toMatchObject({
      status: "pending",
      byClient: false,
    });
    expect(testEmail().sent.length).toBe(sent);
  });
});

describe("Office Staff answering", () => {
  test("confirming moves the Job and Offers its places afresh", async () => {
    const { client, office, asCory, jobId, job } = await bookedJob();
    await ask(client, jobId, WEDNESDAY).expect(201);

    const seen = (await confirm(office, jobId).expect(200)).body as OfficeJob;

    expect(seen.startsAt).toBe(WEDNESDAY_10AM);
    expect(seen.rescheduleRequest).toMatchObject({ status: "confirmed" });
    expect(seen.assignments).toEqual([
      expect.objectContaining({ status: "offered", answeredAt: null }),
    ]);
    expect(seen.assignment).toBe("unassigned");
    // booked on Wednesday, no longer held there, and gone from Monday
    const wednesday = await scheduleDay(office, "2026-01-14");
    expect(wednesday).toMatchObject({
      bookedHours: job.labourHours,
      heldHours: 0,
    });
    expect((await scheduleDay(office, "2026-01-12")).jobs).toEqual([]);

    const toCasey = testEmail().lastTo(casey.email);
    expect(toCasey.subject).toBe("Your clean has moved");
    expect(toCasey.text).toContain(
      "from Monday, January 12 at 9:00 AM to Wednesday, January 14 at 10:00 AM",
    );
    expect(toCasey.text).toContain("There's no charge for moving it.");
    const toCory = testEmail().lastTo("cory@example.com");
    expect(toCory.subject).toBe("A Job you're on has moved");
    expect(toCory.text).toContain("Please confirm your place at the new time");

    // Cory Confirms again at the new time
    await confirmPlace(asCory, jobId);
    expect((await officeJob(office, jobId)).assignment).toBe("assigned");
    expect((await clientJob(client, jobId)).rescheduleTerms).not.toBeNull();
  });

  test("turning down keeps the Job's time and frees the held hours", async () => {
    const { client, office, jobId } = await bookedJob();
    await ask(client, jobId, WEDNESDAY).expect(201);

    const seen = (
      await office
        .post(`/api/jobs/${jobId}/reschedule-request/turn-down`)
        .send({ reason: "We're fully booked that morning." })
        .expect(200)
    ).body as OfficeJob;

    expect(seen.startsAt).toBe(new Date(STARTS_AT).toISOString());
    expect(seen.rescheduleRequest).toMatchObject({
      status: "turned_down",
      reason: "We're fully booked that morning.",
    });
    expect(seen.assignments[0]!.status).toBe("confirmed");
    expect((await scheduleDay(office, "2026-01-14")).heldHours).toBe(0);

    const email = testEmail().lastTo(casey.email);
    expect(email.subject).toBe("We couldn't move your clean");
    expect(email.text).toContain("We're fully booked that morning.");
    expect(email.text).toContain("there's no charge");

    const items = (await office.get("/api/dashboard/needs-attention"))
      .body as NeedsAttentionItem[];
    expect(items.map((i) => i.kind)).not.toContain("reschedule_requested");
    await confirm(office, jobId).expect(409);
  });

  test("is refused once the Job has started at its booked time", async () => {
    const { client, office, jobId } = await bookedJob();
    await ask(client, jobId, WEDNESDAY).expect(201);
    testClock().set(new Date("2026-01-12T14:30:00Z"));

    expect((await confirm(office, jobId).expect(409)).body.message).toMatch(
      /already started/,
    );
    await office
      .post(`/api/jobs/${jobId}/reschedule-request/turn-down`)
      .send({})
      .expect(200);
  });

  test("confirming is refused when the time asked for no longer has a crew free", async () => {
    const { client, office, jobId } = await bookedJob();
    await ask(client, jobId, WEDNESDAY).expect(201);
    // Dee takes Wednesday off, and Cory is given another Job at 10am
    const staffList = (await office.get("/api/staff").expect(200)).body as {
      id: string;
      name: string;
    }[];
    const dee = staffList.find((s) => s.name === "Dee Cleaner")!;
    await office
      .put(`/api/staff/${dee.id}/exceptions/2026-01-14`)
      .send({ hours: 0 });
    await otherJob({ startsAt: WEDNESDAY_10AM, labourHours: 1, crewSize: 1 });

    const refused = await confirm(office, jobId).expect(409);
    expect(refused.body.message).toBe(
      "Not enough Cleaners are free then: the Job needs 1, and 0 of the 1 available that day are. Turn the request down, or give a Cleaner hours that day.",
    );
    expect((await officeJob(office, jobId)).startsAt).toBe(
      new Date(STARTS_AT).toISOString(),
    );
  });

  test("is for Office Staff only", async () => {
    const { client, asCory, jobId } = await bookedJob();
    await ask(client, jobId, WEDNESDAY).expect(201);

    await confirm(client, jobId).expect(403);
    await confirm(asCory, jobId).expect(403);
  });
});

describe("the Client withdrawing", () => {
  test("keeps the Job's time and frees the held hours", async () => {
    const { client, office, jobId } = await bookedJob();
    await ask(client, jobId, WEDNESDAY).expect(201);

    const seen = (
      await client
        .post(`/api/jobs/mine/${jobId}/reschedule-request/withdraw`)
        .expect(200)
    ).body as ClientJobDetail;

    expect(seen.startsAt).toBe(new Date(STARTS_AT).toISOString());
    expect(seen.rescheduleRequest).toMatchObject({ status: "withdrawn" });
    expect(seen.rescheduleTerms).toMatchObject({ cost: "free" });
    expect((await scheduleDay(office, "2026-01-14")).heldHours).toBe(0);
    await client
      .post(`/api/jobs/mine/${jobId}/reschedule-request/withdraw`)
      .expect(409);
  });
});

describe("a Late Reschedule (ADR-0010)", () => {
  test("is judged when it's asked: a request sent in time stays free", async () => {
    const { client, office, jobId } = await bookedJob();
    testClock().set(SUNDAY_8_59AM);
    await ask(client, jobId, WEDNESDAY, "free").expect(201);

    testClock().set(SUNDAY_9AM);
    await confirm(office, jobId).expect(200);
    expect(testEmail().lastTo(casey.email).text).toContain(
      "There's no charge for moving it.",
    );
  });

  test("is refused, not sent, when it has become late since they looked", async () => {
    const { client, jobId } = await bookedJob();
    testClock().set(SUNDAY_8_59AM);
    expect((await clientJob(client, jobId)).rescheduleTerms!.cost).toBe("free");

    testClock().set(SUNDAY_9AM);
    const refused = await ask(client, jobId, WEDNESDAY, "free").expect(409);
    expect(refused.body.message).toMatch(
      /less than 24 hours .* a Late Reschedule, free as the Job's first/,
    );
    expect((await clientJob(client, jobId)).rescheduleRequest).toBeNull();
  });

  test("the first one confirmed is free, and the Deposit still counts towards the price", async () => {
    const { client, office, asCory, jobId, deposit } = await bookedJob();
    testClock().set(SUNDAY_9AM);
    expect((await clientJob(client, jobId)).rescheduleTerms).toEqual({
      cost: "free_late",
      feeCents: 0,
      freeUntil: FREE_UNTIL,
    });

    await ask(client, jobId, WEDNESDAY, "free_late").expect(201);
    await confirm(office, jobId).expect(200);
    expect(testEmail().lastTo(casey.email).text).toContain(
      "Your first one is free, and your Deposit still counts towards the price.",
    );

    await confirmPlace(asCory, jobId);
    testClock().set(new Date(WEDNESDAY_10AM));
    await complete(asCory, jobId).expect(200);
    const { completion } = await clientJob(client, jobId);
    expect(completion!.payment).toMatchObject({
      rescheduleFeeCents: 0,
      paidCents: completion!.payment.totalCents,
      owedCents: 0,
    });
    expect(testPayments().charges.at(-1)!.amount).toBe(
      completion!.payment.totalCents - deposit,
    );
  });

  test("a later one keeps the Deposit as the fee, and the full price is charged on completion", async () => {
    const { client, office, asCory, jobId, deposit } = await bookedJob();
    testClock().set(SUNDAY_9AM);
    await ask(client, jobId, WEDNESDAY, "free_late").expect(201);
    await confirm(office, jobId).expect(200);

    // less than 24 hours before Wednesday at 10am
    testClock().set(new Date("2026-01-13T16:00:00Z"));
    expect((await clientJob(client, jobId)).rescheduleTerms).toMatchObject({
      cost: "late_cancellation",
      feeCents: deposit,
    });
    await ask(client, jobId, THURSDAY, "late_cancellation").expect(201);
    const moved = (await confirm(office, jobId).expect(200)).body as OfficeJob;
    expect(moved.startsAt).toBe(THURSDAY_10AM);
    expect(testEmail().lastTo(casey.email).text).toMatch(
      /second Late Reschedule, it's a Late Cancellation: your \$[\d.]+ Deposit is kept as the fee, and the full price is charged/,
    );
    // nothing moves now: the Deposit has been paid
    expect(testPayments().charges).toHaveLength(1);

    // a third late one keeps nothing more
    testClock().set(new Date("2026-01-14T16:00:00Z"));
    expect((await clientJob(client, jobId)).rescheduleTerms).toMatchObject({
      cost: "late_cancellation",
      feeCents: 0,
    });

    await confirmPlace(asCory, jobId);
    testClock().set(new Date(THURSDAY_10AM));
    await complete(asCory, jobId).expect(200);
    const { completion } = await clientJob(client, jobId);
    expect(completion!.payment).toMatchObject({
      rescheduleFeeCents: deposit,
      paidCents: completion!.payment.totalCents + deposit,
      owedCents: 0,
    });
    expect(testPayments().charges.at(-1)!.amount).toBe(
      completion!.payment.totalCents,
    );
    expect(testEmail().lastTo(casey.email).text).toContain(
      "Late Reschedule fee (your Deposit, kept)",
    );
  });

  test("turned down or withdrawn costs nothing and leaves the free one unused", async () => {
    const { client, office, jobId } = await bookedJob();
    testClock().set(SUNDAY_9AM);

    await ask(client, jobId, WEDNESDAY, "free_late").expect(201);
    await office
      .post(`/api/jobs/${jobId}/reschedule-request/turn-down`)
      .send({})
      .expect(200);
    await ask(client, jobId, WEDNESDAY, "free_late").expect(201);
    await client
      .post(`/api/jobs/mine/${jobId}/reschedule-request/withdraw`)
      .expect(200);

    expect((await clientJob(client, jobId)).rescheduleTerms!.cost).toBe(
      "free_late",
    );
    expect(testPayments().refunds).toEqual([]);
  });

  test("keeps the Deposit when the moved Job is cancelled later, early or not", async () => {
    const { client, office, jobId, deposit } = await bookedJob();
    testClock().set(SUNDAY_9AM);
    await ask(client, jobId, WEDNESDAY, "free_late").expect(201);
    await confirm(office, jobId).expect(200);
    testClock().set(new Date("2026-01-13T16:00:00Z"));
    await ask(
      client,
      jobId,
      { date: "2026-01-21", time: "10:00" },
      "late_cancellation",
    ).expect(201);
    await confirm(office, jobId).expect(200);

    // more than 24 hours before the 21st
    const { cancelTerms } = await clientJob(client, jobId);
    expect(cancelTerms).toMatchObject({
      late: false,
      feeCents: deposit,
      refundCents: 0,
    });
    await client
      .post(`/api/jobs/mine/${jobId}/cancel`)
      .send({ feeCents: deposit })
      .expect(200);
    expect(testPayments().refunds).toEqual([]);
    expect(testEmail().lastTo(casey.email).text).toContain(
      "already kept as the fee for a Late Reschedule",
    );
  });
});
