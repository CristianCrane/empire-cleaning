import { messages, type Recurrence } from "@empire-cleaning/models";

const { planDaysWhen, recurrence: often } = messages.en;

// a percentage of an amount, to the cent, halves up: a Plan Discount, or a
// Deposit
export const percentOf = (cents: number, percent: number) =>
  Math.floor((cents * percent + 50) / 100);

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
) =>
  `a ${days[0]!.serviceName}${where} ${often[recurrence]}, on ${planDaysWhen(days.map((d) => d.startsAt))}`;
