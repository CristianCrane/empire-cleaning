import { useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type {
  OfferedFor,
  PriceList,
  PriceListAddOn,
  PriceListPremisesType,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Form,
  Heading,
  Notice,
  NumberField,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { putJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { formatDate } from "../format.ts";

// Money is shown in dollars and kept in cents; a draft is what's on screen.
type Draft = Omit<
  PriceList,
  | "id"
  | "version"
  | "placeholder"
  | "createdAt"
  | "createdByName"
  | "hourlyRateCents"
  | "commercialHourlyRateCents"
  | "minimumChargeCents"
  | "addOns"
  | "premisesTypes"
> & {
  hourlyRate: number;
  commercialHourlyRate: number;
  minimumCharge: number;
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
    hourlyRateCents,
    commercialHourlyRateCents,
    minimumChargeCents,
    addOns,
    premisesTypes,
    ...figures
  } = list;
  return {
    ...figures,
    hourlyRate: hourlyRateCents / 100,
    commercialHourlyRate: commercialHourlyRateCents / 100,
    minimumCharge: minimumChargeCents / 100,
    addOns,
    premisesTypes,
  };
};

const toInput = ({
  hourlyRate,
  commercialHourlyRate,
  minimumCharge,
  ...rest
}: Draft) => ({
  ...rest,
  hourlyRateCents: Math.round(hourlyRate * 100),
  commercialHourlyRateCents: Math.round(commercialHourlyRate * 100),
  minimumChargeCents: Math.round(minimumCharge * 100),
});

const offeredForLabel: Record<OfferedFor, string> = {
  homes: "Homes",
  businesses: "Businesses",
  both: "Homes and businesses",
};

const dollars = { style: "currency", currency: "USD" } as const;
const rate = { maximumFractionDigits: 3 } as const;

export function PriceListScreen() {
  const list = useLoaderData({ from: "/office/price-list" });

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Price List</Heading>
      <p className="text-fg-muted">
        {list.placeholder
          ? "Starting figures"
          : `Version ${list.version}, saved by ${list.createdByName ?? "someone"} on ${formatDate(list.createdAt)}`}
        . Changes apply to prices worked out from now on. Quotes already sent
        keep the prices they were sent with.
      </p>
      {list.placeholder && (
        <Notice>
          These are placeholder figures, not Empire Cleaning's. Review each one
          and save before sending any Quotes.
        </Notice>
      )}
      {/* a new version starts the form afresh, with the keys the server gave */}
      <Editor key={list.version} list={list} />
    </div>
  );
}

function Editor({ list }: { list: PriceList }) {
  const [draft, setDraft] = useState(() => toDraft(list));
  const action = useAction("The Price List wasn't saved. Please try again.");

  const set = (change: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...change }));
  const setAddOn = (index: number, change: Partial<PriceListAddOn>) =>
    set({
      addOns: draft.addOns.map((a, i) =>
        i === index ? { ...a, ...change } : a,
      ),
    });
  const setPremisesType = (
    index: number,
    change: Partial<PriceListPremisesType>,
  ) =>
    set({
      premisesTypes: draft.premisesTypes.map((t, i) =>
        i === index ? { ...t, ...change } : t,
      ),
    });

  const save = () =>
    action.run(
      () => putJson<PriceList>("/api/price-list", toInput(draft)),
      (saved) => `Price List saved as version ${saved.version}`,
    );

  return (
    <Form
      validationErrors={action.fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Card
        title="Rates"
        headingLevel={2}
        description="What an hour of Labour costs, before tax: at a home, and at business premises."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Residential hourly rate"
            name="hourlyRateCents"
            minValue={1}
            formatOptions={dollars}
            value={draft.hourlyRate}
            onChange={(hourlyRate) => set({ hourlyRate })}
          />
          <NumberField
            label="Commercial hourly rate"
            name="commercialHourlyRateCents"
            minValue={1}
            formatOptions={dollars}
            value={draft.commercialHourlyRate}
            onChange={(commercialHourlyRate) => set({ commercialHourlyRate })}
          />
          <NumberField
            label="Minimum Charge"
            name="minimumChargeCents"
            description="No Suggested Price is lower. You can still override it on a Quote."
            minValue={0}
            formatOptions={dollars}
            value={draft.minimumCharge}
            onChange={(minimumCharge) => set({ minimumCharge })}
          />
        </div>
      </Card>

      <Card
        title="Hours for a home"
        headingLevel={2}
        description="How long a home takes before Condition and Clean Type apply."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Hours
            label="Base hours"
            name="baseHours"
            description="Kitchen, living areas and entry, for every home"
            draft={draft}
            set={set}
          />
          <Hours
            label="Per bedroom"
            name="bedroomHours"
            draft={draft}
            set={set}
          />
          <Hours
            label="Per bathroom"
            name="bathroomHours"
            draft={draft}
            set={set}
          />
          <Hours
            label="Per extra floor"
            name="extraStoreyHours"
            description="For each floor above the first"
            draft={draft}
            set={set}
          />
          <Hours
            label="Pets"
            name="petHours"
            description="Added once if there are pets"
            draft={draft}
            set={set}
          />
        </div>
      </Card>

      <Card
        title="Hours for business premises"
        headingLevel={2}
        description="How long each 1,000 sq ft of each type of premises takes, before Condition and Clean Type apply. Retire a type to stop offering it: premises of that type still price by it."
      >
        <ul className="flex flex-col gap-4">
          {draft.premisesTypes.map((premisesType, i) => (
            <li
              key={premisesType.key ?? `new-${i}`}
              className={`flex flex-col gap-3 rounded-md border border-border p-3 ${premisesType.active ? "" : "bg-surface-sunken"}`}
            >
              <div className="grid gap-3 sm:grid-cols-[2fr_minmax(10rem,1fr)]">
                <TextField
                  label="Type of premises"
                  name={`premisesTypes.${i}.name`}
                  value={premisesType.name}
                  isDisabled={!premisesType.active}
                  onChange={(name) => setPremisesType(i, { name })}
                />
                <NumberField
                  label="Hours per 1,000 sq ft"
                  name={`premisesTypes.${i}.hoursPerThousandSqFt`}
                  minValue={0.01}
                  step={0.05}
                  formatOptions={{ maximumFractionDigits: 2 }}
                  isDisabled={!premisesType.active}
                  value={premisesType.hoursPerThousandSqFt}
                  onChange={(hoursPerThousandSqFt) =>
                    setPremisesType(i, { hoursPerThousandSqFt })
                  }
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!premisesType.active && <StatusBadge>Retired</StatusBadge>}
                {premisesType.key ? (
                  <Button
                    variant="quiet"
                    size="sm"
                    aria-label={`${premisesType.active ? "Retire" : "Restore"} ${premisesType.name || "this type"}`}
                    onPress={() =>
                      setPremisesType(i, { active: !premisesType.active })
                    }
                  >
                    {premisesType.active ? "Retire" : "Restore"}
                  </Button>
                ) : (
                  // not saved yet: no premises are of it, so it can just go
                  <Button
                    variant="quiet"
                    size="sm"
                    aria-label={`Remove ${premisesType.name || "this type"}`}
                    onPress={() =>
                      set({
                        premisesTypes: draft.premisesTypes.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {action.fieldErrors.premisesTypes && (
          <Notice tone="danger">{action.fieldErrors.premisesTypes}</Notice>
        )}
        <Button
          variant="secondary"
          className="self-start"
          onPress={() =>
            set({
              premisesTypes: [
                ...draft.premisesTypes,
                { name: "", hoursPerThousandSqFt: 0.5, active: true },
              ],
            })
          }
        >
          <Plus aria-hidden size={18} />
          Add a type of premises
        </Button>
      </Card>

      <Card
        title="Multipliers"
        headingLevel={2}
        description="They multiply a home's or premises' hours. Add-ons are not multiplied."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Multiplier
            label="Light Condition"
            name="conditionLight"
            draft={draft}
            set={set}
          />
          <Multiplier
            label="Moderate Condition"
            name="conditionModerate"
            draft={draft}
            set={set}
          />
          <Multiplier
            label="Heavy Condition"
            name="conditionHeavy"
            draft={draft}
            set={set}
          />
          <Multiplier
            label="Deep Clean"
            name="deepCleanMultiplier"
            description="A Standard Clean is 1"
            draft={draft}
            set={set}
          />
        </div>
      </Card>

      <Card
        title="Add-ons"
        headingLevel={2}
        description="Extras for homes, businesses or both. Clients asking about a home see the names of those for homes; the price is on the Quote. Business premises' are agreed after a visit. Retire one to stop offering it: Quotes that already asked for it still price it."
      >
        <ul className="flex flex-col gap-4">
          {draft.addOns.map((addOn, i) => (
            <li
              key={addOn.key ?? `new-${i}`}
              className={`flex flex-col gap-3 rounded-md border border-border p-3 ${addOn.active ? "" : "bg-surface-sunken"}`}
            >
              <div className="grid gap-3 sm:grid-cols-[2fr_minmax(10rem,1fr)]">
                <TextField
                  label="Name"
                  name={`addOns.${i}.name`}
                  value={addOn.name}
                  isDisabled={!addOn.active}
                  onChange={(name) => setAddOn(i, { name })}
                />
                <NumberField
                  label="Hours"
                  name={`addOns.${i}.hours`}
                  minValue={0}
                  step={0.25}
                  formatOptions={{ maximumFractionDigits: 2 }}
                  isDisabled={!addOn.active}
                  value={addOn.hours}
                  onChange={(hours) => setAddOn(i, { hours })}
                />
              </div>
              <Select
                label="Offered for"
                name={`addOns.${i}.offeredFor`}
                isDisabled={!addOn.active}
                selectedKey={addOn.offeredFor}
                onSelectionChange={(key) =>
                  setAddOn(i, { offeredFor: key as OfferedFor })
                }
              >
                {(["homes", "businesses", "both"] as const).map((k) => (
                  <SelectItem key={k} id={k}>
                    {offeredForLabel[k]}
                  </SelectItem>
                ))}
              </Select>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox
                  isSelected={addOn.taxExempt}
                  isDisabled={!addOn.active}
                  onChange={(taxExempt) => setAddOn(i, { taxExempt })}
                >
                  Tax-exempt
                </Checkbox>
                <div className="flex items-center gap-2">
                  {!addOn.active && <StatusBadge>Retired</StatusBadge>}
                  {addOn.key ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      aria-label={`${addOn.active ? "Retire" : "Restore"} ${addOn.name || "this Add-on"}`}
                      onPress={() => setAddOn(i, { active: !addOn.active })}
                    >
                      {addOn.active ? "Retire" : "Restore"}
                    </Button>
                  ) : (
                    // not saved yet: nothing has chosen it, so it can just go
                    <Button
                      variant="quiet"
                      size="sm"
                      aria-label={`Remove ${addOn.name || "this Add-on"}`}
                      onPress={() =>
                        set({ addOns: draft.addOns.filter((_, j) => j !== i) })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          className="self-start"
          onPress={() =>
            set({
              addOns: [
                ...draft.addOns,
                {
                  name: "",
                  hours: 0.5,
                  taxExempt: false,
                  offeredFor: "homes",
                  active: true,
                },
              ],
            })
          }
        >
          <Plus aria-hidden size={18} />
          Add an Add-on
        </Button>
      </Card>

      <Card
        title="Quote defaults"
        headingLevel={2}
        description="What a new Quote starts with; Staff can change them on the Quote."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Whole
            label="Deposit (%)"
            name="depositPercent"
            draft={draft}
            set={set}
            max={100}
          />
          <Whole
            label="Plan Discount (%)"
            name="planDiscountPercent"
            draft={draft}
            set={set}
            max={100}
          />
          <Whole
            label="Quote valid for (days)"
            name="quoteValidityDays"
            draft={draft}
            set={set}
            max={365}
            min={1}
          />
          <Whole
            label="Crew Size"
            name="defaultCrewSize"
            draft={draft}
            set={set}
            max={20}
            min={1}
          />
        </div>
      </Card>

      <Card
        title="Sales tax"
        headingLevel={2}
        description="Added to the rates above, so Clients see prices with tax. Confirm these with your accountant."
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
          <Tax
            label="Residential one-off Jobs (%)"
            name="taxOneOffPercent"
            draft={draft}
            set={set}
          />
          <Tax
            label="Residential Service Plan Jobs (%)"
            name="taxServicePlanPercent"
            draft={draft}
            set={set}
          />
          <Tax
            label="Commercial Jobs (%)"
            name="taxCommercialPercent"
            draft={draft}
            set={set}
          />
          <Tax label="Fees (%)" name="taxFeePercent" draft={draft} set={set} />
        </div>
      </Card>

      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button type="submit" isPending={action.isPending}>
          Save Price List
        </Button>
      </Actions>
    </Form>
  );
}

type Numbers = Exclude<keyof Draft, "addOns" | "premisesTypes">;
type FieldProps = {
  label: string;
  name: Numbers;
  description?: string;
  draft: Draft;
  set: (change: Partial<Draft>) => void;
};

const Hours = ({ label, name, description, draft, set }: FieldProps) => (
  <NumberField
    label={`${label} (hours)`}
    name={name}
    description={description}
    minValue={0}
    step={0.25}
    formatOptions={{ maximumFractionDigits: 2 }}
    value={draft[name] as number}
    onChange={(value) => set({ [name]: value })}
  />
);

const Multiplier = ({ label, name, description, draft, set }: FieldProps) => (
  <NumberField
    label={`${label} (×)`}
    name={name}
    description={description}
    minValue={0.1}
    step={0.05}
    formatOptions={{ maximumFractionDigits: 2 }}
    value={draft[name] as number}
    onChange={(value) => set({ [name]: value })}
  />
);

const Whole = ({
  label,
  name,
  draft,
  set,
  max,
  min = 0,
}: FieldProps & { max: number; min?: number }) => (
  <NumberField
    label={label}
    name={name}
    minValue={min}
    maxValue={max}
    value={draft[name] as number}
    onChange={(value) => set({ [name]: value })}
  />
);

const Tax = ({ label, name, draft, set }: FieldProps) => (
  <NumberField
    label={label}
    name={name}
    minValue={0}
    step={0.125}
    formatOptions={rate}
    value={draft[name] as number}
    onChange={(value) => set({ [name]: value })}
  />
);
