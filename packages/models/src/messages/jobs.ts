import type { DayCapacity } from "../index.js";

// What the server and the screens both say about a time for a clean
// (docs/ux.md, Words)

const PAST_MIDNIGHT = "This would run past midnight.";
export const ENDS_BY_MIDNIGHT = `${PAST_MIDNIGHT} Pick an earlier start time.`;

export const PASSED = "That time has passed. Pick a later time.";

export const SAME_TIME = "That's when it's booked now. Pick a different time.";

export const DAY_FULL = "That day is too full for this job.";
export const NO_CREW = "Not enough cleaners are free then.";

// the Office's way to make room, after what else they can do
export const MORE_HOURS = "give a cleaner more working hours that day";
export const ADD_HOURS = `Pick another time, or ${MORE_HOURS}.`;

// why a clean has no room, for Office Staff, then how to fix it: `fix`, or
// another time or more hours
export const whyNoRoom = (room: DayCapacity, fix = ADD_HOURS) => {
  if (!room.endsByMidnight) return ENDS_BY_MIDNIGHT;
  return `${room.hasHours ? NO_CREW : DAY_FULL} ${fix}`;
};
