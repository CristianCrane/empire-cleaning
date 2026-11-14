// PROTOTYPE: throwaway. The List layout (#433), on made-up data, at
// /prototype/list?layout=A..C&case=1..7 (no sign-in), inside the real
// AppLayout and nav of each case's area. ↑/↓ switch layouts, ←/→ switch
// cases. Lives only on prototype-list.
import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Archive,
  BrushCleaning,
  CalendarClock,
  CalendarX,
  ClipboardPenLine,
  Clock,
  FilePen,
  History,
  Inbox,
  ListIcon,
  Plus,
  Search,
  SearchX,
  Send,
  Sparkles,
  UserCheck,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { formats } from "@empire-cleaning/models";
import {
  AppLayout,
  Button,
  Cell,
  Column,
  DateTile,
  EmptyState,
  Heading,
  List,
  ListItem,
  MenuButton,
  MenuItem,
  type NavItem,
  Row,
  Section,
  StatusBadge,
  type StatusTone,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableHeader,
  Tabs,
  TextField,
  showToast,
} from "@empire-cleaning/ui";
import { areaLabels, type AreaId } from "../session.ts";
import { navFor } from "./AreaLayout.tsx";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";

const { formatDateTime, formatMoney, formatMonth } = formats.en;

// ---- the shape of a List, as every layout reads it ----

type Badge = { tone: StatusTone; label: string };

type Item = {
  id: string;
  // the Tab it's under
  tab: string;
  // when, for a dated thing: grouped by month, a DateTile leading it
  at?: string;
  // the row's name, and its one muted line on a phone
  title: string;
  line: string;
  // a desktop Table's cells, by column; the first column is the title
  cells: Record<string, ReactNode>;
  // where it stands, always (a Table's Status column)
  status?: Badge;
  // only when it isn't plain, for a List that badges only those
  badge?: Badge;
  // the words a search looks through
  words: string;
};

type Col = { id: string; label: string; from?: "md" | "lg" };

type TabDef = { id: string; label: string; icon: LucideIcon; none: string };

type ListCase = {
  key: string;
  name: string;
  area: AreaId;
  navLabel: string;
  title: string;
  // the page's one primary: making a new one
  primary?: { label: string; icon: LucideIcon };
  // work: an Office list that grows without end (Jobs, Quotes, Clients);
  // short: a handful the Office keeps (Services, Staff); dated: a Client's
  // or Cleaner's own, by when (Cleans, Offers)
  kind: "work" | "short" | "dated";
  // the first is the default
  tabs?: TabDef[];
  // the last Tab is rare (Retired): A and B fold it at the foot
  foldLast?: boolean;
  noun: string;
  searchLabel?: string;
  placeholder?: string;
  // the search as it starts (a search that matches nothing)
  query?: string;
  columns: Col[];
  items: Item[];
  // nothing at all, ever: what's missing, and what fills it
  empty: {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: string;
  };
};

const PAGE = 50;

const say = (title: string) => () => showToast({ title, tone: "info" });

// ---- made-up data, the same every load ----

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seeded(433);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

// an instant `days` from Sat Nov 14 2026, in the morning in New York
const day = (days: number, hourUtc = 14) =>
  new Date(Date.UTC(2026, 10, 14 + days, hourUtc)).toISOString();

const firsts = [
  "Maria",
  "James",
  "Aisha",
  "Daniel",
  "Priya",
  "Tom",
  "Grace",
  "Luis",
  "Hannah",
  "Omar",
  "Chloe",
  "Ben",
  "Sofia",
  "Marcus",
  "Elena",
  "Kwame",
  "Rachel",
  "Diego",
  "Nina",
  "Sam",
  "Yuki",
  "Ada",
  "Leo",
  "Fatima",
  "Iris",
  "Noah",
];
const lasts = [
  "Lopez",
  "Okafor",
  "Chen",
  "Murphy",
  "Patel",
  "Rossi",
  "Kim",
  "Brennan",
  "Haddad",
  "Novak",
  "Silva",
  "Walsh",
  "Cohen",
  "Nguyen",
  "Adeyemi",
  "Fischer",
  "Moreno",
  "Shah",
  "Larsen",
  "Duarte",
  "Rivera",
  "Goldberg",
  "Ito",
  "Kowalski",
  "Byrne",
];
const streets = [
  "Halsey St",
  "Bergen St",
  "Court St",
  "Atlantic Ave",
  "Clinton Ave",
  "Prospect Pl",
  "DeKalb Ave",
  "Union St",
  "Smith St",
  "Lafayette Ave",
  "Greene Ave",
  "Vanderbilt Ave",
  "President St",
  "Carroll St",
  "Myrtle Ave",
  "Franklin Ave",
  "Bedford Ave",
  "Henry St",
];

