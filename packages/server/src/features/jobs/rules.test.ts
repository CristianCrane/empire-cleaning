import { describe, expect, test } from "vitest";
import type { ScheduledSiteVisit } from "@empire-cleaning/models";
import { whyNoRoom, messages } from "@empire-cleaning/models";
import {
  afterNine,
  clean,
  NOW,
  otherJob,
  scheduled,
  siteVisit,
  thursday,
} from "../../../tests/schedule-days.ts";
import {
  busyWith,
  endsByMidnight,
  isFree,
  roomOn,
  withoutReplaced,
} from "./rules.ts";

const { ENDS_BY_MIDNIGHT } = messages.en;

// The Schedule's rules over plain data (tests/schedule-days.ts): the Job is
// 9am to noon on Thursday with a crew of two, and the day has Ana and Bea,
// 16 hours, 10 of them free. schedule.test.ts checks the same through the
// API, over saved Staff and Jobs.

// a new clean on Thursday, some hours after 9am
const newClean = (hours: number, labourHours: number, crewSize: number) => ({
  startsAt: afterNine(hours),
  labourHours,
  crewSize,
});

describe("free for a Job (ADR-0019)", () => {
  test("only with Available Hours that day", () => {
    expect(isFree(thursday(), "ana", clean)).toBe(true);
    expect(isFree(thursday(), "cleo", clean)).toBe(false);
  });

  test("not while on another booked Job, though one that ends as it starts is fine", () => {
    expect(isFree(thursday({ jobs: [otherJob(2)] }), "ana", clean)).toBe(false);
    expect(isFree(thursday({ jobs: [otherJob(3)] }), "ana", clean)).toBe(true);
    expect(isFree(thursday({ jobs: [otherJob(-3)] }), "ana", clean)).toBe(true);
    expect(isFree(thursday({ jobs: [otherJob(2)] }), "bea", clean)).toBe(true);
  });

  test("a Job that isn't booked any more doesn't count", () => {
    const done = otherJob(2, { status: "completed" });
    expect(isFree(thursday({ jobs: [done] }), "ana", clean)).toBe(true);
  });

  test("the Job itself doesn't count, so a moved Job's crew can be checked", () => {
    const own = scheduled({ crew: [{ id: "ana", name: "Ana Ruiz" }] });
    expect(isFree(thursday({ jobs: [own] }), "ana", clean)).toBe(true);
  });

  test("not during a booked Site Visit of theirs; a Done one doesn't count", () => {
    const visiting = (status: ScheduledSiteVisit["status"]) =>
      thursday({ siteVisits: [siteVisit(1, status)] });
    expect(isFree(visiting("booked"), "ana", clean)).toBe(false);
    expect(isFree(visiting("done"), "ana", clean)).toBe(true);
  });
});

describe("what a Staff member is busy with (busyWith)", () => {
  // Ana at a Site Visit at 10am, and on another Job at 11am
  const visit = siteVisit(1, "booked");
  const job = otherJob(2);

  test("a Site Visit of theirs before a Job they're on, else the Job", () => {
    const both = thursday({ jobs: [job], siteVisits: [visit] });
    expect(busyWith(both, "ana", clean)).toEqual({
      what: "site_visit",
      startsAt: visit.startsAt,
    });
    expect(busyWith(thursday({ jobs: [job] }), "ana", clean)).toEqual({
      what: "job",
      startsAt: job.startsAt,
    });
    expect(busyWith(both, "bea", clean)).toBeNull();
  });

  test("not a Done Site Visit, even one recorded Done before its time", () => {
    const done = {
      ...visit,
      status: "done" as const,
      doneAt: NOW.toISOString(),
    };
    expect(busyWith(thursday({ siteVisits: [done] }), "ana", clean)).toBeNull();
  });

  test("a Site Visit being moved isn't counted against itself", () => {
    const moving = { ...newClean(1, 0.5, 1), siteVisitId: visit.id };
    expect(
      busyWith(thursday({ siteVisits: [visit] }), "ana", moving),
    ).toBeNull();
  });
});

describe("room for a clean (roomOn)", () => {
  test("is there when the free hours cover it and a crew is free all through it", () => {
    const room = roomOn(thursday(), newClean(3, 6, 2));
    expect(room).toMatchObject({
      hasHours: true,
      cleaners: 2,
      crewsBusy: 0,
      hasCrew: true,
      endsByMidnight: true,
      hasRoom: true,
    });
  });

  test("needs the day's free hours to cover its Labour Hours", () => {
    const room = roomOn(thursday(), newClean(3, 11, 2));
    expect(room).toMatchObject({ hasHours: false, hasRoom: false });
    expect(whyNoRoom(room)).toBe(
      "That day is too full for this job. Pick another time, or give a cleaner more working hours that day.",
    );
  });

  test("needs a crew free while it's on site, counting the Jobs at work then", () => {
    const room = roomOn(thursday(), newClean(1, 1, 1));
    expect(room).toMatchObject({
      crewsBusy: 2,
      hasCrew: false,
      hasRoom: false,
    });
    expect(whyNoRoom(room)).toBe(
      "Not enough cleaners are free then. Pick another time, or give a cleaner more working hours that day.",
    );
  });

  test("counts held new times and Site Visits that take room as crews at work", () => {
    const held = {
      jobId: "moving",
      startsAt: afterNine(3).toISOString(),
      labourHours: 2,
      crewSize: 2,
    };
    expect(roomOn(thursday({ held: [held] }), newClean(3, 1, 1)).hasCrew).toBe(
      false,
    );
    const visiting = thursday({ siteVisits: [siteVisit(3, "booked")] });
    expect(roomOn(visiting, newClean(3, 2, 2)).crewsBusy).toBe(1);
  });

  test("doesn't count a Job being moved against itself", () => {
    const room = roomOn(thursday(), clean);
    expect(room).toMatchObject({ hasHours: true, crewsBusy: 0, hasRoom: true });
  });

  test("must end by midnight", () => {
    const late = newClean(13, 6, 2);
    expect(endsByMidnight(late.startsAt, 3)).toBe(false);
    expect(endsByMidnight(afterNine(12), 3)).toBe(true);
    const room = roomOn(thursday(), late);
    expect(room).toMatchObject({ endsByMidnight: false, hasRoom: false });
    expect(whyNoRoom(room)).toBe(ENDS_BY_MIDNIGHT);
  });
});

describe("a day without the Jobs a clean replaces (withoutReplaced)", () => {
  test("drops them and frees their hours", () => {
    const day = thursday({ jobs: [otherJob(4, { labourHours: 4 })] });
    const without = withoutReplaced(day, ["other"]);
    expect(without.jobs.map((j) => j.id)).toEqual(["job"]);
    expect(without.freeHours).toBe(14);
  });

  test("drops the times held for moving them, freeing a held time's hours only when it came from another day", () => {
    const held = (jobId: string) => ({
      jobId,
      startsAt: afterNine(4).toISOString(),
      labourHours: 2,
      crewSize: 1,
    });
    // "other" moves within Thursday: its hours are booked here already
    const day = thursday({
      jobs: [otherJob(6, { labourHours: 4 })],
      held: [held("other"), held("elsewhere")],
    });
    const without = withoutReplaced(day, ["other", "elsewhere"]);
    expect(without.held).toEqual([]);
    expect(without.freeHours).toBe(16);
  });

  test("leaves the day as it is when nothing is replaced", () => {
    const day = thursday({ jobs: [otherJob(4)] });
    expect(withoutReplaced(day, [])).toEqual(day);
  });
});
