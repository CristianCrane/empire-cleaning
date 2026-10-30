// PROTOTYPE: throwaway. The Client's Payments page on made-up data, at
// /prototype/payments?case=1..7&history=1..5 (no sign-in). For the UX pass
// (#96). Lives only on prototype-portal-payments.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronDown,
  CircleCheck,
  CreditCard,
  House,
  Receipt,
  Sparkles,
  TriangleAlert,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  AppLayout,
  Button,
  Card,
  DateTile,
  EmptyState,
  Heading,
  IconTile,
  Link,
  List,
  ListItem,
  type NavItem,
  Notice,
  Section,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { formatMoney } from "../format.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

const here = linkTo({ to: "/prototype/payments" });
const zone = "America/New_York";

// ---- made-up data ----

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
  d.toLocaleString("en-US", { timeZone: zone, ...o });
const month = (d: Date) => fmt(d, { month: "long", year: "numeric" });
const short = (d: Date) => fmt(d, { month: "short", day: "numeric" });
const weekOf = (b: Bill) => {
  const end = new Date(b.week);
  end.setDate(end.getDate() + 6);
  return `${short(b.week)} – ${short(end)}`;
};

// money that moved: a Charge, or a refund (below zero)
type Charge = {
  id: string;
  at: Date;
  // what it was for
  title: string;
  line: string;
  cents: number;
  // what's not plain about it
  state?: "unpaid" | "processing";
  // the Charge (a clean) this one adds to or takes from
  about?: string;
};

type Bill = {
  id: string;
  number: string;
  // the Monday its week starts
  week: Date;
  cleans: number;
  cents: number;
  status: "paid" | "due" | "unpaid" | "processing";
  dueAt?: Date;
};

type PaymentsCase = {
  key: string;
  name: string;
  card: string | null;
  weekly: boolean;
  bills: Bill[];
  history: Charge[];
  // what needs doing, most pressing first
  notices: {
    tone: "warning" | "danger" | "info";
    text: string;
    action?: string;
  }[];
  // what's owed now, for C's summary
  owed?: { cents: number; text: string; action: string };
};

const day = (days: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};
// the Monday `weeks` weeks back
const monday = (weeks: number) => {
  const d = day(-weeks * 7);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const visa = "Visa •••• 4242";

// a Balance for each clean on a plan every 2 weeks, from `from` days back
const balances = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `b${from}-${i}`,
    at: day(-(from + i * 14)),
    title: "Standard Clean",
    line: "",
    cents: 18450,
  }));

const planStart: Charge[] = [
  {
    id: "first",
    at: day(-128),
    title: "Deep Clean",
    line: "",
    cents: 29328,
  },
  {
    id: "deposit",
    at: day(-140),
    title: "Deposit for your Service Plan",
    line: "Goes towards your plan's last clean",
    cents: 4613,
  },
  {
    id: "first-deposit",
    at: day(-140),
    title: "Deposit for Deep Clean",
    line: `Booked for ${short(day(-128))}`,
    cents: 9776,
    about: "first",
  },
];

const fortnightly = (weeks: number, status: Bill["status"] = "paid") =>
  ({
    id: `bill${weeks}`,
    number: `EC-${String(41 - weeks).padStart(6, "0")}`,
    week: monday(weeks),
    cleans: 5,
    cents: 124000 + weeks * 1350,
    status,
  }) satisfies Bill;

