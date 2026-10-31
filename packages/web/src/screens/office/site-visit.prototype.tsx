// PROTOTYPE: throwaway. The Office's page for one Site Visit, on made-up
// data, at /prototype/site-visit?case=1..5&layout=A..C (no sign-in). A is a
// details card then a Findings card; B is one card, findings at its foot; C
// is two columns, its Quote and story on the right. For the UX pass (#96).
// Lives only on prototype-site-visit.
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  ClipboardCheck,
  Clock,
  ContactRound,
  House,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  NotebookPen,
  Sparkles,
  Tag,
  UserRound,
  Users,
  Building2,
  CalendarDays,
} from "lucide-react";
import {
  ActionRow,
  AppLayout,
  Breadcrumbs,
  Button,
  Card,
  DateTile,
  Heading,
  IconTile,
  List,
  ListItem,
  type NavItem,
  Notice,
  Section,
  StatusBadge,
  type StatusTone,
  Timeline,
  TimelineItem,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { Fact } from "../Fact.tsx";
import { JobIcon, QuoteIcon } from "../icons.ts";

const here = linkTo({ to: "/prototype/site-visit" });

// ---- made-up data ----

type Badge = { tone: StatusTone; label: string };

type VisitCase = {
  key: string;
  name: string;
  client: string;
  street: string;
  address: string;
  premises: boolean;
  status: Badge;
  // with no visit: findings recorded from what the Office knew
  at: { iso: string; day: string; time: string } | null;
  minutes: number;
  visitor: { name: string; role: string } | null;
  access: string;
  quote: { title: string; line: string; badge: Badge };
  notice?: { tone: "warning" | "info"; text: string };
  // what it found, once done
  findings: {
    what: string;
    condition: string;
    notes: string;
    recorded: string;
  } | null;
  cancelled?: string;
  story: { icon: LucideIcon; title: string; when?: string; line?: string }[];
};

const booked: VisitCase = {
  key: "1",
  name: "booked, coming up",
  client: "Brightside Dental",
  street: "120 Bedford Ave",
  address: "120 Bedford Ave, Brooklyn 11211",
  premises: true,
  status: { tone: "info", label: "Booked" },
  at: { iso: "2026-11-05T21:30:00Z", day: "Thu, Nov 5", time: "4:30 PM" },
  minutes: 45,
  visitor: { name: "Ana Ruiz", role: "Cleaner" },
  access: "Front desk until 5 PM; ask for Dr. Shah.",
  quote: {
    title: "Office Clean, every week",
    line: "Asked for Oct 29",
    badge: { tone: "info", label: "Asked for" },
  },
  findings: null,
  story: [
    {
      icon: CalendarPlus,
      title: "Booked",
      when: "Oct 30",
      line: "By Olive Owner, for Ana Ruiz",
    },
    { icon: QuoteIcon, title: "Quote asked for", when: "Oct 29" },
  ],
};

const due: VisitCase = {
  ...booked,
  key: "2",
  name: "been, findings to record",
  at: { iso: "2026-10-30T21:30:00Z", day: "Fri, Oct 30", time: "4:30 PM" },
  notice: {
    tone: "warning",
    text: "Ana has been: record what was found, so the Quote can be sent.",
  },
  story: [
    {
      icon: CalendarPlus,
      title: "Booked",
      when: "Oct 27",
      line: "By Olive Owner, for Ana Ruiz",
    },
    { icon: QuoteIcon, title: "Quote asked for", when: "Oct 26" },
  ],
};

const done: VisitCase = {
  key: "3",
  name: "done, home",
  client: "Tom Becker",
  street: "88 Grand St",
  address: "88 Grand St, Brooklyn 11211",
  premises: false,
  status: { tone: "success", label: "Done" },
  at: { iso: "2026-10-22T14:00:00Z", day: "Thu, Oct 22", time: "10:00 AM" },
  minutes: 30,
  visitor: { name: "Olive Owner", role: "Office" },
  access: "Lockbox on the side gate: 4471.",
  quote: {
    title: "Deep Clean",
    line: "Sent Oct 23 · $412.80",
    badge: { tone: "success", label: "Accepted" },
  },
  findings: {
    what: "House · 4 bedrooms · 2.5 bathrooms · 2 floors",
    condition: "Heavy",
    notes: "Renovation dust upstairs. Big dog, friendly.",
    recorded: "Oct 22, 10:40 AM",
  },
  story: [
    {
      icon: ClipboardCheck,
      title: "Findings recorded",
      when: "Oct 22",
      line: "By Olive Owner",
    },
    {
      icon: CalendarPlus,
      title: "Booked",
      when: "Oct 20",
      line: "By Olive Owner",
    },
  ],
};

const known: VisitCase = {
  ...done,
  key: "4",
  name: "findings, no visit",
  client: "Brightside Dental",
  street: "45 Kent Ave",
  address: "45 Kent Ave, Brooklyn 11249",
  premises: true,
  at: null,
  visitor: null,
  access: "Code 2214 at the side door.",
  quote: {
    title: "Office Clean, every 2 weeks",
    line: "Draft",
    badge: { tone: "info", label: "Draft" },
  },
  findings: {
    what: "Dental office · 2,000 sq ft",
    condition: "Moderate",
    notes: "Their second site: same as Bedford Ave.",
    recorded: "Oct 28, 3:12 PM",
  },
  story: [
    {
      icon: ClipboardCheck,
      title: "Findings recorded, with no visit",
      when: "Oct 28",
      line: "By Olive Owner",
    },
  ],
};

const cancelled: VisitCase = {
  ...booked,
  key: "5",
  name: "cancelled",
  status: { tone: "neutral", label: "Cancelled" },
  cancelled: "Oct 31",
  story: [
    {
      icon: CalendarX,
      title: "Cancelled",
      when: "Oct 31",
      line: "By Olive Owner",
    },
    ...booked.story,
  ],
};

const cases = [booked, due, done, known, cancelled];

const layouts = [
  { key: "A", name: "Details card, then Findings" },
  { key: "B", name: "One card, findings at its foot" },
  { key: "C", name: "Two columns, Quote and story right" },
];

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

export function SiteVisitPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/site-visit",
      search: { case: key, layout, ...search } as never,
    });
  const v = cases.find((x) => x.key === key) ?? booked;

  return (
    <AppLayout
      area="Office"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Office</span>}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Breadcrumbs
            trail={[
              { label: v.client, href: here },
              { label: v.address, href: here },
              { label: "Site Visit" },
            ]}
          />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <Heading level={1}>Site Visit</Heading>
              <StatusBadge tone={v.status.tone}>{v.status.label}</StatusBadge>
            </div>
            <p className="text-fg-muted">
              {v.client} · {v.address}
            </p>
          </div>
        </div>
        {v.notice && <Notice tone={v.notice.tone}>{v.notice.text}</Notice>}
        {v.cancelled && (
          <Notice>
            Cancelled {v.cancelled}, so nothing was recorded. Another can be
            booked from the home's page.
          </Notice>
        )}
        {layout === "A" && (
          <>
            <VisitDetails v={v} />
            <Findings v={v} />
          </>
        )}
        {layout === "B" && <VisitDetails v={v} withFindings />}
        {layout === "C" && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-6">
              <VisitDetails v={v} />
              <Findings v={v} />
            </div>
            <div className="flex flex-col gap-6">
              <QuoteRow v={v} />
              <Story v={v} />
            </div>
          </div>
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
        current={v.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

// ---- the parts ----

// when, large, behind a date tile; then who, how long, how to get in and
// the Quote it's for across. Moved or cancelled from its header
function VisitDetails({
  v,
  withFindings = false,
}: {
  v: VisitCase;
  withFindings?: boolean;
}) {
  const isBooked = v.status.label === "Booked";
  return (
    <Section
      title="Visit details"
      actions={
        isBooked && (
          <>
            <Button variant="text" size="sm">
              <CalendarClock aria-hidden size={16} />
              Move
            </Button>
            <Button variant="danger-text" size="sm">
              <CalendarX aria-hidden size={16} />
              Cancel visit
            </Button>
          </>
        )
      }
    >
      <Card>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            {v.at ? (
              <DateTile date={v.at.iso} />
            ) : (
              <IconTile icon={ClipboardCheck} size="lg" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm text-fg-muted">
                {v.premises ? "Business premises" : "A home"}
              </p>
              <p className="text-xl font-semibold text-fg">
                {v.at
                  ? `${v.at.day} at ${v.at.time}`
                  : "Findings recorded, with no visit"}
              </p>
              <p className="text-fg-muted">{v.address}</p>
            </div>
          </div>
          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
              {v.visitor && (
                <Fact
                  icon={UserRound}
                  label="Who visits"
                  value={v.visitor.name}
                  line={`Who visits: ${v.visitor.role}`}
                />
              )}
              {v.at && (
                <Fact
                  icon={Clock}
                  label="How long"
                  value={`${v.minutes} min`}
                  line="Booked for"
                />
              )}
              <Fact icon={KeyRound} label="How we get in" value={v.access} />
              <Fact
                icon={QuoteIcon}
                label="For"
                value={
                  <a href="#" className="text-link font-semibold underline">
                    {v.quote.title}
                  </a>
                }
                line={`The Quote it's for: ${v.quote.line}`}
              />
            </dl>
          </div>
          {withFindings && <FindingsBody v={v} divided />}
        </div>
      </Card>
    </Section>
  );
}

function Findings({ v }: { v: VisitCase }) {
  if (v.cancelled) return null;
  return (
    <Section title="Findings">
      <Card>
        <FindingsBody v={v} />
      </Card>
    </Section>
  );
}

// what it found, or the way to record it once it's been
function FindingsBody({
  v,
  divided = false,
}: {
  v: VisitCase;
  divided?: boolean;
}) {
  if (v.cancelled) return null;
  const line = divided ? "border-t border-border pt-6" : "";
  if (!v.findings) {
    return (
      <div className={line}>
        <ActionRow
          actions={
            <Button variant={v.notice ? "primary" : "secondary"}>
              <ClipboardCheck aria-hidden size={18} />
              Record findings
            </Button>
          }
        >
          <p>
            When it's done, record what was found: it updates the{" "}
            {v.premises ? "premises'" : "home's"} details, and the Quote can be
            sent.
          </p>
        </ActionRow>
      </div>
    );
  }
  const f = v.findings;
  return (
    <div className={`flex flex-col gap-4 ${line}`}>
      {divided && <p className="font-semibold text-fg">What it found</p>}
      <div className="@container">
        <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
          <Fact
            icon={v.premises ? Building2 : House}
            label="What it is"
            value={f.what}
            className="@3xl:col-span-2"
          />
          <Fact icon={Sparkles} label="Condition" value={f.condition} />
          <Fact icon={CalendarCheck} label="Recorded" value={f.recorded} />
          <Fact
            icon={NotebookPen}
            label="Office notes"
            value={f.notes}
            className="@md:col-span-2 @3xl:col-span-4"
          />
        </dl>
      </div>
    </div>
  );
}

function QuoteRow({ v }: { v: VisitCase }) {
  return (
    <Section title="Quote">
      <List aria-label="The Quote it's for" onAction={() => {}}>
        <ListItem
          id="quote"
          start={<IconTile icon={QuoteIcon} />}
          title={v.quote.title}
          description={v.quote.line}
          end={
            <StatusBadge tone={v.quote.badge.tone}>
              {v.quote.badge.label}
            </StatusBadge>
          }
        />
      </List>
    </Section>
  );
}

function Story({ v }: { v: VisitCase }) {
  return (
    <Section title="History">
      <Card>
        <Timeline aria-label="History">
          {v.story.map((s) => (
            <TimelineItem
              key={s.title + s.when}
              icon={s.icon}
              title={s.title}
              when={s.when}
              description={s.line}
            />
          ))}
        </Timeline>
      </Card>
    </Section>
  );
}
