// PROTOTYPE: throwaway. The Home layout (#435), on made-up data, at
// /prototype/home?layout=A..C&case=1..7 (no sign-in), inside the real
// AppLayout and nav of each case's area. ↑/↓ switch layouts, ←/→ switch
// cases. Lives only on prototype-home.
import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  CirclePause,
  ClipboardList,
  CreditCard,
  Hourglass,
  Inbox,
  KeyRound,
  Navigation,
  Phone,
  Receipt,
  TriangleAlert,
  UserPlus,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { formats } from "@empire-cleaning/models";
import {
  AppLayout,
  Button,
  Card,
  CountTile,
  CountTiles,
  DatedItem,
  DateTile,
  Fold,
  Heading,
  IconTile,
  List,
  ListItem,
  type NavItem,
  Notice,
  PageHeader,
  Section,
  ShortcutTile,
  ShortcutTiles,
  StatusBadge,
  type StatusTone,
  showToast,
} from "@empire-cleaning/ui";
import { areaLabels, type AreaId } from "../session.ts";
import { navFor } from "./AreaLayout.tsx";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { JobIcon, QuoteIcon } from "./icons.ts";
import { linkTo } from "../links.ts";

// a tile or link goes nowhere: the prototype is one page
const here = linkTo({ to: "/prototype/home" });

const { formatDate, formatDateTime, formatTime, formatMoney } = formats.en;

const say = (title: string) => () => showToast({ title, tone: "info" });

// ---- made-up times, from today ----

// New York's day and hours, whatever the browser's time zone: the screens
// show New York's (formats), and these cases run November to January, so
// Eastern Standard Time, UTC-5
const nyToday = Object.fromEntries(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
    .formatToParts(new Date())
    .map((p) => [p.type, Number(p.value)]),
) as { year: number; month: number; day: number };
const at = (days: number, hours: number, minutes = 0) =>
  new Date(
    Date.UTC(
      nyToday.year,
      nyToday.month - 1,
      nyToday.day + days,
      hours + 5,
      minutes,
    ),
  ).toISOString();
const isToday = (iso: string) => formatDate(iso) === formatDate(new Date());
// "Today, 1:00 PM", or "Sat, Nov 15, 9:00 AM"
const when = (iso: string) =>
  isToday(iso) ? `Today, ${formatTime(iso)}` : formatDateTime(iso);

// ---- the shape of a Home, as every layout reads it ----

type Tile = { date: string } | { icon: LucideIcon; tone: StatusTone };

// the one card: what's next, or what's owed
type Answer = {
  tile: Tile;
  // the muted line above: what kind of answer it is
  label: string;
  headline: string;
  lines: string[];
  primary: { label: string; icon?: LucideIcon };
  // beside the primary, always there (a Cleaner's Directions)
  secondary?: { label: string; icon: LucideIcon };
  // B keeps a header Button's way in here, as a line ("Paying with … ·
  // Change")
  quiet?: { text: string; link: string };
};

// nothing next, nothing owed
type Clear = {
  icon: LucideIcon;
  title: string;
  action?: { label: string; icon?: LucideIcon };
};

// something else waiting on this person: an Office to-do (a row led by
// what to do), or a Client's (a Notice)
type Waiting = {
  key: string;
  tone: StatusTone;
  icon: LucideIcon;
  action: string;
  who?: string;
  line: string;
};

// a dated thing after the answer: a Job, a visit, a payment
type Dated = {
  id: string;
  at: string;
  title: string;
  description?: string;
  end?: ReactNode;
  // a payment's row: its day and its amount, no time
  day?: string;
};

type DatedList = {
  title: string;
  items: Dated[];
  // where all of them are: a List, or the Schedule
  all?: string;
};

// C's tiles: a count that opens its rows in place (no List holds them),
// or a shortcut that links to the List that does
type Tiles =
  | {
      kind: "count";
      label: string;
      groups: {
        id: string;
        icon: LucideIcon;
        label: string;
        count: number;
        hint?: string;
        rows?: Waiting[];
        dated?: Dated[];
        all?: string;
      }[];
    }
  | {
      kind: "links";
      links: { icon: LucideIcon; label: string; hint: string }[];
    };

