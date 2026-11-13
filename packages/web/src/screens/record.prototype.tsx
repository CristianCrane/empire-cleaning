// PROTOTYPE: throwaway. The Record layout and the page header every type
// shares (#432), on made-up data, at /prototype/record?layout=A..C&case=1..6
// (no sign-in), inside the real AppLayout and nav of each case's area.
// ↑/↓ switch layouts, ←/→ switch cases. Lives only on prototype-record.
import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Banknote,
  BrushCleaning,
  CalendarCheck,
  CalendarSync,
  CalendarX,
  Cat,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  ClipboardCheck,
  ClipboardPenLine,
  Clock,
  ContactRound,
  CreditCard,
  DoorClosed,
  FilePen,
  Info,
  KeyRound,
  Languages,
  Mail,
  MapPin,
  Phone,
  Printer,
  Receipt,
  RotateCcw,
  Ruler,
  Send,
  Sparkles,
  TriangleAlert,
  UserMinus,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ActionFooter,
  AppLayout,
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  DateTile,
  Heading,
  IconTile,
  Link,
  List,
  ListItem,
  MenuButton,
  MenuItem,
  MenuSeparator,
  type NavItem,
  Notice,
  Section,
  StatusBadge,
  type StatusTone,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Timeline,
  TimelineItem,
  showToast,
} from "@empire-cleaning/ui";
import { linkTo } from "../links.ts";
import { areaLabels, type AreaId } from "../session.ts";
import { navFor } from "./AreaLayout.tsx";
import { Fact } from "./Fact.tsx";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";

const here = linkTo({ to: "/prototype/record" });

// ---- the shape of a Record, as every layout reads it ----

type FactData = { icon: LucideIcon; label: string; value: ReactNode };

type Act = {
  label: string;
  icon: LucideIcon;
  // the one thing this person most often comes here to do
  main?: boolean;
  // undoes or removes something: red, last
  danger?: boolean;
  // what pressing it says (a Toast), when it isn't a dialog
  toast?: {
    title: string;
    description?: string;
    tone?: "info" | "success" | "danger";
  };
};

type NoticeData = {
  tone: "info" | "warning" | "success" | "danger";
  text: ReactNode;
  action?: Act;
};

type Part = {
  title: string;
  // a List draws its own box: no Card around it
  list?: boolean;
  // an action on this part alone (End plan on the plan), not the record
  action?: Act;
  body: ReactNode;
};

type HistoryItem = {
  icon: LucideIcon;
  title: string;
  when?: string;
  description?: string;
};

type RecordCase = {
  key: string;
  name: string;
  area: AreaId;
  navLabel: string;
  // from the area's nav section down to this page; the last is this page
  trail: string[];
  title: string;
  status?: { tone: StatusTone; label: string };
  // what the details card leads with, large: when, or what it is
  lead?:
    | { date: string; text: string; line?: string }
    | { icon: LucideIcon; tone?: StatusTone; text: string; line?: string };
  // said once: a subtitle in A, a fact in B and C
  aside?: FactData;
  facts: FactData[];
  notices: NoticeData[];
  actions: Act[];
  // the main action must stay in reach while a long page scrolls
  // (a Cleaner on site): it goes in the ActionFooter in every layout
  keepInReach?: boolean;
  parts: Part[];
  history?: HistoryItem[];
};

// what a press does on a prototype: says so
const press = (act: Act) => () =>
  showToast(
    act.toast ?? {
      title: `${act.label} would open here`,
      tone: "info",
    },
  );

// ---- made-up data ----

