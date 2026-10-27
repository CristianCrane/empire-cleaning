import { describe, expect, test } from "vitest";
import type { NeedsAttentionItem, Today } from "@empire-cleaning/models";
import { createStaff } from "#features/staff";
import { api, signIn, testClock } from "../../../tests/harness.ts";
import {
  bookedJob,
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Office = Awaited<ReturnType<typeof signInAsOffice>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York

const needsAttention = async (office: Office) =>
  (await office.get("/api/dashboard/needs-attention").expect(200))
    .body as NeedsAttentionItem[];

const today = async (office: Office) =>
  (await office.get("/api/dashboard/today").expect(200)).body as Today;

describe("the dashboard", () => {
  test("is only for Office Staff", async () => {
    await api().get("/api/dashboard/needs-attention").expect(401);
    await api().get("/api/dashboard/today").expect(401);
    await createStaff({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
    });
    const cleaner = await signIn("cory@example.com");
    await cleaner.get("/api/dashboard/needs-attention").expect(403);
    await cleaner.get("/api/dashboard/today").expect(403);
  });
});

describe("Needs attention", () => {
  test("is empty when nothing is waiting", async () => {
    const office = await signInAsOffice();

    expect(await needsAttention(office)).toEqual([]);
  });

  test("lists Quotes asked for with nothing Sent yet, longest waiting first", async () => {
    await submit(guestAsk()).expect(201);
    await submit(
      guestAsk({
        contact: { ...casey, name: "Drew Client", email: "drew@example.com" },
        property: { new: { ...home, street: "7 Queens Blvd" } },
      }),
    ).expect(201);
    const office = await signInAsOffice();

    const items = (await needsAttention(office)).filter(
      (i) => i.kind === "quote_requested",
    );

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.quote.client.name)).toEqual([
      "Casey Client",
      "Drew Client",
    ]);
    expect(items[0]).toMatchObject({
      since: items[0]!.quote.createdAt,
      quote: {
        status: "requested",
        asked: { condition: "moderate", wantsRegularService: true },
        property: { street: home.street, postcode: home.postcode },
      },
    });
  });
});

describe("Today", () => {
  test("is the day's Schedule per the Clock, in New York", async () => {
    const office = await signInAsOffice();
    await bookedJob({ startsAt: "2026-01-05T19:00:00Z", labourHours: 3 });
    const morning = await bookedJob({
      startsAt: "2026-01-05T14:00:00Z",
      labourHours: 5,
    });
    await bookedJob({ startsAt: "2026-01-06T14:00:00Z", labourHours: 4 });
    // 10pm on the 5th in New York, though the 6th in UTC
    testClock().set(new Date("2026-01-06T03:00:00Z"));

    const day = await today(office);

    expect(day.date).toBe("2026-01-05");
    expect(day.bookedHours).toBe(8);
    expect(day.jobs).toHaveLength(2);
    expect(day.jobs[0]).toMatchObject({
      id: morning.id,
      startsAt: "2026-01-05T14:00:00.000Z",
      labourHours: 5,
      client: { name: expect.any(String) },
      property: { street: expect.stringContaining("Austin St") },
    });
  });

  test("moves on with the Clock", async () => {
    const office = await signInAsOffice();
    const tomorrows = await bookedJob({
      startsAt: "2026-01-06T14:00:00Z",
      labourHours: 4,
    });

    expect((await today(office)).jobs).toEqual([]);
    testClock().advance({ days: 1 });
    expect((await today(office)).jobs.map((j) => j.id)).toEqual([tomorrows.id]);
  });

  test("gives each Job's Assignment status and outcome", async () => {
    const office = await signInAsOffice();
    await bookedJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 5 });

    const [job] = (await today(office)).jobs;

    // nobody has Confirmed a place, and nothing completes Jobs (#10) yet
    expect(job).toMatchObject({ assignment: "unassigned", outcome: null });
  });
});
