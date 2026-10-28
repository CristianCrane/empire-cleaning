import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import type {
  OfferedFor,
  PricingMethod,
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
        <Heading level={1}>Services</Heading>
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
  const { service, services } = useLoaderData({
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
      <ServiceForm key={service.id} service={service} services={services} />
    </div>
  );
}

export function NewServiceScreen() {
  const services = useLoaderData({ from: "/office/services/new" });

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
      <ServiceForm services={services} />
    </div>
  );
}

// Money is shown in dollars and kept in cents; a draft is what's on screen
type Draft = Omit<ServiceInput, "hourlyRateCents" | "minimumChargeCents"> & {
  hourlyRate: number;
  minimumCharge: number;
};

const blank: ServiceInput = {
  name: "",
  description: "",
  offeredFor: "homes",
  method: "rooms",
  multiplier: 1,
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
}: {
  service?: Service;
  services: Service[];
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
  const setMethod = (method: PricingMethod) =>
    set(
      method === "rooms"
        ? { method, multiplier: draft.multiplier ?? 1 }
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
        title="Price"
        description="Before tax. Add-ons are added after the multipliers, at the same rate."
      >
        <Card>
          <SegmentedControl
            label="Priced"
            name="method"
            value={draft.method}
            onChange={(v) => setMethod(v as PricingMethod)}
            description={
              draft.method === "rooms"
                ? "A home's hours, from the Price List, times this Service's multiplier"
                : "The floor area's hours, and for business premises their type's multiplier"
            }
          >
            <Segment value="rooms" isDisabled={draft.offeredFor !== "homes"}>
              {methodLabel.rooms}
            </Segment>
            <Segment value="area">{methodLabel.area}</Segment>
          </SegmentedControl>
          <div className="grid gap-4 sm:grid-cols-2">
            {draft.method === "rooms" ? (
              <NumberField
                label="Multiplier (×)"
                name="multiplier"
                description="A Standard Clean is 1"
                minValue={0.1}
                step={0.05}
                formatOptions={{ maximumFractionDigits: 2 }}
                value={draft.multiplier ?? NaN}
                onChange={(multiplier) => set({ multiplier })}
              />
            ) : (
              <NumberField
                label="Hours per 1,000 sq ft"
                name="hoursPerThousandSqFt"
                minValue={0.01}
                step={0.05}
                formatOptions={{ maximumFractionDigits: 2 }}
                value={draft.hoursPerThousandSqFt ?? NaN}
                onChange={(hoursPerThousandSqFt) =>
                  set({ hoursPerThousandSqFt })
                }
              />
            )}
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
          <Checkbox
            isSelected={draft.conditionApplies}
            onChange={(conditionApplies) => set({ conditionApplies })}
          >
            Condition changes its hours
          </Checkbox>
        </Card>
      </Section>

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
    </Form>
  );
}