const officeJob: RecordCase = {
  key: "1",
  name: "Office Job, busiest",
  area: "office",
  navLabel: "Jobs",
  trail: ["Jobs", "Job"],
  title: "Deep Clean at 482 Halsey St",
  status: { tone: "danger", label: "Unpaid" },
  lead: {
    date: "2026-11-10T14:00:00Z",
    text: "Mon, Nov 10, 9:00 AM",
    line: "3 h 30 min on site",
  },
  facts: [
    {
      icon: ContactRound,
      label: "Client",
      value: <Link href={here}>Maria Lopez</Link>,
    },
    {
      icon: MapPin,
      label: "Home",
      value: <Link href={here}>482 Halsey St, Brooklyn</Link>,
    },
    { icon: CirclePlus, label: "Extras", value: "Inside oven, inside fridge" },
    { icon: Clock, label: "Cleaning hours", value: "7 h" },
    { icon: Users, label: "Cleaners", value: "2" },
  ],
  notices: [
    {
      tone: "danger",
      text: (
        <p>
          <strong>$370.17 didn't go through</strong> (card declined).
        </p>
      ),
      action: {
        label: "Retry charge",
        icon: RotateCcw,
        // WEB-5: a retry that fails is a Toast, never a Notice in the Notice
        toast: {
          title: "The card didn't go through again",
          description: "Ask Maria for another card.",
          tone: "danger",
        },
      },
    },
    {
      tone: "warning",
      text: (
        <p>
          <strong>Ana reported 2 price changes.</strong>
        </p>
      ),
      action: { label: "Review", icon: ClipboardCheck },
    },
    {
      tone: "warning",
      text: (
        <p>
          <strong>The receipt email bounced.</strong>
        </p>
      ),
      action: { label: "Edit email", icon: Mail },
    },
  ],
  actions: [
    { label: "Record a payment", icon: Banknote },
    { label: "Send receipt again", icon: Send },
    { label: "Correct how it went", icon: FilePen },
    { label: "Undo completion", icon: RotateCcw, danger: true },
  ],
  parts: [
    {
      title: "How it went",
      body: (
        <dl className="grid gap-4 @md:grid-cols-2">
          <Fact
            icon={CircleCheck}
            label="Done"
            value="Mon, Nov 10, 12:41 PM"
            line="Done, by Ana Rivera"
          />
          <Fact icon={Sparkles} label="Condition" value="As expected" />
        </dl>
      ),
    },
    {
      title: "Crew",
      list: true,
      body: (
        <List aria-label="Crew">
          {[
            ["ana", "Ana Rivera", "Took it Nov 3"],
            ["luis", "Luis Ortega", "Took it Nov 4"],
          ].map(([id, name, line]) => (
            <ListItem
              key={id}
              id={id}
              title={name!}
              description={line}
              start={<Avatar />}
              action={
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label={`Remove ${name}`}
                >
                  <X aria-hidden size={20} className="text-fg-muted" />
                </Button>
              }
            />
          ))}
        </List>
      ),
    },
    { title: "Money", body: <JobMoney /> },
  ],
  history: [
    {
      icon: CircleAlert,
      title: "Payment didn't go through",
      when: "Nov 10, 12:42 PM",
      description: "Card declined",
    },
    {
      icon: CircleCheck,
      title: "Done",
      when: "Nov 10, 12:41 PM",
      description: "By Ana Rivera",
    },
    { icon: UserPlus, title: "Luis Ortega took it", when: "Nov 4" },
    // WEB-3: the drop-out lives here, not as a row in the Crew
    { icon: UserMinus, title: "Beth Kim dropped out", when: "Nov 4" },
    { icon: UserPlus, title: "Ana Rivera took it", when: "Nov 3" },
    { icon: Send, title: "Offered to 4 cleaners", when: "Nov 2" },
    {
      icon: CalendarCheck,
      title: "Booked",
      when: "Oct 28",
      description: "Quote accepted",
    },
  ],
};

// WEB-6: price changes inside Money, few words; how it's worked out waits
// behind a tap
function JobMoney() {
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-1 tabular-nums">
        <Row label="Total" value="$435.50" strong />
        <Row label="Deposit paid" value="$65.33" />
        <Row label="Owed" value="$370.17" />
      </dl>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="font-semibold">Price changes</p>
        <dl className="flex flex-col gap-1 text-sm tabular-nums">
          <Row label="Inside fridge" value="+$25.00 · waiting for Maria" />
          <Row label="Window tracks" value="+$15.00 · to check" />
        </dl>
      </div>
      <Fold label="How it's worked out">
        <dl className="flex flex-col gap-1 text-sm tabular-nums text-fg-muted">
          <Row label="7 cleaning hours at $51.43" value="$360.00" />
          <Row label="Extras" value="$40.00" />
          <Row label="Tax (8.875%)" value="$35.50" />
        </dl>
      </Fold>
    </div>
  );
}