type Client = {
  name: string;
  email: string;
  phone: string;
  street: string;
  homes: number;
  standing: "active" | "quoting" | "past";
};

const clients: Client[] = (() => {
  const out: Client[] = [];
  const seen = new Set<string>();
  const want = { active: 186, quoting: 14, past: 402 };
  for (const standing of ["active", "quoting", "past"] as const) {
    let n = 0;
    while (n < want[standing]) {
      const first = pick(firsts);
      const last = pick(lasts);
      const name = seen.has(`${first} ${last}`)
        ? `${first} ${last.slice(0, 1)}. ${pick(lasts)}`
        : `${first} ${last}`;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        name,
        email:
          `${first}.${last}${n % 7 === 0 ? n : ""}@gmail.com`.toLowerCase(),
        phone: `(718) 555-${String(1000 + Math.floor(rand() * 9000))}`,
        street: `${1 + Math.floor(rand() * 600)} ${pick(streets)}`,
        homes: rand() < 0.12 ? 2 : 1,
        standing,
      });
      n++;
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
})();

const services = ["Standard clean", "Deep clean", "Move-out clean"] as const;

const staffed: Badge = { tone: "info", label: "Staffed" };
const needsCleaners: Badge = { tone: "warning", label: "Needs cleaners" };
const completed: Badge = { tone: "success", label: "Completed" };
const noAccess: Badge = { tone: "danger", label: "No access" };
const cancelled: Badge = { tone: "neutral", label: "Cancelled" };

const jobItems: Item[] = (() => {
  const active = clients.filter((c) => c.standing === "active");
  const make = (
    id: number,
    tab: string,
    at: string,
    status: Badge,
    plain: boolean,
    client: Client,
  ): Item => {
    const service = pick(services);
    return {
      id: `job-${id}`,
      tab,
      at,
      title: formatDateTime(at),
      line: `${client.name} · ${client.street}`,
      cells: {
        when: formatDateTime(at),
        client: client.name,
        home: client.street,
        service,
        status: <StatusBadge tone={status.tone}>{status.label}</StatusBadge>,
      },
      status,
      badge: plain ? undefined : status,
      words: `${client.name} ${client.street}`,
    };
  };
  const hours = [13, 14, 15, 17, 18];
  const out: Item[] = [];
  for (let i = 0; i < 312; i++) {
    const needs = i < 40 ? rand() < 0.3 : rand() < 0.08;
    out.push(
      make(
        i,
        "upcoming",
        day(1 + Math.floor((i * 120) / 312), pick(hours)),
        needs ? needsCleaners : staffed,
        !needs,
        pick(active),
      ),
    );
  }
  for (let i = 0; i < 1204; i++) {
    const missed = rand() < 0.03;
    out.push(
      make(
        1000 + i,
        "past",
        day(-(1 + Math.floor((i * 700) / 1204)), pick(hours)),
        missed ? noAccess : completed,
        !missed,
        pick(clients),
      ),
    );
  }
  for (let i = 0; i < 48; i++) {
    out.push(
      make(
        3000 + i,
        "cancelled",
        day(40 - Math.floor((i * 260) / 48), pick(hours)),
        cancelled,
        true,
        pick(clients),
      ),
    );
  }
  return out;
})();

const quoteStatus: Record<string, Badge> = {
  requested: { tone: "warning", label: "Requested" },
  draft: { tone: "neutral", label: "Draft" },
  sent: { tone: "info", label: "Sent" },
  expired: { tone: "warning", label: "Expired" },
};

const quoteItems: Item[] = (() => {
  const plan = [
    "Standard clean plan",
    "Deep clean",
    "Standard clean",
    "Move-out clean",
  ];
  const counts = { requested: 6, draft: 4, sent: 9, expired: 4 };
  const out: Item[] = [];
  let id = 0;
  for (const [status, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      const client = pick(clients);
      const service = pick(plan);
      const waited =
        status === "requested"
          ? i
          : status === "expired"
            ? 31 + i * 4
            : 2 + i * 2;
      const total =
        status === "requested" ? null : 14000 + Math.floor(rand() * 30) * 1000;
      const siteVisit = status === "requested" && i === 1;
      const badge = quoteStatus[status]!;
      out.push({
        id: `quote-${id++}`,
        tab: status,
        title: client.name,
        line: `${client.street} · ${service}`,
        cells: {
          client: client.name,
          home: client.street,
          service,
          status: (
            <span className="flex flex-wrap gap-1">
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
              {siteVisit && (
                <StatusBadge tone="warning">Needs a site visit</StatusBadge>
              )}
            </span>
          ),
          total: total === null ? "—" : formatMoney(total),
          waiting:
            waited === 0 ? "today" : waited === 1 ? "1 day" : `${waited} days`,
        },
        status: badge,
        // in a view of one status, that status is plain
        badge: siteVisit
          ? { tone: "warning", label: "Needs a site visit" }
          : undefined,
        words: `${client.name} ${client.street}`,
      });
    }
  }
  return out;
})();

