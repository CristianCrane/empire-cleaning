// PROTOTYPE: throwaway. Lives only on prototype-today.
//
// /prototype/today?case=&layout= (no sign-in): Today without its one-day
// Schedule, and five ways to show what Needs attention when the list grows
// long. ↑/↓ switch layouts, ←/→ cases (how busy the day is).
//
// /prototype/nav-groups?case=&layout=: the Office nav in four groups, three
// ways of naming them. ↑/↓ switch namings, ←/→ the page you're on; the nav
// itself works too.

import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarDays,
  CalendarX,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CirclePause,
  ClipboardList,
  ContactRound,
  Hourglass,
  LayoutDashboard,
  Menu,
  Receipt,
  Repeat,
  Sparkles,
  Tag,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Card,
  DialogTrigger,
  Drawer,
  Heading,
  IconTile,
  Link,
  List,
  ListItem,
  Logo,
  Section,
  StatusBadge,
  ThemeToggle,
  type StatusTone,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { JobIcon, QuoteIcon } from "../icons.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

// ---- made-up Needs attention items ----

// which part of the work an item belongs to, and how soon it matters
type Area = "jobs" | "quotes" | "money";
type When = "now" | "soon" | "later";

type Kind =
  | "quote_requested"
  | "quote_expiring"
  | "quote_no_room"
  | "service_plan_due"
  | "job_unassigned"
  | "reschedule_requested"
  | "adjustments_reported"
  | "plan_visit_unplaced"
  | "job_unpaid"
  | "bill_unpaid"
  | "plan_on_hold";

// how each kind reads, as on today's Dashboard; `many` names a pile of them
const kinds: Record<
  Kind,
  {
    action: string;
    many: string;
    icon: LucideIcon;
    tone: StatusTone;
    area: Area;
  }
> = {
  quote_requested: {
    action: "Send a Quote",
    many: "Quotes to send",
    icon: QuoteIcon,
    tone: "info",
    area: "quotes",
  },
  quote_expiring: {
    action: "Follow up before it expires",
    many: "Quotes about to expire",
    icon: Hourglass,
    tone: "warning",
    area: "quotes",
  },
  quote_no_room: {
    action: "Pick another time for the Quote",
    many: "Quotes that need another time",
    icon: CalendarX,
    tone: "danger",
    area: "quotes",
  },
  service_plan_due: {
    action: "Quote a Service Plan",
    many: "Service Plans to quote",
    icon: Repeat,
    tone: "info",
    area: "quotes",
  },
  job_unassigned: {
    action: "Assign Staff",
    many: "Jobs that need Staff",
    icon: UserX,
    tone: "warning",
    area: "jobs",
  },
  reschedule_requested: {
    action: "Confirm or turn down the new time",
    many: "New times asked for",
    icon: CalendarClock,
    tone: "warning",
    area: "jobs",
  },
  adjustments_reported: {
    action: "Review extras Staff reported",
    many: "Extras to review",
    icon: ClipboardList,
    tone: "info",
    area: "jobs",
  },
  plan_visit_unplaced: {
    action: "Book the visit or skip it",
    many: "Plan visits with no room",
    icon: CalendarX,
    tone: "danger",
    area: "jobs",
  },
  job_unpaid: {
    action: "Collect the Balance",
    many: "Balances to collect",
    icon: CircleDollarSign,
    tone: "danger",
    area: "money",
  },
  bill_unpaid: {
    action: "Collect the Bill",
    many: "Bills to collect",
    icon: Receipt,
    tone: "danger",
    area: "money",
  },
  plan_on_hold: {
    action: "Collect what's owed to resume the plan",
    many: "Plans on hold",
    icon: CirclePause,
    tone: "warning",
    area: "money",
  },
};

const areas: { id: Area; title: string; icon: LucideIcon }[] = [
  { id: "jobs", title: "Jobs", icon: JobIcon },
  { id: "quotes", title: "Quotes", icon: QuoteIcon },
  { id: "money", title: "Money", icon: CircleDollarSign },
];

const whens: { id: When; title: string; description: string }[] = [
  {
    id: "now",
    title: "Do today",
    description: "A Job starts within a day, or a Client is waiting on you",
  },
  {
    id: "soon",
    title: "This week",
    description: "Before it holds anything up",
  },
  {
    id: "later",
    title: "When you can",
    description: "Nothing's waiting on these yet",
  },
];

type Item = {
  id: string;
  kind: Kind;
  client: string;
  detail: string;
  when: When;
  cents?: number;
};

