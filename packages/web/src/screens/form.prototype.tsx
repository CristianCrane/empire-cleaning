// PROTOTYPE: throwaway. The Form page layout (#434), on made-up data, at
// /prototype/form?layout=A..C&case=1..7 (no sign-in), inside the real
// AppLayout and nav of each case's area (Welcome in its own frame, as it is
// now). ↑/↓ switch layouts, ←/→ switch cases. Lives only on prototype-form.
import { useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { parseDate, parseTime } from "@internationalized/date";
import {
  Archive,
  Building2,
  BrushCleaning,
  CalendarSearch,
  ChevronDown,
  CircleCheck,
  CreditCard,
  Home,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Truck,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { formats } from "@empire-cleaning/models";
import {
  ActionFooter,
  Actions,
  AppLayout,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  ChoiceTile,
  ChoiceTiles,
  type Crumb,
  DatePicker,
  Fact,
  Facts,
  Fold,
  Heading,
  List,
  ListItem,
  Logo,
  type NavItem,
  Notice,
  NumberField,
  PageHeader,
  type PageActions,
  Radio,
  RadioGroup,
  Section,
  Segment,
  SegmentedControl,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
  TimeField,
  showToast,
} from "@empire-cleaning/ui";
import { areaLabels, type AreaId } from "../session.ts";
import { navFor } from "./AreaLayout.tsx";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { linkTo } from "../links.ts";

// a crumb goes nowhere: the prototype is one page
const here = linkTo({ to: "/prototype/form" });

const { formatMoney } = formats.en;

const say = (title: string) => () => showToast({ title, tone: "info" });

// ---- the shape of a Form page, as every layout reads it ----

// one part of the form: a Section in A, a ruled part (open, or a summary
// row that opens) in B, a plain Section with no Card in C
type Part = {
  id: string;
  title: string;
  // above the title: where a stepped form is ("Step 1 of 4")
  kicker?: string;
  // what's set, in a line: B's folded row
  summary?: string;
  // a short line saying a rule the fields don't: only A keeps it
  rule?: string;
  // what this person came for: open in B's first view
  lead?: boolean;
  // a Section's text Buttons
  actions?: ReactNode;
  body: ReactNode;
};

// beside the fields from xl: what they come to (a price, a worked example)
// or what happens next
type Aside = {
  title: string;
  body: ReactNode;
  // in a line, for a bar at the foot
  summary?: string;
  // the price a Quote's form is written to reach: B and C lead with it
  // below xl. A Service's worked example follows the fields it works out
  leads?: boolean;
};

type Submit = {
  label: string;
  icon?: LucideIcon;
  // what a screen reader hears after the label ("to Grace Murphy")
  heard?: string;
  isDisabled?: boolean;
  // why it can't be pressed yet, in the bar's place for the save state
  why?: string;
  onPress: () => void;
  // a stepped form's way back
  back?: () => void;
};

type FormView = {
  trail?: Crumb[];
  title: string;
  status?: ReactNode;
  subtitle?: ReactNode;
  actions?: PageActions;
  // a help paragraph the page has now: A keeps it as one line, B folds it
  // under `fold`, C drops it
  intro?: { text: string; fold: string };
  notices?: {
    key: string;
    tone?: "info" | "warning" | "success" | "danger";
    text: ReactNode;
    action?: ReactNode;
  }[];
  parts: Part[];
  aside?: Aside;
  submit: Submit;
  // how it saves: `draft` saves as it changes whatever the layout (the
  // server prices it); `edit` an Office record the layout decides for;
  // `create` and `ask` make something with their button
  saves: "draft" | "edit" | "create" | "ask";
  // long enough that its button scrolls out of sight
  long: boolean;
  // kept after the form in every layout (a card's consent)
  foot?: ReactNode;
};

type FormCase = {
  key: string;
  name: string;
  // null: Welcome, signed in to no area, its own page with the logo
  area: AreaId | null;
  navLabel?: string;
  use: () => FormView;
};

// ---- made-up figures ----

const RATE = 5500;
const TAX = 0.08875;

type Extra = { key: string; name: string; hours: number };
const extras: Extra[] = [
  { key: "oven", name: "Inside the oven", hours: 0.75 },
  { key: "fridge", name: "Inside the fridge", hours: 0.5 },
  { key: "windows", name: "Inside windows", hours: 1 },
  { key: "cabinets", name: "Inside cabinets", hours: 1 },
  { key: "laundry", name: "Laundry", hours: 0.5 },
];

type Option = {
  key: string;
  name: string;
  recommended?: boolean;
  // the home's hours before extras
  rooms: [string, number][];
  conditionTimes: number;
};

const deep: Option = {
  key: "deep",
  name: "Deep Clean",
  recommended: true,
  rooms: [
    ["3 bedrooms", 2.7],
    ["2 bathrooms", 2.4],
    ["Kitchen and living", 1.5],
  ],
  conditionTimes: 1.25,
};
const standard: Option = {
  key: "standard",
  name: "Standard Clean",
  rooms: [
    ["3 bedrooms", 1.8],
    ["2 bathrooms", 1.6],
    ["Kitchen and living", 1],
  ],
  conditionTimes: 1.25,
};

const hoursText = (h: number) =>
  `${h.toLocaleString("en-US", { maximumFractionDigits: 2 })} h`;

type Override = { on: boolean; price: number; reason: string };

function priceOf(o: Option, chosen: string[], override: Override) {
  const home = o.rooms.reduce((sum, [, h]) => sum + h, 0);
  const homeTimes = Math.round(home * o.conditionTimes * 4) / 4;
  const added = extras.filter((e) => chosen.includes(e.key));
  const hours = homeTimes + added.reduce((sum, e) => sum + e.hours, 0);
  const suggested = Math.round(hours * RATE);
  const before = override.on ? Math.round(override.price * 100) : suggested;
  const tax = Math.round(before * TAX);
  return {
    home,
    homeTimes,
    added,
    hours,
    suggested,
    before,
    tax,
    total: before + tax,
    deposit: Math.round((before + tax) * 0.25),
  };
}

// ---- the save, as each layout has it ----

type SaveState = "saved" | "changed" | "saving";

function useSaving(auto: boolean) {
  const [state, setState] = useState<SaveState>("saved");
  const timer = useRef<number | undefined>(undefined);
  const changed = () => {
    if (!auto) return setState("changed");
    setState("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("saved"), 700);
  };
  const save = () => {
    setState("saving");
    window.setTimeout(() => {
      setState("saved");
      showToast({ title: "Saved", tone: "success" });
    }, 500);
  };
  const label = auto
    ? state === "saved"
      ? "Saved"
      : "Saving…"
    : state === "changed"
      ? "Not saved yet"
      : state === "saving"
        ? "Saving…"
        : "";
  return { state, changed, save, label };
}

// ---- case 1: the Office's Quote Draft, the busiest ----

const quoteTrail: Crumb[] = [
  { label: "Quotes", href: here },
  { label: "Grace Murphy", href: here },
  { label: "132 Lafayette Ave", href: here },
  { label: "Deep Clean", href: here },
  { label: "Draft quote" },
];

function AskedFacts() {
  return (
    <Facts>
      <Fact icon={Sparkles} label="Asked for" value="Deep Clean" />
      <Fact
        icon={Home}
        label="The home"
        value="3 bedrooms, 2 bathrooms, 2 floors"
        line="1,850 sq ft · a house"
      />
      <Fact icon={BrushCleaning} label="How it's looking" value="Heavy" />
      <Fact
        icon={Plus}
        label="Extras asked for"
        value="Inside the oven, inside the fridge"
      />
      <Fact
        icon={CalendarSearch}
        label="When suits them"
        value="Thursdays, mornings"
      />
      <Fact
        icon={Home}
        label="Their note"
        value="“The dog is home. Please keep the back gate shut.”"
        className="col-span-full"
      />
    </Facts>
  );
}

function FirstClean() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">
        Deep Clean on Thu Oct 22 ·{" "}
        <span className="font-semibold text-primary">See the job</span>
      </p>
      <List aria-label="Price changes at the first clean">
        <ListItem
          id="hour"
          title="1 more hour: $55.00"
          description="“The kitchen grease took longer”"
        />
        <ListItem
          id="oven"
          title="Inside the oven: $41.25"
          description="“Asked for on the day”"
        />
      </List>
    </div>
  );
}

function OptionPrice({
  option,
  chosen,
  override,
  onOverride,
}: {
  option: Option;
  chosen: string[];
  override: Override;
  onOverride: (o: Partial<Override>) => void;
}) {
  const p = priceOf(option, chosen, override);
  return (
    <section className="flex flex-col gap-3" aria-label={option.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={3} size={4}>
          {option.name}
        </Heading>
        {option.recommended && (
          <StatusBadge tone="success">Recommended</StatusBadge>
        )}
      </div>
      <div>
        <p className="font-display text-3xl font-bold tracking-wide tabular-nums">
          {formatMoney(p.total)}
        </p>
        <p className="text-sm text-fg-muted">
          With {formatMoney(p.tax)} tax · {hoursText(p.hours)} · deposit{" "}
          {formatMoney(p.deposit)}
        </p>
        {override.on && (
          <p className="text-sm text-fg-muted">
            <strong className="text-fg">Your price</strong>, from{" "}
            {formatMoney(p.suggested)}
          </p>
        )}
      </div>
      <Fold label="How it's worked out">
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          {option.rooms.map(([label, h]) => (
            <Row key={label} label={label} value={hoursText(h)} />
          ))}
          <Row label="The home" value={hoursText(p.home)} strong />
          <Row
            label={`Heavy: × ${option.conditionTimes}`}
            value={hoursText(p.homeTimes)}
          />
          {p.added.map((e) => (
            <Row key={e.key} label={e.name} value={hoursText(e.hours)} />
          ))}
          <Row label="Cleaning hours" value={hoursText(p.hours)} strong />
          <Row
            label={`At ${formatMoney(RATE)} an hour`}
            value={formatMoney(p.suggested)}
          />
          <Row
            label="Suggested price, before tax"
            value={formatMoney(p.suggested)}
            strong
          />
        </dl>
        {/* WEB-C: what was a sentence under the prices, a tap away */}
        <p className="pt-2 text-sm text-fg-muted">
          From your prices, version 2.
        </p>
      </Fold>
      <Checkbox isSelected={override.on} onChange={(on) => onOverride({ on })}>
        Set the price yourself
      </Checkbox>
      {override.on && (
        <div className="grid gap-3">
          <NumberField
            label="Price before tax"
            minValue={0}
            formatOptions={{ style: "currency", currency: "USD" }}
            value={override.price}
            onChange={(price) => onOverride({ price })}
          />
          <TextField
            label="Why this price"
            value={override.reason}
            onChange={(reason) => onOverride({ reason })}
          />
        </div>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <>
      <dt className={strong ? "font-semibold" : "text-fg-muted"}>{label}</dt>
      <dd
        className={`text-right tabular-nums ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </dd>
    </>
  );
}

function useDraft(): FormView {
  const [chosen, setChosen] = useState(["oven", "fridge"]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({
    deep: { on: false, price: 522.5, reason: "" },
    standard: {
      on: true,
      price: 380,
      reason: "The same as her last Standard Clean",
    },
  });
  const set = (key: string) => (o: Partial<Override>) =>
    setOverrides((all) => ({ ...all, [key]: { ...all[key]!, ...o } }));
  const [crew, setCrew] = useState(2);
  const options = [deep, standard];
  const prices = options.map((o) => priceOf(o, chosen, overrides[o.key]!));
  const chosenNames = extras
    .filter((e) => chosen.includes(e.key))
    .map((e) => e.name.toLowerCase());

  return {
    trail: quoteTrail,
    title: "Draft quote for Grace Murphy",
    status: <StatusBadge tone="neutral">Not sent yet</StatusBadge>,
    actions: [
      {
        label: "Delete draft",
        icon: Trash2,
        danger: true,
        onAction: say("Delete draft would ask first, in a dialog"),
      },
    ],
    notices: [
      {
        key: "sees",
        text: "Grace still sees the quote you sent on Nov 9 until you send this one.",
      },
    ],
    parts: [
      {
        id: "asked",
        title: "What was asked",
        summary: "Deep Clean · 3 bed, 2 bath · heavy · Thursday mornings",
        body: <AskedFacts />,
      },
      {
        id: "first",
        title: "First clean",
        summary: "The home was heavy · 2 price changes",
        body: <FirstClean />,
      },
      {
        id: "service",
        title: "Service",
        summary: "Deep Clean, with a Standard Clean",
        lead: true,
        body: (
          <Select
            label="Service"
            className="sm:max-w-xs"
            defaultSelectedKey="deep"
          >
            <SelectItem id="standard">Standard Clean</SelectItem>
            <SelectItem id="deep">Deep Clean</SelectItem>
            <SelectItem id="moveout">Move-out Clean</SelectItem>
          </Select>
        ),
      },
      {
        id: "extras",
        title: "Extras",
        summary: chosenNames.length
          ? chosenNames.join(", ").replace(/^./, (c) => c.toUpperCase())
          : "None",
        rule: "Each adds its hours to each service's price.",
        body: (
          <ChipGroup
            label="Extras"
            value={chosen}
            onChange={(v) => setChosen(v as string[])}
            className="[&>span:first-child]:sr-only"
          >
            {extras.map((e) => (
              <Chip key={e.key} value={e.key}>
                {e.name}
              </Chip>
            ))}
          </ChipGroup>
        ),
      },
      {
        id: "terms",
        title: "Terms",
        summary: `${crew} cleaners · 25% deposit · open 14 days`,
        body: (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
            <NumberField
              label="Cleaners"
              minValue={1}
              maxValue={10}
              value={crew}
              onChange={setCrew}
            />
            <NumberField
              label="Deposit (%)"
              minValue={0}
              maxValue={100}
              defaultValue={25}
            />
            <NumberField
              label="Open for (days)"
              minValue={1}
              maxValue={90}
              defaultValue={14}
            />
          </div>
        ),
      },
      {
        id: "time",
        title: "Proposed time",
        summary: "Thu Nov 19, 9:00 AM",
        lead: true,
        // WEB-D: no line under the title; a time too soon says so as the
        // field's error, when it is
        actions: (
          <Button variant="text" onPress={say("The Schedule would open here")}>
            <CalendarSearch aria-hidden size={18} />
            Pick from the schedule
          </Button>
        ),
        body: (
          <div className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker label="Date" defaultValue={parseDate("2026-11-19")} />
              <TimeField label="Start time" defaultValue={parseTime("09:00")} />
            </div>
            <p className="flex items-center gap-2 text-sm text-success-strong">
              <CircleCheck aria-hidden size={16} />
              Room for {crew} cleaners then
            </p>
          </div>
        ),
      },
    ],
    aside: {
      title: "Prices",
      leads: true,
      summary: options
        .map((o, i) => `${o.name} ${formatMoney(prices[i]!.total)}`)
        .join(" · "),
      body: (
        <div className="flex flex-col gap-5 [&>section+section]:border-t [&>section+section]:border-border [&>section+section]:pt-5">
          {options.map((o) => (
            <OptionPrice
              key={o.key}
              option={o}
              chosen={chosen}
              override={overrides[o.key]!}
              onOverride={set(o.key)}
            />
          ))}
        </div>
      ),
    },
    submit: {
      label: "Send",
      icon: Send,
      heard: " to Grace Murphy",
      onPress: say("Sent to grace.murphy@example.com"),
    },
    saves: "draft",
    long: true,
  };
}

// ---- case 2: the Office's New quote, nothing chosen yet ----

const callers = [
  { id: "1", name: "Maria Lopez", line: "maria.lopez@example.com · 2 homes" },
  { id: "2", name: "Mark Lowe", line: "(718) 555-0143 · 1 home" },
  { id: "3", name: "Marisol Ortega", line: "no email · 1 home" },
];

function useNewQuote(): FormView {
  const [q, setQ] = useState("");
  const [who, setWho] = useState<(typeof callers)[number] | null>(null);
  const [service, setService] = useState<string | null>(null);
  const found = q.trim()
    ? callers.filter((c) =>
        c.name.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : [];
  const price =
    service &&
    priceOf(service === "deep" ? deep : standard, [], {
      on: false,
      price: 0,
      reason: "",
    });

  const whoPart: Part = who
    ? {
        id: "who",
        title: "Who's calling",
        summary: who.name,
        lead: true,
        actions: (
          <Button variant="text" onPress={() => setWho(null)}>
            <Search aria-hidden size={18} />
            Someone else
          </Button>
        ),
        body: (
          <p>
            <strong>{who.name}</strong>
            <br />
            <span className="text-sm text-fg-muted">{who.line}</span>
          </p>
        ),
      }
    : {
        id: "who",
        title: "Who's calling",
        lead: true,
        actions: (
          <Button
            variant="text"
            onPress={say("A new client's fields would open here")}
          >
            <UserPlus aria-hidden size={18} />
            New client
          </Button>
        ),
        body: (
          <div className="flex flex-col gap-3">
            <TextField
              label="Find a client"
              type="search"
              value={q}
              onChange={setQ}
              placeholder="Name, email or phone"
            />
            {found.length > 0 && (
              <List
                aria-label="Clients found"
                onAction={(id) =>
                  setWho(callers.find((c) => c.id === String(id)) ?? null)
                }
              >
                {found.map((c) => (
                  <ListItem
                    key={c.id}
                    id={c.id}
                    title={c.name}
                    description={c.line}
                  />
                ))}
              </List>
            )}
          </div>
        ),
      };

  return {
    trail: [{ label: "Quotes", href: here }, { label: "New quote" }],
    title: "New quote",
    // what the page has now: a line of help under the title
    intro: {
      text: "For someone who phones. You'll go straight to the draft.",
      fold: "About this page",
    },
    parts: [
      whoPart,
      // no step before it applies: the home and what they need wait for who
      ...(who
        ? [
            {
              id: "home",
              title: "Which home",
              summary: "14 Bergen St",
              lead: true,
              body: (
                <RadioGroup label="Home" defaultValue="bergen">
                  <Radio value="bergen">14 Bergen St, Brooklyn</Radio>
                  <Radio value="park">301 Park Pl, Brooklyn</Radio>
                  <Radio value="new">A new home</Radio>
                </RadioGroup>
              ),
            },
            {
              id: "need",
              title: "What they need",
              summary: service ?? "Not chosen yet",
              lead: true,
              body: (
                <ChoiceTiles
                  label="Service"
                  value={service}
                  onChange={setService}
                >
                  <ChoiceTile value="standard" icon={Sparkles}>
                    Standard Clean
                  </ChoiceTile>
                  <ChoiceTile value="deep" icon={BrushCleaning}>
                    Deep Clean
                  </ChoiceTile>
                  <ChoiceTile value="moveout" icon={Truck}>
                    Move-out Clean
                  </ChoiceTile>
                </ChoiceTiles>
              ),
            },
            {
              id: "looking",
              title: "How it's looking",
              summary: "Moderate · no extras",
              body: (
                <div className="flex flex-col gap-4">
                  <SegmentedControl label="Condition" defaultValue="moderate">
                    <Segment value="light">Light</Segment>
                    <Segment value="moderate">Moderate</Segment>
                    <Segment value="heavy">Heavy</Segment>
                  </SegmentedControl>
                  <ChipGroup label="Extras">
                    {extras.map((e) => (
                      <Chip key={e.key} value={e.key}>
                        {e.name}
                      </Chip>
                    ))}
                  </ChipGroup>
                </div>
              ),
            },
          ]
        : []),
    ],
    aside: who
      ? {
          title: "What it comes to",
          leads: true,
          summary: price ? formatMoney(price.total) : undefined,
          body: price ? (
            <div>
              <p className="font-display text-3xl font-bold tabular-nums">
                {formatMoney(price.total)}
              </p>
              <p className="text-sm text-fg-muted">
                With {formatMoney(price.tax)} tax · {hoursText(price.hours)}
              </p>
            </div>
          ) : (
            <p className="text-fg-muted">Pick what they need to see it.</p>
          ),
        }
      : undefined,
    submit: {
      label: "Write the quote",
      icon: Send,
      isDisabled: !who || !service,
      why: !who
        ? "Find who's calling first"
        : !service
          ? "Pick what they need"
          : undefined,
      onPress: say("The Draft would open"),
    },
    saves: "create",
    long: true,
  };
}

// ---- cases 3 and 4: the Office's Service, and a new one ----

function ExampleQuote({ empty = false }: { empty?: boolean }) {
  if (empty)
    return (
      <p className="text-fg-muted">
        Fill in the hours and the rate to see a quote.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">
        A house: 3 bedrooms, 2 bathrooms, moderate
      </p>
      <p className="font-display text-3xl font-bold tabular-nums">
        {formatMoney(56887)}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <Row label="3 bedrooms × 1.5 h" value="4.5 h" />
        <Row label="2 bathrooms × 1.25 h" value="2.5 h" />
        <Row label="Kitchen and living" value="2.5 h" />
        <Row label="Cleaning hours" value="9.5 h" strong />
        <Row label="At $55.00 an hour" value="$522.50" />
        <Row label="Tax, 8.875%" value="$46.37" />
        <Row label="The quote" value="$568.87" strong />
      </dl>
    </div>
  );
}

const serviceTrail = (name: string): Crumb[] => [
  { label: "Services", href: here },
  { label: name },
];

const namePart = (fresh: boolean): Part => ({
  id: "what",
  title: "What it is",
  summary: fresh
    ? undefined
    : "Deep Clean · homes and businesses · in Spanish too",
  lead: fresh,
  body: (
    <div className="flex flex-col gap-4">
      <TextField label="Name" defaultValue={fresh ? "" : "Deep Clean"} />
      {!fresh && (
        <>
          <TextField label="Name in Spanish" defaultValue="Limpieza profunda" />
          <TextField
            label="Description"
            multiline
            defaultValue="Top to bottom: inside the cupboards, behind what moves, the grout."
          />
        </>
      )}
      <ChipGroup
        label="Offered for"
        defaultValue={fresh ? ["homes"] : ["homes", "business"]}
      >
        <Chip value="homes">Homes</Chip>
        <Chip value="business">Businesses</Chip>
      </ChipGroup>
      {fresh && (
        <Button
          variant="text"
          className="-ms-3 self-start"
          onPress={say("The Spanish name and a description would open here")}
        >
          <Plus aria-hidden size={18} />
          Add a description, or Spanish
        </Button>
      )}
    </div>
  ),
});

const hoursPart = (fresh: boolean): Part => ({
  id: "hours",
  title: "How long it takes",
  summary: "By rooms: 1.5 h a bedroom, 1.25 h a bathroom, 2.5 h the rest",
  rule: "Cleaning hours, however many cleaners share them.",
  lead: true,
  body: (
    <div className="flex flex-col gap-4">
      <SegmentedControl label="Worked out" defaultValue="rooms">
        <Segment value="rooms">By rooms</Segment>
        <Segment value="area">By area</Segment>
      </SegmentedControl>
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["A bedroom (hours)", 1.5],
            ["A bathroom (hours)", 1.25],
            ["The rest (hours)", 2.5],
          ] as const
        ).map(([label, v]) => (
          <NumberField
            key={label}
            label={label}
            minValue={0}
            step={0.05}
            formatOptions={{ maximumFractionDigits: 2 }}
            defaultValue={fresh ? Number.NaN : v}
          />
        ))}
      </div>
      <Checkbox defaultSelected>Takes longer the dirtier it is</Checkbox>
    </div>
  ),
});

const pricePart = (fresh: boolean): Part => ({
  id: "price",
  title: "Price",
  summary: "$55.00 an hour, at least $180.00",
  rule: "Before tax. Extras are charged at the same rate.",
  lead: true,
  body: (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
      <NumberField
        label="Hourly rate"
        minValue={0}
        formatOptions={{ style: "currency", currency: "USD" }}
        defaultValue={fresh ? Number.NaN : 55}
      />
      <NumberField
        label="Minimum price"
        minValue={0}
        formatOptions={{ style: "currency", currency: "USD" }}
        defaultValue={fresh ? Number.NaN : 180}
      />
    </div>
  ),
});

const bookingPart: Part = {
  id: "booking",
  title: "Booking",
  summary: "On a plan · no site visit · recommends nothing else",
  body: (
    <div className="flex flex-col gap-3">
      <Checkbox defaultSelected>Can be on a cleaning plan</Checkbox>
      <Checkbox>Needs a site visit before a quote is sent</Checkbox>
      <Select
        label="For a first visit, recommend"
        className="sm:max-w-xs"
        defaultSelectedKey="none"
      >
        <SelectItem id="none">Nothing else</SelectItem>
        <SelectItem id="standard">Standard Clean</SelectItem>
      </Select>
    </div>
  ),
};

const taxPart: Part = {
  id: "tax",
  title: "Sales tax",
  summary: "8.875% one-off · 8.875% on a plan",
  rule: "Added to the price: clients see prices with tax.",
  lead: true,
  body: (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField
        label="One-off jobs (%)"
        minValue={0}
        step={0.125}
        formatOptions={{ maximumFractionDigits: 3 }}
        defaultValue={8.875}
      />
      <NumberField
        label="Cleaning plan jobs (%)"
        minValue={0}
        step={0.125}
        formatOptions={{ maximumFractionDigits: 3 }}
        defaultValue={8.875}
      />
    </div>
  ),
};

function useService(): FormView {
  return {
    trail: serviceTrail("Deep Clean"),
    title: "Deep Clean",
    subtitle: "Version 7, saved by Jennifer on Nov 10",
    actions: [
      {
        label: "Retire",
        icon: Archive,
        danger: true,
        onAction: say("Retire would ask first, in a dialog"),
      },
    ],
    parts: [
      namePart(false),
      hoursPart(false),
      pricePart(false),
      bookingPart,
      taxPart,
    ],
    aside: {
      title: "Example quote",
      summary: "Example: $568.87",
      body: <ExampleQuote />,
    },
    submit: { label: "Save", onPress: () => {} },
    saves: "edit",
    long: true,
  };
}

function useNewService(): FormView {
  return {
    trail: serviceTrail("New service"),
    title: "New service",
    parts: [namePart(true), hoursPart(true), pricePart(true)],
    aside: {
      title: "Example quote",
      body: <ExampleQuote empty />,
    },
    submit: {
      label: "Add service",
      icon: Plus,
      onPress: say(
        "Added. Booking and sales tax start as your other services'",
      ),
    },
    saves: "create",
    long: false,
  };
}

// ---- cases 5 and 7: a Client's Quote Request in steps, and Welcome's ----

type Step = { title: string; summary?: string; body: ReactNode };

function useSteps(steps: Step[], done: string) {
  const [at, setAt] = useState(0);
  const last = at === steps.length - 1;
  const step = steps[at]!;
  const part: Part = {
    id: `step-${at}`,
    kicker: `Step ${at + 1} of ${steps.length}`,
    title: step.title,
    lead: true,
    body: step.body,
  };
  const submit: Submit = {
    label: last ? "Send" : "Next",
    icon: last ? Send : undefined,
    onPress: last ? say(done) : () => setAt(at + 1),
    back: at > 0 ? () => setAt(at - 1) : undefined,
  };
  return { part, submit };
}

const serviceStep: Step = {
  title: "What do you need?",
  body: (
    <ChoiceTiles label="Service" defaultValue="standard">
      <ChoiceTile value="standard" icon={Sparkles}>
        Standard Clean
      </ChoiceTile>
      <ChoiceTile value="deep" icon={BrushCleaning}>
        Deep Clean
      </ChoiceTile>
      <ChoiceTile value="moveout" icon={Truck}>
        Move-out Clean
      </ChoiceTile>
      <ChoiceTile value="office" icon={Building2}>
        An office
      </ChoiceTile>
    </ChoiceTiles>
  ),
};

function NoteField() {
  const [open, setOpen] = useState(false);
  return open ? (
    <TextField label="Anything we should know?" multiline autoFocus />
  ) : (
    <Button
      variant="text"
      className="-ms-3 self-start"
      onPress={() => setOpen(true)}
    >
      <Plus aria-hidden size={18} />
      Add a note
    </Button>
  );
}

const whenStep: Step = {
  title: "When suits you?",
  body: (
    <div className="flex flex-col gap-4">
      <ChipGroup label="Days" defaultValue={["thu"]}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <Chip key={d} value={d.toLowerCase()}>
            {d}
          </Chip>
        ))}
      </ChipGroup>
      <SegmentedControl label="Start" defaultValue="morning">
        <Segment value="morning">Morning</Segment>
        <Segment value="afternoon">Afternoon</Segment>
      </SegmentedControl>
      <NoteField />
    </div>
  ),
};

const lookingStep: Step = {
  title: "How is it looking?",
  body: (
    <div className="flex flex-col gap-4">
      <SegmentedControl label="Condition" defaultValue="moderate">
        <Segment value="light">Light</Segment>
        <Segment value="moderate">Moderate</Segment>
        <Segment value="heavy">Heavy</Segment>
      </SegmentedControl>
      <ChipGroup label="Extras">
        {extras.map((e) => (
          <Chip key={e.key} value={e.key}>
            {e.name}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  ),
};

function useRequest(): FormView {
  const { part, submit } = useSteps(
    [
      serviceStep,
      {
        title: "Which home?",
        body: (
          <RadioGroup label="Home" defaultValue="oak">
            <Radio value="oak">22 Oak St, Brooklyn</Radio>
            <Radio value="elm">9 Elm Ct, Queens</Radio>
            <Radio value="new">A new home</Radio>
          </RadioGroup>
        ),
      },
      lookingStep,
      whenStep,
    ],
    "We've got it. We'll email your quote.",
  );
  return {
    trail: [{ label: "Home", href: here }, { label: "Request a quote" }],
    title: "Request a quote",
    notices: [
      {
        key: "open",
        text: (
          <p>
            We're working on your quote for{" "}
            <span className="font-semibold underline">22 Oak St</span>.
          </p>
        ),
      },
    ],
    parts: [part],
    submit,
    saves: "ask",
    long: false,
  };
}

function useWelcome(): FormView {
  const { part, submit } = useSteps(
    [
      serviceStep,
      {
        title: "Where is it?",
        body: (
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <TextField label="Street" />
            <TextField label="Apt or unit" />
            <TextField label="ZIP code" />
          </div>
        ),
      },
      lookingStep,
      {
        title: "Your details",
        body: (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Full name" />
            <TextField label="Phone" type="tel" />
          </div>
        ),
      },
    ],
    "We've got it. We'll email your quote.",
  );
  return {
    title: "Welcome",
    subtitle: "Ask us for a quote and we'll email it to you.",
    parts: [part],
    aside: {
      title: "What happens next",
      body: (
        <ol className="flex flex-col gap-3 text-sm">
          {[
            [
              "You tell us about your home",
              "The rooms, how it's looking and when suits you.",
            ],
            ["We email you a quote", "With the clean we'd recommend."],
            [
              "You choose and book",
              "Pay the deposit here and your clean is booked.",
            ],
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                {i + 1}
              </span>
              <span>
                <strong>{title}</strong>
                <br />
                <span className="text-fg-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      ),
    },
    submit,
    saves: "ask",
    long: false,
  };
}

// ---- case 6: a Client's card ----

function CardFields() {
  // the payment provider's form, drawn as ours: a stand-in
  return (
    <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
      <TextField label="Card number" placeholder="1234 1234 1234 1234" />
      <TextField label="Expiry" placeholder="MM / YY" />
      <TextField label="CVC" placeholder="123" />
    </div>
  );
}

function useCard(): FormView {
  return {
    trail: [{ label: "Payments", href: here }, { label: "Your card" }],
    title: "Your card",
    intro: {
      text: "We take a deposit from this card when you book. Each clean is charged to it when it's done, or goes on your weekly bill if you have one. If a payment didn't go through, saving a card here tries it again.",
      fold: "How your card is used",
    },
    notices: [
      {
        key: "failed",
        tone: "danger",
        text: (
          <p>
            <strong>Payment needed.</strong> $148.00 for your Thu Nov 12 clean
            didn't go through on your Visa ending 4242. Try it again, or save a
            different card below.
          </p>
        ),
        action: (
          <Button variant="danger-text" onPress={say("Trying it again…")}>
            Try this card again
          </Button>
        ),
      },
    ],
    parts: [
      {
        id: "card",
        title: "A different card",
        lead: true,
        body: <CardFields />,
      },
    ],
    // the consent is said before saving, in every layout
    foot: (
      <p className="text-sm text-fg-muted">
        By saving your card, you agree that Empire Cleaning can charge this card
        for the balance when each clean is done, the deposit amount for a late
        cancellation or if we couldn't get in, and any weekly bill set to be
        charged to it.
      </p>
    ),
    submit: {
      label: "Save card",
      icon: CreditCard,
      onPress: say("Card saved. Your $148.00 payment was taken."),
    },
    saves: "ask",
    long: false,
  };
}

// ---- the cases ----

const cases: FormCase[] = [
  {
    key: "1",
    name: "Office · Draft quote, busiest",
    area: "office",
    navLabel: "Quotes",
    use: useDraft,
  },
  {
    key: "2",
    name: "Office · New quote, empty",
    area: "office",
    navLabel: "Quotes",
    use: useNewQuote,
  },
  {
    key: "3",
    name: "Office · Service, prices and tax",
    area: "office",
    navLabel: "Services",
    use: useService,
  },
  {
    key: "4",
    name: "Office · New service, short",
    area: "office",
    navLabel: "Services",
    use: useNewService,
  },
  {
    key: "5",
    name: "Client · Request a quote",
    area: "portal",
    navLabel: "Home",
    use: useRequest,
  },
  {
    key: "6",
    name: "Client · Your card",
    area: "portal",
    navLabel: "Payments",
    use: useCard,
  },
  {
    key: "7",
    name: "Welcome, signed in, first time",
    area: null,
    use: useWelcome,
  },
];

// ---- the layouts ----

const layouts = [
  { key: "A", name: "Every part in view, a bar on every form" },
  { key: "B", name: "One card, parts fold to a line; a bar on long forms" },
  { key: "C", name: "The answer leads, with its button; no bar" },
] as const;

type LayoutKey = (typeof layouts)[number]["key"];

const notes: Record<LayoutKey, { idea: string; shows: string; hides: string }> =
  {
    A: {
      idea: "The rules as they stand, tidied. Each part a titled Section around a Card. The price (or worked example) in a sticky aside from xl, after the fields below that. An ActionFooter on every form: what it sums up and the save state on its left, the button on its right (a stepped form's Back and Next too). Office forms Save when pressed; the Draft saves as it changes. A one-line rule under a Section's title where the fields don't say it; a page's help paragraph kept as one line.",
      shows:
        "Every part, open, in order. The Draft: what was asked, the first clean, Service, Extras, Terms, Proposed time, then Prices; its total and Send in the bar.",
      hides:
        "How a price is worked out (a Fold, with the price list's version, WEB-C). Setting a price yourself (a checkbox). Nothing else.",
    },
    B: {
      idea: 'Peace first. The whole form in one Card. What the person came for is open; every other part is one line saying what\'s set ("Terms · 2 cleaners · 25% deposit · open 14 days"), a tap opens it in place. No help text at all. Office forms save as they change ("Saved"). A bar only on a long form; a short one ends with its button in the card.',
      shows:
        "The Draft below xl: Prices first, then Service and Proposed time open; the rest as lines. From xl, Prices in the aside. The Service: hours, price and tax open.",
      hides:
        "What was asked, the first clean, Extras and Terms: each one line, a tap away. How it's worked out: a Fold. A page's help paragraph: a Fold (\"How your card is used\").",
    },
    C: {
      idea: "The answer leads. The price (or example) and the page's main button sit together in one card: first on the page below xl, a sticky aside from xl. The fields below it in plain titled parts, no Cards, no help text. Nothing fixed at the foot. A form with no price ends with its button. Office forms Save when pressed; the Draft saves as it changes.",
      shows:
        "The Draft: the two prices and Send at the top, then every part open, plain. A form with nothing to sum up: the fields and the button after them.",
      hides:
        "How it's worked out: a Fold. A page's help paragraph: gone. On a phone, the price and Send scroll away while you edit below them.",
    },
  };

// what this layout's first view shows and hides: the prototype's, not the
// design's (dashed, dismissible)
function LayoutNote({ layout }: { layout: LayoutKey }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const note = notes[layout];
  return (
    <div className="mb-6 flex items-start gap-3 rounded-md border-2 border-dashed border-border p-3 text-sm">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p>
          <strong>Layout {layout}.</strong> {note.idea}
        </p>
        <p>
          <strong>First view:</strong> {note.shows}
        </p>
        <p>
          <strong>Behind a tap:</strong> {note.hides}
        </p>
      </div>
      <Button
        variant="quiet"
        size="icon"
        aria-label="Hide the note"
        onPress={() => setOpen(false)}
      >
        <X aria-hidden size={18} />
      </Button>
    </div>
  );
}

// ---- what every layout shares ----

function Header({ v, subtitle = true }: { v: FormView; subtitle?: boolean }) {
  return (
    <PageHeader
      trail={v.trail}
      title={v.title}
      status={v.status}
      subtitle={subtitle ? v.subtitle : undefined}
      actions={v.actions}
    />
  );
}

function Notices({ v }: { v: FormView }) {
  if (!v.notices?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {v.notices.map((n) => (
        <Notice key={n.key} tone={n.tone} action={n.action}>
          {n.text}
        </Notice>
      ))}
    </div>
  );
}

function SubmitButton({
  s,
  isPending,
  className,
}: {
  s: Submit;
  isPending?: boolean;
  className?: string;
}) {
  const Icon = s.icon;
  return (
    <Button
      isDisabled={s.isDisabled}
      isPending={isPending}
      onPress={s.onPress}
      className={className}
    >
      {Icon && <Icon aria-hidden size={18} />}
      {s.label}
      {s.heard && <span className="sr-only">{s.heard}</span>}
    </Button>
  );
}

function BackButton({ s }: { s: Submit }) {
  return s.back ? (
    <Button variant="secondary" onPress={s.back}>
      Back
    </Button>
  ) : null;
}

const asideGrid =
  "grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]";

function PartTitle({ p }: { p: Part }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {p.kicker && <p className="text-sm text-fg-muted">{p.kicker}</p>}
      <Heading level={2} size={3}>
        {p.title}
      </Heading>
    </div>
  );
}

// ---- A: every part in view, a bar on every form ----

function LayoutA({ v }: { v: FormView }) {
  const auto = v.saves === "draft";
  const s = useSaving(auto);
  const state = v.submit.isDisabled ? v.submit.why : s.label;
  return (
    <div className="flex flex-col gap-6">
      <Header v={v} />
      {v.intro && <p className="-mt-3 text-fg-muted">{v.intro.text}</p>}
      <Notices v={v} />
      <div className={asideGrid}>
        <div className="flex min-w-0 flex-col gap-6" onChange={s.changed}>
          {v.parts.map((p) => (
            <Section
              key={p.id}
              title={p.kicker ? `${p.kicker}: ${p.title}` : p.title}
              description={p.rule}
              actions={p.actions}
            >
              <Card>{p.body}</Card>
            </Section>
          ))}
          {v.foot}
        </div>
        {v.aside && (
          <div className="xl:sticky xl:top-8" onChange={s.changed}>
            <Section title={v.aside.title}>
              <Card>{v.aside.body}</Card>
            </Section>
          </div>
        )}
      </div>
      <ActionFooter aria-label={v.submit.label}>
        <div className="flex min-w-0 flex-1 flex-col">
          {v.aside?.summary && (
            <span className="font-semibold tabular-nums">
              {v.aside.summary}
            </span>
          )}
          <span role="status" className="text-sm text-fg-muted">
            {state}
          </span>
        </div>
        <BackButton s={v.submit} />
        {v.saves === "edit" ? (
          <SubmitButton
            s={{
              ...v.submit,
              isDisabled: s.state !== "changed",
              onPress: s.save,
            }}
            isPending={s.state === "saving"}
          />
        ) : (
          <SubmitButton s={v.submit} />
        )}
      </ActionFooter>
    </div>
  );
}

// ---- B: one card, parts fold to a line; a bar on long forms ----

function FoldedPart({ p, children }: { p: Part; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section
      aria-label={p.title}
      className="flex flex-col gap-4 border-t border-border pt-4 first:border-t-0 first:pt-0"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-left outline-offset-2 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
          <span className="font-semibold text-fg sm:w-40 sm:shrink-0">
            {p.title}
          </span>
          {!open && p.summary && (
            <span className="text-fg-muted [overflow-wrap:anywhere]">
              {p.summary}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          size={20}
          className={`shrink-0 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          {p.actions && <div className="-ms-3 -mt-2">{p.actions}</div>}
          {children}
        </>
      )}
    </section>
  );
}

function OpenPart({ p }: { p: Part }) {
  return (
    <section
      aria-label={p.title}
      className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0"
    >
      <header className="flex flex-wrap items-start gap-3">
        <PartTitle p={p} />
        {p.actions && (
          <div className="-ms-3 flex h-7 items-center">{p.actions}</div>
        )}
      </header>
      {p.body}
    </section>
  );
}

function LayoutB({ v }: { v: FormView }) {
  const auto = v.saves === "draft" || v.saves === "edit";
  const s = useSaving(auto);
  const leads = v.aside?.leads;
  const state = v.submit.isDisabled ? v.submit.why : s.label;
  // a new client's form waits for who's calling: no bar before there's a form
  const bar = v.long && (v.parts.length > 1 || !v.submit.isDisabled);
  const button =
    v.saves === "edit" ? null : (
      <>
        <BackButton s={v.submit} />
        <SubmitButton s={v.submit} />
      </>
    );
  return (
    <div className="flex flex-col gap-6">
      <Header v={v} />
      <Notices v={v} />
      {v.intro && (
        <div className="-mt-2">
          <Fold label={v.intro.fold}>
            <p className="text-sm text-fg-muted">{v.intro.text}</p>
          </Fold>
        </div>
      )}
      <div className={asideGrid}>
        <div className="flex min-w-0 flex-col gap-6" onChange={s.changed}>
          <Card>
            {v.aside && leads && (
              <section
                aria-label={v.aside.title}
                className="flex flex-col gap-4 border-b border-border pb-5 xl:hidden"
              >
                <Heading level={2} size={3}>
                  {v.aside.title}
                </Heading>
                {v.aside.body}
              </section>
            )}
            <div className="flex flex-col gap-5">
              {v.parts.map((p) =>
                p.lead || !p.summary ? (
                  <OpenPart key={p.id} p={p} />
                ) : (
                  <FoldedPart key={p.id} p={p}>
                    {p.body}
                  </FoldedPart>
                ),
              )}
            </div>
            {!bar && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                {v.foot}
                <Actions>{button}</Actions>
              </div>
            )}
          </Card>
          {bar && v.foot}
        </div>
        {v.aside && (
          <div
            className={
              leads
                ? "hidden xl:sticky xl:top-8 xl:block"
                : "xl:sticky xl:top-8"
            }
            onChange={s.changed}
          >
            <Section title={v.aside.title}>
              <Card>{v.aside.body}</Card>
            </Section>
          </div>
        )}
      </div>
      {bar && (
        <ActionFooter aria-label={v.submit.label}>
          <div className="flex min-w-0 flex-1 flex-col">
            {v.aside?.summary && (
              <span className="font-semibold tabular-nums">
                {v.aside.summary}
              </span>
            )}
            <span role="status" className="text-sm text-fg-muted">
              {state}
            </span>
          </div>
          {button}
        </ActionFooter>
      )}
    </div>
  );
}

// ---- C: the answer leads, with its button; no bar ----

function LayoutC({ v }: { v: FormView }) {
  const auto = v.saves === "draft";
  const s = useSaving(auto);
  const state = v.submit.isDisabled ? v.submit.why : s.label;
  const button =
    v.saves === "edit" ? (
      <SubmitButton
        s={{ ...v.submit, isDisabled: s.state !== "changed", onPress: s.save }}
        isPending={s.state === "saving"}
        className="w-full"
      />
    ) : (
      <SubmitButton s={v.submit} className="w-full sm:w-auto" />
    );
  // what the fields come to, with the button: it leads only where it's a
  // price this form is written to reach, or the button has nowhere else
  const answer = v.aside && (v.aside.leads || v.saves === "edit");
  return (
    <div className="flex flex-col gap-6">
      <Header v={v} />
      <Notices v={v} />
      <div className={asideGrid}>
        {answer && v.aside && (
          <div className="xl:sticky xl:top-8 xl:col-start-2 xl:row-start-1">
            <Card title={v.aside.title}>
              <div onChange={s.changed}>{v.aside.body}</div>
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                {state && (
                  <span role="status" className="text-sm text-fg-muted">
                    {state}
                  </span>
                )}
                {button}
              </div>
            </Card>
          </div>
        )}
        <div
          className="flex min-w-0 flex-col gap-8 xl:col-start-1 xl:row-start-1"
          onChange={s.changed}
        >
          {v.parts.map((p) => (
            <section
              key={p.id}
              aria-label={p.title}
              className="flex flex-col gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0"
            >
              <header className="flex flex-wrap items-start gap-3">
                <PartTitle p={p} />
                {p.actions && (
                  <div className="-ms-3 flex h-7 items-center">{p.actions}</div>
                )}
              </header>
              {p.body}
            </section>
          ))}
          {v.foot}
          {!answer && (
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-6 sm:flex-row sm:justify-end">
              <BackButton s={v.submit} />
              {button}
            </div>
          )}
        </div>
        {!answer && v.aside && (
          <div className="xl:sticky xl:top-8 xl:col-start-2 xl:row-start-1">
            <Fold label={v.aside.title}>{v.aside.body}</Fold>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- the page ----

function Layout({ c, layout }: { c: FormCase; layout: LayoutKey }) {
  const v = c.use();
  if (layout === "A") return <LayoutA v={v} />;
  if (layout === "B") return <LayoutB v={v} />;
  return <LayoutC v={v} />;
}

// Welcome's own frame, as it is now: the logo, who's signed in, Sign out
function OwnFrame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 p-4 py-10">
      {/* room for the switchers above the logo */}
      <div aria-hidden className="h-20" />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo className="w-32" />
        <span className="flex items-center gap-2 text-sm text-fg-muted">
          Signed in as sam.rivera@example.com
          <Button variant="text" size="sm" onPress={say("Signed out")}>
            Sign out
          </Button>
        </span>
      </header>
      {children}
    </main>
  );
}

export function FormPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const layout: LayoutKey =
    layouts.find((l) => l.key === search.layout)?.key ?? "A";
  const c = cases.find((x) => x.key === search.case) ?? cases[0]!;
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/form",
      search: { case: c.key, layout, ...change },
      replace: true,
    });

  const page = (
    <>
      {/* room for the switchers, so they cover nothing of the page at rest */}
      <div aria-hidden className="h-24" />
      <LayoutNote key={layout} layout={layout} />
      <Layout key={`${c.key}-${layout}`} c={c} layout={layout} />
      <PrototypeSwitcher
        variants={layouts.map((l) => ({ key: l.key, name: l.name }))}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="top-16 md:top-3"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={c.key}
        onChange={(k) => go({ case: k })}
        className="top-28 md:top-15"
      />
    </>
  );

  if (!c.area) return <OwnFrame>{page}</OwnFrame>;
  const nav: NavItem[] = navFor("en")[c.area].map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === c.navLabel,
    }),
  );
  return (
    <AppLayout area={areaLabels.en[c.area]} nav={nav} foot={() => null}>
      {page}
    </AppLayout>
  );
}
