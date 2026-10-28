import type { Recurrence } from "@empire-cleaning/models";
import { formatTime, weekdayName } from "../../services/email/index.ts";

// a percentage of an amount, to the cent, halves up: a Plan Discount, or a
// Deposit
export const percentOf = (cents: number, percent: number) =>
  Math.floor((cents * percent + 50) / 100);

const recurrenceLabel: Record<Recurrence, string> = {
  weekly: "every week",
  fortnightly: "every 2 weeks",
  four_weekly: "every 4 weeks",
};

/**
 * A Service Plan in words, for emails: its one Service, how often, and its
 * weekdays, each by its first clean, earliest first: "a Standard Clean every
 * 2 weeks, on Mondays at 9:00 AM", or "a Standard Clean every week, on
 * Mondays at 6:00 PM and Saturdays at 9:00 AM" (with `where` after the
 * Service, if given).
 */
export const describePlan = (
  recurrence: Recurrence,
  days: { startsAt: Date; serviceName: string }[],
  where = "",
) => {
  const each = days.map(
    (d) => `${weekdayName(d.startsAt)}s at ${formatTime(d.startsAt)}`,
  );
  const on =
    each.length === 1
      ? each[0]
      : `${each.slice(0, -1).join(", ")} and ${each.at(-1)}`;
  return `a ${days[0]!.serviceName}${where} ${recurrenceLabel[recurrence]}, on ${on}`;
};
