// PROTOTYPE: throwaway. Four layouts of the Office's Quotes list, on
// /office/quotes?variant=A|B|C|D. Question: which grouping, sort and filters
// let the Office see what to do next across Requested, Draft, Sent and
// recently Expired Quotes? (#103)
//   A  Current: one list, newest first, everything in badges
//   B  By next step: "Your move" / "With the Client" / "Expired lately",
//      action-first rows, oldest waiting first
//   C  Table + filters: status tabs with counts, sortable columns
//   D  Board: a column per status, left to right as a Quote moves
// With no Quotes in the database, "(sample)" Quotes fill in every case;
// those open nothing. packages/server/tests/seed-dev.ts seeds real ones.
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
type SortDescriptor = {
  column: string | number;
  direction: "ascending" | "descending";
};
import type { QuoteSummary, Weekday } from "@empire-cleaning/models";
import {
  Cell,
  Column,
  IconTile,
  List,
  ListItem,
  Row,
  Section,
  StatusBadge,
  Table,
  TableBody,
  TableHeader,
  type StatusTone,
} from "@empire-cleaning/ui";
import {
  CalendarCheck,
  FilePen,
  Hourglass,
  Inbox,
  MapPin,
  RotateCcw,
  Send,
  type LucideIcon,
} from "lucide-react";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import {
  addressOf,
  clientName,
  conditionText,
  formatDate,
  formatDateTime,
  formatMoney,
  propertySummary,
  quoteHeadline,
  wantedCleaning,
} from "../format.ts";

const variants = [
  { key: "A", name: "Current" },
  { key: "B", name: "By next step" },
  { key: "C", name: "Table + filters" },
  { key: "D", name: "Board" },
];

export function QuotesListPrototype({
  quotes: real,
  current,
}: {
  quotes: QuoteSummary[];
  current: ReactNode;
}) {
  const { variant = "A" } = useSearch({ from: "/office/quotes" });
  const navigate = useNavigate();
  const quotes = useMemo(() => (real.length > 0 ? real : samples()), [real]);
  const open = (id: string) => {
    if (id.startsWith("sample")) return;
    void navigate({
      to: "/office/quotes/$quoteId",
      params: { quoteId: id },
    });
  };

  return (
    <>
      {variant === "A" && current}
      {variant === "B" && <ByNextStep quotes={quotes} open={open} />}
      {variant === "C" && <TableWithFilters quotes={quotes} open={open} />}
      {variant === "D" && <Board quotes={quotes} open={open} />}
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onChange={(key) =>
          void navigate({
            to: "/office/quotes",
            search: { variant: key },
            replace: true,
          })
        }
      />
    </>
  );
}

// ---- shared bits ----

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (iso: string) => Date.now() - new Date(iso).getTime();
const until = (iso: string) => new Date(iso).getTime() - Date.now();

// "today", "3 days"
const age = (iso: string) => {
  const days = Math.floor(ago(iso) / DAY);
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
};

// what was asked, in a few words
const askedText = (q: QuoteSummary) =>
  q.asked
    ? q.property.kind === "commercial"
      ? wantedCleaning(q.asked)
      : conditionText(q.asked.condition)
    : "Offered unprompted";

// the Sent Quotes that expire within two days, which Today already flags
const expiringSoon = (q: QuoteSummary) =>
  q.status === "sent" && q.expiresAt !== null && until(q.expiresAt) < 2 * DAY;

type NextStep = {
  action: string;
  icon: LucideIcon;
  tone: StatusTone;
  // on the Office, or waiting on the Client
  yours: boolean;
};

const nextStep = (q: QuoteSummary): NextStep => {
  if (q.status === "requested" && q.siteVisit === "needed")
    return {
      action: "Book a Site Visit",
      icon: MapPin,
      tone: "warning",
      yours: true,
    };
  if (q.status === "requested" && q.siteVisit === "booked")
    return {
      action: "Quote after the Site Visit",
      icon: CalendarCheck,
      tone: "info",
      yours: true,
    };
  if (q.status === "requested")
    return { action: "Send a Quote", icon: Inbox, tone: "info", yours: true };
  if (q.status === "draft")
    return {
      action: "Finish and send the Draft",
      icon: FilePen,
      tone: "neutral",
      yours: true,
    };
  if (q.drafting)
    return {
      action: "Send the changes",
      icon: FilePen,
      tone: "neutral",
      yours: true,
    };
  if (expiringSoon(q))
    return {
      action: "Follow up before it expires",
      icon: Hourglass,
      tone: "warning",
      yours: true,
    };
  if (q.status === "expired")
    return {
      action: "Revive it, or let it go",
      icon: RotateCcw,
      tone: "neutral",
      yours: false,
    };
  return {
    action: "Waiting on the Client",
    icon: Send,
    tone: "info",
    yours: false,
  };
};

