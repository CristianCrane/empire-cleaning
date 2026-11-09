import { expect, test } from "vitest";
import { formatDate } from "./format.ts";

// 10:30pm on Tuesday 3 November 2026 in New York, already the 4th in UTC,
// where these tests' browser is (vitest.config.ts)
const LATE_EVENING = "2026-11-04T03:30:00Z";

test("formatDate says the day it was in New York, not the viewer's", () => {
  expect(formatDate(LATE_EVENING)).toBe("Nov 3, 2026");
});
