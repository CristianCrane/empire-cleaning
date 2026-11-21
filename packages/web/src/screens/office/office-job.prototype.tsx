// PROTOTYPE: throwaway. The Office's Job for Jen, on made-up data, at
// /prototype/office-job?case=1..10&lang=en|es (no sign-in), inside the real
// AppLayout and the Office's nav. One layout, from the calls made for it,
// following the Cleaner's Job's layout D (prototype-cleaner-job, 0cf74290),
// whose parts are copied here: the split button, the phone's action sheet,
// the sticky header, the crew's faces with a ghost for an open place, the
// extras' list, the header card. ←/→ switch cases. The Office reads
// English (ADR-0025): &lang=es turns only the frame Spanish. Lives only on
// prototype-office-job.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
// the split button's menu and sheet, placed as the ui kit's MenuButton and
// Dialog can't be told to (web lists react-aria-components on this branch
// only, for them)
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Menu as AriaMenu,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover as AriaPopover,
} from "react-aria-components";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarSync,
  CalendarX,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  Clock,
  CreditCard,
  DoorClosed,
  Ellipsis,
  KeyRound,
  ClipboardList,
  Lock,
  MessageSquareText,
  Play,
  Receipt,
  Repeat,
  Send,
  Sparkles,
  Undo2,
  UserCheck,
  UserPlus,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { formats, type Language } from "@empire-cleaning/models";
import {
  AppLayout,
  Avatar,
  Button,
  ButtonLink,
  Card,
  DateTile,
  Fact,
  Facts,
  Fold,
  LanguageProvider,
  MenuItem,
  MenuSeparator,
  type NavItem,
  RecordPage,
  Section,
  StatusBadge,
  type StatusTone,
  Timeline,
  TimelineItem,
  showToast,
} from "@empire-cleaning/ui";
import { setAppLanguage } from "../../language.ts";
import { type AppHref, linkTo } from "../../links.ts";
import { areaLabels } from "../../session.ts";
import { navFor } from "../AreaLayout.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

const say = (what: string) => () =>
  showToast({ title: `Prototype: "${what}" does nothing here`, tone: "info" });

// the words the copied parts read (the Office's are English)
const w = { moreActions: "More actions", cancel: "Cancel" };
type Words = typeof w;

const { formatDateTime, formatTime, formatMoney } = formats.en;

// ---- copied from the Cleaner's Job, layout D (prototype-cleaner-job, 0cf74290) ----

type DAction = {
  label: string;
  icon: typeof Lock;
  danger?: boolean;
  external?: boolean;
  isDisabled?: boolean;
} & ({ href: string } | { onPress: () => void });

// a DAction as an item of the arrow's menu
function menuItem(a: DAction) {
  return (
    <MenuItem
      key={a.label}
      icon={a.icon}
      danger={a.danger}
      {...("href" in a
        ? {
            href: a.href as unknown as AppHref,
            target: a.external ? "_blank" : undefined,
          }
        : { onAction: a.onPress })}
    >
      {a.label}
    </MenuItem>
  );
}

// those that undo something last, after a rule
const inOrder = (actions: DAction[]) => ({
  plain: actions.filter((a) => !a.danger),
  danger: actions.filter((a) => a.danger),
});

function menuItems(actions: DAction[]) {
  const { plain, danger } = inOrder(actions);
  return (
    <>
      {plain.map(menuItem)}
      {plain.length > 0 && danger.length > 0 && <MenuSeparator />}
      {danger.map(menuItem)}
    </>
  );
}

