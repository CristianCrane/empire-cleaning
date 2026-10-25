import { describe, expect, test } from "vitest";
import type { DayCapacity, ScheduleDay } from "@empire-cleaning/models";
import { createStaff } from "#features/staff";
import { api, signIn } from "../../../tests/harness.ts";
import { bookedJob, signInAsOffice } from "../../../tests/fixtures.ts";

type Office = Awaited<ReturnType<typeof signInAsOffice>>;

// the week of Monday 5 January 2026, the test clock's week

const staffMember = async (
  office: Office,
  name: string,
  roles: ("cleaner" | "office_staff")[],
  usualWeek: number[],
) => {
  const member = await createStaff({
    name,
    email: `${name.split(" ")[0]!.toLowerCase()}@example.com`,
    roles,
  });
  await office
    .put(`/api/staff/${member.id}/usual-week`)
    .send({ usualWeek })
    .expect(200);
  return member;
};

const schedule = async (office: Office, from: string, to: string) =>
  (await office.get(`/api/schedule?from=${from}&to=${to}`).expect(200))
    .body as ScheduleDay[];

const capacity = async (office: Office, date: string, labourHours: number) =>
  (
    await office
      .get(`/api/schedule/capacity?date=${date}&labourHours=${labourHours}`)
      .expect(200)
  ).body as DayCapacity;

describe("the Schedule", () => {
  test("is only for Office Staff", async () => {
    await api().get("/api/schedule?from=2026-01-05&to=2026-01-11").expect(401);
    await createStaff({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
    });
    const cleaner = await signIn("cory@example.com");
    await cleaner
      .get("/api/schedule?from=2026-01-05&to=2026-01-11")
      .expect(403);
    await cleaner
      .get("/api/schedule/capacity?date=2026-01-05&labourHours=2")
      .expect(403);
  });

  test("shows every day of the range, with its booked Jobs earliest first", async () => {
    const office = await signInAsOffice();
    const later = await bookedJob({
      startsAt: "2026-01-06T19:00:00Z", // 2pm in New York
      labourHours: 3,
      crewSize: 2,
      cleanType: "standard",
    });
    const earlier = await bookedJob({
      startsAt: "2026-01-06T14:00:00Z", // 9am
      labourHours: 5,
    });

    const days = await schedule(office, "2026-01-05", "2026-01-07");

    expect(days.map((d) => d.date)).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
    ]);
    expect(days[0]!.jobs).toEqual([]);
    expect(days[1]!.jobs.map((j) => j.id)).toEqual([earlier.id, later.id]);
    expect(days[1]!.jobs[1]).toMatchObject({
      startsAt: "2026-01-06T19:00:00.000Z",
      cleanType: "standard",
      status: "booked",
      labourHours: 3,
      crewSize: 2,
      hoursOnSite: 1.5,
      client: { name: expect.any(String) },
      property: { street: expect.stringContaining("Austin St") },
    });
  });

  test("puts a Job on its day in New York, not in UTC", async () => {
    const office = await signInAsOffice();
    // 9pm on the 6th in New York is 2am on the 7th in UTC
    await bookedJob({ startsAt: "2026-01-07T02:00:00Z", labourHours: 2 });

    const days = await schedule(office, "2026-01-06", "2026-01-07");

    expect(days.map((d) => d.jobs.length)).toEqual([1, 0]);
  });

  test("counts each Cleaner's usual hours for the weekday, and only Cleaners'", async () => {
    const office = await signInAsOffice();
    await staffMember(
      office,
      "Cory Cleaner",
      ["cleaner"],
      [8, 8, 8, 8, 6, 0, 0],
    );
    await staffMember(
      office,
      "Ana Both",
      ["cleaner", "office_staff"],
      [4, 0, 4, 0, 4, 0, 0],
    );
    // Office Staff who don't clean add nothing
    await staffMember(
      office,
      "Otto Office",
      ["office_staff"],
      [8, 8, 8, 8, 8, 0, 0],
    );

    const days = await schedule(office, "2026-01-05", "2026-01-11");

    expect(days.map((d) => d.staffHours)).toEqual([12, 8, 12, 8, 10, 0, 0]);
    expect(days[0]!.available).toEqual([
      { id: expect.any(String), name: "Ana Both", hours: 4 },
      { id: expect.any(String), name: "Cory Cleaner", hours: 8 },
    ]);
  });

  test("uses a day's exception in place of the usual hours", async () => {
    const office = await signInAsOffice();
    const cory = await staffMember(
      office,
      "Cory Cleaner",
      ["cleaner"],
      [8, 8, 8, 8, 8, 0, 0],
    );
    await office
      .put(`/api/staff/${cory.id}/exceptions/2026-01-06`)
      .send({ hours: 0, note: "Dentist" });
    await office
      .put(`/api/staff/${cory.id}/exceptions/2026-01-10`)
      .send({ hours: 5 });

    const days = await schedule(office, "2026-01-05", "2026-01-11");

    expect(days.map((d) => d.staffHours)).toEqual([8, 0, 8, 8, 8, 5, 0]);
  });

  test("leaves out deactivated Staff", async () => {
    const office = await signInAsOffice();
    const cory = await staffMember(
      office,
      "Cory Cleaner",
      ["cleaner"],
      [8, 8, 8, 8, 8, 0, 0],
    );
    await office.post(`/api/staff/${cory.id}/deactivate`).expect(200);

    const [monday] = await schedule(office, "2026-01-05", "2026-01-05");

    expect(monday).toMatchObject({ staffHours: 0, available: [] });
  });

  test("takes booked Labour Hours from the day's Staff hours", async () => {
    const office = await signInAsOffice();
    await staffMember(
      office,
      "Cory Cleaner",
      ["cleaner"],
      [8, 8, 0, 0, 0, 0, 0],
    );
    await staffMember(
      office,
      "Dee Cleaner",
      ["cleaner"],
      [8, 0, 0, 0, 0, 0, 0],
    );
    await bookedJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 6.25 });
    await bookedJob({ startsAt: "2026-01-05T18:00:00Z", labourHours: 3.5 });
    await bookedJob({ startsAt: "2026-01-06T14:00:00Z", labourHours: 9 });

    const [monday, tuesday] = await schedule(
      office,
      "2026-01-05",
      "2026-01-06",
    );

    expect(monday).toMatchObject({
      staffHours: 16,
      bookedHours: 9.75,
      freeHours: 6.25,
    });
    // overbooked days show it
    expect(tuesday).toMatchObject({
      staffHours: 8,
      bookedHours: 9,
      freeHours: -1,
    });
  });

  test("takes a range of up to 62 days, in order", async () => {
    const office = await signInAsOffice();

    expect(await schedule(office, "2026-01-01", "2026-03-03")).toHaveLength(62);
    const tooLong = await office
      .get("/api/schedule?from=2026-01-01&to=2026-03-04")
      .expect(400);
    expect(tooLong.body.details[0]).toMatchObject({
      path: "to",
      issue: "Choose at most 62 days",
    });
    await office.get("/api/schedule?from=2026-01-07&to=2026-01-06").expect(400);
    await office.get("/api/schedule?from=2026-01-07").expect(400);
    await office.get("/api/schedule?from=yesterday&to=2026-01-06").expect(400);
  });
});