type HomeView = {
  // the nav section's name, in the phone's top bar
  title: string;
  // C greets the person on the area's first page
  greeting?: string;
  // a secondary Button on the title's row (Request a quote, Your card)
  headerAction?: { label: string; icon: LucideIcon };
  answer: Answer | null;
  clear: Clear;
  waiting: Waiting[];
  waitingTitle: string;
  // the Office's are to-do rows; a Client's, Notices
  waitingAs: "rows" | "notices";
  // news, never an action (a bank payment clearing)
  info?: string[];
  dated: DatedList[];
  tiles: Tiles;
  // B's one line under the card, which opens the rest in place
  brief?: string;
};

type HomeCase = {
  key: string;
  name: string;
  area: AreaId;
  navLabel: string;
  view: HomeView;
};

// ---- the cases ----

// 1. the Office, the busiest day
const officeBusyWaiting: Waiting[] = [
  {
    key: "find2",
    tone: "warning",
    icon: UserX,
    action: "Find cleaners",
    who: "Hannah Okafor",
    line: `5 Clinton Ave · ${when(at(1, 8))}`,
  },
  {
    key: "q1",
    tone: "info",
    icon: QuoteIcon,
    action: "Send a quote",
    who: "Daniel Reyes",
    line: "41 Prospect Pl · asked today",
  },
  {
    key: "bill",
    tone: "danger",
    icon: Receipt,
    action: "Collect the bill",
    who: "Lena Ortiz",
    line: "Bill EC-1038 · $412.50 · week of Nov 2",
  },
  {
    key: "move",
    tone: "warning",
    icon: CalendarClock,
    action: "Confirm or turn down the new time",
    who: "Ava Chen",
    line: "18 Pierrepont St · Sat 9:00 AM to Mon 10:00 AM",
  },
  {
    key: "q2",
    tone: "info",
    icon: QuoteIcon,
    action: "Send a quote",
    who: "Priya Shah",
    line: "9 Union St · asked yesterday",
  },
  {
    key: "balance",
    tone: "danger",
    icon: CircleDollarSign,
    action: "Collect the balance",
    who: "Marcus Hill",
    line: "$186.00 owed · 77 Henry St · Nov 11",
  },
  {
    key: "expiring",
    tone: "warning",
    icon: Hourglass,
    action: "Follow up before it expires",
    who: "Sam Rivera",
    line: "63 Dean St · expires tomorrow, 5:00 PM",
  },
  {
    key: "q3",
    tone: "info",
    icon: QuoteIcon,
    action: "Send a quote",
    who: "Tom Becker",
    line: "210 Court St · asked Nov 12",
  },
  {
    key: "changes",
    tone: "info",
    icon: ClipboardList,
    action: "Review the cleaner's price changes",
    who: "Noor Haddad",
    line: "2 price changes · 12 Hicks St · Nov 13",
  },
  {
    key: "paused",
    tone: "warning",
    icon: CirclePause,
    action: "Collect what's owed to resume the plan",
    who: "Ben Walsh",
    line: "Cleaning plan paused: $642.00 unpaid",
  },
];

const needsCleaners = <StatusBadge tone="warning">Needs cleaners</StatusBadge>;

const officeBusyToday: Dated[] = [
  {
    id: "t1",
    at: at(0, 8),
    title: "Grace Murphy",
    description: "Standard Clean · 22 Bergen St · Rosa M., Ana P.",
  },
  {
    id: "t2",
    at: at(0, 9, 30),
    title: "Leo Park",
    description: "Deep Clean · 3 Wyckoff St · Maria L., Joy T.",
  },
  {
    id: "t3",
    at: at(0, 11),
    title: "Fatima Noor",
    description: "Standard Clean · 140 Smith St · Rosa M.",
  },
  {
    id: "t4",
    at: at(0, 13),
    title: "Grace Murphy",
    description: "Deep Clean · 22 Bergen St",
    end: needsCleaners,
  },
  {
    id: "t5",
    at: at(0, 14, 30),
    title: "Oscar Diaz",
    description: "Move-out Clean · 88 Warren St · Maria L., Joy T., Ana P.",
  },
  {
    id: "t6",
    at: at(0, 16),
    title: "Ruth Kim",
    description: "Standard Clean · 15 Strong Pl · Joy T.",
  },
];

const byTile = (keys: string[]) =>
  officeBusyWaiting.filter((w) => keys.includes(w.key));

