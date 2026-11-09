import type { Recurrence } from "../index.ts";
import { dayOf } from "../days.ts";
import { formats } from "../format.ts";
import { catalog } from "../language.ts";

// What the server and the screens both say about when a Service Plan's
// cleans come round (docs/ux.md, Words). A weekday's clean is said in the
// plural, which no formatter gives: "Mondays", "los lunes"

const plansIn = (lang: "en" | "es") => {
  const { formatList, formatTime, weekdayName } = formats[lang];
  // a weekday's clean and when, by its first: "Mondays at 9:00 AM", "los
  // lunes a las 9:00 a.m."
  const planDayWhen = (startsAt: string | Date) => {
    const weekday = weekdayName(dayOf(new Date(startsAt)));
    const time = formatTime(startsAt);
    return lang === "en"
      ? `${weekday}s at ${time}`
      : // sábado and domingo take an s; the others are the same
        `los ${/[ao]$/.test(weekday) ? `${weekday}s` : weekday} ${time.startsWith("1:") ? "a la" : "a las"} ${time}`;
  };
  return {
    planDayWhen,
    // each weekday's: "Mondays at 9:00 AM and Wednesdays at 1:00 PM"
    planDaysWhen: (startsAts: (string | Date)[]) =>
      formatList(startsAts.map(planDayWhen)),
  };
};

export const plans = catalog({
  en: {
    // how often a plan's cleans come round, in a sentence: "every 2 weeks"
    recurrence: {
      weekly: "every week",
      fortnightly: "every 2 weeks",
      four_weekly: "every 4 weeks",
    } satisfies Record<Recurrence, string>,
    ...plansIn("en"),
  },
  es: {
    recurrence: {
      weekly: "cada semana",
      fortnightly: "cada 2 semanas",
      four_weekly: "cada 4 semanas",
    },
    ...plansIn("es"),
  },
});