const clientItems: Item[] = clients.map((c, i) => ({
  id: `client-${i}`,
  tab: c.standing,
  title: c.name,
  line: c.homes > 1 ? `${c.street} · 2 homes` : c.street,
  cells: {
    client: c.name,
    home: c.homes > 1 ? `${c.street} + 1 more` : c.street,
    email: c.email,
    phone: c.phone,
  },
  words: `${c.name} ${c.email} ${c.phone} ${c.street}`,
}));

const serviceItems: Item[] = [
  ["Standard clean", "By size", 5500, "active"],
  ["Deep clean", "By rooms", 6500, "active"],
  ["Move-out clean", "By rooms", 7000, "active"],
  ["Office clean", "By size", 5000, "active"],
  ["Spring clean", "By size", 6000, "retired"],
  ["Post-construction", "By rooms", 8000, "retired"],
].map(([name, method, rate, tab], i) => ({
  id: `service-${i}`,
  tab: tab as string,
  title: name as string,
  line: `${method as string} · ${formatMoney(rate as number)}/hr`,
  cells: {
    name,
    method,
    rate: `${formatMoney(rate as number)}/hr`,
  },
  words: name as string,
}));

const cleanItems: Item[] = (
  [
    [7, "upcoming", undefined],
    [21, "upcoming", { tone: "info", label: "Moved" }],
    [35, "upcoming", undefined],
    [-21, "past", { tone: "warning", label: "Payment due" }],
    [-35, "past", undefined],
    [-49, "past", undefined],
    [-63, "past", undefined],
    [-77, "past", undefined],
  ] as const
).map(([days, tab, badge], i) => {
  const at = day(days, 14);
  return {
    id: `clean-${i}`,
    tab,
    at,
    title: formatDateTime(at),
    line: "482 Halsey St · Standard clean",
    cells: {},
    badge: badge as Badge | undefined,
    status: badge as Badge | undefined,
    words: "",
  };
});

// ---- the cases ----

const jobsCase: ListCase = {
  key: "1",
  name: "Office Jobs, busiest",
  area: "office",
  navLabel: "Jobs",
  title: "Jobs",
  kind: "work",
  noun: "jobs",
  searchLabel: "Search jobs",
  placeholder: "Client or address",
  tabs: [
    {
      id: "upcoming",
      label: "Upcoming",
      icon: CalendarClock,
      none: "No jobs booked.",
    },
    { id: "past", label: "Past", icon: History, none: "No jobs done yet." },
    {
      id: "cancelled",
      label: "Cancelled",
      icon: CalendarX,
      none: "No jobs cancelled.",
    },
  ],
  columns: [
    { id: "when", label: "When" },
    { id: "client", label: "Client" },
    { id: "home", label: "Home" },
    { id: "service", label: "Service", from: "lg" },
    { id: "status", label: "Status" },
  ],
  items: jobItems,
  empty: { icon: BrushCleaning, title: "No jobs yet" },
};

const quotesCase: ListCase = {
  key: "2",
  name: "Office Quotes, status Tabs",
  area: "office",
  navLabel: "Quotes",
  title: "Quotes",
  primary: { label: "New quote", icon: FilePen },
  kind: "work",
  noun: "quotes",
  searchLabel: "Search quotes",
  placeholder: "Client, business or address",
  tabs: [
    {
      id: "requested",
      label: "Requested",
      icon: Inbox,
      none: "No quotes asked for.",
    },
    { id: "draft", label: "Draft", icon: ClipboardPenLine, none: "No drafts." },
    {
      id: "sent",
      label: "Sent",
      icon: Send,
      none: "No quotes waiting on a client.",
    },
    {
      id: "expired",
      label: "Expired",
      icon: Clock,
      none: "No expired quotes.",
    },
  ],
  columns: [
    { id: "client", label: "Client" },
    { id: "home", label: "Home" },
    { id: "service", label: "Service", from: "lg" },
    { id: "status", label: "Status" },
    { id: "total", label: "Total", from: "md" },
    { id: "waiting", label: "Waiting", from: "lg" },
  ],
  items: quoteItems,
  empty: {
    icon: FilePen,
    title: "No quotes yet",
    action: "New quote",
  },
};

