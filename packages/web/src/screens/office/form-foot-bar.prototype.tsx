// PROTOTYPE: throwaway. Where a form's price and its button sit on a wider
// screen (#493, decision D1): the Office's Quote Draft and New quote, on
// made-up data, at /prototype/form-foot-bar?layout=A..C&case=1..4 (no
// sign-in), inside the frame #493 approved (an icon rail from md to lg, the
// sidebar from lg) and the Office's nav. ↑/↓ switch layouts, ←/→ cases.
//   A  today: the full-width bar at the foot, prices, "Saved" and the button
//   B  no bar from md: the button is the header's primary (Delete draft
//      behind its arrow); once the title row scrolls away a sticky header
//      carries the title, the total (below xl, where the aside isn't beside
//      the form), "Saved" and the same button
//   C  a bar as wide as the form's column: "Saved" and the button only, the
//      total left to the Prices aside
// Below md every layout keeps today's bar: a phone isn't the question.
// The split button and the sticky header are copied from
// prototype-office-job (881fc6af), as is the frame. Lives only on
// prototype-form-foot-bar.
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { parseDate, parseTime } from "@internationalized/date";
import {
  DialogTrigger,
  Menu as AriaMenu,
  MenuTrigger,
  Link as AriaLink,
  Popover as AriaPopover,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import {
  Building2,
  CalendarPlus,
  ChevronDown,
  House,
  Menu as MenuIcon,
  Search,
  Send,
  Sparkles,
  Store,
  Trash2,
  Users,
  WandSparkles,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { formats } from "@empire-cleaning/models";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  ChoiceTile,
  ChoiceTiles,
  DatePicker,
  Drawer,
  Fold,
  FormPart,
  Heading,
  Link,
  LanguageProvider,
  Logo,
  MenuItem,
  MenuSeparator,
  type NavItem,
  NumberField,
  PageHeader,
  Section,
  Segment,
  SegmentedControl,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
  ThemeToggle,
  TimeField,
  showToast,
  useUiWords,
  Breadcrumbs,
} from "@empire-cleaning/ui";
import { type AppHref, linkTo } from "../../links.ts";
import { areaLabels } from "../../session.ts";
import { navFor } from "../AreaLayout.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { PriceHead } from "../QuoteParts.tsx";

const { formatMoney } = formats.en;

const say = (what: string) => () =>
  showToast({ title: `Prototype: "${what}" does nothing here`, tone: "info" });

// ---- copied from prototype-office-job (881fc6af): the split button ----

type DAction = {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
};

const inOrder = (actions: DAction[]) => ({
  plain: actions.filter((a) => !a.danger),
  danger: actions.filter((a) => a.danger),
});

function menuItems(actions: DAction[]) {
  const { plain, danger } = inOrder(actions);
  const item = (a: DAction) => (
    <MenuItem
      key={a.label}
      icon={a.icon}
      danger={a.danger}
      onAction={a.onPress}
    >
      {a.label}
    </MenuItem>
  );
  return (
    <>
      {plain.map(item)}
      {plain.length > 0 && danger.length > 0 && <MenuSeparator />}
      {danger.map(item)}
    </>
  );
}

// the page's one action control: the main action pressed straight away,
// and an arrow, named for what it holds, opening the rest below it
function SplitButton({ main, more }: { main: DAction; more: DAction[] }) {
  const joined = more.length > 0 ? "rounded-r-none" : "";
  return (
    <div className="flex">
      <Button
        onPress={main.onPress}
        isDisabled={main.isDisabled}
        className={`flex-1 ${joined}`}
      >
        <main.icon aria-hidden size={18} />
        {main.label}
      </Button>
      {more.length > 0 && (
        <MenuTrigger>
          <Button
            aria-label="More actions"
            className="shrink-0 rounded-l-none border-l border-primary-fg/40 px-3"
          >
            <ChevronDown aria-hidden size={20} />
          </Button>
          <AriaPopover
            placement="bottom end"
            offset={4}
            className="min-w-56 overflow-auto rounded-lg border border-border bg-overlay p-1 text-fg shadow-overlay outline-none"
          >
            <AriaMenu className="outline-none">{menuItems(more)}</AriaMenu>
          </AriaPopover>
        </MenuTrigger>
      )}
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

// ---- the cases: made-up data ----

type Price = {
  title: string;
  badge?: ReactNode;
  totalCents: number;
  taxCents: number;
  perClean?: boolean;
  // how it's worked out, folded
  working: [string, string][];
};

type FormCase = {
  key: string;
  name: string;
  trail: { label: string; href?: AppHref }[];
  title: string;
  badge?: ReactNode;
  // the Draft's Delete draft; New quote has none
  deletes?: boolean;
  about?: string;
  alerts?: ReactNode[];
  asideTitle: string;
  prices: Price[];
  // what the aside says in the price's place while it can't be worked out
  missing?: string;
  // a plan of more than one weekday: what a week comes to, which only
  // today's bar said; drawn under the prices in every layout, so B and C
  // drop nothing the bar held
  week?: { label: string; cents: number };
  // the prices in a line, as today's bar says them
  summary?: string;
  // the total in the fewest words, for the sticky header (B)
  total?: string;
  status: string;
  action: { label: string; srLabel?: string; icon: LucideIcon };
  // under the card: why it can't be sent, a save's problem
  end?: ReactNode;
  disabled?: boolean;
  form: () => ReactNode;
};

const quotes = linkTo({ to: "/office/quotes" });
const TAX = 8.875;
const tax = (cents: number) => Math.round((cents * TAX) / (100 + TAX));

const deepWorking: [string, string][] = [
  ["3 bedrooms", "3 h"],
  ["2 bathrooms", "2 h"],
  ["Kitchen and living areas", "1½ h"],
  ["Deep Clean (× 1.4)", "9 h 6 min"],
  ["Inside the oven", "45 min"],
  ["At $55.00 an hour", "$543.00"],
];
const standardWorking: [string, string][] = [
  ["3 bedrooms", "3 h"],
  ["2 bathrooms", "2 h"],
  ["Kitchen and living areas", "1½ h"],
  ["Inside the oven", "45 min"],
  ["At $55.00 an hour", "$399.00"],
];

const draftOneOff: FormCase = {
  key: "1",
  name: "Draft, a one-off with two options",
  trail: [
    { label: "Quotes", href: quotes },
    { label: "Maria Lopez", href: quotes },
    { label: "482 Halsey St", href: quotes },
    { label: "One-off clean", href: quotes },
    { label: "Draft quote" },
  ],
  title: "Draft quote for Maria Lopez",
  badge: <StatusBadge tone="neutral">Not sent yet</StatusBadge>,
  deletes: true,
  asideTitle: "Prices",
  prices: [
    {
      title: "Deep Clean",
      badge: <StatusBadge tone="success">Recommended</StatusBadge>,
      totalCents: 59119,
      taxCents: tax(59119),
      working: deepWorking,
    },
    {
      title: "Standard Clean",
      totalCents: 43441,
      taxCents: tax(43441),
      working: standardWorking,
    },
  ],
  summary: `Deep Clean ${formatMoney(59119)} · Standard Clean ${formatMoney(43441)}`,
  total: `${formatMoney(59119)} · ${formatMoney(43441)}`,
  status: "Saved",
  action: { label: "Send", srLabel: " to Maria Lopez", icon: Send },
  form: () => <OneOffForm />,
};

const planDays = [
  {
    title: "Mondays",
    date: "2026-11-30",
    time: "09:00",
    crew: 2,
    cents: 27222,
  },
  {
    title: "Wednesdays",
    date: "2026-12-02",
    time: "09:00",
    crew: 2,
    cents: 27222,
  },
  {
    title: "Fridays",
    date: "2026-12-04",
    time: "13:30",
    crew: 3,
    cents: 31578,
  },
];
const weekCents = planDays.reduce((sum, d) => sum + d.cents, 0);

const draftPlan: FormCase = {
  key: "2",
  name: "Draft, a plan with three weekdays (long)",
  trail: [
    { label: "Quotes", href: quotes },
    { label: "Christopher Abernathy-Whitfield", href: quotes },
    { label: "1250 Ocean Pkwy, Apt 6C", href: quotes },
    { label: "Cleaning plan", href: quotes },
    { label: "Draft quote" },
  ],
  title: "Draft quote for Christopher Abernathy-Whitfield",
  badge: <StatusBadge tone="neutral">Not sent yet</StatusBadge>,
  deletes: true,
  asideTitle: "Prices",
  prices: planDays.map((d) => ({
    title: `${d.title}: Standard Clean`,
    badge: <StatusBadge tone="success">10% off</StatusBadge>,
    totalCents: d.cents,
    taxCents: tax(d.cents),
    perClean: true,
    working: [
      ["2 bedrooms", "2 h"],
      ["1 bathroom", "1 h"],
      ["Kitchen and living areas", "1½ h"],
      ["One-off price", formatMoney(Math.round(d.cents / 0.9))],
      ["Plan discount (10%)", `−${formatMoney(Math.round(d.cents / 9))}`],
    ],
  })),
  week: { label: "3 cleans a week", cents: weekCents },
  summary: `3 cleans a week: ${formatMoney(weekCents)} a week`,
  total: `${formatMoney(weekCents)} a week`,
  status: "Saved",
  action: {
    label: "Send",
    srLabel: " to Christopher Abernathy-Whitfield",
    icon: Send,
  },
  form: () => <PlanForm />,
};

const newHome: FormCase = {
  key: "3",
  name: "New quote, a home",
  trail: [{ label: "Quotes", href: quotes }, { label: "New quote" }],
  title: "New quote",
  about: "For someone who phones. You'll go straight to the draft.",
  asideTitle: "What it comes to",
  prices: [
    {
      title: "Deep Clean",
      totalCents: 59119,
      taxCents: tax(59119),
      working: deepWorking,
    },
  ],
  summary: `Deep Clean ${formatMoney(59119)}`,
  total: formatMoney(59119),
  status: "",
  action: { label: "Draft a quote", icon: WandSparkles },
  form: () => <NewQuoteForm business={false} />,
};

const newBusiness: FormCase = {
  key: "4",
  name: "New quote, a business with no floor area yet",
  trail: [{ label: "Quotes", href: quotes }, { label: "New quote" }],
  title: "New quote",
  about: "For someone who phones. You'll go straight to the draft.",
  asideTitle: "What it comes to",
  prices: [],
  missing: "No price until the floor area is known.",
  total: "No price until the floor area is known.",
  status: "No price until the floor area is known.",
  action: { label: "Draft a quote", icon: WandSparkles },
  form: () => <NewQuoteForm business />,
};

const cases = [draftOneOff, draftPlan, newHome, newBusiness];

const layouts = [
  { key: "A", name: "today: a full-width bar at the foot" },
  { key: "B", name: "no bar: the header's button, a sticky header" },
  { key: "C", name: "a bar as wide as the form" },
] as const;
type Layout = (typeof layouts)[number]["key"];

// ---- the forms ----

function OneOffForm() {
  return (
    <>
      <FormPart
        title="What was asked"
        summary="Standard Clean · House, 3 bedrooms, 2 bathrooms · a dog · moderate"
      >
        <p>Asked on the website, Nov 19.</p>
      </FormPart>
      <FormPart title="Service">
        <Select
          label="Service"
          className="sm:max-w-xs"
          description="With a Deep Clean recommended for a first visit"
          defaultSelectedKey="standard"
        >
          <SelectItem id="standard">Standard Clean</SelectItem>
          <SelectItem id="deep">Deep Clean</SelectItem>
          <SelectItem id="move">Move-in / Move-out</SelectItem>
        </Select>
        <Checkbox>Set the Deep Clean price yourself</Checkbox>
        <Checkbox>Set the Standard Clean price yourself</Checkbox>
      </FormPart>
      <FormPart title="Extras" summary="Inside the oven">
        <Checkbox defaultSelected>Inside the oven</Checkbox>
      </FormPart>
      <FormPart
        title="Terms"
        summary="2 cleaners · 25% deposit · valid 14 days"
      >
        <NumberField label="Cleaners" defaultValue={2} />
      </FormPart>
      <FormPart title="Proposed time">
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker label="Date" defaultValue={parseDate("2026-11-27")} />
          <TimeField label="Start time" defaultValue={parseTime("09:00")} />
        </div>
        <Link href={quotes}>Pick from the schedule</Link>
        <p className="text-sm text-fg-muted">
          Room that day: 2 cleaners free from 9:00 AM to 3:00 PM.
        </p>
      </FormPart>
    </>
  );
}

function PlanForm() {
  return (
    <>
      <FormPart
        title="What was asked"
        summary="Standard Clean, 3 times a week · Apartment, 2 bedrooms, 1 bathroom · light"
      >
        <p>Asked on the phone, Nov 18.</p>
      </FormPart>
      <FormPart
        title="Plan"
        actions={
          <Button variant="text" size="sm" onPress={say("Add a weekday")}>
            <CalendarPlus aria-hidden size={16} />
            Add a weekday
          </Button>
        }
      >
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
          <Select label="Service" defaultSelectedKey="standard">
            <SelectItem id="standard">Standard Clean</SelectItem>
            <SelectItem id="deep">Deep Clean</SelectItem>
          </Select>
          <Select label="How often" defaultSelectedKey="weekly">
            <SelectItem id="weekly">Weekly</SelectItem>
            <SelectItem id="biweekly">Every two weeks</SelectItem>
            <SelectItem id="monthly">Monthly</SelectItem>
          </Select>
          <NumberField label="Plan discount (%)" defaultValue={10} />
        </div>
      </FormPart>
      {planDays.map((d) => (
        <FormPart
          key={d.title}
          title={d.title}
          actions={
            <Button variant="text" size="sm" onPress={say("Remove")}>
              <Trash2 aria-hidden size={16} />
              Remove
            </Button>
          }
        >
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
            <DatePicker label="First clean" defaultValue={parseDate(d.date)} />
            <TimeField label="Start time" defaultValue={parseTime(d.time)} />
            <NumberField label="Cleaners" defaultValue={d.crew} />
          </div>
          <Link href={quotes}>Pick from the schedule</Link>
          <p className="text-sm text-fg-muted">
            Room that day: {d.crew} cleaners free from{" "}
            {d.time === "09:00" ? "8:00 AM to 2:00 PM" : "12:00 PM to 6:00 PM"}.
          </p>
          <Checkbox>Set the one-off price yourself</Checkbox>
        </FormPart>
      ))}
      <FormPart title="Extras" summary="Inside the fridge, Interior windows">
        <Checkbox defaultSelected>Inside the fridge</Checkbox>
        <Checkbox defaultSelected>Interior windows</Checkbox>
      </FormPart>
      <FormPart title="Terms" summary="25% deposit · valid 14 days">
        <NumberField label="Deposit (%)" defaultValue={25} />
      </FormPart>
    </>
  );
}

function NewQuoteForm({ business }: { business: boolean }) {
  return (
    <>
      <FormPart
        title="Who's calling"
        actions={
          <Button variant="text" size="sm" onPress={say("Someone else")}>
            <Users aria-hidden size={16} />
            Someone else
          </Button>
        }
      >
        <div className="flex items-center gap-3">
          <Avatar src={null} />
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold text-fg">
              {business ? "Priya Raman" : "Maria Lopez"}
            </span>
            <span className="text-sm text-fg-muted">
              {business
                ? "priya@greenpointdental.com · (718) 555-0142"
                : "maria.lopez@example.com · (718) 555-0187"}
            </span>
          </div>
        </div>
      </FormPart>
      <FormPart title="What they need">
        <ChoiceTiles
          label="What can we help them with?"
          defaultValue={business ? "office" : "deep"}
        >
          {business ? (
            <>
              <ChoiceTile value="office" icon={Building2}>
                Office Cleaning
              </ChoiceTile>
              <ChoiceTile value="post" icon={Warehouse}>
                Post-construction
              </ChoiceTile>
            </>
          ) : (
            <>
              <ChoiceTile value="standard" icon={Sparkles}>
                Standard Clean
              </ChoiceTile>
              <ChoiceTile value="deep" icon={WandSparkles}>
                Deep Clean
              </ChoiceTile>
              <ChoiceTile value="move" icon={House}>
                Move-in / Move-out
              </ChoiceTile>
            </>
          )}
        </ChoiceTiles>
      </FormPart>
      <FormPart title="What and where">
        <ChoiceTiles
          label="What kind of place is it?"
          defaultValue={business ? "commercial" : "house"}
        >
          <ChoiceTile value="house" icon={House}>
            House
          </ChoiceTile>
          <ChoiceTile value="apartment" icon={Building2}>
            Apartment
          </ChoiceTile>
          <ChoiceTile value="commercial" icon={Store}>
            A business
          </ChoiceTile>
        </ChoiceTiles>
        <TextField
          label="Street address"
          defaultValue={business ? "210 Manhattan Ave" : "482 Halsey St"}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Unit (optional)" />
          <TextField
            label="ZIP code"
            defaultValue={business ? "11211" : "11233"}
          />
        </div>
      </FormPart>
      <FormPart title={business ? "Their business" : "Their home"}>
        {business ? (
          <>
            <TextField label="Business name" defaultValue="Greenpoint Dental" />
            <NumberField
              label="Floor area (sq ft)"
              description="Rough is fine: the site visit measures it."
            />
          </>
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
            <NumberField label="Bedrooms" defaultValue={3} />
            <NumberField label="Bathrooms" defaultValue={2} />
            <NumberField label="Floors" defaultValue={2} />
          </div>
        )}
        {!business && <Checkbox defaultSelected>They have pets</Checkbox>}
        <SegmentedControl
          label="How much cleaning does it need?"
          defaultValue="moderate"
          description="Lived in, with some build-up in the kitchen and bathrooms"
        >
          <Segment value="light">Light</Segment>
          <Segment value="moderate">Moderate</Segment>
          <Segment value="heavy">Heavy</Segment>
        </SegmentedControl>
        <ChipGroup
          label="Any extras?"
          description="Optional. The quote shows what each one costs."
          defaultValue={business ? [] : ["oven"]}
        >
          <Chip value="oven">Inside the oven</Chip>
          <Chip value="fridge">Inside the fridge</Chip>
          <Chip value="windows">Interior windows</Chip>
          <Chip value="cabinets">Inside cabinets</Chip>
          <Chip value="laundry">Laundry</Chip>
        </ChipGroup>
        <ChipGroup
          label="When would they like us to clean?"
          defaultValue={business ? ["evenings"] : ["weekdays"]}
        >
          <Chip value="weekdays">Weekdays</Chip>
          <Chip value="weekends">Weekends</Chip>
          <Chip value="evenings">Evenings</Chip>
        </ChipGroup>
        <TextField
          label="Anything else? (optional)"
          defaultValue={
            business
              ? "Two treatment rooms, a waiting room. After 6 PM only."
              : "Dog is friendly. Side door code is with Jen."
          }
        />
      </FormPart>
    </>
  );
}

// ---- the page's parts ----

function Prices({ c }: { c: FormCase }) {
  if (c.missing) return <p className="text-sm text-fg-muted">{c.missing}</p>;
  return (
    <div className="flex flex-col gap-5 [&>section+section]:border-t [&>section+section]:border-border [&>section+section]:pt-5">
      {c.prices.map((p) => (
        <section key={p.title} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Heading level={3}>{p.title}</Heading>
            {p.badge}
          </div>
          <PriceHead
            totalCents={p.totalCents}
            taxCents={p.taxCents}
            perClean={p.perClean}
          />
          <Fold label="How it's worked out">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              {p.working.map(([k, v]) => (
                <Fragment key={k}>
                  <dt className="text-fg-muted">{k}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </Fragment>
              ))}
            </dl>
          </Fold>
        </section>
      ))}
      {c.week && (
        <section className="flex items-baseline justify-between gap-3">
          <Heading level={3}>{c.week.label}</Heading>
          <span className="font-display text-2xl font-bold tracking-wide tabular-nums">
            {formatMoney(c.week.cents)}
            <span className="text-base font-normal text-fg-muted"> a week</span>
          </span>
        </section>
      )}
    </div>
  );
}

// the content's box: the same max width and padding as main's, from the
// left edge of the content (beside the rail from md, the sidebar from lg)
const besideNav = "md:left-16 lg:left-64";

// A: today's ActionFooter, beside the rail from md (PR 1's offset)
function FullBar({ c, desktop }: { c: FormCase; desktop: boolean }) {
  return (
    <>
      <div aria-hidden className={`h-20 ${desktop ? "" : "md:hidden"}`} />
      <div
        role="group"
        aria-label={c.action.label}
        className={`fixed inset-x-0 bottom-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface px-4 py-3 shadow-raised md:bottom-0 md:px-8 ${besideNav} ${desktop ? "" : "md:hidden"}`}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            {c.summary && (
              <span className="font-semibold tabular-nums">{c.summary}</span>
            )}
            <span role="status" className="text-sm text-fg-muted">
              {c.status}
            </span>
          </div>
          <MainButton c={c} />
        </div>
      </div>
    </>
  );
}

function MainButton({ c }: { c: FormCase }) {
  return (
    <Button isDisabled={c.disabled} onPress={say(c.action.label)}>
      {c.action.label}
      {c.action.srLabel && <span className="sr-only">{c.action.srLabel}</span>}
    </Button>
  );
}

// the main column and the aside from xl, as FormPage's Beside lays them
const columns =
  "grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]";

// C: a bar as wide as the form's column, from md: whether it's saved, and
// the button; the total is the aside's
function ColumnBar({ c }: { c: FormCase }) {
  return (
    <>
      <div aria-hidden className="hidden h-20 md:block" />
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden md:block ${besideNav}`}
      >
        <div className="mx-auto w-full max-w-5xl px-8">
          <div className={columns}>
            <div
              role="group"
              aria-label={c.action.label}
              className="pointer-events-auto flex items-center gap-3 rounded-t-lg border-x border-t border-border bg-surface px-4 py-3 shadow-raised"
            >
              <span
                role="status"
                className="min-w-0 flex-1 text-sm text-fg-muted"
              >
                {c.status}
              </span>
              <MainButton c={c} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// B: from md, the slim header that slides in once the title row's button
// has scrolled away: the title, the total where the aside isn't beside the
// form (below xl), whether it's saved, and the same split button
function StickyHead({
  c,
  shown,
  children,
}: {
  c: FormCase;
  shown: boolean;
  children: ReactNode;
}) {
  return (
    <div
      inert={!shown}
      aria-hidden={!shown}
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 hidden transition duration-200 md:block ${besideNav} print:hidden ${
        shown ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto w-full max-w-5xl px-8">
        <div className="pointer-events-auto flex items-center gap-4 rounded-b-lg border-x border-b border-border bg-surface px-4 py-2 shadow-raised">
          <p className="min-w-0 flex-1 truncate font-display text-xl font-bold tracking-wide uppercase">
            {c.title}
          </p>
          <div className="flex shrink-0 flex-col items-end">
            {c.total && (
              <span className="font-semibold tabular-nums xl:hidden">
                {c.total}
              </span>
            )}
            {/* New quote's line is its price's, said once */}
            {c.status !== c.total && (
              <span className="text-sm text-fg-muted">{c.status}</span>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Page({ c, layout }: { c: FormCase; layout: Layout }) {
  const [headRef, away] = useScrolledAway();
  const main: DAction = {
    label: c.action.label,
    icon: c.action.icon,
    isDisabled: c.disabled,
    onPress: say(c.action.label),
  };
  const more: DAction[] = c.deletes
    ? [
        {
          label: "Delete draft",
          icon: Trash2,
          danger: true,
          onPress: say("Delete draft"),
        },
      ]
    : [];
  const aside = (
    <Section title={c.asideTitle}>
      <Card>
        <Prices c={c} />
      </Card>
    </Section>
  );
  // the aside's sticky top clears B's sticky header
  const stickTop = layout === "B" ? "xl:top-20" : "xl:top-6";
  return (
    <div className="flex flex-col gap-6">
      {layout === "B" ? (
        // the header row: the title with its badge on the left, the page's
        // primary on the right, on the title's line (prototype-office-job's)
        <header className="flex flex-col gap-4">
          {/* oxlint-disable-next-line empire/screen-layout -- prototype */}
          <Breadcrumbs trail={c.trail} />
          <div className="flex items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex min-h-11 items-center">
                {/* oxlint-disable-next-line empire/screen-layout -- prototype */}
                <Heading level={1}>{c.title}</Heading>
              </span>
              {c.badge}
            </div>
            <span
              ref={headRef}
              className="flex h-11 shrink-0 items-center max-md:hidden"
            >
              <SplitButton main={main} more={more} />
            </span>
            {/* a phone keeps today's: Delete draft here, Send at the foot */}
            {c.deletes && (
              <span className="md:hidden">
                <Button variant="danger-text" onPress={say("Delete draft")}>
                  <Trash2 aria-hidden size={18} />
                  Delete draft
                </Button>
              </span>
            )}
          </div>
        </header>
      ) : (
        // oxlint-disable-next-line empire/screen-layout -- prototype
        <PageHeader
          trail={c.trail}
          title={c.title}
          status={c.badge}
          actions={
            c.deletes
              ? [
                  {
                    label: "Delete draft",
                    icon: Trash2,
                    danger: true,
                    onAction: say("Delete draft"),
                  },
                ]
              : []
          }
        />
      )}
      {c.about && (
        <div className="-mt-2">
          <Fold label="About this page">
            <p className="text-sm text-fg-muted">{c.about}</p>
          </Fold>
        </div>
      )}
      <div className={`items-start ${columns}`}>
        <div className={`xl:sticky ${stickTop} xl:col-start-2 xl:row-start-1`}>
          {aside}
        </div>
        <div className="flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-start-1">
          <Card>
            <div className="flex flex-col gap-5">{c.form()}</div>
          </Card>
          {c.end}
        </div>
      </div>
      {layout === "A" && <FullBar c={c} desktop />}
      {layout === "B" && (
        <>
          <FullBar c={c} desktop={false} />
          <StickyHead c={c} shown={away}>
            <SplitButton main={main} more={more} />
          </StickyHead>
        </>
      )}
      {layout === "C" && (
        <>
          <FullBar c={c} desktop={false} />
          <ColumnBar c={c} />
        </>
      )}
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

export function FormFootBarPrototype() {
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
      to: "/prototype/form-foot-bar",
      search: { case: c.key, layout, ...change },
      replace: true,
    });
  const nav: NavItem[] = navFor("en").office.map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === "Quotes",
    }),
  );
  // ?shot=1 hides the prototype's own labels, for the screenshots
  const shot = search.shot !== undefined;
  return (
    <LanguageProvider lang="en">
      <FrameWithRail area={areaLabels.en.office} nav={nav}>
        {!shot && (
          <p className="mb-4 text-sm text-fg-muted">
            Layout {layout} ({layouts.find((l) => l.key === layout)!.name}) ·
            case {c.key}: {c.name}
          </p>
        )}
        <Page key={`${c.key}${layout}`} c={c} layout={layout} />
        {!shot && (
          <>
            <PrototypeSwitcher
              variants={cases.map((x) => ({ key: x.key, name: x.name }))}
              current={c.key}
              onChange={(key) => go({ case: key })}
              className="top-16 md:top-auto md:bottom-24"
            />
            <PrototypeSwitcher
              variants={layouts.map((x) => ({ key: x.key, name: x.name }))}
              current={layout}
              onChange={(key) => go({ layout: key })}
              keys={["ArrowUp", "ArrowDown"]}
              className="top-28 md:top-auto md:bottom-40"
            />
          </>
        )}
      </FrameWithRail>
    </LanguageProvider>
  );
}
