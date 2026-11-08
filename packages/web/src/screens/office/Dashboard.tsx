import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import type {
  NeedsAttentionItem,
  NeedsAttentionKind,
} from "@empire-cleaning/models";
import {
  CalendarClock,
  CalendarX,
  CircleDollarSign,
  CirclePause,
  ClipboardList,
  Hourglass,
  Receipt,
  Repeat,
  UserX,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  CountTile,
  CountTiles,
  Heading,
  IconTile,
  List,
  ListItem,
  Section,
  type StatusTone,
} from "@empire-cleaning/ui";
import { JobIcon, QuoteIcon } from "../icons.ts";
import { billWeek } from "../BillParts.tsx";
import {
  addressOf,
  clientName,
  formatDate,
  formatDateTime,
  formatDay,
  formatMoney,
} from "../format.ts";

// how often a Dashboard left open asks again, while it can be seen: a new
// Quote request shows within a minute (the Office is emailed of it too).
// Coming back to the tab asks at once (main.tsx)
const REFRESH_MS = 60_000;

// the Office's first screen: what's waiting on them, counted by kind (Jobs,
// Quotes, Money) above the list. The day's Jobs are on the Schedule
export function Dashboard() {
  const needsAttention = useLoaderData({ from: "/office/" });
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void router.invalidate();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex flex-col gap-8">
      <Heading level={1} inBar>
        Today
      </Heading>
      <NeedsAttention items={needsAttention} />
    </div>
  );
}

// a row leads with what the Office should do; the icon says what kind of
// item it is, and who it's for comes first in the description
type Row = {
  key: string;
  action: string;
  icon: LucideIcon;
  tone: StatusTone;
  client: string;
  description: string;
  open: () => void;
};

// the tiles over the list: which part of the work each kind of item is
// in, so a long list reads as a few numbers first
type Tile = "jobs" | "quotes" | "money";
const tileOf: Record<NeedsAttentionKind, Tile> = {
  job_unassigned: "jobs",
  reschedule_requested: "jobs",
  adjustments_reported: "jobs",
  plan_visit_unplaced: "jobs",
  quote_requested: "quotes",
  quote_expiring: "quotes",
  quote_no_room: "quotes",
  service_plan_due: "quotes",
  job_unpaid: "money",
  bill_unpaid: "money",
  plan_on_hold: "money",
};

// what the tiles say beside their counts: how many need cleaners, how many
// Quotes are newly asked for, and what's owed (a plan On Hold owes for Jobs
// and Bills already counted)
const hintsFor = (items: NeedsAttentionItem[]): Record<Tile, string> => {
  const count = (kind: NeedsAttentionKind) =>
    items.filter((item) => item.kind === kind).length;
  const owedCents = items.reduce(
    (sum, item) =>
      sum +
      (item.kind === "job_unpaid"
        ? item.owedCents
        : item.kind === "bill_unpaid"
          ? item.bill.totalCents
          : 0),
    0,
  );
  const unassigned = count("job_unassigned");
  const asked = count("quote_requested");
  return {
    jobs: unassigned > 0 ? `${unassigned} need cleaners` : "",
    quotes: asked > 0 ? `${asked} asked for` : "",
    money: owedCents > 0 ? `${formatMoney(owedCents)} owed` : "",
  };
};

const tiles: { id: Tile; label: string; icon: LucideIcon }[] = [
  { id: "jobs", label: "Jobs", icon: JobIcon },
  { id: "quotes", label: "Quotes", icon: QuoteIcon },
  { id: "money", label: "Money", icon: CircleDollarSign },
];