const sample = (q: QuoteSummary) => q.id.startsWith("sample");
const nameOf = (q: QuoteSummary) =>
  `${clientName(q.client)}${sample(q) ? " (sample)" : ""}`;

// the extra facts a status badge doesn't carry
function ExtraBadges({ quote }: { quote: QuoteSummary }) {
  return (
    <>
      {quote.homePlanId
        ? quote.asked && <StatusBadge tone="info">Plan change</StatusBadge>
        : quote.asked?.wantsRegularService && (
            <StatusBadge tone="success">Regular visits</StatusBadge>
          )}
    </>
  );
}

// ---- B: by next step ----

function ByNextStep({
  quotes,
  open,
}: {
  quotes: QuoteSummary[];
  open: (id: string) => void;
}) {
  const yours = quotes
    .filter((q) => q.status !== "expired" && nextStep(q).yours)
    // waited longest first
    .sort((a, b) => ago(b.createdAt) - ago(a.createdAt));
  const theirs = quotes
    .filter((q) => q.status === "sent" && !nextStep(q).yours)
    // soonest to expire first
    .sort((a, b) => until(a.expiresAt!) - until(b.expiresAt!));
  const expired = quotes
    .filter((q) => q.status === "expired")
    .sort((a, b) => until(b.expiresAt!) - until(a.expiresAt!));

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Your move"
        description={`${yours.length} waiting on the Office, longest waiting first`}
      >
        <List aria-label="Your move" onAction={(id) => open(String(id))}>
          {yours.map((q) => {
            const step = nextStep(q);
            return (
              <ListItem
                key={q.id}
                id={q.id}
                title={step.action}
                start={<IconTile icon={step.icon} tone={step.tone} />}
                description={[
                  nameOf(q),
                  addressOf(q.property),
                  q.status === "sent"
                    ? `expires ${formatDateTime(q.expiresAt!)}`
                    : `asked ${age(q.createdAt)} ago`,
                ].join(" · ")}
                end={
                  <div className="flex max-w-1/2 flex-wrap justify-end gap-2">
                    <ExtraBadges quote={q} />
                  </div>
                }
              />
            );
          })}
        </List>
      </Section>
      <Section
        title="With the Client"
        description="Sent, soonest to expire first"
      >
        <List aria-label="With the Client" onAction={(id) => open(String(id))}>
          {theirs.map((q) => (
            <ListItem
              key={q.id}
              id={q.id}
              title={nameOf(q)}
              description={[
                quoteHeadline(q),
                `expires ${formatDateTime(q.expiresAt!)}`,
              ].join(" · ")}
              end={<QuoteStatusBadge status={q.status} />}
            />
          ))}
        </List>
      </Section>
      <Section
        title="Expired lately"
        description="The last 30 days. Send a new Revision to revive one."
      >
        <List aria-label="Expired lately" onAction={(id) => open(String(id))}>
          {expired.map((q) => (
            <ListItem
              key={q.id}
              id={q.id}
              title={nameOf(q)}
              description={[
                quoteHeadline(q),
                `expired ${formatDate(q.expiresAt!)}`,
              ].join(" · ")}
              end={<QuoteStatusBadge status={q.status} />}
            />
          ))}
        </List>
      </Section>
    </div>
  );
}

// ---- C: table + filters ----

const filters = [
  { key: "all", label: "All" },
  { key: "requested", label: "Requested" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "expired", label: "Expired" },
] as const;
type Filter = (typeof filters)[number]["key"];

