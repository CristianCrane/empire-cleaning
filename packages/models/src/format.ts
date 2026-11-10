import { BUSINESS_TIME_ZONE } from "./days.ts";
import { type Catalog, type Language, locales } from "./language.ts";

// Dates, times, money, numbers, lists and plurals as a person reads them,
// in English or Spanish (ADR-0025), one set for the server and every
// screen. Pick a language's as words are picked: `formats[lang]`, or
// `formats.en` where only English is read (the Office, and screens and
// emails until they know their reader's language).
//
// Days and times are Empire Cleaning's, New York's, wherever the server
// runs or the screen is (BUSINESS_TIME_ZONE). An instant is an ISO string
// or a Date; a day is written "2026-01-12".

// a day as the instant its noon is in UTC, which every zone puts on that day
const noonOf = (day: string) => new Date(`${day}T12:00:00Z`);
const instant = (at: string | Date) =>
  typeof at === "string" ? new Date(at) : at;

// lists read "a, b and c", with no comma before "and" (or "y"), as all our
// English has. Intl's en-US list adds one, so English lists alone take
// en-GB's, which doesn't; everything else is en-US, as ADR-0025 says
const listLocales: Record<Language, string> = { en: "en-GB", es: locales.es };

const formatsIn = (lang: Language) => {
  const locale = locales[lang];
  const dates = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, options);
  // in New York, for an instant
  const inNewYork = (options: Intl.DateTimeFormatOptions) =>
    dates({ ...options, timeZone: BUSINESS_TIME_ZONE });
  // for a day, or a time of day, whatever the zone
  const asWritten = (options: Intl.DateTimeFormatOptions) =>
    dates({ ...options, timeZone: "UTC" });

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });
  const number = new Intl.NumberFormat(locale);
  const date = inNewYork({ month: "short", day: "numeric", year: "numeric" });
  const day = asWritten({ weekday: "short", month: "short", day: "numeric" });
  const shortDay = asWritten({ month: "short", day: "numeric" });
  const longDay = asWritten({ weekday: "long", month: "long", day: "numeric" });
  const weekday = asWritten({ weekday: "long" });
  const month = asWritten({ month: "long", year: "numeric" });
  const clock = { hour: "numeric", minute: "2-digit" } as const;
  const time = inNewYork(clock);
  const timeOfDay = asWritten(clock);
  const dateTime = inNewYork({
    weekday: "short",
    month: "short",
    day: "numeric",
    ...clock,
  });
  const when = inNewYork({
    weekday: "long",
    month: "long",
    day: "numeric",
    ...clock,
  });
  const tileMonth = inNewYork({ month: "short" });
  const tileDay = inNewYork({ day: "numeric" });
  const tileWeekday = inNewYork({ weekday: "short" });
  const lists = {
    and: new Intl.ListFormat(listLocales[lang], { type: "conjunction" }),
    or: new Intl.ListFormat(listLocales[lang], { type: "disjunction" }),
  };
  const plurals = new Intl.PluralRules(locale);

  return {
    // cents -> "$391.04"
    formatMoney: (cents: number) => money.format(cents / 100),
    // 4500 -> "4,500"
    formatNumber: (n: number) => number.format(n),
    // an instant -> "Nov 3, 2026"
    formatDate: (at: string | Date) => date.format(instant(at)),
    // "2026-01-05" -> "Mon, Jan 5"
    formatDay: (d: string) => day.format(noonOf(d)),
    // "2026-01-05" -> "Jan 5", where the weekday would crowd it
    formatShortDay: (d: string) => shortDay.format(noonOf(d)),
    // "2026-01-12" -> "Monday, January 12", as an email writes it
    formatLongDay: (d: string) => longDay.format(noonOf(d)),
    // "2026-01-05" -> "Monday"
    weekdayName: (d: string) => weekday.format(noonOf(d)),
    // the days of the week, Monday first, as Weekday counts them: "Monday",
    // …, "Sunday" (5 to 11 January 2026 are Monday to Sunday)
    weekdays: [5, 6, 7, 8, 9, 10, 11].map((d) =>
      weekday.format(noonOf(`2026-01-${String(d).padStart(2, "0")}`)),
    ),
    // a day in a month -> "January 2026"
    formatMonth: (d: string) => month.format(noonOf(d)),
    // an instant -> "9:00 AM"
    formatTime: (at: string | Date) => time.format(instant(at)),
    // a time of day -> how a person reads it: "18:00" -> "6:00 PM"
    formatClock: (t: string) =>
      timeOfDay.format(new Date(`1970-01-01T${t}:00Z`)),
    // an instant -> "Mon, Jan 12, 9:00 AM"
    formatDateTime: (at: string | Date) => dateTime.format(instant(at)),
    // an instant -> "Monday, January 12 at 9:00 AM", as an email writes it
    formatWhen: (at: string | Date) => when.format(instant(at)),
    // an instant as a page off a calendar shows it (DateTile): "Nov", "3",
    // "Tue"
    dateTile: (at: string | Date) => ({
      month: tileMonth.format(instant(at)),
      day: tileDay.format(instant(at)),
      weekday: tileWeekday.format(instant(at)),
    }),
    // ["a", "b", "c"] -> "a, b and c", or "a, b or c"
    formatList: (items: string[], type: "and" | "or" = "and") =>
      lists[type].format(items),
    // a list as its items and what goes between them, for items that aren't
    // plain text, such as links: [{ type: "element", value: "a" }, { type:
    // "literal", value: " and " }, …]
    listParts: (items: string[], type: "and" | "or" = "and") =>
      lists[type].formatToParts(items),
    // the form of a word for so many: plural(2, { one: "hour", other:
    // "hours" }) -> "hours"
    plural: (n: number, forms: { one: string; other: string }) =>
      plurals.select(n) === "one" ? forms.one : forms.other,
  };
};

export type Formats = ReturnType<typeof formatsIn>;

export const formats: Catalog<Formats> = {
  en: formatsIn("en"),
  es: formatsIn("es"),
};

// a Spanish sentence with a time in it, from the server or a screen: es-US
// writes "9:00 a.m.", so one that ends a sentence, or a plan's days before
// one ends, takes no second stop ("a las 9:00 a.m.", not "a.m..")
export const oneStop = (sentence: string) => sentence.replaceAll("..", ".");

// the stop after what a screen shows on its own, such as a time in bold,
// before the sentence goes on: none after one that ends in its own
// ("9:00 a.m."), as oneStop does within a string
export const stopAfter = (before: string) => (before.endsWith(".") ? "" : ".");
