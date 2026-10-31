// PROTOTYPE: throwaway. The Office's page for one Service, on made-up data,
// at /prototype/services?case=1..3&example=A..C (no sign-in). One form, with
// what it comes to beside it as a Quote, worked out as she types: A shows it
// for one typical place; B lets her try a smaller or bigger place, and its
// Condition; C is B, with what the saved figures came to beside each line.
// For the UX pass (#96). Lives only on prototype-services.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ContactRound,
  FileText,
  LayoutDashboard,
  Tag,
  Users,
} from "lucide-react";
import {
  Actions,
  AppLayout,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Heading,
  IconTile,
  type NavItem,
  NumberField,
  Section,
  Segment,
  SegmentedControl,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { JobIcon, QuoteIcon } from "../icons.ts";

const here = linkTo({ to: "/prototype/services" });

// ---- made-up data ----

type Figures = {
  rooms: boolean;
  base: number;
  bedroom: number;
  bathroom: number;
  storey: number;
  pets: number;
  perThousand: number;
  condition: boolean;
  rate: number;
  minimum: number;
  tax: number;
};

type ServiceCase = {
  key: string;
  name: string;
  service: string;
  description: string;
  offeredFor: "homes" | "businesses";
  canRecur: boolean;
  siteVisit: boolean;
  active: boolean;
  saved: string;
  figures: Figures;
};

const standard: ServiceCase = {
  key: "1",
  name: "Homes, by rooms",
  service: "Standard Clean",
  description:
    "Kitchen, bathrooms, dusting and floors throughout. The clean most homes have every week or two.",
  offeredFor: "homes",
  canRecur: true,
  siteVisit: false,
  active: true,
  saved: "Version 3, saved by Maria Lopez on Oct 12",
  figures: {
    rooms: true,
    base: 1,
    bedroom: 0.5,
    bathroom: 0.75,
    storey: 0.5,
    pets: 0.5,
    perThousand: 0,
    condition: true,
    rate: 55,
    minimum: 100,
    tax: 8.875,
  },
};

const cases: ServiceCase[] = [
  standard,
  {
    ...standard,
    key: "2",
    name: "Businesses, by area",
    service: "Office Clean",
    description:
      "Desks, kitchens, restrooms and floors, after hours. Agreed after a walk-through.",
    offeredFor: "businesses",
    siteVisit: true,
    saved: "Version 1, saved by Sam Chen on Sep 30",
    figures: {
      ...standard.figures,
      rooms: false,
      perThousand: 0.6,
      rate: 48,
      minimum: 150,
    },
  },
  {
    ...standard,
    key: "3",
    name: "Retired, one-off",
    service: "Move-out Clean",
    description:
      "Everything, inside cupboards and appliances, for an empty home.",
    canRecur: false,
    active: false,
    saved: "Version 2, saved by Maria Lopez on Aug 4",
    figures: {
      ...standard.figures,
      base: 2,
      bedroom: 1,
      bathroom: 1,
      storey: 0.75,
      pets: 0,
      rate: 60,
      minimum: 200,
    },
  },
];

const examples = [
  { key: "A", name: "A typical place, as a Quote" },
  { key: "B", name: "Try another place" },
  { key: "C", name: "Try another place, saved beside it" },
];

// the Price List's, made up
const conditions = { light: 0.9, moderate: 1, heavy: 1.3 } as const;
type Condition = keyof typeof conditions;
const premisesTypes = { Office: 1, Retail: 0.8, Medical: 1.6 } as const;
type PremisesType = keyof typeof premisesTypes;
const crewSize = 2;

type Home = {
  name: string;
  bedrooms: number;
  bathrooms: number;
  storeys: number;
  pets: boolean;
};
const homes: Record<string, Home> = {
  small: {
    name: "A 1-bedroom apartment",
    bedrooms: 1,
    bathrooms: 1,
    storeys: 1,
    pets: false,
  },
  typical: {
    name: "A 2-bedroom, 1½-bathroom home",
    bedrooms: 2,
    bathrooms: 1.5,
    storeys: 1,
    pets: false,
  },
  big: {
    name: "A 4-bedroom, 3-bathroom house on 2 floors, with pets",
    bedrooms: 4,
    bathrooms: 3,
    storeys: 2,
    pets: true,
  },
};
const areas: Record<string, number> = { small: 1000, typical: 2000, big: 5000 };

const nav: NavItem[] = [
  { href: here, label: "Today", icon: LayoutDashboard },
  { href: here, label: "Quotes", icon: QuoteIcon },
  { href: here, label: "Jobs", icon: JobIcon },
  { href: here, label: "Clients", icon: ContactRound },
  { href: here, label: "Schedule", icon: CalendarDays },
  { href: here, label: "Staff", icon: Users },
  { href: here, label: "Price List", icon: Tag, isCurrent: true },
];

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const h = (hours: number) => `${Math.round(hours * 1000) / 1000} h`;
const onSite = (hours: number) => {
  const minutes = Math.round((hours / crewSize) * 60);
  return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
};

// ---- the working-out, as a Suggested Price's ----

type Line = { label: string; hours: number };
type Working = {
  lines: Line[];
  placeHours: number;
  conditionMultiplier: number | null;
  labourHours: number;
  workedOutCents: number;
  minimumApplied: boolean;
  priceCents: number;
  taxCents: number;
  totalCents: number;
};

const workOut = (
  f: Figures,
  place: { home: Home; sqft: number; premises: PremisesType },
  condition: Condition,
): Working => {
  const lines: Line[] = f.rooms
    ? [
        { label: "Base: kitchen, living areas, entry", hours: f.base },
        {
          label: `${place.home.bedrooms} ${place.home.bedrooms === 1 ? "bedroom" : "bedrooms"} × ${h(f.bedroom)}`,
          hours: place.home.bedrooms * f.bedroom,
        },
        {
          label: `${place.home.bathrooms} ${place.home.bathrooms === 1 ? "bathroom" : "bathrooms"} × ${h(f.bathroom)}`,
          hours: place.home.bathrooms * f.bathroom,
        },
        ...(place.home.storeys > 1
          ? [
              {
                label: `${place.home.storeys - 1} extra floor × ${h(f.storey)}`,
                hours: (place.home.storeys - 1) * f.storey,
              },
            ]
          : []),
        ...(place.home.pets ? [{ label: "Pets", hours: f.pets }] : []),
      ]
    : [
        {
          label: `${(place.sqft / 1000).toLocaleString()} × 1,000 sq ft × ${h(f.perThousand)}`,
          hours: (place.sqft / 1000) * f.perThousand,
        },
        ...(place.premises !== "Office"
          ? [
              {
                label: `${place.premises}: × ${premisesTypes[place.premises]}`,
                hours:
                  (place.sqft / 1000) *
                  f.perThousand *
                  (premisesTypes[place.premises] - 1),
              },
            ]
          : []),
      ];
  const placeHours = lines.reduce((sum, l) => sum + l.hours, 0);
  const conditionMultiplier = f.condition ? conditions[condition] : null;
  const units = Math.round(placeHours * (conditionMultiplier ?? 1) * 10_000);
  const labourHours = (Math.ceil(units / 2_500) * 2_500) / 10_000;
  const rateCents = Math.round(f.rate * 100);
  const workedOutCents = Math.round((labourHours * rateCents) / 100) * 100;
  const minimumCents = Math.round(f.minimum * 100);
  const priceCents = Math.max(workedOutCents, minimumCents);
  const taxCents = Math.floor(
    (priceCents * Math.round(f.tax * 1000) + 50_000) / 100_000,
  );
  return {
    lines,
    placeHours,
    conditionMultiplier,
    labourHours,
    workedOutCents,
    minimumApplied: workedOutCents < minimumCents,
    priceCents,
    taxCents,
    totalCents: priceCents + taxCents,
  };
};

// ---- the page ----

export function ServicesPrototype() {
  const { case: key = "1", layout: example = "B" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/services",
      search: { case: key, layout: example, ...search } as never,
    });
  const s = cases.find((x) => x.key === key) ?? standard;

  return (
    <AppLayout
      area="Office"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Office</span>}
    >
      {/* each case starts its figures afresh */}
      <Page key={s.key} s={s} example={example} />
      <PrototypeSwitcher
        variants={examples}
        current={example}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-20"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={s.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

function Page({ s, example }: { s: ServiceCase; example: string }) {
  const [f, setF] = useState<Figures>(s.figures);
  const set = (change: Partial<Figures>) =>
    setF((current) => ({ ...current, ...change }));
  const changed = JSON.stringify(f) !== JSON.stringify(s.figures);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[{ label: "Services", href: here }, { label: s.service }]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{s.service}</Heading>
          {!s.active && <StatusBadge>Retired</StatusBadge>}
        </div>
        <p className="text-fg-muted">
          {s.saved}. Changes apply to prices worked out from now on.
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6">
          <Section title="What it is">
            <Card>
              <TextField label="Name" defaultValue={s.service} />
              <TextField
                label="Description"
                description="A sentence or two Clients see when asking for it"
                multiline
                defaultValue={s.description}
              />
              <SegmentedControl label="Offered for" defaultValue={s.offeredFor}>
                <Segment value="homes">Homes</Segment>
                <Segment value="businesses">Businesses</Segment>
                <Segment value="both">Both</Segment>
              </SegmentedControl>
            </Card>
          </Section>
          <Section
            title="How long it takes"
            description="Labour Hours, however many Cleaners share them. They set the price, and how long the Schedule books."
          >
            <Card>
              {f.rooms ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Hours
                    label="Base (hours)"
                    description="Kitchen, living areas and entry, for every home"
                    value={f.base}
                    onChange={(base) => set({ base })}
                  />
                  <Hours
                    label="Per bedroom (hours)"
                    value={f.bedroom}
                    onChange={(bedroom) => set({ bedroom })}
                  />
                  <Hours
                    label="Per bathroom (hours)"
                    value={f.bathroom}
                    onChange={(bathroom) => set({ bathroom })}
                  />
                  <Hours
                    label="Per extra floor (hours)"
                    description="For each floor above the first"
                    value={f.storey}
                    onChange={(storey) => set({ storey })}
                  />
                  <Hours
                    label="Pets (hours)"
                    description="Added once if there are pets"
                    value={f.pets}
                    onChange={(pets) => set({ pets })}
                  />
                </div>
              ) : (
                <Hours
                  label="Hours per 1,000 sq ft"
                  description="For an office; other types of premises take longer or shorter, as set on the Price List"
                  value={f.perThousand}
                  onChange={(perThousand) => set({ perThousand })}
                />
              )}
              <Checkbox
                isSelected={f.condition}
                onChange={(condition) => set({ condition })}
              >
                Takes longer the dirtier the place is (Condition)
              </Checkbox>
            </Card>
          </Section>
          <Section
            title="Price"
            description="Before tax. Add-ons are charged at the same rate, for their own hours."
          >
            <Card>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Hourly rate"
                  minValue={1}
                  formatOptions={{ style: "currency", currency: "USD" }}
                  value={f.rate}
                  onChange={(rate) => set({ rate })}
                />
                <NumberField
                  label="Minimum Charge"
                  description="No Suggested Price is lower. You can still override it on a Quote."
                  minValue={0}
                  formatOptions={{ style: "currency", currency: "USD" }}
                  value={f.minimum}
                  onChange={(minimum) => set({ minimum })}
                />
              </div>
            </Card>
          </Section>
          <Section title="Booking">
            <Card>
              <Checkbox defaultSelected={s.canRecur}>
                Can be on a Service Plan
              </Checkbox>
              <Checkbox defaultSelected={s.siteVisit}>
                Needs a Site Visit before a Quote is sent
              </Checkbox>
            </Card>
          </Section>
          <Section
            title="Sales tax"
            description="Added to its price, so Clients see prices with tax. Confirm these with your accountant."
          >
            <Card>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="One-off Jobs (%)"
                  minValue={0}
                  step={0.125}
                  formatOptions={{ maximumFractionDigits: 3 }}
                  value={f.tax}
                  onChange={(tax) => set({ tax })}
                />
              </div>
            </Card>
          </Section>
          <Actions>
            {s.active ? (
              <Button variant="danger-text">
                <Archive aria-hidden size={18} />
                Retire
              </Button>
            ) : (
              <Button variant="text">
                <ArchiveRestore aria-hidden size={18} />
                Offer again
              </Button>
            )}
            <Button>Save Service</Button>
          </Actions>
        </div>
        <div className="lg:sticky lg:top-6">
          <ExampleQuote
            s={s}
            f={f}
            tryOthers={example !== "A"}
            beside={example === "C" && changed}
          />
        </div>
      </div>
    </div>
  );
}

