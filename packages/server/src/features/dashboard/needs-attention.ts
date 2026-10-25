import type { NeedsAttentionItem } from "@empire-cleaning/models";
import { quoteRequestsAwaitingQuote } from "../quote-requests/quote-requests.ts";

type Source = () => Promise<NeedsAttentionItem[]>;

const quoteRequests: Source = async () =>
  (await quoteRequestsAwaitingQuote()).map((quoteRequest) => ({
    kind: "quote_request",
    since: quoteRequest.createdAt,
    quoteRequest,
  }));

// Where each kind of item comes from, in the order the Office should deal
// with them. A ticket adding a kind adds its type to NeedsAttentionItem and
// its source here; each source returns its own items, oldest first.
const sources: Source[] = [quoteRequests];

// everything waiting on the Office, a kind at a time
export const needsAttention = async (): Promise<NeedsAttentionItem[]> =>
  (await Promise.all(sources.map((source) => source()))).flat();
