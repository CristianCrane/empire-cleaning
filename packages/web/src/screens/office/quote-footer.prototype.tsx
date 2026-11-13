// PROTOTYPE: throwaway. The Office's Quote Draft, on made-up data, at
// /prototype/quote-footer?layout=A..C&case=1..3 (no sign-in), inside the
// real AppLayout with the Office's nav, to compare fixes for its bottom bar
// hiding behind a phone's tab bar (#425). A is the bar as it is; B its
// content in ActionFooter; C the sticky bar lifted over the tab bar. Lives
// only on prototype-quote-footer.
import { useId, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { parseDate, parseTime } from "@internationalized/date";
import { CalendarPlus, Trash2 } from "lucide-react";
import {
  ActionFooter,
  AppLayout,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Heading,
  Link,
  type NavItem,
  Notice,
  NumberField,
  Select,
  SelectItem,
  StatusBadge,
  TimeField,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { navFor } from "../AreaLayout.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

const here = linkTo({ to: "/prototype/quote-footer" });

// ---- made-up data ----

type Day = { title: string; date: string; time: string; crew: number };

type DraftCase = {
  key: string;
  name: string;
  client: string;
  address: string;
  home: string;
  // a Service Plan's weekdays; none for a one-off clean
  days?: Day[];
  // what the bar says the prices come to
  summary: string;
  saveState: string;
  // no email on file: it can't be sent
  noEmail?: boolean;
};

const typical: DraftCase = {
  key: "1",
  name: "typical",
  client: "Maria Lopez",
  address: "482 Halsey St, Brooklyn",
  home: "House · 3 bedrooms · 2 bathrooms",
  summary: "Deep Clean $385.00 · Standard Clean $210.00",
  saveState: "All changes saved",
};

const long: DraftCase = {
  key: "2",
  name: "long",
  client: "Christopher Abernathy-Whitfield",
  address: "1250 Ocean Pkwy, Apt 6C, Brooklyn",
  home: "Apartment · 2 bedrooms · 1 bathroom",
  days: [
    { title: "Mondays", date: "2026-11-23", time: "09:00", crew: 2 },
    { title: "Wednesdays", date: "2026-11-25", time: "09:00", crew: 2 },
    { title: "Fridays", date: "2026-11-27", time: "13:30", crew: 3 },
  ],
  summary:
    "3 cleans a week: $612.00 a week · Deposit $91.80 · First clean Mon, Nov 23",
  saveState: "All changes saved",
};

const cantSend: DraftCase = {
  ...typical,
  key: "3",
  name: "can't send",
  client: "Dana Reyes",
  address: "77 Clinton Ave, Brooklyn",
  summary: "Standard Clean $185.00",
  saveState: "Updating prices…",
  noEmail: true,
};

const cases = [typical, long, cantSend];

const layouts = [
  { key: "A", name: "Current" },
  { key: "B", name: "ActionFooter" },
  { key: "C", name: "Sticky with offset" },
];

export function QuoteFooterPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const layout = layouts.some((l) => l.key === search.layout)
    ? search.layout!
    : "A";
  const q = cases.find((x) => x.key === search.case) ?? typical;
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/quote-footer",
      search: { case: q.key, layout, ...change },
      replace: true,
    });

  const nav: NavItem[] = navFor("en").office.map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === "Quotes",
    }),
  );

  return (
    <AppLayout area="Office" nav={nav} foot={() => null}>
      {/* room for the switchers, so they cover nothing of the page at rest */}
      <div aria-hidden className="h-24" />
      <Form className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Breadcrumbs
            trail={[
              { label: "Quotes", href: here },
              { label: q.client, href: here },
              { label: q.address, href: here },
              { label: q.days ? "Service Plan Quote" : "Quote", href: here },
              { label: "Draft quote" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Heading level={1}>Draft quote for {q.client}</Heading>
            <StatusBadge tone="neutral">Not sent yet</StatusBadge>
            <div className="ml-auto">
              <Button variant="danger-text" size="sm">
                <Trash2 aria-hidden size={16} />
                Delete draft
              </Button>
            </div>
          </div>
          <p className="text-fg-muted">
            {q.address} · {q.home} · <Link href={here}>View property</Link>
          </p>
        </div>

        <Card>
          <div className="flex flex-col gap-5">
            {q.days ? <PlanParts q={q} days={q.days} /> : <OneOffParts />}
            <DraftPart
              title="Extras"
              description={
                q.days
                  ? "Done on every clean. Each adds its hours to the price, and the plan discount comes off it too."
                  : "Each adds its hours to the price of each service it goes with."
              }
            >
              <div className="flex flex-col">
                <Checkbox defaultSelected>Inside the fridge</Checkbox>
                <Checkbox>Inside the oven</Checkbox>
                <Checkbox defaultSelected>Inside cabinets</Checkbox>
                <Checkbox>Interior windows</Checkbox>
                <Checkbox>Laundry, wash and fold</Checkbox>
              </div>
            </DraftPart>
            <DraftPart title="Terms">
              <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
                {!q.days && <NumberField label="Cleaners" defaultValue={2} />}
                <NumberField label="Deposit (%)" defaultValue={15} />
                <NumberField label="Valid for (days)" defaultValue={14} />
              </div>
            </DraftPart>
            {!q.days && (
              <DraftPart
                title="Proposed time"
                description="New York time, more than 48 hours away. If it isn't accepted first, the quote expires 48 hours before it."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <DatePicker
                    label="Date"
                    defaultValue={parseDate("2026-11-20")}
                  />
                  <TimeField
                    label="Start time"
                    defaultValue={parseTime("10:00")}
                  />
                </div>
                <p className="text-sm text-success-strong">
                  Room for 2 cleaners on Fri, Nov 20 at 10:00 AM.
                </p>
              </DraftPart>
            )}
          </div>
        </Card>

        {q.noEmail && (
          <Notice tone="warning">
            <p>
              {q.client} has no email yet, so the quote can't be sent. Add their
              email on <Link href={here}>their client page</Link>, then send it.
            </p>
          </Notice>
        )}

        {layout === "A" && <StickyBar q={q} className="bottom-0" />}
        {layout === "C" && (
          <StickyBar
            q={q}
            className="bottom-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] md:bottom-0"
          />
        )}
      </Form>

      {layout === "B" && (
        <ActionFooter aria-label="Quote">
          <BarContent q={q} />
        </ActionFooter>
      )}

      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="top-16 md:top-3"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={q.key}
        onChange={(k) => go({ case: k })}
        className="top-28 md:top-15"
      />
    </AppLayout>
  );
}

// ---- the bar ----

// the real bar's markup (QuoteScreen's DraftEditor), its bottom given
function StickyBar({ q, className }: { q: DraftCase; className: string }) {
  return (
    <div
      className={`sticky ${className} -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3 shadow-raised sm:mx-0 sm:rounded-lg sm:border`}
    >
      <BarContent q={q} />
    </div>
  );
}

// the prices, the save state, and Send
function BarContent({ q }: { q: DraftCase }) {
  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold tabular-nums">{q.summary}</span>
        <span role="status" className="text-sm text-fg-muted">
          {q.saveState}
        </span>
      </div>
      <Button isDisabled={q.noEmail}>Send to {q.client}</Button>
    </>
  );
}

// ---- the draft's parts ----

function DraftPart({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0"
    >
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Heading level={2} size={3} id={headingId}>
            {title}
          </Heading>
          {description && (
            <p className="text-sm text-fg-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

function Price({
  title,
  badge,
  total,
  lines,
}: {
  title: string;
  badge?: ReactNode;
  total: string;
  lines: [string, string][];
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Heading level={3} size={3}>
          {title}
        </Heading>
        {badge}
      </div>
      <p className="text-2xl font-semibold tabular-nums">{total}</p>
      <dl className="flex flex-col gap-1 text-sm">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-fg-muted">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <Checkbox>Set a different price</Checkbox>
    </section>
  );
}

function OneOffParts() {
  return (
    <DraftPart title="Service and prices">
      <Select
        label="Service"
        className="sm:max-w-xs"
        description="With a Deep Clean recommended for a first visit"
        defaultSelectedKey="standard"
      >
        <SelectItem id="standard">Standard Clean</SelectItem>
        <SelectItem id="deep">Deep Clean</SelectItem>
        <SelectItem id="move">Move-out Clean</SelectItem>
      </Select>
      <div className="grid gap-6 lg:grid-cols-2">
        <Price
          title="Deep Clean"
          badge={<StatusBadge tone="success">Recommended</StatusBadge>}
          total="$385.00"
          lines={[
            ["Time on site", "5 h 30 min, 2 cleaners"],
            ["Extras", "$40.00"],
            ["Tax", "$31.27"],
            ["Deposit (15%)", "$57.75"],
          ]}
        />
        <Price
          title="Standard Clean"
          total="$210.00"
          lines={[
            ["Time on site", "3 h, 2 cleaners"],
            ["Extras", "$40.00"],
            ["Tax", "$17.06"],
            ["Deposit (15%)", "$31.50"],
          ]}
        />
      </div>
      <p className="text-sm text-fg-muted">
        Prices are worked out again from the current prices (version 7) and the
        home's details as you make changes. Once it's sent, they stay as they
        are.
      </p>
    </DraftPart>
  );
}

function PlanParts({ q, days }: { q: DraftCase; days: Day[] }) {
  return (
    <>
      <DraftPart
        title="Plan"
        actions={
          <Button variant="text" size="sm">
            <CalendarPlus aria-hidden size={16} />
            Add a weekday
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Service" defaultSelectedKey="standard">
            <SelectItem id="standard">Standard Clean</SelectItem>
            <SelectItem id="deep">Deep Clean</SelectItem>
          </Select>
          <Select label="How often" defaultSelectedKey="weekly">
            <SelectItem id="weekly">Weekly</SelectItem>
            <SelectItem id="fortnightly">Every two weeks</SelectItem>
          </Select>
        </div>
      </DraftPart>
      {days.map((day) => (
        <DraftPart
          key={day.title}
          title={day.title}
          description="Its first clean, New York time. Then weekly on the same weekday."
          actions={
            <Button variant="danger-text" size="sm">
              Remove
            </Button>
          }
        >
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
            <DatePicker
              label="First clean"
              defaultValue={parseDate(day.date)}
            />
            <TimeField label="Start time" defaultValue={parseTime(day.time)} />
            <NumberField label="Cleaners" defaultValue={day.crew} />
          </div>
          <p className="text-sm tabular-nums">
            <span className="font-semibold">$204.00 a clean</span>{" "}
            <span className="text-fg-muted">
              · 3 h on site · plan discount 10% off
            </span>
          </p>
        </DraftPart>
      ))}
      <DraftPart title="Each week">
        <dl className="flex flex-col gap-1 text-sm">
          {[
            ["Cleans", `${days.length} a week`],
            ["Each week", "$612.00"],
            ["Deposit (15%)", "$91.80"],
            ["For", q.client],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-fg-muted">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </DraftPart>
    </>
  );
}
