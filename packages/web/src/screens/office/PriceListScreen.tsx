import { firstNameOf, formats, inLine } from "@empire-cleaning/models";
import { useState, type ReactNode } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type {
  PriceList,
  PriceListAddOn,
  PriceListPremisesType,
  Service,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  Dialog,
  Form,
  Notice,
  NumberField,
  SettingsList,
  SettingsPage,
  StatusBadge,
  TextField,
  type ListRow,
  type SettingsPart,
  FieldRow,
  Line,
} from "@empire-cleaning/ui";
import { putJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { useDraftOf } from "./draft.ts";
import { dayOfInstant, screenWords, typedHours } from "../format.ts";

const { cleaners, conditionLabel } = screenWords.en;

const { formatShortDay } = formats.en;

// what's saved: every save is the whole list, as a new version, with the
// version it was made from
type Draft = Omit<
  PriceList,
  | "id"
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
    placeholder: _placeholder,
    createdAt: _createdAt,
    createdByName: _createdByName,
    ...figures
  } = list;
  return figures;
};

const rate = { maximumFractionDigits: 3 } as const;
const times = (multiplier: number) => `${multiplier}×`;

// what a change to the prices touches, here and on Services
export const PRICES_CHANGE =
  "Changes apply to prices worked out from now on. Quotes already sent keep their prices.";

// The Price List, a Settings page (docs/ux.md, Screen types, Settings):
// each part of figures one row saying what it's set to, opening its
// dialog; then the Extras and types of business, a row each opening its
// own. A save is a new version. (#436)
export function PriceListScreen() {
  const { list, services } = useLoaderData({ from: "/office/price-list" });
  // the starting figures can be kept as they are, as the first version
  const keep = useSave(list);

  return (
    <SettingsPage
      title="Prices"
      subtitle={
        list.placeholder
          ? "Starting figures"
          : `Version ${list.version} · saved ${formatShortDay(dayOfInstant(list.createdAt))} by ${firstNameOf(list.createdByName ?? "someone")}`
      }
      alerts={[
        list.placeholder && {
          key: "starting",
          tone: "warning",
          children:
            "These are starting figures, not yours. Check each before you send a quote.",
          action: (
            <Button
              variant="text"
              isPending={keep.action.isPending}
              onPress={() => void keep.save({})}
            >
              Keep these figures
            </Button>
          ),
        },
        !!keep.action.problem && {
          key: "problem",
          tone: "danger",
          children: keep.action.problem,
        },
      ]}
      parts={[condition(list), quoteDefaults(list), feeTax(list)]}
    >
      <AddOns list={list} services={services} />
      <PremisesTypes list={list} />
    </SettingsPage>
  );
}

// saves the list with one part changed, closing its dialog once it's saved.
// It reloads on failure too: a save made from a version someone has since
// replaced is refused, and the dialog then shows theirs (useDraftOf)
const useSave = (list: PriceList) => {
  const action = useAction("The prices weren't saved. Please try again.", {
    reloadOnFailure: true,
  });
  const save = async (change: Partial<Draft>, close?: () => void) => {
    if (
      await action.run(
        () =>
          putJson<PriceList>("/api/price-list", {
            ...toDraft(list),
            ...change,
          }),
        (saved) => `Prices saved as version ${saved.version}`,
      )
    )
      close?.();
  };
  return { action, save };
};