const officeClient: RecordCase = {
  key: "2",
  name: "Office Client",
  area: "office",
  navLabel: "Clients",
  trail: ["Clients", "Maria Lopez"],
  title: "Maria Lopez",
  // WEB-H: the contact details with icons, as every Record's facts
  facts: [
    { icon: Phone, label: "Phone", value: "(718) 555-0142" },
    { icon: Mail, label: "Email", value: "maria.lopez@gmail.com" },
    { icon: Languages, label: "Language", value: "Spanish" },
    { icon: CreditCard, label: "Card", value: "Visa ending 4242" },
    { icon: CalendarCheck, label: "Client since", value: "Oct 2026" },
  ],
  notices: [],
  actions: [
    { label: "New quote", icon: ClipboardPenLine, main: true },
    { label: "Edit contact details", icon: FilePen },
    { label: "Send a sign-in link", icon: Send },
  ],
  parts: [
    {
      title: "Homes",
      list: true,
      body: (
        <List aria-label="Homes" onAction={() => undefined}>
          <ListItem
            id="halsey"
            title="482 Halsey St, Brooklyn"
            description="House · weekly plan"
            start={<IconTile icon={MapPin} />}
          />
          <ListItem
            id="bergen"
            title="19 Bergen St, Apt 2, Brooklyn"
            description="Apartment"
            start={<IconTile icon={MapPin} />}
          />
        </List>
      ),
    },
  ],
};

const officeBill: RecordCase = {
  key: "3",
  name: "Office Bill, one action",
  area: "office",
  navLabel: "Clients",
  trail: ["Clients", "Brightside Dental", "Bill 1038"],
  title: "Bill 1038",
  status: { tone: "success", label: "Paid" },
  lead: {
    icon: Receipt,
    tone: "success",
    text: "$1,240.00 paid",
    line: "Nov 12, by bank transfer",
  },
  // WEB-G: the client is in the breadcrumbs, so not in a subtitle too
  aside: { icon: CalendarCheck, label: "Week", value: "Nov 3 – 9" },
  facts: [
    { icon: BrushCleaning, label: "Cleans", value: "5 at 2 premises" },
    { icon: Clock, label: "Due", value: "Nov 16" },
    { icon: Mail, label: "Sent to", value: "billing@brightsidedental.com" },
  ],
  notices: [],
  // WEB-F: its actions in the one place every Record's are
  actions: [{ label: "Print", icon: Printer }],
  parts: [
    {
      title: "Cleans",
      body: (
        <dl className="flex flex-col gap-1 tabular-nums">
          <Row label="Mon, Nov 3 · 210 Court St" value="$240.00" />
          <Row label="Tue, Nov 4 · 88 Atlantic Ave" value="$260.00" />
          <Row label="Wed, Nov 5 · 210 Court St" value="$240.00" />
          <Row label="Thu, Nov 6 · 88 Atlantic Ave" value="$260.00" />
          <Row label="Fri, Nov 7 · 210 Court St" value="$139.00" />
          <Row label="Tax" value="$101.00" />
          <Row label="Total" value="$1,240.00" strong />
        </dl>
      ),
    },
  ],
};

const officeProperty: RecordCase = {
  key: "4",
  name: "Office Property with a plan",
  area: "office",
  navLabel: "Clients",
  trail: ["Clients", "Maria Lopez", "482 Halsey St"],
  title: "482 Halsey St",
  lead: {
    icon: MapPin,
    text: "House · 3 bedrooms · 2 bathrooms",
    line: "Brooklyn, NY 11233",
  },
  facts: [
    { icon: Ruler, label: "Floor area", value: "1,400 sq ft" },
    { icon: Sparkles, label: "Condition", value: "Lived-in" },
    {
      icon: KeyRound,
      label: "How we get in",
      value: "Lockbox 4471, side door",
    },
    { icon: Cat, label: "Pets", value: "One cat, upstairs" },
  ],
  notices: [],
  actions: [
    { label: "New quote", icon: ClipboardPenLine, main: true },
    { label: "Book a site visit", icon: CalendarCheck },
    { label: "Correct details", icon: FilePen },
  ],
  parts: [
    {
      title: "Cleaning plan",
      // WEB-J: End plan on the plan's card, no billing sentence
      action: { label: "End plan", icon: CalendarX, danger: true },
      body: (
        <dl className="grid gap-4 @md:grid-cols-2">
          <Fact
            icon={CalendarSync}
            label="When"
            value="Mondays, 9:00 AM"
            line="Weekly Standard Clean"
          />
          <Fact icon={Users} label="Cleaners" value="2" />
          <Fact icon={Banknote} label="A clean" value="$166.50" />
          <Fact icon={CalendarCheck} label="Next clean" value="Mon, Nov 16" />
        </dl>
      ),
    },
    {
      title: "Site visit",
      body: (
        <dl className="grid gap-4 @md:grid-cols-2">
          <Fact icon={CircleCheck} label="Done" value="Oct 20" />
          <Fact icon={Info} label="What it found" value="Lived-in, as asked" />
        </dl>
      ),
    },
  ],
  history: [
    { icon: CalendarSync, title: "Plan started", when: "Oct 27" },
    { icon: ClipboardPenLine, title: "Quote accepted", when: "Oct 24" },
    { icon: CircleCheck, title: "Site visit done", when: "Oct 20" },
    { icon: MapPin, title: "Home added", when: "Oct 18" },
  ],
};

