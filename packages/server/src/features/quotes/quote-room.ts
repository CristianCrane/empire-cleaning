import { and, asc, eq, inArray, max } from "drizzle-orm";
import type { QuoteSummary } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { dayOf } from "../../services/clock/index.ts";
import { onSchedule } from "../jobs/jobs.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { rescheduleRequests } from "../reschedule/reschedule.schema.ts";
import { siteVisits } from "../site-visits/site-visits.schema.ts";
import { onDays, scheduleFor } from "../jobs/schedule.ts";
import { addressOf } from "../properties/property-view.ts";
import { jobsReplacedAt } from "../service-plans/changing.ts";
import { tellOfficeStaff } from "../staff/staff.ts";
import { quotesWithoutRoomEmail } from "./emails.ts";
import { openQuotes } from "./quote-state.ts";
import { quotes, revisionOptions } from "./quotes.schema.ts";
import { cleansFit } from "./rules.ts";
import { monitoring } from "../../services/monitoring/index.ts";

// A Sent Quote doesn't hold its time: a booking for another Client, or fewer
// Cleaners or hours, can fill its proposed day or time under it. Then it can't be
// accepted (acceptQuote checks again), the Client is told so on the Quote,
// and the Office is told it needs another time.

/**
 * The Services each open Sent Quote can still be booked as, by key, in its
 * options' order: those its
 * proposed time still has room for, as of now: the Labour Hours on its day,
 * and a crew of its Crew Size then. A Service Plan Quote is booked whole, so
 * it can be while the first clean on each of its weekdays has room, and
 * then offers its weekdays' Services; one changing its home's plan
 * doesn't count the plan's Jobs it would replace. Accepting asks the same
 * rule (cleansFit), over each Quote's days, loaded once.
 */
export const bookableFor = async (
  open: { id: string; proposedStartsAt: Date }[],
): Promise<Map<string, string[]>> => {
  const bookable = new Map<string, string[]>(open.map((q) => [q.id, []]));
  if (open.length === 0) return bookable;

  // each Quote's offer: its latest Sent Revision
  const options = await db
    .select({
      quoteId: quotes.id,
      serviceKey: revisionOptions.serviceKey,
      labourHours: revisionOptions.labourHours,
      crewSize: revisionOptions.crewSize,
      startsAt: revisionOptions.startsAt,
      kind: quotes.kind,
      propertyId: quotes.propertyId,
    })
    .from(revisionOptions)
    .innerJoin(quotes, eq(quotes.sentRevisionId, revisionOptions.revisionId))
    .where(
      inArray(
        quotes.id,
        open.map((q) => q.id),
      ),
    )
    .orderBy(asc(revisionOptions.position));
  const startOfQuote = new Map(open.map((q) => [q.id, q.proposedStartsAt]));

  for (const [quoteId, offered] of Map.groupBy(options, (o) => o.quoteId)) {
    const proposed = startOfQuote.get(quoteId)!;
    const [{ kind, propertyId }] = offered as [(typeof offered)[number]];
    const replacing =
      kind === "service_plan" ? await jobsReplacedAt(propertyId, proposed) : [];
    const cleans = offered.map((option) => ({
      startsAt: option.startsAt ?? proposed,
      labourHours: option.labourHours,
      crewSize: option.crewSize,
    }));
    const dates = cleans.map((clean) => dayOf(clean.startsAt)).sort();
    const days = await scheduleFor(dates[0]!, dates.at(-1)!);
    const fitting =
      kind === "one_off"
        ? offered.filter((_, i) => cleansFit(days, [cleans[i]!], replacing))
        : cleansFit(days, cleans, replacing)
          ? offered
          : [];
    bookable.set(quoteId, [...new Set(fitting.map((o) => o.serviceKey))]);
  }
  return bookable;
};

const startOf = (quote: QuoteSummary) => new Date(quote.proposedStartsAt!);

// the days a Quote would book a clean on first: a Service Plan Quote's on
// each of its weekdays
const firstDaysOf = (quote: QuoteSummary) =>
  quote.plan
    ? quote.plan.days.map((d) => dayOf(new Date(d.startsAt!)))
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
    .sort((a, b) => a.proposedStartsAt!.localeCompare(b.proposedStartsAt!));
};

// when the Quote stopped fitting, as near as is known: the latest booking on
// its day since it was sent (a Job, a Site Visit, or a move asked for onto
// it), or else when it was sent (its day's Cleaner hours may have been cut
// instead, or the Office moved a Job there)
export const noRoomSince = async (quote: QuoteSummary) => {
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
  return new Date(Math.max(Date.parse(quote.sentAt!), ...at)).toISOString();
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
