import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  lte,
  ne,
  type SQL,
} from "drizzle-orm";
import type {
  QuoteRequestState,
  QuoteStatus,
  QuoteSummary,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { quoteRequests } from "../quote-requests/quote-requests.schema.ts";
import { quoteOptions, quotes, type Quote } from "./quotes.schema.ts";

// A Sent Quote Expires at the end of its validity or at its proposed time,
// whichever is first, by the Clock; nothing needs to run for that to happen
export const statusOf = (
  quote: Pick<Quote, "status" | "expiresAt">,
): QuoteStatus =>
  quote.status === "sent" && quote.expiresAt! <= clock.now()
    ? "expired"
    : quote.status;

/**
 * Where each request stands, from the Quotes that answer it (an offer nobody
 * asked for never counts): booked once one is Accepted, quoted while one is
 * open, ended if the latest sent was Declined, and otherwise awaiting a
 * Quote. An Expired one goes back to awaiting a Quote, so the Office can send
 * another without the Client asking again.
 */
export const requestStates = async (requestIds: string[]) => {
  const states = new Map<string, QuoteRequestState>(
    requestIds.map((id) => [id, "awaiting_quote"]),
  );
  if (requestIds.length === 0) return states;

  const sent = await db
    .select({
      quoteRequestId: quotes.quoteRequestId,
      status: quotes.status,
      expiresAt: quotes.expiresAt,
    })
    .from(quotes)
    .where(
      and(
        inArray(quotes.quoteRequestId, requestIds),
        ne(quotes.status, "draft"),
      ),
    )
    .orderBy(desc(quotes.sentAt));

  const byRequest = Map.groupBy(sent, (q) => q.quoteRequestId!);
  for (const [id, answers] of byRequest) {
    const statuses = answers.map(statusOf);
    if (statuses.includes("accepted")) states.set(id, "booked");
    else if (statuses.includes("sent")) states.set(id, "quoted");
    else if (statuses[0] === "declined") states.set(id, "ended");
  }
  return states;
};

// a closed request takes no more Quotes, and its home can be asked about again
export const isClosed = (state: QuoteRequestState) =>
  state === "booked" || state === "ended";

/**
 * Each Property's First Clean, where it's Completed: the first Job a one-off
 * Quote booked there to be Completed, with the request that Quote answered.
 * Only a Property with one can be offered a Service Plan. Every Property
 * with one, if no ids are given.
 */
export const firstCleansOf = async (propertyIds?: string[]) => {
  const firstCleans = new Map<string, { job: Job; quoteRequestId: string }>();
  if (propertyIds?.length === 0) return firstCleans;
  const done = await db
    .select({ job: jobs, quoteRequestId: quotes.quoteRequestId })
    .from(jobs)
    .innerJoin(quotes, eq(quotes.jobId, jobs.id))
    .where(
      and(
        propertyIds ? inArray(jobs.propertyId, propertyIds) : undefined,
        eq(jobs.status, "completed"),
        eq(quotes.kind, "one_off"),
      ),
    )
    .orderBy(asc(jobs.completedAt));
  for (const { job, quoteRequestId } of done) {
    if (!firstCleans.has(job.propertyId)) {
      firstCleans.set(job.propertyId, {
        job,
        quoteRequestId: quoteRequestId!,
      });
    }
  }
  return firstCleans;
};

export const firstCleanCompleted = async (propertyId: string) =>
  (await firstCleansOf([propertyId])).has(propertyId);

/**
 * The First Cleans whose Property should now be offered a Service Plan,
 * earliest Completed first: the request the First Clean answered wanted
 * regular visits, and no Service Plan Quote there is open, Accepted or
 * Declined (one that Expired or was Superseded unanswered doesn't count).
 */
export const servicePlansDue = async () => {
  const firstCleans = await firstCleansOf();
  if (firstCleans.size === 0) return [];
  const [wanting, offered] = await Promise.all([
    db
      .select({ id: quoteRequests.id })
      .from(quoteRequests)
      .where(
        and(
          inArray(
            quoteRequests.id,
            [...firstCleans.values()].map((f) => f.quoteRequestId),
          ),
          eq(quoteRequests.wantsRegularService, true),
        ),
      ),
    db
      .select({
        propertyId: quotes.propertyId,
        status: quotes.status,
        expiresAt: quotes.expiresAt,
      })
      .from(quotes)
      .where(
        and(
          inArray(quotes.propertyId, [...firstCleans.keys()]),
          eq(quotes.kind, "service_plan"),
          inArray(quotes.status, ["sent", "accepted", "declined"]),
        ),
      ),
  ]);
  const wanted = new Set(wanting.map((r) => r.id));
  const answered = new Set(
    offered.filter((q) => statusOf(q) !== "expired").map((q) => q.propertyId),
  );
  return [...firstCleans.entries()]
    .filter(
      ([propertyId, { quoteRequestId }]) =>
        wanted.has(quoteRequestId) && !answered.has(propertyId),
    )
    .map(([, { job }]) => ({ jobId: job.id, since: job.completedAt! }));
};

const summaries = async (where: SQL | undefined) => {
  const rows = await db
    .select({
      quote: quotes,
      client: {
        id: clients.id,
        name: clients.name,
        businessName: clients.businessName,
      },
      property: {
        id: properties.id,
        street: properties.street,
        unit: properties.unit,
        postcode: properties.postcode,
      },
    })
    .from(quotes)
    .innerJoin(properties, eq(properties.id, quotes.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(where)
    .orderBy(desc(quotes.createdAt));
  const options =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(quoteOptions)
          .where(
            inArray(
              quoteOptions.quoteId,
              rows.map((r) => r.quote.id),
            ),
          )
          .orderBy(asc(quoteOptions.position));
  const optionsOf = Map.groupBy(options, (o) => o.quoteId);

  return rows.map(({ quote, client, property }): QuoteSummary => {
    const offered = optionsOf.get(quote.id) ?? [];
    const plan = quote.kind === "service_plan";
    return {
      id: quote.id,
      quoteRequestId: quote.quoteRequestId,
      kind: quote.kind,
      status: statusOf(quote),
      client,
      property,
      // a one-off Quote leads with its Deep Clean; a Service Plan Quote with
      // a clean on each of its weekdays
      headlineTotalCents: plan
        ? offered.reduce((total, o) => total + o.totalCents, 0)
        : offered.find((o) => o.cleanType === "deep")!.totalCents,
      plan: plan
        ? {
            recurrence: quote.recurrence!,
            days: offered.map((o) => ({
              startsAt: o.startsAt?.toISOString() ?? null,
              cleanType: o.cleanType,
            })),
          }
        : null,
      proposedStartsAt: quote.proposedStartsAt?.toISOString() ?? null,
      sentAt: quote.sentAt?.toISOString() ?? null,
      expiresAt: quote.expiresAt?.toISOString() ?? null,
      createdAt: quote.createdAt.toISOString(),
    };
  });
};

// every Quote answering a request, newest first, Drafts included (for the
// Office)
export const quotesForRequest = (quoteRequestId: string) =>
  summaries(eq(quotes.quoteRequestId, quoteRequestId));

// a Client's own Quotes, newest first; Drafts are never shown to them
export const quotesForClient = (clientId: string) =>
  summaries(and(eq(properties.clientId, clientId), ne(quotes.status, "draft")));

// every Quote for a Property, newest first, Drafts included (for the Office)
export const quotesForProperty = (propertyId: string) =>
  summaries(eq(quotes.propertyId, propertyId));

// every Sent Quote still open (not yet Expired), newest first
export const openQuotes = () =>
  summaries(and(eq(quotes.status, "sent"), gt(quotes.expiresAt, clock.now())));

// Sent Quotes that Expire within this many hours, soonest first
export const quotesExpiringWithin = async (hours: number) => {
  const now = clock.now();
  const until = new Date(now.getTime() + hours * 3_600_000);
  const expiring = await summaries(
    and(
      eq(quotes.status, "sent"),
      gt(quotes.expiresAt, now),
      lte(quotes.expiresAt, until),
    ),
  );
  return expiring.sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!));
};
