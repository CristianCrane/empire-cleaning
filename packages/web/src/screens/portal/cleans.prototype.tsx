// PROTOTYPE: throwaway. The Client's Cleans page on made-up data, at
// /prototype/cleans?case=1..5&layout=A..C (no sign-in). For the UX pass
// (#96). Lives only on prototype-portal-cleans.
import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { House, MapPin, Receipt, Sparkles, UserRound } from "lucide-react";
import {
  AppLayout,
  Button,
  EmptyState,
  Heading,
  List,
  ListItem,
  type NavItem,
  StatusBadge,
  type StatusTone,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { formatMoney } from "../format.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

const here = linkTo({ to: "/prototype/cleans" });
const zone = "America/New_York";

// ---- made-up data ----

type Clean = {
  id: string;
  startsAt: Date;
  // a clean, or a Site Visit before a Quote
  kind: "clean" | "visit";
  service: string;
  home: string;
  hours: number;
  cents: number;
  // what's not plain about it
  state?:
    "move_asked" | "unpaid" | "extra" | "skipped" | "cancelled" | "no_access";
  // a fee kept for it, when Skipped late, Cancelled late or No Access
  feeCents?: number;
};

const day = (days: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const elm = "12 Elm St, 4B";
const oak = "40 Oak Ave";

// every 2 weeks on Tuesdays from `from` days away, `count` of them
const plan = (from: number, count: number, over: Partial<Clean> = {}) =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${from}-${i}`,
    startsAt: day(from + i * 14 * Math.sign(from || 1)),
    kind: "clean" as const,
    service: "Standard Clean",
    home: elm,
    hours: 2.5,
    cents: 18450,
    ...over,
  }));

type CleansCase = {
  key: string;
  name: string;
  upcoming: Clean[];
  past: Clean[];
  homes: number;
};

export const cases: CleansCase[] = [
  {
    key: "1",
    name: "On a Service Plan, a few months in",
    homes: 1,
    upcoming: plan(3, 4),
    past: [
      ...plan(-11, 1, { state: "extra", cents: 20700 }),
      ...plan(-25, 1),
      ...plan(-39, 1, { state: "skipped", cents: 0 }),
      ...plan(-53, 5),
      {
        id: "first",
        startsAt: day(-130),
        kind: "clean",
        service: "Deep Clean",
        home: elm,
        hours: 4,
        cents: 39104,
      },
    ],
  },
  {
    key: "2",
    name: "First clean booked, nothing done yet",
    homes: 1,
    upcoming: [
      {
        id: "first",
        startsAt: day(5, 10),
        kind: "clean",
        service: "Deep Clean",
        home: elm,
        hours: 4,
        cents: 39104,
      },
    ],
    past: [],
  },
  {
    key: "3",
    name: "A year on a plan, a move asked for",
    homes: 1,
    upcoming: plan(3, 4).map((c, i) =>
      i === 0 ? { ...c, state: "move_asked" as const } : c,
    ),
    past: plan(-11, 26).map((c, i) =>
      i === 4
        ? { ...c, state: "unpaid" as const }
        : i === 9
          ? { ...c, state: "no_access" as const, cents: 0, feeCents: 4613 }
          : i === 15
            ? { ...c, state: "skipped" as const, cents: 0, feeCents: 4613 }
            : c,
    ),
  },
  {
    key: "4",
    name: "Two homes, a Site Visit booked",
    homes: 2,
    upcoming: [
      {
        id: "visit",
        startsAt: day(2, 14),
        kind: "visit",
        service: "Site Visit",
        home: oak,
        hours: 0.5,
        cents: 0,
      },
      ...plan(3, 3),
    ],
    past: [
      ...plan(-11, 3),
      {
        id: "oak",
        startsAt: day(-60, 13),
        kind: "clean",
        service: "Move-in/out Clean",
        home: oak,
        hours: 5,
        cents: 52000,
        state: "cancelled",
      },
    ],
  },
  {
    key: "5",
    name: "Nothing yet",
    homes: 1,
    upcoming: [],
    past: [],
  },
];

export const layouts = [
  { key: "A", name: "Tabs + rows" },
  { key: "B", name: "One page, by month" },
  { key: "C", name: "Tabs, by month, date tiles" },
];

// ---- how a clean reads ----

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
  d.toLocaleString("en-US", { timeZone: zone, ...o });
const when = (d: Date) =>
  fmt(d, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const time = (d: Date) => fmt(d, { hour: "numeric", minute: "2-digit" });
const month = (d: Date) => fmt(d, { month: "long", year: "numeric" });

// only what's not plain gets a badge: a booked clean or a done one needs none
const badge: Record<NonNullable<Clean["state"]>, [StatusTone, string]> = {
  move_asked: ["info", "Move asked"],
  unpaid: ["danger", "Unpaid"],
  extra: ["warning", "Needs your OK"],
  skipped: ["neutral", "Skipped"],
  cancelled: ["neutral", "Cancelled"],
  no_access: ["danger", "No Access"],
};
const badgeOf = (c: Clean) => {
  if (!c.state) return undefined;
  const [tone, label] = badge[c.state];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
};

// "Standard Clean · $184.50", with the home only when there's more than one
const lineOf = (
  c: Clean,
  homes: number,
  past: boolean,
  // with a date tile: the time leads, and the Service is the title
  dated = false,
) =>
  [
    dated && time(c.startsAt),
    !dated && (c.kind === "visit" ? "Site Visit, free" : c.service),
    homes > 1 && c.home,
    past &&
      c.kind === "clean" &&
      (c.feeCents
        ? `${formatMoney(c.feeCents)} fee`
        : c.cents > 0
          ? formatMoney(c.cents)
          : "No charge"),
    !past && c.kind === "clean" && `about ${c.hours} h`,
  ]
    .filter(Boolean)
    .join(" · ");

const byMonth = (cleans: Clean[]) => {
  const groups: { month: string; cleans: Clean[] }[] = [];
  for (const c of cleans) {
    const m = month(c.startsAt);
    if (groups.at(-1)?.month !== m) groups.push({ month: m, cleans: [] });
    groups.at(-1)!.cleans.push(c);
  }
  return groups;
};

// a small page off a calendar, for a row
function MiniDate({ date }: { date: Date }) {
  return (
    <span
      aria-hidden
      className="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-md border border-border text-center"
    >
      <span className="w-full bg-primary text-[10px] leading-4 font-bold tracking-widest text-primary-fg uppercase">
        {fmt(date, { month: "short" })}
      </span>
      <span className="py-0.5 font-display text-xl leading-none font-bold text-fg">
        {fmt(date, { day: "numeric" })}
      </span>
    </span>
  );
}

const PAGE = 10;

// ---- the page ----

export function CleansPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    navigate({
      to: "/prototype/cleans",
      search: { case: key, layout, ...search } as never,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;

  const nav: NavItem[] = [
    { href: here, label: "Home", icon: House },
    { href: here, label: "Cleans", icon: Sparkles, isCurrent: true },
    { href: here, label: "Your details", icon: UserRound },
  ];

  return (
    <AppLayout
      area="Client portal"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Casey Client</span>}
    >
      <div className="flex flex-col gap-6">
        <Heading level={1}>Your cleans</Heading>
        {layout === "B" ? (
          <OnePage c={c} />
        ) : (
          <TabbedPage c={c} byMonths={layout === "C"} />
        )}
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

function Rows({
  cleans,
  homes,
  past,
  label,
  dates,
}: {
  cleans: Clean[];
  homes: number;
  past: boolean;
  label: string;
  // a date tile leads each row, and the Service its title
  dates?: boolean;
}) {
  return (
    <List aria-label={label} onAction={() => {}}>
      {cleans.map((c) => (
        <ListItem
          key={c.id}
          id={c.id}
          start={
            dates ? (
              <MiniDate date={c.startsAt} />
            ) : c.kind === "visit" ? (
              <MapPin aria-hidden size={20} className="text-fg-muted" />
            ) : undefined
          }
          title={
            dates
              ? c.kind === "visit"
                ? "Site Visit"
                : c.service
              : when(c.startsAt)
          }
          description={lineOf(c, homes, past, dates)}
          end={badgeOf(c)}
        />
      ))}
    </List>
  );
}

function ShowMore({
  all,
  render,
}: {
  all: Clean[];
  render: (shown: Clean[]) => ReactNode;
}) {
  const [count, setCount] = useState(PAGE);
  return (
    <>
      {render(all.slice(0, count))}
      {all.length > count && (
        <Button
          variant="secondary"
          className="self-center"
          onPress={() => setCount(count + PAGE)}
        >
          Show more
        </Button>
      )}
    </>
  );
}

const emptyUpcoming = (
  <EmptyState
    icon={Sparkles}
    title="Nothing booked"
    description="Your next clean shows here once it's booked."
  />
);
const emptyPast = (
  <EmptyState
    icon={Receipt}
    title="No cleans yet"
    description="Each clean shows here once it's done, with its receipt."
  />
);

// A and C: a Tab each for what's coming and what's done
function TabbedPage({ c, byMonths }: { c: CleansCase; byMonths: boolean }) {
  const list = (cleans: Clean[], past: boolean, label: string) =>
    byMonths ? (
      <div className="flex flex-col gap-6">
        {byMonth(cleans).map((g) => (
          <section key={g.month} className="flex flex-col gap-2">
            <Heading level={2} size={4} className="text-fg-muted">
              {g.month}
            </Heading>
            <Rows
              cleans={g.cleans}
              homes={c.homes}
              past={past}
              label={`${label}, ${g.month}`}
              dates
            />
          </section>
        ))}
      </div>
    ) : (
      <Rows cleans={cleans} homes={c.homes} past={past} label={label} />
    );

  return (
    <Tabs
      defaultSelectedKey={
        c.upcoming.length > 0 || c.past.length === 0 ? "upcoming" : "past"
      }
    >
      <TabList aria-label="Your cleans">
        <Tab id="upcoming" count={c.upcoming.length}>
          Upcoming
        </Tab>
        <Tab id="past" count={c.past.length}>
          Past
        </Tab>
      </TabList>
      <TabPanel id="upcoming">
        {c.upcoming.length === 0
          ? emptyUpcoming
          : list(c.upcoming, false, "Upcoming")}
      </TabPanel>
      <TabPanel id="past" className="flex flex-col gap-4">
        {c.past.length === 0 ? (
          emptyPast
        ) : (
          <ShowMore
            all={c.past}
            render={(shown) => list(shown, true, "Past")}
          />
        )}
      </TabPanel>
    </Tabs>
  );
}

// B: one page, what's coming then what's done, each by month
function OnePage({ c }: { c: CleansCase }) {
  const months = (cleans: Clean[], past: boolean) =>
    byMonth(cleans).map((g) => (
      <section key={g.month} className="flex flex-col gap-2">
        <Heading level={3} size={4} className="text-fg-muted">
          {g.month}
        </Heading>
        <Rows
          cleans={g.cleans}
          homes={c.homes}
          past={past}
          label={g.month}
          dates
        />
      </section>
    ));
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <Heading level={2} size={3}>
          Coming up
        </Heading>
        {c.upcoming.length === 0 ? emptyUpcoming : months(c.upcoming, false)}
      </section>
      <section className="flex flex-col gap-4">
        <Heading level={2} size={3}>
          Done
        </Heading>
        {c.past.length === 0 ? (
          emptyPast
        ) : (
          <ShowMore all={c.past} render={(shown) => months(shown, true)} />
        )}
      </section>
    </div>
  );
}