let next = 0;
const item = (
  kind: Kind,
  client: string,
  detail: string,
  when: When,
  cents?: number,
): Item => ({ id: `${kind}-${next++}`, kind, client, detail, when, cents });

const busy: Item[] = [
  item(
    "job_unassigned",
    "Helen Park",
    "41-12 Bell Blvd · tomorrow 9:00 AM",
    "now",
  ),
  item(
    "quote_no_room",
    "Sofia Alvarez",
    "88 Elm St · Thu Nov 5, 9:00 AM is full",
    "now",
  ),
  item(
    "reschedule_requested",
    "The Thompsons",
    "12 Oak Ln · Wed 10:00 AM to Fri 1:00 PM",
    "now",
  ),
  item(
    "quote_requested",
    "Tom Rivera",
    "210-05 46th Ave · asked Oct 30",
    "now",
  ),
  item(
    "job_unassigned",
    "Grace Kim",
    "37-20 82nd St · tomorrow 1:00 PM",
    "now",
  ),
  item(
    "quote_expiring",
    "Ana Lopez",
    "9 Shore Rd · expires tomorrow 5:00 PM",
    "now",
  ),
  item("quote_requested", "Marcus Lee", "155 Main St · asked today", "soon"),
  item(
    "quote_requested",
    "Priya Shah",
    "68-11 Yellowstone Blvd · asked today",
    "soon",
  ),
  item("quote_requested", "Deb Walsh", "4 Cedar Ct · asked yesterday", "soon"),
  item(
    "job_unassigned",
    "Bell Blvd Pediatrics",
    "42-10 Bell Blvd · Wed 6:00 PM",
    "soon",
  ),
  item(
    "adjustments_reported",
    "Helen Park",
    "2 extras to review · 41-12 Bell Blvd · Oct 29",
    "soon",
  ),
  item(
    "plan_visit_unplaced",
    "Ray Chen",
    "77 Park Ave · Service Plan visit on Mon Nov 9: no room that day",
    "soon",
  ),
  item(
    "bill_unpaid",
    "Bell Blvd Pediatrics",
    "Bill 1042 · $640.00 · Oct 19 – 25",
    "soon",
    64000,
  ),
  item(
    "reschedule_requested",
    "Maya Ortiz",
    "301 Hill St · Mon 9:00 AM to Tue 9:00 AM",
    "soon",
  ),
  item(
    "job_unpaid",
    "Leo Brooks",
    "$180.00 owed · 52 Grove St · Oct 27",
    "later",
    18000,
  ),
  item(
    "plan_on_hold",
    "Nina Patel",
    "16 Birch Rd · Service Plan: $95.00 Unpaid, no new Jobs booked",
    "later",
    9500,
  ),
  item(
    "job_unpaid",
    "Sam Green",
    "$95.00 owed · 8 Pine Pl · Oct 22",
    "later",
    9500,
  ),
  item(
    "service_plan_due",
    "Sofia Alvarez",
    "88 Elm St · First Clean done Oct 28, wants regular visits",
    "later",
  ),
];

const cases: { key: string; name: string; items: Item[] }[] = [
  { key: "1", name: "Busy: 18 waiting", items: busy },
  {
    key: "2",
    name: "Usual: 6 waiting",
    items: busy.filter((_, i) => [0, 2, 6, 7, 14, 17].includes(i)),
  },
  { key: "3", name: "Quiet: 1 waiting", items: [busy[6]!] },
  { key: "4", name: "All clear", items: [] },
];

const layouts = [
  { key: "A", name: "Current, one list" },
  { key: "B", name: "Grouped by Jobs, Quotes, Money" },
  { key: "C", name: "Count tiles that filter" },
  { key: "D", name: "By when it matters" },
  { key: "E", name: "Next up, the rest in piles" },
];

const order: When[] = ["now", "soon", "later"];
const byUrgency = (items: Item[]) =>
  [...items].sort((a, b) => order.indexOf(a.when) - order.indexOf(b.when));

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

// ---- Today ----

