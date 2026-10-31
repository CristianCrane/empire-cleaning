// PROTOTYPE: throwaway. Where the logo goes where the Wordmark was too tight
// for it, on made-up data, at /prototype/logo?case=1..3&layout=A..C (no
// sign-in). The logo is never changed: the bars around it are. Lives only on
// prototype-logo.
//
// The app on a phone. A: a taller top bar, the logo left, that scrolls away.
// B: a masthead, the logo centred between the theme and account, scrolling
// away. C: a slim sticky bar with the page's title, the logo heading Home.
//
// The landing site. A: a taller header, the logo left. B: a centred
// masthead, the actions under it. C: a slim header, the logo leading the hero
// beside the headline.
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Briefcase,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ClipboardPenLine,
  House,
  Inbox,
  LayoutDashboard,
  Users,
  KeyRound,
  Phone,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  AppLayout,
  Button,
  Card,
  DateTile,
  Heading,
  Logo,
  StatusBadge,
  buttonStyles,
} from "@empire-cleaning/ui";
import { ThemeToggle } from "@empire-cleaning/ui/theme";
import { linkTo } from "../links.ts";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";

const here = linkTo({ to: "/prototype/logo" });

const cases = [
  { key: "1", name: "The app, on a phone" },
  { key: "2", name: "The landing site, on a phone" },
  { key: "3", name: "The landing site, on a laptop" },
  // C on more screens
  { key: "4", name: "C: Client Cleans, phone" },
  { key: "5", name: "C: Client Payments, phone" },
  { key: "6", name: "C: a clean's page, phone" },
  { key: "7", name: "C: Office Today, phone" },
  { key: "8", name: "C: Cleaner Your Jobs, phone" },
  { key: "9", name: "C: Office Today, laptop" },
];

const layoutsFor = (key: string) =>
  Number(key) >= 4
    ? [{ key: "C", name: "Slim sticky bar, the logo heads Home" }]
    : key === "1"
      ? [
          { key: "A", name: "Taller top bar, scrolls away" },
          { key: "B", name: "Centred masthead, scrolls away" },
          { key: "C", name: "Slim sticky bar, the logo heads Home" },
        ]
      : [
          { key: "A", name: "Taller header, logo left" },
          { key: "B", name: "Centred masthead" },
          { key: "C", name: "Slim header, the logo leads the hero" },
        ];

export function LogoPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/logo",
      search: { case: key, layout, ...search } as never,
    });

  return (
    <>
      {Number(key) >= 4 ? (
        <MoreScreens screen={key} />
      ) : key === "1" ? (
        <PhoneFrame>
          <AppOnPhone layout={layout} />
        </PhoneFrame>
      ) : key === "2" ? (
        <PhoneFrame>
          <LandingOnPhone layout={layout} />
        </PhoneFrame>
      ) : (
        <LandingOnLaptop layout={layout} />
      )}
      <PrototypeSwitcher
        variants={layoutsFor(key)}
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

// a phone's screen, 390 × 780, scrolling inside, so it reads on a laptop
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-start justify-center bg-surface-sunken p-6 pb-40">
      <div className="relative h-[780px] w-[390px] overflow-hidden rounded-[2.5rem] border-8 border-fg shadow-xl">
        <div className="h-full overflow-y-auto bg-bg">{children}</div>
      </div>
    </div>
  );
}

// ---- The app, on a phone ----

function Account() {
  return (
    <Button variant="quiet" aria-label="Casey Client">
      <UserRound aria-hidden size={20} />
    </Button>
  );
}