const clientsCase: ListCase = {
  key: "3",
  name: "Office Clients, many rows",
  area: "office",
  navLabel: "Clients",
  title: "Clients",
  kind: "work",
  noun: "clients",
  searchLabel: "Search clients",
  placeholder: "Name, email, phone or address",
  tabs: [
    {
      id: "active",
      label: "Active",
      icon: UserCheck,
      none: "No active clients.",
    },
    {
      id: "quoting",
      label: "Quoting",
      icon: FilePen,
      none: "No clients waiting on a quote.",
    },
    { id: "past", label: "Past", icon: UserX, none: "No past clients." },
  ],
  columns: [
    { id: "client", label: "Client" },
    { id: "home", label: "Home", from: "md" },
    { id: "email", label: "Email", from: "lg" },
    { id: "phone", label: "Phone", from: "lg" },
  ],
  items: clientItems,
  empty: { icon: UserCheck, title: "No clients yet" },
};

const servicesCase: ListCase = {
  key: "4",
  name: "Office Services, a short list",
  area: "office",
  navLabel: "Services",
  title: "Services",
  primary: { label: "New service", icon: Plus },
  kind: "short",
  noun: "services",
  tabs: [
    {
      id: "active",
      label: "Offered",
      icon: Sparkles,
      none: "No services offered.",
    },
    { id: "retired", label: "Retired", icon: Archive, none: "None retired." },
  ],
  foldLast: true,
  columns: [
    { id: "name", label: "Service" },
    { id: "method", label: "How long", from: "md" },
    { id: "rate", label: "Hourly rate" },
  ],
  items: serviceItems,
  empty: {
    icon: Sparkles,
    title: "No services yet",
    action: "New service",
  },
};

const cleansCase: ListCase = {
  key: "5",
  name: "Client portal Cleans, few",
  area: "portal",
  navLabel: "Cleans",
  title: "Your cleans",
  kind: "dated",
  noun: "cleans",
  tabs: [
    {
      id: "upcoming",
      label: "Upcoming",
      icon: CalendarClock,
      none: "No cleans booked.",
    },
    { id: "past", label: "Past", icon: History, none: "No cleans yet." },
  ],
  columns: [],
  items: cleanItems,
  empty: { icon: BrushCleaning, title: "No cleans yet" },
};

const offersCase: ListCase = {
  key: "6",
  name: "Cleaner Offers, empty",
  area: "cleaner",
  navLabel: "Offers",
  title: "Offers",
  kind: "dated",
  noun: "offers",
  columns: [],
  items: [],
  empty: {
    icon: Inbox,
    title: "Nothing open to you right now",
    description: "When a job needs someone while you're free, it shows here.",
  },
};

const noMatchCase: ListCase = {
  ...clientsCase,
  key: "7",
  name: "Office Clients, a search that matches nothing",
  query: "Pemberton",
};

const cases = [
  jobsCase,
  quotesCase,
  clientsCase,
  servicesCase,
  cleansCase,
  offersCase,
  noMatchCase,
];

// ---- the layouts ----

const layouts = [
  { key: "A", name: "Every tool in view" },
  { key: "B", name: "The list leads, tools behind a tap" },
  { key: "C", name: "Tabs lead, a Table on desktop, rows on a phone" },
] as const;

type LayoutKey = (typeof layouts)[number]["key"];

const notes: Record<LayoutKey, { idea: string; shows: string; hides: string }> =
  {
    A: {
      idea: "The rules as they stand, one layout. Title (in the phone's bar), New … at the end. An Office work list: a search box, Tabs with counts, All last, then a Table. A Client's or Cleaner's list: Tabs, then Lists by month. A short list: a Table alone.",
      shows:
        "The search, every Tab and its count, 50 rows. On a phone the Table keeps its name and Status columns; who and where stack under the name.",
      hides:
        '50 more behind Show more ("Showing 50 of 312"). Retired Services behind Show 2. With nothing at all: one card with its action, no search or Tabs. No match: a line in the Table and Clear search.',
    },
    B: {
      idea: "Every List is rows, never a Table, the same at every width. Anything dated is by month with a date tile, the Office's Jobs too. A row is badged only when it isn't plain (Needs cleaners, not Staffed).",
      shows:
        "The default view's rows, with nothing above them but a view button (Upcoming 312 ▾), the search icon and New ….",
      hides:
        "The search behind its icon (it looks through every view). Other views (Past, Cancelled, All) in the view menu. A Table's extra columns (email, phone, total): on the detail page. Retired, folded at the foot. No match: a card with Clear search.",
    },
    C: {
      idea: "Tabs are the one way a list splits, Services' Retired too, with no All: a search looks through every Tab, and the Tabs give way to its results. An Office list is a Table from md, the same rows as a List on a phone; a dated one is banded by month in both.",
      shows:
        "One line of Tabs with counts and, on a desktop, the search at its end; 50 rows.",
      hides:
        'On a phone, the search behind its icon in the header. Show more ("262 left"). Nothing at all with nothing to add (Offers): one quiet line, no card.',
    },
  };

