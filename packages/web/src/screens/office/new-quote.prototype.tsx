// PROTOTYPE: throwaway. The Office's New Quote, for someone who phones, on
// made-up data, at /prototype/new-quote?case=1..3&layout=A..C (no sign-in).
// A is today's: find who's calling, then the Clients' form in steps; B asks
// everything on one page, in the order a call goes; C is B with what it
// comes to beside it, as the Example Quote does, so the price can be said
// on the phone. For the UX pass (#96). Lives only on prototype-new-quote.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  ContactRound,
  FileText,
  House,
  Houses,
  LayoutDashboard,
  Search,
  Sparkles,
  SprayCan,
  Store,
  Tag,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  suggestedPrice,
  type Condition,
  type PriceList,
  type Service,
} from "@empire-cleaning/models";
import {
  Actions,
  AppLayout,
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  ChoiceTile,
  ChoiceTiles,
  Heading,
  IconTile,
  List,
  ListItem,
  type NavItem,
  NumberField,
  Radio,
  RadioGroup,
  Section,
  Segment,
  SegmentedControl,
  TextField,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { JobIcon, QuoteIcon } from "../icons.ts";
import { formatHours, formatMoney } from "../format.ts";

const here = linkTo({ to: "/prototype/new-quote" });

// ---- made-up data ----

type Place = { id: string; line: string; held?: string };
type Caller = {
  key: string;
  name: string;
  // who's calling: found, new, or not chosen yet
  who: "found" | "new";
  client?: { name: string; line: string; places: Place[] };
  business: boolean;
};

const cases: Caller[] = [
  { key: "1", name: "A new caller, a home", who: "new", business: false },
  {
    key: "2",
    name: "A Client, two homes",
    who: "found",
    business: false,
    client: {
      name: "Casey Client",
      line: "casey@example.com · (718) 555-0142",
      places: [
        { id: "a", line: "35-06 Ditmars Blvd, Apt 4B, 11105" },
        {
          id: "b",
          line: "12 Shore Rd, 11375",
          held: "A Standard Clean Quote is open for it",
        },
      ],
    },
  },
  { key: "3", name: "A new caller, a business", who: "new", business: true },
];

const layouts = [
  { key: "A", name: "Find them, then the form in steps" },
  { key: "B", name: "One page, in the order of the call" },
  { key: "C", name: "One page, the price beside it" },
];

const nav: NavItem[] = [
  { href: here, label: "Today", icon: LayoutDashboard },
  { href: here, label: "Quotes", icon: QuoteIcon, isCurrent: true },
  { href: here, label: "Jobs", icon: JobIcon },
  { href: here, label: "Clients", icon: ContactRound },
  { href: here, label: "Schedule", icon: CalendarDays },
  { href: here, label: "Staff", icon: Users },
  { href: here, label: "Price List", icon: Tag },
];

const services = [
  {
    key: "standard",
    name: "Standard Clean",
    icon: Sparkles,
    line: "The regular upkeep",
  },
  {
    key: "deep",
    name: "Deep Clean",
    icon: SprayCan,
    line: "Top to bottom, once",
  },
  {
    key: "move",
    name: "Move-out Clean",
    icon: Truck,
    line: "An empty home, inside everything",
  },
  {
    key: "office",
    name: "Commercial cleaning",
    icon: Store,
    line: "Offices, shops, clinics",
  },
];

// the Price List and Services, made up, priced as a Quote is
const list = {
  conditionLight: 0.9,
  conditionModerate: 1,
  conditionHeavy: 1.4,
  defaultCrewSize: 2,
  premisesTypes: [
    { key: "office", name: "Office", multiplier: 1, active: true },
    { key: "retail", name: "Retail", multiplier: 0.8, active: true },
    { key: "medical", name: "Medical", multiplier: 1.6, active: true },
  ],
  addOns: [],
} as unknown as PriceList;
const serviceFigures: Record<string, Partial<Service>> = {
  standard: {
    roomHours: {
      baseHours: 1,
      bedroomHours: 0.5,
      bathroomHours: 0.75,
      extraStoreyHours: 0.5,
      petHours: 0.5,
    },
    hourlyRateCents: 5500,
    minimumChargeCents: 10000,
  },
  deep: {
    roomHours: {
      baseHours: 2,
      bedroomHours: 0.75,
      bathroomHours: 1,
      extraStoreyHours: 0.75,
      petHours: 0.75,
    },
    hourlyRateCents: 5500,
    minimumChargeCents: 15000,
  },
  move: {
    roomHours: {
      baseHours: 2.5,
      bedroomHours: 1,
      bathroomHours: 1,
      extraStoreyHours: 0.75,
      petHours: 0,
    },
    hourlyRateCents: 6000,
    minimumChargeCents: 20000,
  },
  office: {
    method: "area",
    hoursPerThousandSqFt: 0.6,
    hourlyRateCents: 4800,
    minimumChargeCents: 15000,
  },
};
const extras = [
  { name: "Inside the oven", hours: 0.75 },
  { name: "Inside the fridge", hours: 0.5 },
  { name: "Interior windows", hours: 1 },
];

const onSite = (labourHours: number) => {
  const minutes = Math.round((labourHours / 2) * 60);
  return [
    Math.floor(minutes / 60) && `${Math.floor(minutes / 60)} h`,
    minutes % 60 && `${minutes % 60} min`,
  ]
    .filter(Boolean)
    .join(" ");
};

// ---- the page ----

export function NewQuotePrototype() {
  const { case: key = "1", layout = "B" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/new-quote",
      search: { case: key, layout, ...search } as never,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;

  return (
    <AppLayout
      area="Office"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Office</span>}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Breadcrumbs
            trail={[{ label: "Quotes", href: here }, { label: "New Quote" }]}
          />
          <Heading level={1}>New Quote</Heading>
          <p className="text-fg-muted">
            For someone who phones. You'll go straight to the Quote Draft.
          </p>
        </div>
        {/* each case and layout starts afresh */}
        {layout === "A" ? (
          <Stepped key={c.key} c={c} />
        ) : (
          <OnePage key={c.key + layout} c={c} withPrice={layout === "C"} />
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
        current={c.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

// what's been said on the call so far
type Answers = {
  service: string;
  kind: "house" | "apartment" | "townhouse" | "commercial";
  place: string;
  bedrooms: number;
  bathrooms: number;
  storeys: number;
  pets: boolean;
  condition: Condition;
  extras: string[];
  sqft: number;
  premisesType: string;
};

const useAnswers = (c: Caller) =>
  useState<Answers>({
    service: c.business ? "office" : "standard",
    kind: c.business ? "commercial" : "apartment",
    place: c.client?.places[0]?.id ?? "new",
    bedrooms: 2,
    bathrooms: 1.5,
    storeys: 1,
    pets: false,
    condition: "moderate",
    extras: [],
    sqft: 2000,
    premisesType: "office",
  });

// ---- who's calling ----

function Who({ c }: { c: Caller }) {
  const [who, setWho] = useState<"find" | "found" | "new">(
    c.who === "found" ? "found" : "new",
  );
  if (who === "found" && c.client) {
    return (
      <Section
        title="Who's calling"
        actions={
          <Button variant="text" size="sm" onPress={() => setWho("find")}>
            <Users aria-hidden size={16} />
            Someone else
          </Button>
        }
      >
        <Card>
          <div className="flex items-center gap-3">
            <Avatar src={null} />
            <div className="flex flex-col">
              <span className="font-semibold text-fg">{c.client.name}</span>
              <span className="text-sm text-fg-muted">{c.client.line}</span>
            </div>
          </div>
        </Card>
      </Section>
    );
  }
  if (who === "find") {
    return (
      <Section
        title="Who's calling"
        actions={
          <Button variant="text" size="sm" onPress={() => setWho("new")}>
            <UserPlus aria-hidden size={16} />
            New Client
          </Button>
        }
      >
        <Card>
          <TextField
            label="Find a Client"
            type="search"
            placeholder="Name, email, phone or address"
            defaultValue="cas"
          />
          <List aria-label="Clients found" onAction={() => setWho("found")}>
            <ListItem
              id="casey"
              title="Casey Client"
              start={<Avatar src={null} />}
              description="casey@example.com · (718) 555-0142"
            />
          </List>
        </Card>
      </Section>
    );
  }
  return (
    <Section
      title="Who's calling"
      description="A new Client. Their email is optional: without one, the Quote waits until it's added."
      actions={
        <Button variant="text" size="sm" onPress={() => setWho("find")}>
          <Search aria-hidden size={16} />
          Find a Client
        </Button>
      }
    >
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Full name" />
          <TextField label="Phone" type="tel" />
          <TextField label="Email (optional)" type="email" />
          {c.business && <TextField label="Business name" />}
        </div>
      </Card>
    </Section>
  );
}

// ---- what they need, where, and about the place ----

function ServiceField({
  a,
  set,
}: {
  a: Answers;
  set: (change: Partial<Answers>) => void;
}) {
  return (
    <ChoiceTiles
      label="What can we help them with?"
      value={a.service}
      onChange={(service) =>
        set({
          service,
          kind:
            service === "office"
              ? "commercial"
              : a.kind === "commercial"
                ? "apartment"
                : a.kind,
        })
      }
    >
      {services.map((s) => (
        <ChoiceTile key={s.key} value={s.key} icon={s.icon}>
          {s.name}
        </ChoiceTile>
      ))}
    </ChoiceTiles>
  );
}

function WhereFields({
  c,
  a,
  set,
}: {
  c: Caller;
  a: Answers;
  set: (change: Partial<Answers>) => void;
}) {
  return (
    <>
      {c.client && a.kind !== "commercial" && (
        <RadioGroup
          label="Which home?"
          value={a.place}
          onChange={(place) => set({ place })}
        >
          {c.client.places.map((p) => (
            <Radio key={p.id} value={p.id} isDisabled={!!p.held}>
              {p.line}
              {p.held && (
                <span className="block text-sm text-fg-muted">{p.held}</span>
              )}
            </Radio>
          ))}
          <Radio value="new">Another home</Radio>
        </RadioGroup>
      )}
      {(!c.client || a.place === "new" || a.kind === "commercial") && (
        <>
          {a.kind !== "commercial" && (
            <ChoiceTiles
              label="What kind of place is it?"
              value={a.kind}
              onChange={(kind) => set({ kind: kind as Answers["kind"] })}
            >
              <ChoiceTile value="house" icon={House}>
                House
              </ChoiceTile>
              <ChoiceTile value="apartment" icon={Building2}>
                Apartment
              </ChoiceTile>
              <ChoiceTile value="townhouse" icon={Houses}>
                Townhouse
              </ChoiceTile>
            </ChoiceTiles>
          )}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <TextField label="Street address" />
            <TextField label="Unit (optional)" />
            <TextField label="ZIP code" />
          </div>
        </>
      )}
    </>
  );
}

function PlaceFields({
  a,
  set,
}: {
  a: Answers;
  set: (change: Partial<Answers>) => void;
}) {
  if (a.kind === "commercial") {
    return (
      <>
        <SegmentedControl
          label="Type of premises"
          value={a.premisesType}
          onChange={(premisesType) => set({ premisesType })}
        >
          <Segment value="office">Office</Segment>
          <Segment value="retail">Retail</Segment>
          <Segment value="medical">Medical</Segment>
        </SegmentedControl>
        <NumberField
          label="Floor area (sq ft)"
          step={50}
          value={a.sqft}
          onChange={(sqft) => set({ sqft })}
        />
      </>
    );
  }
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          label="Bedrooms"
          minValue={0}
          value={a.bedrooms}
          onChange={(bedrooms) => set({ bedrooms })}
        />
        <NumberField
          label="Bathrooms"
          minValue={1}
          step={0.5}
          value={a.bathrooms}
          onChange={(bathrooms) => set({ bathrooms })}
        />
        <NumberField
          label="Floors"
          minValue={1}
          value={a.storeys}
          onChange={(storeys) => set({ storeys })}
        />
      </div>
      <Checkbox isSelected={a.pets} onChange={(pets) => set({ pets })}>
        Pets
      </Checkbox>
      <SegmentedControl
        label="How much cleaning does it need?"
        value={a.condition}
        onChange={(condition) => set({ condition: condition as Condition })}
      >
        <Segment value="light">Light</Segment>
        <Segment value="moderate">Moderate</Segment>
        <Segment value="heavy">Heavy</Segment>
      </SegmentedControl>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">Any extras?</legend>
        {extras.map((x) => (
          <Checkbox
            key={x.name}
            isSelected={a.extras.includes(x.name)}
            onChange={(on) =>
              set({
                extras: on
                  ? [...a.extras, x.name]
                  : a.extras.filter((e) => e !== x.name),
              })
            }
          >
            {x.name}
          </Checkbox>
        ))}
      </fieldset>
    </>
  );
}

// ---- A: today's, in steps ----

function Stepped({ c }: { c: Caller }) {
  const [a, setA] = useAnswers(c);
  const set = (change: Partial<Answers>) => setA((x) => ({ ...x, ...change }));
  const [step, setStep] = useState(0);
  const steps = [
    { title: "What they need", fields: <ServiceField a={a} set={set} /> },
    { title: "Where", fields: <WhereFields c={c} a={a} set={set} /> },
    {
      title: a.kind === "commercial" ? "Their business premises" : "Their home",
      fields: <PlaceFields a={a} set={set} />,
    },
  ];
  const at = steps[step]!;
  return (
    <>
      <Who c={c} />
      <Card>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1" aria-hidden>
              {steps.map((s, i) => (
                <span
                  key={s.title}
                  className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-surface-sunken"}`}
                />
              ))}
            </div>
            <p className="text-sm text-fg-muted">
              Step {step + 1} of {steps.length}
            </p>
            <Heading level={2} size={3}>
              {at.title}
            </Heading>
          </div>
          {at.fields}
          <Actions>
            {step > 0 && (
              <Button variant="secondary" onPress={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button
              onPress={() => step < steps.length - 1 && setStep(step + 1)}
            >
              {step === steps.length - 1 ? "Draft the Quote" : "Next"}
            </Button>
          </Actions>
        </div>
      </Card>
    </>
  );
}

// ---- B and C: one page ----

function OnePage({ c, withPrice }: { c: Caller; withPrice: boolean }) {
  const [a, setA] = useAnswers(c);
  const set = (change: Partial<Answers>) => setA((x) => ({ ...x, ...change }));
  const form = (
    <div className="flex flex-col gap-6">
      <Who c={c} />
      <Section title="What they need">
        <Card>
          <ServiceField a={a} set={set} />
        </Card>
      </Section>
      <Section title="Where">
        <Card>
          <WhereFields c={c} a={a} set={set} />
        </Card>
      </Section>
      <Section
        title={
          a.kind === "commercial" ? "Their business premises" : "Their home"
        }
        description={
          a.kind === "commercial"
            ? "The Condition and any extras are agreed after the Site Visit."
            : undefined
        }
      >
        <Card>
          <PlaceFields a={a} set={set} />
          <TextField
            label="Anything else we should know? (optional)"
            multiline
          />
        </Card>
      </Section>
      <Actions>
        <Button>Draft the Quote</Button>
      </Actions>
    </div>
  );
  if (!withPrice) return form;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      {form}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <PriceSoFar a={a} />
      </div>
    </div>
  );
}

// what it comes to so far, priced as the Draft will be
function PriceSoFar({ a }: { a: Answers }) {
  const service = services.find((s) => s.key === a.service)!;
  const business = a.kind === "commercial";
  const p = suggestedPrice(
    list,
    {
      name: service.name,
      method: "rooms",
      conditionApplies: true,
      taxOneOffPercent: 8.875,
      ...serviceFigures[a.service],
    } as Service,
    business
      ? { kind: "commercial", premisesTypeKey: a.premisesType, area: a.sqft }
      : {
          kind: "residential",
          rooms: {
            bedrooms: a.bedrooms,
            bathrooms: a.bathrooms,
            storeys: a.storeys,
            pets: a.pets,
          },
          area: null,
        },
    business ? null : a.condition,
    extras
      .filter((x) => a.extras.includes(x.name))
      .map((x) => ({
        key: x.name,
        name: x.name,
        hours: x.hours,
        taxExempt: false,
        serviceKeys: [],
        active: true,
      })),
  );
  return (
    <Section
      title="What it comes to"
      description={
        business
          ? "A first idea, at moderate Condition: business premises are priced after the Site Visit."
          : "The Suggested Price so far, worked out as the Draft's will be. You can change it there."
      }
    >
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <IconTile icon={FileText} />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm text-fg-muted">{service.name}</span>
              <span className="text-2xl font-semibold tabular-nums text-fg">
                {formatMoney(p.totalCents)}
              </span>
              <span className="text-sm text-fg-muted">
                {formatMoney(p.priceCents)} + {formatMoney(p.taxCents)} tax
              </span>
              <span className="text-sm text-fg-muted">
                {formatHours(p.labourHours)}: about {onSite(p.labourHours)} on
                site for 2 Cleaners
              </span>
            </div>
          </div>
          <dl className="flex flex-col gap-1 border-t border-border pt-4 text-sm">
            {p.homeHours
              .filter((part) => part.hours > 0)
              .map((part) => (
                <div key={part.label} className="flex justify-between gap-4">
                  <dt className="text-fg-muted">{part.label}</dt>
                  <dd className="tabular-nums">{formatHours(part.hours)}</dd>
                </div>
              ))}
            {p.addOns.map((x) => (
              <div key={x.key} className="flex justify-between gap-4">
                <dt className="text-fg-muted">+ {x.name}</dt>
                <dd className="tabular-nums">{formatHours(x.hours)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 font-semibold">
              <dt>Labour Hours, × {formatMoney(p.hourlyRateCents)}</dt>
              <dd className="tabular-nums">{formatMoney(p.priceCents)}</dd>
            </div>
          </dl>
        </div>
      </Card>
    </Section>
  );
}
