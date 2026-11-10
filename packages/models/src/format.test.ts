import { describe, expect, test } from "vitest";
import { formats, oneStop } from "./format.ts";

const { en, es } = formats;
// 9:00am in New York on Monday, January 12, 2026
const MORNING = "2026-01-12T14:00:00Z";
// 10:30pm in New York on Tuesday, November 3: Wednesday the 4th in UTC
const LATE_EVENING = "2026-11-04T03:30:00Z";

// each English output as the formatters it replaced gave it (#301)
test("English reads as it always has", () => {
  expect(en.formatMoney(39104)).toBe("$391.04");
  expect(en.formatNumber(4500)).toBe("4,500");
  expect(en.formatDate(LATE_EVENING)).toBe("Nov 3, 2026");
  expect(en.formatDay("2026-01-05")).toBe("Mon, Jan 5");
  expect(en.formatShortDay("2026-01-05")).toBe("Jan 5");
  expect(en.formatLongDay("2026-01-12")).toBe("Monday, January 12");
  expect(en.weekdayName("2026-01-05")).toBe("Monday");
  expect(en.weekdays).toEqual([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);
  expect(en.formatMonth("2026-11-01")).toBe("November 2026");
  expect(en.formatTime(MORNING)).toBe("9:00 AM");
  expect(en.formatTime(new Date(LATE_EVENING))).toBe("10:30 PM");
  expect(en.formatClock("00:30")).toBe("12:30 AM");
  expect(en.formatClock("09:05")).toBe("9:05 AM");
  expect(en.formatClock("12:00")).toBe("12:00 PM");
  expect(en.formatClock("18:00")).toBe("6:00 PM");
  expect(en.formatDateTime(MORNING)).toBe("Mon, Jan 12, 9:00 AM");
  expect(en.formatWhen(new Date(MORNING))).toBe(
    "Monday, January 12 at 9:00 AM",
  );
  expect(en.dateTile(LATE_EVENING)).toEqual({
    month: "Nov",
    day: "3",
    weekday: "Tue",
  });
  expect(en.formatList(["Monday"])).toBe("Monday");
  expect(en.formatList(["Monday", "Friday"])).toBe("Monday and Friday");
  expect(en.formatList(["Mon", "Wed", "Fri"])).toBe("Mon, Wed and Fri");
  expect(en.formatList(["a Deep Clean", "a Standard Clean"], "or")).toBe(
    "a Deep Clean or a Standard Clean",
  );
  expect(en.formatList([])).toBe("");
  const hours = { one: "hour", other: "hours" };
  expect(en.plural(1, hours)).toBe("hour");
  expect(en.plural(1.5, hours)).toBe("hours");
  expect(en.plural(0, hours)).toBe("hours");
});

test("Spanish reads as es-US writes it", () => {
  expect(es.formatMoney(39104)).toBe("$391.04");
  expect(es.formatDay("2026-01-05")).toBe("lun, 5 de ene");
  expect(es.formatLongDay("2026-01-12")).toBe("lunes, 12 de enero");
  expect(es.weekdayName("2026-01-05")).toBe("lunes");
  expect(es.weekdays[6]).toBe("domingo");
  expect(es.formatMonth("2026-11-01")).toBe("noviembre de 2026");
  expect(es.formatTime(MORNING)).toBe("9:00 a.m.");
  expect(es.formatClock("18:00")).toBe("6:00 p.m.");
  expect(es.formatList(["lunes", "miércoles", "viernes"])).toBe(
    "lunes, miércoles y viernes",
  );
  expect(es.formatList(["a", "b"], "or")).toBe("a o b");
  expect(es.plural(1, { one: "hora", other: "horas" })).toBe("hora");
  expect(es.plural(2, { one: "hora", other: "horas" })).toBe("horas");
});

describe("oneStop", () => {
  test("ends a Spanish sentence once after a time", () => {
    const at = new Date("2026-01-12T14:00:00Z");
    expect(oneStop(`Cancelada el ${formats.es.formatDateTime(at)}.`)).toBe(
      "Cancelada el lun, 12 de ene, 9:00 a.m.",
    );
    expect(oneStop(`Cancelled ${formats.en.formatDateTime(at)}.`)).toBe(
      "Cancelled Mon, Jan 12, 9:00 AM.",
    );
  });
});
