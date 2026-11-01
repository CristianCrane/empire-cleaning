import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import type {
  OfferedFor,
  PriceList,
  PricingMethod,
  RoomHours,
  Service,
  ServiceInput,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Cell,
  Checkbox,
  Column,
  Form,
  Heading,
  Notice,
  NumberField,
  Row,
  Section,
  Segment,
  SegmentedControl,
  Select,
  SelectItem,
  StatusBadge,
  Table,
  TableBody,
  TableHeader,
  TextField,
} from "@empire-cleaning/ui";
import { postJson, putJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { formatDate, formatMoney } from "../format.ts";
import { ExampleQuote } from "./ExampleQuote.tsx";

export const methodLabel: Record<PricingMethod, string> = {
  rooms: "From a home's rooms",
  area: "By area",
};

const offeredForLabel: Record<OfferedFor, string> = {
  homes: "Homes",
  businesses: "Businesses",
  both: "Both",
};

// What Empire Cleaning sells (ADR-0018): a Table of the Services on offer,
// the retired ones below it on request
export function ServicesScreen() {
  const services = useLoaderData({ from: "/office/services" });
  const [showRetired, setShowRetired] = useState(false);
  const active = services.filter((s) => s.active);
  const retired = services.filter((s) => !s.active);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={1} inBar>
          Services
        </Heading>
        <ButtonLink href={linkTo({ to: "/office/services/new" })}>
          <Plus aria-hidden size={18} />
          New Service
        </ButtonLink>
      </div>
      <p className="text-fg-muted">
        What Empire Cleaning sells, each with its own rate. Changes apply to
        prices worked out from now on. Quotes already sent keep the prices they
        were sent with.
      </p>
      <ServicesTable label="Services" services={active} />
      {retired.length > 0 && (
        <Section
          title="Retired"
          description="Offered for nothing new. Quotes, plans and Jobs that used one still price by it."
          actions={
            <Button variant="text" onPress={() => setShowRetired((v) => !v)}>
              {showRetired ? "Hide" : `Show ${retired.length}`}
            </Button>
          }
        >
          {showRetired && (
            <ServicesTable label="Retired Services" services={retired} />
          )}
        </Section>
      )}
    </div>
  );
}

