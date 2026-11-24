import { describe, expect, test } from "vitest";
import {
  firstNameOf,
  formats,
  oneStop,
  howLong,
  inLine,
  quarterHours,
  quarterHoursText,
  stopAfter,
  theTimeEs,
} from "./format.ts";

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
  expect(en.formatFullDay("2026-11-17")).toBe("November 17, 2026");
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
  expect(es.formatFullDay("2026-11-17")).toBe("17 de noviembre de 2026");
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

test("stopAfter ends what came before once, whether or not it has its own", () => {
  expect(stopAfter("lun, 12 de ene, 9:00 a.m.")).toBe("");
  expect(stopAfter("Mon, Jan 12, 9:00 AM")).toBe(".");
});

test("theTimeEs says one o'clock with la, the rest with las", () => {
  expect(theTimeEs("1:30 p.m.")).toBe("la 1:30 p.m.");
  expect(theTimeEs("9:00 a.m.")).toBe("las 9:00 a.m.");
  expect(theTimeEs("11:00 a.m.")).toBe("las 11:00 a.m.");
});

test("a person's first name is what's before the first space", () => {
  expect(firstNameOf("Casey Client")).toBe("Casey");
  expect(firstNameOf("Jen")).toBe("Jen");
  expect(firstNameOf("María José Pérez")).toBe("María");
});

test("a time range gives both ends in New York's time", () => {
  const threePm = "2026-01-12T20:00:00Z";
  expect(en.formatTimeRange(MORNING, threePm)).toBe("9:00 AM – 3:00 PM");
  expect(es.formatTimeRange(MORNING, threePm)).toBe("9:00 a.m. – 3:00 p.m.");
});

test("hours round to the quarter hour, written with their fraction", () => {
  expect(quarterHours(3.3)).toBe(3.25);
  expect(quarterHours(3.4)).toBe(3.5);
  expect(quarterHours(6)).toBe(6);
  expect(quarterHoursText(3.25)).toBe("3¼");
  expect(quarterHoursText(2.5)).toBe("2½");
  expect(quarterHoursText(4.75)).toBe("4¾");
  expect(quarterHoursText(0.5)).toBe("½");
  expect(quarterHoursText(6)).toBe("6");
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

test("howLong spells its unit out where an email asks it to", () => {
  const t = {
    about: (hours: string) => `about ${hours}`,
    hours: (hours: string, n: number) =>
      n === 1 ? `${hours} hour` : `${hours} hours`,
  };
  expect(howLong(t, 1.63)).toBe("about 1¾ hours");
  expect(howLong(t, 1)).toBe("1 hour");
});

test("inLine reads a part on from the dot before it", () => {
  expect(inLine("About 1¾ h")).toBe("about 1¾ h");
  expect(inLine("Cerca de 1¾ h")).toBe("cerca de 1¾ h");
  expect(inLine("3 h")).toBe("3 h");
});
