import { and, eq, gte, inArray, lt, max } from "drizzle-orm";
import type { CleanType, QuoteSummary } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import env from "../../env.ts";
import { addDays, dayOf, startOfDay } from "../../services/clock/index.ts";
import { compose, email, formatWhen } from "../../services/email/index.ts";
import { onSchedule } from "../jobs/jobs.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { roomFor } from "../jobs/schedule.ts";
import { addressOf } from "../properties/property-view.ts";
import { jobsReplacedAt } from "../service-plans/changing.ts";
import { officeStaffEmails } from "../staff/staff.ts";
import { openQuotes } from "./quote-state.ts";
import { quotes, revisionOptions } from "./quotes.schema.ts";

// A Sent Quote doesn't hold its time: a booking for another Client, or fewer
// Cleaners or hours, can fill its proposed day or time under it. Then it can't be
// accepted (acceptQuote checks again), the Client is told so on the Quote,
// and the Office is told it needs another time.

// Deep Clean first, as Quotes list them
const CLEAN_TYPES: CleanType[] = ["deep", "standard"];

/**
 * The Clean Types each open Sent Quote can still be booked as: those its
 * proposed time still has room for, as of now: the Labour Hours on its day,
 * and a crew of its Crew Size then. A Service Plan Quote is booked whole, so
 * it can be while the first clean on each of its weekdays has room, and
 * then offers its weekdays' Clean Types; one changing its home's plan
 * doesn't count the plan's Jobs it would replace.
 */
export const bookableFor = async (
  open: { id: string; proposedStartsAt: Date }[],
): Promise<Map<string, CleanType[]>> => {
  const bookable = new Map<string, CleanType[]>(open.map((q) => [q.id, []]));
  if (open.length === 0) return bookable;

  // each Quote's offer: its latest Sent Revision
  const options = await db
    .select({
      quoteId: quotes.id,
      cleanType: revisionOptions.cleanType,
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
    );
  const startOfQuote = new Map(open.map((q) => [q.id, q.proposedStartsAt]));

  for (const [quoteId, offered] of Map.groupBy(options, (o) => o.quoteId)) {
    const proposed = startOfQuote.get(quoteId)!;
    const [{ kind, propertyId }] = offered as [(typeof offered)[number]];
    const replacing =
      kind === "service_plan" ? await jobsReplacedAt(propertyId, proposed) : [];
    const fitting: CleanType[] = [];
    for (const option of offered) {
      const { hasRoom } = await roomFor(
        {
          startsAt: option.startsAt ?? proposed,
          labourHours: option.labourHours,
          crewSize: option.crewSize,
        },
        replacing,
      );
      if (hasRoom) fitting.push(option.cleanType);
    }
    const whole = kind === "one_off" || fitting.length === offered.length;
    bookable.set(
      quoteId,
      whole
        ? [...new Set(fitting)].sort(
            (a, b) => CLEAN_TYPES.indexOf(a) - CLEAN_TYPES.indexOf(b),
          )
        : [],
    );
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
// its day since it was sent, or else when it was sent (its day's Cleaner
// hours may have been cut instead)
export const noRoomSince = async (quote: QuoteSummary) => {
  const day = dayOf(startOf(quote));
  const [latest] = await db
    .select({ at: max(jobs.bookedAt) })
    .from(jobs)
    .where(
      and(
        onSchedule(),
        gte(jobs.startsAt, startOfDay(day)),
        lt(jobs.startsAt, startOfDay(addDays(day, 1))),
      ),
    );
  const sentAt = Date.parse(quote.sentAt!);
  const bookedAt = latest?.at ? latest.at.getTime() : 0;
  return new Date(Math.max(sentAt, bookedAt)).toISOString();
};

/**
 * After a booking fills some of `day`, tells Office Staff about any open
 * Quotes for that day that no longer fit, so they can send another time
 * before the Client tries to accept. The booking is made: an email that
 * can't go is only logged.
 */
export const warnOfficeOfQuotesWithoutRoom = async (day: string) => {
  try {
    const crowdedOut = await quotesWithoutRoom(day);
    if (crowdedOut.length === 0) return;
    const recipients = await officeStaffEmails();
    const lines = [
      crowdedOut.length === 1
        ? "A booking has filled the time this Quote was proposed for, so its Client can't accept it:"
        : "A booking has filled the time these Quotes were proposed for, so their Clients can't accept them:",
      crowdedOut
        .map(
          (q) =>
            `${q.client.name}, ${addressOf(q.property)}: ${formatWhen(startOf(q))}`,
        )
        .join("\n"),
      "Send each a new Quote for another time. They're under Needs attention until you do.",
    ];
    for (const to of recipients) {
      await email.send({
        to,
        subject:
          crowdedOut.length === 1
            ? "A Quote needs another time"
            : `${crowdedOut.length} Quotes need another time`,
        ...compose(lines, {
          href: `${env.CORS_ORIGIN_URL}/office`,
          label: "Open Needs attention",
        }),
      });
    }
  } catch (error) {
    console.error(`Office not told of Quotes without room on ${day}:`, error);
  }
};
