import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type { JobList } from "@empire-cleaning/models";
import { db } from "#db";
import { jobs } from "#features/jobs";
import { api, testClock } from "../../../tests/harness.ts";
import { bookedJob, signInAsOffice } from "../../../tests/fixtures.ts";

// four Jobs for four Clients: two booked, one Completed, one Cancelled
const fourJobs = async () => {
  testClock().set(new Date("2026-03-02T12:00:00Z"));
  const at = (day: number) =>
    `2026-03-${String(day).padStart(2, "0")}T14:00:00Z`;
  const later = await bookedJob({ startsAt: at(20), labourHours: 2 });
  const soon = await bookedJob({ startsAt: at(10), labourHours: 2 });
  const done = await bookedJob({ startsAt: at(5), labourHours: 2 });
  const cancelled = await bookedJob({ startsAt: at(6), labourHours: 2 });
  await db
    .update(jobs)
    .set({ status: "completed" })
    .where(eq(jobs.id, done.id));
  await db
    .update(jobs)
    .set({ status: "cancelled" })
    .where(eq(jobs.id, cancelled.id));
  return { later, soon, done, cancelled };
};

type Office = Awaited<ReturnType<typeof signInAsOffice>>;

const listed = async (office: Office, query = "") =>
  (await office.get(`/api/jobs${query}`).expect(200)).body as JobList;

describe("the Office's Jobs", () => {
  test("are only for Office Staff", async () => {
    await api().get("/api/jobs").expect(401);
  });

  test("open under any Tab newest first, with how many are under each", async () => {
    const { later, soon, done, cancelled } = await fourJobs();
    const office = await signInAsOffice();
    const all = await listed(office);

    expect(all.jobs.map((j) => j.id)).toEqual([
      later.id,
      soon.id,
      cancelled.id,
      done.id,
    ]);
    expect(all.counts).toEqual({ upcoming: 2, past: 1, cancelled: 1, all: 4 });
  });

  test("hold Upcoming soonest first, and Past and Cancelled apart", async () => {
    const { later, soon, done, cancelled } = await fourJobs();
    const office = await signInAsOffice();

    expect(
      (await listed(office, "?tab=upcoming")).jobs.map((j) => j.id),
    ).toEqual([soon.id, later.id]);
    expect((await listed(office, "?tab=past")).jobs.map((j) => j.id)).toEqual([
      done.id,
    ]);
    expect(
      (await listed(office, "?tab=cancelled")).jobs.map((j) => j.id),
    ).toEqual([cancelled.id]);
  });

  test("are searched by the Client or the address, counting what matches", async () => {
    const { soon } = await fourJobs();
    const office = await signInAsOffice();
    // its own street, as the list shows it
    const { property, client } = (await listed(office)).jobs.find(
      (j) => j.id === soon.id,
    )!;
    const byStreet = await listed(
      office,
      `?q=${encodeURIComponent(property.street.toLowerCase())}`,
    );

    expect(byStreet.jobs.map((j) => j.id)).toEqual([soon.id]);
    expect(byStreet.counts).toEqual({
      upcoming: 1,
      past: 0,
      cancelled: 0,
      all: 1,
    });
    const byName = await listed(
      office,
      `?q=${encodeURIComponent(client.name)}`,
    );
    expect(byName.jobs.map((j) => j.id)).toEqual([soon.id]);
  });

  test("hold the first 50 unless more are asked for", async () => {
    testClock().set(new Date("2026-03-02T12:00:00Z"));
    for (let i = 0; i < 52; i += 1) {
      // an hour a Job, eight a day, on weekdays from Mon, Mar 9
      const day = 9 + Math.floor(i / 8) + 2 * Math.floor(i / 40);
      const hour = 13 + (i % 8);
      await bookedJob({
        startsAt: `2026-03-${String(day).padStart(2, "0")}T${hour}:00:00Z`,
        labourHours: 1,
        crewSize: 1,
      });
    }

    const office = await signInAsOffice();
    const first = await listed(office);
    expect(first.jobs).toHaveLength(50);
    expect(first.counts.all).toBe(52);
    expect((await listed(office, "?limit=100")).jobs).toHaveLength(52);
  });

  test("refuse a Tab or a limit that isn't one", async () => {
    const office = await signInAsOffice();
    await office.get("/api/jobs?tab=gone").expect(400);
    await office.get("/api/jobs?limit=0").expect(400);
  });
});
