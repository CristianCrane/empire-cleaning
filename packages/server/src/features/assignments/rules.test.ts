import { describe, expect, test } from "vitest";
import type {
  ScheduleDay,
  ScheduledJob,
  ScheduledSiteVisit,
  StaffRole,
} from "@empire-cleaning/models";
import { isFree } from "../jobs/schedule.ts";
import {
  openingOf,
  placesOpen,
  whyNotConfirm,
  whyNotOffer,
  whyNotRelease,
  whyNotTakeOpenPlace,
} from "./rules.ts";

// The rules over plain data: no Staff, Clients or Jobs are saved. Monday 5
// January 2026, 4am New York; the Job is on Thursday the 8th, 9am to noon on
// site (6 Labour Hours, a crew of two).
const NOW = new Date("2026-01-05T09:00:00Z");
const THURSDAY_9AM = "2026-01-08T14:00:00.000Z";
const HOUR = 3_600_000;

const cleaners: StaffRole[] = ["cleaner"];
const ana = { id: "ana", name: "Ana Ruiz", active: true, roles: cleaners };
const bea = { id: "bea", name: "Bea Cruz", active: true, roles: cleaners };

const scheduled = (over: Partial<ScheduledJob> = {}): ScheduledJob => ({
  id: "job",
  startsAt: THURSDAY_9AM,
  serviceName: "Standard Clean",
  status: "booked",
  labourHours: 6,
  crewSize: 2,
  hoursOnSite: 3,
  client: { id: "client", name: "Casey Lee", businessName: null },
  property: {
    id: "home",
    street: "41 Austin St",
    unit: null,
    postcode: "11375",
  },
  assignment: "unassigned",
  crew: [],
  movable: true,
  ...over,
});

// another Job that day, `hours` after this one starts, with Ana on it
const otherJob = (hours: number, over: Partial<ScheduledJob> = {}) =>
  scheduled({
    id: "other",
    startsAt: new Date(Date.parse(THURSDAY_9AM) + hours * HOUR).toISOString(),
    crew: [{ id: "ana", name: "Ana Ruiz" }],
    ...over,
  });

const siteVisit = (
  hours: number,
  status: ScheduledSiteVisit["status"],
): ScheduledSiteVisit => ({
  id: "visit",
  quoteId: null,
  status,
  startsAt: new Date(Date.parse(THURSDAY_9AM) + hours * HOUR).toISOString(),
  minutes: 30,
  visitor: { id: "ana", name: "Ana Ruiz" },
  client: { id: "client", name: "Casey Lee", businessName: null },
  property: {
    id: "home",
    street: "41 Austin St",
    unit: null,
    postcode: "11375",
    kind: "residential",
  },
  bookedAt: NOW.toISOString(),
  doneAt: null,
  cancelledAt: null,
  takesRoom: true,
});

// Thursday, with Ana and Bea available, the Job on it, and anything else
const thursday = (over: Partial<ScheduleDay> = {}): ScheduleDay => {
  const { jobs = [], ...rest } = over;
  return {
    date: "2026-01-08",
    staffHours: 16,
    bookedHours: 6,
    heldHours: 0,
    freeHours: 10,
    available: [
      { id: "ana", name: "Ana Ruiz", hours: 8 },
      { id: "bea", name: "Bea Cruz", hours: 8 },
    ],
    held: [],
    siteVisits: [],
    ...rest,
    jobs: jobs.some((j) => j.id === "job") ? jobs : [scheduled(), ...jobs],
  };
};

// the Job's own row, as an action locks it
const job = (
  over: { status?: string; startsAt?: Date; crewSize?: number } = {},
) => ({
  id: "job",
  status: "booked",
  startsAt: new Date(THURSDAY_9AM),
  crewSize: 2,
  ...over,
});

const clean = {
  startsAt: new Date(THURSDAY_9AM),
  labourHours: 6,
  crewSize: 2,
  jobId: "job",
};

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

describe("Offering a place", () => {
  test("to a free active Cleaner while a place is open", () => {
    expect(whyNotOffer(thursday(), job(), ana, NOW)).toBeNull();
  });

  test("refused once the Job has started", () => {
    const started = new Date(Date.parse(THURSDAY_9AM));
    expect(whyNotOffer(thursday(), job(), ana, started)).toBe(
      "This Job has already started",
    );
  });

  test("refused to anyone but an active Cleaner", () => {
    expect(whyNotOffer(thursday(), job(), { ...ana, active: false }, NOW)).toBe(
      "Ana Ruiz isn't an active Cleaner",
    );
    const office = { ...ana, roles: ["office_staff" as const] };
    expect(whyNotOffer(thursday(), job(), office, NOW)).toBe(
      "Ana Ruiz isn't an active Cleaner",
    );
  });

  test("refused to someone on it already, and when every place is held", () => {
    const holding = (crew: ScheduledJob["crew"], crewSize = 2) =>
      thursday({ jobs: [scheduled({ crew, crewSize })] });
    const anaOn = [{ id: "ana", name: "Ana Ruiz" }];
    expect(whyNotOffer(holding(anaOn), job(), ana, NOW)).toBe(
      "Ana Ruiz already has a place on this Job",
    );
    expect(whyNotOffer(holding(anaOn, 1), job({ crewSize: 1 }), bea, NOW)).toBe(
      "This Job's place is taken",
    );
    const both = [...anaOn, { id: "cleo", name: "Cleo Diaz" }];
    expect(whyNotOffer(holding(both), job(), bea, NOW)).toBe(
      "All 2 places on this Job are taken",
    );
  });

  test("refused when they aren't free for it", () => {
    expect(
      whyNotOffer(thursday({ jobs: [otherJob(1)] }), job(), ana, NOW),
    ).toBe(
      "Ana Ruiz isn't free then: they're on another Job or a Site Visit at that time, or have no hours that day",
    );
  });
});

