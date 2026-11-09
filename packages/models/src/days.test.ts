import { expect, test } from "vitest";
import { clockTime, formatClock } from "./days.ts";

test("clockTime writes minutes since midnight as a 24-hour time", () => {
  expect(clockTime(0)).toBe("00:00");
  expect(clockTime(5)).toBe("00:05");
  expect(clockTime(570)).toBe("09:30");
  expect(clockTime(23 * 60 + 59)).toBe("23:59");
});

test("formatClock reads a time the way a person says it", () => {
  expect(formatClock("00:30")).toBe("12:30 AM");
  expect(formatClock("09:05")).toBe("9:05 AM");
  expect(formatClock("12:00")).toBe("12:00 PM");
  expect(formatClock("18:00")).toBe("6:00 PM");
});
