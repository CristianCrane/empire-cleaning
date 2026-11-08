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
      "This clean has already started, so you can't offer it to anyone.",
    );
  });

  test("refused to anyone but an active Cleaner", () => {
    expect(whyNotOffer(thursday(), "job", { ...ana, active: false }, NOW)).toBe(
      "Ana Ruiz can't take jobs. Pick an active cleaner.",
    );
    const office = { ...ana, roles: ["office_staff" as const] };
    expect(whyNotOffer(thursday(), "job", office, NOW)).toBe(
      "Ana Ruiz can't take jobs. Pick an active cleaner.",
    );
  });

  test("refused to someone on it already, and when its crew is whole", () => {
    const holding = (crew: ScheduledJob["crew"], crewSize = 2) =>
      thursday({ jobs: [scheduled({ crew, crewSize })] });
    const anaOn = [{ id: "ana", name: "Ana Ruiz" }];
    expect(whyNotOffer(holding(anaOn), "job", ana, NOW)).toBe(
      "Ana Ruiz is already on this job.",
    );
    expect(whyNotOffer(holding(anaOn, 1), "job", bea, NOW)).toBe(
      "This job already has all the cleaners it needs.",
    );
    const both = [...anaOn, { id: "cleo", name: "Cleo Diaz" }];
    expect(whyNotOffer(holding(both), "job", bea, NOW)).toBe(
      "This job already has all the cleaners it needs.",
    );
  });

  test("refused when they aren't free for it", () => {
    expect(
      whyNotOffer(thursday({ jobs: [otherJob(1)] }), "job", ana, NOW),
    ).toBe("Ana Ruiz isn't free then. Pick someone else.");
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
    ).toBe("This clean has already started, so you can't confirm it.");
    expect(
      whyNotConfirm(
        thursday(),
        "job",
        "ana",
        new Date(Date.parse(THURSDAY_9AM) - HOUR),
        NOW,
      ),
    ).toMatch(
      /^This job moved to .+\. Check the new time, then confirm again\.$/,
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
      "You're not free for this job any more. Drop out of it, or call the office.",
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
      "It's less than 48 hours until this job, so you can't drop out here. Please call the office.",
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
      ).toBe("This job isn't available any more.");
      expect(
        whyNotTakeCleanerNeeded(job(), "ana", open, undefined, startsAt),
      ).toBe("This job isn't available any more.");
      expect(
        whyNotTakeCleanerNeeded(
          job(),
          "ana",
          open,
          new Date(startsAt.getTime() + HOUR),
          NOW,
        ),
      ).toMatch(/^This job moved to /);
    });

    test("refused when it needs no Cleaner: not open yet, or taken", () => {
      const early = new Date(startsAt.getTime() - 8 * DAY);
      expect(
        whyNotTakeCleanerNeeded(job(), "ana", undefined, undefined, early),
      ).toBe("This job isn't open yet. Check back later.");
      expect(
        whyNotTakeCleanerNeeded(job(), "ana", undefined, undefined, NOW),
      ).toBe("Someone else already took this job.");
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
      expect(refused("released")).toBe(
        "You dropped out of this job, so you can't take it back.",
      );
      expect(refused("offered")).toBe("You're already on this job.");
      expect(refused()).toBe("You're not free for this job any more.");
    });
  });
});
