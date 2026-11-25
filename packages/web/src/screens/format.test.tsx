import { formats, messages } from "@empire-cleaning/models";
import { expect, test } from "vitest";
import { howLong } from "./format.ts";

const { planDayWhen } = messages.en;

const { formatDate } = formats.en;

// 10:30pm on Tuesday 3 November 2026 in New York, already the 4th in UTC,
// where these tests' browser is (vitest.config.ts)
const LATE_EVENING = "2026-11-04T03:30:00Z";

test("formatDate says the day it was in New York, not the viewer's", () => {
  expect(formatDate(LATE_EVENING)).toBe("Nov 3, 2026");
});

// in Chromium, each time kept whole: a no-break space before its AM, the
// rest plain (#534's UX review U19)
test("planDayWhen says the weekday and time in New York, its time kept whole", () => {
  expect(planDayWhen(LATE_EVENING)).toBe("Tuesdays at 10:30\u00a0PM");
  expect(planDayWhen("2026-11-02T14:00:00Z")).toBe("Mondays at 9:00\u00a0AM");
});

test("howLong says About once, for any of several it rounds, and the same hours once", () => {
  const t = { about: (hours: string) => `About ${hours}` };
  expect(howLong(t, 6)).toBe("6 h");
  expect(howLong(t, 3.3)).toBe("About 3¼ h");
  expect(howLong(t, 2, 3.75)).toBe("2 h + 3¾ h");
  expect(howLong(t, 1.875, 3.75)).toBe("About 2 h + 3¾ h");
  // the same on each weekday, once: not read as a sum
  expect(howLong(t, 3.75, 3.75)).toBe("3¾ h");
  expect(howLong(t, 1.875, 1.875)).toBe("About 2 h");
  // one for each weekday, in order, while they differ
  expect(howLong(t, 2, 3.75, 2)).toBe("2 h + 3¾ h + 2 h");
});