export const cases: PaymentsCase[] = [
  {
    key: "1",
    name: "On a plan, a few months in",
    card: visa,
    weekly: false,
    bills: [],
    notices: [],
    history: [
      {
        id: "extra",
        at: day(-9),
        title: "Extra on Standard Clean",
        line: `Approved after your ${short(day(-11))} clean`,
        cents: 2250,
        about: "b11-0",
      },
      ...balances(11, 2),
      {
        id: "refund",
        at: day(-39),
        title: "Refund on Standard Clean",
        line: `From your ${short(day(-39))} clean`,
        cents: -2250,
        about: "b39-0",
      },
      ...balances(39, 6),
      ...planStart,
    ],
  },
  {
    key: "2",
    name: "Just booked: a Deposit taken",
    card: visa,
    weekly: false,
    bills: [],
    notices: [],
    history: [
      {
        id: "deposit",
        at: day(-1),
        title: "Deposit for Deep Clean",
        line: `Booked for ${short(day(5))}`,
        cents: 9776,
      },
    ],
  },
  {
    key: "3",
    name: "A clean couldn't be charged",
    card: "Visa •••• 0341",
    weekly: false,
    bills: [],
    notices: [
      {
        tone: "danger",
        text: "Your card was declined for your Standard Clean on Oct 22, so your Service Plan is On Hold. Update your card and we'll try it again.",
        action: "Update your card",
      },
    ],
    owed: {
      cents: 18450,
      text: "Your card was declined for your Oct 22 clean",
      action: "Update your card",
    },
    history: [
      {
        id: "failed",
        at: day(-8),
        title: "No Access fee",
        line: `Standard Clean, ${short(day(-8))}`,
        cents: 4613,
      },
      ...balances(22, 4),
      ...planStart,
    ],
  },
  {
    key: "4",
    name: "Billed weekly, paid by card",
    card: "Amex •••• 1005",
    weekly: true,
    notices: [],
    bills: [1, 2, 3, 4, 5, 6, 7].map((w) => fortnightly(w)),
    history: [
      ...[1, 2, 3, 4, 5, 6, 7].map((w) => {
        const b = fortnightly(w);
        return {
          id: `paid${w}`,
          at: day(-w * 7 + 1),
          title: `Bill ${b.number}`,
          line: weekOf(b),
          cents: b.cents,
        };
      }),
      {
        id: "deposit",
        at: day(-60),
        title: "Deposit for Deep Clean",
        line: `Booked for ${short(day(-53))}`,
        cents: 13000,
      },
    ],
  },
  {
    key: "5",
    name: "Billed weekly, paid on the page: one due, one Unpaid",
    card: null,
    weekly: true,
    notices: [
      {
        tone: "danger",
        text: "Bill EC-000039 is Unpaid, so your Service Plans are On Hold. Pay it to carry on.",
        action: "Pay Bill EC-000039",
      },
      {
        tone: "warning",
        text: "Bill EC-000040, $1,253.50, is due by Nov 3.",
        action: "Pay Bill EC-000040",
      },
    ],
    owed: {
      cents: 126700 + 125350,
      text: "Two Bills, one past its due date",
      action: "Pay Bill EC-000039",
    },
    bills: [
      { ...fortnightly(1, "due"), dueAt: day(4) },
      { ...fortnightly(2, "unpaid"), dueAt: day(-3) },
      ...[3, 4, 5].map((w) => fortnightly(w)),
      { ...fortnightly(6), cents: -4500, cleans: 0 },
      ...[7, 8].map((w) => fortnightly(w)),
    ],
    history: [3, 4, 5, 7, 8].map((w) => {
      const b = fortnightly(w);
      return {
        id: `paid${w}`,
        at: day(-w * 7 + 6),
        title: `Bill ${b.number}`,
        line: weekOf(b),
        cents: b.cents,
      };
    }),
  },
  {
    key: "6",
    name: "A bank payment clearing",
    card: null,
    weekly: true,
    notices: [
      {
        tone: "info",
        text: "Your bank payment of $1,253.50 for Bill EC-000040 is on its way. It usually takes a few working days to clear.",
      },
    ],
    bills: [
      fortnightly(1, "processing"),
      ...[2, 3, 4].map((w) => fortnightly(w)),
    ],
    history: [
      {
        id: "clearing",
        at: day(-1),
        title: "Bill EC-000040",
        line: weekOf(fortnightly(1)),
        cents: 125350,
        state: "processing",
      },
      ...[2, 3, 4].map((w) => {
        const b = fortnightly(w);
        return {
          id: `paid${w}`,
          at: day(-w * 7 + 6),
          title: `Bill ${b.number}`,
          line: weekOf(b),
          cents: b.cents,
        };
      }),
    ],
  },
  {
    key: "7",
    name: "Nothing yet: a Quote not accepted",
    card: null,
    weekly: false,
    bills: [],
    notices: [],
    history: [],
  },
];