function NeedsAttention({ items }: { items: NeedsAttentionItem[] }) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState<Tile | null>(null);
  const countOf = (tile: Tile) =>
    items.filter((item) => tileOf[item.kind] === tile).length;
  // a kind cleared while picked (the list refreshes) shows everything again
  const only = picked && countOf(picked) > 0 ? picked : null;
  const shown = only
    ? items.filter((item) => tileOf[item.kind] === only)
    : items;
  const hints = hintsFor(items);

  // how each kind of item reads, and where it opens; tickets adding a kind
  // add its case here
  const rowFor = (item: NeedsAttentionItem): Row => {
    switch (item.kind) {
      case "quote_requested": {
        const { quote } = item;
        return {
          key: `quote_requested ${quote.id}`,
          action: "Send a Quote",
          icon: QuoteIcon,
          tone: "info",
          client: clientName(quote.client),
          description: `${addressOf(quote.property)} · asked ${formatDate(item.since)}`,
          open: () =>
            navigate({
              to: "/office/quotes/$quoteId",
              params: { quoteId: quote.id },
            }),
        };
      }
      case "quote_expiring": {
        const { quote } = item;
        return {
          key: `quote_expiring ${quote.id}`,
          action: "Follow up before it expires",
          icon: Hourglass,
          tone: "warning",
          client: clientName(quote.client),
          description: `${addressOf(quote.property)} · expires ${formatDateTime(quote.expiresAt!)}`,
          open: () =>
            navigate({
              to: "/office/quotes/$quoteId",
              params: { quoteId: quote.id },
            }),
        };
      }
      case "quote_no_room": {
        const { quote } = item;
        return {
          key: `quote_no_room ${quote.id}`,
          action: "Pick another time for the Quote",
          icon: CalendarX,
          tone: "danger",
          client: clientName(quote.client),
          description: `${addressOf(quote.property)} · ${formatDateTime(quote.proposedStartsAt!)} is full`,
          open: () =>
            navigate({
              to: "/office/quotes/$quoteId",
              params: { quoteId: quote.id },
            }),
        };
      }
      case "job_unassigned": {
        const { job } = item;
        return {
          key: `job_unassigned ${job.id}`,
          action: "Find cleaners",
          icon: UserX,
          tone: "warning",
          client: clientName(job.client),
          description: `${addressOf(job.property)} · ${formatDateTime(job.startsAt)}`,
          open: () =>
            navigate({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            }),
        };
      }
      case "job_unpaid": {
        const { job } = item;
        return {
          key: `job_unpaid ${job.id}`,
          action: "Collect the Balance",
          icon: CircleDollarSign,
          tone: "danger",
          client: clientName(job.client),
          description: `${formatMoney(item.owedCents)} owed · ${addressOf(job.property)} · ${formatDate(job.startsAt)}`,
          open: () =>
            navigate({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            }),
        };
      }
      case "reschedule_requested": {
        const { job, request } = item;
        return {
          key: `reschedule_requested ${request.id}`,
          action: "Confirm or turn down the new time",
          icon: CalendarClock,
          tone: "warning",
          client: clientName(job.client),
          description: `${addressOf(job.property)} · ${formatDateTime(request.fromStartsAt)} to ${formatDateTime(request.startsAt)}`,
          open: () =>
            navigate({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            }),
        };
      }
      case "adjustments_reported": {
        const { job } = item;
        return {
          key: `adjustments_reported ${job.id}`,
          action: "Review extras Staff reported",
          icon: ClipboardList,
          tone: "info",
          client: clientName(job.client),
          description: `${item.count === 1 ? "1 extra" : `${item.count} extras`} to review · ${addressOf(job.property)} · ${formatDate(job.startsAt)}`,
          open: () =>
            navigate({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            }),
        };
      }
      case "service_plan_due": {
        const { job } = item;
        return {
          key: `service_plan_due ${job.id}`,
          action: "Quote a Service Plan",
          icon: Repeat,
          tone: "info",
          client: clientName(job.client),
          description: `${addressOf(job.property)} · First Clean done ${formatDate(item.since)}, wants regular visits`,
          // the home's page: its Service Plan, its history beside it
          open: () =>
            navigate({
              to: "/office/properties/$propertyId",
              params: { propertyId: job.property.id },
            }),
        };
      }
      case "plan_visit_unplaced": {
        const { plan, visit } = item;
        return {
          key: `plan_visit_unplaced ${visit.id}`,
          action: "Book the visit or skip it",
          icon: CalendarX,
          tone: "danger",
          client: clientName(plan.client),
          description: `${addressOf(plan.property)} · Service Plan visit on ${formatDay(visit.dueOn)}: no room that day`,
          open: () =>
            navigate({
              to: "/office/service-plans/$planId",
              params: { planId: plan.id },
            }),
        };
      }
      case "bill_unpaid": {
        const { bill } = item;
        return {
          key: `bill_unpaid ${bill.id}`,
          action: "Collect the Bill",
          icon: Receipt,
          tone: "danger",
          client: clientName(bill.client),
          description: `Bill ${bill.number} · ${formatMoney(bill.totalCents)} · ${billWeek(bill)}`,
          open: () =>
            navigate({
              to: "/office/bills/$billId",
              params: { billId: bill.id },
            }),
        };
      }
      case "plan_on_hold": {
        const { plan } = item;
        const unpaid = [
          item.owedCents > 0 && `${formatMoney(item.owedCents)} Unpaid`,
          item.bills.length > 0 && `Bill ${item.bills.join(" and ")} Unpaid`,
        ]
          .filter(Boolean)
          .join(", ");
        return {
          key: `plan_on_hold ${plan.id}`,
          action: "Collect what's owed to resume the plan",
          icon: CirclePause,
          tone: "warning",
          client: clientName(plan.client),
          description: `${addressOf(plan.property)} · Service Plan: ${unpaid}, no new Jobs booked`,
          open: () =>
            navigate({
              to: "/office/service-plans/$planId",
              params: { planId: plan.id },
            }),
        };
      }
    }
  };

  return (
    <Section
      title="Needs attention"
      description={only && `Only ${tiles.find((t) => t.id === only)!.label}`}
      actions={
        only && (
          <Button variant="text" size="sm" onPress={() => setPicked(null)}>
            Show all {items.length}
          </Button>
        )
      }
    >
      <CountTiles
        label="Needs attention by kind"
        selected={only}
        onSelect={(tile) => setPicked(tile as Tile | null)}
      >
        {tiles.map((tile) => (
          <CountTile
            key={tile.id}
            id={tile.id}
            icon={tile.icon}
            label={tile.label}
            count={countOf(tile.id)}
            hint={hints[tile.id] || undefined}
          />
        ))}
      </CountTiles>
      <List
        aria-label="Needs attention"
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">
            Nothing needs you right now. When a Client asks for a Quote or a new
            time, or a Job needs a Cleaner, it shows up here.
          </p>
        )}
      >
        {shown.map(rowFor).map((row) => (
          <ListItem
            key={row.key}
            id={row.key}
            textValue={`${row.action} ${row.client}`}
            title={row.action}
            description={
              <>
                <span className="font-semibold text-fg">{row.client}</span>
                {" · "}
                {row.description}
              </>
            }
            start={<IconTile icon={row.icon} tone={row.tone} />}
            onAction={row.open}
          />
        ))}
      </List>
    </Section>
  );
}
