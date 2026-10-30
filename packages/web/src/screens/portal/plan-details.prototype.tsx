// PROTOTYPE: throwaway. The Client's plan page's details card on made-up
// data, at /prototype/plan-details?case=1..3&layout=D..F (no sign-in). For
// the UX pass (#96). Lives only on prototype-portal-plan.
//
// Every variant keeps to three text styles (a group's title, a value, a
// muted line), one grid across the whole width, icons, and one answer to
// "when", however many days.
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  CirclePlus,
  Clock,
  House,
  PiggyBank,
  Receipt,
  Sparkles,
  UserRound,
  Users,
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

type Day = {
  // "Mondays at 9:00 AM"
  when: string;
  service: string;
  price: string;
  hours: string;
  crew: number;
};

type PlanCase = {
  key: string;
  name: string;
  ended: boolean;
  // "Every week", "Every other week"
  rhythm: string;
  days: Day[];
  // per clean with one day, per week with several
  price: string;
  per: "clean" | "week";
  discount: number;
  extras: string[];
  deposit: string;
  started: string;
  endedOn?: string;
};

export const cases: PlanCase[] = [
  {
    key: "1",
    name: "Every week, with extras",
    ended: false,
    rhythm: "Every week",
    days: [
      {
        when: "Mondays at 9:00 AM",
        service: "Standard Clean",
        price: "$201.85",
        hours: "3.75",
        crew: 1,
      },
    ],
    price: "$201.85",
    per: "clean",
    discount: 10,
    extras: ["Inside the fridge", "Inside the oven"],
    deposit: "$50.46",
    started: "Jan 12, 2026",
  },
  {
    key: "2",
    name: "Two days a week",
    ended: false,
    rhythm: "Every week",
    days: [
      {
        when: "Mondays at 9:00 AM",
        service: "Standard Clean",
        price: "$201.85",
        hours: "3.75",
        crew: 1,
      },
      {
        when: "Thursdays at 2:00 PM",
        service: "Deep Clean",
        price: "$312.40",
        hours: "5",
        crew: 2,
      },
    ],
    price: "$514.25",
    per: "week",
    discount: 10,
    extras: [],
    deposit: "$128.56",
    started: "Jan 12, 2026",
  },
  {
    key: "3",
    name: "Ended",
    ended: true,
    rhythm: "Every other week",
    days: [
      {
        when: "Tuesdays at 10:00 AM",
        service: "Standard Clean",
        price: "$184.50",
        hours: "2.5",
        crew: 1,
      },
    ],
    price: "$184.50",
    per: "clean",
    discount: 10,
    extras: [],
    deposit: "$46.13",
    started: "Mar 3, 2026",
    endedOn: "Oct 14, 2026",
  },
];

export const layouts = [
  { key: "D", name: "Headline, then facts across" },
  { key: "E", name: "Three groups: when, what, cost" },
  { key: "F", name: "Schedule list, then cost" },
];

// ---- shared bits ----

const crewOf = (n: number) => (n === 1 ? "1 cleaner" : `${n} cleaners`);
const extrasText = (c: PlanCase) =>
  c.extras.length > 0 ? c.extras.join(", ") : "None";
const depositHint = (c: PlanCase) =>
  c.ended
    ? "Deposit, put towards the last clean"
    : "Deposit, comes off your last clean";

// an icon, a value and a muted line under it: the one shape every fact takes
function Fact({
  icon,
  value,
  line,
  label,
}: {
  icon: LucideIcon;
  value: ReactNode;
  line?: ReactNode;
  // for screen readers, and as the muted line when there's no other
  label: string;
}) {
  const Icon = icon;
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden size={20} className="mt-0.5 shrink-0 text-fg-muted" />
      <div className="flex min-w-0 flex-col">
        <dt className="sr-only">{label}</dt>
        <dd className="text-fg">{value}</dd>
        <dd className="text-sm text-fg-muted">{line ?? label}</dd>
      </div>
    </div>
  );
}

// a group's title: the one heading style inside the card
const GroupTitle = ({ children }: { children: ReactNode }) => (
  <h3 className="text-sm font-semibold tracking-wide text-fg-muted uppercase">
    {children}
  </h3>
);

// ---- the page ----

