import type { DayCapacity } from "../index.js";

// What the server and the screens both say about a time for a clean
// (docs/ux.md, Words)

export const ENDS_BY_MIDNIGHT =
  "Cleans end by midnight: choose an earlier start time";

// a time that has already passed
export const PASSED = "Choose a time that's still to come";

// why a clean has no room, for Office Staff
export const whyNoRoom = (room: DayCapacity) => {
  if (!room.endsByMidnight) return ENDS_BY_MIDNIGHT;
  if (!room.hasHours) {
    return `That day doesn't have room: the Job needs ${room.labourHours} Labour Hours and ${Math.max(room.freeHours, 0)} are free.`;
  }
  const free = Math.max(room.cleaners - room.crewsBusy, 0);
  return `Not enough Cleaners are free then: the Job needs ${room.crewSize}, and ${free} of the ${room.cleaners} available that day ${free === 1 ? "is" : "are"}.`;
};
