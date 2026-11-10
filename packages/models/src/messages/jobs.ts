import type { DayCapacity } from "../index.ts";
import { catalog } from "../language.ts";

// What the server and the screens both say about a time for a clean
// (docs/ux.md, Words)

export const jobs = catalog({
  en: {
    ENDS_BY_MIDNIGHT:
      "This would run past midnight. Pick an earlier start time.",
    SAME_TIME: "That's when it's booked now. Pick a different time.",
  },
  es: {
    ENDS_BY_MIDNIGHT:
      "Terminaría después de la medianoche. Elija una hora de inicio más temprana.",
    SAME_TIME: "Ya está reservada a esa hora. Elija otra hora.",
  },
});

// the Office's, in English (ADR-0025)
export const DAY_FULL = "That day is too full for this job.";
export const NO_CREW = "Not enough cleaners are free then.";

// the Office's way to make room, after what else they can do
export const MORE_HOURS = "give a cleaner more working hours that day";
export const ADD_HOURS = `Pick another time, or ${MORE_HOURS}.`;

// why a clean has no room, for Office Staff, then how to fix it: `fix`, or
// another time or more hours
export const whyNoRoom = (room: DayCapacity, fix = ADD_HOURS) => {
  if (!room.endsByMidnight) return jobs.en.ENDS_BY_MIDNIGHT;
  return `${room.hasHours ? NO_CREW : DAY_FULL} ${fix}`;
};