const officeBusy: HomeView = {
  title: "Today",
  greeting: "Hi, Jen",
  answer: {
    tile: { date: at(0, 13) },
    label: "Needs cleaners",
    headline: "Today, 1:00 PM",
    lines: ["Deep Clean · 22 Bergen St", "Grace Murphy"],
    primary: { label: "Find cleaners", icon: UserPlus },
  },
  clear: { icon: CircleCheck, title: "Nothing needs you" },
  waiting: officeBusyWaiting,
  waitingTitle: "Needs you",
  waitingAs: "rows",
  dated: [
    { title: "On today", items: officeBusyToday, all: "Open the Schedule" },
  ],
  tiles: {
    kind: "count",
    label: "What else, by kind",
    groups: [
      {
        id: "today",
        icon: CalendarDays,
        label: "On today",
        count: 6,
        hint: "1 needs cleaners",
        dated: officeBusyToday,
        all: "Open the Schedule",
      },
      {
        id: "jobs",
        icon: JobIcon,
        label: "Jobs",
        count: 3,
        hint: "1 new time asked for",
        rows: byTile(["find2", "move", "changes"]),
      },
      {
        id: "quotes",
        icon: QuoteIcon,
        label: "Quotes",
        count: 4,
        hint: "3 asked for",
        rows: byTile(["q1", "q2", "q3", "expiring"]),
      },
      {
        id: "money",
        icon: CircleDollarSign,
        label: "Money",
        count: 3,
        hint: "$1,240.50 owed",
        rows: byTile(["bill", "balance", "paused"]),
      },
    ],
  },
  brief: "10 more need you · 6 jobs on today",
};

// 2. the Office, a quiet day
const officeQuietToday: Dated[] = [
  {
    id: "q1",
    at: at(0, 9),
    title: "Grace Murphy",
    description: "Standard Clean · 22 Bergen St · Rosa M., Ana P.",
  },
  {
    id: "q2",
    at: at(0, 12),
    title: "Leo Park",
    description: "Standard Clean · 3 Wyckoff St · Maria L.",
  },
  {
    id: "q3",
    at: at(0, 15),
    title: "Ruth Kim",
    description: "Standard Clean · 15 Strong Pl · Joy T.",
  },
];

const officeQuiet: HomeView = {
  title: "Today",
  greeting: "Hi, Jen",
  answer: null,
  clear: { icon: CircleCheck, title: "Nothing needs you" },
  waiting: [],
  waitingTitle: "Needs you",
  waitingAs: "rows",
  dated: [
    { title: "On today", items: officeQuietToday, all: "Open the Schedule" },
  ],
  tiles: {
    kind: "count",
    label: "What else, by kind",
    groups: [
      {
        id: "today",
        icon: CalendarDays,
        label: "On today",
        count: 3,
        hint: "All staffed",
        dated: officeQuietToday,
        all: "Open the Schedule",
      },
      { id: "jobs", icon: JobIcon, label: "Jobs", count: 0 },
      { id: "quotes", icon: QuoteIcon, label: "Quotes", count: 0 },
      { id: "money", icon: CircleDollarSign, label: "Money", count: 0 },
    ],
  },
  brief: "3 jobs on today, all staffed",
};

// 3. a Client: the next clean booked, nothing owed
const planCleans: Dated[] = [6 + 14, 6 + 28, 6 + 42].map((days, i) => ({
  id: `plan${i}`,
  at: at(days, 9),
  title: "Standard Clean",
}));

const clientBooked: HomeView = {
  title: "Home",
  greeting: "Hi, Grace",
  headerAction: { label: "Request a quote", icon: QuoteIcon },
  answer: {
    tile: { date: at(6, 9) },
    label: "Your next clean",
    headline: formatDateTime(at(6, 9)),
    lines: ["Standard Clean at 22 Bergen St", "Rosa and Ana, about 3 hours"],
    primary: { label: "See your clean" },
  },
  clear: { icon: CalendarCheck, title: "Nothing booked" },
  waiting: [],
  waitingTitle: "Waiting on you",
  waitingAs: "notices",
  dated: [{ title: "Coming up", items: planCleans, all: "All your cleans" }],
  tiles: {
    kind: "links",
    links: [
      { icon: CalendarClock, label: "Move or skip", hint: "Your Thu clean" },
      { icon: KeyRound, label: "How we get in", hint: "Key under the mat" },
      { icon: CreditCard, label: "Your card", hint: "Visa ending 4242" },
      { icon: Phone, label: "Call us", hint: "(718) 555-0142" },
    ],
  },
  brief: "Then every other Thursday · 3 more booked",
};

