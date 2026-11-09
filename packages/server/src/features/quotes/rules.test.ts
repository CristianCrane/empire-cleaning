import { describe, expect, test } from "vitest";
import { afterNine, thursday } from "../../../tests/schedule-days.ts";
import type { Clean } from "../jobs/rules.ts";
import { cleanRooms, whyUnbookable, type Held } from "./rules.ts";

// Accepting a Quote over plain data (tests/schedule-days.ts): Thursday has
// Ana and Bea, 16 hours, 10 of them free, with a Job from 9am to noon.
// accept.test.ts checks the same through the API, over saved Quotes.

// a clean at 1pm on Thursday
const at1pm = (labourHours: number, crewSize = 2) => ({
  startsAt: afterNine(4),
  labourHours,
  crewSize,
});

// a one-off Quote, still Sent with the Revision accepted, and room that day
const held = (over: Partial<Held> = {}): Held => ({
  sentRevisionId: "rev",
  status: "sent",
  planId: null,
  days: [thursday()],
  replacing: [],
  ...over,
});

// accepting the Revision still Sent, starting no plan, with one clean at 1pm
const accepting = (
  over: { changing?: string | null; cleans?: Clean[] } = {},
) => ({
  revisionId: "rev",
  changing: null,
  cleans: [at1pm(2)],
  ...over,
});

describe("accepting a Quote (whyUnbookable)", () => {
  test("books a Sent Quote's offer with room for it", () => {
    expect(whyUnbookable(held(), accepting())).toBeNull();
  });

  test("not once a newer Revision is Sent, before anything else", () => {
    expect(
      whyUnbookable(
        held({ sentRevisionId: "newer", status: "accepted" }),
        accepting(),
      ),
    ).toEqual({ reason: "revised" });
  });

  test("not unless the Quote is still Sent", () => {
    expect(whyUnbookable(held({ status: "expired" }), accepting())).toEqual({
      reason: "closed",
      status: "expired",
    });
  });

  test("a Service Plan Quote, not once its home's plan has changed", () => {
    // starting one, for a home whose plan started meanwhile
    expect(
      whyUnbookable(held({ planId: "plan" }), accepting({ changing: null })),
    ).toEqual({ reason: "has_plan" });
    // changing one that Ended, or was replaced, meanwhile
    expect(
      whyUnbookable(held({ planId: null }), accepting({ changing: "plan" })),
    ).toEqual({ reason: "plan_changed" });
    expect(
      whyUnbookable(held({ planId: "other" }), accepting({ changing: "plan" })),
    ).toEqual({ reason: "plan_changed" });
    // the plan expected, or none
    expect(
      whyUnbookable(held({ planId: "plan" }), accepting({ changing: "plan" })),
    ).toBeNull();
    expect(whyUnbookable(held({ planId: null }), accepting())).toBeNull();
  });

  test("a plan that changed is refused before the room is looked at", () => {
    expect(
      whyUnbookable(
        held({ planId: "plan" }),
        accepting({ cleans: [at1pm(12)] }),
      ),
    ).toEqual({ reason: "has_plan" });
  });

  test("not unless every clean has room", () => {
    expect(whyUnbookable(held(), accepting({ cleans: [at1pm(12)] }))).toEqual({
      reason: "no_room",
    });

    // Friday, with nobody available
    const friday = {
      ...thursday(),
      date: "2026-01-09",
      staffHours: 0,
      bookedHours: 0,
      freeHours: 0,
      available: [],
      jobs: [],
    };
    const fridayClean = { ...at1pm(2), startsAt: afterNine(24 + 4) };
    expect(
      whyUnbookable(
        held({ days: [thursday(), friday] }),
        accepting({ cleans: [at1pm(2), fridayClean] }),
      ),
    ).toEqual({ reason: "no_room" });
  });

  test("counts the Jobs a plan's new terms replace as gone", () => {
    // 12 Labour Hours fit once the 6 of Thursday's Job are free again
    expect(
      whyUnbookable(
        held({ planId: "plan", replacing: ["job"] }),
        accepting({ changing: "plan", cleans: [at1pm(12)] }),
      ),
    ).toBeNull();
  });
});

describe("each clean's room (cleanRooms)", () => {
  test("says, for each clean in turn, whether it has room and why not", () => {
    const [fits, tooLong] = cleanRooms([thursday()], [at1pm(2), at1pm(12)], []);
    expect(fits).toMatchObject({ hasRoom: true, freeHours: 10 });
    expect(tooLong).toMatchObject({
      hasRoom: false,
      hasHours: false,
      hasCrew: true,
    });
  });

  test("counts the Jobs a plan's new terms replace as gone", () => {
    // the Job's 6 hours, and its crew of two from 9am, free again
    const [room] = cleanRooms(
      [thursday()],
      [{ startsAt: afterNine(0), labourHours: 12, crewSize: 2 }],
      ["job"],
    );
    expect(room).toMatchObject({ hasRoom: true, freeHours: 16, crewsBusy: 0 });
  });
});
