import { addDays, mondayOf, today } from "../format.ts";

// the dates asked for; without valid ones, the Schedule shows this week, or
// today on a phone
export type ScheduleSearch = { from?: string; to?: string };

export const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// how many days the Schedule shows at once: a week, or on a phone, where a
// week's columns are too narrow to read, a day or three
export type Span = 1 | 3 | 7;
export const SPANS: Span[] = [1, 3, 7];

export const daysIn = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000 +
  1;

// where a span showing `day` starts: a week from its Monday, otherwise the
// day itself
export const rangeShowing = (span: Span, day: string) => {
  const from = span === 7 ? mondayOf(day) : day;
  return { from, to: addDays(from, span - 1) };
};

// wide enough for a week's columns
export const isWide = () =>
  typeof window === "undefined" ||
  window.matchMedia("(min-width: 48rem)").matches;

// the range a search shows: the days asked for, if they're a day, three days
// or a week; otherwise this week, or today on a phone
export const scheduleRange = ({ from, to }: ScheduleSearch) => {
  if (isDay(from) && isDay(to) && SPANS.includes(daysIn(from, to) as Span)) {
    return { from, to };
  }
  return rangeShowing(isWide() ? 7 : 1, today());
};