function AppOnPhone({ layout }: { layout: string }) {
  return (
    <div className="flex min-h-full flex-col">
      {layout === "A" && (
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <Logo className="w-24" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Account />
          </div>
        </header>
      )}
      {layout === "B" && (
        <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-surface px-4 py-3">
          <div>
            <ThemeToggle />
          </div>
          <Logo className="w-28" />
          <div className="justify-self-end">
            <Account />
          </div>
        </header>
      )}
      {layout === "C" && (
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
          <span className="font-display text-xl font-bold tracking-wide uppercase">
            Home
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Account />
          </div>
        </header>
      )}

      <main className="flex flex-1 flex-col gap-4 p-4">
        {layout === "C" && <Logo className="mx-auto w-36 py-2" />}
        {layout !== "C" && <Heading level={1}>Home</Heading>}
        <Card>
          <div className="flex items-center gap-4">
            <DateTile date="2026-11-03T14:00:00Z" />
            <div className="flex flex-col">
              <span className="font-semibold">Your next clean</span>
              <span className="text-fg-muted">Deep Clean · 9:00 AM</span>
            </div>
          </div>
          <Button variant="primary">Move or skip</Button>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: KeyRound, label: "How we get in" },
            { icon: Wallet, label: "Your card" },
            { icon: CalendarClock, label: "Your plan" },
            { icon: Phone, label: "Call us" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
            >
              <Icon aria-hidden size={20} className="text-primary" />
              <span className="font-semibold">{label}</span>
            </div>
          ))}
        </div>
        <div className="h-24" />
      </main>

      <nav className="sticky bottom-0 flex border-t border-border bg-surface">
        {[
          { icon: House, label: "Home", current: true },
          { icon: Sparkles, label: "Cleans" },
          { icon: Wallet, label: "Payments" },
          { icon: UserRound, label: "Your details" },
        ].map(({ icon: Icon, label, current }) => (
          <span
            key={label}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${current ? "text-primary" : "text-fg-muted"}`}
          >
            <Icon aria-hidden size={22} />
            {label}
          </span>
        ))}
      </nav>
    </div>
  );
}

// ---- The landing site ----

const phone = "(646) 320-9076";

function Headline() {
  return (
    <h1 className="font-display text-5xl leading-none font-bold tracking-wide uppercase">
      Clean spaces.
      <span className="block text-primary">Stronger impact.</span>
    </h1>
  );
}

const lead =
  "Professional cleaning for homes and businesses across Queens, NY. Exceptional results, every visit.";

function LandingOnPhone({ layout }: { layout: string }) {
  return (
    <div className="flex flex-col">
      {layout === "A" && (
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <Logo className="w-24" />
          <ThemeToggle />
        </header>
      )}
      {layout === "B" && (
        <header className="relative flex justify-center border-b border-border bg-surface px-4 py-4">
          <Logo className="w-32" />
          <div className="absolute top-3 right-3">
            <ThemeToggle />
          </div>
        </header>
      )}
      {layout === "C" && (
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
          <a href="#" className={buttonStyles({ variant: "quiet" })}>
            <Phone aria-hidden size={18} />
            {phone}
          </a>
          <ThemeToggle />
        </header>
      )}
      <section className="flex flex-col items-start gap-6 px-4 py-12">
        {layout === "C" && <Logo className="mx-auto w-44" />}
        <Headline />
        <p className="text-xl text-fg-muted">{lead}</p>
        <div className="flex w-full flex-col gap-3">
          <a
            href="#"
            className={buttonStyles({
              variant: "primary",
              className: "px-6 text-lg",
            })}
          >
            Request a Quote
          </a>
          <a
            href="#"
            className={buttonStyles({
              variant: "secondary",
              className: "px-6 text-lg",
            })}
          >
            <Phone aria-hidden size={20} />
            Call {phone}
          </a>
        </div>
      </section>
    </div>
  );
}

function LandingActions() {
  return (
    <div className="flex items-center gap-2">
      <a href="#" className={buttonStyles({ variant: "quiet" })}>
        <Phone aria-hidden size={18} />
        {phone}
      </a>
      <a href="#" className={buttonStyles({ variant: "primary" })}>
        Request a Quote
      </a>
      <ThemeToggle />
    </div>
  );
}

function LandingOnLaptop({ layout }: { layout: string }) {
  return (
    <div className="min-h-dvh bg-bg pb-40">
      {layout === "A" && (
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
            <Logo className="w-28" />
            <LandingActions />
          </div>
        </header>
      )}
      {layout === "B" && (
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-6">
            <Logo className="w-36" />
            <LandingActions />
          </div>
        </header>
      )}
      {layout === "C" && (
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-4 py-3">
            <LandingActions />
          </div>
        </header>
      )}
      <section className="py-24">
        <div
          className={`mx-auto flex max-w-5xl gap-12 px-4 ${layout === "C" ? "items-center" : ""}`}
        >
          {layout === "C" && <Logo className="w-64" />}
          <div className="flex flex-col items-start gap-6">
            <h1 className="font-display text-7xl leading-none font-bold tracking-wide uppercase">
              Clean spaces.
              <span className="block text-primary">Stronger impact.</span>
            </h1>
            <p className="max-w-xl text-xl text-fg-muted">{lead}</p>
            <div className="flex gap-3">
              <a
                href="#"
                className={buttonStyles({
                  variant: "primary",
                  className: "px-6 text-lg",
                })}
              >
                Request a Quote
              </a>
              <a
                href="#"
                className={buttonStyles({
                  variant: "secondary",
                  className: "px-6 text-lg",
                })}
              >
                <Phone aria-hidden size={20} />
                Call {phone}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---- C on more screens ----

type Tab = { icon: typeof House; label: string };

const clientTabs: Tab[] = [
  { icon: House, label: "Home" },
  { icon: Sparkles, label: "Cleans" },
  { icon: Wallet, label: "Payments" },
  { icon: UserRound, label: "Your details" },
];
const officeTabs: Tab[] = [
  { icon: LayoutDashboard, label: "Today" },
  { icon: ClipboardPenLine, label: "Quotes" },
  { icon: CalendarDays, label: "Schedule" },
  { icon: Users, label: "Clients" },
];
const cleanerTabs: Tab[] = [
  { icon: Briefcase, label: "Your Jobs" },
  { icon: Inbox, label: "Offers" },
  { icon: UserRound, label: "You" },
];

// layout C's frame: a slim sticky bar holding the page's title (and the way
// back on a detail page), the tabs at the foot
function SlimBarPage({
  title,
  back,
  tabs,
  current,
  children,
}: {
  title: string;
  back?: string;
  tabs: Tab[];
  current: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <span className="flex min-w-0 items-center gap-1">
          {back && (
            <Button variant="quiet" aria-label={`Back to ${back}`}>
              <ChevronLeft aria-hidden size={22} />
            </Button>
          )}
          <span className="truncate font-display text-xl font-bold tracking-wide uppercase">
            {title}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Account />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">
        {children}
        <div className="h-16" />
      </main>
      <nav className="sticky bottom-0 flex border-t border-border bg-surface">
        {tabs.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${label === current ? "text-primary" : "text-fg-muted"}`}
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

const today = [
  {
    start: <DateTile size="sm" date="2026-11-03T14:00:00Z" />,
    title: "Casey Client",
    line: "Deep Clean · 9:00 AM · 41-12 Austin St",
  },
  {
    start: <DateTile size="sm" date="2026-11-03T17:00:00Z" />,
    title: "Dana Diaz",
    line: "Standard Clean · 12:00 PM · 70-30 Austin St",
  },
  {
    start: <DateTile size="sm" date="2026-11-03T20:00:00Z" />,
    title: "Eli Evans",
    line: "Move-out Clean · 3:00 PM · 108-22 Queens Blvd",
  },
];

function MoreScreens({ screen }: { screen: string }) {
  if (screen === "9") {
    return (
      <div className="min-h-dvh pb-24">
        <AppLayout
          area="Office"
          nav={officeTabs.map(({ icon, label }) => ({
            href: here,
            label,
            icon,
            isCurrent: label === "Today",
          }))}
          account={
            <Button variant="quiet" className="justify-start">
              <UserRound aria-hidden size={20} />
              <span className="max-md:sr-only">Olive Owner</span>
            </Button>
          }
        >
          <div className="flex flex-col gap-6">
            <Heading level={1}>Today</Heading>
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
            <Rows rows={today} />
          </div>
        </AppLayout>
      </div>
    );
  }

  const page =
    screen === "4" ? (
      <SlimBarPage title="Cleans" tabs={clientTabs} current="Cleans">
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
              end: <StatusBadge tone="warning">Move asked</StatusBadge>,
            },
          ]}
        />
        <SectionTitle>December</SectionTitle>
        <Rows
          rows={[
            {
              start: <DateTile size="sm" date="2026-12-01T14:00:00Z" />,
              title: "Standard Clean",
              line: "9:00 AM · every other Tuesday",
            },
            {
              start: <DateTile size="sm" date="2026-12-15T14:00:00Z" />,
              title: "Standard Clean",
              line: "9:00 AM · every other Tuesday",
            },
          ]}
        />
      </SlimBarPage>
    ) : screen === "5" ? (
      <SlimBarPage title="Payments" tabs={clientTabs} current="Payments">
        <Card>
          <span className="font-display text-2xl font-bold uppercase text-success-strong">
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
            {
              title: "Standard Clean",
              line: "Sep 22",
              end: <span className="font-semibold">$140.00</span>,
            },
          ]}
        />
      </SlimBarPage>
    ) : screen === "6" ? (
      <SlimBarPage
        title="Deep Clean"
        back="Cleans"
        tabs={clientTabs}
        current="Cleans"
      >
        <Card>
          <div className="flex items-center gap-4">
            <DateTile date="2026-11-03T14:00:00Z" />
            <div className="flex flex-col">
              <span className="font-display text-2xl font-bold uppercase">
                Tue, Nov 3 · 9:00 AM
              </span>
              <span className="text-fg-muted">41-12 Austin St, 4B</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <span>
              <b className="block">3 hours</b>
              <span className="text-fg-muted">on site</span>
            </span>
            <span>
              <b className="block">$240.00</b>
              <span className="text-fg-muted">Deposit $60 paid</span>
            </span>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <span>Can't make it? Move or skip this clean.</span>
            <Button variant="secondary">Move or skip</Button>
          </div>
        </Card>
      </SlimBarPage>
    ) : screen === "7" ? (
      <SlimBarPage title="Today" tabs={officeTabs} current="Today">
        <SectionTitle>Needs attention</SectionTitle>
        <Rows
          rows={[
            { title: "Send a Quote", line: "Dana Diaz · asked yesterday" },
            {
              title: "Assign Staff",
              line: "Eli Evans · Move-out Clean, Nov 5",
            },
          ]}
        />
        <SectionTitle>Today's Schedule</SectionTitle>
        <Rows rows={today} />
      </SlimBarPage>
    ) : (
      <SlimBarPage title="Your Jobs" tabs={cleanerTabs} current="Your Jobs">
        <Card>
          <span className="text-sm font-semibold text-fg-muted uppercase">
            Next up
          </span>
          <span className="font-display text-3xl font-bold uppercase">
            9:00 AM
          </span>
          <span>41-12 Austin St, 4B</span>
          <div className="flex gap-3">
            <Button variant="secondary">Directions</Button>
            <Button variant="primary">Open Job</Button>
          </div>
        </Card>
        <SectionTitle>Coming up</SectionTitle>
        <Rows rows={today.slice(1)} />
      </SlimBarPage>
    );

  return <PhoneFrame>{page}</PhoneFrame>;
}
