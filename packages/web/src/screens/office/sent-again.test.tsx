import { expect, test } from "vitest";
import { sentAgain } from "./sent-again.ts";

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
