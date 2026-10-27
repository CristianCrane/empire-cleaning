import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import type { QuoteSummary } from "@empire-cleaning/models";
import {
  Button,
  Cell,
  Column,
  Heading,
  Row,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableHeader,
  Tabs,
  TextField,
} from "@empire-cleaning/ui";
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import {
  addressOf,
  clientName,
  formatDate,
  formatMoney,
  quoteStatusLabel,
} from "../format.ts";

// the statuses the list holds, in the order a Quote moves through them
export const quoteListStatuses = [
  "requested",
  "draft",
  "sent",
  "expired",
] as const;
type ListStatus = (typeof quoteListStatuses)[number];

export type QuotesSearch = { q?: string; status?: ListStatus };

type SortColumn = "client" | "status" | "total" | "waiting" | "expires";
type Sort = { column: SortColumn; direction: "ascending" | "descending" };

// how long typing pauses before the list follows it
const SEARCH_DELAY_MS = 250;

const DAY_MS = 24 * 60 * 60 * 1000;
// as Today's "Follow up before it expires"
const EXPIRING_MS = 2 * DAY_MS;

// how long since it was asked for (or offered): "today", "3 days"
const waiting = (quote: QuoteSummary) => {
  const days = Math.floor((Date.now() - Date.parse(quote.createdAt)) / DAY_MS);
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
};

const expiringSoon = (quote: QuoteSummary) =>
  quote.status === "sent" &&
  quote.expiresAt !== null &&
  Date.parse(quote.expiresAt) - Date.now() < EXPIRING_MS;

// the words a search looks through: who, and where
const searchable = (quote: QuoteSummary) =>
  [quote.client.name, quote.client.businessName, addressOf(quote.property)]
    .join(" ")
    .toLowerCase();

const sortKey = (quote: QuoteSummary, column: SortColumn) => {
  switch (column) {
    case "client":
      return clientName(quote.client).toLowerCase();
    case "status":
      return quoteListStatuses.indexOf(quote.status as ListStatus);
    case "total":
      return quote.headlineTotalCents ?? -1;
    case "expires":
      return quote.expiresAt ? Date.parse(quote.expiresAt) : Infinity;
    case "waiting":
      // the longest waiting is the oldest
      return Date.parse(quote.createdAt);
  }
};

// The Office's open Quotes: Requested, Draft and Sent, and those Expired
// lately, which may be revived. Closed ones are on their Client's and
// Property's pages, so the list stays the size of the work in hand. A Tab
// per status and a search by Client or address narrow it; both live in the
// URL, so coming Back from a Quote keeps them. Sorted longest waiting first
// until a column says otherwise. A New Quote is for someone who phones (#34).
export function QuotesScreen() {
  const quotes = useLoaderData({ from: "/office/quotes" });
  const { q = "", status } = useSearch({ from: "/office/quotes" });
  const navigate = useNavigate();
  const [text, setText] = useState(q);
  const [sort, setSort] = useState<Sort>({
    column: "waiting",
    direction: "ascending",
  });

  // the list follows the box once typing pauses
  useEffect(() => {
    const wanted = text.trim();
    if (wanted === q) return;
    const timer = setTimeout(
      () =>
        void navigate({
          to: "/office/quotes",
          search: (prev) => ({ ...prev, q: wanted || undefined }),
          replace: true,
        }),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [text, q, navigate]);

  // and the box follows the URL, e.g. the nav's Quotes link clearing it
  useEffect(() => {
    setText((current) => (current.trim() === q ? current : q));
  }, [q]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const found = quotes.filter((quote) => {
    const haystack = searchable(quote);
    return words.every((word) => haystack.includes(word));
  });
  const shown = found
    .filter((quote) => !status || quote.status === status)
    .sort((a, b) => {
      const [x, y] = [sortKey(a, sort.column), sortKey(b, sort.column)];
      const by = x < y ? -1 : x > y ? 1 : 0;
      return sort.direction === "descending" ? -by : by;
    });
  const count = (s?: ListStatus) =>
    s ? found.filter((quote) => quote.status === s).length : found.length;

  const table = (
    <Table
      aria-label="Open Quotes"
      sortDescriptor={sort}
      onSortChange={(next) => setSort(next as Sort)}
      onRowAction={(id) =>
        void navigate({
          to: "/office/quotes/$quoteId",
          params: { quoteId: String(id) },
        })
      }
    >
      <TableHeader>
        <Column id="client" isRowHeader allowsSorting>
          Client
        </Column>
        <Column id="property">Property</Column>
        <Column id="status" allowsSorting>
          Status
        </Column>
        <Column id="total" allowsSorting>
          Total
        </Column>
        <Column id="waiting" allowsSorting>
          Waiting
        </Column>
        <Column id="expires" allowsSorting>
          Expires
        </Column>
      </TableHeader>
      <TableBody
        items={shown}
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">
            {q
              ? `No open Quotes match “${q}”.`
              : status
                ? `No ${quoteStatusLabel[status]} Quotes.`
                : "No open Quotes."}
          </p>
        )}
      >
        {(quote) => (
          <Row id={quote.id} className="cursor-pointer">
            <Cell>
              <span className="font-semibold">{clientName(quote.client)}</span>
            </Cell>
            <Cell>{addressOf(quote.property)}</Cell>
            <Cell>
              <div className="flex flex-wrap gap-1">
                <QuoteStatusBadge status={quote.status} />
                {quote.siteVisit === "needed" && (
                  <StatusBadge tone="warning">Needs Site Visit</StatusBadge>
                )}
                {quote.siteVisit === "booked" && (
                  <StatusBadge tone="info">Site Visit booked</StatusBadge>
                )}
                {quote.drafting &&
                  (quote.status === "sent" || quote.status === "expired") && (
                    <StatusBadge tone="info">Draft changes</StatusBadge>
                  )}
              </div>
            </Cell>
            <Cell className="whitespace-nowrap">
              {quote.headlineTotalCents === null
                ? "—"
                : formatMoney(quote.headlineTotalCents)}
            </Cell>
            <Cell className="whitespace-nowrap">{waiting(quote)}</Cell>
            <Cell
              className={`whitespace-nowrap ${expiringSoon(quote) ? "font-semibold text-warning-strong" : ""}`}
            >
              {quote.expiresAt ? formatDate(quote.expiresAt) : "—"}
            </Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={1}>Quotes</Heading>
        <Button onPress={() => void navigate({ to: "/office/quotes/new" })}>
          <Phone aria-hidden size={18} />
          New Quote
        </Button>
      </div>
      <TextField
        label="Search Quotes"
        type="search"
        placeholder="Client, business or address"
        value={text}
        onChange={setText}
      />
      <Tabs
        selectedKey={status ?? "all"}
        onSelectionChange={(key) =>
          void navigate({
            to: "/office/quotes",
            search: (prev) => ({
              ...prev,
              status: key === "all" ? undefined : (key as ListStatus),
            }),
            replace: true,
          })
        }
      >
        <TabList aria-label="Status">
          <Tab id="all" count={count()}>
            All
          </Tab>
          {quoteListStatuses.map((s) => (
            <Tab key={s} id={s} count={count(s)}>
              {quoteStatusLabel[s]}
            </Tab>
          ))}
        </TabList>
        {["all", ...quoteListStatuses].map((s) => (
          <TabPanel key={s} id={s}>
            {table}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
