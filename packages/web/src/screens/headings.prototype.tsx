// PROTOTYPE: throwaway. The phone's top bar names the section, and a
// section's own page then names itself again in its heading ("Jobs" twice).
// On made-up data, at /prototype/headings?case=1..7&layout=A..C (no sign-in).
// Lives only on prototype-headings.
//
// A: today, the bar's section and the page's heading both shown.
// B: a section's own page keeps its heading for screen readers and laptops,
//    hidden on a phone, where the bar already names it; a heading that says
//    more than the bar ("Hi, Casey", a Job's name) stays.
// C: the bar names nothing on a section's own page, only on the pages within
//    it; every heading stays.
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  ContactRound,
  House,
  Inbox,
  LayoutDashboard,
  Sparkles,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Card,
  DateTile,
  Heading,
  Logo,
  StatusBadge,
} from "@empire-cleaning/ui";
import { ThemeToggle } from "@empire-cleaning/ui/theme";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { JobIcon, QuoteIcon } from "./icons.ts";

const cases = [
  { key: "1", name: "Office Jobs" },
  { key: "2", name: "Office Today (home)" },
  { key: "3", name: "Client Payments" },
  { key: "4", name: "Client Cleans" },
  { key: "5", name: "Cleaner Offers" },
  { key: "6", name: "Client Home" },
  { key: "7", name: "A Job's page" },
];

const layouts = [
  { key: "A", name: "Before: both" },
  { key: "B", name: "After: heading hidden on a phone" },
  { key: "C", name: "Alt: bar blank on list pages" },
];

type Tab = { icon: LucideIcon; label: string };
const officeTabs: Tab[] = [
  { icon: LayoutDashboard, label: "Today" },
  { icon: QuoteIcon, label: "Quotes" },
  { icon: JobIcon, label: "Jobs" },
  { icon: ContactRound, label: "Clients" },
  { icon: Users, label: "Staff" },
];
const clientTabs: Tab[] = [
  { icon: House, label: "Home" },
  { icon: Sparkles, label: "Cleans" },
  { icon: Wallet, label: "Payments" },
  { icon: UserRound, label: "Your details" },
];
const cleanerTabs: Tab[] = [
  { icon: CalendarDays, label: "Your Jobs" },
  { icon: Inbox, label: "Offers (2)" },
];

export function HeadingsPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/headings",
      search: { case: key, layout, ...search } as never,
    });

  return (
    <>
      <div className="flex min-h-dvh items-start justify-center bg-surface-sunken p-6 pb-40">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-semibold text-fg-muted">
            {cases.find((c) => c.key === key)?.name} ·{" "}
            {layouts.find((l) => l.key === layout)?.name}
          </span>
          <div className="relative h-[780px] w-[390px] overflow-hidden rounded-[2.5rem] border-8 border-fg shadow-xl">
            <div className="h-full overflow-y-auto bg-bg">
              <Screen screen={key} layout={layout} />
            </div>
          </div>
        </div>
      </div>
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-20"
      />
      <PrototypeSwitcher
        variants={cases}
        current={key}
        onChange={(k) => go({ case: k })}
        className="bottom-4"
      />
    </>
  );
}

