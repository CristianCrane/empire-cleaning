import type { NeedsAttentionItem } from "@empire-cleaning/models";
import { quoteRequestsAwaitingQuote } from "../quote-requests/quote-requests.ts";
import { quotesExpiringWithin } from "../quotes/quote-state.ts";

type Source = () => Promise<NeedsAttentionItem[]>;

const quoteRequests: Source = async () =>
  (await quoteRequestsAwaitingQuote()).map((quoteRequest) => ({
    kind: "quote_request",
    since: quoteRequest.createdAt,
    quoteRequest,
  }));

// Sent Quotes Expiring within 48 hours, soonest first; each counts from when
// it came within 48 hours
const EXPIRING_HOURS = 48;
const expiringQuotes: Source = async () =>
  (await quotesExpiringWithin(EXPIRING_HOURS)).map((quote) => ({
    kind: "quote_expiring",
    since: new Date(
      Math.max(
        Date.parse(quote.sentAt!),
        Date.parse(quote.expiresAt!) - EXPIRING_HOURS * 3_600_000,
      ),
    ).toISOString(),
    quote,
  }));

// Where each kind of item comes from, in the order the Office should deal
// with them. A ticket adding a kind adds its type to NeedsAttentionItem and
// its source here; each source returns its own items in the order to deal
// with them.
const sources: Source[] = [quoteRequests, expiringQuotes];

// everything waiting on the Office, a kind at a time
export const needsAttention = async (): Promise<NeedsAttentionItem[]> =>
  (await Promise.all(sources.map((source) => source()))).flat();
