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

// words that start a sentence or a label: "the Deep Clean" -> "The Deep
// Clean", "falta 1" -> "Falta 1"
export const upperFirst = (words: string) =>
  words.charAt(0).toUpperCase() + words.slice(1);

// a day as the instant its noon is in UTC, which every zone puts on that day
const noonOf = (day: string) => new Date(`${day}T12:00:00Z`);
const instant = (at: string | Date) =>
  typeof at === "string" ? new Date(at) : at;

// lists read "a, b and c", with no comma before "and" (or "y"), as all our
// English has. Intl's en-US list adds one, so English lists alone take
// en-GB's, which doesn't; everything else is en-US, as ADR-0025 says
const listLocales: Record<Language, string> = { en: "en-GB", es: locales.es };

// a clock time held to its AM or PM by a no-break space, wherever it's
// read (a screen, an email), so a narrow line never ends on "9:00" with
// "AM" under it. Intl's own space between them differs from one engine to
// the next, so every engine's comes out the same
const held = (text: string) =>
  text.replace(/(\d)[ \u202f](?=AM|PM|[ap]\.\s?m\.)/g, "$1\u00a0");

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
  const fullDay = asWritten({ month: "long", day: "numeric", year: "numeric" });
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
    // "2026-11-17" -> "November 17, 2026", as a policy dates itself
    formatFullDay: (d: string) => fullDay.format(noonOf(d)),
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
    formatTime: (at: string | Date) => held(time.format(instant(at))),
    // two instants -> "9:00 AM – 3:00 PM", each end as formatTime writes
    // it (Intl's formatRange spaces its ends apart differently from one
    // engine to the next)
    formatTimeRange: (from: string | Date, to: string | Date) =>
      held(`${time.format(instant(from))} – ${time.format(instant(to))}`),
    // a time of day -> how a person reads it: "18:00" -> "6:00 PM"
    formatClock: (t: string) =>
      held(timeOfDay.format(new Date(`1970-01-01T${t}:00Z`))),
    // an instant -> "Mon, Jan 12, 9:00 AM"
    formatDateTime: (at: string | Date) => held(dateTime.format(instant(at))),
    // an instant -> "Monday, January 12 at 9:00 AM", as an email writes it
    formatWhen: (at: string | Date) => held(when.format(instant(at))),
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

// hours to the nearest quarter hour, as a person says how long something
// runs: 3.3 -> 3.25
export const quarterHours = (hours: number) => Math.round(hours * 4) / 4;

// quarter hours as a person writes them: 3.25 -> "3¼", 0.5 -> "½", 2 -> "2"
export const quarterHoursText = (hours: number) => {
  const whole = Math.floor(hours);
  const part = ["", "¼", "½", "¾"][Math.round((hours - whole) * 4)]!;
  return whole === 0 && part ? part : `${whole}${part}`;
};

// how long a clean runs, as a Client or a Cleaner reads it (the Office
// reads it to the minute): to the quarter hour, and "About" only when that
// rounded it: 6 -> "6 h", 3.3 -> "About 3¼ h". `hours` writes the unit,
// "h" unless an email spells it out ("3 hours")
export const howLong = (
  t: {
    about: (hours: string) => string;
    hours?: (hours: string, quarters: number) => string;
  },
  hours: number,
) => {
  const unit = t.hours ?? ((text: string) => `${text} h`);
  const text = unit(quarterHoursText(quarterHours(hours)), quarterHours(hours));
  return quarterHours(hours) === hours ? text : t.about(text);
};

// a part of a row's line after its first, which reads on from the dot
// before it as a sentence does, in lower case: "Deep Clean · about 1¾ h";
// an initialism keeps its capitals, as a name does: "ZIP code 11375"
export const inLine = (part: string) =>
  /^\p{Lu}{2}/u.test(part)
    ? part
    : part.charAt(0).toLocaleLowerCase() + part.slice(1);

// the parts of a row's line that show: a part left out is false, null,
// undefined or empty. Both lineOf and the kit's Line keep only these
export const partsShown = <T>(parts: (T | false | null | undefined)[]) =>
  parts.filter((p): p is T => p != null && p !== false && p !== "");

// a row's line of parts as text, where only text goes (a History entry's
// title, an email's line): set apart by dots, each glued to both its
// neighbours, so a wrap never leaves one at a line's end or start, though a
// long part may break inside itself. Where a slot takes more than text (a
// row, a Fact, a card's title), the kit's Line: parts each held whole leave
// this one text nowhere to wrap (docs/ux.md, Lists and tables)
export const lineOf = (parts: (string | false | null | undefined)[]) =>
  partsShown(parts).join("\u00a0·\u00a0");

// a person's first name, as a greeting says it ("Hi, Casey")
export const firstNameOf = (name: string) => name.split(" ")[0]!;

// a Spanish time with its article, as a sentence says it after "a" or
// "hasta": "la 1:00 p.m.", "las 9:00 a.m."
export const theTimeEs = (time: string) =>
  `${time.startsWith("1:") ? "la" : "las"} ${time}`;

// a Spanish sentence with a time in it, from the server or a screen: es-US
// writes "9:00 a.m.", so one that ends a sentence, or a plan's days before
// one ends, takes no second stop ("a las 9:00 a.m.", not "a.m..")
export const oneStop = (sentence: string) => sentence.replaceAll("..", ".");

// the stop after what a screen shows on its own, such as a time in bold,
// before the sentence goes on: none after one that ends in its own
// ("9:00 a.m."), as oneStop does within a string
export const stopAfter = (before: string) => (before.endsWith(".") ? "" : ".");
