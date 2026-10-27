// PROTOTYPE: throwaway. Four ways to tell Needs attention items apart, on
// /office?variant=A|B|C|D. Question: how does the Office see at a glance
// what each item is, and what it asks of them?
//   A  Current: every row alike, the kind only in the trailing badge
//   B  Grouped by kind: a small heading and count per kind, no badges
//   C  Action first: a coloured icon, and the row's title says what to do
//   D  Work areas: Sales / Schedule / Money filters, icon on each row
// Kinds missing from the real data are filled in with "(sample)" rows so
// every kind can be compared; those rows open nothing.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { NeedsAttentionKind } from "@empire-cleaning/models";
import {
  Heading,
  List,
  ListItem,
  Section,
  StatusBadge,
  type StatusTone,
} from "@empire-cleaning/ui";
import {
  CalendarClock,
  CalendarX,
  CircleDollarSign,
  CirclePause,
  ClipboardList,
  Hourglass,
  Inbox,
  Receipt,
  Repeat,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import type { Row } from "./Dashboard.tsx";

const variants = [
  { key: "A", name: "Current" },
  { key: "B", name: "Grouped by kind" },
  { key: "C", name: "Action first" },
  { key: "D", name: "Work areas" },
];

type Area = "Sales" | "Schedule" | "Money";

// what each kind is called, what it asks the Office to do, and how it looks;
// in the order the kinds are grouped
const kinds: Record<
  NeedsAttentionKind,
  {
    label: string;
    plural: string;
    action: string;
    icon: LucideIcon;
    tone: StatusTone;
    area: Area;
  }
> = {
  quote_request: {
    label: "Quote Request",
    plural: "Quote Requests",
    action: "Send a Quote",
    icon: Inbox,
    tone: "info",
    area: "Sales",
  },
  quote_expiring: {
    label: "Quote expiring",
    plural: "Quotes expiring",
    action: "Follow up before it expires",
    icon: Hourglass,
    tone: "warning",
    area: "Sales",
  },
  service_plan_due: {
    label: "Offer a Service Plan",
    plural: "Service Plans to offer",
    action: "Offer a Service Plan",
    icon: Repeat,
    tone: "info",
    area: "Sales",
  },
  quote_no_room: {
    label: "Quote needs another time",
    plural: "Quotes needing another time",
    action: "Pick another time for the Quote",
    icon: CalendarX,
    tone: "danger",
    area: "Schedule",
  },
  job_unassigned: {
    label: "Unassigned",
    plural: "Unassigned Jobs",
    action: "Assign Staff",
    icon: UserX,
    tone: "warning",
    area: "Schedule",
  },
  reschedule_requested: {
    label: "Reschedule Request",
    plural: "Reschedule Requests",
    action: "Confirm or turn down the new time",
    icon: CalendarClock,
    tone: "warning",
    area: "Schedule",
  },
  plan_visit_unplaced: {
    label: "Plan visit needs another time",
    plural: "Plan visits needing another time",
    action: "Book the visit or skip it",
    icon: CalendarX,
    tone: "danger",
    area: "Schedule",
  },
  job_unpaid: {
    label: "Unpaid Job",
    plural: "Unpaid Jobs",
    action: "Collect the Balance",
    icon: CircleDollarSign,
    tone: "danger",
    area: "Money",
  },
  bill_unpaid: {
    label: "Unpaid Bill",
    plural: "Unpaid Bills",
    action: "Collect the Bill",
    icon: Receipt,
    tone: "danger",
    area: "Money",
  },
  plan_on_hold: {
    label: "On Hold",
    plural: "Service Plans On Hold",
    action: "Collect what's owed to resume the plan",
    icon: CirclePause,
    tone: "warning",
    area: "Money",
  },
  adjustments_reported: {
    label: "Adjustments",
    plural: "Adjustments to review",
    action: "Review extras Staff reported",
    icon: ClipboardList,
    tone: "info",
    area: "Money",
  },
};

const order = Object.keys(kinds) as NeedsAttentionKind[];

const samples: Record<
  NeedsAttentionKind,
  { title: string; description: string }
> = {
  quote_request: {
    title: "Maria Lopez",
    description: "41-12 Austin St · asked Oct 26",
  },
  quote_expiring: {
    title: "Dev Patel",
    description: "88 Grand St · expires Oct 28, 9:00 AM",
  },
  service_plan_due: {
    title: "Ana Ruiz",
    description: "12 Elm Ave · First Clean done Oct 24, wants regular visits",
  },
  quote_no_room: {
    title: "Ben Cole",
    description: "7 Park Pl · Oct 29, 10:00 AM is full",
  },
  job_unassigned: {
    title: "Cleo Hart",
    description: "301 Main St · Oct 28, 1:00 PM",
  },
  reschedule_requested: {
    title: "Sam Ito",
    description: "5 Bay Rd · Oct 30, 9:00 AM to Oct 31, 11:00 AM",
  },
  plan_visit_unplaced: {
    title: "Lee Park",
    description:
      "19 Oak St · Service Plan visit on Fri, Oct 30: no room that day",
  },
  job_unpaid: {
    title: "Nina Gold",
    description: "$184.00 owed · 22 Pine St · Oct 23",
  },
  bill_unpaid: {
    title: "Acme Offices",
    description: "Bill B-0012 · $1,240.00 · week of Oct 19",
  },
  plan_on_hold: {
    title: "Ravi Shah",
    description: "40 Hill Rd · Service Plan: $96.00 Unpaid, no new Jobs booked",
  },
  adjustments_reported: {
    title: "Jo March",
    description: "2 extras to review · 8 River St · Oct 26",
  },
};

type Item = Row & { kind: NeedsAttentionKind; sample?: boolean };

// real rows, plus a sample of each kind the real data lacks
function withSamples(rows: Row[]): Item[] {
  const real: Item[] = rows.map((row) => ({
    ...row,
    kind: row.key.split(" ")[0] as NeedsAttentionKind,
  }));
  const present = new Set(real.map((item) => item.kind));
  const fake: Item[] = order
    .filter((kind) => !present.has(kind))
    .map((kind) => ({
      kind,
      sample: true,
      key: `${kind} sample`,
      title: `${samples[kind].title} (sample)`,
      description: samples[kind].description,
      badge: (
        <StatusBadge tone={kinds[kind].tone}>{kinds[kind].label}</StatusBadge>
      ),
      open: () => {},
    }));
  return [...real, ...fake];
}

export function AttentionItemsPrototype({ rows }: { rows: Row[] }) {
  const { variant = "A" } = useSearch({ from: "/office/" });
  const navigate = useNavigate({ from: "/office/" });
  const items = withSamples(rows);

  return (
    <>
      <Section title="Needs attention" description={`${items.length} items`}>
        {variant === "A" && <VariantA items={items} />}
        {variant === "B" && <VariantB items={items} />}
        {variant === "C" && <VariantC items={items} />}
        {variant === "D" && <VariantD items={items} />}
      </Section>
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onChange={(key) =>
          navigate({ search: { variant: key }, replace: true })
        }
      />
    </>
  );
}

type VariantProps = { items: Item[] };

// a kind's icon on a tile in its tone
function KindIcon({ kind }: { kind: NeedsAttentionKind }) {
  const { icon: Icon, tone } = kinds[kind];
  const tint: Record<StatusTone, string> = {
    neutral: "bg-neutral-subtle text-neutral-strong",
    info: "bg-info-subtle text-info-strong",
    success: "bg-success-subtle text-success-strong",
    warning: "bg-warning-subtle text-warning-strong",
    danger: "bg-danger-subtle text-danger-strong",
  };
  return (
    <span
      aria-hidden
      className={`flex size-10 shrink-0 items-center justify-center rounded-md ${tint[tone]}`}
    >
      <Icon size={20} />
    </span>
  );
}

// A: today's rows as they are
function VariantA({ items }: VariantProps) {
  return (
    <List aria-label="Needs attention">
      {items.map((item) => (
        <ListItem
          key={item.key}
          id={item.key}
          title={item.title}
          description={item.description}
          end={item.badge}
          onAction={item.open}
        />
      ))}
    </List>
  );
}

// B: one small heading per kind, so the kind is said once for all its rows
function VariantB({ items }: VariantProps) {
  const groups = order
    .map((kind) => ({ kind, items: items.filter((i) => i.kind === kind) }))
    .filter((group) => group.items.length > 0);
  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ kind, items }) => {
        const { icon: Icon, plural } = kinds[kind];
        return (
          <div key={kind} className="flex flex-col gap-2">
            <Heading level={3} size={4} className="flex items-center gap-2">
              <Icon aria-hidden size={18} className="text-fg-muted" />
              {plural}
              <span className="font-normal text-fg-muted">{items.length}</span>
            </Heading>
            <List aria-label={plural}>
              {items.map((item) => (
                <ListItem
                  key={item.key}
                  id={item.key}
                  title={item.title}
                  description={item.description}
                  onAction={item.open}
                />
              ))}
            </List>
          </div>
        );
      })}
    </div>
  );
}