export function ListPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const layout: LayoutKey =
    layouts.find((l) => l.key === search.layout)?.key ?? "A";
  const c = cases.find((x) => x.key === search.case) ?? jobsCase;
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/list",
      search: { case: c.key, layout, ...change },
      replace: true,
    });

  const nav: NavItem[] = navFor("en")[c.area].map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === c.navLabel || item.label === c.title,
    }),
  );

  return (
    <AppLayout area={areaLabels.en[c.area]} nav={nav} foot={() => null}>
      {/* room for the switchers, so they cover nothing of the page at rest */}
      <div aria-hidden className="h-24" />
      <LayoutNote key={layout} layout={layout} />
      {layout === "A" && <LayoutA key={c.key} c={c} />}
      {layout === "B" && <LayoutB key={c.key} c={c} />}
      {layout === "C" && <LayoutC key={c.key} c={c} />}
      <PrototypeSwitcher
        variants={layouts.map((l) => ({ key: l.key, name: l.name }))}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="top-16 md:top-3"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={c.key}
        onChange={(k) => go({ case: k })}
        className="top-28 md:top-15"
      />
    </AppLayout>
  );
}

// what this layout's first view shows and hides: the prototype's, not the
// design's (dashed, dismissible)
function LayoutNote({ layout }: { layout: LayoutKey }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const note = notes[layout];
  return (
    <div className="mb-6 flex items-start gap-3 rounded-md border-2 border-dashed border-border p-3 text-sm">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p>
          <strong>Layout {layout}.</strong> {note.idea}
        </p>
        <p>
          <strong>First view:</strong> {note.shows}
        </p>
        <p>
          <strong>Behind a tap:</strong> {note.hides}
        </p>
      </div>
      <Button
        variant="quiet"
        size="icon"
        aria-label="Hide the note"
        onPress={() => setOpen(false)}
      >
        <X aria-hidden size={18} />
      </Button>
    </div>
  );
}

// ---- what every layout shares ----

// the search, the Tab and how many are shown, and what they leave
function useList(c: ListCase) {
  const [q, setQ] = useState(c.query ?? "");
  const [tab, setTabState] = useState(c.tabs?.[0]?.id ?? "all");
  const [shown, setShown] = useState(PAGE);
  const needle = q.trim().toLowerCase();
  const matching = needle
    ? c.items.filter((i) => i.words.toLowerCase().includes(needle))
    : c.items;
  const inTab = (t: string) =>
    t === "all" ? matching : matching.filter((i) => i.tab === t);
  return {
    q,
    needle,
    setQ: (text: string) => {
      setQ(text);
      setShown(PAGE);
    },
    tab,
    setTab: (t: string) => {
      setTabState(t);
      setShown(PAGE);
    },
    shown,
    more: () => setShown((n) => n + PAGE),
    inTab,
  };
}

// the page header, as Layouts 3's PageHeader would carry it for a List: no
// crumbs (a nav section's own page), the title in the phone's top bar, and
// the one primary at the end of the title row
function ListHeader({ c, extra }: { c: ListCase; extra?: ReactNode }) {
  return (
    <header className="flex min-h-touch items-center gap-2">
      <div className="min-w-0 flex-1">
        <Heading level={1} inBar>
          {c.title}
        </Heading>
      </div>
      {extra}
      {c.primary && (
        <Button onPress={say(`${c.primary.label} would open here`)}>
          <c.primary.icon aria-hidden size={18} />
          {c.primary.label}
        </Button>
      )}
    </header>
  );
}

const ALL: TabDef = { id: "all", label: "All", icon: ListIcon, none: "" };

const colClass = (col: Col, i: number) =>
  i === 0 || col.id === "status"
    ? undefined
    : col.from === "lg"
      ? "hidden lg:table-cell"
      : "hidden md:table-cell";

const byMonth = (items: Item[]) => {
  const months: { month: string; items: Item[] }[] = [];
  for (const item of items) {
    const month = formatMonth(item.at!.slice(0, 10));
    if (months.at(-1)?.month !== month) months.push({ month, items: [] });
    months.at(-1)!.items.push(item);
  }
  return months;
};

const open = (c: ListCase) => (id: unknown) =>
  say(`Opens ${c.items.find((i) => i.id === id)?.title ?? "it"}`)();