const portalClean: RecordCase = {
  key: "5",
  name: "Client portal Clean",
  area: "portal",
  navLabel: "Cleans",
  trail: ["Cleans", "Mon, Nov 16"],
  title: "Standard Clean",
  status: { tone: "info", label: "Booked" },
  lead: {
    date: "2026-11-16T14:00:00Z",
    text: "Mon, Nov 16, 9:00 AM",
    line: "About 3 hours",
  },
  facts: [
    { icon: MapPin, label: "Home", value: "482 Halsey St" },
    { icon: Users, label: "Cleaners", value: "Ana and Luis" },
    { icon: Banknote, label: "Price", value: "$166.50" },
    {
      icon: CalendarSync,
      label: "Free to move or cancel",
      value: "Until Sat, Nov 14",
    },
  ],
  notices: [
    {
      tone: "warning",
      text: (
        <p>
          <strong>Your card expires before this clean.</strong>
        </p>
      ),
      action: { label: "Update card", icon: CreditCard },
    },
  ],
  actions: [
    { label: "Move clean", icon: CalendarSync, main: true },
    { label: "Cancel clean", icon: CalendarX, danger: true },
  ],
  parts: [],
  history: [
    {
      icon: CalendarCheck,
      title: "Booked",
      when: "Oct 27",
      description: "Your weekly plan",
    },
  ],
};

const cleanerJob: RecordCase = {
  key: "6",
  name: "Cleaner Job on site",
  area: "cleaner",
  navLabel: "Your jobs",
  trail: ["Your jobs", "Today, 9:00 AM"],
  title: "Standard Clean",
  status: { tone: "info", label: "Today" },
  lead: {
    date: "2026-11-13T14:00:00Z",
    text: "Today, 9:00 AM – 12:30 PM",
    line: "With Luis",
  },
  facts: [
    {
      icon: MapPin,
      label: "Address",
      value: <Link href={here}>482 Halsey St, Brooklyn</Link>,
    },
    {
      icon: KeyRound,
      label: "How to get in",
      value: "Lockbox 4471, side door",
    },
    { icon: Cat, label: "Pets", value: "One cat: keep the bedroom door shut" },
    { icon: CirclePlus, label: "Extras", value: "Inside oven" },
    { icon: Phone, label: "Client", value: "Maria · (718) 555-0142" },
  ],
  notices: [],
  actions: [
    {
      label: "Complete job",
      icon: CircleCheck,
      main: true,
      toast: { title: "Job completed", tone: "success" },
    },
    { label: "No access", icon: DoorClosed },
    { label: "Drop out", icon: UserMinus, danger: true },
  ],
  keepInReach: true,
  parts: [
    {
      title: "From the office",
      body: (
        <p>The vacuum is in the hall closet. Leave the key in the lockbox.</p>
      ),
    },
  ],
};

const cases = [
  officeJob,
  officeClient,
  officeBill,
  officeProperty,
  portalClean,
  cleanerJob,
];

// ---- the layouts ----

const layouts = [
  { key: "A", name: "Actions menu in the header" },
  { key: "B", name: "One column, actions in a bar at the foot" },
  { key: "C", name: "To-do card, actions as buttons, History tab" },
] as const;

type LayoutKey = (typeof layouts)[number]["key"];