// A phone's action sheet: rising from the bottom edge, the screen's width,
// a large row for each action, and Cancel last, apart (the ui kit's Dialog
// is a sheet on a phone too, but titled, with a ✕: this is just the choices)
function ActionSheet({
  label,
  cancel,
  actions,
}: {
  label: string;
  cancel: string;
  actions: DAction[];
}) {
  const { plain, danger } = inOrder(actions);
  const row =
    "flex min-h-14 w-full items-center gap-4 px-5 text-left text-lg font-semibold outline-none focus-visible:bg-surface-sunken active:bg-surface-sunken";
  const item = (close: () => void) => (a: DAction) => {
    const look = `${row} ${a.danger ? "text-danger" : "text-fg"}`;
    const body = (
      <>
        <a.icon aria-hidden size={22} className="shrink-0" />
        {a.label}
      </>
    );
    return "href" in a ? (
      <a
        key={a.label}
        href={a.href}
        target={a.external ? "_blank" : undefined}
        rel={a.external ? "noreferrer" : undefined}
        className={look}
        onClick={close}
      >
        {body}
      </a>
    ) : (
      <button
        key={a.label}
        type="button"
        className={look}
        onClick={() => {
          close();
          a.onPress();
        }}
      >
        {body}
      </button>
    );
  };
  return (
    <ModalOverlay
      isDismissable
      className="fixed inset-0 z-50 flex items-end bg-backdrop entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out"
    >
      <Modal className="w-full rounded-t-xl bg-overlay text-fg shadow-overlay entering:animate-in entering:slide-in-from-bottom exiting:animate-out exiting:slide-out-to-bottom">
        <AriaDialog
          aria-label={label}
          className="flex flex-col pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] outline-none"
        >
          {({ close }) => (
            <>
              {plain.map(item(close))}
              {plain.length > 0 && danger.length > 0 && (
                <hr className="my-1 border-border" />
              )}
              {danger.map(item(close))}
              <div className="mt-2 border-t border-border px-4 pt-3">
                <Button
                  variant="secondary"
                  onPress={close}
                  className="min-h-14 w-full text-lg"
                >
                  {cancel}
                </Button>
              </div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// how the arrow opens the rest: a menu below it (from md, at the top of the
// page), above it (a phone's foot bar, to compare), or a sheet (a phone)
type Opens = "down" | "up" | "sheet";

// A split button, the page's one action control: the main action pressed
// straight away, and an arrow, named for what it holds, opening the rest
function SplitButton({
  main,
  more,
  w,
  opens,
}: {
  main: DAction;
  more: DAction[];
  w: Words;
  opens: Opens;
}) {
  const joined = more.length > 0 ? "rounded-r-none" : "";
  const content = (
    <>
      <main.icon aria-hidden size={18} />
      {main.label}
    </>
  );
  const first =
    "href" in main ? (
      <ButtonLink
        href={main.href as unknown as AppHref}
        target={main.external ? "_blank" : undefined}
        rel={main.external ? "noreferrer" : undefined}
        className={`flex-1 ${joined}`}
      >
        {content}
      </ButtonLink>
    ) : (
      <Button
        onPress={main.onPress}
        isDisabled={main.isDisabled}
        className={`flex-1 ${joined}`}
      >
        {content}
      </Button>
    );
  const Chevron = opens === "down" ? ChevronDown : ChevronUp;
  const arrow = (
    <Button
      aria-label={w.moreActions}
      className="shrink-0 rounded-l-none border-l border-primary-fg/40 px-3"
    >
      <Chevron aria-hidden size={20} />
    </Button>
  );
  return (
    <div className="flex w-full md:w-auto">
      {first}
      {more.length > 0 &&
        (opens === "sheet" ? (
          <DialogTrigger>
            {arrow}
            <ActionSheet
              label={w.moreActions}
              cancel={w.cancel}
              actions={more}
            />
          </DialogTrigger>
        ) : (
          <MenuTrigger>
            {arrow}
            <AriaPopover
              placement={opens === "down" ? "bottom end" : "top end"}
              offset={4}
              className="min-w-56 overflow-auto rounded-lg border border-border bg-overlay p-1 text-fg shadow-overlay outline-none entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95"
            >
              <AriaMenu className="outline-none">{menuItems(more)}</AriaMenu>
            </AriaPopover>
          </MenuTrigger>
        ))}
    </div>
  );
}

// An open place: a ghost of a face, the faces' own person drawn faint and
// thin in a dashed ring, no fill (dashing the person too broke its head
// into crumbs at this size): unfilled where a face is a filled disc, its
// line thin, its word quiet where a name is bold
function OpenMark() {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-fg-muted"
    >
      <UserRound size={22} strokeWidth={1.5} className="opacity-60" />
    </span>
  );
}

// the main column and the right one a Record keeps from xl (its History),
// as RecordPage's Beside lays them out
const columns =
  "grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]";

// a phone's bar at the foot, above the tab bar; none from md
function FootBarD({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-20 md:hidden print:hidden" />
      <div
        role="group"
        aria-label={label}
        className="fixed inset-x-0 bottom-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] z-30 flex border-t border-border bg-surface px-4 py-3 shadow-raised md:hidden print:hidden"
      >
        {children}
      </div>
    </>
  );
}

// From md, the slim header that slides in at the top once the title row's
// button has scrolled away: the title and the same split button, its box
// lined up with the main column as the card is
function StickyHeadD({
  shown,
  title,
  status,
  children,
}: {
  shown: boolean;
  title: string;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      inert={!shown}
      aria-hidden={!shown}
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 hidden transition duration-200 md:left-64 md:block print:hidden ${
        shown ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto w-full max-w-5xl px-8">
        <div className={columns}>
          <div className="pointer-events-auto flex items-center gap-3 rounded-b-lg border-x border-b border-border bg-surface px-4 py-2 shadow-raised">
            <p className="truncate font-display text-xl font-bold tracking-wide uppercase">
              {title}
            </p>
            {status}
            <span className="ml-auto flex">{children}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// whether the element has scrolled up out of view (and not merely hidden,
// as the title row's button is on a phone)
function useScrolledAway() {
  const ref = useRef<HTMLSpanElement>(null);
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const watch = new IntersectionObserver(([e]) =>
      setAway(!!e && !e.isIntersecting && e.boundingClientRect.bottom < 1),
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return [ref, away] as const;
}

// ---- the cases ----

// a place on the crew: someone (confirmed, or offered and not yet
// answered), or an open place (null)
type Place = { name: string; confirmed: boolean } | null;

type Kind =
  | "short"
  | "openToAll"
  | "booked"
  | "moveAsked"
  | "inProgress"
  | "review"
  | "firstPaid"
  | "unpaid"
  | "noAccess"
  | "cancelled";

type Story = {
  icon: LucideIcon;
  title: string;
  when: string;
  description?: string;
};

type OfficeCase = {
  key: string;
  name: string;
  kind: Kind;
  service: string;
  startsAt: string;
  // the Office's working: the Labour Hours, shared by the crew
  labourHours: number;
  crew: Place[];
  street: string;
  client: string;
  extras: string[];
  // how to get in, when the home has a note
  door?: string;
  // free cleaners can take it from then (ADR-0019)
  opensAt?: string;
  priceCents: number;
  depositCents: number;
  history: Story[];
};

const H = 3_600_000;
const at = (iso: string, plusHours = 0) =>
  new Date(new Date(iso).getTime() + plusHours * H).toISOString();
// New York is UTC-5 through these weeks
const ny = (day: string, hour: number, minute = 0) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, hour + 5, minute)).toISOString();
};
// a moment's day and time, as History shows it
const when = (iso: string) => formatDateTime(iso);

const cases: OfficeCase[] = [
  {
    key: "1",
    name: "short of cleaners",
    kind: "short",
    service: "Deep Clean",
    startsAt: ny("2026-12-03", 9),
    labourHours: 8.25,
    crew: [
      { name: "Maria", confirmed: true },
      { name: "Dee", confirmed: false },
      null,
    ],
    street: "41-12 Austin St, 4B, Queens, NY 11375",
    client: "Casey Morgan",
    extras: [],
    priceCents: 53_892,
    depositCents: 13_473,
    history: [
      {
        icon: Send,
        title: "Offered to Dee",
        when: when(ny("2026-11-20", 16, 5)),
      },
      {
        icon: UserCheck,
        title: "Maria confirmed",
        when: when(ny("2026-11-18", 11, 30)),
      },
      {
        icon: Send,
        title: "Offered to Maria",
        when: when(ny("2026-11-18", 9, 2)),
      },
      {
        icon: CalendarPlus,
        title: "Booked by Casey",
        when: when(ny("2026-11-17", 19, 44)),
        description: "Deposit of $134.73 charged",
      },
    ],
  },
  {
    key: "2",
    name: "short of cleaners, open to all from a date",
    kind: "openToAll",
    service: "Standard Clean",
    startsAt: ny("2026-12-01", 9),
    labourHours: 5,
    crew: [null, null],
    street: "88 Ridge Rd, Yonkers, NY 10705",
    client: "Priya Shah",
    extras: [],
    opensAt: ny("2026-11-24", 9),
    priceCents: 32_665,
    depositCents: 8_166,
    history: [
      {
        icon: X,
        title: "Ana took herself off",
        when: when(ny("2026-11-20", 8, 15)),
      },
      {
        icon: X,
        title: "Rosa took herself off",
        when: when(ny("2026-11-19", 18, 40)),
      },
      {
        icon: CalendarPlus,
        title: "Booked by Priya",
        when: when(ny("2026-11-10", 12, 3)),
        description: "Deposit of $81.66 charged",
      },
    ],
  },
  {
    key: "3",
    name: "booked and staffed, before the day",
    kind: "booked",
    service: "Deep Clean",
    startsAt: ny("2026-12-07", 13),
    labourHours: 5.25,
    crew: [
      { name: "Maria", confirmed: true },
      { name: "Rosa", confirmed: true },
    ],
    street: "1520 Pelham Pkwy S, 2F, Bronx, NY 10461",
    client: "Tom Okafor",
    extras: [
      "Inside the oven",
      "Inside the fridge",
      "Inside the kitchen cabinets",
    ],
    door: "Buzz 2F. If nobody answers, the lockbox by the side gate is 4417.",
    priceCents: 35_928,
    depositCents: 8_982,
    history: [
      {
        icon: UserCheck,
        title: "Rosa confirmed",
        when: when(ny("2026-11-19", 14, 20)),
      },
      {
        icon: UserCheck,
        title: "Maria confirmed",
        when: when(ny("2026-11-19", 10, 2)),
      },
      {
        icon: Send,
        title: "Offered to Maria and Rosa",
        when: when(ny("2026-11-19", 9, 30)),
      },
      {
        icon: CalendarPlus,
        title: "Booked by Tom",
        when: when(ny("2026-11-18", 21, 12)),
        description: "Deposit of $89.82 charged",
      },
    ],
  },
  {
    key: "4",
    name: "move asked by the Client, with a fee",
    kind: "moveAsked",
    service: "Standard Clean",
    startsAt: ny("2026-11-23", 10),
    labourHours: 3,
    crew: [{ name: "Ana", confirmed: true }],
    street: "230 E 85th St, 6C, New York, NY 10028",
    client: "Lena Fischer",
    extras: [],
    priceCents: 19_599,
    depositCents: 4_900,
    history: [
      {
        icon: CalendarClock,
        title: "Lena asked to move it",
        when: when(ny("2026-11-21", 8, 47)),
      },
      {
        icon: UserCheck,
        title: "Ana confirmed",
        when: when(ny("2026-11-12", 17, 0)),
      },
      {
        icon: CalendarPlus,
        title: "Booked by Lena",
        when: when(ny("2026-11-11", 9, 30)),
        description: "Deposit of $49.00 charged",
      },
    ],
  },
  {
    key: "5",
    name: "today, in progress",
    kind: "inProgress",
    service: "Standard Clean",
    startsAt: ny("2026-11-21", 9),
    labourHours: 4.5,
    crew: [
      { name: "Maria", confirmed: true },
      { name: "Dee", confirmed: true },
    ],
    street: "67 Garden St, Hoboken, NJ 07030",
    client: "Sam Rivera",
    extras: ["Inside the fridge"],
    priceCents: 29_399,
    depositCents: 7_350,
    history: [
      {
        icon: Play,
        title: "Started",
        when: when(ny("2026-11-21", 9, 4)),
        description: "By Maria",
      },
      {
        icon: UserCheck,
        title: "Dee confirmed",
        when: when(ny("2026-11-16", 13, 10)),
      },
      {
        icon: UserCheck,
        title: "Maria confirmed",
        when: when(ny("2026-11-15", 10, 0)),
      },
      {
        icon: CalendarPlus,
        title: "Booked by Sam",
        when: when(ny("2026-11-14", 20, 8)),
        description: "Deposit of $73.50 charged",
      },
    ],
  },
  {
    key: "6",
    name: "done, 2 price changes to review",
    kind: "review",
    service: "Deep Clean",
    startsAt: ny("2026-11-19", 9),
    labourHours: 5.25,
    crew: [
      { name: "Maria", confirmed: true },
      { name: "Rosa", confirmed: true },
    ],
    street: "41-12 Austin St, 4B, Queens, NY 11375",
    client: "Casey Morgan",
    extras: ["Inside the oven"],
    priceCents: 35_928,
    depositCents: 8_982,
    history: [
      {
        icon: CreditCard,
        title: "Balance of $269.46 charged",
        when: when(ny("2026-11-19", 12, 41)),
      },
      {
        icon: ClipboardList,
        title: "2 price changes reported",
        when: when(ny("2026-11-19", 12, 40)),
        description: "By Maria",
      },
      {
        icon: CircleCheck,
        title: "Done",
        when: when(ny("2026-11-19", 12, 40)),
        description: "By Maria",
      },
      {
        icon: CalendarPlus,
        title: "Booked by Casey",
        when: when(ny("2026-11-02", 18, 20)),
        description: "Deposit of $89.82 charged",
      },
    ],
  },
  {
    key: "7",
    name: "done and paid, the first clean",
    kind: "firstPaid",
    service: "Standard Clean",
    startsAt: ny("2026-11-19", 9),
    labourHours: 3.5,
    crew: [{ name: "Ana", confirmed: true }],
    street: "15 Linden Ave, Apt 3, Jersey City, NJ 07305",
    client: "Grace Liu",
    extras: [],
    priceCents: 22_866,
    depositCents: 5_717,
    history: [
      {
        icon: CreditCard,
        title: "Balance of $171.49 charged",
        when: when(ny("2026-11-19", 12, 31)),
      },
      {
        icon: CircleCheck,
        title: "Done",
        when: when(ny("2026-11-19", 12, 30)),
        description: "By Ana",
      },
      {
        icon: CalendarPlus,
        title: "Booked by Grace",
        when: when(ny("2026-11-09", 10, 2)),
        description: "Deposit of $57.17 charged",
      },
    ],
  },
  {
    key: "8",
    name: "done, the charge failed",
    kind: "unpaid",
    service: "Deep Clean",
    startsAt: ny("2026-11-19", 9),
    labourHours: 5.25,
    crew: [
      { name: "Maria", confirmed: true },
      { name: "Rosa", confirmed: true },
    ],
    street: "1520 Pelham Pkwy S, 2F, Bronx, NY 10461",
    client: "Tom Okafor",
    extras: [],
    priceCents: 35_928,
    depositCents: 8_982,
    history: [
      {
        icon: CircleAlert,
        title: "Balance of $269.46 declined",
        when: when(ny("2026-11-19", 12, 41)),
      },
      {
        icon: CircleCheck,
        title: "Done",
        when: when(ny("2026-11-19", 12, 40)),
        description: "By Maria",
      },
      {
        icon: CalendarPlus,
        title: "Booked by Tom",
        when: when(ny("2026-11-05", 15, 0)),
        description: "Deposit of $89.82 charged",
      },
    ],
  },
  {
    key: "9",
    name: "couldn't get in",
    kind: "noAccess",
    service: "Standard Clean",
    startsAt: ny("2026-11-20", 9),
    labourHours: 3,
    crew: [{ name: "Dee", confirmed: true }],
    street: "88 Ridge Rd, Yonkers, NY 10705",
    client: "Priya Shah",
    extras: [],
    priceCents: 19_599,
    depositCents: 4_900,
    history: [
      {
        icon: CreditCard,
        title: "Fee of $49.00 charged",
        when: when(ny("2026-11-20", 9, 21)),
      },
      {
        icon: DoorClosed,
        title: "Couldn't get in",
        when: when(ny("2026-11-20", 9, 20)),
        description: "Recorded by Dee",
      },
      {
        icon: CalendarPlus,
        title: "Booked by Priya",
        when: when(ny("2026-11-08", 11, 45)),
      },
    ],
  },
  {
    key: "10",
    name: "cancelled, the deposit refunded",
    kind: "cancelled",
    service: "Deep Clean",
    startsAt: ny("2026-11-24", 9),
    labourHours: 5.25,
    crew: [
      { name: "Maria", confirmed: true },
      { name: "Ana", confirmed: false },
    ],
    street: "230 E 85th St, 6C, New York, NY 10028",
    client: "Lena Fischer",
    extras: ["Inside the oven", "Wash and hang the curtains"],
    priceCents: 35_928,
    depositCents: 8_982,
    history: [
      {
        icon: Undo2,
        title: "Deposit of $89.82 refunded",
        when: when(ny("2026-11-18", 15, 13)),
      },
      {
        icon: CalendarX,
        title: "Cancelled",
        when: when(ny("2026-11-18", 15, 12)),
        description: "By Lena",
      },
      {
        icon: UserCheck,
        title: "Maria confirmed",
        when: when(ny("2026-11-12", 9, 40)),
      },
      {
        icon: CalendarPlus,
        title: "Booked by Lena",
        when: when(ny("2026-11-11", 16, 25)),
        description: "Deposit of $89.82 charged",
      },
    ],
  },
];

// ---- what the page reads off a case ----

const done = (k: Kind) => k === "review" || k === "firstPaid" || k === "unpaid";
// over: what happened leads, the job folds under "The job"
const ended = (k: Kind) => done(k) || k === "noAccess" || k === "cancelled";
// won't happen: the date tile muted
const wontHappen = (k: Kind) => k === "noAccess" || k === "cancelled";
// booked and not yet begun: the crew can still change
const beforeTheDay = (k: Kind) =>
  k === "short" || k === "openToAll" || k === "booked" || k === "moveAsked";

const firstName = (name: string) => name.split(" ")[0]!;

// "2¾": hours to the quarter, as a person writes them
const quarters = (hours: number) => {
  const q = Math.round(hours * 4) / 4;
  const whole = Math.floor(q);
  const part = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" }[q - whole] ?? "";
  return `${whole === 0 && part ? "" : whole}${part}`;
};

function useJob(c: OfficeCase) {
  // the crew's time there: the Labour Hours shared, to the quarter hour
  const there = Math.round((c.labourHours / c.crew.length) * 4) / 4;
  const end = at(c.startsAt, there);
  return {
    range: `${formatTime(c.startsAt)} – ${formatTime(end)}`,
    howLong: `About ${quarters(there)} h`,
    cleaningHours: quarters(c.labourHours),
    // free to move or cancel until 48 hours before
    freeUntil: at(c.startsAt, -48),
    first: firstName(c.client),
  };
}
type J = ReturnType<typeof useJob>;

// "now" in the prototype: Sat, Nov 21, 2026, 2 PM in New York
const NOW = ny("2026-11-21", 14);

// one badge, from Jen's side; none for a booked, staffed Job before the day
function statusOf(c: OfficeCase): { tone: StatusTone; text: string } | null {
  switch (c.kind) {
    case "short":
    case "openToAll":
      return { tone: "warning", text: "Needs a cleaner" };
    case "booked":
      return null; // the usual case
    case "moveAsked":
      return { tone: "warning", text: "Move asked" };
    case "inProgress":
      return { tone: "success", text: "In progress" };
    case "review":
    case "firstPaid":
      return { tone: "success", text: "Done" };
    case "unpaid":
      return { tone: "danger", text: "Unpaid" };
    case "noAccess":
      return { tone: "danger", text: "Couldn't get in" };
    case "cancelled":
      return { tone: "neutral", text: "Cancelled" };
  }
}

// only what the badge can't say, each holding its one action, which is
// nowhere else on the page
function alertsFor(c: OfficeCase, j: J) {
  return [
    c.kind === "moveAsked" && {
      key: "move",
      tone: "warning" as const,
      action: (
        <Button variant="text" onPress={say("Answer")}>
          Answer
        </Button>
      ),
      children: (
        <p>
          <strong>
            {j.first} asked to move it to {formatDateTime(ny("2026-11-25", 10))}
            .
          </strong>{" "}
          It's a {formatMoney(4_000)} fee.
        </p>
      ),
    },
    c.kind === "review" && {
      key: "review",
      tone: "warning" as const,
      action: (
        <Button variant="text" onPress={say("Review")}>
          Review
        </Button>
      ),
      children: (
        <p>
          <strong>Maria reported 2 price changes.</strong>
        </p>
      ),
    },
    c.kind === "unpaid" && {
      key: "unpaid",
      tone: "danger" as const,
      action: (
        <Button variant="text" onPress={say("Retry the charge")}>
          Retry the charge
        </Button>
      ),
      children: (
        <p>
          <strong>The card ending 4242 was declined.</strong> Ask {j.first} for
          another card, then retry.
        </p>
      ),
    },
  ];
}

type Action = DAction;

// the page's next step, then the rest. When an alert holds the step, the
// primary is the next thing; when there's no next thing, no primary
function actionsFor(c: OfficeCase): {
  main: Action | null;
  more: Action[];
} | null {
  const offer: Action = {
    label: "Offer to a cleaner",
    icon: UserPlus,
    onPress: say("Offer to a cleaner"),
  };
  const move: Action = {
    label: "Move",
    icon: CalendarSync,
    onPress: say("Move"),
  };
  const ask: Action = {
    label: "Ask for a new time",
    icon: CalendarClock,
    onPress: say("Ask for a new time"),
  };
  const cancel: Action = {
    label: "Cancel job",
    icon: CalendarX,
    danger: true,
    onPress: say("Cancel job"),
  };
  const notDone: Action = {
    label: "Mark not done",
    icon: Undo2,
    danger: true,
    onPress: say("Mark not done"),
  };
  switch (c.kind) {
    case "short":
    case "openToAll":
      return { main: offer, more: [move, ask, cancel] };
    case "booked":
      return { main: move, more: [ask, cancel] };
    case "moveAsked":
      // Answer is the alert's
      return { main: move, more: [cancel] };
    case "inProgress":
      return null;
    case "review":
    case "unpaid":
      // Review and Retry are the alert's
      return { main: null, more: [notDone] };
    case "firstPaid":
      return {
        main: {
          label: "Offer a cleaning plan",
          icon: Repeat,
          onPress: say("Offer a cleaning plan"),
        },
        more: [notDone],
      };
    case "noAccess":
    case "cancelled":
      return null;
  }
}

// ---- the header card ----

// a page off a calendar for a Job that won't happen: muted, not green
function MutedDateTile({ date }: { date: string }) {
  const parts = formats.en.dateTile(date);
  return (
    <span
      aria-hidden
      className="flex w-20 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-border bg-surface text-center"
    >
      <span className="w-full bg-surface-sunken py-1 text-xs font-bold tracking-widest text-fg-muted uppercase">
        {parts.month}
      </span>
      <span className="pt-1 font-display text-4xl leading-none font-bold text-fg-muted">
        {parts.day}
      </span>
      <span className="pb-2 text-sm text-fg-muted">{parts.weekday}</span>
    </span>
  );
}

const quietLink =
  "text-fg underline decoration-border-strong underline-offset-2 hover:decoration-fg";

// what Jen knows a Job by: when, the time it runs, where and who for; one
// rule; then the details, one icon, one value and one line each
function JobCard({ c, j }: { c: OfficeCase; j: J }) {
  const freeShown = beforeTheDay(c.kind) && j.freeUntil > NOW;
  return (
    <Card hiddenTitle="Job details">
      <div className="flex items-center gap-4">
        {wontHappen(c.kind) ? (
          <MutedDateTile date={c.startsAt} />
        ) : (
          <DateTile date={c.startsAt} />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-2xl font-semibold text-fg tabular-nums">
            {j.range}
          </p>
          <a href="#home" className={`${quietLink} [overflow-wrap:anywhere]`}>
            {c.street}
          </a>
          <a href="#client" className={`${quietLink} self-start`}>
            {c.client}
          </a>
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <Facts>
          <Fact icon={Clock} label="How long" value={j.howLong} />
          <Fact
            icon={ClipboardList}
            label="Cleaning hours"
            value={j.cleaningHours}
          />
          {c.extras.length > 0 && (
            <Fact icon={CirclePlus} label="Extras" value={c.extras.length} />
          )}
          {freeShown && (
            <Fact
              icon={CalendarCheck}
              label="Free to move or cancel"
              value={formatDateTime(j.freeUntil)}
              line="Free to move or cancel until"
            />
          )}
          {c.door && (
            <Fact
              icon={KeyRound}
              label="Getting in"
              className="col-span-full"
              value={c.door}
            />
          )}
        </Facts>
      </div>
    </Card>
  );
}

// the extras, a part of their own, one a line; none, no part
function Extras({ c }: { c: OfficeCase }) {
  if (c.extras.length === 0) return null;
  return (
    <Section title="Extras">
      <Card>
        <ul className="-my-3 divide-y divide-border">
          {c.extras.map((x) => (
            <li key={x} className="py-3 text-fg">
              {x}
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

// ---- the crew ----

// a face: every one the same, a tick once confirmed, nothing while offered
// (the name shows, so it reads apart from an open place); the ✕ takes
// them off, while the crew can still change
function CrewFace({
  m,
  removable,
  over,
}: {
  m: Place;
  removable: boolean;
  // a Job that's over: who was there, no tick to say so
  over: boolean;
}) {
  if (!m)
    return (
      <span className="inline-flex items-center gap-2">
        <OpenMark />
        <span className="text-fg-muted">
          Open<span className="sr-only">, a place still to fill</span>
        </span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative">
        <Avatar />
        {m.confirmed && !over && (
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-success-strong text-surface ring-2 ring-surface"
          >
            <Check size={13} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="font-semibold text-fg">
        {m.name}
        <span className="sr-only">
          {!over &&
            (m.confirmed ? ", confirmed" : ", offered, not answered yet")}
        </span>
      </span>
      {removable && (
        <Button
          variant="quiet"
          size="sm"
          aria-label={`Take ${m.name} off`}
          className="-ml-1 size-9 p-0 text-fg-muted"
          onPress={say(`Take ${m.name} off`)}
        >
          <X aria-hidden size={18} />
        </Button>
      )}
    </span>
  );
}

// how the crew stands: confirmed of how many, then how many are open (a
// zero isn't said); and when it opens to every free cleaner, that too
function crewLine(c: OfficeCase) {
  const of = c.crew.length;
  const confirmed = c.crew.filter((m) => m?.confirmed).length;
  const open = c.crew.filter((m) => !m).length;
  const places = `${open} ${open === 1 ? "place" : "places"} open`;
  const stands =
    open === 0
      ? `${confirmed} of ${of} confirmed`
      : confirmed === 0
        ? places
        : `${confirmed} of ${of} confirmed, ${open} open`;
  return c.opensAt
    ? `${stands}. Free cleaners can take it from ${formats.en.formatDay(c.opensAt.slice(0, 10))}.`
    : stands;
}

// the crew as a card of faces, its title and line on the page above it. On
// a Job that's over, who was there: no open places, no line, no ✕
function Crew({ c }: { c: OfficeCase }) {
  const over = ended(c.kind);
  const places = over ? c.crew.filter((m) => m?.confirmed) : c.crew;
  if (places.length === 0) return null;
  return (
    <Section title="Crew" description={over ? undefined : crewLine(c)}>
      <Card>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {places.map((m, i) => (
            <CrewFace
              key={i}
              m={m}
              removable={beforeTheDay(c.kind)}
              over={over}
            />
          ))}
        </div>
      </Card>
    </Section>
  );
}

// ---- money: one line a fact, no number twice ----

function Money({ c }: { c: OfficeCase }) {
  const card = "card ending 4242";
  const total = c.priceCents;
  const facts: ReactNode = (() => {
    switch (c.kind) {
      case "review":
      case "firstPaid":
        return (
          <Fact
            icon={CreditCard}
            label="Paid"
            value={formatMoney(total)}
            line={`Paid by ${card}`}
          />
        );
      case "unpaid":
        return (
          <Fact
            icon={CircleAlert}
            label="Owed"
            value={formatMoney(total - c.depositCents)}
            line="Still owed"
          />
        );
      case "noAccess":
        return (
          <Fact
            icon={CreditCard}
            label="Fee"
            value={formatMoney(c.depositCents)}
            line={`Fee, paid by ${card}`}
          />
        );
      case "cancelled":
        return (
          <Fact
            icon={Undo2}
            label="Deposit"
            value={formatMoney(c.depositCents)}
            line="Deposit refunded"
          />
        );
      default:
        return (
          <>
            <Fact
              icon={Receipt}
              label="Price"
              value={formatMoney(total)}
              line="Price, tax included"
            />
            <Fact
              icon={CreditCard}
              label="Deposit"
              value={formatMoney(c.depositCents)}
              line="Deposit paid"
            />
          </>
        );
    }
  })();
  return (
    <Section title="Money">
      <Card>
        <Facts>{facts}</Facts>
      </Card>
    </Section>
  );
}

// ---- what happened, on a Job that's over ----

function WhatHappened({ c }: { c: OfficeCase }) {
  const facts: ReactNode = (() => {
    switch (c.kind) {
      case "noAccess":
        return (
          <>
            <Fact
              icon={DoorClosed}
              label="Couldn't get in"
              value={formatDateTime(ny("2026-11-20", 9, 20))}
              line={`Couldn't get in, said ${c.crew[0]!.name}`}
            />
            <Fact
              icon={MessageSquareText}
              label={`What ${c.crew[0]!.name} wrote`}
              className="col-span-full"
              value="Nobody answered, and the key wasn't where the note says."
            />
          </>
        );
      case "cancelled":
        return (
          <Fact
            icon={CalendarX}
            label="Cancelled"
            value={formatDateTime(ny("2026-11-18", 15, 12))}
            line={`Cancelled by ${firstName(c.client)}`}
          />
        );
      default:
        return (
          <>
            <Fact
              icon={CircleCheck}
              label="Done"
              value={formatDateTime(ny("2026-11-19", 12, 40))}
              line={`Done, by ${c.crew[0]!.name}`}
            />
            <Fact
              icon={Sparkles}
              label="The home"
              value="About right"
              line="How dirty the home was"
            />
          </>
        );
    }
  })();
  return (
    <Card hiddenTitle="What happened">
      <Facts>{facts}</Facts>
    </Card>
  );
}

// ---- History: the story, beside from xl, below on a phone ----

function History({ c }: { c: OfficeCase }) {
  return (
    <Section title="History">
      <Card>
        <Timeline aria-label="History, newest first">
          {c.history.map((s) => (
            <TimelineItem
              key={`${s.title}-${s.when}`}
              icon={s.icon}
              title={s.title}
              when={s.when}
              description={s.description}
            />
          ))}
        </Timeline>
      </Card>
    </Section>
  );
}

// no next step, only rarer ones (Mark not done): a quiet ⋯ in the split
// button's place, at every width, and no bar at a phone's foot
function RareActions({ actions }: { actions: Action[] }) {
  return (
    <MenuTrigger>
      <Button variant="quiet" aria-label={w.moreActions} className="px-2">
        <Ellipsis aria-hidden size={22} />
      </Button>
      <AriaPopover
        placement="bottom end"
        offset={4}
        className="min-w-56 overflow-auto rounded-lg border border-border bg-overlay p-1 text-fg shadow-overlay outline-none entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95"
      >
        <AriaMenu className="outline-none">{menuItems(actions)}</AriaMenu>
      </AriaPopover>
    </MenuTrigger>
  );
}

// ---- the page ----

function Page({ c }: { c: OfficeCase }) {
  const j = useJob(c);
  const s = statusOf(c);
  const actions = actionsFor(c);
  const main = actions?.main ?? null;
  const [headRef, away] = useScrolledAway();
  const split = (opens: Opens) =>
    main &&
    actions && (
      <SplitButton main={main} more={actions.more} w={w} opens={opens} />
    );
  const badge = s && <StatusBadge tone={s.tone}>{s.text}</StatusBadge>;
  const over = ended(c.kind);
  const job = (
    <>
      <JobCard c={c} j={j} />
      <Extras c={c} />
      <Crew c={c} />
    </>
  );
  return (
    <div className={columns}>
      <div className="flex min-w-0 flex-col gap-6">
        <RecordPage
          trail={[{ label: "Jobs", href: linkTo({ to: "/office/jobs" }) }]}
          title={c.service}
          status={
            <>
              {badge}
              {main && (
                <span ref={headRef} className="ml-auto flex max-md:hidden">
                  {split("down")}
                </span>
              )}
              {!main && actions && (
                <span className="ml-auto flex">
                  <RareActions actions={actions.more} />
                </span>
              )}
            </>
          }
          alerts={alertsFor(c, j)}
        />
        {over ? (
          <>
            <WhatHappened c={c} />
            <Money c={c} />
            <Fold label="The job">
              <div className="flex flex-col gap-6">{job}</div>
            </Fold>
          </>
        ) : (
          <>
            {job}
            <Money c={c} />
          </>
        )}
        {main && actions && (
          <>
            <StickyHeadD shown={away} title={c.service} status={badge}>
              {split("down")}
            </StickyHeadD>
            {/* on a phone, the next step after the details: read, then
                decide */}
            <FootBarD label="What to do">{split("sheet")}</FootBarD>
          </>
        )}
      </div>
      <History c={c} />
    </div>
  );
}

export function OfficeJobPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string | number;
    lang?: string;
  };
  const navigate = useNavigate();
  const c = cases.find((x) => x.key === String(search.case)) ?? cases[0]!;
  const lang: Language = search.lang === "es" ? "es" : "en";
  // the root sets the signed-out language on every navigation: say ours again
  useEffect(() => setAppLanguage(lang));
  const go = (key: string) =>
    void navigate({
      to: "/prototype/office-job",
      search: { case: key, lang },
      replace: true,
    });
  const nav: NavItem[] = navFor(lang).office.map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === "Jobs",
    }),
  );
  return (
    <LanguageProvider lang={lang}>
      <AppLayout area={areaLabels[lang].office} nav={nav} foot={() => null}>
        {/* the page is the Office's, in English (ADR-0025): only the frame
            follows &lang= */}
        <LanguageProvider lang="en">
          {/* room for the switcher on a phone, so it covers nothing at rest */}
          <div aria-hidden className="h-12 md:hidden" />
          <p className="mb-4 text-sm text-fg-muted">
            Case {c.key}: {c.name}
          </p>
          <Page key={c.key} c={c} />
          <div aria-hidden className="h-16" />
        </LanguageProvider>
        <PrototypeSwitcher
          variants={cases.map((x) => ({ key: x.key, name: x.name }))}
          current={c.key}
          onChange={go}
          className="top-16 md:top-auto md:bottom-4"
        />
      </AppLayout>
    </LanguageProvider>
  );
}
