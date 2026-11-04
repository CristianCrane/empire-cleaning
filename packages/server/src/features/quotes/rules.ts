import type { QuoteStatus, ScheduleDay } from "@empire-cleaning/models";
import { dayOf } from "../../services/clock/index.ts";
import { roomOn, withoutReplaced, type Clean } from "../jobs/rules.ts";

// The rules for accepting a Quote, over what acceptance loads: the Quote as
// it is now, its home's plan, and the days of the cleans it books. They
// never query: the actions lock and load, ask, then write.

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

/**
 * Accepting a Quote's offer, `revisionId`, booking these cleans: refused
 * once a newer Revision is Sent, unless the Quote is still Sent, unless its
 * home's plan is still the one expected (`changing`: none for a Quote
 * starting one), and unless every clean has room, the Jobs it replaces
 * counting as gone.
 */
export const whyUnbookable = (
  held: Held,
  accepting: { revisionId: string; changing: string | null; cleans: Clean[] },
): Unbookable | null => {
  if (held.sentRevisionId !== accepting.revisionId) {
    return { reason: "revised" };
  }
  if (held.status !== "sent") return { reason: "closed", status: held.status };
  if (held.planId !== accepting.changing) {
    return { reason: accepting.changing ? "plan_changed" : "has_plan" };
  }
  for (const clean of accepting.cleans) {
    const day = held.days.find((d) => d.date === dayOf(clean.startsAt))!;
    if (!roomOn(withoutReplaced(day, held.replacing), clean).hasRoom) {
      return { reason: "no_room" };
    }
  }
  return null;
};
