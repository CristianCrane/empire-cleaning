import { describe, expect, test } from "vitest";
import type { Revision, RevisionOptionRow } from "./quotes.schema.ts";
import { revisionChanges, type SentRevision } from "./revision-changes.ts";

// What a send changed, over plain data. quotes.test.ts checks the History
// through the API, over saved Quotes; these are the cases a saved Quote
// can't easily be put in.

const monday = new Date("2026-01-12T14:00:00Z");
const wednesday = new Date("2026-01-14T18:00:00Z");

const option = (
  over: Partial<RevisionOptionRow> & { serviceName?: string },
): RevisionOptionRow => {
  const { serviceName = "Standard Clean", ...row } = over;
  return {
    serviceKey: "standard",
    startsAt: null,
    totalCents: 19489,
    crewSize: 2,
    addOns: [],
    suggested: { serviceName },
    ...row,
  } as unknown as RevisionOptionRow;
};

const sent = (
  options: RevisionOptionRow[],
  over: Partial<Revision> = {},
): SentRevision => ({
  revision: {
    serviceKey: "standard",
    recurrence: null,
    proposedStartsAt: monday,
    crewSize: 2,
    area: null,
    condition: null,
    depositPercent: 25,
    planDiscountPercent: 10,
    validityDays: 14,
    ...over,
  } as Revision,
  options,
  // what it leads with: its own Service's option, or a plan's round
  headline: {
    totalCents: (over.recurrence ? options : options.slice(0, 1)).reduce(
      (sum, o) => sum + o.totalCents,
      0,
    ),
  },
});

const deep = (totalCents: number) =>
  option({ serviceKey: "deep", totalCents, serviceName: "Deep Clean" });

describe("a one-off Quote's send", () => {
  test("names the other Service when only its price moved", () => {
    expect(
      revisionChanges(
        sent([option({}), deep(29941)]),
        sent([option({}), deep(31000)]),
      ),
    ).toEqual({ changed: ["offeredPrice"], offeredServiceName: "Deep Clean" });
  });

  test("names both prices when both moved", () => {
    expect(
      revisionChanges(
        sent([option({}), deep(29941)]),
        sent([option({ totalCents: 20000 }), deep(31000)]),
      ),
    ).toEqual({
      changed: ["price", "offeredPrice"],
      offeredServiceName: "Deep Clean",
    });
  });
});

describe("a Service Plan Quote's send", () => {
  const plan = { recurrence: "weekly" } as Partial<Revision>;
  const days = (mon: number, wed: number) => [
    option({ startsAt: monday, totalCents: mon }),
    option({ startsAt: wednesday, totalCents: wed }),
  ];

  // every option is the plan's own Service, so a weekday's price is the
  // plan's, never another Service's, though its round costs the same
  test("reads a weekday's price as the plan's, with no other Service", () => {
    expect(
      revisionChanges(
        sent(days(10000, 10000), plan),
        sent(days(9000, 11000), plan),
      ),
    ).toEqual({ changed: ["price"], offeredServiceName: null });
  });
});
