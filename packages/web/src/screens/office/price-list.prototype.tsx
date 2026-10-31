// PROTOTYPE: throwaway. The Office's Price List, on made-up data, at
// /prototype/price-list?case=1..3&layout=A..C (no sign-in). A keeps one
// form, tidied into Sections, saved at its foot; B reads the figures and
// changes each part in a dialog, a row per Add-on and type of premises;
// C is B in two columns, the lists left and the figures right. For the UX
// pass (#96). Lives only on prototype-price-list.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarDays,
  ContactRound,
  Gauge,
  LayoutDashboard,
  Percent,
  PiggyBank,
  Plus,
  Receipt,
  SquarePen,
  Tag,
  Users,
  UsersRound,
} from "lucide-react";
import {
  Actions,
  AppLayout,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  Dialog,
  DialogTrigger,
  Heading,
  List,
  ListItem,
  type NavItem,
  Notice,
  NumberField,
  Section,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { Fact } from "../Fact.tsx";
import { JobIcon, QuoteIcon } from "../icons.ts";

const here = linkTo({ to: "/prototype/price-list" });

// ---- made-up data ----

type AddOn = {
  name: string;
  hours: number;
  taxExempt: boolean;
  services: string[];
  active: boolean;
};
type PremisesType = { name: string; multiplier: number; active: boolean };

type ListCase = {
  key: string;
  name: string;
  placeholder: boolean;
  saved: string;
  premisesTypes: PremisesType[];
  condition: [number, number, number];
  addOns: AddOn[];
  deposit: number;
  planDiscount: number;
  validDays: number;
  crew: number;
  feeTax: number;
};

const services = [
  "Standard Clean",
  "Deep Clean",
  "Move-out Clean",
  "Office Clean",
];

const saved: ListCase = {
  key: "1",
  name: "Saved, a few of each",
  placeholder: false,
  saved: "Version 4, saved by Maria Lopez on Oct 12",
  premisesTypes: [
    { name: "Office", multiplier: 1, active: true },
    { name: "Retail store", multiplier: 1.15, active: true },
    { name: "Medical clinic", multiplier: 1.4, active: true },
    { name: "Gym", multiplier: 1.25, active: true },
  ],
  condition: [0.9, 1, 1.3],
  addOns: [
    {
      name: "Inside the oven",
      hours: 0.75,
      taxExempt: false,
      services: ["Standard Clean", "Deep Clean", "Move-out Clean"],
      active: true,
    },
    {
      name: "Inside the fridge",
      hours: 0.5,
      taxExempt: false,
      services: ["Standard Clean", "Deep Clean", "Move-out Clean"],
      active: true,
    },
    {
      name: "Interior windows",
      hours: 1,
      taxExempt: false,
      services: ["Deep Clean", "Move-out Clean", "Office Clean"],
      active: true,
    },
    {
      name: "Laundry, wash and fold",
      hours: 1,
      taxExempt: true,
      services: ["Standard Clean"],
      active: true,
    },
  ],
  deposit: 25,
  planDiscount: 10,
  validDays: 30,
  crew: 2,
  feeTax: 8.875,
};

const cases: ListCase[] = [
  saved,
  {
    ...saved,
    key: "2",
    name: "Starting figures",
    placeholder: true,
    saved: "Starting figures",
    premisesTypes: saved.premisesTypes.slice(0, 2),
    addOns: saved.addOns.slice(0, 2),
  },
  {
    ...saved,
    key: "3",
    name: "Long, some retired",
    saved: "Version 11, saved by Sam Chen on Oct 28",
    premisesTypes: [
      ...saved.premisesTypes,
      { name: "Restaurant", multiplier: 1.5, active: true },
      { name: "Warehouse", multiplier: 0.7, active: false },
    ],
    addOns: [
      ...saved.addOns,
      {
        name: "Inside cabinets",
        hours: 1,
        taxExempt: false,
        services: ["Deep Clean", "Move-out Clean"],
        active: true,
      },
      {
        name: "Baseboards by hand",
        hours: 0.75,
        taxExempt: false,
        services: ["Deep Clean"],
        active: true,
      },
      {
        name: "Balcony sweep",
        hours: 0.25,
        taxExempt: false,
        services: ["Standard Clean", "Deep Clean"],
        active: true,
      },
      {
        name: "Carpet shampoo",
        hours: 2,
        taxExempt: false,
        services: ["Deep Clean"],
        active: false,
      },
    ],
  },
];

const layouts = [
  { key: "A", name: "One form, saved at its foot" },
  { key: "B", name: "Read, change a part in a dialog" },
  { key: "C", name: "Two columns, figures right" },
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

const hrs = (h: number) => `${h} h`;
const times = (m: number) => `${m}×`;
const goesWith = (a: AddOn) =>
  a.services.length === services.length
    ? "Every Service"
    : a.services.join(", ");

// ---- the page ----

export function PriceListPrototype() {
  const { case: key = "1", layout = "B" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/price-list",
      search: { case: key, layout, ...search } as never,
    });
  const l = cases.find((x) => x.key === key) ?? saved;

  return (
    <AppLayout
      area="Office"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Office</span>}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Heading level={1}>Price List</Heading>
          <p className="text-fg-muted">
            {l.saved}. Changes price Quotes from now on; Quotes already sent
            keep their prices. Each Service's rate, Minimum Charge and tax are
            on <span className="font-semibold text-primary">Services</span>.
          </p>
        </div>
        {l.placeholder && (
          <Notice tone="warning">
            These are placeholder figures, not Empire Cleaning's. Review each
            one before sending any Quotes.
          </Notice>
        )}
        {layout === "A" && <OneForm l={l} />}
        {layout === "B" && (
          <>
            <AddOns l={l} />
            <PremisesTypes l={l} />
            <Condition l={l} />
            <QuoteDefaults l={l} />
            <FeeTax l={l} />
          </>
        )}
        {layout === "C" && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-6">
              <AddOns l={l} />
              <PremisesTypes l={l} />
            </div>
            <div className="flex flex-col gap-6">
              <Condition l={l} narrow />
              <QuoteDefaults l={l} narrow />
              <FeeTax l={l} />
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
        current={l.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

// ---- A: one form ----

function OneForm({ l }: { l: ListCase }) {
  return (
    <>
      <Section
        title="Add-ons"
        description="Extras a Quote can ask for. Untick Offered to retire one: Quotes that already asked for it still price it."
      >
        <Card>
          <ul className="flex flex-col divide-y divide-border">
            {l.addOns.map((a) => (
              <li
                key={a.name}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="grid gap-3 sm:grid-cols-[2fr_minmax(8rem,1fr)]">
                  <TextField
                    label="Name"
                    defaultValue={a.name}
                    isDisabled={!a.active}
                  />
                  <NumberField
                    label="Hours"
                    defaultValue={a.hours}
                    step={0.05}
                    isDisabled={!a.active}
                  />
                </div>
                <ChipGroup
                  label="Goes with"
                  defaultValue={a.services}
                  isDisabled={!a.active}
                >
                  {services.map((s) => (
                    <Chip key={s} value={s}>
                      {s}
                    </Chip>
                  ))}
                </ChipGroup>
                <div className="flex flex-wrap gap-6">
                  <Checkbox
                    defaultSelected={a.taxExempt}
                    isDisabled={!a.active}
                  >
                    Tax-exempt
                  </Checkbox>
                  <Checkbox defaultSelected={a.active}>Offered</Checkbox>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Button variant="text" size="sm" className="self-start">
          <Plus aria-hidden size={16} />
          Add an Add-on
        </Button>
      </Section>
      <Section
        title="Types of business premises"
        description="How much longer each takes to clean than an office (1×)."
      >
        <Card>
          <ul className="flex flex-col divide-y divide-border">
            {l.premisesTypes.map((t) => (
              <li
                key={t.name}
                className="grid items-end gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[2fr_minmax(8rem,1fr)_auto]"
              >
                <TextField
                  label="Type of premises"
                  defaultValue={t.name}
                  isDisabled={!t.active}
                />
                <NumberField
                  label="Multiplier (×)"
                  defaultValue={t.multiplier}
                  step={0.05}
                  isDisabled={!t.active}
                />
                <Checkbox defaultSelected={t.active}>Offered</Checkbox>
              </li>
            ))}
          </ul>
        </Card>
        <Button variant="text" size="sm" className="self-start">
          <Plus aria-hidden size={16} />
          Add a type of premises
        </Button>
      </Section>
      <Section
        title="Condition"
        description="It multiplies a home's or premises' hours. Add-ons are not multiplied."
      >
        <Card>
          <ConditionFields l={l} />
        </Card>
      </Section>
      <Section
        title="Quote defaults"
        description="What a new Quote starts with; Staff can change them on the Quote."
      >
        <Card>
          <DefaultsFields l={l} />
        </Card>
      </Section>
      <Section
        title="Sales tax on fees"
        description="Added to Late Cancellation and No Access fees."
      >
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Fees (%)"
              defaultValue={l.feeTax}
              step={0.125}
            />
          </div>
        </Card>
      </Section>
      <Actions>
        <Button>Save Price List</Button>
      </Actions>
    </>
  );
}

// ---- B and C: read, then change a part ----

function AddOns({ l }: { l: ListCase }) {
  const [open, setOpen] = useState<AddOn | "new" | null>(null);
  return (
    <Section
      title="Add-ons"
      description="Extras a Quote can ask for, priced by their hours."
      actions={
        <Button variant="text" size="sm" onPress={() => setOpen("new")}>
          <Plus aria-hidden size={16} />
          Add
        </Button>
      }
    >
      <List
        aria-label="Add-ons"
        onAction={(id) => setOpen(l.addOns.find((a) => a.name === id) ?? null)}
      >
        {l.addOns.map((a) => (
          <ListItem
            key={a.name}
            id={a.name}
            title={a.name}
            description={[
              hrs(a.hours),
              goesWith(a),
              a.taxExempt && "Tax-exempt",
            ]
              .filter(Boolean)
              .join(" · ")}
            end={a.active ? undefined : <StatusBadge>Retired</StatusBadge>}
          />
        ))}
      </List>
      {open && (
        <AddOnDialog
          addOn={open === "new" ? null : open}
          close={() => setOpen(null)}
        />
      )}
    </Section>
  );
}

function AddOnDialog({
  addOn,
  close,
}: {
  addOn: AddOn | null;
  close: () => void;
}) {
  return (
    <Dialog
      title={addOn ? addOn.name : "New Add-on"}
      isOpen
      onOpenChange={(o) => !o && close()}
    >
      <TextField label="Name" defaultValue={addOn?.name} />
      <NumberField
        label="Hours"
        description="Not multiplied by Condition."
        defaultValue={addOn?.hours ?? 0.5}
        step={0.05}
      />
      <ChipGroup
        label="Goes with"
        defaultValue={addOn?.services ?? services.slice(0, 3)}
      >
        {services.map((s) => (
          <Chip key={s} value={s}>
            {s}
          </Chip>
        ))}
      </ChipGroup>
      <Checkbox defaultSelected={addOn?.taxExempt}>Tax-exempt</Checkbox>
      {addOn && (
        <Checkbox defaultSelected={addOn.active}>
          Offered: untick to retire it. Quotes that already asked for it still
          price it.
        </Checkbox>
      )}
      <Actions>
        <Button variant="quiet" onPress={close}>
          Cancel
        </Button>
        <Button onPress={close}>{addOn ? "Save Add-on" : "Add Add-on"}</Button>
      </Actions>
    </Dialog>
  );
}

function PremisesTypes({ l }: { l: ListCase }) {
  const [open, setOpen] = useState<PremisesType | "new" | null>(null);
  return (
    <Section
      title="Types of business premises"
      description="How much longer each takes to clean than an office."
      actions={
        <Button variant="text" size="sm" onPress={() => setOpen("new")}>
          <Plus aria-hidden size={16} />
          Add
        </Button>
      }
    >
      <List
        aria-label="Types of business premises"
        onAction={(id) =>
          setOpen(l.premisesTypes.find((t) => t.name === id) ?? null)
        }
      >
        {l.premisesTypes.map((t) => (
          <ListItem
            key={t.name}
            id={t.name}
            title={t.name}
            description={times(t.multiplier)}
            end={t.active ? undefined : <StatusBadge>Retired</StatusBadge>}
          />
        ))}
      </List>
      {open && (
        <Dialog
          title={open === "new" ? "New type of premises" : open.name}
          isOpen
          onOpenChange={(o) => !o && setOpen(null)}
        >
          <TextField
            label="Type of premises"
            defaultValue={open === "new" ? "" : open.name}
          />
          <NumberField
            label="Multiplier (×)"
            description="An office is 1×."
            defaultValue={open === "new" ? 1 : open.multiplier}
            step={0.05}
          />
          {open !== "new" && (
            <Checkbox defaultSelected={open.active}>
              Offered: untick to retire it. Premises of this type still price by
              it.
            </Checkbox>
          )}
          <Actions>
            <Button variant="quiet" onPress={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onPress={() => setOpen(null)}>
              {open === "new" ? "Add type" : "Save type"}
            </Button>
          </Actions>
        </Dialog>
      )}
    </Section>
  );
}

// a Section of facts with an Edit dialog holding their fields
function FiguresPart({
  title,
  description,
  narrow,
  facts,
  fields,
}: {
  title: string;
  description: string;
  narrow?: boolean;
  facts: React.ReactNode;
  fields: React.ReactNode;
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
          className={`grid gap-x-6 gap-y-4 ${narrow ? "" : "sm:grid-cols-2 lg:grid-cols-4"}`}
        >
          {facts}
        </dl>
      </Card>
    </Section>
  );
}

function Condition({ l, narrow }: { l: ListCase; narrow?: boolean }) {
  return (
    <FiguresPart
      title="Condition"
      description="It multiplies a home's or premises' hours. Add-ons are not multiplied."
      narrow={narrow}
      facts={
        <>
          <Fact
            icon={Gauge}
            label="Light"
            value={times(l.condition[0])}
            line="Light"
          />
          <Fact
            icon={Gauge}
            label="Moderate"
            value={times(l.condition[1])}
            line="Moderate"
          />
          <Fact
            icon={Gauge}
            label="Heavy"
            value={times(l.condition[2])}
            line="Heavy"
          />
        </>
      }
      fields={<ConditionFields l={l} />}
    />
  );
}

function QuoteDefaults({ l, narrow }: { l: ListCase; narrow?: boolean }) {
  return (
    <FiguresPart
      title="Quote defaults"
      description="What a new Quote starts with; Staff can change them on the Quote."
      narrow={narrow}
      facts={
        <>
          <Fact
            icon={PiggyBank}
            label="Deposit"
            value={`${l.deposit}%`}
            line="Deposit"
          />
          <Fact
            icon={Percent}
            label="Plan Discount"
            value={`${l.planDiscount}%`}
            line="Plan Discount"
          />
          <Fact
            icon={CalendarClock}
            label="Valid for"
            value={`${l.validDays} days`}
            line="A Quote's valid for"
          />
          <Fact
            icon={UsersRound}
            label="Crew Size"
            value={`${l.crew} Cleaners`}
            line="Crew Size"
          />
        </>
      }
      fields={<DefaultsFields l={l} />}
    />
  );
}

function FeeTax({ l }: { l: ListCase }) {
  return (
    <FiguresPart
      title="Sales tax on fees"
      description="Added to Late Cancellation and No Access fees."
      narrow
      facts={
        <Fact
          icon={Receipt}
          label="Fees"
          value={`${l.feeTax}%`}
          line="On each fee"
        />
      }
      fields={
        <NumberField label="Fees (%)" defaultValue={l.feeTax} step={0.125} />
      }
    />
  );
}

// ---- fields both share ----

function ConditionFields({ l }: { l: ListCase }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <NumberField
        label="Light (×)"
        defaultValue={l.condition[0]}
        step={0.05}
      />
      <NumberField
        label="Moderate (×)"
        defaultValue={l.condition[1]}
        step={0.05}
      />
      <NumberField
        label="Heavy (×)"
        defaultValue={l.condition[2]}
        step={0.05}
      />
    </div>
  );
}

function DefaultsFields({ l }: { l: ListCase }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField label="Deposit (%)" defaultValue={l.deposit} />
      <NumberField label="Plan Discount (%)" defaultValue={l.planDiscount} />
      <NumberField label="Quote valid for (days)" defaultValue={l.validDays} />
      <NumberField label="Crew Size" defaultValue={l.crew} />
    </div>
  );
}
