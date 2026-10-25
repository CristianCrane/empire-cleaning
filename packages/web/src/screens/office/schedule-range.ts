import { addDays, mondayOf, today } from "../format.ts";

// the dates asked for; without valid ones, the Schedule shows this week
export type ScheduleSearch = { from?: string; to?: string };

export const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// the range a search shows: this week, Monday to Sunday, unless valid dates
// (at most 62 days) are asked for
export const scheduleRange = ({ from, to }: ScheduleSearch) => {
  if (isDay(from) && isDay(to) && from <= to && addDays(from, 61) >= to) {
    return { from, to };
  }
  const monday = mondayOf(today());
  return { from: monday, to: addDays(monday, 6) };
};
