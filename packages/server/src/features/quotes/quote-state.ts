import { and, desc, eq, gt, inArray, lte, ne, type SQL } from "drizzle-orm";
import type {
  QuoteRequestState,
  QuoteStatus,
  QuoteSummary,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { clients } from "../clients/clients.schema.ts";
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

// where each request stands, from its latest Quote that isn't a Draft
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

  const seen = new Set<string>();
  for (const quote of sent) {
    if (seen.has(quote.quoteRequestId)) continue;
    seen.add(quote.quoteRequestId);
    const status = statusOf(quote);
    // Expired goes back to awaiting a Quote, so the Office can send another
    // without the Client asking again
    if (status === "sent") states.set(quote.quoteRequestId, "quoted");
    if (status === "declined") states.set(quote.quoteRequestId, "ended");
  }
  return states;
};

const summaries = async (where: SQL | undefined) => {
  const rows = await db
    .select({
      quote: quotes,
      client: { id: clients.id, name: clients.name },
      property: {
        id: properties.id,
        street: properties.street,
        unit: properties.unit,
        postcode: properties.postcode,
      },
      recommendedTotalCents: quoteOptions.totalCents,
    })
    .from(quotes)
    .innerJoin(quoteRequests, eq(quoteRequests.id, quotes.quoteRequestId))
    .innerJoin(clients, eq(clients.id, quoteRequests.clientId))
    .innerJoin(properties, eq(properties.id, quoteRequests.propertyId))
    .innerJoin(
      quoteOptions,
      and(
        eq(quoteOptions.quoteId, quotes.id),
        eq(quoteOptions.cleanType, "deep"),
      ),
    )
    .where(where)
    .orderBy(desc(quotes.createdAt));

  return rows.map(
    ({ quote, client, property, recommendedTotalCents }): QuoteSummary => ({
      id: quote.id,
      quoteRequestId: quote.quoteRequestId,
      status: statusOf(quote),
      client,
      property,
      recommendedTotalCents,
      proposedStartsAt: quote.proposedStartsAt?.toISOString() ?? null,
      sentAt: quote.sentAt?.toISOString() ?? null,
      expiresAt: quote.expiresAt?.toISOString() ?? null,
      createdAt: quote.createdAt.toISOString(),
    }),
  );
};

// every Quote for a request, newest first, Drafts included (for the Office)
export const quotesForRequest = (quoteRequestId: string) =>
  summaries(eq(quotes.quoteRequestId, quoteRequestId));

// a Client's Quotes, newest first; Drafts are never shown to them
export const quotesForClient = (clientId: string) =>
  summaries(
    and(eq(quoteRequests.clientId, clientId), ne(quotes.status, "draft")),
  );

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