// 4. a Client: a payment failed, and a Quote to answer
const clientOwes: HomeView = {
  title: "Home",
  greeting: "Hi, Grace",
  headerAction: { label: "Request a quote", icon: QuoteIcon },
  answer: {
    tile: { icon: CreditCard, tone: "danger" },
    label: "Your payment didn't go through",
    headline: "$186.00",
    lines: ["For your Nov 12 clean. Your plan is paused until it's paid."],
    primary: { label: "Update your card", icon: CreditCard },
  },
  clear: { icon: CalendarCheck, title: "Nothing booked" },
  waiting: [
    {
      key: "quote",
      tone: "warning",
      icon: QuoteIcon,
      action: "See your quote",
      line: "Your quote is ready: Deep Clean at 9 Union St, $412.00.",
    },
  ],
  waitingTitle: "Waiting on you",
  waitingAs: "notices",
  dated: [
    {
      title: "Coming up",
      items: [
        {
          id: "held",
          at: at(12, 9),
          title: "Standard Clean",
          end: <StatusBadge tone="warning">Paused</StatusBadge>,
        },
      ],
      all: "All your cleans",
    },
  ],
  tiles: {
    kind: "links",
    links: [
      { icon: QuoteIcon, label: "Your quote", hint: "Ready: $412.00" },
      { icon: CalendarDays, label: "Your cleans", hint: "1 paused" },
      { icon: Receipt, label: "Past cleans", hint: "And their receipts" },
      { icon: Phone, label: "Call us", hint: "(718) 555-0142" },
    ],
  },
  brief: "Your quote is ready too · 1 clean paused",
};

// 5. a Client's Payments: one owed, then what was paid
const paid: Dated[] = [
  { day: "Nov 7", title: "Standard Clean", amount: 18600 },
  { day: "Nov 1", title: "Bill EC-1031", amount: 23000, clearing: true },
  { day: "Oct 24", title: "Standard Clean", amount: 18600 },
  { day: "Oct 17", title: "Extra on Oct 10", amount: 3500 },
  { day: "Oct 10", title: "Standard Clean", amount: 18600 },
].map((p, i) => ({
  id: `p${i}`,
  at: at(-7 * (i + 1), 10),
  day: p.day,
  title: p.title,
  end: (
    <span className="flex items-center gap-3">
      {p.clearing && <StatusBadge tone="info">Clearing</StatusBadge>}
      <span className="font-semibold text-fg tabular-nums">
        {formatMoney(p.amount)}
      </span>
    </span>
  ),
}));

const clientPayments: HomeView = {
  title: "Payments",
  headerAction: { label: "Your card", icon: CreditCard },
  answer: {
    tile: { icon: TriangleAlert, tone: "warning" },
    label: "To pay",
    headline: "$412.50",
    lines: ["Bill EC-1042, due Fri, Nov 21"],
    primary: { label: "Pay bill EC-1042" },
    quiet: { text: "Paying with Visa ending 4242", link: "Change" },
  },
  clear: { icon: CircleCheck, title: "You're all paid up" },
  waiting: [],
  waitingTitle: "Waiting on you",
  waitingAs: "notices",
  info: ["Your bank payment of $230.00 for bill EC-1031 is on its way."],
  dated: [{ title: "History", items: paid, all: "See all 23 payments" }],
  tiles: {
    kind: "links",
    links: [
      {
        icon: Receipt,
        label: "All payments",
        hint: "23 · $2,380.50 this year",
      },
      { icon: CreditCard, label: "Your card", hint: "Visa ending 4242" },
    ],
  },
  brief: "Last paid $186.00 on Nov 7 · 23 payments",
};

// 6. a Cleaner on site, more coming up
const siteVisit = <StatusBadge tone="info">Site visit</StatusBadge>;
const cleanerComing: Dated[] = [
  {
    id: "c1",
    at: at(0, 15),
    title: "5 Clinton Ave",
    description: "Deep Clean · 3 hours",
  },
  {
    id: "c2",
    at: at(1, 9),
    title: "41 Prospect Pl",
    description: "Standard Clean · 2.5 hours",
  },
  {
    id: "c3",
    at: at(3, 8, 30),
    title: "88 Warren St",
    description: "Move-out Clean · 5 hours",
  },
  {
    id: "c4",
    at: at(4, 13),
    title: "9 Union St",
    description: "Priya Shah · 30 minutes to see it",
    end: siteVisit,
  },
];
const cleanerDone: Dated[] = [
  {
    id: "d1",
    at: at(0, 8),
    title: "140 Smith St",
    description: "Standard Clean · 2 hours",
    end: <StatusBadge tone="success">Done</StatusBadge>,
  },
];