// a Table of the rows; on a phone (stacked), the first cell carries the
// row's line under its name, and only the name and Status columns stay
function RowsTable({
  c,
  items,
  stacked,
  bands,
  empty,
}: {
  c: ListCase;
  items: Item[];
  stacked?: boolean;
  // dated: a month's band before its rows
  bands?: boolean;
  empty: ReactNode;
}) {
  const cols = c.columns;
  const row = (item: Item) => (
    <Row key={item.id} id={item.id} className="cursor-pointer">
      {cols.map((col, i) => (
        <Cell key={col.id} className={colClass(col, i)}>
          {i === 0 ? (
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{item.cells[col.id]}</span>
              {stacked && (
                <span className="text-sm text-fg-muted md:hidden">
                  {item.line}
                </span>
              )}
            </span>
          ) : (
            item.cells[col.id]
          )}
        </Cell>
      ))}
    </Row>
  );
  const body = bands
    ? byMonth(items).flatMap(({ month, items }) => [
        <Row key={`m-${month}`} id={`m-${month}`}>
          <Cell
            colSpan={cols.length}
            className="bg-surface-sunken py-2 text-xs font-bold tracking-wide text-fg-muted uppercase"
          >
            {month}
          </Cell>
        </Row>,
        ...items.map(row),
      ])
    : items.map(row);
  return (
    <Table
      aria-label={c.title}
      onRowAction={(id) => {
        if (!String(id).startsWith("m-")) open(c)(id);
      }}
    >
      <TableHeader>
        {cols.map((col, i) => (
          <Column
            key={col.id}
            id={col.id}
            isRowHeader={i === 0}
            className={colClass(col, i)}
          >
            {col.label}
          </Column>
        ))}
      </TableHeader>
      <TableBody renderEmptyState={() => empty}>{body}</TableBody>
    </Table>
  );
}

// rows; dated ones by month, a small DateTile leading each. `badge`: which
// badge a row carries (all its status, or only one that isn't plain)
function Rows({
  c,
  items,
  badge,
}: {
  c: ListCase;
  items: Item[];
  badge: "status" | "badge";
}) {
  const item = (i: Item) => {
    const b = i[badge];
    return (
      <ListItem
        key={i.id}
        id={i.id}
        title={i.title}
        description={i.line}
        start={i.at ? <DateTile date={i.at} size="sm" /> : undefined}
        end={b ? <StatusBadge tone={b.tone}>{b.label}</StatusBadge> : undefined}
      />
    );
  };
  const dated = items.length > 0 && items.every((i) => i.at);
  if (!dated)
    return (
      <List aria-label={c.title} onAction={open(c)}>
        {items.map(item)}
      </List>
    );
  return (
    <div className="flex flex-col gap-6">
      {byMonth(items).map(({ month, items }) => (
        <section key={month} className="flex flex-col gap-2">
          <Heading level={2} size={4} className="text-fg-muted">
            {month}
          </Heading>
          <List aria-label={`${c.title}, ${month}`} onAction={open(c)}>
            {items.map(item)}
          </List>
        </section>
      ))}
    </div>
  );
}

function NoneLine({ children }: { children: ReactNode }) {
  return <p className="p-6 text-center text-fg-muted">{children}</p>;
}

function SearchBox({
  c,
  value,
  onChange,
  autoFocus,
  className,
}: {
  c: ListCase;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <TextField
      label={c.searchLabel ?? "Search"}
      type="search"
      placeholder={c.placeholder}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      className={className}
    />
  );
}

// ---- A: every tool in view, the rules as they stand ----

