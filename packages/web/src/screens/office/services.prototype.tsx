// PROTOTYPE: throwaway. The Office's page for one Service, on made-up data,
// at /prototype/services?case=1..3&layout=A..C (no sign-in). A keeps one
// form, with what it comes to beside it as it's typed; B reads the Service
// part by part, each changed in a dialog, as the Price List does; C is B in
// two columns, the example and booking on the right. For the UX pass (#96).
// Lives only on prototype-services.
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Building2,
  CalendarDays,
  CalendarSync,
  Clock,
  ContactRound,
  DollarSign,
  Gauge,
  Home,
  LayoutDashboard,
  MapPinCheck,
  Receipt,
  Sparkles,
  SquarePen,
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
  Dialog,
  DialogTrigger,
  Heading,
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
import { Fact } from "../Fact.tsx";
import { JobIcon, QuoteIcon } from "../icons.ts";

const here = linkTo({ to: "/prototype/services" });

// ---- made-up data ----

type ServiceCase = {
  key: string;
  name: string;
  service: string;
  description: string;
  offeredFor: "Homes" | "Businesses" | "Both";
  rooms: boolean;
  roomHours: [number, number, number, number, number];
  perThousand: number;
  condition: boolean;
  rate: number;
  minimum: number;
  canRecur: boolean;
  siteVisit: boolean;
  firstVisit: string | null;
  taxOneOff: number;
  taxPlan: number | null;
  active: boolean;
  saved: string;
  example: string;
};

const standard: ServiceCase = {
  key: "1",
  name: "Homes, by rooms, on plans",
  service: "Standard Clean",
  description:
    "Kitchen, bathrooms, dusting and floors throughout. The clean most homes have every week or two.",
  offeredFor: "Homes",
  rooms: true,
  roomHours: [1, 0.5, 0.75, 0.5, 0.5],
  perThousand: 0,
  condition: true,
  rate: 55,
  minimum: 100,
  canRecur: true,
  siteVisit: false,
  firstVisit: "Deep Clean",
  taxOneOff: 8.875,
  taxPlan: 8.875,
  active: true,
  saved: "Version 3, saved by Maria Lopez on Oct 12",
  example:
    "A 2-bedroom, 1½-bathroom home, in moderate Condition, takes 3.25 h and comes to $194.58 ($179 + $15.58 tax).",
};

const cases: ServiceCase[] = [
  standard,
  {
    ...standard,
    key: "2",
    name: "Businesses, by area, Site Visit",
    service: "Office Clean",
    description:
      "Desks, kitchens, restrooms and floors, after hours. Agreed after a walk-through.",
    offeredFor: "Businesses",
    rooms: false,
    perThousand: 0.6,
    rate: 48,
    minimum: 150,
    siteVisit: true,
    firstVisit: null,
    taxPlan: 4.5,
    saved: "Version 1, saved by Sam Chen on Sep 30",
    example:
      "2,000 sq ft of office, in moderate Condition, takes 1.25 h and comes to $163.31, the Minimum Charge ($150 + $13.31 tax).",
  },
  {
    ...standard,
    key: "3",
    name: "Retired, one-off",
    service: "Move-out Clean",
    description:
      "Everything, inside cupboards and appliances, for an empty home.",
    roomHours: [2, 1, 1, 0.75, 0],
    rate: 60,
    minimum: 200,
    canRecur: false,
    firstVisit: null,
    taxPlan: null,
    active: false,
    saved: "Version 2, saved by Maria Lopez on Aug 4",
    example:
      "A 2-bedroom, 1½-bathroom home, in moderate Condition, takes 5.5 h and comes to $359.29 ($330 + $29.29 tax).",
  },
];

const layouts = [
  { key: "A", name: "One form, example beside it" },
  { key: "B", name: "Read, change a part in a dialog" },
  { key: "C", name: "Two columns, example right" },
];

const nav: NavItem[] = [
  { href: here, label: "Today", icon: LayoutDashboard },
  { href: here, label: "Quotes", icon: QuoteIcon },
  { href: here, label: "Jobs", icon: JobIcon },
  { href: here, label: "Clients", icon: ContactRound },
  { href: here, label: "Schedule", icon: CalendarDays },
  { href: here, label: "Staff", icon: Users },
  { href: here, label: "Price List", icon: Tag, isCurrent: true },
];

const money = (dollars: number) => `$${dollars.toFixed(2).replace(".00", "")}`;
const roomLabels = [
  "Base",
  "Per bedroom",
  "Per bathroom",
  "Per extra floor",
  "Pets",
];
const hoursLine = (s: ServiceCase) =>
  s.rooms
    ? `${s.roomHours[0]} h, + ${s.roomHours[1]} h a bedroom, + ${s.roomHours[2]} h a bathroom`
    : `${s.perThousand} h per 1,000 sq ft`;

// ---- the page ----

