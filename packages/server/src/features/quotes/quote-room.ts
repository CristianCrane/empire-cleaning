import { and, inArray, max } from "drizzle-orm";
import type { OfferedQuoteSummary } from "@empire-cleaning/models";
import { dayOf } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { onSchedule } from "../jobs/jobs.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { rescheduleRequests } from "../reschedule/reschedule.schema.ts";
import { siteVisits } from "../site-visits/site-visits.schema.ts";
import { onDays } from "../jobs/schedule.ts";
import { addressOf } from "../properties/property-view.ts";
import { tellOfficeStaff } from "../staff/staff.ts";
import { quotesWithoutRoomEmail } from "./emails.ts";
import { bookableFor } from "./offer-room.ts";
import { openQuotes } from "./quote-state.ts";
import { monitoring } from "../../services/monitoring/index.ts";

// The open Quotes a booking or fewer Cleaners or hours left without room
// (offer-room.ts says why a Sent Quote can lose it), and the Office told.

const startOf = (quote: OfferedQuoteSummary) =>
  new Date(quote.proposedStartsAt);

// the days a Quote would book a clean on first: a Service Plan Quote's on
// each of its weekdays
const firstDaysOf = (quote: OfferedQuoteSummary) =>
  quote.plan
    ? quote.plan.days.map((d) => dayOf(new Date(d.startsAt)))
    : [dayOf(startOf(quote))];

// open Sent Quotes with a clean on `day` if given, that can't be booked for
// lack of room, soonest proposed first
export const quotesWithoutRoom = async (day?: string) => {
  const open = (await openQuotes()).filter(
    (q) => !day || firstDaysOf(q).includes(day),
  );
  const bookable = await bookableFor(
    open.map((q) => ({ id: q.id, proposedStartsAt: startOf(q) })),
  );
  return open
    .filter((q) => bookable.get(q.id)!.length === 0)
    .sort((a, b) => a.proposedStartsAt.localeCompare(b.proposedStartsAt));
};

// when the Quote stopped fitting, as near as is known: the latest booking on
// its day since it was sent (a Job, a Site Visit, or a move asked for onto
// it), or else when it was sent (its day's Cleaner hours may have been cut
// instead, or the Office moved a Job there)
export const noRoomSince = async (quote: OfferedQuoteSummary) => {
  const day = dayOf(startOf(quote));
  const [job] = await db
    .select({ at: max(jobs.bookedAt) })
    .from(jobs)
    .where(and(onSchedule(), onDays(jobs.startsAt, [day])));
  const [visit] = await db
    .select({ at: max(siteVisits.bookedAt) })
    .from(siteVisits)
    .where(
      and(
        inArray(siteVisits.status, ["booked", "done"]),
        onDays(siteVisits.startsAt, [day]),
      ),
    );
  const [move] = await db
    .select({ at: max(rescheduleRequests.requestedAt) })
    .from(rescheduleRequests)
    .where(
      and(
        inArray(rescheduleRequests.status, ["pending", "confirmed"]),
        onDays(rescheduleRequests.startsAt, [day]),
      ),
    );
  const at = [job, visit, move].map((latest) => latest?.at?.getTime() ?? 0);
  return new Date(Math.max(Date.parse(quote.sentAt), ...at)).toISOString();
};

/**
 * After a booking fills some of `day`, or a Cleaner's hours are cut there,
 * tells Office Staff about any open Quotes for that day that no longer fit,
 * so they can send another time before the Client tries to accept. Without
 * a day, as when a usual week changes or a Cleaner leaves, every day. The
 * change is made: an email that can't go is only logged.
 */
export const warnOfficeOfQuotesWithoutRoom = async (day?: string) => {
  try {
    const crowdedOut = await quotesWithoutRoom(day);
    if (crowdedOut.length === 0) return;
    await tellOfficeStaff(
      `Quotes without room on ${day ?? "any day"} to the Office`,
      async () =>
        quotesWithoutRoomEmail({
          quotes: crowdedOut.map((q) => ({
            client: q.client.name,
            address: addressOf(q.property),
            startsAt: startOf(q),
          })),
        }),
    );
  } catch (error) {
    monitoring.error(error, {
      what: `Office not told of Quotes without room on ${day ?? "any day"}`,
    });
  }
};
