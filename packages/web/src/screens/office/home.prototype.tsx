// PROTOTYPE: throwaway. The Office's page for a home, on made-up data, at
// /prototype/office-home?case=1..4&layout=A..C (no sign-in). A keeps the
// Tabs, each read first; B is one page of Sections; C is two columns, its
// history a Timeline. For the UX pass (#96). Lives only on
// prototype-office-home.
import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarX,
  CirclePlus,
  Clock,
  ContactRound,
  FileText,
  House,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  NotebookPen,
  PiggyBank,
  Receipt,
  Ruler,
  Sparkles,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import {
  ActionRow,
  Actions,
  AppLayout,
  Breadcrumbs,
  Button,
  Card,
  Cell,
  Column,
  Dialog,
  DialogTrigger,
  Heading,
  IconTile,
  List,
  ListItem,
  type NavItem,
  Notice,
  Row,
  Section,
  StatusBadge,
  type StatusTone,
  Tab,
  Table,
  TableBody,
  TableHeader,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  Timeline,
  TimelineItem,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { Fact } from "../Fact.tsx";
import { JobIcon, QuoteIcon } from "../icons.ts";

const here = linkTo({ to: "/prototype/office-home" });

// ---- made-up data ----

type Badge = { tone: StatusTone; label: string };

type Plan = {
  status: Badge;
  recurrence: string;
  days: { when: string; service: string }[];
  price: string;
  onSite: string;
  crew: string;
  extras: string;
  deposit: string;
  started: string;
  quote: string;
  payment: string;
  waiting: string[];
  next: string | null;
};

type Visit = {
  status: Badge;
  when: string;
  who: string;
  minutes: number;
  findings: string | null;
};

type Event = {
  on: string;
  month: string;
  icon: LucideIcon;
  kind: string;
  what: string;
  status: Badge;
};

type HomeCase = {
  key: string;
  name: string;
  client: string;
  street: string;
  address: string;
  premises: boolean;
  standing: Badge;
  summary: string;
  floorArea: string;
  condition: string;
  access: string;
  officeNotes: string;
  // warnings for the Office, above it all
  notices: { tone?: "warning" | "info"; text: string; action?: string }[];
  plan: Plan | null;
  // with no plan: why, and what to do about it
  noPlan?: { line: string; action?: string };
  visit: Visit | null;
  noVisit?: { line: string; action?: string };
  history: Event[];
};

const austin: HomeCase = {
  key: "1",
  name: "plan, 2 waiting",
  client: "Maria Lopez",
  street: "41-12 Austin St, 4B",
  address: "41-12 Austin St, 4B, Forest Hills 11375",
  premises: false,
  standing: { tone: "success", label: "Service Plan" },
  summary: "Apartment · 2 bedrooms · 1 bathroom",
  floorArea: "850 sq ft",
  condition: "Moderate",
  access: "Buzz 4B. Spare key with the doorman, Luis.",
  officeNotes: "Cat hides under the bed: don't let her out.",
  notices: [],
  plan: {
    status: { tone: "success", label: "Active" },
    recurrence: "Every week",
    days: [{ when: "Mondays at 9:00 AM", service: "Standard Clean" }],
    price: "$148.50",
    onSite: "About 2 h 30 min",
    crew: "2 cleaners",
    extras: "Inside the fridge",
    deposit: "$148.50",
    started: "Oct 5, 2026",
    quote: "EC-Q-000012",
    payment: "Each clean is charged to the saved card when it's done.",
    waiting: ["Mon, Nov 9", "Mon, Nov 16"],
    next: "Mon, Nov 2, 9:00 AM",
  },
  visit: null,
  noVisit: { line: "A Site Visit is booked for a Quote not sent yet." },
  history: [
    ev("Nov 2", "November", JobIcon, "Job", "Standard Clean", "info", "Booked"),
    ev(
      "Oct 26",
      "October",
      JobIcon,
      "Job",
      "Standard Clean",
      "success",
      "Completed",
    ),
    ev(
      "Oct 19",
      "October",
      JobIcon,
      "Job",
      "Standard Clean",
      "danger",
      "No Access",
    ),
    ev(
      "Oct 12",
      "October",
      JobIcon,
      "Job",
      "Standard Clean",
      "success",
      "Completed",
    ),
    ev(
      "Oct 5",
      "October",
      QuoteIcon,
      "Quote",
      "Service Plan, every week",
      "success",
      "Accepted",
    ),
    ev(
      "Sep 28",
      "September",
      JobIcon,
      "Job",
      "Deep Clean, First Clean",
      "success",
      "Completed",
    ),
    ev(
      "Sep 20",
      "September",
      QuoteIcon,
      "Quote",
      "Deep Clean",
      "success",
      "Accepted",
    ),
  ],
};

const office: HomeCase = {
  key: "2",
  name: "premises, Site Visit booked",
  client: "Brightside Dental",
  street: "120 Bedford Ave",
  address: "120 Bedford Ave, Brooklyn 11211",
  premises: true,
  standing: { tone: "info", label: "Quote asked for" },
  summary: "Dental office",
  floorArea: "Not known yet",
  condition: "Not known yet",
  access: "",
  officeNotes: "",
  notices: [
    {
      text: "Business premises are seen before they're quoted. The Site Visit is booked for Thu, Nov 5.",
    },
  ],
  plan: null,
  noPlan: {
    line: "Business premises can be quoted a Service Plan at any time: a Quote was asked for, so carry on with that one.",
    action: "Open the Quote",
  },
  visit: {
    status: { tone: "info", label: "Booked" },
    when: "Thu, Nov 5, 4:30 PM",
    who: "Ana Ruiz",
    minutes: 45,
    findings: null,
  },
  history: [
    ev(
      "Nov 5",
      "November",
      MapPin,
      "Site Visit",
      "Ana Ruiz · 45 min",
      "info",
      "Booked",
    ),
    ev(
      "Oct 29",
      "October",
      QuoteIcon,
      "Quote",
      "Asked for: Office Clean, weekly",
      "info",
      "Asked for",
    ),
  ],
};

const grand: HomeCase = {
  key: "3",
  name: "new, First Clean booked",
  client: "Tom Becker",
  street: "88 Grand St",
  address: "88 Grand St, Brooklyn 11211",
  premises: false,
  standing: { tone: "info", label: "Booked" },
  summary: "House · 4 bedrooms · 2.5 bathrooms · 2 floors",
  floorArea: "2,100 sq ft",
  condition: "Heavy",
  access: "Lockbox on the side gate: 4471.",
  officeNotes: "",
  notices: [],
  plan: null,
  noPlan: {
    line: "A home can be quoted a Service Plan once its First Clean is Completed: that's Sat, Nov 7.",
  },
  visit: null,
  noVisit: { line: "A Site Visit is booked for a Quote not sent yet." },
  history: [
    ev(
      "Nov 7",
      "November",
      JobIcon,
      "Job",
      "Deep Clean, First Clean",
      "info",
      "Booked",
    ),
    ev(
      "Oct 30",
      "October",
      QuoteIcon,
      "Quote",
      "Deep Clean",
      "success",
      "Accepted",
    ),
  ],
};

const held: HomeCase = {
  ...austin,
  key: "4",
  name: "plan On Hold, new terms sent",
  standing: { tone: "warning", label: "On Hold" },
  notices: [
    {
      tone: "warning",
      text: "The plan is On Hold: the Nov 2 charge failed and the Client hasn't paid it.",
      action: "Open the Job",
    },
    {
      text: "New terms are with the Client, waiting on their answer.",
      action: "Open the Quote",
    },
  ],
  plan: {
    ...austin.plan!,
    status: { tone: "warning", label: "On Hold" },
    waiting: [],
    next: null,
  },
};

const cases = [austin, office, grand, held];

const layouts = [
  { key: "A", name: "Tabs, each read first" },
  { key: "B", name: "One page of Sections" },
  { key: "C", name: "Two columns, history right" },
];

function ev(
  on: string,
  month: string,
  icon: LucideIcon,
  kind: string,
  what: string,
  tone: StatusTone,
  label: string,
): Event {
  return { on, month, icon, kind, what, status: { tone, label } };
}

const nav: NavItem[] = [
  { href: here, label: "Today", icon: LayoutDashboard },
  { href: here, label: "Quotes", icon: QuoteIcon },
  { href: here, label: "Jobs", icon: JobIcon },
  { href: here, label: "Clients", icon: ContactRound, isCurrent: true },
  { href: here, label: "Schedule", icon: CalendarDays },
  { href: here, label: "Staff", icon: Users },
  { href: here, label: "Price List", icon: Tag },
];

// ---- the page ----

export function OfficeHomePrototype() {
  const { case: key = "1", layout = "A" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/office-home",
      search: { case: key, layout, ...search } as never,
    });
  const c = cases.find((x) => x.key === key) ?? austin;

  return (
    <AppLayout
      area="Office"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Office</span>}
    >
      <div className="flex flex-col gap-6">
        <Header c={c} />
        {c.notices.map((n) => (
          <Notice
            key={n.text}
            tone={n.tone}
            action={n.action && <Button variant="quiet">{n.action}</Button>}
          >
            {n.text}
          </Notice>
        ))}
        {layout === "A" && <TabsLayout c={c} />}
        {layout === "B" && <OnePage c={c} />}
        {layout === "C" && <TwoColumns c={c} />}
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

function Header({ c }: { c: HomeCase }) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: "Clients", href: here },
          { label: c.client, href: here },
          { label: c.street },
        ]}
      />
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{c.street}</Heading>
          <StatusBadge tone={c.standing.tone}>{c.standing.label}</StatusBadge>
        </div>
        <p className="text-fg-muted">
          {c.client} · {c.address}
        </p>
      </div>
    </div>
  );
}