// the app on a phone: the slim sticky bar, the page, the tabs at the foot.
// own: this is the section's own page (Jobs), not a page within it (a Job).
// says: the heading says more than the bar does, so B keeps it
function PhonePage({
  layout,
  section,
  heading,
  own,
  says = false,
  home = false,
  back,
  tabs,
  children,
}: {
  layout: string;
  section: string;
  heading: string;
  own: boolean;
  says?: boolean;
  home?: boolean;
  back?: string;
  tabs: Tab[];
  children: ReactNode;
}) {
  const barTitle = layout === "C" && own ? null : section;
  const hideHeading = layout === "B" && own && !says;
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <span className="flex min-w-0 items-center gap-1">
          {back && (
            <Button variant="quiet" aria-label={`Back to ${back}`}>
              <ChevronLeft aria-hidden size={22} />
            </Button>
          )}
          {barTitle && (
            <span className="truncate font-display text-xl font-bold tracking-wide uppercase">
              {barTitle}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="quiet" aria-label="Account">
            <UserRound aria-hidden size={20} />
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">
        {home && <Logo className="mx-auto w-36" />}
        <Heading level={1} className={hideHeading ? "sr-only" : undefined}>
          {heading}
        </Heading>
        {children}
        <div className="h-16" />
      </main>
      <nav className="sticky bottom-0 flex border-t border-border bg-surface">
        {tabs.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${label === section ? "text-primary" : "text-fg-muted"}`}
          >
            <Icon aria-hidden size={22} />
            {label}
          </span>
        ))}
      </nav>
    </div>
  );
}

function Rows({
  rows,
}: {
  rows: { start?: ReactNode; title: string; line: string; end?: ReactNode }[];
}) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {rows.map((row) => (
        <div key={row.title + row.line} className="flex items-center gap-3 p-3">
          {row.start}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">{row.title}</span>
            <span className="text-sm text-fg-muted">{row.line}</span>
          </div>
          {row.end}
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-lg font-bold tracking-wide uppercase">
      {children}
    </h2>
  );
}

function Search({ label }: { label: string }) {
  return (
    <div className="flex min-h-touch items-center rounded-md border border-border bg-surface px-3 text-fg-muted">
      {label}
    </div>
  );
}

const jobs = [
  {
    start: <DateTile size="sm" date="2026-11-03T14:00:00Z" />,
    title: "Deep Clean at 41-12 Austin St",
    line: "Casey Client · 9:00 AM · Maria R.",
  },
  {
    start: <DateTile size="sm" date="2026-11-03T17:00:00Z" />,
    title: "Standard Clean at 70-30 Austin St",
    line: "Dana Diaz · 12:00 PM · Ana P.",
  },
  {
    start: <DateTile size="sm" date="2026-11-05T15:00:00Z" />,
    title: "Move-out Clean at 108-22 Queens Blvd",
    line: "Eli Evans · 10:00 AM",
    end: <StatusBadge tone="warning">No Staff</StatusBadge>,
  },
];

function Screen({ screen, layout }: { screen: string; layout: string }) {
  switch (screen) {
    case "2":
      return (
        <PhonePage
          layout={layout}
          section="Today"
          heading="Today"
          own
          home
          tabs={officeTabs}
        >
          <SectionTitle>Needs attention</SectionTitle>
          <Rows
            rows={[
              {
                title: "Send a Quote",
                line: "Dana Diaz · asked yesterday",
                end: <StatusBadge tone="warning">Waiting 1 day</StatusBadge>,
              },
              {
                title: "Assign Staff",
                line: "Eli Evans · Move-out Clean, Nov 5",
              },
            ]}
          />
          <SectionTitle>Today's Schedule</SectionTitle>
          <Rows rows={jobs.slice(0, 2)} />
        </PhonePage>
      );
    case "3":
      return (
        <PhonePage
          layout={layout}
          section="Payments"
          heading="Payments"
          own
          tabs={clientTabs}
        >
          <Card>
            <span className="font-display text-2xl font-bold text-success-strong uppercase">
              Nothing owed
            </span>
            <span className="text-fg-muted">Paying with Visa ending 4242</span>
          </Card>
          <SectionTitle>History</SectionTitle>
          <Rows
            rows={[
              {
                title: "Deep Clean",
                line: "Oct 20",
                end: <span className="font-semibold">$240.00</span>,
              },
              {
                title: "Deposit for Deep Clean",
                line: "Oct 6",
                end: <span className="font-semibold">$60.00</span>,
              },
            ]}
          />
        </PhonePage>
      );
    case "4":
      return (
        <PhonePage
          layout={layout}
          section="Cleans"
          heading="Your cleans"
          own
          tabs={clientTabs}
        >
          <div className="flex gap-2">
            <Button variant="primary">Coming up</Button>
            <Button variant="quiet">Past</Button>
          </div>
          <SectionTitle>November</SectionTitle>
          <Rows
            rows={[
              {
                start: <DateTile size="sm" date="2026-11-03T14:00:00Z" />,
                title: "Deep Clean",
                line: "9:00 AM · 41-12 Austin St",
              },
              {
                start: <DateTile size="sm" date="2026-11-17T14:00:00Z" />,
                title: "Standard Clean",
                line: "9:00 AM · every other Tuesday",
              },
            ]}
          />
        </PhonePage>
      );
    case "5":
      return (
        <PhonePage
          layout={layout}
          section="Offers (2)"
          heading="Offers"
          own
          tabs={cleanerTabs}
        >
          <SectionTitle>Offered to you</SectionTitle>
          <Rows
            rows={[
              {
                start: <DateTile size="sm" date="2026-11-06T14:00:00Z" />,
                title: "Deep Clean",
                line: "9:00 AM · Astoria · 3 hours",
                end: <Button variant="primary">Accept</Button>,
              },
              {
                start: <DateTile size="sm" date="2026-11-09T15:00:00Z" />,
                title: "Standard Clean",
                line: "10:00 AM · Forest Hills · 2 hours",
                end: <Button variant="primary">Accept</Button>,
              },
            ]}
          />
        </PhonePage>
      );
    case "6":
      return (
        <PhonePage
          layout={layout}
          section="Home"
          heading="Hi, Casey"
          own
          says
          home
          tabs={clientTabs}
        >
          <Card>
            <span className="text-sm font-semibold text-fg-muted uppercase">
              Next clean
            </span>
            <span className="font-display text-2xl font-bold uppercase">
              Tue, Nov 3 · 9:00 AM
            </span>
            <span className="text-fg-muted">Deep Clean · 41-12 Austin St</span>
          </Card>
          <Button variant="secondary">Request a Quote</Button>
        </PhonePage>
      );
    case "7":
      return (
        <PhonePage
          layout={layout}
          section="Jobs"
          heading="Deep Clean at 41-12 Austin St"
          own={false}
          back="Jobs"
          tabs={officeTabs}
        >
          <Card>
            <div className="flex items-center gap-4">
              <DateTile date="2026-11-03T14:00:00Z" />
              <div className="flex flex-col">
                <span className="font-display text-xl font-bold uppercase">
                  Tue, Nov 3 · 9:00 AM
                </span>
                <span className="text-fg-muted">Casey Client</span>
              </div>
            </div>
            <span className="text-sm">Staff: Maria R. · 3 hours</span>
          </Card>
        </PhonePage>
      );
    default:
      return (
        <PhonePage
          layout={layout}
          section="Jobs"
          heading="Jobs"
          own
          tabs={officeTabs}
        >
          <Search label="Search Jobs" />
          <Rows rows={jobs} />
        </PhonePage>
      );
  }
}
