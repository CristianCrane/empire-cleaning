// PROTOTYPE: throwaway. The Client's plan page's details card on made-up
// data, at /prototype/plan-details?case=1..3&layout=A..C (no sign-in). For
// the UX pass (#96). Lives only on prototype-portal-plan.
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarDays,
  CirclePlus,
  Clock,
  House,
  PiggyBank,
  Receipt,
  Sparkles,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  AppLayout,
  Card,
  Heading,
  IconTile,
  type NavItem,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

const here = linkTo({ to: "/prototype/plan-details" });

// ---- made-up data ----

// one row of the plan's details: what it is, its value, and a quieter hint
type Detail = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
};

type PlanCase = {
  key: string;
  name: string;
  ended?: boolean;
  details: Detail[];
};

const service: Detail = {
  icon: Sparkles,
  label: "Service",
  value: "Standard Clean",
};
const started: Detail = {
  icon: CalendarDays,
  label: "Started",
  value: "Jan 12, 2026",
};

export const cases: PlanCase[] = [
  {
    key: "1",
    name: "Every week, with extras",
    details: [
      service,
      {
        icon: CalendarClock,
        label: "When",
        value: "Mondays at 9:00 AM",
        hint: "Every week",
      },
      {
        icon: Receipt,
        label: "Each clean",
        value: "$201.85",
        hint: "Tax included · 10% off a one-off clean",
      },
      {
        icon: Clock,
        label: "On site",
        value: "About 3.75 h",
        hint: "A crew of 1",
      },
      {
        icon: Sparkles,
        label: "Extras",
        value: "Inside the fridge, Inside the oven",
      },
      {
        icon: PiggyBank,
        label: "Deposit held",
        value: "$50.46",
        hint: "Comes off your last clean when the plan ends",
      },
      started,
    ],
  },
  {
    key: "2",
    name: "Two days a week",
    details: [
      {
        icon: CalendarClock,
        label: "Mondays at 9:00 AM",
        value: "Standard Clean, $201.85",
        hint: "About 3.75 h, a crew of 1",
      },
      {
        icon: CalendarClock,
        label: "Thursdays at 2:00 PM",
        value: "Deep Clean, $312.40",
        hint: "About 5 h, a crew of 2",
      },
      {
        icon: Receipt,
        label: "Each week",
        value: "$514.25",
        hint: "Tax included · 10% off one-off cleans",
      },
      { icon: Sparkles, label: "Extras", value: "None" },
      {
        icon: PiggyBank,
        label: "Deposit held",
        value: "$128.56",
        hint: "Comes off your last clean when the plan ends",
      },
      started,
    ],
  },
  {
    key: "3",
    name: "Ended",
    ended: true,
    details: [
      service,
      {
        icon: CalendarClock,
        label: "When",
        value: "Every other Tuesday at 10:00 AM",
      },
      {
        icon: Receipt,
        label: "Each clean",
        value: "$184.50",
        hint: "Tax included · 10% off a one-off clean",
      },
      {
        icon: Clock,
        label: "On site",
        value: "About 2.5 h",
        hint: "A crew of 1",
      },
      { icon: Sparkles, label: "Extras", value: "None" },
      {
        icon: PiggyBank,
        label: "Deposit",
        value: "$46.13",
        hint: "Put towards the last clean",
      },
      started,
    ],
  },
];

// the extras get their own icon, so two sparkles don't sit together
const extrasIcon = CirclePlus;

export const layouts = [
  { key: "A", name: "Labels, short values, no icons" },
  { key: "B", name: "Icon rows" },
  { key: "C", name: "Key figures, then the rest" },
];

// ---- the page ----

export function PlanDetailsPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    navigate({
      to: "/prototype/plan-details",
      search: { case: key, layout, ...search } as never,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;
  const details = c.details.map((d) =>
    d.label === "Extras" ? { ...d, icon: extrasIcon } : d,
  );

  const nav: NavItem[] = [
    { href: here, label: "Home", icon: House },
    { href: here, label: "Cleans", icon: Sparkles },
    { href: here, label: "Payments", icon: Wallet },
    { href: here, label: "Your details", icon: UserRound, isCurrent: true },
  ];

  return (
    <AppLayout
      area="Client portal"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Casey Client</span>}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Heading level={1}>Your Service Plan</Heading>
            <StatusBadge tone={c.ended ? "neutral" : "success"}>
              {c.ended ? "Ended" : "Active"}
            </StatusBadge>
          </div>
          <p className="text-fg-muted">41-12 Austin St, 4B, 11375</p>
        </div>
        <Section title="Plan details">
          <Card>
            {layout === "B" ? (
              <IconRows details={details} />
            ) : layout === "C" ? (
              <KeyFigures details={details} />
            ) : (
              <Labels details={details} />
            )}
            <p className="text-sm text-fg-muted">
              Each clean is charged to your saved card when it's done. We email
              a reminder the day before.
            </p>
          </Card>
        </Section>
      </div>
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-20"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={c.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

const Value = ({ d }: { d: Detail }): ReactNode => (
  <div className="flex min-w-0 flex-col">
    <span className="text-fg">{d.value}</span>
    {d.hint && <span className="text-sm text-fg-muted">{d.hint}</span>}
  </div>
);

// A: the label beside its value, the value short and its detail quieter
function Labels({ details }: { details: Detail[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
      {details.map((d) => (
        <div key={d.label} className="contents">
          <dt className="font-semibold">{d.label}</dt>
          <dd>
            <Value d={d} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

// B: a small icon leads each row; the label is quiet, the value reads first
function IconRows({ details }: { details: Detail[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
      {details.map((d) => (
        <div key={d.label} className="flex items-start gap-3">
          <IconTile icon={d.icon} />
          <div className="flex min-w-0 flex-col">
            <dt className="text-sm text-fg-muted">{d.label}</dt>
            <dd className="font-semibold">
              <span>{d.value}</span>
              {d.hint && (
                <span className="block text-sm font-normal text-fg-muted">
                  {d.hint}
                </span>
              )}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

// C: what they'd look for first, large, then the rest as plain rows
function KeyFigures({ details }: { details: Detail[] }) {
  // when, what it costs and how long: on several weekdays, each day
  const figures = details.filter(
    (d) =>
      d.icon === CalendarClock ||
      ["Each clean", "Each week", "On site"].includes(d.label),
  );
  const others = details.filter((d) => !figures.includes(d));

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid gap-4 sm:grid-cols-3">
        {figures.map((d) => (
          <div
            key={d.label}
            className="flex flex-col gap-1 rounded-md bg-surface-sunken p-3"
          >
            <dt className="flex items-center gap-2 text-sm text-fg-muted">
              <d.icon aria-hidden size={16} />
              {d.label}
            </dt>
            <dd className="text-lg font-semibold text-fg">{d.value}</dd>
            {d.hint && <dd className="text-sm text-fg-muted">{d.hint}</dd>}
          </div>
        ))}
      </dl>
      <Labels details={others} />
    </div>
  );
}
