import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import type {
  CleanerJob,
  OfficeJob,
  ScheduleDay,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "#db";
import { jobs } from "#features/jobs/jobs.schema";
import { createStaff, setUsualWeek } from "#features/staff/staff";
import { api, signIn, testClock, testEmail } from "../../../tests/harness.ts";
import {
  acceptedJob,
  bookedJob as otherJob,
  casey,
  signInAsOffice,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York. The Job
// here is at 9am on Monday the 12th (14:00 UTC). Cory and Dee each work 8
// hours on weekdays, so a weekday has 16 hours of Cleaner time.
const STARTS_AT = "2026-01-12T14:00:00Z";
const WEDNESDAY = { date: "2026-01-14", time: "10:30" };
const WEDNESDAY_10_30AM = "2026-01-14T15:30:00.000Z";

const cleaner = async (name: string) => {
  const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
  const member = await createStaff({ name, email, roles: ["cleaner"] });
  await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
  return { ...member, email };
};

const confirmPlace = async (asCleaner: Agent, jobId: string) => {
  const mine = (await asCleaner.get(`/api/assignments/mine/${jobId}`))
    .body as CleanerJob;
  await asCleaner
    .post(`/api/assignments/${mine.assignment.id}/confirm`)
    .expect(200);
};

// Casey's Deep Clean at 9am on Monday the 12th, with Cory Confirmed on it
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
  return { office, asCory, jobId: job.id, job };
};

const move = (office: Agent, jobId: string, to: typeof WEDNESDAY) =>
  office.post(`/api/jobs/${jobId}/move`).send(to);

const scheduleDay = async (office: Agent, date: string) =>
  (
    (await office.get(`/api/schedule?from=${date}&to=${date}`).expect(200))
      .body as ScheduleDay[]
  )[0]!;

describe("Office Staff moving a Job", () => {
  test("moves it, Offers its places afresh, resets its reminder and tells the Client and the crew", async () => {
    const { office, asCory, jobId, job } = await bookedJob();
    await db
      .update(jobs)
      .set({ reminderSentAt: new Date("2026-01-11T13:00:00Z") })
      .where(eq(jobs.id, jobId));

    const seen = (await move(office, jobId, WEDNESDAY).expect(200))
      .body as OfficeJob;

    expect(seen.startsAt).toBe(WEDNESDAY_10_30AM);
    expect(seen.assignments).toEqual([
      expect.objectContaining({ status: "offered", answeredAt: null }),
    ]);
    expect(seen.assignment).toBe("unassigned");
    expect(seen.rescheduleRequest).toBeNull();
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    expect(row!.reminderSentAt).toBeNull();
    expect(row!.rescheduleFeeCents).toBe(0);

    const wednesday = await scheduleDay(office, "2026-01-14");
    expect(wednesday.bookedHours).toBe(job.labourHours);
    expect(wednesday.jobs.map((j) => j.id)).toEqual([jobId]);
    expect((await scheduleDay(office, "2026-01-12")).jobs).toEqual([]);

    const toCasey = testEmail().lastTo(casey.email);
    expect(toCasey.subject).toBe("Your clean has moved");
    expect(toCasey.text).toContain(
      "from Monday, January 12 at 9:00 AM to Wednesday, January 14 at 10:30 AM",
    );
    expect(toCasey.text).toContain("There's no charge for this.");
    const toCory = testEmail().lastTo("cory@example.com");
    expect(toCory.subject).toBe("A Job you're on has moved");
    expect(toCory.text).toContain(
      "has moved from Monday, January 12 at 9:00 AM to Wednesday, January 14 at 10:30 AM",
    );

    await confirmPlace(asCory, jobId);
    expect(
      ((await office.get(`/api/jobs/${jobId}`).expect(200)).body as OfficeJob)
        .assignment,
    ).toBe("assigned");
  });

  test("needs room on a new day, counting held hours, but always has room on its own day", async () => {
    const { office, jobId, job } = await bookedJob();
    // Wednesday has 16 hours; another Job books all but 1 hour of it
    await otherJob({
      startsAt: "2026-01-14T14:00:00Z",
      labourHours: 16 - 1,
    });

    const refused = await move(office, jobId, WEDNESDAY).expect(409);
    expect(refused.body.message).toBe(
      `That day doesn't have room: the Job needs ${job.labourHours} Labour Hours and 1 are free.`,
    );

    // Monday fills up under it from 2pm, yet it can still move within Monday
    await otherJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 16 });
    await move(office, jobId, { date: "2026-01-12", time: "08:00" }).expect(
      200,
    );
  });

  test("needs a crew free at the new time", async () => {
    const { office, jobId } = await bookedJob();
    // another Client's crew of 2 on Wednesday from 10:30 to 11:30
    await otherJob({ startsAt: WEDNESDAY_10_30AM, labourHours: 2 });

    const refused = await move(office, jobId, WEDNESDAY).expect(409);
    expect(refused.body.message).toBe(
      "Not enough Cleaners are free then: the Job needs 1, and 0 of the 2 available that day are.",
    );

    // once they've gone
    await move(office, jobId, { date: "2026-01-14", time: "11:30" }).expect(
      200,
    );
  });

  test("can't take hours held for a Reschedule Request", async () => {
    const { office, jobId, job } = await bookedJob();
    // another Client's Job asks to move onto Thursday, holding its hours
    const other = await otherJob({
      startsAt: "2026-01-13T14:00:00Z",
      labourHours: 16 - job.labourHours + 1,
    });
    await office
      .post(`/api/jobs/${other.id}/reschedule-request`)
      .send({ date: "2026-01-15", time: "09:00", cost: "free" })
      .expect(201);

    await move(office, jobId, { date: "2026-01-15", time: "13:00" }).expect(
      409,
    );
  });

  test("is refused once it has started, or isn't booked", async () => {
    const { office, jobId } = await bookedJob();
    testClock().set(new Date("2026-01-12T14:30:00Z"));
    expect(
      (await move(office, jobId, WEDNESDAY).expect(409)).body.message,
    ).toBe("This Job has already started, so it can't move");

    testClock().set(new Date("2026-01-05T09:00:00Z"));
    await office
      .post(`/api/jobs/${jobId}/cancel`)
      .send({ by: "empire", feeCents: 0, reason: "Our crew is unwell." })
      .expect(200);
    expect(
      (await move(office, jobId, WEDNESDAY).expect(409)).body.message,
    ).toBe("This Job is no longer booked, so it can't move");
  });

  test("is refused to a time that has passed, or the time it's at", async () => {
    const { office, jobId } = await bookedJob();

    await move(office, jobId, { date: "2026-01-05", time: "03:00" }).expect(
      409,
    );
    expect(
      (
        await move(office, jobId, { date: "2026-01-12", time: "09:00" }).expect(
          409,
        )
      ).body.message,
    ).toBe("That's when the Job is already booked");
    await move(office, jobId, { date: "2026-01-14", time: "25:00" }).expect(
      400,
    );
  });

  test("waits for a pending Reschedule Request to be answered", async () => {
    const { office, jobId } = await bookedJob();
    await office
      .post(`/api/jobs/${jobId}/reschedule-request`)
      .send({ date: "2026-01-15", time: "09:00", cost: "free" })
      .expect(201);

    expect(
      (await move(office, jobId, WEDNESDAY).expect(409)).body.message,
    ).toMatch(/Confirm or turn down their request first/);
  });

  test("is for Office Staff only", async () => {
    const { asCory, jobId } = await bookedJob();
    await move(asCory, jobId, WEDNESDAY).expect(403);
    await api().post(`/api/jobs/${jobId}/move`).send(WEDNESDAY).expect(401);
  });
});

describe("the Schedule", () => {
  test("shows each Job's crew, and whether it can still be moved", async () => {
    const { office, jobId } = await bookedJob();
    const done = await otherJob({
      startsAt: "2026-01-12T19:00:00Z",
      labourHours: 2,
    });

    const before = await scheduleDay(office, "2026-01-12");
    expect(before.jobs.find((j) => j.id === jobId)).toMatchObject({
      crew: [expect.objectContaining({ name: "Cory Cleaner" })],
      movable: true,
    });
    expect(before.jobs.find((j) => j.id === done.id)).toMatchObject({
      crew: [],
      movable: true,
    });

    testClock().set(new Date("2026-01-12T14:30:00Z"));
    const after = await scheduleDay(office, "2026-01-12");
    expect(after.jobs.map((j) => [j.id, j.movable])).toEqual([
      [jobId, false],
      [done.id, true],
    ]);
  });
});