const notes: Record<LayoutKey, { idea: string; shows: string; hides: string }> =
  {
    A: {
      idea: "Breadcrumbs from the nav section, every step. Title and status, then Actions ▾ at the end of the title row (a single action sits there as a button). A subtitle only says what nothing else does.",
      shows:
        "Up to 2 alerts, the details card, then each part. History beside it from xl (two columns).",
      hides:
        'Every action behind Actions ▾ (destructive last, red). Alerts past 2 behind "Show more". On a phone, History at the foot.',
    },
    B: {
      idea: "One back link, no trail. Title and status, never a subtitle. One column at every width. Every action in the bar at the foot, the same place on every Record (WEB-9).",
      shows:
        "The most urgent alert, the details card (labelled rows), then each part. The main action, in the foot bar.",
      hides:
        'Other alerts behind "N more to check". Other actions under More ▾ in the bar (destructive last, red). History folded at the foot.',
    },
    C: {
      idea: "Breadcrumbs: the nav section and this page only. Under the title, its actions as buttons: up to two, the rest under More ▾. Alerts gathered into one To do card, a row each.",
      shows:
        "Every alert as a row in To do, the details card, the parts in two columns from lg.",
      hides:
        "Destructive and rarer actions under More ▾. History on its own tab.",
    },
  };

export function RecordPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const layout: LayoutKey =
    layouts.find((l) => l.key === search.layout)?.key ?? "A";
  const c = cases.find((x) => x.key === search.case) ?? officeJob;
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/record",
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
      {layout === "A" && <LayoutA c={c} />}
      {layout === "B" && <LayoutB c={c} />}
      {layout === "C" && <LayoutC c={c} />}
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

// ---- A: Actions menu in the header ----

function LayoutA({ c }: { c: RecordCase }) {
  const inBar = c.keepInReach ? c.actions.find((a) => a.main) : undefined;
  const inHeader = c.actions.filter((a) => a !== inBar);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Breadcrumbs
          trail={c.trail.map((label, i) =>
            i < c.trail.length - 1 ? { label, href: here } : { label },
          )}
        />
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <TitleRow c={c} />
            {c.aside && (
              <p className="text-lg text-fg-muted">{c.aside.value}</p>
            )}
          </div>
          <HeaderActions actions={inHeader} />
        </div>
      </header>
      <Notices notices={c.notices} max={2} more="Show" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <DetailsCard c={c} facts={c.facts} style="icons" />
          {c.parts.map((p) => (
            <PartView key={p.title} part={p} />
          ))}
        </div>
        {c.history && (
          <div className="flex flex-col gap-6">
            <Card title="History">
              <HistoryList c={c} />
            </Card>
          </div>
        )}
      </div>
      {inBar && (
        <ActionFooter aria-label="Job">
          <Button onPress={press(inBar)}>
            <inBar.icon aria-hidden size={18} />
            {inBar.label}
          </Button>
        </ActionFooter>
      )}
    </div>
  );
}

// one action: a Button in the menu's place; more: the Actions menu, the
// destructive last after a rule
function HeaderActions({ actions }: { actions: Act[] }) {
  if (actions.length === 0) return null;
  if (actions.length === 1) {
    const [a] = actions as [Act];
    return (
      <Button
        variant={a.danger ? "danger-text" : "secondary"}
        className="shrink-0"
        onPress={press(a)}
      >
        <a.icon aria-hidden size={18} />
        {a.label}
      </Button>
    );
  }
  return <ActionsMenu label="Actions" actions={actions} />;
}

function ActionsMenu({ label, actions }: { label: string; actions: Act[] }) {
  const plain = actions.filter((a) => !a.danger);
  const danger = actions.filter((a) => a.danger);
  return (
    <MenuButton label={label}>
      {plain.map((a) => (
        <MenuItem key={a.label} icon={a.icon} onAction={press(a)}>
          {a.label}
        </MenuItem>
      ))}
      {plain.length > 0 && danger.length > 0 && <MenuSeparator />}
      {danger.map((a) => (
        <MenuItem key={a.label} icon={a.icon} danger onAction={press(a)}>
          {a.label}
        </MenuItem>
      ))}
    </MenuButton>
  );
}

// ---- B: one column, actions in a bar at the foot ----