const cleanerBusy: HomeView = {
  title: "Your jobs",
  greeting: "Hi, Rosa",
  answer: {
    tile: { date: at(0, 11) },
    label: "Now",
    headline: "11:00 AM",
    lines: [
      "Today, until about 2:00 PM",
      "22 Bergen St, Brooklyn, NY 11217",
      "Standard Clean · 3 hours · crew of 2",
    ],
    primary: { label: "Open job" },
    secondary: { label: "Directions", icon: Navigation },
  },
  clear: { icon: CalendarDays, title: "Nothing booked for you yet" },
  waiting: [],
  waitingTitle: "",
  waitingAs: "rows",
  dated: [
    { title: "Coming up", items: cleanerComing },
    { title: "Done today", items: cleanerDone },
  ],
  tiles: {
    kind: "count",
    label: "Your jobs, by kind",
    groups: [
      {
        id: "coming",
        icon: CalendarDays,
        label: "Coming up",
        count: 4,
        hint: `Next ${formatTime(at(0, 15))}`,
        dated: cleanerComing,
      },
      {
        id: "done",
        icon: CircleCheck,
        label: "Done today",
        count: 1,
        dated: cleanerDone,
      },
      {
        id: "offers",
        icon: Inbox,
        label: "Offers",
        count: 2,
        hint: "Waiting on you",
        all: "Open Offers",
        dated: [
          {
            id: "o1",
            at: at(2, 10),
            title: "11215",
            description: "Deep Clean · 4 hours",
          },
          {
            id: "o2",
            at: at(5, 9),
            title: "11201",
            description: "Standard Clean · 2 hours",
          },
        ],
      },
    ],
  },
  brief: `Next: ${formatTime(at(0, 15))}, 5 Clinton Ave · 3 more coming up`,
};

// 7. a Cleaner with nothing booked
const cleanerEmpty: HomeView = {
  title: "Your jobs",
  greeting: "Hi, Sofia",
  answer: null,
  clear: {
    icon: CalendarDays,
    title: "Nothing booked for you yet",
    action: { label: "See 2 offers", icon: Inbox },
  },
  waiting: [],
  waitingTitle: "",
  waitingAs: "rows",
  dated: [],
  tiles: {
    kind: "count",
    label: "Your jobs, by kind",
    groups: [
      { id: "coming", icon: CalendarDays, label: "Coming up", count: 0 },
      { id: "done", icon: CircleCheck, label: "Done today", count: 0 },
      {
        id: "offers",
        icon: Inbox,
        label: "Offers",
        count: 2,
        hint: "Waiting on you",
        all: "Open Offers",
        dated: [
          {
            id: "o1",
            at: at(2, 10),
            title: "11215",
            description: "Deep Clean · 4 hours",
          },
          {
            id: "o2",
            at: at(5, 9),
            title: "11201",
            description: "Standard Clean · 2 hours",
          },
        ],
      },
    ],
  },
};

const cases: HomeCase[] = [
  {
    key: "1",
    name: "Office Today, busiest",
    area: "office",
    navLabel: "Today",
    view: officeBusy,
  },
  {
    key: "2",
    name: "Office Today, quiet",
    area: "office",
    navLabel: "Today",
    view: officeQuiet,
  },
  {
    key: "3",
    name: "Client Home, next clean booked",
    area: "portal",
    navLabel: "Home",
    view: clientBooked,
  },
  {
    key: "4",
    name: "Client Home, payment failed + a quote",
    area: "portal",
    navLabel: "Home",
    view: clientOwes,
  },
  {
    key: "5",
    name: "Client Payments, one owed",
    area: "portal",
    navLabel: "Payments",
    view: clientPayments,
  },
  {
    key: "6",
    name: "Cleaner, on site, more coming",
    area: "cleaner",
    navLabel: "Your jobs",
    view: cleanerBusy,
  },
  {
    key: "7",
    name: "Cleaner, nothing booked",
    area: "cleaner",
    navLabel: "Your jobs",
    view: cleanerEmpty,
  },
];

