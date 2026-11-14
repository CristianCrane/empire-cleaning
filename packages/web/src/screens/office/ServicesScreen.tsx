import { formats } from "@empire-cleaning/models";
import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Plus, Sparkles } from "lucide-react";
import type {
  OfferedFor,
  PriceList,
  PricingMethod,
  RoomHours,
  Service,
  ServiceInput,
} from "@empire-cleaning/models";
import {
  Button,
  Checkbox,
  Form,
  FormPage,
  FormPart,
  ListPage,
  Notice,
  NumberField,
  Segment,
  SegmentedControl,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { postJson, putJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { tabShown, useListUrl } from "../list-search.ts";
import { ExampleQuote } from "./ExampleQuote.tsx";
import { PRICES_CHANGE } from "./PriceListScreen.tsx";

const { formatDate, formatMoney } = formats.en;

const methodLabel: Record<PricingMethod, string> = {
  rooms: "From a home's rooms",
  area: "By area",
};

const offeredForLabel: Record<OfferedFor, string> = {
  homes: "Homes",
  businesses: "Businesses",
  both: "Both",
};

// in a line of what's set
const offeredForSaid: Record<OfferedFor, string> = {
  homes: "homes",
  businesses: "businesses",
  both: "homes and businesses",
};

// the list's Tabs: what's on offer, then what was
export const serviceTabs = ["offered", "retired"] as const;
type ServiceTab = (typeof serviceTabs)[number];

// What Empire Cleaning sells (ADR-0018, #433), a List: the Services on
// offer, and a Tab for those retired
export function ServicesScreen() {
  const services = useLoaderData({ from: "/office/services" });
  const url = useListUrl<ServiceTab>();
  const navigate = useNavigate();
  const inTab = (tab: ServiceTab) =>
    services.filter((s) => s.active === (tab === "offered"));
  const tab = tabShown(serviceTabs, url.tab, (t) => inTab(t).length);

  return (
    <ListPage
      title="Services"
      primary={{
        label: "New service",
        icon: Plus,
        href: linkTo({ to: "/office/services/new" }),
      }}
      tabs={[
        {
          id: "offered",
          label: "Offered",
          count: inTab("offered").length,
          none: "No services offered.",
        },
        {
          id: "retired",
          label: "Retired",
          count: inTab("retired").length,
          none: "None retired.",
        },
      ]}
      tab={tab}
      onTabChange={url.onTabChange}
      items={inTab(tab)}
      row={(service) => ({
        id: service.key,
        title: service.name,
        description: `${methodLabel[service.method]} · ${formatMoney(service.hourlyRateCents)} an hour`,
        onOpen: () =>
          void navigate({
            to: "/office/services/$serviceKey",
            params: { serviceKey: service.key },
          }),
      })}
      columns={[
        { id: "name", label: "Service", cell: (service) => service.name },
        {
          id: "method",
          label: "Priced",
          cell: (service) => methodLabel[service.method],
        },
        {
          id: "rate",
          label: "Hourly rate",
          cell: (service) => (
            <span className="whitespace-nowrap">
              {formatMoney(service.hourlyRateCents)}
            </span>
          ),
        },
      ]}
      empty={{ icon: Sparkles, title: "No services yet" }}
    />
  );
}

// one Service: its figures, saved as a new version, and retiring it
export function ServiceScreen() {
  const { service, services, list } = useLoaderData({
    from: "/office/services/$serviceKey",
  });

  return (
    // a new version starts the form afresh
    <ServiceForm
      key={service.id}
      service={service}
      services={services}
      list={list}
    />
  );
}

export function NewServiceScreen() {
  const { services, list } = useLoaderData({ from: "/office/services/new" });

  return <ServiceForm services={services} list={list} />;
}

// Money is shown in dollars and kept in cents; a draft is what's on screen
type Draft = Omit<ServiceInput, "hourlyRateCents" | "minimumChargeCents"> & {
  hourlyRate: number;
  minimumCharge: number;
};

// a Standard Clean's, to start from
const startingRoomHours: RoomHours = {
  baseHours: 1,
  bedroomHours: 0.5,
  bathroomHours: 0.75,
  extraStoreyHours: 0.5,
  petHours: 0.5,
};

const blank: ServiceInput = {
  name: "",
  description: "",
  offeredFor: "homes",
  method: "rooms",
  roomHours: startingRoomHours,
  hoursPerThousandSqFt: null,
  hourlyRateCents: 5500,
  minimumChargeCents: 10000,
  taxOneOffPercent: 8.875,
  taxPlanPercent: null,
  conditionApplies: true,
  canRecur: false,
  needsSiteVisit: false,
  firstVisitServiceKey: null,
  active: true,
};

const toDraft = ({
  hourlyRateCents,
  minimumChargeCents,
  ...rest
}: ServiceInput): Draft => ({
  ...rest,
  hourlyRate: hourlyRateCents / 100,
  minimumCharge: minimumChargeCents / 100,
});

const toInput = ({
  hourlyRate,
  minimumCharge,
  ...rest
}: Draft): ServiceInput => ({
  ...rest,
  hourlyRateCents: Math.round(hourlyRate * 100),
  minimumChargeCents: Math.round(minimumCharge * 100),
});

const inputOf = ({
  key: _key,
  id: _id,
  version: _version,
  createdAt: _createdAt,
  createdByName: _createdByName,
  ...input
}: Service): ServiceInput => input;

const dollars = { style: "currency", currency: "USD" } as const;
const rate = { maximumFractionDigits: 3 } as const;
const NONE = "none";

function ServiceForm({
  service,
  services,
  list,
}: {
  service?: Service;
  services: Service[];
  list: PriceList;
}) {
  const [draft, setDraft] = useState(() =>
    toDraft(service ? inputOf(service) : blank),
  );
  const action = useAction("The service wasn't saved. Please try again.");
  // the header's, so why it failed is a Toast. While either runs, both
  // are pending and take no press, so they can't race to make the next
  // version
  const retire = useAction("The service wasn't saved. Please try again.", {
    toast: true,
  });
  const navigate = useNavigate();
  const set = (change: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...change }));
  const others = services.filter((s) => s.active && s.key !== service?.key);

  const save = async (input: ServiceInput, done: string) => {
    let saved: Service | undefined;
    const ok = await action.run(async () => {
      saved = service
        ? await putJson<Service>(`/api/services/${service.key}`, input)
        : await postJson<Service>("/api/services", input);
    }, done);
    if (ok && !service && saved) {
      await navigate({
        to: "/office/services/$serviceKey",
        params: { serviceKey: saved.key },
      });
    }
  };

  // homes are described by their rooms; business premises only by area
  const setOfferedFor = (offeredFor: OfferedFor) =>
    set({
      offeredFor,
      ...(offeredFor !== "homes" && {
        method: "area",
        hoursPerThousandSqFt: draft.hoursPerThousandSqFt ?? 0.5,
      }),
    });
  const setRoomHours = (change: Partial<RoomHours>) =>
    set({
      roomHours: { ...(draft.roomHours ?? startingRoomHours), ...change },
    });
  const setMethod = (method: PricingMethod) =>
    set(
      method === "rooms"
        ? { method, roomHours: draft.roomHours ?? startingRoomHours }
        : { method, hoursPerThousandSqFt: draft.hoursPerThousandSqFt ?? 0.5 },
    );

  const firstVisit = others.find((s) => s.key === draft.firstVisitServiceKey);

  return (
    <Form
      validationErrors={action.fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          toInput(draft),
          service ? `Service saved. ${PRICES_CHANGE}` : `${draft.name} added`,
        );
      }}
    >
      <FormPage
        trail={[
          { label: "Services", href: linkTo({ to: "/office/services" }) },
          { label: service?.name ?? "New service" },
        ]}
        title={service?.name ?? "New service"}
        status={
          service && !service.active && <StatusBadge>Retired</StatusBadge>
        }
        subtitle={
          service &&
          `Version ${service.version}, saved${service.createdByName ? ` by ${service.createdByName}` : ""} on ${formatDate(service.createdAt)}.`
        }
        actions={[
          service && {
            label: service.active ? "Retire" : "Offer again",
            icon: service.active ? Archive : ArchiveRestore,
            danger: service.active,
            isPending: retire.isPending || action.isPending,
            onAction: () =>
              void retire.run(
                () =>
                  putJson<Service>(`/api/services/${service.key}`, {
                    ...inputOf(service),
                    active: !service.active,
                  }),
                service.active
                  ? `${service.name} retired. Quotes, plans and jobs that used it still price by it.`
                  : `${service.name} offered again`,
              ),
          },
        ]}
        // the figures as a Quote, beside them as they're typed
        aside={{
          title: "Example quote",
          children: (
            <ExampleQuote
              input={toInput(draft)}
              saved={service && inputOf(service)}
              list={list}
            />
          ),
        }}
        end={action.problem && <Notice tone="danger">{action.problem}</Notice>}
        buttons={
          <Button
            type="submit"
            isPending={action.isPending || retire.isPending}
          >
            {service ? "Save service" : "Add service"}
          </Button>
        }
      >
        {/* set once, so folded on a Service; a new one starts here */}
        <FormPart
          title="What it is"
          summary={
            service &&
            [
              draft.name,
              offeredForSaid[draft.offeredFor],
              ...(draft.nameEs ? ["in Spanish too"] : []),
            ].join(" · ")
          }
        >
          <TextField
            label="Name"
            name="name"
            isRequired
            value={draft.name}
            onChange={(name) => set({ name })}
          />
          <TextField
            label="Name in Spanish (optional)"
            name="nameEs"
            description="Shown to clients reading in Spanish. Left blank, they see the English."
            value={draft.nameEs ?? ""}
            onChange={(nameEs) => set({ nameEs })}
          />
          <TextField
            label="Description"
            name="description"
            description="A sentence or two clients see when they ask for it"
            multiline
            value={draft.description}
            onChange={(description) => set({ description })}
          />
          <TextField
            label="Description in Spanish (optional)"
            name="descriptionEs"
            description="Shown to clients reading in Spanish. Left blank, they see the English."
            multiline
            value={draft.descriptionEs ?? ""}
            onChange={(descriptionEs) => set({ descriptionEs })}
          />
          <SegmentedControl
            label="Offered for"
            name="offeredFor"
            value={draft.offeredFor}
            onChange={(v) => setOfferedFor(v as OfferedFor)}
          >
            {(["homes", "businesses", "both"] as const).map((k) => (
              <Segment key={k} value={k}>
                {offeredForLabel[k]}
              </Segment>
            ))}
          </SegmentedControl>
        </FormPart>

        <FormPart title="How long it takes">
          <SegmentedControl
            label="Worked out"
            name="method"
            value={draft.method}
            onChange={(v) => setMethod(v as PricingMethod)}
          >
            <Segment value="rooms" isDisabled={draft.offeredFor !== "homes"}>
              {methodLabel.rooms}
            </Segment>
            <Segment value="area">{methodLabel.area}</Segment>
          </SegmentedControl>
          {draft.method === "rooms" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {roomFields.map(({ name, label, description }) => (
                <NumberField
                  key={name}
                  label={`${label} (hours)`}
                  name={`roomHours.${name}`}
                  description={description}
                  // a step counts from the least value, and typed values snap to
                  // it: 0.05 keeps 0.4 h as typed
                  minValue={0}
                  step={0.05}
                  formatOptions={{ maximumFractionDigits: 2 }}
                  value={draft.roomHours?.[name] ?? NaN}
                  onChange={(value) => setRoomHours({ [name]: value })}
                />
              ))}
            </div>
          ) : (
            <NumberField
              label="Hours per 1,000 sq ft"
              name="hoursPerThousandSqFt"
              description={
                draft.offeredFor === "homes"
                  ? undefined
                  : "For an office. Other types of business take longer or shorter, as set on Prices"
              }
              minValue={0}
              step={0.05}
              formatOptions={{ maximumFractionDigits: 2 }}
              value={draft.hoursPerThousandSqFt ?? NaN}
              onChange={(hoursPerThousandSqFt) => set({ hoursPerThousandSqFt })}
            />
          )}
          <Checkbox
            isSelected={draft.conditionApplies}
            onChange={(conditionApplies) => set({ conditionApplies })}
          >
            Takes longer the dirtier the place is (condition)
          </Checkbox>
        </FormPart>

        <FormPart title="Price">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Hourly rate"
              name="hourlyRateCents"
              description="Before tax. Extras are charged at it too, for their own hours."
              minValue={1}
              formatOptions={dollars}
              value={draft.hourlyRate}
              onChange={(hourlyRate) => set({ hourlyRate })}
            />
            <NumberField
              label="Minimum price"
              name="minimumChargeCents"
              description="No suggested price is lower. You can still set your own price on a quote."
              minValue={0}
              formatOptions={dollars}
              value={draft.minimumCharge}
              onChange={(minimumCharge) => set({ minimumCharge })}
            />
          </div>
        </FormPart>

        <FormPart
          title="Booking"
          summary={[
            draft.canRecur ? "On a plan" : "Not on a plan",
            draft.needsSiteVisit ? "a site visit first" : "no site visit",
            firstVisit
              ? `recommends ${firstVisit.name}`
              : "recommends nothing else",
          ].join(" · ")}
        >
          <Checkbox
            isSelected={draft.canRecur}
            onChange={(canRecur) =>
              set({
                canRecur,
                taxPlanPercent: canRecur
                  ? (draft.taxPlanPercent ?? draft.taxOneOffPercent)
                  : null,
              })
            }
          >
            Can be on a cleaning plan
          </Checkbox>
          <Checkbox
            isSelected={draft.needsSiteVisit}
            onChange={(needsSiteVisit) => set({ needsSiteVisit })}
          >
            Needs a site visit before a quote is sent
          </Checkbox>
          <Select
            label="For a first visit, recommend"
            name="firstVisitServiceKey"
            description="Offered alongside it, recommended, where Empire Cleaning hasn't worked before"
            selectedKey={draft.firstVisitServiceKey ?? NONE}
            onSelectionChange={(key) =>
              set({
                firstVisitServiceKey: key === NONE ? null : String(key),
              })
            }
          >
            <SelectItem id={NONE}>Nothing else</SelectItem>
            {others.map((s) => (
              <SelectItem key={s.key} id={s.key}>
                {s.name}
              </SelectItem>
            ))}
          </Select>
        </FormPart>

        <FormPart title="Sales tax">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="One-off jobs (%)"
              name="taxOneOffPercent"
              minValue={0}
              step={0.125}
              formatOptions={rate}
              value={draft.taxOneOffPercent}
              onChange={(taxOneOffPercent) => set({ taxOneOffPercent })}
            />
            {draft.canRecur && (
              <NumberField
                label="Cleaning plan jobs (%)"
                name="taxPlanPercent"
                minValue={0}
                step={0.125}
                formatOptions={rate}
                value={draft.taxPlanPercent ?? NaN}
                onChange={(taxPlanPercent) => set({ taxPlanPercent })}
              />
            )}
          </div>
        </FormPart>
      </FormPage>
    </Form>
  );
}

const roomFields: {
  name: keyof RoomHours;
  label: string;
  description?: string;
}[] = [
  {
    name: "baseHours",
    label: "Base",
    description: "Kitchen, living areas and entry, for every home",
  },
  { name: "bedroomHours", label: "Per bedroom" },
  { name: "bathroomHours", label: "Per bathroom" },
  {
    name: "extraStoreyHours",
    label: "Per upper floor",
    description: "For each floor above the first",
  },
  {
    name: "petHours",
    label: "Pets",
    description: "Added once if there are pets",
  },
];