export function PlanDetailsPrototype() {
  const { case: key = "1", layout = "D" } = useSearch({ strict: false }) as {
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
  const shown = layouts.some((l) => l.key === layout) ? layout : "D";

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
            {/* Ended reads as stopped: red */}
            <StatusBadge tone={c.ended ? "danger" : "success"}>
              {c.ended ? "Ended" : "Active"}
            </StatusBadge>
          </div>
          <p className="text-fg-muted">41-12 Austin St, 4B, 11375</p>
        </div>
        <Section title="Plan details">
          <Card>
            {shown === "E" ? (
              <Groups c={c} />
            ) : shown === "F" ? (
              <ScheduleFirst c={c} />
            ) : (
              <HeadlineFirst c={c} />
            )}
            <p className="border-t border-border pt-4 text-sm text-fg-muted">
              Each clean is charged to your saved card when it's done. We email
              a reminder the day before.
            </p>
          </Card>
        </Section>
      </div>
      <PrototypeSwitcher
        variants={layouts}
        current={shown}
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

// D: the answer to "what is my plan?" as one large line (every day of it),
// then the facts in equal columns across the card
function HeadlineFirst({ c }: { c: PlanCase }) {
  const one = c.days.length === 1 ? c.days[0]! : null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <IconTile icon={CalendarClock} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-fg-muted">{c.rhythm}</p>
          {c.days.map((d) => (
            <p key={d.when} className="text-xl font-semibold text-fg">
              {d.when}
              {!one && (
                <span className="font-normal text-fg-muted">
                  {" "}
                  · {d.service}
                </span>
              )}
            </p>
          ))}
          {one && <p className="text-fg-muted">{one.service}</p>}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          icon={Receipt}
          value={c.price}
          label={`Each ${c.per}`}
          line={`Each ${c.per}, ${c.discount}% off`}
        />
        {one ? (
          <Fact
            icon={Clock}
            value={`About ${one.hours} h`}
            label="On site"
            line={`On site, ${crewOf(one.crew)}`}
          />
        ) : (
          <Fact
            icon={Users}
            value={c.days.map((d) => `${d.hours} h`).join(" + ")}
            label="On site"
            line="On site, each day"
          />
        )}
        <Fact icon={CirclePlus} value={extrasText(c)} label="Extras" />
        <Fact
          icon={PiggyBank}
          value={c.deposit}
          label="Deposit"
          line={depositHint(c)}
        />
      </dl>
      <p className="text-sm text-fg-muted">
        Started {c.started}
        {c.endedOn && ` · Ended ${c.endedOn}`}
      </p>
    </div>
  );
}

// E: three equal columns, each answering one question with a title
function Groups({ c }: { c: PlanCase }) {
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-3">
      <section className="flex flex-col gap-3">
        <GroupTitle>When</GroupTitle>
        <dl className="flex flex-col gap-3">
          {c.days.map((d) => (
            <Fact
              key={d.when}
              icon={CalendarClock}
              value={d.when}
              label="When"
              line={c.rhythm}
            />
          ))}
          <Fact
            icon={CalendarClock}
            value={c.endedOn ? `${c.started} – ${c.endedOn}` : c.started}
            label={c.endedOn ? "Ran" : "Started"}
          />
        </dl>
      </section>
      <section className="flex flex-col gap-3">
        <GroupTitle>What</GroupTitle>
        <dl className="flex flex-col gap-3">
          {c.days.map((d) => (
            <Fact
              key={d.when}
              icon={Sparkles}
              value={d.service}
              label="Service"
              line={`About ${d.hours} h, ${crewOf(d.crew)}`}
            />
          ))}
          <Fact icon={CirclePlus} value={extrasText(c)} label="Extras" />
        </dl>
      </section>
      <section className="flex flex-col gap-3">
        <GroupTitle>Cost</GroupTitle>
        <dl className="flex flex-col gap-3">
          <Fact
            icon={Receipt}
            value={c.price}
            label={`Each ${c.per}`}
            line={`Each ${c.per}, tax included, ${c.discount}% off`}
          />
          <Fact
            icon={PiggyBank}
            value={c.deposit}
            label="Deposit"
            line={depositHint(c)}
          />
        </dl>
      </section>
    </div>
  );
}

// F: the schedule as rows, one a day, each saying all about that clean; the
// money under it in a row of its own
function ScheduleFirst({ c }: { c: PlanCase }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <GroupTitle>{c.rhythm}</GroupTitle>
        <ul className="flex flex-col divide-y divide-border">
          {c.days.map((d) => (
            <li
              key={d.when}
              className="grid items-center gap-x-6 gap-y-1 py-3 first:pt-0 sm:grid-cols-[1fr_1fr_auto]"
            >
              <span className="flex items-center gap-3 font-semibold text-fg">
                <CalendarClock
                  aria-hidden
                  size={20}
                  className="shrink-0 text-fg-muted"
                />
                {d.when}
              </span>
              <span className="text-fg">
                {d.service}
                <span className="block text-sm text-fg-muted">
                  About {d.hours} h, {crewOf(d.crew)}
                </span>
              </span>
              <span className="text-fg sm:text-right">{d.price}</span>
            </li>
          ))}
        </ul>
      </section>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
        <Fact
          icon={Receipt}
          value={c.price}
          label={`Each ${c.per}`}
          line={`Each ${c.per}, ${c.discount}% off`}
        />
        <Fact icon={CirclePlus} value={extrasText(c)} label="Extras" />
        <Fact
          icon={PiggyBank}
          value={c.deposit}
          label="Deposit"
          line={depositHint(c)}
        />
      </dl>
      <p className="text-sm text-fg-muted">
        Started {c.started}
        {c.endedOn && ` · Ended ${c.endedOn}`}
      </p>
    </div>
  );
}