// ways to show the history, under C's summary card
export const histories = [
  { key: "1", name: "Rows by month" },
  { key: "2", name: "Statement, months with totals" },
  { key: "3", name: "Latest few, then See all" },
  { key: "4", name: "Months folded" },
  { key: "5", name: "One row per clean" },
];

// ---- how it reads ----

// "−$22.50" for a refund
const signed = (cents: number) =>
  cents < 0 ? `−${formatMoney(-cents)}` : formatMoney(cents);

const byMonth = <T,>(items: T[], at: (t: T) => Date) => {
  const groups: { month: string; items: T[] }[] = [];
  for (const item of items) {
    const m = month(at(item));
    if (groups.at(-1)?.month !== m) groups.push({ month: m, items: [] });
    groups.at(-1)!.items.push(item);
  }
  return groups;
};

const billBadge = (b: Bill) =>
  b.status === "unpaid" ? (
    <StatusBadge tone="danger">Unpaid</StatusBadge>
  ) : b.status === "due" ? (
    <StatusBadge tone="warning">Due {short(b.dueAt!)}</StatusBadge>
  ) : b.status === "processing" ? (
    <StatusBadge tone="info">Clearing</StatusBadge>
  ) : b.cents < 0 ? (
    <StatusBadge>Credit</StatusBadge>
  ) : undefined;

const PAGE = 10;

// ---- the page ----

export function PaymentsPrototype() {
  const { case: key = "1", history = "1" } = useSearch({
    strict: false,
  }) as { case?: string; history?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; history?: string }) =>
    navigate({
      to: "/prototype/payments",
      search: { case: key, history, ...search } as never,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;

  const nav: NavItem[] = [
    { href: here, label: "Home", icon: House },
    { href: here, label: "Cleans", icon: Sparkles },
    { href: here, label: "Payments", icon: Wallet, isCurrent: true },
    { href: here, label: "Your details", icon: UserRound },
  ];

  return (
    <AppLayout
      area="Client portal"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Casey Client</span>}
    >
      <div key={`${c.key}${history}`} className="flex flex-col gap-6">
        <Heading level={1}>Payments</Heading>
        <Summary c={c} />
        {c.notices
          .filter((n) => n.tone === "info")
          .map((n) => (
            <Notice key={n.text}>{n.text}</Notice>
          ))}
        <Section title="History">
          {c.history.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nothing paid yet"
              description="Each Deposit, clean and refund shows here, with its receipt."
            />
          ) : history === "2" ? (
            <Statement c={c} />
          ) : history === "3" ? (
            <Latest c={c} />
          ) : history === "4" ? (
            <Folded c={c} />
          ) : history === "5" ? (
            <PerClean c={c} />
          ) : (
            <RowsByMonth c={c} />
          )}
        </Section>
      </div>
      <PrototypeSwitcher
        variants={histories}
        current={history}
        onChange={(k) => go({ history: k })}
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

// what's owed now, or that nothing is, and the card it's paid with
function Summary({ c }: { c: PaymentsCase }) {
  const nothing = !c.owed;
  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <IconTile
          icon={nothing ? CircleCheck : TriangleAlert}
          tone={nothing ? "success" : "danger"}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Heading level={2} size={4} className="text-fg-muted">
            {nothing ? "You're all paid up" : "To pay"}
          </Heading>
          <p className="text-2xl font-semibold text-fg sm:text-3xl">
            {nothing ? "Nothing owed" : formatMoney(c.owed!.cents)}
          </p>
          <p className="text-fg-muted">
            {c.owed?.text ??
              (c.card
                ? `Paying with ${c.card}`
                : c.weekly
                  ? "You pay each Bill on its page"
                  : "You'll add a card when you accept a Quote")}
          </p>
          {c.owed && c.card && (
            <p className="text-fg-muted">Paying with {c.card}</p>
          )}
        </div>
        {c.owed ? (
          <Button
            className="shrink-0 self-start sm:self-center"
            onPress={() => {}}
          >
            {c.owed.action}
          </Button>
        ) : (
          c.card && (
            <Button
              variant="secondary"
              className="shrink-0 self-start sm:self-center"
              onPress={() => {}}
            >
              Change card
            </Button>
          )
        )}
      </div>
    </Card>
  );
}