function LayoutB({ c }: { c: RecordCase }) {
  const main = c.actions.find((a) => a.main);
  const rest = c.actions.filter((a) => a !== main);
  const parent = c.trail[c.trail.length - 2]!;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href={here}
          className="flex w-fit items-center gap-1 text-sm font-normal text-fg-muted no-underline hover:text-fg"
        >
          <ChevronLeft aria-hidden size={16} />
          {parent}
        </Link>
        <TitleRow c={c} />
      </header>
      <Notices notices={c.notices} max={1} more="to check" />
      <DetailsCard
        c={c}
        facts={c.aside ? [c.aside, ...c.facts] : c.facts}
        style="rows"
      />
      {c.parts.map((p) => (
        <PartView key={p.title} part={p} />
      ))}
      {c.history && (
        <Fold label={`History (${c.history.length})`}>
          <Card>
            <HistoryList c={c} />
          </Card>
        </Fold>
      )}
      {c.actions.length > 0 && (
        <ActionFooter aria-label={c.title}>
          {rest.length === 1 && (
            <Button
              variant={rest[0]!.danger ? "danger-text" : "secondary"}
              onPress={press(rest[0]!)}
            >
              {rest[0]!.label}
            </Button>
          )}
          {rest.length > 1 && (
            <ActionsMenu label={main ? "More" : "Actions"} actions={rest} />
          )}
          {main && (
            <Button onPress={press(main)}>
              <main.icon aria-hidden size={18} />
              {main.label}
            </Button>
          )}
        </ActionFooter>
      )}
    </div>
  );
}

// ---- C: to-do card, actions as buttons, History tab ----

