// PROTOTYPE: throwaway. The Client's Home in every case it can be in, on
// made-up data, at /prototype/home?case=1..20 (no sign-in). For the UX pass
// (#96). Lives only on prototype-portal-home.

import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Hourglass,
  House,
  MapPin,
  PauseCircle,
  Receipt,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  AppLayout,
  Button,
  Card,
  Heading,
  IconTile,
  Link,
  Notice,
  type NavItem,
  type StatusTone,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { QuoteIcon } from "../icons.ts";

// PROTOTYPE: every link stays on this page
const here = linkTo({ to: "/prototype/home" });
import { formatDateTime } from "../format.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

// a time this many days from now, at this hour
const at = (days: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return formatDateTime(d.toISOString());
};
const dateAt = (days: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const day = (days: number) => at(days, 12).replace(/, \d+:\d+ [AP]M$/, "");

type Hero = {
  // when it is, for a calendar tile; none when nothing is booked
  date?: Date;
  label: string;
  icon: LucideIcon;
  tone?: StatusTone;
  // the answer, large
  when: string;
  lines: string[];
  // something the Client is waiting on us for, inside the card
  pending?: string;
  // the hero's one Button; primary unless said
  action?: { label: string; quiet?: boolean };
};

type HomeCase = {
  key: string;
  name: string;
  firstName?: string;
  // weekly billed, so Bills is in the nav
  billed?: boolean;
  notices?: { text: string; action: string }[];
  hero: Hero;
  // the line under the hero
  after?: string;
};

const elm = "12 Elm St, 4B";
const main = "200 Main St";
const requestQuote = { label: "Request a Quote" };
const seeClean = { label: "See the clean" };
const nextClean = (over: Partial<Hero> = {}): Hero => ({
  label: "Your next clean",
  icon: CalendarCheck,
  date: dateAt(4, 9),
  when: at(4, 9),
  lines: [`Standard Clean at ${elm}`, "2 Cleaners, about 2½ hours"],
  action: seeClean,
  ...over,
});
const planClean = nextClean({
  lines: [
    `Standard Clean at ${elm}`,
    "Part of your Service Plan, every 2 weeks",
    "2 Cleaners, about 2½ hours",
  ],
});
const afterPlan = `After that: ${at(18, 9)}`;

export const cases: HomeCase[] = [
  {
    key: "1",
    name: "Brand new, no Quote yet",
    hero: {
      label: "Welcome to Empire Cleaning",
      icon: Sparkles,
      when: "Let's get you a Quote",
      lines: [
        "Tell us about your home and what you'd like cleaned. We email a price, usually within a working day.",
      ],
      action: requestQuote,
    },
  },
  {
    key: "2",
    name: "Quote asked for, being prepared",
    hero: {
      label: "We're preparing your Quote",
      icon: Hourglass,
      when: "Usually within a working day",
      lines: [
        `Deep Clean at ${elm}, asked ${day(-1)}`,
        "We email it to you, and it shows here.",
      ],
      action: { label: "See what you asked for", quiet: true },
    },
  },
  {
    key: "3",
    name: "Business premises: Site Visit needed, not booked",
    billed: true,
    hero: {
      label: "Before we quote",
      icon: MapPin,
      when: "We'll call to arrange a visit",
      lines: [
        `We see business premises before we price them: free, about 30 minutes, at ${main}.`,
        "We'll call (646) 555-0100 within a working day.",
      ],
      action: { label: "See what you asked for", quiet: true },
    },
  },
  {
    key: "4",
    name: "Site Visit booked",
    billed: true,
    hero: {
      label: "Your Site Visit",
      icon: MapPin,
      date: dateAt(2, 14),
      when: at(2, 14),
      lines: [
        `Cris Crane comes to see ${main} for about 30 minutes`,
        "Free: we look before we quote. To change the time, call (718) 555-0199.",
      ],
    },
  },
  {
    key: "5",
    name: "Site Visit done, Quote being written",
    billed: true,
    hero: {
      label: "We're preparing your Quote",
      icon: Hourglass,
      when: "Usually within a working day",
      lines: [
        `We saw ${main} on ${day(-1)}.`,
        "We email your Quote, and it shows here.",
      ],
      action: { label: "See what you asked for", quiet: true },
    },
  },
  {
    key: "6",
    name: "Quote ready, nothing booked",
    hero: {
      label: "Your Quote is ready",
      icon: QuoteIcon,
      when: "Deep Clean, $391.04",
      lines: [`For ${at(9, 10)} at ${elm}`, `Open until ${day(6)}`],
      action: { label: "See your Quote" },
    },
  },
  {
    key: "7",
    name: "First Clean booked",
    hero: nextClean({
      label: "Your first clean",
      lines: [`Deep Clean at ${elm}`, "2 Cleaners, about 4 hours"],
    }),
  },
  {
    key: "8",
    name: "On a Service Plan",
    hero: planClean,
    after: afterPlan,
  },
  {
    key: "9",
    name: "Clean booked, a move they asked for pending",
    hero: nextClean({
      pending: `You asked to move it to ${at(5, 14)}. We'll confirm, usually within a working day.`,
    }),
  },
  {
    key: "10",
    name: "A clean today",
    hero: nextClean({
      label: "Today",
      date: dateAt(0, 9),
      when: "9:00 AM",
      lines: [
        `Standard Clean at ${elm}`,
        "2 Cleaners, about 2½ hours, so done by about 11:30 AM",
      ],
    }),
    after: afterPlan,
  },
  {
    key: "11",
    name: "Service Plan On Hold, nothing booked",
    hero: {
      label: "Your Service Plan is paused",
      icon: PauseCircle,
      tone: "warning",
      when: "Pay $184.50 to carry on",
      lines: [
        `We couldn't charge your card for your ${day(-10)} clean.`,
        "Once it's paid your plan carries on from its next date.",
      ],
      action: { label: "Pay $184.50" },
    },
  },
  {
    key: "12",
    name: "Past Client, nothing booked",
    hero: {
      label: "Nothing booked",
      icon: CalendarDays,
      when: "Want us back?",
      lines: [`Your last clean was ${day(-24)}.`],
      action: requestQuote,
    },
  },
  {
    key: "13",
    name: "Last Quote Expired",
    hero: {
      label: "Your Quote expired",
      icon: CalendarClock,
      tone: "neutral",
      when: "Deep Clean, $391.04",
      lines: [
        `It was open until ${day(-2)}. Ask again and we'll price it afresh.`,
      ],
      action: requestQuote,
    },
  },
  {
    key: "14",
    name: "Last Quote Declined",
    hero: {
      label: "Nothing booked",
      icon: CalendarDays,
      when: "Changed your mind?",
      lines: [
        `You turned down our Quote for a Deep Clean on ${day(-3)}. Ask for a new one any time.`,
      ],
      action: requestQuote,
    },
  },
  {
    key: "15",
    name: "Last Quote Turned Down",
    billed: true,
    hero: {
      label: "We couldn't take this one on",
      icon: Ban,
      tone: "neutral",
      when: "Sorry, it's outside where we clean",
      lines: [
        `${main} is outside Queens and Brooklyn. If that changes, ask again.`,
      ],
      action: { label: "Request a Quote", quiet: true },
    },
  },
  {
    key: "16",
    name: "On a plan, with a plan change Quote ready",
    notices: [
      {
        text: "Your new Service Plan Quote is ready: Mondays and Thursdays, $650.10 a week.",
        action: "See your Quote",
      },
    ],
    hero: planClean,
    after: afterPlan,
  },
  {
    key: "17",
    name: "An extra to agree to",
    notices: [
      {
        text: `Your ${day(-3)} clean took 30 minutes longer: $22.50 more. Agree by ${day(4)}.`,
        action: "Review it",
      },
    ],
    hero: planClean,
    after: afterPlan,
  },
  {
    key: "18",
    name: "Unpaid clean, plan On Hold, cleans still booked",
    notices: [
      {
        text: `We couldn't charge $184.50 for your ${day(-10)} clean. Your plan books no new cleans until it's paid.`,
        action: "Pay now",
      },
    ],
    hero: planClean,
  },
  {
    key: "19",
    name: "Business, weekly Bill due",
    billed: true,
    notices: [
      {
        text: `Bill EC-000041, $214.50, is due by ${day(14)}.`,
        action: "Pay Bill",
      },
    ],
    hero: nextClean({
      lines: [
        `Office Clean at ${main}`,
        "Part of your Service Plan, every week on Mondays and Thursdays",
        "3 Cleaners, about 2 hours",
      ],
    }),
    after: `After that: ${at(7, 9)}`,
  },
  {
    key: "20",
    name: "Everything at once",
    notices: [
      {
        text: `We couldn't charge $184.50 for your ${day(-10)} clean. Your plan books no new cleans until it's paid.`,
        action: "Pay now",
      },
      {
        text: `Your ${day(-3)} clean took 30 minutes longer: $22.50 more. Agree by ${day(4)}.`,
        action: "Review it",
      },
      {
        text: "Your new Service Plan Quote is ready: Mondays and Thursdays, $650.10 a week.",
        action: "See your Quote",
      },
    ],
    hero: nextClean({
      pending: `You asked to move it to ${at(5, 14)}. We'll confirm, usually within a working day.`,
    }),
    after: afterPlan,
  },
];

export const layouts = [
  { key: "A", name: "Current" },
  { key: "B", name: "Focused column" },
  { key: "C", name: "Horizontal, date tile" },
  { key: "D", name: "Centred" },
];
type Layout = "A" | "B" | "C" | "D";

export function HomeCasesPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: Layout };
  const go = (search: { case?: string; layout?: string }) =>
    navigate({
      to: "/prototype/home",
      search: { case: key, layout, ...search } as never,
    });
  const navigate = useNavigate();
  const homeCase = cases.find((c) => c.key === key) ?? cases[0]!;

  const nav: NavItem[] = [
    { href: here, label: "Home", icon: House, isCurrent: true },
    { href: here, label: "Cleans", icon: Sparkles },
    ...(homeCase.billed ? [{ href: here, label: "Bills", icon: Receipt }] : []),
    { href: here, label: "Your details", icon: UserRound },
  ];

  return (
    <AppLayout
      area="Client portal"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Casey Client</span>}
    >
      <HomePage homeCase={homeCase} layout={layout} />
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-20"
      />
      <PrototypeSwitcher
        variants={cases.map((c) => ({ key: c.key, name: c.name }))}
        current={homeCase.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

function HomePage({
  homeCase,
  layout,
}: {
  homeCase: HomeCase;
  layout: Layout;
}) {
  const { hero, notices = [], after } = homeCase;
  // the hero asking for a Quote makes the header's Button redundant
  const heroAsks = hero.action?.label === "Request a Quote";
  return (
    <div
      className={`flex flex-col gap-6 ${layout === "B" ? "mx-auto w-full max-w-xl" : ""}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading level={1}>Hi, {homeCase.firstName ?? "Casey"}</Heading>
        {!heroAsks && (
          <Button variant="secondary">
            <QuoteIcon aria-hidden size={18} />
            Request a Quote
          </Button>
        )}
      </div>

      {notices.map((n) => (
        <Notice
          key={n.text}
          tone="warning"
          action={<Button variant="text">{n.action}</Button>}
        >
          {n.text}
        </Notice>
      ))}

      {layout === "C" ? (
        <HorizontalHero hero={hero} />
      ) : layout === "D" ? (
        <CentredHero hero={hero} />
      ) : (
        <HeroCard hero={hero} />
      )}

      {after && (
        <p className={`text-fg-muted ${layout === "D" ? "text-center" : ""}`}>
          {after} · <Link href={here}>All your cleans</Link>
        </p>
      )}
    </div>
  );
}

function HeroCard({ hero }: { hero: Hero }) {
  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <IconTile icon={hero.icon} tone={hero.tone ?? "info"} />
          <p className="font-semibold text-fg-muted">{hero.label}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold text-fg sm:text-3xl">
            {hero.when}
          </p>
          {hero.lines.map((line) => (
            <p key={line} className="text-fg-muted">
              {line}
            </p>
          ))}
        </div>
        {hero.pending && (
          <Notice>
            <span className="flex items-center gap-2">{hero.pending}</span>
          </Notice>
        )}
        {hero.action && (
          <div className="flex">
            <Button variant={hero.action.quiet ? "secondary" : "primary"}>
              {hero.action.label}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

const heroButton = (hero: Hero) =>
  hero.action && (
    <Button variant={hero.action.quiet ? "secondary" : "primary"}>
      {hero.action.label}
    </Button>
  );

const pendingNotice = (hero: Hero) =>
  hero.pending && <Notice>{hero.pending}</Notice>;

const zone = "America/New_York";

// a page off a calendar: the month, the day, the weekday
function DateTile({ date }: { date: Date }) {
  const part = (o: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString("en-US", { timeZone: zone, ...o });
  return (
    <div
      aria-hidden
      className="flex w-20 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-border bg-surface text-center"
    >
      <span className="w-full bg-primary py-1 text-xs font-bold tracking-widest text-primary-fg uppercase">
        {part({ month: "short" })}
      </span>
      <span className="pt-1 font-display text-4xl font-bold leading-none text-fg">
        {part({ day: "numeric" })}
      </span>
      <span className="pb-2 text-sm text-fg-muted">
        {part({ weekday: "short" })}
      </span>
    </div>
  );
}

// C: the card read left to right, its date (or what it's about) first and
// its Button at the far end
function HorizontalHero({ hero }: { hero: Hero }) {
  const tone = hero.tone ?? "info";
  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {hero.date ? (
          <DateTile date={hero.date} />
        ) : (
          <span
            aria-hidden
            className={`flex size-20 shrink-0 items-center justify-center rounded-lg ${toneTile[tone]}`}
          >
            <hero.icon size={36} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-semibold text-fg-muted">{hero.label}</p>
          <p className="text-2xl font-semibold text-fg sm:text-3xl">
            {hero.when}
          </p>
          {hero.lines.map((line) => (
            <p key={line} className="text-fg-muted">
              {line}
            </p>
          ))}
          {hero.pending && <div className="pt-3">{pendingNotice(hero)}</div>}
        </div>
        {hero.action && <div className="shrink-0">{heroButton(hero)}</div>}
      </div>
    </Card>
  );
}

// D: the card as a centred announcement
function CentredHero({ hero }: { hero: Hero }) {
  const tone = hero.tone ?? "info";
  return (
    <Card>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-4 text-center">
        <span
          aria-hidden
          className={`flex size-16 items-center justify-center rounded-full ${toneTile[tone]}`}
        >
          <hero.icon size={30} />
        </span>
        <p className="font-semibold text-fg-muted">{hero.label}</p>
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold text-fg sm:text-3xl">
            {hero.when}
          </p>
          {hero.lines.map((line) => (
            <p key={line} className="text-fg-muted">
              {line}
            </p>
          ))}
        </div>
        {pendingNotice(hero)}
        {heroButton(hero)}
      </div>
    </Card>
  );
}

const toneTile: Record<StatusTone, string> = {
  neutral: "bg-neutral-subtle text-neutral-strong",
  info: "bg-info-subtle text-info-strong",
  success: "bg-success-subtle text-success-strong",
  warning: "bg-warning-subtle text-warning-strong",
  danger: "bg-danger-subtle text-danger-strong",
};
