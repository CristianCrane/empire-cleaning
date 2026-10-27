import type { CleanType, Recurrence } from "@empire-cleaning/models";
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

const cleanTypeLabel: Record<CleanType, string> = {
  deep: "Deep Clean",
  standard: "Standard Clean",
};

/**
 * A Service Plan's weekdays in words, for emails: "a Standard Clean every 2
 * weeks, on Mondays at 9:00 AM" (with `where` after the Clean Type, if
 * given), or with several weekdays, "every week: a Standard Clean on Mondays
 * at 6:00 PM and a Deep Clean on Saturdays at 9:00 AM". Each day by its first
 * clean, earliest first.
 */
export const describePlan = (
  recurrence: Recurrence,
  days: { startsAt: Date; cleanType: CleanType }[],
  where = "",
) => {
  const on = (day: (typeof days)[number]) =>
    `on ${weekdayName(day.startsAt)}s at ${formatTime(day.startsAt)}`;
  if (days.length === 1) {
    const [day] = days;
    return `a ${cleanTypeLabel[day!.cleanType]}${where} ${recurrenceLabel[recurrence]}, ${on(day!)}`;
  }
  const each = days.map((d) => `a ${cleanTypeLabel[d.cleanType]} ${on(d)}`);
  return `${recurrenceLabel[recurrence]}: ${each.slice(0, -1).join(", ")} and ${each.at(-1)}`;
};