// ---- the layouts ----

const layouts = [
  { key: "A", name: "The answer, then short lists" },
  { key: "B", name: "Just the answer" },
  { key: "C", name: "The answer, then counts" },
] as const;

type LayoutKey = (typeof layouts)[number]["key"];

const notes: Record<LayoutKey, { idea: string; shows: string; hides: string }> =
  {
    A: {
      idea: "Today's rules, tidied into one layout. The page header with the section's name (only in the top bar on a phone) and its one secondary Button (Request a quote, Your card). The one card, then what else as short lists: what else waits on them (the Office's to-do rows; a Client's Notices, at most two, under the card), then the dated things after, 3 of each, then See all. Shortcut tiles go: the nav holds those places.",
      shows:
        "The header, the card, up to 3 to-dos or 2 Notices, up to 3 dated rows per list. All clear: a green card saying so, the lists after it.",
      hides:
        "Rows past 3: Show all (the Office's to-dos, in place) or See all (the List: Cleans, Payments, the Schedule).",
    },
    B: {
      idea: "Peace first: one thing at a time. No page header: the top bar (phone) and the sidebar already name the page, so the card is the first thing on it. Whatever else is waiting becomes the next card once this one's done. Under the card, one line says what else there is (\"10 more need you · 6 jobs on today\"); a tap opens the lists in place. The header's Buttons move: Your card into the owed card's line, Request a quote a quiet link at the foot.",
      shows:
        "The card and one line. All clear: no card, one quiet line with its icon, and its action if there is one.",
      hides:
        "Every list, other Notices, shortcut tiles: all behind the line under the card.",
    },
    C: {
      idea: "The answer, then counts. The header greets the person (Hi, Jen / Hi, Grace / Hi, Rosa); Payments keeps its name. The card, then tiles: the Office and a Cleaner get count tiles that open their rows in place (no List holds them); a Client gets shortcut tiles that link to their Lists, the count in the hint. No rows until a tile is pressed.",
      shows:
        "The greeting, the card, 2 to 4 tiles. All clear: a green card; tiles with none are greyed.",
      hides:
        "Every row behind its tile; Notices become tiles (Your quote · Ready).",
    },
  };

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