// ---- A: Tabs, each read first ----

function TabsLayout({ c }: { c: HomeCase }) {
  const [tab, setTab] = useState<string>("details");
  return (
    <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
      <TabList aria-label="About this home">
        <Tab id="details">Details</Tab>
        <Tab id="plan">Service Plan</Tab>
        <Tab id="visit">Site Visit</Tab>
        <Tab id="history" count={c.history.length}>
          History
        </Tab>
      </TabList>
      <TabPanel id="details">
        <DetailsSection c={c} />
      </TabPanel>
      <TabPanel id="plan">
        <PlanSection c={c} />
      </TabPanel>
      <TabPanel id="visit">
        <VisitSection c={c} />
      </TabPanel>
      <TabPanel id="history">
        <HistoryTable c={c} />
      </TabPanel>
    </Tabs>
  );
}

// ---- B: one page ----

function OnePage({ c }: { c: HomeCase }) {
  return (
    <>
      <DetailsSection c={c} />
      <PlanSection c={c} />
      <VisitSection c={c} compact />
      <Section title="History">
        <HistoryList c={c} />
      </Section>
    </>
  );
}

// ---- C: two columns ----

function TwoColumns({ c }: { c: HomeCase }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <DetailsSection c={c} />
        <PlanSection c={c} />
        <VisitSection c={c} compact />
      </div>
      <Section title="History">
        <Card>
          <Timeline aria-label="History">
            {c.history.map((e) => (
              <TimelineItem
                key={e.on + e.kind}
                icon={e.icon}
                title={`${e.kind} · ${e.what}`}
                when={e.on}
                description={
                  <StatusBadge tone={e.status.tone}>
                    {e.status.label}
                  </StatusBadge>
                }
              />
            ))}
          </Timeline>
        </Card>
      </Section>
    </div>
  );
}

