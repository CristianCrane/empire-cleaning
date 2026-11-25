import { useEffect } from "react";
import {
  useLoaderData,
  useNavigate,
  useRouteContext,
  useRouter,
} from "@tanstack/react-router";
import type {
  NeedsAttentionItem,
  NeedsAttentionKind,
  ScheduleDay,
} from "@empire-cleaning/models";
import { MINUTE_MS, formats } from "@empire-cleaning/models";
import {
  CalendarClock,
  CalendarDays,
  CalendarX,
  CircleCheck,
  CircleDollarSign,
  CirclePause,
  ClipboardList,
  Hourglass,
  Receipt,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import {
  AnswerCard,
  Button,
  HomePage,
  IconTile,
  Link,
  type HomeTile,
  type ListRow,
  type StatusTone,
  Line,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { useHomeUrl } from "../home-search.ts";
import { CrewBadge } from "../JobBadges.tsx";
import { JobIcon, NeedsCleanersIcon, QuoteIcon } from "../icons.ts";
import { billWeek } from "../BillParts.tsx";
import { addressOf, clientName, dayOfInstant } from "../format.ts";
import { QUOTE_A_PLAN } from "./StartDraft.tsx";

// a tile's hint: how many of its Jobs are Unassigned, their crew not yet
// all Confirmed
const needCleaners = (n: number) =>
  `${n} ${n === 1 ? "needs" : "need"} cleaners`;

const { formatDate, formatDateTime, formatDay, formatMoney, formatList } =
  formats.en;

// how often a Dashboard left open asks again, while it can be seen: a new
// Quote request shows within a minute (the Office is emailed of it too).
// Coming back to the tab asks at once (main.tsx)
const REFRESH_MS = MINUTE_MS;

// Today's tiles that open in place, as its URL names them
export const todayTiles = ["today", "jobs", "quotes", "money"] as const;
type Tile = (typeof todayTiles)[number];

export type TodayData = {
  needsAttention: NeedsAttentionItem[];
  // the Schedule's day, today by the server's clock
  today: ScheduleDay;
};

// the Office's first screen, a Home (docs/ux.md, Screen types): what needs
// them first, in its card, the server's first to-do (it puts them in the
// order to deal with them); then the day's Jobs, and every to-do by kind,
// Jobs, Quotes and Money, in tiles
export function Dashboard() {
  const { needsAttention, today } = useLoaderData({ from: "/office/" });
  const { account } = useRouteContext({ from: "/office" });
  const home = useHomeUrl();
  const navigate = useNavigate();
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void router.invalidate();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  const rowFor = useRowFor();
  // the tiles count every to-do, the card's too, so each kind's number is
  // all of it
  const first = needsAttention[0];
  const card = first && rowFor(first);
  const shows = tilesShow(needsAttention);
  const kind = (tile: Tile) =>
    needsAttention.filter((item) => tileOf[item.kind] === tile).map(rowFor);
  const unassigned = today.jobs.filter(
    (job) => job.assignment === "unassigned",
  ).length;

  const tiles: HomeTile[] = [
    {
      id: "today",
      icon: CalendarDays,
      label: "On today",
      count: today.jobs.length,
      hint: unassigned > 0 ? needCleaners(unassigned) : undefined,
      rows: today.jobs.map((job): ListRow => ({
        id: job.id,
        at: job.startsAt,
        title: clientName(job.client),
        description: (
          <Line
            parts={[
              job.serviceName,
              addressOf(job.property),
              formatList(job.crew.map((c) => c.name)),
            ]}
          />
        ),
        status: {
          badge: <CrewBadge assignment={job.assignment} />,
          plain: job.assignment === "assigned",
        },
        onOpen: () =>
          navigate({ to: "/office/jobs/$jobId", params: { jobId: job.id } }),
      })),
      more: (
        <Link
          className="self-start"
          href={linkTo({
            to: "/office/schedule",
            search: { from: today.date, to: today.date },
          })}
        >
          Open the Schedule
        </Link>
      ),
    },
    ...kinds.map(({ id, label, icon }) => {
      const rows = kind(id);
      return {
        id,
        icon,
        label,
        count: rows.length,
        ...shows[id],
        rows: rows.map((row): ListRow => ({
          id: row.key,
          title: row.action,
          // the Client too, as a row's name, so each to-do is told apart
          textValue: `${row.action} ${row.client}`,
          description: (
            <Line
              parts={[
                <span key="client" className="font-semibold text-fg">
                  {row.client}
                </span>,
                ...row.line,
              ]}
            />
          ),
          start: <IconTile icon={row.icon} tone={row.tone} />,
          onOpen: row.open,
        })),
      };
    }),
  ];

  return (
    <HomePage
      greet={account.name}
      answer={
        card ? (
          <AnswerCard
            tile={<IconTile icon={card.icon} tone={card.tone} size="lg" />}
            label="First up"
            headline={card.client}
            lines={[<Line key="line" parts={card.line} />]}
            actions={<Button onPress={card.open}>{card.action}</Button>}
          />
        ) : (
          <AnswerCard
            tile={<IconTile icon={CircleCheck} tone="success" size="lg" />}
            headline="Nothing needs you"
          />
        )
      }
      tilesLabel="Today at a glance"
      tiles={tiles}
      {...home}
    />
  );
}

// a row leads with what the Office should do; the icon says what kind of
// item it is, and who it's for comes first in its line, then the line's
// parts
type Row = {
  key: string;
  action: string;
  icon: LucideIcon;
  tone: StatusTone;
  client: string;
  line: string[];
  open: () => void;
};

// which tile each kind of to-do is under, so a long list reads as a few
// numbers first
type Kind = Exclude<Tile, "today">;
const tileOf: Record<NeedsAttentionKind, Kind> = {
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

// what each kind's tile says beside its count: how many need cleaners, how
// many Quotes are newly asked for; and Money's number is what's owed, its
// to-dos the hint, as the eye reads a money tile's number as money (11-20
// audit, Today 3; #507). A plan On Hold owes for Jobs and Bills already
// counted, so with plans On Hold alone nothing's owed, and it counts them
export const tilesShow = (
  items: NeedsAttentionItem[],
): Record<Kind, { value?: string; hint?: string }> => {
  const count = (kind: NeedsAttentionKind) =>
    items.filter((item) => item.kind === kind).length;
  const unassigned = count("job_unassigned");
  const asked = count("quote_requested");
  const toDo = items.filter((item) => tileOf[item.kind] === "money").length;
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
  return {
    jobs: unassigned > 0 ? { hint: needCleaners(unassigned) } : {},
    quotes: asked > 0 ? { hint: `${asked} asked for` } : {},
    money:
      owedCents > 0
        ? { value: formatMoney(owedCents), hint: `${toDo} to do` }
        : {},
  };
};

const kinds: { id: Kind; label: string; icon: LucideIcon }[] = [
  { id: "jobs", label: "Jobs", icon: JobIcon },
  { id: "quotes", label: "Quotes", icon: QuoteIcon },
  { id: "money", label: "Money", icon: CircleDollarSign },
];

// how a to-do reads, as its row and as Today's card
function useRowFor() {
  const navigate = useNavigate();

  // how each kind of item reads, and where it opens; tickets adding a kind
  // add its case here
  const rowFor = (item: NeedsAttentionItem): Row => {
    switch (item.kind) {
      case "quote_requested": {
        const { quote } = item;
        return {
          key: `quote_requested ${quote.id}`,
          action: "Send a quote",
          icon: QuoteIcon,
          tone: "info",
          client: clientName(quote.client),
          line: [addressOf(quote.property), `asked ${formatDate(item.since)}`],
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
          line: [
            addressOf(quote.property),
            `expires ${formatDateTime(quote.expiresAt)}`,
          ],
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
          action: "Pick another time for the quote",
          icon: CalendarX,
          tone: "danger",
          client: clientName(quote.client),
          line: [
            addressOf(quote.property),
            `${formatDateTime(quote.proposedStartsAt)} is full`,
          ],
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
          icon: NeedsCleanersIcon,
          tone: "warning",
          client: clientName(job.client),
          line: [addressOf(job.property), formatDateTime(job.startsAt)],
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
          action: "Collect the balance",
          icon: CircleDollarSign,
          tone: "danger",
          client: clientName(job.client),
          // which clean it's for, as the app names a day (UX review U12)
          line: [
            `${formatMoney(item.owedCents)} owed for the ${formatDay(dayOfInstant(job.startsAt))} clean`,
            addressOf(job.property),
          ],
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
          line: [
            addressOf(job.property),
            `${formatDateTime(request.fromStartsAt)} to ${formatDateTime(request.startsAt)}`,
          ],
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
          action: "Review the cleaner's price changes",
          icon: ClipboardList,
          tone: "info",
          client: clientName(job.client),
          line: [
            `${item.count === 1 ? "1 price change" : `${item.count} price changes`} to review`,
            addressOf(job.property),
            formatDate(job.startsAt),
          ],
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
          action: QUOTE_A_PLAN,
          icon: Repeat,
          tone: "info",
          client: clientName(job.client),
          line: [
            addressOf(job.property),
            `first clean done ${formatDate(item.since)}, wants regular visits`,
          ],
          // the home's page: its Service Plan, its history under it
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
          line: [
            addressOf(plan.property),
            `cleaning plan visit on ${formatDay(visit.dueOn)}: no room that day`,
          ],
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
          action: "Collect the bill",
          icon: Receipt,
          tone: "danger",
          client: clientName(bill.client),
          line: [
            `Bill ${bill.number}`,
            formatMoney(bill.totalCents),
            billWeek("en", bill),
          ],
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
          item.owedCents > 0 && `${formatMoney(item.owedCents)} unpaid`,
          item.bills.length > 0 && `bill ${formatList(item.bills)} unpaid`,
        ]
          .filter(Boolean)
          .join(", ");
        return {
          key: `plan_on_hold ${plan.id}`,
          action: "Collect what's owed to resume the plan",
          icon: CirclePause,
          tone: "warning",
          client: clientName(plan.client),
          line: [addressOf(plan.property), `cleaning plan paused: ${unpaid}`],
          open: () =>
            navigate({
              to: "/office/service-plans/$planId",
              params: { planId: plan.id },
            }),
        };
      }
    }
  };

  return rowFor;
}
