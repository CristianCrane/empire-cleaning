import { and, asc, eq, inArray, max } from "drizzle-orm";
import type {
  DayCapacity,
  DayTimes,
  QuoteKind,
  QuoteSummary,
  ScheduleDay,
} from "@empire-cleaning/models";
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
import { cleanRooms, cleansFit } from "./rules.ts";
import { startsOn, startsWithoutCrew, type Clean } from "../jobs/rules.ts";
import { monitoring } from "../../services/monitoring/index.ts";

// A Sent Quote doesn't hold its time: a booking for another Client, or fewer
// Cleaners or hours, can fill its proposed day or time under it. Then it can't be
// accepted (acceptQuote checks again), the Client is told so on the Quote,
// and the Office is told it needs another time.

/**
 * The booked Jobs each of these sets of a Quote's cleans would replace: for
 * a Service Plan Quote, its home's plan's from the set's earliest clean on
 * (jobsReplacedAt); none for a one-off, which never changes a plan.
 */
const replacedFor = async (
  kind: QuoteKind,
  propertyId: string,
  sets: Clean[][],
): Promise<string[][]> =>
  kind === "service_plan"
    ? jobsReplacedAt(
        propertyId,
        sets.map(
          (cleans) =>
            new Date(Math.min(...cleans.map((c) => c.startsAt.getTime()))),
        ),
      )
    : sets.map(() => []);

// a Revision's options as cleans, as saved: each at its own start (a plan's
// weekday's) or else the proposed time; null for one with neither yet
const cleansOf = (
  revision: { proposedStartsAt: Date | null },
  options: { startsAt: Date | null; labourHours: number; crewSize: number }[],
): (Clean | null)[] =>
  options.map((option) => {
    const startsAt = option.startsAt ?? revision.proposedStartsAt;
    return startsAt
      ? { startsAt, labourHours: option.labourHours, crewSize: option.crewSize }
      : null;
  });

/**
 * Each of a Revision's options' room now, in the order given, as accepting
 * asks it (cleanRooms): at its start, a weekday's own or else the proposed
 * time, over its days of the Schedule from the earliest to the latest (a
 * Draft's weekdays are in the order typed), a Service Plan Quote counting
 * as gone the booked Jobs of its home's plan it replaces from its earliest
 * clean on (replacedFor). Null for an option with no start yet: a
 * Draft's earliest so far may come before a weekday still to be timed,
 * which can only replace fewer.
 */
export const optionRoomsOf = async (
  revision: { kind: QuoteKind; proposedStartsAt: Date | null },
  propertyId: string,
  options: { startsAt: Date | null; labourHours: number; crewSize: number }[],
): Promise<(DayCapacity | null)[]> => {
  const cleans = cleansOf(revision, options);
  const timed = cleans.filter((clean) => clean !== null);
  if (timed.length === 0) return cleans.map(() => null);
  const dates = timed.map((clean) => dayOf(clean.startsAt)).sort();
  const [days, [replacing]] = await Promise.all([
    scheduleFor(dates[0]!, dates.at(-1)!),
    replacedFor(revision.kind, propertyId, [timed]),
  ]);
  const rooms = cleanRooms(days, timed, replacing!);
  return cleans.map((clean) => clean && rooms[timed.indexOf(clean)]!);
};

/**
 * The starts on these days of the Schedule where a Draft's clean would
 * find no crew free (startsWithoutCrew), as its room line asks it
 * (cleanRooms), the Draft as last saved: a Service Plan Quote's weekday
 * `weekday` moved to each start beside its other weekdays' starts, the
 * Jobs of its home's plan that the Quote would then replace counting as
 * gone (replacedFor, from its earliest clean); a one-off's options all
 * moved there, marked when any has no crew (its longest). A plan's
 * `weekday` is one of its saved ones; a one-off has none (draftStarts
 * refuses either).
 */
export const draftStartsWithoutCrew = async (
  revision: { kind: QuoteKind; proposedStartsAt: Date | null },
  propertyId: string,
  options: { startsAt: Date | null; labourHours: number; crewSize: number }[],
  weekday: number | undefined,
  days: ScheduleDay[],
): Promise<DayTimes[]> => {
  const moves = (i: number) => revision.kind === "one_off" || i === weekday;
  const moving = options.filter((_, i) => moves(i));
  const others = cleansOf(revision, options).filter(
    (clean, i): clean is Clean => clean !== null && !moves(i),
  );
  const at = (startsAt: Date): Clean[] =>
    moving.map(({ labourHours, crewSize }) => ({
      startsAt,
      labourHours,
      crewSize,
    }));
  const starts = days.flatMap(startsOn);
  const replaced = await replacedFor(
    revision.kind,
    propertyId,
    starts.map((startsAt) => [...others, ...at(startsAt)]),
  );
  const replacing = new Map(
    starts.map((startsAt, i) => [startsAt.getTime(), replaced[i]!]),
  );
  return startsWithoutCrew(days, (day, startsAt) =>
    cleanRooms([day], at(startsAt), replacing.get(startsAt.getTime())!).every(
      (room) => room.hasCrew,
    ),
  );
};

/**
 * The Services each open Sent Quote can still be booked as, by key, in its
 * options' order: those its
 * proposed time still has room for, as of now: the Labour Hours on its day,
 * and a crew of its Crew Size then. A Service Plan Quote is booked whole, so
 * it can be while the first clean on each of its weekdays has room, and
 * then offers its weekdays' Services; one changing its home's plan
 * doesn't count the plan's Jobs it would replace. Accepting asks the same
 * rule (cleansFit), over each Quote's rooms (optionRoomsOf).
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
    const [{ kind, propertyId }] = offered as [(typeof offered)[number]];
    // every option of a Sent Revision has a start
    const rooms = (
      await optionRoomsOf(
        { kind: kind!, proposedStartsAt: startOfQuote.get(quoteId)! },
        propertyId,
        offered,
      )
    ).map((room) => room!);
    const fitting =
      kind === "one_off"
        ? offered.filter((_, i) => cleansFit([rooms[i]!]))
        : cleansFit(rooms)
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
