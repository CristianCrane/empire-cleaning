import { expect, test } from "vitest";
import { sentAgain, sentWith } from "./sent-again.ts";

// the dot glued to both its neighbours, as lineOf sets it
const dot = " · ";

// two sends of one Quote read alike when only the crew changed, as the
// price and time under each are the same: the entry says what changed
test("a send after the first names what it changed, in the Draft's words", () => {
  expect(sentAgain({ changed: ["cleaners"], offeredServiceName: null })).toBe(
    `Quote sent again${dot}cleaners changed`,
  );
  expect(
    sentAgain({
      changed: ["service", "price", "time", "validity"],
      offeredServiceName: null,
    }),
  ).toBe(
    `Quote sent again${dot}service, price, time and how long it's valid changed`,
  );
  expect(sentAgain({ changed: [], offeredServiceName: null })).toBe(
    `Quote sent again${dot}nothing changed`,
  );
  expect(
    sentAgain({
      changed: ["price", "offeredPrice"],
      offeredServiceName: "Deep Clean",
    }),
  ).toBe(`Quote sent again${dot}price and Deep Clean price changed`);
});

// the crew each send went with, so one that changed only its cleaners shows
// its before and after; a plan's, each crew with its weekdays once they
// differ
test("a send's line says the crew it went with", () => {
  const monday = "2026-01-12T14:00:00Z";
  const wednesday = "2026-01-14T18:00:00Z";
  const friday = "2026-01-16T14:00:00Z";
  expect(sentWith([{ startsAt: monday, crewSize: 1 }])).toBe("1 cleaner");
  expect(
    sentWith([
      { startsAt: monday, crewSize: 2 },
      { startsAt: wednesday, crewSize: 2 },
    ]),
  ).toBe("2 cleaners");
  expect(
    sentWith([
      { startsAt: monday, crewSize: 2 },
      { startsAt: wednesday, crewSize: 1 },
      { startsAt: friday, crewSize: 2 },
    ]),
  ).toBe("2 cleaners on Mondays and Fridays and 1 cleaner on Wednesdays");
});
