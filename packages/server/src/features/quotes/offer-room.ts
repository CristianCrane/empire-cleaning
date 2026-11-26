import { asc, eq, inArray } from "drizzle-orm";
import type {
  DayCapacity,
  OpenDay,
  QuoteKind,
  ScheduleDay,
} from "@empire-cleaning/models";
import { atTime, dayOf, type Clean } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { scheduleFor } from "../jobs/schedule.ts";
import { jobsReplacedAt } from "../service-plans/changing.ts";
import { quotes, revisionOptions } from "./quotes.schema.ts";
import { cleanRooms, cleansFit, windowTimes } from "./rules.ts";
import { startsWhere } from "../jobs/rules.ts";
import { lateFrom } from "../cancellation/cancellation.ts";

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
 * A Draft's open starts on these days of the Schedule, as last saved: each
 * day's in the start window (windowTimes) more than a Late Cancellation's
 * 24 hours away, as Send asks (refuseUntimely), where the clean has room,
 * as its room line asks it (cleanRooms); a day with none says why. A
 * Service Plan Quote's weekday `weekday` moves to each start beside its
 * other weekdays' starts, the Jobs of its home's plan the Quote would then
 * replace counting as gone (replacedFor, from its earliest clean). A
 * one-off's options all move there: its own Service (`own`, its place among
 * those that move; a plan's one weekday is 0) needs room and every one must end by midnight, as Send asks,
 * but the one recommended for a first visit is an aside, so a time it alone
 * doesn't fit stays open, the room line says so, and `everyOption` names
 * the times both fit. A plan's `weekday` is one of its saved ones; a
 * one-off has none (draftOpenTimes refuses either).
 */
export const openTimesOf = async (
  revision: { kind: QuoteKind; proposedStartsAt: Date | null },
  propertyId: string,
  options: { startsAt: Date | null; labourHours: number; crewSize: number }[],
  { own, weekday }: { own: number; weekday?: number },
  days: ScheduleDay[],
  now: Date,
): Promise<OpenDay[]> => {
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
  const soon = (startsAt: Date) => lateFrom(startsAt) <= now;
  const starts = days
    .flatMap((day) => windowTimes.map((time) => atTime(day.date, time)))
    .filter((startsAt) => !soon(startsAt));
  const replaced = await replacedFor(
    revision.kind,
    propertyId,
    starts.map((startsAt) => [...others, ...at(startsAt)]),
  );
  const replacing = new Map(
    starts.map((startsAt, i) => [startsAt.getTime(), replaced[i]!]),
  );
  // each moving clean's room at a start not too soon, worked out once
  const roomsAt = new Map<number, DayCapacity[]>();
  const rooms = (day: ScheduleDay, startsAt: Date) => {
    const key = startsAt.getTime();
    if (!roomsAt.has(key)) {
      roomsAt.set(key, cleanRooms([day], at(startsAt), replacing.get(key)!));
    }
    return roomsAt.get(key)!;
  };
  const fits = (day: ScheduleDay, startsAt: Date) =>
    !soon(startsAt) &&
    rooms(day, startsAt)[own]!.hasRoom &&
    rooms(day, startsAt).every((room) => room.endsByMidnight);
  const fitsEvery = (day: ScheduleDay, startsAt: Date) =>
    fits(day, startsAt) && rooms(day, startsAt).every((room) => room.hasRoom);
  const every = startsWhere(days, windowTimes, fitsEvery);
  const today = dayOf(now);
  return startsWhere(days, windowTimes, fits).map((day, i) => ({
    ...day,
    everyOption: every[i]!.times,
    closed:
      day.times.length > 0
        ? null
        : day.date < today
          ? "past"
          : windowTimes.every((time) => soon(atTime(day.date, time)))
            ? "soon"
            : // no Cleaner works it: more hours is the fix, not another time
              days[i]!.staffHours === 0
              ? "off"
              : "full",
  }));
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
