import { expect, test } from "vitest";
import { formatDate, planDayWhen } from "./format.ts";

// 10:30pm on Tuesday 3 November 2026 in New York, already the 4th in UTC,
// where these tests' browser is (vitest.config.ts)
const LATE_EVENING = "2026-11-04T03:30:00Z";

test("formatDate says the day it was in New York, not the viewer's", () => {
  expect(formatDate(LATE_EVENING)).toBe("Nov 3, 2026");
});

test("planDayWhen says the weekday and time in New York, with plain spaces", () => {
  expect(planDayWhen(LATE_EVENING)).toBe("Tuesdays at 10:30 PM");
  expect(planDayWhen("2026-11-02T14:00:00Z")).toBe("Mondays at 9:00 AM");
});
