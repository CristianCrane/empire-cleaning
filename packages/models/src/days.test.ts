import { expect, test } from "vitest";
import { clockTime } from "./days.ts";

test("clockTime writes minutes since midnight as a 24-hour time", () => {
  expect(clockTime(0)).toBe("00:00");
  expect(clockTime(5)).toBe("00:05");
  expect(clockTime(570)).toBe("09:30");
  expect(clockTime(23 * 60 + 59)).toBe("23:59");
});