function Bills({ bills, label }: { bills: Bill[]; label: string }) {
  const [shown, setShown] = useState(5);
  return (
    <div className="flex flex-col gap-4">
      <List aria-label={label} onAction={() => {}}>
        {bills.slice(0, shown).map((b) => (
          <ListItem
            key={b.id}
            id={b.id}
            start={<DateTile date={b.week.toISOString()} size="sm" />}
            title={`Bill ${b.number}`}
            description={[
              weekOf(b),
              b.cleans > 0 && `${b.cleans} cleans`,
              signed(b.cents),
            ]
              .filter(Boolean)
              .join(" · ")}
            end={billBadge(b)}
          />
        ))}
      </List>
      {bills.length > shown && (
        <Button
          variant="secondary"
          className="self-center"
          onPress={() => setShown(shown + 5)}
        >
          Show more
        </Button>
      )}
    </div>
  );
}

const Amount = ({ h }: { h: Charge }) => (
  <span className="flex items-center gap-3">
    {h.state === "unpaid" && <StatusBadge tone="danger">Unpaid</StatusBadge>}
    {h.state === "processing" && (
      <StatusBadge tone="info">Clearing</StatusBadge>
    )}
    <span className="font-semibold text-fg tabular-nums">
      {signed(h.cents)}
    </span>
  </span>
);

// one line a row: the day, what it was for, the amount
const lineRow = (h: Charge) => (
  <ListItem
    key={h.id}
    id={h.id}
    start={
      <span className="w-12 shrink-0 text-sm text-fg-muted tabular-nums">
        {short(h.at)}
      </span>
    }
    title={h.title}
    description={h.line || undefined}
    end={<Amount h={h} />}
  />
);

function More({
  total,
  shown,
  onMore,
}: {
  total: number;
  shown: number;
  onMore: () => void;
}) {
  return total > shown ? (
    <Button variant="secondary" className="self-center" onPress={onMore}>
      Show more
    </Button>
  ) : null;
}

// 1: as before, a date tile and a line under each
function RowsByMonth({ c }: { c: PaymentsCase }) {
  const [shown, setShown] = useState(PAGE);
  return (
    <div className="flex flex-col gap-6">
      {byMonth(c.history.slice(0, shown), (h) => h.at).map((g) => (
        <section key={g.month} className="flex flex-col gap-2">
          <Heading level={3} size={4} className="text-fg-muted">
            {g.month}
          </Heading>
          <List aria-label={`History, ${g.month}`} onAction={() => {}}>
            {g.items.map((h) => (
              <ListItem
                key={h.id}
                id={h.id}
                start={<DateTile date={h.at.toISOString()} size="sm" />}
                title={h.title}
                description={h.line}
                end={<Amount h={h} />}
              />
            ))}
          </List>
        </section>
      ))}
      <More
        total={c.history.length}
        shown={shown}
        onMore={() => setShown(shown + PAGE)}
      />
    </div>
  );
}

// 2: like a bank statement: one line each, a month's total by its name
function Statement({ c }: { c: PaymentsCase }) {
  const [shown, setShown] = useState(PAGE * 2);
  return (
    <div className="flex flex-col gap-6">
      {byMonth(c.history.slice(0, shown), (h) => h.at).map((g) => (
        <section key={g.month} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-4">
            <Heading level={3} size={4} className="text-fg-muted">
              {g.month}
            </Heading>
            <span className="text-sm text-fg-muted tabular-nums">
              {signed(g.items.reduce((sum, h) => sum + h.cents, 0))}
            </span>
          </div>
          <List aria-label={`History, ${g.month}`} onAction={() => {}}>
            {g.items.map(lineRow)}
          </List>
        </section>
      ))}
      <More
        total={c.history.length}
        shown={shown}
        onMore={() => setShown(shown + PAGE * 2)}
      />
    </div>
  );
}

