import { describe, expect, test } from "vitest";
import type { ScheduledJob, StaffRole } from "@empire-cleaning/models";
import {
  HOUR,
  NOW,
  THURSDAY_9AM,
  otherJob,
  scheduled,
  thursday,
} from "../../../tests/schedule-days.ts";
import {
  openingOf,
  neededOpen,
  whyNotConfirm,
  whyNotOffer,
  whyNotRelease,
  whyNotTakeCleanerNeeded,
} from "./rules.ts";

// The rules over plain data (tests/schedule-days.ts): no Staff, Clients or
// Jobs are saved.

const cleaners: StaffRole[] = ["cleaner"];
const ana = { id: "ana", name: "Ana Ruiz", active: true, roles: cleaners };
const bea = { id: "bea", name: "Bea Cruz", active: true, roles: cleaners };

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

describe("Offering a Job", () => {
  test("to a free active Cleaner while it needs a Cleaner", () => {
    expect(whyNotOffer(thursday(), "job", ana, NOW)).toBeNull();
  });

  test("refused once the Job has started", () => {
    const started = new Date(Date.parse(THURSDAY_9AM));
    expect(whyNotOffer(thursday(), "job", ana, started)).toBe(
      "This Job has already started",
    );
  });

  test("refused to anyone but an active Cleaner", () => {
    expect(whyNotOffer(thursday(), "job", { ...ana, active: false }, NOW)).toBe(
      "Ana Ruiz isn't an active Cleaner",
    );
    const office = { ...ana, roles: ["office_staff" as const] };
    expect(whyNotOffer(thursday(), "job", office, NOW)).toBe(
      "Ana Ruiz isn't an active Cleaner",
    );
  });

  test("refused to someone on it already, and when its crew is whole", () => {
    const holding = (crew: ScheduledJob["crew"], crewSize = 2) =>
      thursday({ jobs: [scheduled({ crew, crewSize })] });
    const anaOn = [{ id: "ana", name: "Ana Ruiz" }];
    expect(whyNotOffer(holding(anaOn), "job", ana, NOW)).toBe(
      "Ana Ruiz is already on this Job",
    );
    expect(whyNotOffer(holding(anaOn, 1), "job", bea, NOW)).toBe(
      "This Job already has its Cleaner",
    );
    const both = [...anaOn, { id: "cleo", name: "Cleo Diaz" }];
    expect(whyNotOffer(holding(both), "job", bea, NOW)).toBe(
      "This Job already has all 2 Cleaners it needs",
    );
  });

  test("refused when they aren't free for it", () => {
    expect(
      whyNotOffer(thursday({ jobs: [otherJob(1)] }), "job", ana, NOW),
    ).toBe(
      "Ana Ruiz isn't free then: they're on another Job or a Site Visit at that time, or have no hours that day",
    );
  });
});

describe("Confirming an Offered Job", () => {
  test("at the time they were shown, while free", () => {
    expect(
      whyNotConfirm(thursday(), "job", "ana", new Date(THURSDAY_9AM), NOW),
    ).toBeNull();
    expect(whyNotConfirm(thursday(), "job", "ana", undefined, NOW)).toBeNull();
  });

  test("refused once started, after a move, or when no longer free", () => {
    expect(
      whyNotConfirm(
        thursday(),
        "job",
        "ana",
        undefined,
        new Date(THURSDAY_9AM),
      ),
    ).toBe("This Job has already started");
    expect(
      whyNotConfirm(
        thursday(),
        "job",
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
        "job",
        "ana",
        undefined,
        NOW,
      ),
    ).toBe(
      "You're no longer free for this Job. Please release it, or call the Office.",
    );
  });
});

describe("Releasing an Assignment", () => {
  const before = (hours: number) =>
    new Date(Date.parse(THURSDAY_9AM) - hours * HOUR);

  test("an Offered one any time, a Confirmed one until 48 hours before", () => {
    expect(whyNotRelease("offered", job(), before(1))).toBeNull();
    expect(whyNotRelease("confirmed", job(), before(49))).toBeNull();
    expect(whyNotRelease("confirmed", job(), before(47))).toBe(
      "A Confirmed Job can't be released within 48 hours of it. Please call the Office.",
    );
  });
});

describe("Cleaners Needed", () => {
  const DAY = 24 * HOUR;
  const startsAt = new Date(THURSDAY_9AM);

  test("are open from 7 days before a booked Job until it starts", () => {
    const at = (ms: number) => new Date(startsAt.getTime() - ms);
    expect(neededOpen(job(), at(7 * DAY))).toBe(true);
    expect(neededOpen(job(), at(7 * DAY + 1))).toBe(false);
    expect(neededOpen(job(), at(1))).toBe(true);
    expect(neededOpen(job(), startsAt)).toBe(false);
    expect(neededOpen(job({ status: "cancelled" }), NOW)).toBe(false);
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

  test("are gone once its crew is whole", () => {
    const assigned = [
      { staffId: "ana", status: "confirmed" as const },
      { staffId: "bea", status: "offered" as const },
    ];
    expect(openingOf(thursday(), scheduled(), assigned, [])).toBeNull();
  });

  describe("taking one", () => {
    const opening = (
      openTo: string[],
      assigned: {
        staffId: string;
        status: "offered" | "confirmed" | "released";
      }[] = [],
    ) => ({ openTo, assigned });

    test("while it's open to them", () => {
      expect(
        whyNotTakeCleanerNeeded(job(), "ana", opening(["ana"]), undefined, NOW),
      ).toBeNull();
    });

    test("refused when the Job isn't booked, has started or has moved", () => {
      const open = opening(["ana"]);
      expect(
        whyNotTakeCleanerNeeded(
          job({ status: "cancelled" }),
          "ana",
          open,
          undefined,
          NOW,
        ),
      ).toBe("This Job isn't open any more");
      expect(
        whyNotTakeCleanerNeeded(job(), "ana", open, undefined, startsAt),
      ).toBe("This Job isn't open any more");
      expect(
        whyNotTakeCleanerNeeded(
          job(),
          "ana",
          open,
          new Date(startsAt.getTime() + HOUR),
          NOW,
        ),
      ).toMatch(/^This Job has moved to /);
    });

    test("refused when it needs no Cleaner: not open yet, or taken", () => {
      const early = new Date(startsAt.getTime() - 8 * DAY);
      expect(
        whyNotTakeCleanerNeeded(job(), "ana", undefined, undefined, early),
      ).toBe("This Job isn't open to Cleaners yet");
      expect(
        whyNotTakeCleanerNeeded(job(), "ana", undefined, undefined, NOW),
      ).toBe("Someone else took this Job");
    });

    test("refused, saying why, when it isn't open to them", () => {
      const refused = (status?: "offered" | "released") =>
        whyNotTakeCleanerNeeded(
          job(),
          "ana",
          opening(["bea"], status ? [{ staffId: "ana", status }] : []),
          undefined,
          NOW,
        );
      expect(refused("released")).toBe("You released this Job");
      expect(refused("offered")).toBe("You're already on this Job");
      expect(refused()).toBe("You're no longer free for this Job");
    });
  });
});