const Hours = ({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <NumberField
    label={label}
    description={description}
    minValue={0}
    step={0.05}
    formatOptions={{ maximumFractionDigits: 2 }}
    value={value}
    onChange={onChange}
  />
);

// ---- the example, as a Quote ----

function ExampleQuote({
  s,
  f,
  tryOthers,
  beside,
}: {
  s: ServiceCase;
  f: Figures;
  tryOthers: boolean;
  // what the saved figures came to, beside each line that changed
  beside: boolean;
}) {
  const [size, setSize] = useState("typical");
  const [condition, setCondition] = useState<Condition>("moderate");
  const [premises, setPremises] = useState<PremisesType>("Office");
  const place = { home: homes[size]!, sqft: areas[size]!, premises };
  const now = workOut(f, place, condition);
  const was = workOut(s.figures, place, condition);
  const placeName = f.rooms
    ? place.home.name
    : `${place.sqft.toLocaleString()} sq ft of ${premises.toLowerCase()}`;

  return (
    <Section
      title="Example Quote"
      description="What these figures come to, worked out as a Suggested Price is. It changes as you type."
    >
      <Card>
        <div className="flex flex-col gap-4">
          {tryOthers && (
            <div className="flex flex-col gap-3 border-b border-border pb-4">
              <SegmentedControl
                label="For"
                value={size}
                onChange={(v) => setSize(String(v))}
              >
                <Segment value="small">
                  {f.rooms ? "1 bed" : "1,000 sq ft"}
                </Segment>
                <Segment value="typical">
                  {f.rooms ? "2 bed" : "2,000 sq ft"}
                </Segment>
                <Segment value="big">
                  {f.rooms ? "4 bed" : "5,000 sq ft"}
                </Segment>
              </SegmentedControl>
              {!f.rooms && (
                <SegmentedControl
                  label="Type of premises"
                  value={premises}
                  onChange={(v) => setPremises(v as PremisesType)}
                >
                  {(Object.keys(premisesTypes) as PremisesType[]).map((t) => (
                    <Segment key={t} value={t}>
                      {t}
                    </Segment>
                  ))}
                </SegmentedControl>
              )}
              {f.condition && (
                <SegmentedControl
                  label="Condition"
                  value={condition}
                  onChange={(v) => setCondition(v as Condition)}
                >
                  <Segment value="light">Light</Segment>
                  <Segment value="moderate">Moderate</Segment>
                  <Segment value="heavy">Heavy</Segment>
                </SegmentedControl>
              )}
            </div>
          )}

          {/* the top of a Quote: what it's for, and its total */}
          <div className="flex items-start gap-3">
            <IconTile icon={FileText} />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm text-fg-muted">{s.service}</span>
              <span className="text-2xl font-semibold tabular-nums text-fg">
                {money(now.totalCents)}
              </span>
              {beside && was.totalCents !== now.totalCents && (
                <span className="text-sm text-fg-muted">
                  was {money(was.totalCents)} (
                  {now.totalCents > was.totalCents ? "+" : "−"}
                  {money(Math.abs(now.totalCents - was.totalCents))})
                </span>
              )}
              <span className="text-sm text-fg-muted">
                {placeName}
                {f.condition ? `, ${condition} Condition` : ""}
              </span>
            </div>
          </div>

          {/* how it's worked out */}
          <dl className="flex flex-col gap-1 border-t border-border pt-4 text-sm">
            {now.lines.map((line, i) => (
              <Line
                key={line.label}
                label={line.label}
                value={h(line.hours)}
                was={beside ? h(was.lines[i]?.hours ?? 0) : undefined}
              />
            ))}
            {now.conditionMultiplier !== null && (
              <Line
                label={`× ${condition} Condition (${now.conditionMultiplier})`}
                value=""
              />
            )}
            <Line
              label="Labour Hours, to the quarter-hour"
              value={h(now.labourHours)}
              was={beside ? h(was.labourHours) : undefined}
              strong
            />
            <Line
              label={`× ${money(Math.round(f.rate * 100))} an hour, to the dollar`}
              value={money(now.workedOutCents)}
              was={beside ? money(was.workedOutCents) : undefined}
            />
            {now.minimumApplied && (
              <Line
                label="Below the Minimum Charge, so that applies"
                value={money(now.priceCents)}
                was={beside ? money(was.priceCents) : undefined}
              />
            )}
            <Line
              label={`Sales tax (${f.tax}%)`}
              value={money(now.taxCents)}
              was={beside ? money(was.taxCents) : undefined}
            />
            <div className="mt-2 flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold text-fg">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(now.totalCents)}</dd>
            </div>
          </dl>

          <p className="text-sm text-fg-muted">
            With {crewSize} Cleaners, about {onSite(now.labourHours)} on site.
            Add-ons and the Plan Discount come on top, on the real Quote.
          </p>
        </div>
      </Card>
    </Section>
  );
}

function Line({
  label,
  value,
  was,
  strong,
}: {
  label: string;
  value: string;
  // the saved figures' value, shown only where it differs
  was?: string;
  strong?: boolean;
}) {
  const differs = was !== undefined && was !== value;
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? "font-semibold text-fg" : "text-fg-muted"}>
        {label}
      </dt>
      <dd
        className={`flex shrink-0 gap-2 tabular-nums ${strong ? "font-semibold text-fg" : "text-fg"}`}
      >
        {differs && <s className="text-fg-muted">{was}</s>}
        <span className={differs ? "font-semibold text-primary" : ""}>
          {value}
        </span>
      </dd>
    </div>
  );
}
