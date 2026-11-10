import {
  catalog,
  inLanguage,
  type Language,
  messages,
  type Named,
  type Recurrence,
} from "@empire-cleaning/models";

// a percentage of an amount, to the cent, halves up: a Plan Discount, or a
// Deposit
export const percentOf = (cents: number, percent: number) =>
  Math.floor((cents * percent + 50) / 100);

// a plan's words around its Service, how often and its weekdays
const words = catalog({
  en: {
    plan: (service: string, often: string, days: string) =>
      `a ${service} ${often}, on ${days}`,
  },
  es: {
    plan: (service: string, often: string, days: string) =>
      `${service} ${often}, ${days}`,
  },
});

/**
 * A Service Plan in words, for emails, in `lang`: its one Service, how
 * often, and its weekdays, each by its first clean, earliest first: "a
 * Standard Clean every 2 weeks, on Mondays at 9:00 AM", or "a Standard
 * Clean every week, on Mondays at 6:00 PM and Saturdays at 9:00 AM" (with
 * `where` after the Service, if given).
 */
export const describePlan = (
  lang: Language,
  recurrence: Recurrence,
  days: { startsAt: Date; service: Named }[],
  where = "",
) => {
  const { planDaysWhen, recurrence: often } = messages[lang];
  return words[lang].plan(
    `${inLanguage(lang, days[0]!.service).name}${where}`,
    often[recurrence],
    planDaysWhen(days.map((d) => d.startsAt)),
  );
};