function TableWithFilters({
  quotes,
  open,
}: {
  quotes: QuoteSummary[];
  open: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortDescriptor>({
    column: "created",
    direction: "ascending",
  });
  const count = (f: Filter) =>
    f === "all" ? quotes.length : quotes.filter((q) => q.status === f).length;

  const key = (q: QuoteSummary): string | number => {
    switch (sort.column) {
      case "client":
        return clientName(q.client);
      case "status":
        return filters.findIndex((f) => f.key === q.status);
      case "total":
        return q.headlineTotalCents ?? -1;
      case "expires":
        return q.expiresAt ? new Date(q.expiresAt).getTime() : Infinity;
      default:
        return new Date(q.createdAt).getTime();
    }
  };
  const shown = quotes
    .filter((q) => filter === "all" || q.status === filter)
    .sort((a, b) => {
      const [x, y] = [key(a), key(b)];
      const by = x < y ? -1 : x > y ? 1 : 0;
      return sort.direction === "descending" ? -by : by;
    });

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Show"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold ${filter === f.key ? "border-primary text-fg" : "border-transparent text-fg-muted hover:text-fg"}`}
          >
            {f.label}
            <span className="rounded-full bg-surface-sunken px-2 text-xs">
              {count(f.key)}
            </span>
          </button>
        ))}
      </div>
      <Table
        aria-label="Quotes"
        sortDescriptor={sort}
        onSortChange={setSort}
        onRowAction={(id) => open(String(id))}
      >
        <TableHeader>
          <Column id="client" isRowHeader allowsSorting>
            Client
          </Column>
          <Column id="property">Property</Column>
          <Column id="asked">Asked</Column>
          <Column id="status" allowsSorting>
            Status
          </Column>
          <Column id="total" allowsSorting>
            Total
          </Column>
          <Column id="created" allowsSorting>
            Waiting
          </Column>
          <Column id="expires" allowsSorting>
            Expires
          </Column>
        </TableHeader>
        <TableBody
          items={shown}
          renderEmptyState={() => (
            <p className="p-6 text-center text-fg-muted">No Quotes here.</p>
          )}
        >
          {(q) => (
            <Row id={q.id} className="cursor-pointer">
              <Cell>
                <span className="font-semibold">{nameOf(q)}</span>
              </Cell>
              <Cell>
                <div className="flex flex-col">
                  <span>{addressOf(q.property)}</span>
                  <span className="text-xs text-fg-muted">
                    {propertySummary(q.property)}
                  </span>
                </div>
              </Cell>
              <Cell>
                <div className="flex flex-col items-start gap-1">
                  <span>{askedText(q)}</span>
                  <div className="flex flex-wrap gap-1">
                    <ExtraBadges quote={q} />
                  </div>
                </div>
              </Cell>
              <Cell>
                <div className="flex flex-wrap gap-1">
                  <QuoteStatusBadge status={q.status} />
                  {q.siteVisit === "needed" && (
                    <StatusBadge tone="warning">Needs Site Visit</StatusBadge>
                  )}
                  {q.siteVisit === "booked" && (
                    <StatusBadge tone="info">Site Visit booked</StatusBadge>
                  )}
                  {q.drafting && q.status !== "draft" && (
                    <StatusBadge tone="info">Draft changes</StatusBadge>
                  )}
                </div>
              </Cell>
              <Cell className="whitespace-nowrap">
                {q.headlineTotalCents === null
                  ? "—"
                  : formatMoney(q.headlineTotalCents)}
              </Cell>
              <Cell className="whitespace-nowrap">{age(q.createdAt)}</Cell>
              <Cell
                className={`whitespace-nowrap ${expiringSoon(q) ? "font-semibold text-warning-strong" : ""}`}
              >
                {q.expiresAt ? formatDate(q.expiresAt) : "—"}
              </Cell>
            </Row>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- D: board ----

const lanes = [
  { status: "requested", title: "Requested", hint: "Asked for, not quoted" },
  { status: "draft", title: "Draft", hint: "Being written" },
  { status: "sent", title: "Sent", hint: "With the Client" },
  { status: "expired", title: "Expired lately", hint: "May be revived" },
] as const;

function Board({
  quotes,
  open,
}: {
  quotes: QuoteSummary[];
  open: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {lanes.map((lane) => {
        const inLane = quotes
          .filter((q) => q.status === lane.status)
          .sort((a, b) => ago(b.createdAt) - ago(a.createdAt));
        return (
          <section
            key={lane.status}
            aria-label={lane.title}
            className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-3"
          >
            <header className="flex flex-col px-1">
              <h2 className="font-display text-lg font-bold">
                {lane.title} ({inLane.length})
              </h2>
              <span className="text-sm text-fg-muted">{lane.hint}</span>
            </header>
            {inLane.map((q) => {
              const step = nextStep(q);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => open(q.id)}
                  className="flex flex-col gap-1 rounded-md border border-border bg-surface p-3 text-left hover:border-border-strong"
                >
                  <span className="font-semibold">{nameOf(q)}</span>
                  <span className="text-sm text-fg-muted">
                    {addressOf(q.property)}
                  </span>
                  <span className="text-sm">
                    {q.status === "requested" ? askedText(q) : quoteHeadline(q)}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {step.yours && (
                      <StatusBadge tone={step.tone}>{step.action}</StatusBadge>
                    )}
                    <ExtraBadges quote={q} />
                  </div>
                  <span className="text-xs text-fg-muted">
                    {q.status === "sent" || q.status === "expired"
                      ? `${q.status === "sent" ? "expires" : "expired"} ${formatDate(q.expiresAt!)}`
                      : `asked ${age(q.createdAt)} ago`}
                  </span>
                </button>
              );
            })}
            {inLane.length === 0 && (
              <p className="p-3 text-center text-sm text-fg-muted">None</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---- sample Quotes, one for each case ----

function samples(): QuoteSummary[] {
  const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
  const home = (
    n: number,
    street: string,
    type: "house" | "apartment" | "townhouse",
    bedrooms: number,
  ) => ({
    id: `sample-property-${n}`,
    kind: "residential" as const,
    street,
    unit: null,
    postcode: "10001",
    floorArea: null,
    condition: null,
    accessInstructions: null,
    type,
    bedrooms,
    bathrooms: 1,
    storeys: 1,
    pets: false,
  });
  const office = (n: number, street: string, area: number | null) => ({
    id: `sample-property-${n}`,
    kind: "commercial" as const,
    street,
    unit: null,
    postcode: "10002",
    floorArea: area,
    condition: null,
    accessInstructions: null,
    premisesType: { key: "office", name: "Office" },
  });
  const asked = (over: Partial<NonNullable<QuoteSummary["asked"]>> = {}) => ({
    condition: "moderate" as const,
    wantsRegularService: false,
    weekdays: [],
    preferredTime: null,
    notes: null,
    addOns: [],
    ...over,
  });
  const base = (n: number, name: string, business: string | null = null) => ({
    id: `sample-${n}`,
    kind: "one_off" as const,
    origin: "client" as const,
    client: { id: `sample-client-${n}`, name, businessName: business },
    homePlanId: null,
    plan: null,
    proposedStartsAt: null,
    sentAt: null,
    drafting: false,
    siteVisit: null,
  });

  return [
    {
      ...base(1, "Priya Shah"),
      status: "requested",
      asked: asked({ condition: "heavy" }),
      property: home(1, "12 Elm St", "house", 3),
      headlineTotalCents: null,
      expiresAt: null,
      createdAt: at(-3),
    },
    {
      ...base(2, "Dana Ortiz", "Ortiz Dental"),
      status: "requested",
      siteVisit: "needed",
      asked: asked({
        condition: null,
        wantsRegularService: true,
        weekdays: [1, 4] as Weekday[],
        preferredTime: "18:00",
      }),
      property: office(2, "400 Market St", null),
      headlineTotalCents: null,
      expiresAt: null,
      createdAt: at(-5),
    },
    {
      ...base(3, "Lee Park", "Park & Co Law"),
      status: "requested",
      siteVisit: "booked",
      asked: asked({ condition: null }),
      property: office(3, "88 Broad St", 2400),
      headlineTotalCents: null,
      expiresAt: null,
      createdAt: at(-2),
    },
    {
      ...base(4, "Tom Becker"),
      status: "requested",
      asked: asked({ condition: "light", wantsRegularService: true }),
      property: home(4, "7 Birch Ave", "apartment", 1),
      headlineTotalCents: null,
      expiresAt: null,
      createdAt: at(0),
    },
    {
      ...base(5, "Ana Lima"),
      origin: "caller",
      status: "draft",
      drafting: true,
      asked: asked(),
      property: home(5, "31 Cedar Ct", "townhouse", 2),
      headlineTotalCents: 28950,
      expiresAt: null,
      createdAt: at(-1),
    },
    {
      ...base(6, "Sam Ng"),
      status: "sent",
      asked: asked(),
      property: home(6, "5 Oak Ln", "house", 4),
      headlineTotalCents: 39104,
      sentAt: at(-6),
      expiresAt: at(1),
      createdAt: at(-8),
    },
    {
      ...base(7, "Jo Wright"),
      status: "sent",
      asked: asked({ condition: "light" }),
      property: home(7, "220 Pine St", "apartment", 2),
      headlineTotalCents: 21480,
      sentAt: at(-2),
      expiresAt: at(5),
      createdAt: at(-4),
    },
    {
      ...base(8, "Max Rivera"),
      kind: "service_plan",
      origin: "office",
      status: "sent",
      drafting: true,
      homePlanId: null,
      asked: null,
      plan: {
        recurrence: "fortnightly",
        days: [{ startsAt: at(9), cleanType: "standard" }],
      },
      property: home(8, "19 Maple Dr", "house", 3),
      headlineTotalCents: 20185,
      sentAt: at(-3),
      expiresAt: at(4),
      createdAt: at(-3),
    },
    {
      ...base(9, "Kim Osei"),
      status: "sent",
      homePlanId: "sample-plan",
      asked: asked(),
      property: home(9, "3 Willow Way", "house", 2),
      headlineTotalCents: 31200,
      sentAt: at(-1),
      expiresAt: at(6),
      createdAt: at(-2),
    },
    {
      ...base(10, "Ruth Adler"),
      status: "expired",
      asked: asked({ condition: "heavy" }),
      property: home(10, "64 Spruce Rd", "house", 5),
      headlineTotalCents: 52990,
      sentAt: at(-16),
      expiresAt: at(-9),
      createdAt: at(-18),
    },
    {
      ...base(11, "Chris Vo", "Vo Bakery"),
      status: "expired",
      asked: asked({ condition: null }),
      property: office(11, "9 Mill St", 1200),
      headlineTotalCents: 44000,
      sentAt: at(-25),
      expiresAt: at(-20),
      createdAt: at(-27),
    },
  ];
}