describe("Confirming an Offered place", () => {
  test("at the time they were shown, while free", () => {
    expect(
      whyNotConfirm(thursday(), job(), "ana", new Date(THURSDAY_9AM), NOW),
    ).toBeNull();
    expect(whyNotConfirm(thursday(), job(), "ana", undefined, NOW)).toBeNull();
  });

  test("refused once started, after a move, or when no longer free", () => {
    expect(
      whyNotConfirm(
        thursday(),
        job(),
        "ana",
        undefined,
        new Date(THURSDAY_9AM),
      ),
    ).toBe("This Job has already started");
    expect(
      whyNotConfirm(
        thursday(),
        job(),
        "ana",
        new Date(Date.parse(THURSDAY_9AM) - HOUR),
        NOW,
      ),
    ).toMatch(
      /^This Job has moved to .+\. Please check the new time, then confirm again\.$/,
    );
    expect(
      whyNotConfirm(
        thursday({ jobs: [otherJob(1)] }),
        job(),
        "ana",
        undefined,
        NOW,
      ),
    ).toBe(
      "You're no longer free for this Job. Please release it, or call the Office.",
    );
  });
});

describe("Releasing a place", () => {
  const before = (hours: number) =>
    new Date(Date.parse(THURSDAY_9AM) - hours * HOUR);

  test("an Offered one any time, a Confirmed one until 48 hours before", () => {
    expect(whyNotRelease("offered", job(), before(1))).toBeNull();
    expect(whyNotRelease("confirmed", job(), before(49))).toBeNull();
    expect(whyNotRelease("confirmed", job(), before(47))).toBe(
      "A Confirmed place can't be released within 48 hours of the Job. Please call the Office.",
    );
  });
});

describe("Open Places", () => {
  const DAY = 24 * HOUR;
  const startsAt = new Date(THURSDAY_9AM);

  test("are open from 7 days before a booked Job until it starts", () => {
    const at = (ms: number) => new Date(startsAt.getTime() - ms);
    expect(placesOpen(job(), at(7 * DAY))).toBe(true);
    expect(placesOpen(job(), at(7 * DAY + 1))).toBe(false);
    expect(placesOpen(job(), at(1))).toBe(true);
    expect(placesOpen(job(), startsAt)).toBe(false);
    expect(placesOpen(job({ status: "cancelled" }), NOW)).toBe(false);
  });

  test("are open to free Cleaners not on it, who didn't Release one or pass", () => {
    const day = thursday({
      available: [
        { id: "ana", name: "Ana Ruiz", hours: 8 },
        { id: "bea", name: "Bea Cruz", hours: 8 },
        { id: "cleo", name: "Cleo Diaz", hours: 8 },
        { id: "dana", name: "Dana Fox", hours: 8 },
        { id: "eve", name: "Eve Gray", hours: 8 },
      ],
      jobs: [otherJob(1, { crew: [{ id: "eve", name: "Eve Gray" }] })],
    });
    const opening = openingOf(
      day,
      scheduled(),
      [
        { staffId: "ana", status: "offered" },
        { staffId: "bea", status: "released" },
      ],
      ["cleo"],
    );
    expect(opening).toEqual({ open: 1, openTo: ["dana"] });
  });

  test("are gone once every place is held", () => {
    const places = [
      { staffId: "ana", status: "confirmed" as const },
      { staffId: "bea", status: "offered" as const },
    ];
    expect(openingOf(thursday(), scheduled(), places, [])).toBeNull();
  });

  describe("taking one", () => {
    const opening = (
      openTo: string[],
      places: {
        staffId: string;
        status: "offered" | "confirmed" | "released";
      }[] = [],
    ) => ({ openTo, places });

    test("while it's open to them", () => {
      expect(
        whyNotTakeOpenPlace(job(), "ana", opening(["ana"]), undefined, NOW),
      ).toBeNull();
    });

    test("refused when the Job isn't booked, has started or has moved", () => {
      const open = opening(["ana"]);
      expect(
        whyNotTakeOpenPlace(
          job({ status: "cancelled" }),
          "ana",
          open,
          undefined,
          NOW,
        ),
      ).toBe("This Job isn't open any more");
      expect(whyNotTakeOpenPlace(job(), "ana", open, undefined, startsAt)).toBe(
        "This Job isn't open any more",
      );
      expect(
        whyNotTakeOpenPlace(
          job(),
          "ana",
          open,
          new Date(startsAt.getTime() + HOUR),
          NOW,
        ),
      ).toMatch(/^This Job has moved to /);
    });

    test("refused when it has no Open Place: not open yet, or taken", () => {
      const early = new Date(startsAt.getTime() - 8 * DAY);
      expect(
        whyNotTakeOpenPlace(job(), "ana", undefined, undefined, early),
      ).toBe("This Job isn't open to Cleaners yet");
      expect(whyNotTakeOpenPlace(job(), "ana", undefined, undefined, NOW)).toBe(
        "Someone else took this Job",
      );
    });

    test("refused, saying why, when it isn't open to them", () => {
      const refused = (status?: "offered" | "released") =>
        whyNotTakeOpenPlace(
          job(),
          "ana",
          opening(["bea"], status ? [{ staffId: "ana", status }] : []),
          undefined,
          NOW,
        );
      expect(refused("released")).toBe("You released your place on this Job");
      expect(refused("offered")).toBe("You already have a place on this Job");
      expect(refused()).toBe("You're no longer free for this Job");
    });
  });
});