function LayoutA({ c }: { c: ListCase }) {
  const s = useList(c);
  const [showRetired, setShowRetired] = useState(false);
  // while searching, All: the one looked for may be in any Tab
  const [picked, setPicked] = useState(false);

  if (c.items.length === 0)
    return (
      <div className="flex flex-col gap-6">
        <ListHeader c={c} />
        <EmptyState
          icon={c.empty.icon}
          title={c.empty.title}
          description={c.empty.description}
        >
          {c.empty.action && (
            <Button onPress={say(`${c.empty.action} would open here`)}>
              {c.empty.action}
            </Button>
          )}
        </EmptyState>
      </div>
    );

  const own = c.tabs && c.foldLast ? c.tabs.slice(0, -1) : (c.tabs ?? []);
  const tabs = c.kind === "work" ? [...own, ALL] : own;
  const tab = s.needle && !picked && c.kind === "work" ? "all" : s.tab;

  const content = (t: TabDef | undefined) => {
    const all = s.inTab(t?.id ?? "all");
    const page = all.slice(0, s.shown);
    const none = s.needle ? (
      <div className="flex flex-col items-center gap-2 p-6">
        <p className="text-fg-muted">
          No {c.noun} match “{s.q.trim()}”.
        </p>
        <Button variant="text" onPress={() => s.setQ("")}>
          Clear search
        </Button>
      </div>
    ) : (
      <NoneLine>{t?.none || `No ${c.noun} yet.`}</NoneLine>
    );
    return (
      <div className="flex flex-col gap-4">
        {c.kind === "dated" ? (
          page.length ? (
            <Rows c={c} items={page} badge="badge" />
          ) : (
            none
          )
        ) : (
          <RowsTable c={c} items={page} stacked empty={none} />
        )}
        {page.length < all.length && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-fg-muted">
              Showing {page.length} of {all.length}
            </p>
            <Button variant="secondary" onPress={s.more}>
              Show more
            </Button>
          </div>
        )}
      </div>
    );
  };

  const retired = c.foldLast && c.tabs ? c.tabs.at(-1)! : undefined;
  const retiredItems = retired ? s.inTab(retired.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <ListHeader c={c} />
      {c.kind === "work" && (
        <SearchBox
          c={c}
          value={s.q}
          onChange={(v) => {
            s.setQ(v);
            setPicked(false);
          }}
        />
      )}
      {tabs.length > 1 ? (
        <Tabs
          selectedKey={tab}
          onSelectionChange={(k) => {
            s.setTab(String(k));
            setPicked(true);
          }}
        >
          <TabList aria-label="Where they stand">
            {tabs.map((t) => (
              <Tab key={t.id} id={t.id} count={s.inTab(t.id).length}>
                {t.label}
              </Tab>
            ))}
          </TabList>
          {tabs.map((t) => (
            <TabPanel key={t.id} id={t.id}>
              {content(t)}
            </TabPanel>
          ))}
        </Tabs>
      ) : (
        content(tabs[0])
      )}
      {retired && retiredItems.length > 0 && (
        <Section
          title={retired.label}
          actions={
            <Button variant="text" onPress={() => setShowRetired((v) => !v)}>
              {showRetired ? "Hide" : `Show ${retiredItems.length}`}
            </Button>
          }
        >
          {showRetired && (
            <RowsTable c={c} items={retiredItems} stacked empty={null} />
          )}
        </Section>
      )}
    </div>
  );
}

// ---- B: the list leads, tools behind a tap ----

function LayoutB({ c }: { c: ListCase }) {
  const s = useList(c);
  const [searching, setSearching] = useState(!!c.query);
  const [showRetired, setShowRetired] = useState(false);

  const searchButton = c.kind === "work" && !searching && (
    <Button
      variant="quiet"
      size="icon"
      aria-label={c.searchLabel}
      onPress={() => setSearching(true)}
    >
      <Search aria-hidden size={20} />
    </Button>
  );

  if (c.items.length === 0)
    return (
      <div className="flex flex-col gap-6">
        <ListHeader c={c} />
        <EmptyState icon={c.empty.icon} title={c.empty.title}>
          {c.empty.action && (
            <Button onPress={say(`${c.empty.action} would open here`)}>
              {c.empty.action}
            </Button>
          )}
        </EmptyState>
      </div>
    );

  const own = c.tabs && c.foldLast ? c.tabs.slice(0, -1) : (c.tabs ?? []);
  const views = c.kind === "work" ? [...own, ALL] : own;
  // a search looks through every view
  const view = s.needle ? ALL : (views.find((v) => v.id === s.tab) ?? views[0]);
  const all = s.inTab(view?.id ?? "all");
  const page = all.slice(0, s.shown);

  const retired = c.foldLast && c.tabs ? c.tabs.at(-1)! : undefined;
  const retiredItems = retired ? s.inTab(retired.id) : [];

  return (
    <div className="flex flex-col gap-4">
      <ListHeader c={c} extra={searchButton} />
      {searching && (
        <div className="flex items-end gap-2">
          <SearchBox
            c={c}
            value={s.q}
            onChange={s.setQ}
            autoFocus
            className="flex-1"
          />
          <Button
            variant="quiet"
            size="icon"
            aria-label="Close the search"
            onPress={() => {
              s.setQ("");
              setSearching(false);
            }}
          >
            <X aria-hidden size={20} />
          </Button>
        </div>
      )}
      {!s.needle && views.length > 1 && view && (
        <div>
          <MenuButton label={`${view.label} ${s.inTab(view.id).length}`}>
            {views.map((v) => (
              <MenuItem
                key={v.id}
                icon={v.icon}
                onAction={() => s.setTab(v.id)}
              >
                {`${v.label} · ${s.inTab(v.id).length.toLocaleString("en-US")}`}
              </MenuItem>
            ))}
          </MenuButton>
        </div>
      )}
      {s.needle && page.length > 0 && (
        <p className="text-sm text-fg-muted">{all.length} found</p>
      )}
      {page.length > 0 ? (
        // across statuses (All, a search), each row says where it stands
        <Rows
          c={c}
          items={page}
          badge={view?.id === "all" ? "status" : "badge"}
        />
      ) : s.needle ? (
        <EmptyState icon={SearchX} title={`No ${c.noun} match “${s.q.trim()}”`}>
          <Button variant="secondary" onPress={() => s.setQ("")}>
            Clear search
          </Button>
        </EmptyState>
      ) : (
        <NoneLine>{view?.none}</NoneLine>
      )}
      {page.length < all.length && (
        <Button variant="text" className="self-center" onPress={s.more}>
          Show more
        </Button>
      )}
      {retired && retiredItems.length > 0 && !s.needle && (
        <div className="flex flex-col gap-3 pt-4">
          <Button
            variant="text"
            className="self-start"
            onPress={() => setShowRetired((v) => !v)}
          >
            {showRetired ? "Hide retired" : `Retired (${retiredItems.length})`}
          </Button>
          {showRetired && <Rows c={c} items={retiredItems} badge="badge" />}
        </div>
      )}
    </div>
  );
}