// C: the row leads with what to do; who and where come second
function VariantC({ items }: VariantProps) {
  return (
    <List aria-label="Needs attention">
      {items.map((item) => (
        <ListItem
          key={item.key}
          id={item.key}
          textValue={`${kinds[item.kind].action} ${item.title}`}
          title={kinds[item.kind].action}
          description={
            <>
              <span className="font-semibold text-fg">{item.title}</span>
              {" · "}
              {item.description}
            </>
          }
          start={<KindIcon kind={item.kind} />}
          onAction={item.open}
        />
      ))}
    </List>
  );
}

// D: filter by the kind of work, with an icon and the badge on each row
function VariantD({ items }: VariantProps) {
  const [area, setArea] = useState<Area | "All">("All");
  const areas = ["All", "Sales", "Schedule", "Money"] as const;
  const count = (a: (typeof areas)[number]) =>
    a === "All"
      ? items.length
      : items.filter((i) => kinds[i.kind].area === a).length;
  const shown =
    area === "All" ? items : items.filter((i) => kinds[i.kind].area === area);
  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Kind of work"
        className="flex flex-wrap gap-2"
      >
        {areas.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={area === a}
            onClick={() => setArea(a)}
            className={`min-h-touch rounded-full border px-4 text-sm font-semibold ${
              area === a
                ? "border-fg bg-fg text-bg"
                : "border-border-strong bg-surface text-fg hover:bg-surface-sunken"
            }`}
          >
            {a} <span className="font-normal opacity-70">{count(a)}</span>
          </button>
        ))}
      </div>
      <List
        aria-label="Needs attention"
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">Nothing here.</p>
        )}
      >
        {shown.map((item) => (
          <ListItem
            key={item.key}
            id={item.key}
            title={item.title}
            description={item.description}
            start={<KindIcon kind={item.kind} />}
            end={item.badge}
            onAction={item.open}
          />
        ))}
      </List>
    </div>
  );
}
