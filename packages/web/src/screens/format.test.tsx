import { formats, messages } from "@empire-cleaning/models";
import { expect, test } from "vitest";
import { formatHours } from "./format.ts";

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

// the Office reads a length as a person says it, to the minute: a crew's
// hours on site are kept to the hundredth (#548)
test("formatHours says hours and minutes, to the minute", () => {
  expect(formatHours(1.63)).toBe("1 h 38 min");
  expect(formatHours(3)).toBe("3 h");
  expect(formatHours(0.75)).toBe("45 min");
  expect(formatHours(1.08)).toBe("1 h 5 min");
  expect(formatHours(0)).toBe("0 h");
});