// ---- C: Tabs lead, a Table on a desktop, rows on a phone ----

function LayoutC({ c }: { c: ListCase }) {
  const s = useList(c);
  const [phoneSearch, setPhoneSearch] = useState(!!c.query);

  const searchIcon = c.kind === "work" && (
    <span className="md:hidden">
      <Button
        variant="quiet"
        size="icon"
        aria-label={c.searchLabel}
        onPress={() => setPhoneSearch((v) => !v)}
      >
        <Search aria-hidden size={20} />
      </Button>
    </span>
  );

  if (c.items.length === 0)
    return (
      <div className="flex flex-col gap-6">
        <ListHeader c={c} />
        {c.empty.action ? (
          <EmptyState icon={c.empty.icon} title={c.empty.title}>
            <Button onPress={say(`${c.empty.action} would open here`)}>
              {c.empty.action}
            </Button>
          </EmptyState>
        ) : (
          <p className="text-fg-muted">{c.empty.title}.</p>
        )}
      </div>
    );

  const tabs = c.tabs ?? [];
  const body = (items: Item[], none: ReactNode) => {
    const page = items.slice(0, s.shown);
    const left = items.length - page.length;
    const office = c.kind !== "dated";
    const dated = page.length > 0 && page.every((i) => i.at);
    return (
      <div className="flex flex-col gap-4">
        {office ? (
          <>
            <div className="hidden md:block">
              <RowsTable c={c} items={page} bands={dated} empty={none} />
            </div>
            <div className="md:hidden">
              {page.length ? <Rows c={c} items={page} badge="status" /> : none}
            </div>
          </>
        ) : page.length ? (
          <Rows c={c} items={page} badge="badge" />
        ) : (
          none
        )}
        {left > 0 && (
          <Button variant="secondary" className="self-center" onPress={s.more}>
            Show more ({left.toLocaleString("en-US")} left)
          </Button>
        )}
      </div>
    );
  };

  const desktopSearch = c.kind === "work" && (
    <SearchBox
      c={c}
      value={s.q}
      onChange={s.setQ}
      className="hidden w-72 md:flex [&_label]:sr-only"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <ListHeader c={c} extra={searchIcon} />
      {phoneSearch && (
        <SearchBox
          c={c}
          value={s.q}
          onChange={s.setQ}
          autoFocus
          className="md:hidden"
        />
      )}
      {s.needle ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">
              {s.inTab("all").length > 0
                ? `${s.inTab("all").length} found in every tab`
                : `No ${c.noun} match “${s.q.trim()}”`}
            </p>
            <div className="flex items-center gap-2">
              {desktopSearch}
              <Button variant="text" onPress={() => s.setQ("")}>
                Clear search
              </Button>
            </div>
          </div>
          {s.inTab("all").length > 0 && body(s.inTab("all"), null)}
        </>
      ) : tabs.length > 1 ? (
        <Tabs
          selectedKey={s.tab}
          onSelectionChange={(k) => s.setTab(String(k))}
        >
          <div className="flex items-end gap-4">
            <TabList aria-label="Where they stand" className="min-w-0 flex-1">
              {tabs.map((t) => (
                <Tab key={t.id} id={t.id} count={s.inTab(t.id).length}>
                  {t.label}
                </Tab>
              ))}
            </TabList>
            {desktopSearch}
          </div>
          {tabs.map((t) => (
            <TabPanel key={t.id} id={t.id}>
              {body(s.inTab(t.id), <NoneLine>{t.none}</NoneLine>)}
            </TabPanel>
          ))}
        </Tabs>
      ) : (
        body(s.inTab("all"), <NoneLine>No {c.noun} yet.</NoneLine>)
      )}
    </div>
  );
}
