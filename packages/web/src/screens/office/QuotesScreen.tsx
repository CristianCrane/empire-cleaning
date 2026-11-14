import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { QuoteSummary } from "@empire-cleaning/models";
import { DAY_MS, formats } from "@empire-cleaning/models";
import { QuoteIcon } from "../icons.ts";
import { ListPage, StatusBadge } from "@empire-cleaning/ui";
import { DraftChangesBadge, QuoteStatusBadge } from "../QuoteParts.tsx";
import { addressOf, clientName, quoteStatusLabel } from "../format.ts";
import { NEW_QUOTE } from "./NewQuoteScreen.tsx";
import { linkTo } from "../../links.ts";
import { tabShown, useListUrl } from "../list-search.ts";

const { formatMoney } = formats.en;

// the statuses the list holds, a Tab each, in the order a Quote moves
// through them
export const quoteTabs = ["requested", "draft", "sent", "expired"] as const;
type ListStatus = (typeof quoteTabs)[number];

type SortColumn = "client" | "status" | "total" | "waiting";
type Sort = { column: SortColumn; direction: "ascending" | "descending" };

// how long since it was asked for (or offered): "today", "3 days"
const waiting = (quote: QuoteSummary) => {
  const days = Math.floor((Date.now() - Date.parse(quote.createdAt)) / DAY_MS);
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
};

// what it's a Quote of: its Service, or a Service Plan of it
const serviceOf = (quote: QuoteSummary) =>
  quote.kind === "service_plan"
    ? `${quote.service.name} plan`
    : quote.service.name;

// the words a search looks through: who, where, and what
const searchable = (quote: QuoteSummary) =>
  [
    quote.client.name,
    quote.client.businessName,
    addressOf(quote.property),
    serviceOf(quote),
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
        description: `${addressOf(quote.property)} · ${serviceOf(quote)}`,
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
          label: "Property",
          cell: (quote) => addressOf(quote.property),
        },
        { id: "service", label: "Service", from: "lg", cell: serviceOf },
        {
          id: "total",
          label: "Total",
          allowsSorting: true,
          cell: (quote) => (
            <span className="whitespace-nowrap">
              {quote.headlineTotalCents === null
                ? "—"
                : formatMoney(quote.headlineTotalCents)}
            </span>
          ),
        },
        {
          id: "waiting",
          label: "Waiting",
          from: "lg",
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