// ---- the parts ----

// what it is, large, then its facts across; corrected in a dialog
function DetailsSection({ c }: { c: HomeCase }) {
  return (
    <Section
      title={c.premises ? "Premises details" : "Home details"}
      actions={<EditDetails c={c} />}
    >
      <Card>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <IconTile icon={c.premises ? Building2 : House} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm text-fg-muted">
                {c.premises ? "Business premises" : "A home"}
              </p>
              <p className="text-xl font-semibold text-fg">{c.summary}</p>
            </div>
          </div>
          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
              <Fact icon={Ruler} label="Floor area" value={c.floorArea} />
              <Fact
                icon={Sparkles}
                label="Condition"
                value={c.condition}
                line="Condition, at the last visit"
              />
              <Fact
                icon={KeyRound}
                label="How we get in"
                value={c.access || "Not added yet"}
                line="How we get in: the Client's, and the crew's"
              />
              <Fact
                icon={NotebookPen}
                label="Office notes"
                value={c.officeNotes || "None"}
                line="Office notes: only Office Staff see them"
              />
            </dl>
          </div>
        </div>
      </Card>
    </Section>
  );
}

function EditDetails({ c }: { c: HomeCase }) {
  return (
    <DialogTrigger>
      <Button variant="secondary">Correct</Button>
      <Dialog title={`Correct ${c.street}`}>
        {({ close }) => (
          <>
            <p className="text-sm text-fg-muted">
              Corrections change the price of Quotes made from now on.
            </p>
            <TextField label="Floor area in sq ft" defaultValue="850" />
            <TextField
              label="Access Instructions"
              description="The Client sees these, and can change them too."
              multiline
              defaultValue={c.access}
            />
            <TextField
              label="Office notes"
              description="Only Office Staff see these."
              multiline
              defaultValue={c.officeNotes}
            />
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button onPress={close}>Save corrections</Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// the plan as the portal reads it, with what the Office does about it
function PlanSection({ c }: { c: HomeCase }) {
  const p = c.plan;
  if (!p) {
    return (
      <Section title="Service Plan">
        <Card>
          <ActionRow
            actions={
              c.noPlan?.action ? (
                <Button variant="secondary">{c.noPlan.action}</Button>
              ) : (
                c.key !== "3" && <Button>Quote a Service Plan</Button>
              )
            }
          >
            <p>{c.noPlan?.line}</p>
          </ActionRow>
        </Card>
      </Section>
    );
  }
  return (
    <>
      {p.waiting.length > 0 && (
        <Section
          title="Waiting to be booked"
          description="These dates came round with no room on the Schedule. Agree another time with the Client, or skip the visit."
        >
          <List aria-label="Visits waiting to be booked" onAction={() => {}}>
            {p.waiting.map((day) => (
              <ListItem
                key={day}
                id={day}
                start={<IconTile icon={CalendarX} tone="warning" />}
                title={`Book the ${day} visit`}
                description="No room that day · Book or skip"
              />
            ))}
          </List>
        </Section>
      )}
      <Section
        title="Service Plan"
        actions={<Button variant="secondary">Change terms</Button>}
      >
        <Card>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start gap-4">
              <IconTile icon={CalendarClock} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm text-fg-muted">{p.recurrence}</p>
                {p.days.map((d) => (
                  <p key={d.when} className="text-xl font-semibold text-fg">
                    {d.when}
                  </p>
                ))}
                <p className="text-fg-muted">
                  {p.days.map((d) => d.service).join(", ")}
                  {p.next && ` · next ${p.next}`}
                </p>
              </div>
              <StatusBadge tone={p.status.tone}>{p.status.label}</StatusBadge>
            </div>
            <div className="@container">
              <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
                <Fact
                  icon={Receipt}
                  label="Each clean"
                  value={p.price}
                  line="Each clean, tax included, 10% off"
                />
                <Fact
                  icon={Clock}
                  label="On site"
                  value={p.onSite}
                  line={`On site, ${p.crew}`}
                />
                <Fact icon={CirclePlus} label="Extras" value={p.extras} />
                <Fact
                  icon={PiggyBank}
                  label="Deposit"
                  value={p.deposit}
                  line="Deposit, comes off the last clean"
                />
              </dl>
            </div>
            <p className="border-t border-border pt-4 text-sm text-fg-muted">
              {p.payment} Started {p.started} from{" "}
              <a href="#" className="text-link underline">
                Quote {p.quote}
              </a>
              .
            </p>
          </div>
        </Card>
      </Section>
      <Section title="End the plan">
        <Card>
          <ActionRow actions={<Button variant="secondary">End plan</Button>}>
            <p>
              For a Client who's stopping. Its booked Jobs are cancelled and the
              Deposit comes off the last one.
            </p>
          </ActionRow>
        </Card>
      </Section>
    </>
  );
}

// its Site Visit: booked, done or none. Compact on one page: a row
function VisitSection({
  c,
  compact = false,
}: {
  c: HomeCase;
  compact?: boolean;
}) {
  const v = c.visit;
  if (!v) {
    if (compact) return null;
    return (
      <Section title="Site Visit">
        <Card>
          <p className="text-fg-muted">{c.noVisit?.line}</p>
        </Card>
      </Section>
    );
  }
  if (compact) {
    return (
      <Section title="Site Visit">
        <List aria-label="Site Visit" onAction={() => {}}>
          <ListItem
            id="visit"
            start={<IconTile icon={MapPin} />}
            title={v.when}
            description={`${v.who} · ${v.minutes} min · findings to record`}
            end={
              <StatusBadge tone={v.status.tone}>{v.status.label}</StatusBadge>
            }
          />
        </List>
      </Section>
    );
  }
  return (
    <Section
      title="Site Visit"
      actions={<Button variant="secondary">Record findings</Button>}
    >
      <Card>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start gap-4">
            <IconTile icon={MapPin} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm text-fg-muted">Site Visit</p>
              <p className="text-xl font-semibold text-fg">{v.when}</p>
              <p className="text-fg-muted">For the Quote asked for Oct 29</p>
            </div>
            <StatusBadge tone={v.status.tone}>{v.status.label}</StatusBadge>
          </div>
          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
              <Fact
                icon={UserRound}
                label="Who"
                value={v.who}
                line="Who's going"
              />
              <Fact
                icon={Clock}
                label="How long"
                value={`${v.minutes} min`}
                line="How long it's booked for"
              />
              <Fact
                icon={FileText}
                label="Findings"
                value={v.findings ?? "Not recorded yet"}
              />
            </dl>
          </div>
        </div>
      </Card>
    </Section>
  );
}

function HistoryTable({ c }: { c: HomeCase }) {
  return (
    <Table aria-label="History" onRowAction={() => {}}>
      <TableHeader>
        <Column id="on" isRowHeader>
          Date
        </Column>
        <Column id="what">What</Column>
        <Column id="status">Status</Column>
      </TableHeader>
      <TableBody items={c.history.map((e) => ({ ...e, id: e.on + e.kind }))}>
        {(e) => (
          <Row id={e.id}>
            <Cell>{e.on}</Cell>
            <Cell>
              <span className="flex items-center gap-2">
                <e.icon aria-hidden size={16} className="text-fg-muted" />
                <span>
                  <span className="font-semibold">{e.kind}</span> · {e.what}
                </span>
              </span>
            </Cell>
            <Cell>
              <StatusBadge tone={e.status.tone}>{e.status.label}</StatusBadge>
            </Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );
}

// by month, as the portal's Cleans: a badge only when it isn't plain
function HistoryList({ c }: { c: HomeCase }): ReactNode {
  const months = [...new Set(c.history.map((e) => e.month))];
  return (
    <div className="flex flex-col gap-4">
      {months.map((m) => (
        <div key={m} className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-fg-muted">{m}</p>
          <List aria-label={m} onAction={() => {}}>
            {c.history
              .filter((e) => e.month === m)
              .map((e) => (
                <ListItem
                  key={e.on + e.kind}
                  id={e.on + e.kind}
                  start={<IconTile icon={e.icon} />}
                  title={`${e.kind} · ${e.what}`}
                  description={e.on}
                  end={
                    e.status.label === "Completed" ||
                    e.status.label === "Accepted" ? undefined : (
                      <StatusBadge tone={e.status.tone}>
                        {e.status.label}
                      </StatusBadge>
                    )
                  }
                />
              ))}
          </List>
        </div>
      ))}
    </div>
  );
}
