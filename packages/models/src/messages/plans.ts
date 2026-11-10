import type { Recurrence } from "../index.ts";
import { dayOf } from "../days.ts";
import { formats, theTimeEs } from "../format.ts";
import { catalog } from "../language.ts";

// What the server and the screens both say about when a Service Plan's
// cleans come round (docs/ux.md, Words). A weekday's clean is said in the
// plural, which no formatter gives: "Mondays", "los lunes"

const en = formats.en;
const es = formats.es;
const weekdayOfStart = (lang: typeof en, startsAt: string | Date) =>
  lang.weekdayName(dayOf(new Date(startsAt)));

// a weekday's clean and when, by its first: "Mondays at 9:00 AM"
const planDayWhenEn = (startsAt: string | Date) =>
  `${weekdayOfStart(en, startsAt)}s at ${en.formatTime(startsAt)}`;

// "los lunes a las 9:00 a.m.": sábado and domingo take an s, the others
// stay as they are; one o'clock is "a la 1:00"
const planDayWhenEs = (startsAt: string | Date) => {
  const weekday = weekdayOfStart(es, startsAt);
  const time = es.formatTime(startsAt);
  return `los ${/[ao]$/.test(weekday) ? `${weekday}s` : weekday} a ${theTimeEs(time)}`;
};

export const plans = catalog({
  en: {
    // how often a plan's cleans come round, in a sentence: "every 2 weeks"
    recurrence: {
      weekly: "every week",
      fortnightly: "every 2 weeks",
      four_weekly: "every 4 weeks",
    } satisfies Record<Recurrence, string>,
    planDayWhen: planDayWhenEn,
    // each weekday's: "Mondays at 9:00 AM and Wednesdays at 1:00 PM"
    planDaysWhen: (startsAts: (string | Date)[]) =>
      en.formatList(startsAts.map(planDayWhenEn)),
  },
  es: {
    recurrence: {
      weekly: "cada semana",
      fortnightly: "cada 2 semanas",
      four_weekly: "cada 4 semanas",
    },
    planDayWhen: planDayWhenEs,
    planDaysWhen: (startsAts: (string | Date)[]) =>
      es.formatList(startsAts.map(planDayWhenEs)),
  },
});