export function TodayPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const kase = cases.find((c) => c.key === search.case) ?? cases[0]!;
  const layout = layouts.find((l) => l.key === search.layout) ?? layouts[0]!;
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/today",
      search: { case: kase.key, layout: layout.key, ...change },
      replace: true,
    });
  const items = byUrgency(kase.items);

  return (
    <OfficeFrame naming={namings[1]!} current="today">
      <div className="flex flex-col gap-8">
        <Heading level={1} inBar>
          Today
        </Heading>
        {items.length === 0 ? (
          <AllClear />
        ) : (
          <>
            {layout.key === "A" && <OneList items={items} />}
            {layout.key === "B" && <ByArea key={kase.key} items={items} />}
            {layout.key === "C" && <Tiles key={kase.key} items={items} />}
            {layout.key === "D" && <ByWhen items={items} />}
            {layout.key === "E" && <NextUp key={kase.key} items={items} />}
          </>
        )}
      </div>
      <PrototypeSwitcher
        variants={layouts}
        current={layout.key}
        onChange={(key) => go({ layout: key })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-36 md:bottom-16"
      />
      <PrototypeSwitcher
        variants={cases}
        current={kase.key}
        onChange={(key) => go({ case: key })}
      />
    </OfficeFrame>
  );
}

function AllClear() {
  return (
    <Card className="items-center py-10 text-center">
      <IconTile icon={Sparkles} tone="success" size="lg" />
      <p className="text-lg font-semibold">Nothing needs you right now</p>
      <p className="text-sm text-fg-muted">
        New Quote requests and anything else that comes up shows here.
      </p>
    </Card>
  );
}

function Rows({ items, label }: { items: Item[]; label: string }) {
  return (
    <List aria-label={label}>
      {items.map((it) => {
        const k = kinds[it.kind];
        return (
          <ListItem
            key={it.id}
            id={it.id}
            textValue={`${k.action} ${it.client}`}
            title={k.action}
            description={
              <>
                <span className="font-semibold text-fg">{it.client}</span>
                {" · "}
                {it.detail}
              </>
            }
            start={<IconTile icon={k.icon} tone={k.tone} />}
            onAction={() => {}}
          />
        );
      })}
    </List>
  );
}

// A: as now, less the Schedule
function OneList({ items }: { items: Item[] }) {
  return (
    <Section title="Needs attention">
      <Rows items={items} label="Needs attention" />
    </Section>
  );
}

