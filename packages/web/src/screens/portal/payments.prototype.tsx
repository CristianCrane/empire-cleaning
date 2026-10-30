// PROTOTYPE: throwaway. The Client's Payments page on made-up data, at
// /prototype/payments?case=1..7&layout=A..C (no sign-in). For the UX pass
// (#96). Lives only on prototype-portal-payments.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
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
    line: "Charged when it was done",
    cents: 18450,
  }));

const planStart: Charge[] = [
  {
    id: "first",
    at: day(-128),
    title: "Deep Clean, your First Clean",
    line: "The rest, after its Deposit",
    cents: 29328,
  },
  {
    id: "deposit",
    at: day(-140),
    title: "Deposit for your Service Plan",
    line: "Held until your plan ends, then put towards its last clean",
    cents: 4613,
  },
  {
    id: "first-deposit",
    at: day(-140),
    title: "Deposit for your First Clean",
    line: "25% of it, when you accepted your Quote",
    cents: 9776,
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
        title: "Extra on your Standard Clean",
        line: "Inside the fridge, which you approved",
        cents: 2250,
      },
      ...balances(11, 2),
      {
        id: "refund",
        at: day(-39),
        title: "Refund on your Standard Clean",
        line: "Inside the oven wasn't done",
        cents: -2250,
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
        title: "Deposit for your Deep Clean",
        line: "25% of it. The rest is charged when it's done",
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
        title: "Standard Clean",
        line: "Declined by your bank",
        cents: 18450,
        state: "unpaid",
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
          line: `${b.cleans} cleans that week`,
          cents: b.cents,
        };
      }),
      {
        id: "deposit",
        at: day(-60),
        title: "Deposit for your Deep Clean at 40 Oak Ave",
        line: "Taken off that week's Bill",
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
        line: "Paid by bank debit",
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
        line: "Bank debit, clearing",
        cents: 125350,
        state: "processing",
      },
      ...[2, 3, 4].map((w) => {
        const b = fortnightly(w);
        return {
          id: `paid${w}`,
          at: day(-w * 7 + 6),
          title: `Bill ${b.number}`,
          line: "Paid by bank debit",
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

export const layouts = [
  { key: "A", name: "Card, then sections" },
  { key: "B", name: "Tabs: Bills / History" },
  { key: "C", name: "What you owe first" },
];

// ---- how it reads ----

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
  d.toLocaleString("en-US", { timeZone: zone, ...o });
const month = (d: Date) => fmt(d, { month: "long", year: "numeric" });
const short = (d: Date) => fmt(d, { month: "short", day: "numeric" });
const weekOf = (b: Bill) => {
  const end = new Date(b.week);
  end.setDate(end.getDate() + 6);
  return `${short(b.week)} – ${short(end)}`;
};

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
  const { case: key = "1", layout = "A" } = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    navigate({
      to: "/prototype/payments",
      search: { case: key, layout, ...search } as never,
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
      <div key={`${c.key}${layout}`} className="flex flex-col gap-6">
        <Heading level={1}>Payments</Heading>
        {layout === "C" ? (
          <OwedFirst c={c} />
        ) : (
          <>
            {c.notices.map((n) => (
              <Notice
                key={n.text}
                tone={n.tone}
                action={
                  n.action && (
                    <Button variant="text" onPress={() => {}}>
                      {n.action}
                    </Button>
                  )
                }
              >
                {n.text}
              </Notice>
            ))}
            {layout === "B" ? <Tabbed c={c} /> : <Sections c={c} />}
          </>
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

// the card Charges go to, or that there isn't one
function YourCard({ c }: { c: PaymentsCase }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <IconTile icon={CreditCard} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-fg">
            {c.card ?? "No card saved"}
          </span>
          <span className="text-sm text-fg-muted">
            {c.card
              ? c.weekly
                ? "Your Bills are charged to it each Monday."
                : "Deposits and cleans are charged to it."
              : c.weekly
                ? "You pay each Bill on its page, by card or bank debit."
                : "You'll add one when you accept a Quote."}
          </span>
        </div>
        {(c.card || c.weekly) && (
          <Button
            variant="secondary"
            className="self-start sm:self-center"
            onPress={() => {}}
          >
            {c.card ? "Change card" : "Save a card"}
          </Button>
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

function History({
  c,
  label = "Payment history",
}: {
  c: PaymentsCase;
  label?: string;
}) {
  const [shown, setShown] = useState(PAGE);
  if (c.history.length === 0)
    return (
      <EmptyState
        icon={Receipt}
        title="Nothing paid yet"
        description="Each Deposit, clean and refund shows here, with its receipt."
      />
    );
  return (
    <div className="flex flex-col gap-6">
      {byMonth(c.history.slice(0, shown), (h) => h.at).map((g) => (
        <section key={g.month} className="flex flex-col gap-2">
          <Heading level={3} size={4} className="text-fg-muted">
            {g.month}
          </Heading>
          <List aria-label={`${label}, ${g.month}`} onAction={() => {}}>
            {g.items.map((h) => (
              <ListItem
                key={h.id}
                id={h.id}
                start={<DateTile date={h.at.toISOString()} size="sm" />}
                title={h.title}
                description={h.line}
                end={
                  <span className="flex items-center gap-3">
                    {h.state === "unpaid" && (
                      <StatusBadge tone="danger">Unpaid</StatusBadge>
                    )}
                    {h.state === "processing" && (
                      <StatusBadge tone="info">Clearing</StatusBadge>
                    )}
                    <span className="font-semibold text-fg tabular-nums">
                      {signed(h.cents)}
                    </span>
                  </span>
                }
              />
            ))}
          </List>
        </section>
      ))}
      {c.history.length > shown && (
        <Button
          variant="secondary"
          className="self-center"
          onPress={() => setShown(shown + PAGE)}
        >
          Show more
        </Button>
      )}
    </div>
  );
}

// A: the card, then Bills (if billed weekly), then the history
function Sections({ c }: { c: PaymentsCase }) {
  return (
    <>
      <YourCard c={c} />
      {c.weekly && (
        <Section
          title="Bills"
          description="One each Monday, for the week before."
        >
          <Bills bills={c.bills} label="Bills" />
        </Section>
      )}
      <Section title="History">
        <History c={c} />
      </Section>
    </>
  );
}

// B: the card in a line, then a Tab each for Bills and the history
function Tabbed({ c }: { c: PaymentsCase }) {
  const cardLine = (
    <p className="text-fg-muted">
      {c.card ? (
        <>
          Paying with {c.card} · <Link href={here}>Change card</Link>
        </>
      ) : c.weekly ? (
        <>
          You pay each Bill on its page · <Link href={here}>Save a card</Link>
        </>
      ) : (
        "You'll add a card when you accept a Quote."
      )}
    </p>
  );
  if (!c.weekly)
    return (
      <>
        {cardLine}
        <History c={c} />
      </>
    );
  return (
    <>
      {cardLine}
      <Tabs>
        <TabList aria-label="Payments">
          <Tab id="bills" count={c.bills.length}>
            Bills
          </Tab>
          <Tab id="history" count={c.history.length}>
            History
          </Tab>
        </TabList>
        <TabPanel id="bills">
          <Bills bills={c.bills} label="Bills" />
        </TabPanel>
        <TabPanel id="history">
          <History c={c} />
        </TabPanel>
      </Tabs>
    </>
  );
}

// C: what's owed now (or that nothing is), with the card, then the rest
function OwedFirst({ c }: { c: PaymentsCase }) {
  const nothing = !c.owed;
  return (
    <>
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
      {c.notices
        .filter((n) => n.tone === "info")
        .map((n) => (
          <Notice key={n.text}>{n.text}</Notice>
        ))}
      {c.weekly && (
        <Section
          title="Bills"
          description="One each Monday, for the week before."
        >
          <Bills bills={c.bills} label="Bills" />
        </Section>
      )}
      <Section title="History">
        <History c={c} />
      </Section>
    </>
  );
}