function LayoutC({ c }: { c: RecordCase }) {
  const inBar = c.keepInReach ? c.actions.find((a) => a.main) : undefined;
  const inRow = c.actions.filter((a) => a !== inBar);
  const shown = inRow.filter((a) => !a.danger).slice(0, 2);
  const more = inRow.filter((a) => !shown.includes(a));
  const details = (
    <div className="flex flex-col gap-6">
      <DetailsCard
        c={c}
        facts={c.aside ? [c.aside, ...c.facts] : c.facts}
        style="icons"
      />
      {c.parts.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {c.parts.map((p) => (
            <PartView key={p.title} part={p} />
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Breadcrumbs
          trail={[
            { label: c.trail[0]!, href: here },
            { label: c.trail.at(-1)! },
          ]}
        />
        <TitleRow c={c} />
        {inRow.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {shown.map((a) => (
              <Button key={a.label} variant="secondary" onPress={press(a)}>
                <a.icon aria-hidden size={18} />
                {a.label}
              </Button>
            ))}
            {more.length === 1 && shown.length === 0 && (
              <Button variant="danger-text" onPress={press(more[0]!)}>
                {more[0]!.label}
              </Button>
            )}
            {(more.length > 1 || (more.length === 1 && shown.length > 0)) && (
              <ActionsMenu label="More" actions={more} />
            )}
          </div>
        )}
      </header>
      {c.notices.length > 0 && <ToDo notices={c.notices} />}
      {c.history ? (
        <Tabs>
          <TabList aria-label={c.title}>
            <Tab id="details">Details</Tab>
            <Tab id="history" count={c.history.length}>
              History
            </Tab>
          </TabList>
          <TabPanel id="details">{details}</TabPanel>
          <TabPanel id="history">
            <Card>
              <HistoryList c={c} />
            </Card>
          </TabPanel>
        </Tabs>
      ) : (
        details
      )}
      {inBar && (
        <ActionFooter aria-label="Job">
          <Button onPress={press(inBar)}>
            <inBar.icon aria-hidden size={18} />
            {inBar.label}
          </Button>
        </ActionFooter>
      )}
    </div>
  );
}

// every alert, a row each in one card: never a Notice in a Notice
function ToDo({ notices }: { notices: NoticeData[] }) {
  const icons = {
    info: Info,
    warning: TriangleAlert,
    success: CircleCheck,
    danger: CircleAlert,
  };
  const colours = {
    info: "text-info-strong",
    warning: "text-warning-strong",
    success: "text-success-strong",
    danger: "text-danger-strong",
  };
  return (
    <Card title="To do">
      <ul className="flex flex-col divide-y divide-border">
        {notices.map((n, i) => {
          const Icon = icons[n.tone];
          return (
            <li
              key={i}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
            >
              <Icon
                aria-hidden
                size={20}
                className={`shrink-0 ${colours[n.tone]}`}
              />
              <div className="min-w-0 flex-1">{n.text}</div>
              {n.action && (
                <Button variant="text" size="sm" onPress={press(n.action)}>
                  {n.action.label}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---- shared parts ----

function TitleRow({ c }: { c: RecordCase }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Heading level={1}>{c.title}</Heading>
      {c.status && (
        <StatusBadge tone={c.status.tone}>{c.status.label}</StatusBadge>
      )}
    </div>
  );
}

// the first `max` alerts; the rest behind a tap
function Notices({
  notices,
  max,
  more,
}: {
  notices: NoticeData[];
  max: number;
  more: "Show" | "to check";
}) {
  const [all, setAll] = useState(false);
  if (notices.length === 0) return null;
  const hidden = notices.length - max;
  const shown = all ? notices : notices.slice(0, max);
  return (
    <div className="flex flex-col gap-3">
      {shown.map((n, i) => (
        <Notice
          key={i}
          tone={n.tone}
          action={
            n.action && (
              <Button variant="text" onPress={press(n.action)}>
                {n.action.label}
              </Button>
            )
          }
        >
          {n.text}
        </Notice>
      ))}
      {hidden > 0 && !all && (
        <Button
          variant="text"
          className="self-start"
          onPress={() => setAll(true)}
        >
          <ChevronDown aria-hidden size={18} />
          {more === "Show" ? `Show ${hidden} more` : `${hidden} more to check`}
        </Button>
      )}
    </div>
  );
}

// one details card: what it leads with, large, then its facts, in one of
// two styles
function DetailsCard({
  c,
  facts,
  style,
}: {
  c: RecordCase;
  facts: FactData[];
  style: "icons" | "rows";
}) {
  return (
    <Card className="@container">
      {c.lead && (
        <div className="flex items-center gap-4">
          {"date" in c.lead ? (
            <DateTile date={c.lead.date} />
          ) : (
            <IconTile icon={c.lead.icon} tone={c.lead.tone} size="lg" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xl font-semibold">{c.lead.text}</p>
            {c.lead.line && <p className="text-fg-muted">{c.lead.line}</p>}
          </div>
        </div>
      )}
      {style === "icons" ? (
        <dl
          className={`grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3 ${c.lead ? "border-t border-border pt-4" : ""}`}
        >
          {facts.map((f) => (
            <Fact key={f.label} icon={f.icon} label={f.label} value={f.value} />
          ))}
        </dl>
      ) : (
        <dl
          className={`flex flex-col divide-y divide-border ${c.lead ? "border-t border-border" : ""}`}
        >
          {facts.map((f) => (
            <div
              key={f.label}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 last:pb-0"
            >
              <dt className="flex items-center gap-2 text-fg-muted">
                <f.icon
                  aria-hidden
                  size={18}
                  className="shrink-0 self-center"
                />
                {f.label}
              </dt>
              <dd className="text-right">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

// a part of the record: its title on the page, its Card under it (a List
// draws its own box); an action on the part alone on its title's line
function PartView({ part }: { part: Part }) {
  const action = part.action && (
    <Button
      variant={part.action.danger ? "danger-text" : "text"}
      size="sm"
      onPress={press(part.action)}
    >
      <part.action.icon aria-hidden size={16} />
      {part.action.label}
    </Button>
  );
  return (
    <Section title={part.title} actions={action}>
      {part.list ? part.body : <Card className="@container">{part.body}</Card>}
    </Section>
  );
}

function HistoryList({ c }: { c: RecordCase }) {
  return (
    <Timeline aria-label="History">
      {c.history!.map((h, i) => (
        <TimelineItem
          key={i}
          icon={h.icon}
          title={h.title}
          when={h.when}
          description={h.description}
          current={i === 0}
        />
      ))}
    </Timeline>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}
    >
      <dt className={strong ? "" : "text-fg-muted"}>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

// something that waits behind a tap until it matters
function Fold({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="text"
        className="-ms-3 self-start"
        aria-expanded={open}
        onPress={() => setOpen(!open)}
      >
        <ChevronDown
          aria-hidden
          size={18}
          className={open ? "rotate-180" : ""}
        />
        {label}
      </Button>
      {open && children}
    </div>
  );
}
