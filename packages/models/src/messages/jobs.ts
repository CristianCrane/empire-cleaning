import type { DayCapacity } from "../index.ts";
import { upperFirst } from "../format.ts";
import { catalog } from "../language.ts";

// What the server and the screens both say about a time for a clean
// (docs/ux-words.md, Words)

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

// the two that leave a time sendable, in the Office's few words (English,
// ADR-0025), that its lines are built on: "The client can't pick it at
// this time: that day is too full."
export const NO_ROOM: Record<Exclude<NoRoom, "past_midnight">, string> = {
  full: "that day is too full",
  crew: "not enough cleaners are free then",
};

export const DAY_FULL = `${upperFirst(NO_ROOM.full)} for this job.`;
export const NO_CREW = `${upperFirst(NO_ROOM.crew)}.`;

// an option on the quote (its own clean, a plan weekday's, or the Service
// offered beside it) that would run past midnight at its time: Send refuses
// the quote for it. `subject` names it, "the Deep Clean" where Send says
// so, "it" in the line under each option's price, "it and the Deep Clean"
// there when the Service offered beside it runs past midnight too
export const runsPastMidnight = (subject: string) =>
  `${upperFirst(subject)} would run past midnight at this time, so the quote can't be sent. Pick an earlier start time.`;

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