// a part's dialog: what it is, its fields, what saving does, then Cancel
// and Save
function PartForm({
  action,
  onSave,
  close,
  saveLabel,
  explain,
  children,
}: {
  action: ReturnType<typeof useSave>["action"];
  onSave: () => void;
  close: () => void;
  saveLabel: string;
  explain?: string;
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
      {explain && <p className="text-fg-muted">{explain}</p>}
      {children}
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <p className="text-sm text-fg-muted">{PRICES_CHANGE}</p>
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

// a Price List list's rows: those offered, then those retired
const offeredAndRetired = <T extends { active: boolean }>(
  items: T[],
  row: (item: T, i: number) => ListRow,
) => {
  const rows = items.map((item, i) => ({ item, row: row(item, i) }));
  return {
    rows: rows.filter((r) => r.item.active).map((r) => r.row),
    retired: rows
      .filter((r) => !r.item.active)
      .map((r) => ({
        ...r.row,
        badges: [<StatusBadge key="retired">Retired</StatusBadge>],
      })),
  };
};

// the item a dialog is open on, by its key (the same in every version), or
// "new"
type Open = string | null;

function AddOns({ list, services }: { list: PriceList; services: Service[] }) {
  const [open, setOpen] = useState<Open>(null);
  const servicesBy = new Map(services.map((s) => [s.key, s.name]));
  const goesWith = (addOn: PriceListAddOn) =>
    addOn.serviceKeys.length
      ? addOn.serviceKeys.map((key) => servicesBy.get(key) ?? key).join(", ")
      : "No service";

  return (
    <>
      <SettingsList
        title="Extras"
        actions={
          <Button variant="text" size="sm" onPress={() => setOpen("new")}>
            <Plus aria-hidden size={16} />
            Add an extra
          </Button>
        }
        empty="No extras yet"
        {...offeredAndRetired(list.addOns, (addOn, i) => ({
          id: String(i),
          title: addOn.name,
          description: (
            <Line
              parts={[
                typedHours(addOn.hours),
                goesWith(addOn),
                addOn.taxExempt && "tax-exempt",
              ]}
            />
          ),
          onOpen: () => setOpen(addOn.key),
        }))}
      />
      {open !== null && (
        <AddOnDialog
          list={list}
          services={services}
          open={open}
          close={() => setOpen(null)}
        />
      )}
    </>
  );
}

function AddOnDialog({
  list,
  services,
  open,
  close,
}: {
  list: PriceList;
  services: Service[];
  open: string;
  close: () => void;
}) {
  const saved = list.addOns.find((a) => a.key === open);
  // its place in what's saved, which the API's field errors name
  const index = saved ? list.addOns.indexOf(saved) : list.addOns.length;
  const [addOn, setAddOn] = useDraftOf<PriceListAddOn>(
    list.version,
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
      title={saved ? saved.name : "New extra"}
      isOpen
      onOpenChange={(isOpen) => !isOpen && close()}
    >
      <PartForm
        action={action}
        close={close}
        saveLabel={saved ? "Save extra" : "Add extra"}
        onSave={() =>
          void save(
            {
              addOns: saved
                ? list.addOns.map((a) => (a.key === saved.key ? addOn : a))
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
        <TextField
          label="Name in Spanish (optional)"
          name={`addOns.${index}.nameEs`}
          description="Shown to clients reading in Spanish. Left blank, they see the English."
          value={addOn.nameEs ?? ""}
          onChange={(nameEs) => set({ nameEs })}
        />
        <NumberField
          label="Hours"
          name={`addOns.${index}.hours`}
          description="Not multiplied by condition."
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
            Offered. Untick to stop offering it. Quotes that already asked for
            it still include it.
          </Checkbox>
        )}
      </PartForm>
    </Dialog>
  );
}

function PremisesTypes({ list }: { list: PriceList }) {
  const [open, setOpen] = useState<Open>(null);

  return (
    <>
      <SettingsList
        title="Types of business"
        actions={
          <Button variant="text" size="sm" onPress={() => setOpen("new")}>
            <Plus aria-hidden size={16} />
            Add a type of business
          </Button>
        }
        empty="No types yet: every business is priced as an office"
        {...offeredAndRetired(list.premisesTypes, (premisesType, i) => ({
          id: String(i),
          title: premisesType.name,
          description: times(premisesType.multiplier),
          onOpen: () => setOpen(premisesType.key),
        }))}
      />
      {open !== null && (
        <PremisesTypeDialog
          list={list}
          open={open}
          close={() => setOpen(null)}
        />
      )}
    </>
  );
}

function PremisesTypeDialog({
  list,
  open,
  close,
}: {
  list: PriceList;
  open: string;
  close: () => void;
}) {
  const saved = list.premisesTypes.find((t) => t.key === open);
  // its place in what's saved, which the API's field errors name
  const index = saved
    ? list.premisesTypes.indexOf(saved)
    : list.premisesTypes.length;
  const [premisesType, setPremisesType] = useDraftOf<PriceListPremisesType>(
    list.version,
    () => saved ?? { name: "", multiplier: 1, active: true },
  );
  const { action, save } = useSave(list);
  const set = (change: Partial<PriceListPremisesType>) =>
    setPremisesType((current) => ({ ...current, ...change }));

  return (
    <Dialog
      title={saved ? saved.name : "New type of business"}
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
                ? list.premisesTypes.map((t) =>
                    t.key === saved.key ? premisesType : t,
                  )
                : [...list.premisesTypes, premisesType],
            },
            close,
          )
        }
      >
        <TextField
          label="Type of business"
          name={`premisesTypes.${index}.name`}
          value={premisesType.name}
          onChange={(name) => set({ name })}
          isRequired
          autoFocus
        />
        <TextField
          label="In Spanish (optional)"
          name={`premisesTypes.${index}.nameEs`}
          description="Shown to clients reading in Spanish. Left blank, they see the English."
          value={premisesType.nameEs ?? ""}
          onChange={(nameEs) => set({ nameEs })}
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
            Offered. Untick to stop offering it. Businesses of this type still
            price by it.
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

type Fields = (
  figures: Partial<Draft>,
  set: (change: Partial<Draft>) => void,
) => ReactNode;

// a part of plain figures: one row saying what they're set to, opening a
// dialog of their fields with what they're for
const figuresPart = (
  list: PriceList,
  part: {
    id: string;
    title: string;
    summary: ReactNode;
    explain: string;
    // the figures the dialog changes
    names: Numbers[];
    fields: Fields;
  },
): SettingsPart => ({
  id: part.id,
  title: part.title,
  summary: part.summary,
  dialog: (state) => (
    <Dialog title={part.title} {...state}>
      {({ close }) => <FiguresForm list={list} close={close} {...part} />}
    </Dialog>
  ),
});

function FiguresForm({
  list,
  names,
  explain,
  fields,
  close,
}: {
  list: PriceList;
  names: Numbers[];
  explain: string;
  fields: Fields;
  close: () => void;
}) {
  const [figures, setFigures] = useDraftOf(
    list.version,
    () =>
      Object.fromEntries(
        names.map((name) => [name, list[name]]),
      ) as Partial<Draft>,
  );
  const { action, save } = useSave(list);
  return (
    <PartForm
      action={action}
      close={close}
      saveLabel="Save"
      explain={explain}
      onSave={() => void save(figures, close)}
    >
      {fields(figures, (change) =>
        setFigures((current) => ({ ...current, ...change })),
      )}
    </PartForm>
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
      key={name}
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

// each level of Condition, and the Price List's figure for it
const conditionFigures = [
  ["light", "conditionLight"],
  ["moderate", "conditionModerate"],
  ["heavy", "conditionHeavy"],
] as const;

const condition = (list: PriceList) =>
  figuresPart(list, {
    id: "condition",
    title: "Condition",
    summary: (
      <Line
        parts={conditionFigures.map(([c, name], i) => {
          const figure = `${conditionLabel[c]} ${times(list[name])}`;
          // each after the first reads on from its dot
          return i > 0 ? inLine(figure) : figure;
        })}
      />
    ),
    explain:
      "It multiplies a home's or business's hours, for services that condition affects. Extras aren't multiplied.",
    names: ["conditionLight", "conditionModerate", "conditionHeavy"],
    fields: (figures, set) => {
      const field = figure(figures, set);
      return (
        <FieldRow>
          {conditionFigures.map(([c, name]) =>
            field(`${conditionLabel[c]} (×)`, name, multiplier),
          )}
        </FieldRow>
      );
    },
  });

const quoteDefaults = (list: PriceList) =>
  figuresPart(list, {
    id: "quote-defaults",
    title: "Quote defaults",
    summary: (
      <Line
        parts={[
          `${list.depositPercent}% deposit`,
          `${list.planDiscountPercent}% plan discount`,
          `valid for ${list.quoteValidityDays} days`,
          cleaners(list.defaultCrewSize),
        ]}
      />
    ),
    explain: "What a new quote starts with. You can change them on the quote.",
    names: [
      "depositPercent",
      "planDiscountPercent",
      "quoteValidityDays",
      "defaultCrewSize",
    ],
    fields: (figures, set) => {
      const field = figure(figures, set);
      return (
        <FieldRow>
          {field("Deposit (%)", "depositPercent", { min: 0, max: 100 })}
          {field("Plan discount (%)", "planDiscountPercent", {
            min: 0,
            max: 100,
          })}
          {field("Quote valid for (days)", "quoteValidityDays", {
            min: 1,
            max: 90,
          })}
          {field("Cleaners", "defaultCrewSize", { min: 1, max: 10 })}
        </FieldRow>
      );
    },
  });

const feeTax = (list: PriceList) =>
  figuresPart(list, {
    id: "fee-tax",
    title: "Sales tax on fees",
    summary: `${list.taxFeePercent}%`,
    explain:
      "Added to late cancellation and couldn't-get-in fees. Each service has its own rates for its jobs. Check these with your accountant.",
    names: ["taxFeePercent"],
    fields: (figures, set) =>
      figure(figures, set)("Fees (%)", "taxFeePercent", {
        min: 0,
        step: 0.125,
        formatOptions: rate,
      }),
  });