export function ServicesPrototype() {
  const { case: key = "1", layout = "B" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/services",
      search: { case: key, layout, ...search } as never,
    });
  const s = cases.find((x) => x.key === key) ?? standard;

  return (
    <AppLayout
      area="Office"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Office</span>}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Breadcrumbs
            trail={[{ label: "Services", href: here }, { label: s.service }]}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Heading level={1}>{s.service}</Heading>
              {!s.active && <StatusBadge>Retired</StatusBadge>}
            </div>
            {layout !== "A" && <RetireButton s={s} />}
          </div>
          <p className="text-fg-muted">
            {s.saved}. Changes apply to prices worked out from now on.
          </p>
        </div>
        {layout === "A" && <OneForm s={s} />}
        {layout === "B" && (
          <>
            <WhatItIs s={s} />
            <HowLong s={s} />
            <Price s={s} />
            <Booking s={s} />
            <Tax s={s} />
          </>
        )}
        {layout === "C" && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-6">
              <WhatItIs s={s} />
              <HowLong s={s} />
              <Price s={s} noExample />
              <Tax s={s} />
            </div>
            <div className="flex flex-col gap-6">
              <Section title="For example">
                <Card>
                  <ExampleText s={s} />
                </Card>
              </Section>
              <Booking s={s} narrow />
            </div>
          </div>
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
        current={s.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

function RetireButton({ s }: { s: ServiceCase }) {
  return s.active ? (
    <Button variant="danger-text" size="sm">
      <Archive aria-hidden size={16} />
      Retire
    </Button>
  ) : (
    <Button variant="text" size="sm">
      <ArchiveRestore aria-hidden size={16} />
      Offer again
    </Button>
  );
}

function ExampleText({ s }: { s: ServiceCase }) {
  return (
    <p className="text-sm text-fg-muted">
      <span className="font-semibold text-fg">For example: </span>
      {s.example}
    </p>
  );
}

// ---- A: one form, the example beside it ----

function OneForm({ s }: { s: ServiceCase }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <Section title="What it is">
          <Card>
            <WhatFields s={s} />
          </Card>
        </Section>
        <Section
          title="How long it takes"
          description="Labour Hours, however many Cleaners share them."
        >
          <Card>
            <HoursFields s={s} />
          </Card>
        </Section>
        <Section title="Price" description="Before tax.">
          <Card>
            <PriceFields s={s} />
          </Card>
        </Section>
        <Section title="Booking">
          <Card>
            <BookingFields s={s} />
          </Card>
        </Section>
        <Section title="Sales tax">
          <Card>
            <TaxFields s={s} />
          </Card>
        </Section>
        <Actions>
          <RetireButton s={s} />
          <Button>Save Service</Button>
        </Actions>
      </div>
      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <Section title="What it comes to">
          <Card>
            <ExampleText s={s} />
          </Card>
        </Section>
      </div>
    </div>
  );
}

// ---- B and C: read, then change a part ----

function Part({
  title,
  description,
  facts,
  fields,
  narrow,
  footer,
}: {
  title: string;
  description?: string;
  facts: React.ReactNode;
  fields: React.ReactNode;
  narrow?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <Section
      title={title}
      description={description}
      actions={
        <DialogTrigger>
          <Button variant="text" size="sm">
            <SquarePen aria-hidden size={16} />
            Edit
          </Button>
          <Dialog title={title}>
            {({ close }) => (
              <>
                {fields}
                <Actions>
                  <Button variant="quiet" onPress={close}>
                    Cancel
                  </Button>
                  <Button onPress={close}>Save</Button>
                </Actions>
              </>
            )}
          </Dialog>
        </DialogTrigger>
      }
    >
      <Card>
        <dl
          className={`grid gap-x-6 gap-y-4 ${narrow ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}
        >
          {facts}
        </dl>
        {footer && (
          <div className="mt-4 border-t border-border pt-4">{footer}</div>
        )}
      </Card>
    </Section>
  );
}

function WhatItIs({ s }: { s: ServiceCase }) {
  return (
    <Part
      title="What it is"
      facts={
        <>
          <Fact
            icon={Sparkles}
            label="Description"
            value={s.description}
            line="What Clients see when asking for it"
            className="sm:col-span-2"
          />
          <Fact
            icon={s.offeredFor === "Homes" ? Home : Building2}
            label="Offered for"
            value={s.offeredFor}
          />
        </>
      }
      fields={<WhatFields s={s} />}
    />
  );
}

function HowLong({ s }: { s: ServiceCase }) {
  return (
    <Part
      title="How long it takes"
      description="Labour Hours, however many Cleaners share them. They set the price, and how long the Schedule books."
      facts={
        s.rooms ? (
          <>
            {roomLabels.map((label, i) => (
              <Fact
                key={label}
                icon={Clock}
                label={label}
                value={`${s.roomHours[i]} h`}
              />
            ))}
            <Fact
              icon={Gauge}
              label="Condition"
              value={s.condition ? "Takes longer if dirtier" : "Not affected"}
              line="Condition"
            />
          </>
        ) : (
          <>
            <Fact
              icon={Clock}
              label="Per 1,000 sq ft"
              value={hoursLine(s)}
              line="For an office"
            />
            <Fact
              icon={Gauge}
              label="Condition"
              value={s.condition ? "Takes longer if dirtier" : "Not affected"}
              line="Condition"
            />
          </>
        )
      }
      fields={<HoursFields s={s} />}
    />
  );
}

function Price({ s, noExample }: { s: ServiceCase; noExample?: boolean }) {
  return (
    <Part
      title="Price"
      description="Before tax. Add-ons are charged at the same rate, for their own hours."
      facts={
        <>
          <Fact
            icon={DollarSign}
            label="Hourly rate"
            value={`${money(s.rate)} an hour`}
          />
          <Fact
            icon={DollarSign}
            label="Minimum Charge"
            value={money(s.minimum)}
          />
        </>
      }
      footer={noExample ? undefined : <ExampleText s={s} />}
      fields={<PriceFields s={s} />}
    />
  );
}

function Booking({ s, narrow }: { s: ServiceCase; narrow?: boolean }) {
  return (
    <Part
      title="Booking"
      narrow={narrow}
      facts={
        <>
          <Fact
            icon={CalendarSync}
            label="Service Plan"
            value={s.canRecur ? "Can be on a Service Plan" : "One-off only"}
            line="Service Plan"
          />
          <Fact
            icon={MapPinCheck}
            label="Site Visit"
            value={
              s.siteVisit
                ? "Site Visit before the Quote"
                : "Quoted straight away"
            }
            line="Site Visit"
          />
          <Fact
            icon={Sparkles}
            label="First visit"
            value={
              s.firstVisit ? `Recommend a ${s.firstVisit}` : "Nothing else"
            }
            line="Where we haven't cleaned before"
          />
        </>
      }
      fields={<BookingFields s={s} />}
    />
  );
}

function Tax({ s }: { s: ServiceCase }) {
  return (
    <Part
      title="Sales tax"
      description="Added to its price. Confirm these with your accountant."
      facts={
        <>
          <Fact icon={Receipt} label="One-off Jobs" value={`${s.taxOneOff}%`} />
          {s.taxPlan !== null && (
            <Fact
              icon={Receipt}
              label="Service Plan Jobs"
              value={`${s.taxPlan}%`}
            />
          )}
        </>
      }
      fields={<TaxFields s={s} />}
    />
  );
}

// ---- fields every layout shares ----

function WhatFields({ s }: { s: ServiceCase }) {
  return (
    <>
      <TextField label="Name" defaultValue={s.service} />
      <TextField
        label="Description"
        description="A sentence or two Clients see when asking for it"
        multiline
        defaultValue={s.description}
      />
      <SegmentedControl label="Offered for" defaultValue={s.offeredFor}>
        <Segment value="Homes">Homes</Segment>
        <Segment value="Businesses">Businesses</Segment>
        <Segment value="Both">Both</Segment>
      </SegmentedControl>
    </>
  );
}

function HoursFields({ s }: { s: ServiceCase }) {
  return (
    <>
      <SegmentedControl
        label="Worked out"
        defaultValue={s.rooms ? "rooms" : "area"}
      >
        <Segment value="rooms">From a home's rooms</Segment>
        <Segment value="area">By area</Segment>
      </SegmentedControl>
      {s.rooms ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {roomLabels.map((label, i) => (
            <NumberField
              key={label}
              label={`${label} (hours)`}
              defaultValue={s.roomHours[i]}
              step={0.05}
            />
          ))}
        </div>
      ) : (
        <NumberField
          label="Hours per 1,000 sq ft"
          defaultValue={s.perThousand}
          step={0.05}
        />
      )}
      <Checkbox defaultSelected={s.condition}>
        Takes longer the dirtier the place is (Condition)
      </Checkbox>
    </>
  );
}

function PriceFields({ s }: { s: ServiceCase }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Hourly rate"
          defaultValue={s.rate}
          formatOptions={{ style: "currency", currency: "USD" }}
        />
        <NumberField
          label="Minimum Charge"
          defaultValue={s.minimum}
          formatOptions={{ style: "currency", currency: "USD" }}
        />
      </div>
      <p className="rounded-md bg-surface-sunken p-3 text-sm text-fg-muted">
        <span className="font-semibold text-fg">For example: </span>
        {s.example}
      </p>
    </>
  );
}

function BookingFields({ s }: { s: ServiceCase }) {
  return (
    <>
      <Checkbox defaultSelected={s.canRecur}>Can be on a Service Plan</Checkbox>
      <Checkbox defaultSelected={s.siteVisit}>
        Needs a Site Visit before a Quote is sent
      </Checkbox>
      <TextField
        label="For a first visit, recommend"
        defaultValue={s.firstVisit ?? "Nothing else"}
      />
    </>
  );
}

function TaxFields({ s }: { s: ServiceCase }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField
        label="One-off Jobs (%)"
        defaultValue={s.taxOneOff}
        step={0.125}
      />
      {s.taxPlan !== null && (
        <NumberField
          label="Service Plan Jobs (%)"
          defaultValue={s.taxPlan}
          step={0.125}
        />
      )}
    </div>
  );
}