// B: a Section per part of the work, three shown, the rest behind Show more
const SHOWN = 3;
function ByArea({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<Area[]>([]);
  return (
    <>
      {areas.map((area) => {
        const mine = items.filter((it) => kinds[it.kind].area === area.id);
        if (mine.length === 0) return null;
        const isOpen = open.includes(area.id);
        const shown = isOpen ? mine : mine.slice(0, SHOWN);
        const owed = mine.reduce((sum, it) => sum + (it.cents ?? 0), 0);
        return (
          <Section
            key={area.id}
            title={area.title}
            description={
              area.id === "money"
                ? `${money(owed)} to collect`
                : `${mine.length} waiting`
            }
          >
            <Rows items={shown} label={area.title} />
            {mine.length > SHOWN && (
              <Button
                variant="text"
                size="sm"
                className="self-start"
                onPress={() =>
                  setOpen(
                    isOpen
                      ? open.filter((a) => a !== area.id)
                      : [...open, area.id],
                  )
                }
              >
                {isOpen ? "Show fewer" : `Show ${mine.length - SHOWN} more`}
              </Button>
            )}
          </Section>
        );
      })}
    </>
  );
}

// C: a tile per part of the work with its count; pressing one shows only it
function Tiles({ items }: { items: Item[] }) {
  const [only, setOnly] = useState<Area>();
  const shown = only
    ? items.filter((it) => kinds[it.kind].area === only)
    : items;
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {areas.map((area) => {
          const mine = items.filter((it) => kinds[it.kind].area === area.id);
          const urgent = mine.filter((it) => it.when === "now").length;
          const owed = mine.reduce((sum, it) => sum + (it.cents ?? 0), 0);
          const pressed = only === area.id;
          return (
            <button
              key={area.id}
              type="button"
              aria-pressed={pressed}
              disabled={mine.length === 0}
              onClick={() => setOnly(pressed ? undefined : area.id)}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left shadow-raised transition-colors disabled:opacity-50 sm:p-4 ${
                pressed
                  ? "border-primary bg-success-subtle"
                  : "border-border bg-surface hover:bg-surface-sunken"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
                <area.icon aria-hidden size={18} />
                {area.title}
              </span>
              <span className="font-display text-3xl font-bold">
                {mine.length}
              </span>
              <span className="text-xs text-fg-muted sm:text-sm">
                {area.id === "money" && owed > 0
                  ? `${money(owed)} owed`
                  : urgent > 0
                    ? `${urgent} today`
                    : mine.length > 0
                      ? "none today"
                      : "all clear"}
              </span>
            </button>
          );
        })}
      </div>
      <Section
        title={
          only ? areas.find((a) => a.id === only)!.title : "Needs attention"
        }
        actions={
          only && (
            <Button variant="text" size="sm" onPress={() => setOnly(undefined)}>
              Show all {items.length}
            </Button>
          )
        }
      >
        <Rows items={shown} label="Needs attention" />
      </Section>
    </>
  );
}

// D: a Section per how soon it matters
function ByWhen({ items }: { items: Item[] }) {
  return (
    <>
      {whens.map((when) => {
        const mine = items.filter((it) => it.when === when.id);
        if (mine.length === 0) return null;
        return (
          <Section
            key={when.id}
            title={`${when.title} (${mine.length})`}
            description={when.description}
          >
            <Rows items={mine} label={when.title} />
          </Section>
        );
      })}
    </>
  );
}

// E: the most pressing item large with its one Button; the rest in a pile
// per kind, opened in place
function NextUp({ items }: { items: Item[] }) {
  const [first, ...rest] = items;
  const [open, setOpen] = useState<Kind>();
  const k = kinds[first!.kind];
  const piles = Object.keys(kinds)
    .map((kind) => ({
      kind: kind as Kind,
      items: rest.filter((it) => it.kind === kind),
    }))
    .filter((p) => p.items.length > 0)
    .sort(
      (a, b) =>
        order.indexOf(a.items[0]!.when) - order.indexOf(b.items[0]!.when),
    );

  return (
    <>
      <Card>
        <div className="flex items-start gap-4">
          <IconTile icon={k.icon} tone={k.tone} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-semibold text-fg-muted">Next up</span>
            <span className="font-display text-2xl font-bold">{k.action}</span>
            <span>
              <span className="font-semibold">{first!.client}</span> ·{" "}
              {first!.detail}
            </span>
          </div>
        </div>
        <Button className="self-start">{k.action}</Button>
      </Card>
      {piles.length > 0 && (
        <Section title={`Also waiting (${rest.length})`}>
          <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
            {piles.map((pile) => {
              const pk = kinds[pile.kind];
              const isOpen = open === pile.kind;
              const one = pile.items.length === 1;
              return (
                <div
                  key={pile.kind}
                  className="border-b border-border last:border-b-0"
                >
                  <button
                    type="button"
                    aria-expanded={one ? undefined : isOpen}
                    onClick={() => setOpen(isOpen ? undefined : pile.kind)}
                    className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken"
                  >
                    <IconTile icon={pk.icon} tone={pk.tone} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">
                        {one ? pk.action : pk.many}
                      </span>
                      <span className="truncate text-sm text-fg-muted">
                        {pile.items.map((it) => it.client).join(", ")}
                      </span>
                    </span>
                    {!one && (
                      <StatusBadge tone={pk.tone}>
                        {pile.items.length}
                      </StatusBadge>
                    )}
                    {one ? (
                      <ChevronRight
                        aria-hidden
                        size={18}
                        className="text-fg-muted"
                      />
                    ) : (
                      <ChevronDown
                        aria-hidden
                        size={18}
                        className={`text-fg-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                  {isOpen && !one && (
                    <div className="border-t border-border bg-surface-sunken p-2">
                      <Rows items={pile.items} label={pk.many} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </>
  );
}

// ---- the nav, in groups ----

type PageId =
  | "today"
  | "schedule"
  | "jobs"
  | "quotes"
  | "clients"
  | "staff"
  | "services"
  | "price-list";
type Page = { id: PageId; label: string; icon: LucideIcon };

const groups: Page[][] = [
  [
    { id: "today", label: "Today", icon: LayoutDashboard },
    { id: "schedule", label: "Schedule", icon: CalendarDays },
  ],
  [
    { id: "jobs", label: "Jobs", icon: JobIcon },
    { id: "quotes", label: "Quotes", icon: QuoteIcon },
  ],
  [
    { id: "clients", label: "Clients", icon: ContactRound },
    { id: "staff", label: "Staff", icon: Users },
  ],
  [
    { id: "services", label: "Services", icon: Sparkles },
    { id: "price-list", label: "Price List", icon: Tag },
  ],
];
const pages = groups.flat();

// a title per group, or none (a gap and a rule between groups)
type Naming = { key: string; name: string; titles: (string | null)[] };
const namings: Naming[] = [
  {
    key: "A",
    name: "No names, a rule between",
    titles: [null, null, null, null],
  },
  {
    key: "B",
    name: "Work · People · Pricing",
    titles: [null, "Work", "People", "Pricing"],
  },
  {
    key: "C",
    name: "Daily · Bookings · People · Setup",
    titles: ["Daily", "Bookings", "People", "Setup"],
  },
];

function OfficeFrame({
  naming,
  current,
  hrefFor,
  children,
}: {
  naming: Naming;
  current: PageId;
  hrefFor?: (id: PageId) => ReturnType<typeof linkTo>;
  children: ReactNode;
}) {
  const href =
    hrefFor ??
    ((id: PageId) =>
      linkTo({
        to: "/prototype/nav-groups",
        search: { case: id, layout: naming.key },
      }));
  const label = pages.find((p) => p.id === current)!.label;

  const navGroups = (from: number, onPress?: () => void) =>
    groups.slice(from).map((group, i) => {
      const title = naming.titles[from + i];
      return (
        <div
          key={i}
          className={`flex flex-col gap-1 ${i > 0 ? (title ? "mt-4" : "mt-2 border-t border-border pt-3") : ""}`}
        >
          {title && (
            <span className="px-3 pb-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">
              {title}
            </span>
          )}
          {group.map((page) => (
            <NavLink
              key={page.id}
              page={page}
              href={href(page.id)}
              current={page.id === current}
              onPress={onPress}
            />
          ))}
        </div>
      );
    });

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface p-4 md:sticky md:top-0 md:flex md:h-dvh">
        <div className="flex flex-col items-center gap-3 px-2 pt-2">
          <Logo className="w-44" />
          <span className="text-sm text-fg-muted">Office</span>
        </div>
        <nav aria-label="Office" className="flex flex-1 flex-col">
          {navGroups(0)}
        </nav>
        <ThemeToggle />
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 md:hidden">
        <div className="flex min-w-0 items-center gap-1">
          <DialogTrigger>
            <Button
              variant="quiet"
              size="icon"
              aria-label="Menu"
              className="-ml-2 shrink-0"
            >
              <Menu aria-hidden size={22} />
            </Button>
            <Drawer aria-label="Menu">
              {({ close }) => (
                <>
                  <div className="flex flex-col items-center gap-3 px-2 pt-8">
                    <Logo className="w-44" />
                    <span className="text-sm text-fg-muted">Office</span>
                  </div>
                  {/* Today and the Schedule are in the tab bar */}
                  <nav aria-label="Office" className="flex flex-col">
                    {navGroups(1, close)}
                  </nav>
                </>
              )}
            </Drawer>
          </DialogTrigger>
          <span className="truncate font-display text-xl font-bold tracking-wide uppercase">
            {label}
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-4 pb-48 md:px-8 md:py-8 md:pb-32">
        {children}
      </main>

      <nav
        aria-label="Office"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden"
      >
        {groups[0]!.map((page) => (
          <Link
            key={page.id}
            href={href(page.id)}
            aria-current={page.id === current ? "page" : undefined}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-fg-muted no-underline current:text-primary"
          >
            <page.icon aria-hidden size={22} />
            {page.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function NavLink({
  page,
  href,
  current,
  onPress,
}: {
  page: Page;
  href: ReturnType<typeof linkTo>;
  current: boolean;
  onPress?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onPress={onPress}
      className="flex min-h-touch items-center gap-3 rounded-md px-3 font-semibold text-fg-muted no-underline hover:bg-surface-sunken hover:text-fg current:bg-success-subtle current:text-success-strong"
    >
      <page.icon aria-hidden size={20} />
      {page.label}
    </Link>
  );
}

export function NavGroupsPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const naming = namings.find((n) => n.key === search.layout) ?? namings[1]!;
  const current = pages.find((p) => p.id === search.case) ?? pages[0]!;
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/nav-groups",
      search: { case: current.id, layout: naming.key, ...change },
      replace: true,
    });

  return (
    <OfficeFrame naming={naming} current={current.id}>
      <div className="flex flex-col gap-4">
        <Heading level={1} inBar>
          {current.label}
        </Heading>
        <p className="text-fg-muted">
          (The {current.label} page.) On a phone, open the ☰ menu to see the
          groups there.
        </p>
      </div>
      <PrototypeSwitcher
        variants={namings}
        current={naming.key}
        onChange={(key) => go({ layout: key })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-36 md:bottom-16"
      />
      <PrototypeSwitcher
        variants={pages.map((p) => ({ key: p.id, name: p.label }))}
        current={current.id}
        onChange={(key) => go({ case: key })}
      />
    </OfficeFrame>
  );
}
