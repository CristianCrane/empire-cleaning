import { addDays, daysIn, mondayOf } from "@empire-cleaning/models";
import { isWide, readStored, store } from "@empire-cleaning/ui";
import { today } from "./format.ts";

// the dates asked for; without valid ones, the Schedule shows today on the
// span last chosen
export type ScheduleSearch = { from?: string; to?: string };

export const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// how many days the Schedule shows at once: a week, or on a phone, where a
// week's columns are too narrow to read, a day or three
export type Span = 1 | 3 | 7;
export const SPANS: Span[] = [1, 3, 7];

// where a span showing `day` starts: a week from its Monday, otherwise the
// day itself
export const rangeShowing = (span: Span, day: string) => {
  const from = span === 7 ? mondayOf(day) : day;
  return { from, to: addDays(from, span - 1) };
};

// the span the Schedule opens on: the one last chosen in this browser, or
// a day on a phone, so its blocks have room to name their client, and three
// days on anything wider. Storage can be blocked (private windows), so it's
// only a convenience
const SPAN_KEY = "ec-schedule-span";
const defaultSpan = (): Span => (isWide() ? 3 : 1);

const chosenSpan = (): Span => {
  const stored = Number(readStored("localStorage", SPAN_KEY));
  return SPANS.includes(stored as Span) ? (stored as Span) : defaultSpan();
};

// not remembered if storage is blocked: the Schedule opens on the default
// next time
export const chooseSpan = (span: Span) =>
  store("localStorage", SPAN_KEY, String(span));

// the range a search shows: the days asked for, if they're a day, three days
// or a week; otherwise today, on the span last chosen
export const scheduleRange = ({ from, to }: ScheduleSearch) => {
  if (isDay(from) && isDay(to) && SPANS.includes(daysIn(from, to) as Span)) {
    return { from, to };
  }
  return rangeShowing(chosenSpan(), today());
};
