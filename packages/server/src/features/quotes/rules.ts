import type {
  DayCapacity,
  QuoteStatus,
  ScheduleDay,
} from "@empire-cleaning/models";
import { dayOf } from "../../services/clock/index.ts";
import { roomOn, withoutReplaced, type Clean } from "../jobs/rules.ts";

// The rules for accepting a Quote, over what acceptance loads: the Quote as
// it is now, its home's plan, and the days of the cleans it books. Whether
// those cleans have room (cleansFit) also answers what the Quote screen
// offers (bookableFor), over the days it loads, and each clean's room
// (cleanRooms) what a Draft is told. They never query: the actions lock and
// load, ask, then write.

// why a Quote can't be booked, as its Deposit is taken or once it has been
export type Unbookable =
  | { reason: "closed"; status: QuoteStatus }
  // a newer Revision was Sent: the offer accepted isn't the offer any more
  | { reason: "revised" }
  | { reason: "no_room" }
  // a Service Plan Quote starting a plan, for a home whose plan started
  // while the Client's bank was approving its Deposit
  | { reason: "has_plan" }
  // a Service Plan Quote whose home's plan started or Ended just then
  | { reason: "plan_changed" };

// what booking is checked against, as the acceptance holds it
export type Held = {
  // the Revision the Quote has Sent now, and its status
  sentRevisionId: string | null;
  status: QuoteStatus;
  // the home's plan now, for a Service Plan Quote; null for a one-off,
  // which never changes one
  planId: string | null;
  // the days the cleans are on, and the booked Jobs the Quote's new terms
  // replace there
  days: ScheduleDay[];
  replacing: string[];
};

// Accepting a Quote's offer, `revisionId`: refused once a newer Revision is
// Sent, then unless the Quote is still Sent
export const whyClosed = (
  held: Pick<Held, "sentRevisionId" | "status">,
  revisionId: string,
): Unbookable | null => {
  if (held.sentRevisionId !== revisionId) return { reason: "revised" };
  if (held.status !== "sent") return { reason: "closed", status: held.status };
  return null;
};

/**
 * The room each of these cleans of a Quote has on its day, as roomOn says,
 * the booked Jobs its new terms replace counting as gone (withoutReplaced).
 * `days` holds each clean's day.
 */
export const cleanRooms = (
  days: ScheduleDay[],
  cleans: Clean[],
  replacing: string[],
): DayCapacity[] =>
  cleans.map((clean) => {
    const day = days.find((d) => d.date === dayOf(clean.startsAt))!;
    return roomOn(withoutReplaced(day, replacing), clean);
  });

/**
 * Whether every one of these cleans of a Quote has room on its day
 * (cleanRooms). A Service Plan Quote's cleans are asked together, as it's
 * accepted whole; a one-off Quote's Services each alone.
 */
export const cleansFit = (
  days: ScheduleDay[],
  cleans: Clean[],
  replacing: string[],
) => cleanRooms(days, cleans, replacing).every((room) => room.hasRoom);

/**
 * Accepting a Quote's offer, `revisionId`, booking these cleans: refused
 * as whyClosed says, then unless its home's plan is still the one expected
 * (`changing`: none for a Quote starting one), and unless its cleans fit
 * (cleansFit).
 */
export const whyUnbookable = (
  held: Held,
  accepting: { revisionId: string; changing: string | null; cleans: Clean[] },
): Unbookable | null => {
  const closed = whyClosed(held, accepting.revisionId);
  if (closed) return closed;
  if (held.planId !== accepting.changing) {
    return { reason: accepting.changing ? "plan_changed" : "has_plan" };
  }
  if (!cleansFit(held.days, accepting.cleans, held.replacing)) {
    return { reason: "no_room" };
  }
  return null;
};
