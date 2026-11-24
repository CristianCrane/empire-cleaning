import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { QuoteSummary } from "@empire-cleaning/models";
import { DAY_MS } from "@empire-cleaning/models";
import { QuoteIcon } from "../icons.ts";
import { Line, ListPage, StatusBadge } from "@empire-cleaning/ui";
import { DraftChangesBadge, QuoteStatusBadge } from "../QuoteParts.tsx";
import {
  addressOf,
  clientName,
  quoteStatusLabel,
  screenWords,
} from "../format.ts";
import { NEW_QUOTE } from "./NewQuoteScreen.tsx";
import { linkTo } from "../../links.ts";
import { tabShown, useListUrl } from "../list-search.ts";

const { quoteTotal, serviceNamed } = screenWords.en;

// the statuses the list holds, a Tab each, in the order a Quote moves
// through them
export const quoteTabs = ["requested", "draft", "sent", "expired"] as const;
type ListStatus = (typeof quoteTabs)[number];

type SortColumn = "client" | "status" | "total" | "waiting";
type Sort = { column: SortColumn; direction: "ascending" | "descending" };

// how long since it was asked for (or offered): "today", "3 days", or on
// a phone's row, with no column over it, the Table's header with its cell,
// "waiting since today", "waiting 3 days"
const waiting = (quote: QuoteSummary, row = false) => {
  const days = Math.floor((Date.now() - Date.parse(quote.createdAt)) / DAY_MS);
  const since = days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
  return !row ? since : days === 0 ? "waiting since today" : `waiting ${since}`;
};

// what it's a Quote of: a Service Plan of the Service its cleans are, or
// the Service its total is for, its Revision's own (the one asked for,
// unless the Office changed it) or, once Accepted, the one booked; the
// Service asked for until it has a total
const serviceOf = (quote: QuoteSummary) =>
  serviceNamed(
    quote.headlineServiceName ?? quote.service.name,
    quote.kind === "service_plan",
  );

// the words a search looks through: who, where, and what, both the
// Service it's for and the one asked, as the caller may name it
const searchable = (quote: QuoteSummary) =>
  [
    quote.client.name,
    quote.client.businessName,
    addressOf(quote.property),
    serviceOf(quote),
    quote.service.name,
  ]
    .join(" ")
    .toLowerCase();

const sortKey = (quote: QuoteSummary, column: SortColumn) => {
  switch (column) {
    case "client":
      return clientName(quote.client).toLowerCase();
    case "status":
      return quoteTabs.indexOf(quote.status as ListStatus);
    case "total":
      return quote.headlineTotalCents ?? -1;
    case "waiting":
      // the longest waiting is the oldest
      return Date.parse(quote.createdAt);
  }
};

// The Office's open Quotes (#433), a List: a Tab per status, Requested,
// Draft and Sent, and those Expired lately, which may be revived. Closed
// ones are on their Client's and Property's pages, so the list stays the
// size of the work in hand, and loads whole. A search by Client or address
// looks through every Tab. From md it's a Table, sorted longest waiting
// first until a column says otherwise. A New Quote is for someone who
// phones (#34).
export function QuotesScreen() {
  const quotes = useLoaderData({ from: "/office/quotes" });
  const url = useListUrl<ListStatus>();
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>({
    column: "waiting",
    direction: "ascending",
  });

  const count = (s: ListStatus) =>
    quotes.filter((quote) => quote.status === s).length;
  const tab = tabShown(quoteTabs, url.tab, count);
  const words = url.q.toLowerCase().split(/\s+/).filter(Boolean);
  const found = quotes.filter((quote) => {
    const haystack = searchable(quote);
    return words.every((word) => haystack.includes(word));
  });
  const shown = (url.q ? found : quotes.filter((q) => q.status === tab)).sort(
    (a, b) => {
      const [x, y] = [sortKey(a, sort.column), sortKey(b, sort.column)];
      const by = x < y ? -1 : x > y ? 1 : 0;
      return sort.direction === "descending" ? -by : by;
    },
  );

  return (
    <ListPage
      title="Quotes"
      primary={{
        label: NEW_QUOTE,
        icon: QuoteIcon,
        href: linkTo({ to: "/office/quotes/new" }),
      }}
      tabs={quoteTabs.map((s) => ({
        id: s,
        label: quoteStatusLabel[s],
        count: count(s),
        none: `No ${quoteStatusLabel[s].toLowerCase()} quotes.`,
      }))}
      tab={tab}
      onTabChange={url.onTabChange}
      search={{
        label: "Search quotes",
        placeholder: "Client, business or address",
        query: url.q,
        onSearch: url.onSearch,
        found: found.length,
      }}
      items={shown}
      row={(quote) => ({
        id: quote.id,
        title: clientName(quote.client),
        // the Table's cells, in its order, as one line
        description: (
          <Line
            parts={[
              addressOf(quote.property),
              // a Service and its price, one part: "Standard Clean $194.89"
              [serviceOf(quote), quoteTotal(quote)].filter(Boolean).join(" "),
              waiting(quote, true),
            ]}
          />
        ),
        // its Tab says it, but a search across them doesn't
        status: {
          badge: <QuoteStatusBadge status={quote.status} />,
          plain: true,
        },
        badges: [
          quote.siteVisit === "needed" && (
            <StatusBadge key="needed" tone="warning">
              Needs a site visit
            </StatusBadge>
          ),
          quote.siteVisit === "booked" && (
            <StatusBadge key="booked" tone="info">
              Site visit booked
            </StatusBadge>
          ),
          quote.drafting &&
            (quote.status === "sent" || quote.status === "expired") && (
              <DraftChangesBadge key="draft" />
            ),
        ],
        onOpen: () =>
          void navigate({
            to: "/office/quotes/$quoteId",
            params: { quoteId: quote.id },
          }),
      })}
      columns={[
        {
          id: "client",
          label: "Client",
          allowsSorting: true,
          cell: (quote) => clientName(quote.client),
        },
        {
          id: "property",
          label: "Address",
          // a laptop window at half width keeps what the list is judged by,
          // the clean, its price and its wait, before where
          from: "lg",
          cell: (quote) => addressOf(quote.property),
        },
        { id: "service", label: "Service", cell: serviceOf },
        // none is priced until it's drafted
        ...(tab === "requested" && !url.q
          ? []
          : [
              {
                id: "total",
                label: "Total",
                allowsSorting: true,
                cell: (quote: QuoteSummary) => (
                  <span className="whitespace-nowrap">
                    {quoteTotal(quote) ?? "—"}
                  </span>
                ),
              },
            ]),
        {
          id: "waiting",
          label: "Waiting",
          allowsSorting: true,
          cell: (quote) => (
            <span className="whitespace-nowrap">{waiting(quote)}</span>
          ),
        },
      ]}
      sort={{
        descriptor: sort,
        onChange: (next) => setSort(next as Sort),
      }}
      empty={{ icon: QuoteIcon, title: "No quotes yet" }}
    />
  );
}
