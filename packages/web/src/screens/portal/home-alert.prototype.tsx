// PROTOTYPE: throwaway. Where a Client's Home's alert sits (#493, decision
// D2), on made-up data, at /prototype/home-alert?layout=A..C&case=1..6 (no
// sign-in), inside the portal's frame (the icon rail from md to lg #493
// approved, the sidebar from lg). ↑/↓ switch layouts, ←/→ cases.
// With #493's calls, what waits on the Client leads the answer card (money
// owed first, then a price change to answer), the card's primary does it,
// and an alert says why:
//   A  the alert under the greeting, above the answer card
//   B  the alert under the card, where News sits
//   C  no separate alert: the card toned in the alert's colour, its why the
//      card's own lines (as the owed card already is today)
// News (a move asked for) stays an info Notice under the card in all three.
// Lives only on prototype-home-alert.
import { Fragment, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  DialogTrigger,
  Link as AriaLink,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import {
  CalendarClock,
  ClipboardCheck,
  ClipboardPenLine,
  CreditCard,
  KeyRound,
  Menu as MenuIcon,
  PauseCircle,
  Phone,
  Receipt,
  Search,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  AnswerCard,
  Button,
  ButtonLink,
  DateTile,
  Drawer,
  HomeTiles,
  type HomeTile,
  IconTile,
  LanguageProvider,
  Logo,
  type NavItem,
  Notice,
  PageHeader,
  type StatusTone,
  ThemeToggle,
  useUiWords,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { areaLabels } from "../../session.ts";
import { navFor } from "../AreaLayout.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

// ---- made-up data: Dana Reyes, Sunday Nov 22, 2026 ----

const here = linkTo({ to: "/portal" });

type Why = { tone: "warning" | "danger"; text: ReactNode };

type HomeCase = {
  key: string;
  name: string;
  // the card, as it reads in A and B: the step and what it's about
  card: {
    tile: { date: string } | { icon: LucideIcon };
    tone: StatusTone;
    label: string;
    headline: string;
    lines: string[];
    action: string;
  };
  // why the card's step is there: A's and B's alert, C's card's lines
  why?: Why;
  // C's lines in place of the card's own and the alert's, each fact once
  toned?: string[];
  news?: string[];
  tiles: HomeTile[];
  // the card asks something of them: no Request a quote in the header
  asks: boolean;
};

const tile = {
  moveOrCancel: (day: string): HomeTile => ({
    id: "move",
    icon: CalendarClock,
    label: "Move or cancel",
    hint: `Your ${day} clean`,
    href: here,
  }),
  moveOrSkip: (day: string): HomeTile => ({
    id: "move",
    icon: CalendarClock,
    label: "Move or skip",
    hint: `Your ${day} clean`,
    href: here,
  }),
  getIn: {
    id: "getIn",
    icon: KeyRound,
    label: "How we get in",
    hint: "Side door, code 4417",
    href: here,
  } as HomeTile,
  card: {
    id: "card",
    icon: CreditCard,
    label: "Your card",
    hint: "Visa ending 4242",
    href: here,
  } as HomeTile,
  call: {
    id: "call",
    icon: Phone,
    label: "Call us",
    hint: "(718) 555-0100",
    href: here,
  } as HomeTile,
  past: {
    id: "past",
    icon: Receipt,
    label: "Past cleans",
    hint: "And their receipts",
    href: here,
  } as HomeTile,
  details: {
    id: "details",
    icon: UserRound,
    label: "Your details",
    hint: "Name, email, phone",
    href: here,
  } as HomeTile,
  review: {
    id: "review",
    icon: ClipboardCheck,
    label: "Review a price change",
    hint: "Your Sat, Nov 14 clean",
    href: here,
  } as HomeTile,
};

const priceChange = {
  tile: { icon: ClipboardCheck },
  tone: "warning" as const,
  label: "A price change to answer",
  headline: "$59.88 more",
  lines: ["Your Sat, Nov 14 clean: 1 more hour"],
  action: "Review the price change",
};
const priceChangeWhy: Why = {
  tone: "warning",
  text: (
    <p>
      <strong>The crew needed 1 more hour on Sat, Nov 14.</strong> Please answer
      by Wed, Nov 25.
    </p>
  ),
};
const priceChangeToned = [
  "The crew needed 1 more hour on your Sat, Nov 14 clean.",
  "Please answer by Wed, Nov 25.",
];

const cases: HomeCase[] = [
  {
    key: "1",
    name: "none: the next clean",
    card: {
      tile: { date: "2026-11-28T14:00:00Z" },
      tone: "info",
      label: "Your next clean",
      headline: "Sat, Nov 28, 9:00 AM",
      lines: [
        "Standard Clean at 482 Halsey St",
        "Part of your cleaning plan, every two weeks",
        "2 cleaners, about 2½ hours on site",
      ],
      action: "See the clean",
    },
    tiles: [tile.moveOrSkip("Sat, Nov 28"), tile.getIn, tile.card, tile.call],
    asks: false,
  },
  {
    key: "2",
    name: "a price change, nothing booked",
    card: priceChange,
    why: priceChangeWhy,
    toned: priceChangeToned,
    tiles: [tile.past, tile.details, tile.call],
    asks: true,
  },
  {
    key: "3",
    name: "a price change, a clean booked and a move asked",
    card: priceChange,
    why: priceChangeWhy,
    toned: priceChangeToned,
    news: [
      "You asked to move your Sat, Nov 28 clean to Mon, Nov 30, 10:00 AM. We'll confirm, usually within a working day.",
    ],
    tiles: [
      {
        id: "move",
        icon: CalendarClock,
        label: "Your move request",
        hint: "To Mon, Nov 30, 10:00 AM",
        href: here,
      },
      tile.getIn,
      tile.card,
      tile.call,
    ],
    asks: true,
  },
  {
    key: "4",
    name: "money owed, and a price change too",
    card: {
      tile: { icon: TriangleAlert },
      tone: "danger",
      label: "To pay",
      headline: "$247.13",
      lines: [],
      action: "Update your card",
    },
    why: {
      tone: "danger",
      text: (
        <p>
          <strong>We couldn't take payment for your Sat, Nov 14 clean</strong>{" "}
          from your Visa ending 4242 (declined). Please update your card and
          we'll try again straight away.
        </p>
      ),
    },
    // today's owed card, word for word
    toned: [
      "We couldn't take payment for your Sat, Nov 14 clean (declined). Please update your card and we'll try again straight away.",
    ],
    tiles: [tile.review, tile.moveOrSkip("Sat, Nov 28"), tile.getIn, tile.call],
    asks: true,
  },
  {
    key: "5",
    name: "the plan paused (we try the payment again ourselves)",
    card: {
      tile: { icon: PauseCircle },
      tone: "warning",
      label: "Your cleaning plan",
      headline: "Standard Clean, every two weeks",
      lines: ["Once it's paid, your plan carries on from its next date."],
      action: "See your plan",
    },
    why: {
      tone: "warning",
      text: (
        <p>
          <strong>Your cleaning plan is paused.</strong> A payment on it hasn't
          gone through yet. We'll try again by ourselves, so there's nothing you
          need to do.
        </p>
      ),
    },
    // today's paused card
    toned: [
      "A payment on it hasn't gone through yet. We'll try again by ourselves, so there's nothing you need to do.",
      "Once it's paid, your plan carries on from its next date.",
    ],
    tiles: [tile.card, tile.past, tile.call],
    asks: false,
  },
  {
    key: "6",
    name: "the morning a crew couldn't get in",
    card: {
      tile: { icon: KeyRound },
      tone: "warning",
      label: "How we get in",
      headline: "Side door, code 4417",
      lines: ["Your next clean: Sat, Dec 5"],
      action: "Check how we get in",
    },
    why: {
      tone: "warning",
      text: (
        <p>
          <strong>Our crew couldn't get in at 9:00 this morning.</strong> The
          code didn't open the door, so the couldn't-get-in fee of $68.06
          applies.
        </p>
      ),
    },
    toned: [
      "Our crew couldn't get in at 9:00 this morning: the code didn't open the door. The couldn't-get-in fee of $68.06 applies.",
      "Your next clean: Sat, Dec 5",
    ],
    tiles: [tile.moveOrSkip("Sat, Dec 5"), tile.card, tile.past, tile.call],
    asks: true,
  },
];

const layouts = [
  { key: "A", name: "the alert above the card" },
  { key: "B", name: "the alert below the card" },
  { key: "C", name: "no alert: the card toned" },
] as const;
type Layout = (typeof layouts)[number]["key"];

// ---- the page ----

function Card({ c, layout }: { c: HomeCase; layout: Layout }) {
  const toned = layout === "C" && c.why;
  const t = c.card.tile;
  const card = (
    <AnswerCard
      tile={
        "date" in t ? (
          <DateTile date={t.date} />
        ) : (
          <IconTile icon={t.icon} tone={c.card.tone} size="lg" />
        )
      }
      label={c.card.label}
      headline={c.card.headline}
      lines={toned && c.toned ? c.toned : c.card.lines}
      actions={<ButtonLink href={here}>{c.card.action}</ButtonLink>}
    />
  );
  if (!toned) return card;
  // C: the card's edge in the alert's colour
  return (
    <div
      className={`rounded-xl border-l-4 ${c.why!.tone === "danger" ? "border-danger" : "border-warning-strong"} [&>*]:rounded-l-none`}
    >
      {card}
    </div>
  );
}

function Page({ c, layout }: { c: HomeCase; layout: Layout }) {
  const alert = c.why && layout !== "C" && (
    <Notice tone={c.why.tone}>{c.why.text}</Notice>
  );
  return (
    <div className="flex flex-col gap-6">
      {/* oxlint-disable-next-line empire/screen-layout -- prototype */}
      <PageHeader
        title="Hi, Dana"
        actions={[
          !c.asks && {
            label: "Request a quote",
            icon: ClipboardPenLine,
            href: here,
          },
        ]}
      />
      {layout === "A" && alert}
      <Card c={c} layout={layout} />
      {layout === "B" && alert}
      {c.news?.map((text) => (
        <Notice key={text}>{text}</Notice>
      ))}
      <HomeTiles label="Shortcuts" tiles={c.tiles} />
    </div>
  );
}

// ---- the frame (prototype-office-job's FrameWithRail, 881fc6af): a
// phone's below md, an icon rail md to lg, the sidebar from lg ----

function FrameWithRail({
  area,
  nav,
  children,
}: {
  area: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  const section = nav.find((item) => item.isCurrent)?.label ?? area;
  const tabs = nav.filter((item) => !item.inMenu);
  const words = useUiWords();
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-16 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-surface py-4 md:sticky md:top-0 md:flex md:h-dvh lg:hidden print:hidden">
        <nav aria-label={area} className="flex flex-col items-center gap-2">
          <RailLinks items={nav} />
        </nav>
      </aside>
      <aside className="hidden w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface p-4 lg:sticky lg:top-0 lg:flex lg:h-dvh print:hidden">
        <div className="flex flex-col items-center gap-3 px-2 pt-2">
          <Logo className="w-44" />
          <span className="text-sm text-fg-muted">{area}</span>
        </div>
        <nav aria-label={area} className="flex flex-1 flex-col gap-4">
          <NavGroups items={nav} />
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
          <ThemeToggle />
        </div>
      </aside>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 md:hidden print:hidden">
        <div className="flex min-w-0 items-center gap-1">
          <DialogTrigger>
            <Button
              variant="quiet"
              size="icon"
              aria-label={words.menu}
              className="-ml-2 shrink-0"
            >
              <MenuIcon aria-hidden size={22} />
            </Button>
            <Drawer aria-label={words.menu}>
              {({ close }) => (
                <nav aria-label={area} className="flex flex-col gap-4 pt-8">
                  <NavGroups items={nav} onPress={close} />
                </nav>
              )}
            </Drawer>
          </DialogTrigger>
          <span className="truncate font-display text-xl font-bold tracking-wide uppercase">
            {section}
          </span>
        </div>
        <Search aria-hidden size={20} className="hidden" />
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-4 pb-28 outline-none md:px-8 md:py-8"
      >
        {children}
      </main>
      <nav
        aria-label={area}
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {tabs.map((item) => (
          <AriaLink
            key={item.label}
            href={item.href}
            aria-current={item.isCurrent ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-fg-muted no-underline current:text-primary"
          >
            <item.icon aria-hidden size={22} />
            {item.label}
          </AriaLink>
        ))}
      </nav>
    </div>
  );
}

function NavGroups({
  items,
  onPress,
}: {
  items: NavItem[];
  onPress?: () => void;
}) {
  const groups: { name?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return groups.map((group) => (
    <div key={group.items[0]!.label} className="flex flex-col gap-1">
      {group.name && (
        <span className="px-3 pt-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">
          {group.name}
        </span>
      )}
      {group.items.map((item) => (
        <AriaLink
          key={item.label}
          href={item.href}
          aria-current={item.isCurrent ? "page" : undefined}
          onPress={onPress}
          className="flex min-h-touch items-center gap-3 rounded-md px-3 font-semibold text-fg-muted no-underline hover:bg-surface-sunken hover:text-fg current:bg-success-subtle current:text-success-strong"
        >
          <item.icon aria-hidden size={20} />
          {item.label}
        </AriaLink>
      ))}
    </div>
  ));
}

function RailLinks({ items }: { items: NavItem[] }) {
  return items.map((item, i) => (
    <Fragment key={item.label}>
      {i > 0 && item.group !== items[i - 1]!.group && (
        <hr aria-hidden className="my-1 w-8 border-border" />
      )}
      <TooltipTrigger delay={300}>
        <AriaLink
          href={item.href}
          aria-label={item.label}
          aria-current={item.isCurrent ? "page" : undefined}
          className="flex size-11 items-center justify-center rounded-md text-fg-muted no-underline hover:bg-surface-sunken hover:text-fg current:bg-success-subtle current:text-success-strong"
        >
          <item.icon aria-hidden size={20} />
        </AriaLink>
        <Tooltip
          placement="end"
          offset={8}
          className="rounded-md bg-fg px-2 py-1 text-sm font-semibold text-bg shadow-overlay"
        >
          {item.label}
        </Tooltip>
      </TooltipTrigger>
    </Fragment>
  ));
}

export function HomeAlertPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string | number;
    layout?: string;
    shot?: string;
  };
  const navigate = useNavigate();
  const c = cases.find((x) => x.key === String(search.case)) ?? cases[0]!;
  const layout: Layout =
    layouts.find((l) => l.key === search.layout)?.key ?? "A";
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/home-alert",
      search: { case: c.key, layout, ...change },
      replace: true,
    });
  const nav: NavItem[] = navFor("en").portal.map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === "Home",
    }),
  );
  // ?shot=1 hides the prototype's own labels, for the screenshots
  const shot = search.shot !== undefined;
  return (
    <LanguageProvider lang="en">
      <FrameWithRail area={areaLabels.en.portal} nav={nav}>
        {!shot && (
          <p className="mb-4 text-sm text-fg-muted">
            Layout {layout} ({layouts.find((l) => l.key === layout)!.name}) ·
            case {c.key}: {c.name}
          </p>
        )}
        <div>
          <Page key={`${c.key}${layout}`} c={c} layout={layout} />
        </div>
        {!shot && (
          <>
            <PrototypeSwitcher
              variants={cases.map((x) => ({ key: x.key, name: x.name }))}
              current={c.key}
              onChange={(key) => go({ case: key })}
              className="top-16 md:top-auto md:bottom-4"
            />
            <PrototypeSwitcher
              variants={layouts.map((x) => ({ key: x.key, name: x.name }))}
              current={layout}
              onChange={(key) => go({ layout: key })}
              keys={["ArrowUp", "ArrowDown"]}
              className="top-28 md:top-auto md:bottom-20"
            />
          </>
        )}
      </FrameWithRail>
    </LanguageProvider>
  );
}