// 3: the last few, one line each, and the rest a tap away
function Latest({ c }: { c: PaymentsCase }) {
  const [all, setAll] = useState(false);
  if (all) return <Statement c={c} />;
  return (
    <div className="flex flex-col gap-3">
      <List aria-label="Latest payments" onAction={() => {}}>
        {c.history.slice(0, 5).map(lineRow)}
      </List>
      {c.history.length > 5 && (
        <Button
          variant="text"
          className="self-start"
          onPress={() => setAll(true)}
        >
          See all {c.history.length} payments
        </Button>
      )}
    </div>
  );
}

// 4: a row a month with its total, opened to show what's in it
function Folded({ c }: { c: PaymentsCase }) {
  const months = byMonth(c.history, (h) => h.at);
  const [open, setOpen] = useState<string[]>([months[0]!.month]);
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      {months.map((g) => {
        const isOpen = open.includes(g.month);
        return (
          <section
            key={g.month}
            className="border-b border-border last:border-b-0"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken"
              onClick={() =>
                setOpen(
                  isOpen
                    ? open.filter((m) => m !== g.month)
                    : [...open, g.month],
                )
              }
            >
              <ChevronDown
                aria-hidden
                size={18}
                className={`text-fg-muted transition-transform ${isOpen ? "" : "-rotate-90"}`}
              />
              <span className="flex-1 font-semibold text-fg">{g.month}</span>
              <span className="text-sm text-fg-muted">
                {g.items.length} {g.items.length === 1 ? "payment" : "payments"}
              </span>
              <span className="w-24 text-right font-semibold text-fg tabular-nums">
                {signed(g.items.reduce((sum, h) => sum + h.cents, 0))}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-border bg-surface-sunken/50 px-2 py-2">
                <List aria-label={`History, ${g.month}`} onAction={() => {}}>
                  {g.items.map(lineRow)}
                </List>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// 5: what each clean (or plan) cost in all, its Deposit, extras and
// refunds folded into it
function PerClean({ c }: { c: PaymentsCase }) {
  const [shown, setShown] = useState(PAGE);
  const parts = new Map<string, Charge[]>();
  for (const h of c.history)
    if (h.about) parts.set(h.about, [...(parts.get(h.about) ?? []), h]);
  const rows = c.history
    .filter((h) => !h.about)
    .map((h) => {
      const more = parts.get(h.id) ?? [];
      return {
        ...h,
        cents: h.cents + more.reduce((sum, p) => sum + p.cents, 0),
        line:
          more.length === 0
            ? h.line
            : [
                `${signed(h.cents)} ${h.title.startsWith("Deep") ? "when done" : "charged"}`,
                ...more.map((p) =>
                  p.title.startsWith("Deposit")
                    ? `${signed(p.cents)} Deposit`
                    : p.cents < 0
                      ? `${signed(-p.cents)} refunded`
                      : `${signed(p.cents)} extra`,
                ),
              ].join(" · "),
      };
    });
  return (
    <div className="flex flex-col gap-6">
      {byMonth(rows.slice(0, shown), (h) => h.at).map((g) => (
        <section key={g.month} className="flex flex-col gap-2">
          <Heading level={3} size={4} className="text-fg-muted">
            {g.month}
          </Heading>
          <List aria-label={`History, ${g.month}`} onAction={() => {}}>
            {g.items.map((h) => (
              <ListItem
                key={h.id}
                id={h.id}
                start={
                  <span className="w-12 shrink-0 text-sm text-fg-muted tabular-nums">
                    {short(h.at)}
                  </span>
                }
                title={h.title}
                description={parts.has(h.id) ? h.line : undefined}
                end={<Amount h={h} />}
              />
            ))}
          </List>
        </section>
      ))}
      <More
        total={rows.length}
        shown={shown}
        onMore={() => setShown(shown + PAGE)}
      />
    </div>
  );
}