describe("whether a day has room for a booking", () => {
  test("is yes when free Staff hours cover the Labour Hours, exactly or more", async () => {
    const office = await signInAsOffice();
    await staffMember(
      office,
      "Cory Cleaner",
      ["cleaner"],
      [8, 0, 0, 0, 0, 0, 0],
    );
    await bookedJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 3.75 });

    expect(await capacity(office, "2026-01-05", 4.25)).toEqual({
      date: "2026-01-05",
      labourHours: 4.25,
      staffHours: 8,
      bookedHours: 3.75,
      freeHours: 4.25,
      hasRoom: true,
    });
    expect((await capacity(office, "2026-01-05", 4.5)).hasRoom).toBe(false);
  });

  test("is no on a day nobody is available", async () => {
    const office = await signInAsOffice();

    expect(await capacity(office, "2026-01-10", 1)).toMatchObject({
      staffHours: 0,
      hasRoom: false,
    });
  });

  test("needs a date and some Labour Hours", async () => {
    const office = await signInAsOffice();

    await office.get("/api/schedule/capacity?date=2026-01-05").expect(400);
    await office
      .get("/api/schedule/capacity?date=2026-01-05&labourHours=0")
      .expect(400);
    await office
      .get("/api/schedule/capacity?date=soon&labourHours=2")
      .expect(400);
  });
});