function ServicesTable({
  label,
  services,
}: {
  label: string;
  services: Service[];
}) {
  const navigate = useNavigate();
  return (
    <Table
      aria-label={label}
      onRowAction={(key) =>
        navigate({
          to: "/office/services/$serviceKey",
          params: { serviceKey: String(key) },
        })
      }
    >
      <TableHeader>
        <Column id="name" isRowHeader>
          Service
        </Column>
        <Column id="method" className="hidden sm:table-cell">
          Priced
        </Column>
        <Column id="rate">Hourly rate</Column>
      </TableHeader>
      <TableBody items={services}>
        {(service) => (
          <Row id={service.key} className="cursor-pointer">
            <Cell>{service.name}</Cell>
            <Cell className="hidden sm:table-cell">
              {methodLabel[service.method]}
            </Cell>
            <Cell className="whitespace-nowrap">
              {formatMoney(service.hourlyRateCents)}
            </Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );
}

// one Service: its figures, saved as a new version, and retiring it
export function ServiceScreen() {
  const { service, services, list } = useLoaderData({
    from: "/office/services/$serviceKey",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Services", href: linkTo({ to: "/office/services" }) },
            { label: service.name },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{service.name}</Heading>
          {!service.active && <StatusBadge>Retired</StatusBadge>}
        </div>
        <p className="text-fg-muted">
          Version {service.version}, saved
          {service.createdByName ? ` by ${service.createdByName}` : ""} on{" "}
          {formatDate(service.createdAt)}.
        </p>
      </div>
      {/* a new version starts the form afresh */}
      <ServiceForm
        key={service.id}
        service={service}
        services={services}
        list={list}
      />
    </div>
  );
}

export function NewServiceScreen() {
  const { services, list } = useLoaderData({ from: "/office/services/new" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Services", href: linkTo({ to: "/office/services" }) },
            { label: "New Service" },
          ]}
        />
        <Heading level={1}>New Service</Heading>
      </div>
      <ServiceForm services={services} list={list} />
    </div>
  );
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
  const action = useAction("The Service wasn't saved. Please try again.");
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

  return (
    <Form
      validationErrors={action.fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          toInput(draft),
          service ? "Service saved" : `${draft.name} added`,
        );
      }}
    >
      {/* the form in one column; the Example Quote beside it, in view as
          it scrolls, or after the Price on a phone */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Section title="What it is">
          <Card>
            <TextField
              label="Name"
              name="name"
              isRequired
              value={draft.name}
              onChange={(name) => set({ name })}
            />
            <TextField
              label="Description"
              name="description"
              description="A sentence or two Clients see when asking for it"
              multiline
              value={draft.description}
              onChange={(description) => set({ description })}
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
          </Card>
        </Section>

        <Section
          title="How long it takes"
          description="Labour Hours, however many Cleaners share them. They set the price, and how long the Schedule books."
        >
          <Card>
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
                    : "For an office; other types of premises take longer or shorter, as set on the Price List"
                }
                minValue={0}
                step={0.05}
                formatOptions={{ maximumFractionDigits: 2 }}
                value={draft.hoursPerThousandSqFt ?? NaN}
                onChange={(hoursPerThousandSqFt) =>
                  set({ hoursPerThousandSqFt })
                }
              />
            )}
            <Checkbox
              isSelected={draft.conditionApplies}
              onChange={(conditionApplies) => set({ conditionApplies })}
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
                name="hourlyRateCents"
                minValue={1}
                formatOptions={dollars}
                value={draft.hourlyRate}
                onChange={(hourlyRate) => set({ hourlyRate })}
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
        </Section>

        <div className="xl:sticky xl:top-6 xl:col-start-2 xl:row-span-6 xl:row-start-1 xl:self-start">
          <ExampleQuote
            input={toInput(draft)}
            saved={service && inputOf(service)}
            list={list}
          />
        </div>

        <Section title="Booking">
          <Card>
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
              Can be on a Service Plan
            </Checkbox>
            <Checkbox
              isSelected={draft.needsSiteVisit}
              onChange={(needsSiteVisit) => set({ needsSiteVisit })}
            >
              Needs a Site Visit before a Quote is sent
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
                name="taxOneOffPercent"
                minValue={0}
                step={0.125}
                formatOptions={rate}
                value={draft.taxOneOffPercent}
                onChange={(taxOneOffPercent) => set({ taxOneOffPercent })}
              />
              {draft.canRecur && (
                <NumberField
                  label="Service Plan Jobs (%)"
                  name="taxPlanPercent"
                  minValue={0}
                  step={0.125}
                  formatOptions={rate}
                  value={draft.taxPlanPercent ?? NaN}
                  onChange={(taxPlanPercent) => set({ taxPlanPercent })}
                />
              )}
            </div>
          </Card>
        </Section>

        <div className="flex flex-col gap-5">
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            {service && (
              <Button
                variant={service.active ? "danger-text" : "text"}
                onPress={() =>
                  void save(
                    { ...inputOf(service), active: !service.active },
                    service.active
                      ? `${service.name} retired`
                      : `${service.name} offered again`,
                  )
                }
              >
                {service.active ? (
                  <Archive aria-hidden size={18} />
                ) : (
                  <ArchiveRestore aria-hidden size={18} />
                )}
                {service.active ? "Retire" : "Offer again"}
              </Button>
            )}
            <Button type="submit" isPending={action.isPending}>
              {service ? "Save Service" : "Add Service"}
            </Button>
          </Actions>
        </div>
      </div>
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
    label: "Per extra floor",
    description: "For each floor above the first",
  },
  {
    name: "petHours",
    label: "Pets",
    description: "Added once if there are pets",
  },
];