// the one answer, read left to right: when (or what it's about), what it
// is, and its one Button, the page's primary
function AnswerCard({ a, quiet = false }: { a: Answer; quiet?: boolean }) {
  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {"date" in a.tile ? (
          <DateTile date={a.tile.date} />
        ) : (
          <IconTile icon={a.tile.icon} tone={a.tile.tone} size="lg" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Heading level={2} size={4} className="text-fg-muted">
            {a.label}
          </Heading>
          <p className="text-2xl font-semibold text-fg tabular-nums sm:text-3xl">
            {a.headline}
          </p>
          {a.lines.map((line) => (
            <p key={line} className="text-fg-muted [overflow-wrap:anywhere]">
              {line}
            </p>
          ))}
          {quiet && a.quiet && (
            <p className="text-sm text-fg-muted">
              {a.quiet.text} ·{" "}
              <Button
                variant="text"
                size="sm"
                className="inline-flex"
                onPress={say("Opens Your card")}
              >
                {a.quiet.link}
              </Button>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
          {a.secondary && (
            <Button variant="secondary" onPress={say(a.secondary.label)}>
              <a.secondary.icon aria-hidden size={18} />
              {a.secondary.label}
            </Button>
          )}
          <Button onPress={say(a.primary.label)}>
            {a.primary.icon && <a.primary.icon aria-hidden size={18} />}
            {a.primary.label}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// all clear, as a card in A and C
function ClearCard({ c }: { c: Clear }) {
  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <IconTile icon={c.icon} tone="success" size="lg" />
        <p className="min-w-0 flex-1 text-2xl font-semibold text-fg sm:text-3xl">
          {c.title}
        </p>
        {c.action && (
          <Button onPress={say(c.action.label)}>
            {c.action.icon && <c.action.icon aria-hidden size={18} />}
            {c.action.label}
          </Button>
        )}
      </div>
    </Card>
  );
}

// all clear, as one quiet line in B
function ClearLine({ c }: { c: Clear }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <IconTile icon={c.icon} tone="success" />
      <p className="text-lg text-fg-muted">{c.title}</p>
      {c.action && (
        <Button onPress={say(c.action.label)}>
          {c.action.icon && <c.action.icon aria-hidden size={18} />}
          {c.action.label}
        </Button>
      )}
    </div>
  );
}

// an Office to-do: what to do first, its kind in a toned tile, the Client
// leading the line
function WaitingRows({ label, items }: { label: string; items: Waiting[] }) {
  return (
    <List aria-label={label}>
      {items.map((w) => (
        <ListItem
          key={w.key}
          id={w.key}
          textValue={`${w.action} ${w.who ?? ""}`}
          title={w.action}
          description={
            <>
              {w.who && <span className="font-semibold text-fg">{w.who}</span>}
              {w.who && " · "}
              {w.line}
            </>
          }
          start={<IconTile icon={w.icon} tone={w.tone} />}
          onAction={say(`Opens: ${w.action}`)}
        />
      ))}
    </List>
  );
}

function WaitingNotices({ items }: { items: Waiting[] }) {
  return (
    <>
      {items.map((w) => (
        <Notice
          key={w.key}
          tone={w.tone === "neutral" ? "info" : w.tone}
          action={
            <Button variant="text" onPress={say(w.action)}>
              {w.action}
            </Button>
          }
        >
          {w.line}
        </Notice>
      ))}
    </>
  );
}

// dated rows: the kit's DatedItem, or a payment's day and amount
function DatedRows({ label, items }: { label: string; items: Dated[] }) {
  return (
    <List aria-label={label}>
      {items.map((d) =>
        d.day ? (
          <ListItem
            key={d.id}
            id={d.id}
            title={d.title}
            start={
              <span className="w-12 shrink-0 text-sm text-fg-muted tabular-nums">
                {d.day}
              </span>
            }
            end={d.end}
            onAction={say(`Opens ${d.title}`)}
          />
        ) : (
          <DatedItem
            key={d.id}
            id={d.id}
            at={d.at}
            title={d.title}
            description={d.description}
            end={d.end}
            onAction={say(`Opens ${d.title}`)}
          />
        ),
      )}
    </List>
  );
}

// the first `limit` rows, then the way to the rest
function Limited<T>({
  items,
  limit,
  all,
  inPlace,
  children,
}: {
  items: T[];
  limit: number;
  // a List's or the Schedule's name; none: shown in place
  all?: string;
  inPlace?: boolean;
  children: (shown: T[]) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, limit);
  const more = items.length - limit;
  return (
    <div className="flex flex-col gap-3">
      {children(shown)}
      {inPlace && more > 0 && !open && (
        <Button
          variant="text"
          className="self-start"
          onPress={() => setOpen(true)}
        >
          Show all {items.length}
        </Button>
      )}
      {!inPlace && all && (
        <Button variant="text" className="self-start" onPress={say(all)}>
          {all}
        </Button>
      )}
    </div>
  );
}

function InfoNotices({ v }: { v: HomeView }) {
  return (
    <>
      {(v.info ?? []).map((text) => (
        <Notice key={text}>{text}</Notice>
      ))}
    </>
  );
}

// every list unbounded: what B's line opens
function AllLists({ v }: { v: HomeView }) {
  return (
    <div className="flex flex-col gap-6">
      {v.waiting.length > 0 &&
        (v.waitingAs === "rows" ? (
          <Section title={v.waitingTitle}>
            <WaitingRows label={v.waitingTitle} items={v.waiting} />
          </Section>
        ) : (
          <div className="flex flex-col gap-3">
            <WaitingNotices items={v.waiting} />
          </div>
        ))}
      <InfoNotices v={v} />
      {v.dated.map((list) => (
        <Section key={list.title} title={list.title}>
          <Limited items={list.items} limit={99} all={list.all}>
            {(shown) => <DatedRows label={list.title} items={shown} />}
          </Limited>
        </Section>
      ))}
    </div>
  );
}

const headerActions = (v: HomeView) =>
  v.headerAction
    ? [
        {
          label: v.headerAction.label,
          icon: v.headerAction.icon,
          onAction: say(v.headerAction.label),
        },
      ]
    : [];

// ---- A: the answer, then short lists ----

function LayoutA({ v }: { v: HomeView }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={v.title} inBar actions={headerActions(v)} />
      {v.answer ? <AnswerCard a={v.answer} /> : <ClearCard c={v.clear} />}
      {v.waitingAs === "notices" && v.waiting.length > 0 && (
        <WaitingNotices items={v.waiting.slice(0, 2)} />
      )}
      <InfoNotices v={v} />
      {v.waitingAs === "rows" && v.waiting.length > 0 && (
        <Section title={v.waitingTitle}>
          <Limited items={v.waiting} limit={3} inPlace>
            {(shown) => <WaitingRows label={v.waitingTitle} items={shown} />}
          </Limited>
        </Section>
      )}
      {v.dated.map(
        (list) =>
          list.items.length > 0 && (
            <Section key={list.title} title={list.title}>
              <Limited
                items={list.items}
                limit={3}
                all={list.all}
                inPlace={!list.all}
              >
                {(shown) => <DatedRows label={list.title} items={shown} />}
              </Limited>
            </Section>
          ),
      )}
    </div>
  );
}

// ---- B: just the answer ----

function LayoutB({ v }: { v: HomeView }) {
  return (
    <div className="flex flex-col gap-4">
      <Heading level={1} className="sr-only">
        {v.title}
      </Heading>
      {v.answer ? <AnswerCard a={v.answer} quiet /> : <ClearLine c={v.clear} />}
      {v.brief && (
        <Fold label={v.brief}>
          <AllLists v={v} />
        </Fold>
      )}
      {v.headerAction && !v.answer?.quiet && (
        <Button
          variant="text"
          className="mt-4 self-start"
          onPress={say(v.headerAction.label)}
        >
          <v.headerAction.icon aria-hidden size={18} />
          {v.headerAction.label}
        </Button>
      )}
    </div>
  );
}

// ---- C: the answer, then counts ----

function LayoutC({ v }: { v: HomeView }) {
  const [picked, setPicked] = useState<string | null>(null);
  const tiles = v.tiles;
  const group =
    tiles.kind === "count" ? tiles.groups.find((g) => g.id === picked) : null;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={v.greeting ?? v.title}
        inBar={!v.greeting}
        actions={headerActions(v)}
      />
      {v.answer ? <AnswerCard a={v.answer} /> : <ClearCard c={v.clear} />}
      <InfoNotices v={v} />
      {tiles.kind === "count" ? (
        <div className="flex flex-col gap-4">
          <CountTiles
            label={tiles.label}
            selected={picked}
            onSelect={setPicked}
          >
            {tiles.groups.map((g) => (
              <CountTile
                key={g.id}
                id={g.id}
                icon={g.icon}
                label={g.label}
                count={g.count}
                hint={g.hint}
              />
            ))}
          </CountTiles>
          {group && (
            <div className="flex flex-col gap-3">
              {group.rows && (
                <WaitingRows label={group.label} items={group.rows} />
              )}
              {group.dated && (
                <DatedRows label={group.label} items={group.dated} />
              )}
              {group.all && (
                <Button
                  variant="text"
                  className="self-start"
                  onPress={say(group.all)}
                >
                  {group.all}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <ShortcutTiles label="Shortcuts">
          {tiles.links.map((l) => (
            <ShortcutTile
              key={l.label}
              icon={l.icon}
              label={l.label}
              hint={l.hint}
              href={here}
            />
          ))}
        </ShortcutTiles>
      )}
    </div>
  );
}

function Layout({ c, layout }: { c: HomeCase; layout: LayoutKey }) {
  if (layout === "B") return <LayoutB v={c.view} />;
  if (layout === "C") return <LayoutC v={c.view} />;
  return <LayoutA v={c.view} />;
}

export function HomePrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const layout: LayoutKey =
    layouts.find((l) => l.key === search.layout)?.key ?? "A";
  const c = cases.find((x) => x.key === search.case) ?? cases[0]!;
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/home",
      search: { case: c.key, layout, ...change },
      replace: true,
    });

  const nav: NavItem[] = navFor("en")[c.area].map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === c.navLabel,
    }),
  );
  return (
    <AppLayout area={areaLabels.en[c.area]} nav={nav} foot={() => null}>
      {/* room for the switchers, so they cover nothing of the page at rest */}
      <div aria-hidden className="h-24" />
      <LayoutNote key={layout} layout={layout} />
      <Layout key={`${c.key}-${layout}`} c={c} layout={layout} />
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
