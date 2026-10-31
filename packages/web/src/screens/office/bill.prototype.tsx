// PROTOTYPE: throwaway. The Office's page for one weekly Bill, on made-up
// data, at /prototype/bill?case=1..5&layout=A..C (no sign-in). A is a
// details card then its lines; B is one card read like a paper invoice; C
// is two columns, its lines left and what it comes to right. For the UX pass
// (#96). Lives only on prototype-bill.
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Ban,
  Banknote,
  CalendarDays,
  CalendarRange,
  ContactRound,
  CreditCard,
  FileText,
  LayoutDashboard,
  Printer,
  Receipt,
  Tag,
  Users,
} from "lucide-react";
import {
  AppLayout,
  Breadcrumbs,
  Button,
  Card,
  Heading,
  IconTile,
  type NavItem,
  Notice,
  Section,
  StatusBadge,
  type StatusTone,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { Fact } from "../Fact.tsx";
import { JobIcon, QuoteIcon } from "../icons.ts";

const here = linkTo({ to: "/prototype/bill" });

// ---- made-up data ----

type Line = { label: string; when?: string; amount: string; job: boolean };

type BillCase = {
  key: string;
  name: string;
  number: string;
  client: string;
  week: string;
  status: { tone: StatusTone; label: string };
  // the headline: what it comes to, and what that means now
  total: string;
  totalLine: string;
  made: string;
  how: { value: string; line: string };
  // paid, due by, or voided
  standing: { icon: typeof Receipt; value: string; line: string };
  notice?: { tone: "info" | "danger" | "warning"; text: string };
  lines: Line[];
  tax: string;
  credit?: boolean;
  due: boolean;
};

const lines: Line[] = [
  {
    label: "Office Clean at 120 Bedford Ave",
    when: "Mon, Jan 12, 6:00 PM",
    amount: "$210.00",
    job: true,
  },
  {
    label: "Office Clean at 120 Bedford Ave",
    when: "Wed, Jan 14, 6:00 PM",
    amount: "$210.00",
    job: true,
  },
  {
    label: "Extra work: Office Clean at 120 Bedford Ave",
    when: "Wed, Jan 14, 6:00 PM",
    amount: "$45.00",
    job: true,
  },
  {
    label: "Office Clean at 45 Kent Ave",
    when: "Fri, Jan 16, 7:00 PM",
    amount: "$165.00",
    job: true,
  },
];

const dueOnPage: BillCase = {
  key: "1",
  name: "due, on its page",
  number: "EC-000124",
  client: "Brightside Dental",
  week: "Week of Mon, Jan 12",
  status: { tone: "warning", label: "Due" },
  total: "$630.00",
  totalLine: "To pay by Mon, Feb 2",
  made: "Mon, Jan 19",
  how: { value: "On its page", line: "How they pay: by card or bank" },
  standing: {
    icon: CalendarDays,
    value: "Mon, Feb 2",
    line: "Due by: 14 days' terms",
  },
  notice: {
    tone: "info",
    text: "Waiting for the Client to pay it on its page, by Mon, Feb 2.",
  },
  lines,
  tax: "$51.36",
  due: true,
};

const failed: BillCase = {
  ...dueOnPage,
  key: "2",
  name: "Charge failed",
  status: { tone: "danger", label: "Unpaid" },
  totalLine: "Its Charge failed Jan 19",
  how: {
    value: "Charged automatically",
    line: "How they pay: Visa ending 4242",
  },
  standing: {
    icon: CreditCard,
    value: "Card declined",
    line: "Charge failed Mon, Jan 19",
  },
  notice: {
    tone: "danger",
    text: "Its automatic Charge failed (card declined) on Jan 19. The Client's Service Plans with Jobs on it are On Hold until it's paid.",
  },
};

const paid: BillCase = {
  ...dueOnPage,
  key: "3",
  name: "paid",
  status: { tone: "success", label: "Paid" },
  totalLine: "Paid Jan 19",
  how: {
    value: "Charged automatically",
    line: "How they pay: Visa ending 4242",
  },
  standing: {
    icon: Receipt,
    value: "Charged Mon, Jan 19",
    line: "Paid: to their saved Payment Method",
  },
  notice: undefined,
  due: false,
};

const voided: BillCase = {
  ...dueOnPage,
  key: "4",
  name: "voided",
  status: { tone: "neutral", label: "Void" },
  total: "$630.00",
  totalLine: "Nothing to pay: voided",
  standing: {
    icon: Ban,
    value: "Voided Tue, Jan 20",
    line: "Wrong week's cleans: re-billed on EC-000125",
  },
  notice: undefined,
  due: false,
};

const credit: BillCase = {
  ...dueOnPage,
  key: "5",
  name: "credit",
  status: { tone: "success", label: "Paid" },
  total: "$40.00 credit",
  totalLine: "Comes off their next Bill",
  standing: {
    icon: Receipt,
    value: "Nothing to pay",
    line: "The credit comes off their next Bill",
  },
  notice: undefined,
  lines: [
    {
      label: "Refund on Office Clean at 120 Bedford Ave",
      when: "Mon, Jan 12, 6:00 PM",
      amount: "−$40.00",
      job: true,
    },
  ],
  tax: "−$3.26",
  credit: true,
  due: false,
};

const cases = [dueOnPage, failed, paid, voided, credit];

const layouts = [
  { key: "A", name: "Details card, then its lines" },
  { key: "B", name: "One card, read like an invoice" },
  { key: "C", name: "Two columns, lines left, total right" },
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

export function BillPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/bill",
      search: { case: key, layout, ...search } as never,
    });
  const b = cases.find((x) => x.key === key) ?? dueOnPage;

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
              { label: "Clients", href: here },
              { label: b.client, href: here },
              { label: `Bill ${b.number}` },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Heading level={1}>Bill {b.number}</Heading>
              <StatusBadge tone={b.status.tone}>{b.status.label}</StatusBadge>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.due && (
                <>
                  <Button variant="text" size="sm">
                    <Banknote aria-hidden size={16} />
                    Record a payment
                  </Button>
                  <Button variant="danger-text" size="sm">
                    <Ban aria-hidden size={16} />
                    Void
                  </Button>
                </>
              )}
              <Button variant="text" size="sm">
                <Printer aria-hidden size={16} />
                Print
              </Button>
            </div>
          </div>
          <p className="text-fg-muted">
            {b.client} · {b.week}
          </p>
        </div>
        {b.notice && <Notice tone={b.notice.tone}>{b.notice.text}</Notice>}
        {layout === "A" && (
          <>
            <Section title="Bill details">
              <Card>
                <div className="flex flex-col gap-6">
                  <Headline b={b} />
                  <Facts b={b} />
                </div>
              </Card>
            </Section>
            <Section title="What it's for" description="Prices include tax.">
              <Card>
                <Lines b={b} />
              </Card>
            </Section>
          </>
        )}
        {layout === "B" && (
          <Section title="Bill details">
            <Card>
              <div className="flex flex-col gap-6">
                <Headline b={b} />
                <Facts b={b} />
                <div className="flex flex-col gap-3 border-t border-border pt-6">
                  <p className="font-semibold text-fg">
                    What it's for{" "}
                    <span className="font-normal text-fg-muted text-sm">
                      · prices include tax
                    </span>
                  </p>
                  <Lines b={b} />
                </div>
              </div>
            </Card>
          </Section>
        )}
        {layout === "C" && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Section title="What it's for" description="Prices include tax.">
              <Card>
                <Lines b={b} />
              </Card>
            </Section>
            <Section title="Bill details">
              <Card>
                <div className="flex flex-col gap-6">
                  <Headline b={b} />
                  <Facts b={b} narrow />
                </div>
              </Card>
            </Section>
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
        current={b.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

// ---- the parts ----

// what it comes to, large, and what that means now
function Headline({ b }: { b: BillCase }) {
  return (
    <div className="flex items-start gap-4">
      <IconTile icon={FileText} size="lg" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm text-fg-muted">
          {b.credit ? "Credit" : "Total"}, tax included
        </p>
        <p
          className={`text-3xl font-semibold ${b.status.label === "Void" ? "text-fg-muted line-through" : "text-fg"}`}
        >
          {b.total}
        </p>
        <p className="text-fg-muted">{b.totalLine}</p>
      </div>
    </div>
  );
}

function Facts({ b, narrow = false }: { b: BillCase; narrow?: boolean }) {
  return (
    <div className="@container">
      <dl
        className={`grid gap-x-6 gap-y-4 ${narrow ? "" : "@md:grid-cols-2 @3xl:grid-cols-4"}`}
      >
        <Fact
          icon={CalendarRange}
          label="Week"
          value="Jan 12 to Jan 18"
          line="The week it covers"
        />
        <Fact icon={CalendarDays} label="Made" value={b.made} />
        <Fact
          icon={CreditCard}
          label="How they pay"
          value={b.how.value}
          line={b.how.line}
        />
        <Fact
          icon={b.standing.icon}
          label="Standing"
          value={b.standing.value}
          line={b.standing.line}
        />
      </dl>
    </div>
  );
}

// each line, a Job's linking to it, then the tax in it and the total
function Lines({ b }: { b: BillCase }) {
  const row = "flex items-start justify-between gap-6";
  return (
    <div className="flex flex-col">
      {b.lines.map((line, i) => (
        <div
          key={i}
          className={`${row} border-b border-border py-3 first:pt-0`}
        >
          <div className="flex min-w-0 flex-col">
            {line.job ? (
              <a href="#" className="text-fg hover:underline">
                {line.label}
              </a>
            ) : (
              line.label
            )}
            {line.when && (
              <span className="text-sm text-fg-muted">{line.when}</span>
            )}
          </div>
          <span className="tabular-nums">{line.amount}</span>
        </div>
      ))}
      <div className={`${row} pt-3 text-fg-muted`}>
        <span>Tax included</span>
        <span className="tabular-nums">{b.tax}</span>
      </div>
      <div className={`${row} pt-1 font-semibold`}>
        <span>{b.credit ? "Credit" : "Total"}</span>
        <span className="tabular-nums">{b.total}</span>
      </div>
    </div>
  );
}
