import { useState, type ReactNode } from "react";
import { Link, useLoaderData } from "@tanstack/react-router";
import {
  CalendarClock,
  Gauge,
  Percent,
  PiggyBank,
  Plus,
  Receipt,
  SquarePen,
  UsersRound,
} from "lucide-react";
import type {
  PriceList,
  PriceListAddOn,
  PriceListPremisesType,
  Service,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  List,
  ListItem,
  Notice,
  NumberField,
  Section,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { putJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { formatDate } from "../format.ts";
import { Fact } from "../Fact.tsx";

// what's saved: every save is the whole list, as a new version
type Draft = Omit<
  PriceList,
  | "id"
  | "version"
  | "placeholder"
  | "createdAt"
  | "createdByName"
  | "addOns"
  | "premisesTypes"
> & {
  addOns: PriceListAddOn[];
  premisesTypes: PriceListPremisesType[];
};

const toDraft = (list: PriceList): Draft => {
  const {
    id: _id,
    version: _version,
    placeholder: _placeholder,
    createdAt: _createdAt,
    createdByName: _createdByName,
    ...figures
  } = list;
  return figures;
};

const rate = { maximumFractionDigits: 3 } as const;
const times = (multiplier: number) => `${multiplier}×`;

// The Price List read part by part: a row per Add-on and type of premises,
// each opening its dialog, and the other figures as facts, each part changed
// in its own dialog. A save is a new version. (UX pass, #96)
export function PriceListScreen() {
  const { list, services } = useLoaderData({ from: "/office/price-list" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} inBar>
          Price List
        </Heading>
        <p className="text-fg-muted">
          {list.placeholder
            ? "Starting figures"
            : `Version ${list.version}, saved by ${list.createdByName ?? "someone"} on ${formatDate(list.createdAt)}`}
          . Changes apply to prices worked out from now on. Quotes already sent
          keep the prices they were sent with. Each Service's hourly rate,
          Minimum Charge and tax are on{" "}
          <Link to="/office/services" className="font-semibold text-primary">
            Services
          </Link>
          .
        </p>
      </div>
      {list.placeholder && <Placeholder list={list} />}
      <AddOns list={list} services={services} />
      <PremisesTypes list={list} />
      <Condition list={list} />
      <QuoteDefaults list={list} />
      <FeeTax list={list} />
    </div>
  );
}

// saves the list with one part changed, closing its dialog once it's saved
const useSave = (list: PriceList) => {
  const action = useAction("The Price List wasn't saved. Please try again.");
  const save = async (change: Partial<Draft>, close?: () => void) => {
    if (
      await action.run(
        () =>
          putJson<PriceList>("/api/price-list", {
            ...toDraft(list),
            ...change,
          }),
        (saved) => `Price List saved as version ${saved.version}`,
      )
    )
      close?.();
  };
  return { action, save };
};

// the starting figures can be kept as they are, as the first version
function Placeholder({ list }: { list: PriceList }) {
  const { action, save } = useSave(list);
  return (
    <>
      <Notice
        tone="warning"
        action={
          <Button
            variant="text"
            size="sm"
            isPending={action.isPending}
            onPress={() => void save({})}
          >
            Keep these figures
          </Button>
        }
      >
        These are placeholder figures, not Empire Cleaning's. Review each one
        before sending any Quotes.
      </Notice>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
    </>
  );
}

// a part's dialog: its fields, then Cancel and Save
function PartForm({
  action,
  onSave,
  close,
  saveLabel,
  children,
}: {
  action: ReturnType<typeof useSave>["action"];
  onSave: () => void;
  close: () => void;
  saveLabel: string;
  children: ReactNode;
}) {
  return (
    <Form
      validationErrors={action.fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {children}
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" isPending={action.isPending}>
          {saveLabel}
        </Button>
      </Actions>
    </Form>
  );
}

function AddOns({ list, services }: { list: PriceList; services: Service[] }) {
  // the Add-on open, by its place in the list; the next place for a new one
  const [open, setOpen] = useState<number | null>(null);
  const servicesBy = new Map(services.map((s) => [s.key, s.name]));
  const goesWith = (addOn: PriceListAddOn) =>
    addOn.serviceKeys.length
      ? addOn.serviceKeys.map((key) => servicesBy.get(key) ?? key).join(", ")
      : "No Service";

  return (
    <Section
      title="Add-ons"
      description="Extras for homes, businesses or both, priced by their hours. Clients asking about a home see the names of those for homes; business premises' are agreed after a visit."
      actions={
        <Button
          variant="text"
          size="sm"
          onPress={() => setOpen(list.addOns.length)}
        >
          <Plus aria-hidden size={16} />
          Add an Add-on
        </Button>
      }
    >
      {list.addOns.length > 0 && (
        <List aria-label="Add-ons" onAction={(key) => setOpen(Number(key))}>
          {list.addOns.map((addOn, i) => (
            <ListItem
              key={addOn.key}
              id={i}
              title={addOn.name}
              description={[
                `${addOn.hours} h`,
                goesWith(addOn),
                addOn.taxExempt && "Tax-exempt",
              ]
                .filter(Boolean)
                .join(" · ")}
              end={
                addOn.active ? undefined : <StatusBadge>Retired</StatusBadge>
              }
            />
          ))}
        </List>
      )}
      {open !== null && (
        <AddOnDialog
          list={list}
          services={services}
          index={open}
          close={() => setOpen(null)}
        />
      )}
    </Section>
  );
}

function AddOnDialog({
  list,
  services,
  index,
  close,
}: {
  list: PriceList;
  services: Service[];
  index: number;
  close: () => void;
}) {
  const saved = list.addOns[index];
  const [addOn, setAddOn] = useState<PriceListAddOn>(
    () =>
      saved ?? {
        name: "",
        hours: 0.5,
        taxExempt: false,
        // a home's, until Office Staff choose
        serviceKeys: services
          .filter((s) => s.active && s.offeredFor !== "businesses")
          .map((s) => s.key),
        active: true,
      },
  );
  const { action, save } = useSave(list);
  const set = (change: Partial<PriceListAddOn>) =>
    setAddOn((current) => ({ ...current, ...change }));
  // the Services it can go with: those on offer, and any retired one it
  // already does
  const choices = services.filter(
    (s) => s.active || addOn.serviceKeys.includes(s.key),
  );

  return (
    <Dialog
      title={saved ? saved.name : "New Add-on"}
      isOpen
      onOpenChange={(isOpen) => !isOpen && close()}
    >
      <PartForm
        action={action}
        close={close}
        saveLabel={saved ? "Save Add-on" : "Add Add-on"}
        onSave={() =>
          void save(
            {
              addOns: saved
                ? list.addOns.map((a, i) => (i === index ? addOn : a))
                : [...list.addOns, addOn],
            },
            close,
          )
        }
      >
        <TextField
          label="Name"
          name={`addOns.${index}.name`}
          value={addOn.name}
          onChange={(name) => set({ name })}
          isRequired
          autoFocus
        />
        <NumberField
          label="Hours"
          name={`addOns.${index}.hours`}
          description="Not multiplied by Condition."
          minValue={0}
          step={0.05}
          formatOptions={{ maximumFractionDigits: 2 }}
          value={addOn.hours}
          onChange={(hours) => set({ hours })}
        />
        <ChipGroup
          label="Goes with"
          name={`addOns.${index}.serviceKeys`}
          value={addOn.serviceKeys}
          onChange={(serviceKeys) => set({ serviceKeys })}
        >
          {choices.map((s) => (
            <Chip key={s.key} value={s.key}>
              {s.name}
            </Chip>
          ))}
        </ChipGroup>
        <Checkbox
          isSelected={addOn.taxExempt}
          onChange={(taxExempt) => set({ taxExempt })}
        >
          Tax-exempt
        </Checkbox>
        {/* saved: it can only be retired, as Quotes may have asked for it */}
        {saved && (
          <Checkbox
            isSelected={addOn.active}
            onChange={(active) => set({ active })}
          >
            Offered: untick to retire it. Quotes that already asked for it still
            price it.
          </Checkbox>
        )}
      </PartForm>
    </Dialog>
  );
}

function PremisesTypes({ list }: { list: PriceList }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Section
      title="Types of business premises"
      description="How much longer or shorter each takes to clean than an office (1×), for Services priced by area that Condition affects."
      actions={
        <Button
          variant="text"
          size="sm"
          onPress={() => setOpen(list.premisesTypes.length)}
        >
          <Plus aria-hidden size={16} />
          Add a type of premises
        </Button>
      }
    >
      {list.premisesTypes.length > 0 && (
        <List
          aria-label="Types of business premises"
          onAction={(key) => setOpen(Number(key))}
        >
          {list.premisesTypes.map((premisesType, i) => (
            <ListItem
              key={premisesType.key}
              id={i}
              title={premisesType.name}
              description={times(premisesType.multiplier)}
              end={
                premisesType.active ? undefined : (
                  <StatusBadge>Retired</StatusBadge>
                )
              }
            />
          ))}
        </List>
      )}
      {open !== null && (
        <PremisesTypeDialog
          list={list}
          index={open}
          close={() => setOpen(null)}
        />
      )}
    </Section>
  );
}

function PremisesTypeDialog({
  list,
  index,
  close,
}: {
  list: PriceList;
  index: number;
  close: () => void;
}) {
  const saved = list.premisesTypes[index];
  const [premisesType, setPremisesType] = useState<PriceListPremisesType>(
    () => saved ?? { name: "", multiplier: 1, active: true },
  );
  const { action, save } = useSave(list);
  const set = (change: Partial<PriceListPremisesType>) =>
    setPremisesType((current) => ({ ...current, ...change }));

  return (
    <Dialog
      title={saved ? saved.name : "New type of premises"}
      isOpen
      onOpenChange={(isOpen) => !isOpen && close()}
    >
      <PartForm
        action={action}
        close={close}
        saveLabel={saved ? "Save type" : "Add type"}
        onSave={() =>
          void save(
            {
              premisesTypes: saved
                ? list.premisesTypes.map((t, i) =>
                    i === index ? premisesType : t,
                  )
                : [...list.premisesTypes, premisesType],
            },
            close,
          )
        }
      >
        <TextField
          label="Type of premises"
          name={`premisesTypes.${index}.name`}
          value={premisesType.name}
          onChange={(name) => set({ name })}
          isRequired
          autoFocus
        />
        <NumberField
          label="Multiplier (×)"
          name={`premisesTypes.${index}.multiplier`}
          description="An office is 1×."
          minValue={0.1}
          step={0.05}
          formatOptions={{ maximumFractionDigits: 2 }}
          value={premisesType.multiplier}
          onChange={(multiplier) => set({ multiplier })}
        />
        {saved && (
          <Checkbox
            isSelected={premisesType.active}
            onChange={(active) => set({ active })}
          >
            Offered: untick to retire it. Premises of this type still price by
            it.
          </Checkbox>
        )}
        {action.fieldErrors.premisesTypes && (
          <Notice tone="danger">{action.fieldErrors.premisesTypes}</Notice>
        )}
      </PartForm>
    </Dialog>
  );
}

type Numbers = Exclude<keyof Draft, "addOns" | "premisesTypes">;

// a part of plain figures: its facts, and an Edit dialog of their fields
function Figures({
  list,
  title,
  description,
  names,
  facts,
  fields,
}: {
  list: PriceList;
  title: string;
  description: string;
  // the figures the dialog changes
  names: Numbers[];
  facts: ReactNode;
  fields: (
    figures: Partial<Draft>,
    set: (change: Partial<Draft>) => void,
  ) => ReactNode;
}) {
  const pick = () =>
    Object.fromEntries(
      names.map((name) => [name, list[name]]),
    ) as Partial<Draft>;
  const [figures, setFigures] = useState(pick);
  const { action, save } = useSave(list);

  return (
    <Section
      title={title}
      description={description}
      actions={
        <DialogTrigger onOpenChange={(isOpen) => isOpen && setFigures(pick())}>
          <Button variant="text" size="sm" aria-label={`Edit ${title}`}>
            <SquarePen aria-hidden size={16} />
            Edit
          </Button>
          <Dialog title={title}>
            {({ close }) => (
              <PartForm
                action={action}
                close={close}
                saveLabel="Save"
                onSave={() => void save(figures, close)}
              >
                {fields(figures, (change) =>
                  setFigures((current) => ({ ...current, ...change })),
                )}
              </PartForm>
            )}
          </Dialog>
        </DialogTrigger>
      }
    >
      <Card>
        <div className="@container">
          <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
            {facts}
          </dl>
        </div>
      </Card>
    </Section>
  );
}

// a figure's field in a part's dialog
const figure =
  (figures: Partial<Draft>, set: (change: Partial<Draft>) => void) =>
  (
    label: string,
    name: Numbers,
    limits: {
      min?: number;
      max?: number;
      step?: number;
      formatOptions?: Intl.NumberFormatOptions;
    },
  ) => (
    <NumberField
      label={label}
      name={name}
      minValue={limits.min}
      maxValue={limits.max}
      step={limits.step}
      formatOptions={limits.formatOptions}
      value={figures[name] as number}
      onChange={(value) => set({ [name]: value })}
    />
  );

const multiplier = {
  min: 0.1,
  step: 0.05,
  formatOptions: { maximumFractionDigits: 2 },
};

function Condition({ list }: { list: PriceList }) {
  return (
    <Figures
      list={list}
      title="Condition"
      description="It multiplies a home's or premises' hours, for Services that Condition affects. Add-ons are not multiplied."
      names={["conditionLight", "conditionModerate", "conditionHeavy"]}
      facts={
        <>
          <Fact
            icon={Gauge}
            label="Light Condition"
            value={times(list.conditionLight)}
            line="Light"
          />
          <Fact
            icon={Gauge}
            label="Moderate Condition"
            value={times(list.conditionModerate)}
            line="Moderate"
          />
          <Fact
            icon={Gauge}
            label="Heavy Condition"
            value={times(list.conditionHeavy)}
            line="Heavy"
          />
        </>
      }
      fields={(figures, set) => {
        const field = figure(figures, set);
        return (
          <div className="grid gap-4 sm:grid-cols-3">
            {field("Light (×)", "conditionLight", multiplier)}
            {field("Moderate (×)", "conditionModerate", multiplier)}
            {field("Heavy (×)", "conditionHeavy", multiplier)}
          </div>
        );
      }}
    />
  );
}

function QuoteDefaults({ list }: { list: PriceList }) {
  return (
    <Figures
      list={list}
      title="Quote defaults"
      description="What a new Quote starts with; Staff can change them on the Quote."
      names={[
        "depositPercent",
        "planDiscountPercent",
        "quoteValidityDays",
        "defaultCrewSize",
      ]}
      facts={
        <>
          <Fact
            icon={PiggyBank}
            label="Deposit"
            value={`${list.depositPercent}%`}
          />
          <Fact
            icon={Percent}
            label="Plan Discount"
            value={`${list.planDiscountPercent}%`}
          />
          <Fact
            icon={CalendarClock}
            label="Quote valid for"
            value={`${list.quoteValidityDays} days`}
            line="A Quote's valid for"
          />
          <Fact
            icon={UsersRound}
            label="Crew Size"
            value={`${list.defaultCrewSize} ${list.defaultCrewSize === 1 ? "Cleaner" : "Cleaners"}`}
          />
        </>
      }
      fields={(figures, set) => {
        const field = figure(figures, set);
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            {field("Deposit (%)", "depositPercent", { min: 0, max: 100 })}
            {field("Plan Discount (%)", "planDiscountPercent", {
              min: 0,
              max: 100,
            })}
            {field("Quote valid for (days)", "quoteValidityDays", {
              min: 1,
              max: 365,
            })}
            {field("Crew Size", "defaultCrewSize", { min: 1, max: 20 })}
          </div>
        );
      }}
    />
  );
}

function FeeTax({ list }: { list: PriceList }) {
  return (
    <Figures
      list={list}
      title="Sales tax on fees"
      description="Added to Late Cancellation and No Access fees. Each Service has its own rates for its Jobs. Confirm these with your accountant."
      names={["taxFeePercent"]}
      facts={
        <Fact
          icon={Receipt}
          label="Sales tax on fees"
          value={`${list.taxFeePercent}%`}
          line="On each fee"
        />
      }
      fields={(figures, set) =>
        figure(figures, set)("Fees (%)", "taxFeePercent", {
          min: 0,
          step: 0.125,
          formatOptions: rate,
        })
      }
    />
  );
}
