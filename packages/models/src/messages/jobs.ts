import type { DayCapacity } from "../index.ts";
import { catalog } from "../language.ts";

// What the server and the screens both say about a time for a clean
// (docs/ux.md, Words)

export const jobs = catalog({
  en: {
    // a time asked for that has already passed
    PASSED: "That time has passed. Pick a later time.",
    ENDS_BY_MIDNIGHT:
      "This would run past midnight. Pick an earlier start time.",
    SAME_TIME: "That's when it's booked now. Pick a different time.",
  },
  es: {
    PASSED: "Esa hora ya pasó. Elija una hora más tarde.",
    ENDS_BY_MIDNIGHT:
      "Terminaría después de la medianoche. Elija una hora de inicio más temprana.",
    SAME_TIME: "Ya está reservada a esa hora. Elija otra hora.",
  },
});

// why a clean has no room at its time: the first of its rules it fails
export type NoRoom = "past_midnight" | "full" | "crew";
export const noRoomOf = (room: DayCapacity): NoRoom =>
  !room.endsByMidnight ? "past_midnight" : !room.hasHours ? "full" : "crew";

// each, in the Office's few words (English, ADR-0025), that its lines are
// built on: "The client can't pick it at this time: that day is too full."
export const NO_ROOM: Record<NoRoom, string> = {
  past_midnight: "it would run past midnight",
  full: "that day is too full",
  crew: "not enough cleaners are free then",
};

const sentence = (words: string) =>
  `${words[0]!.toUpperCase()}${words.slice(1)}`;
export const DAY_FULL = `${sentence(NO_ROOM.full)} for this job.`;
export const NO_CREW = `${sentence(NO_ROOM.crew)}.`;

// a one-off quote's Service offered beside its own, which alone would run
// past midnight at its time: Send refuses the quote for it
export const runsPastMidnight = (serviceName: string) =>
  `The ${serviceName} would run past midnight, so the quote can't be sent with it. Pick an earlier start time.`;

// the Office's way to make room, after what else they can do
export const MORE_HOURS = "give a cleaner more working hours that day";
export const ADD_HOURS = `Pick another time, or ${MORE_HOURS}.`;

// why a clean has no room, for Office Staff, then how to fix it: `fix`, or
// another time or more hours
export const whyNoRoom = (room: DayCapacity, fix = ADD_HOURS) => {
  const why = noRoomOf(room);
  if (why === "past_midnight") return jobs.en.ENDS_BY_MIDNIGHT;
  return `${why === "full" ? DAY_FULL : NO_CREW} ${fix}`;
};
