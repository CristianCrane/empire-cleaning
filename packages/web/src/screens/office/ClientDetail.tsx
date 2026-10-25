import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import type {
  Condition,
  PropertyType,
  PropertyView,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Form,
  Heading,
  List,
  ListItem,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  StatusBadge,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, patchJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  conditionLabel,
  formatDate,
  homeSummary,
} from "../format.ts";

// a Client with their homes and Quote Requests, for the Office
export function ClientDetail() {
  const client = useLoaderData({ from: "/office/clients/$clientId" });
  const homes = new Map(client.properties.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Requests", href: linkTo({ to: "/office/requests" }) },
            { label: client.name },
          ]}
        />
        <Heading level={1}>{client.name}</Heading>
      </div>

      <Card title="Contact details">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Email</dt>
          <dd>{client.email}</dd>
          <dt className="font-semibold">Phone</dt>
          <dd>{client.phone}</dd>
        </dl>
      </Card>

      {client.properties.map((home) => (
        <Home key={home.id} home={home} />
      ))}

      <Card title="Quote Requests">
        <List aria-label="Quote Requests">
          {client.quoteRequests.map((request) => {
            const home = homes.get(request.propertyId);
            return (
              <ListItem
                key={request.id}
                id={request.id}
                title={home ? addressOf(home) : "Home"}
                description={[
                  formatDate(request.createdAt),
                  `Stated ${conditionLabel[request.condition].toLowerCase()}`,
                  request.addOns.length > 0 &&
                    `Extras: ${request.addOns.map((a) => a.name).join(", ")}`,
                  request.notes,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                end={
                  request.wantsRegularService && (
                    <StatusBadge tone="success">Regular visits</StatusBadge>
                  )
                }
              />
            );
          })}
        </List>
      </Card>
    </div>
  );
}

// the details that affect the price. Clients keep what they first gave and ask
// for a new Quote to change it; the Office corrects it here. The address is
// the home's identity, so it isn't editable.
function Home({ home }: { home: PropertyView }) {
  const router = useRouter();
  const [details, setDetails] = useState({
    type: home.type,
    bedrooms: home.bedrooms,
    bathrooms: home.bathrooms,
    storeys: home.storeys,
    pets: home.pets,
    floorArea: home.floorArea,
    condition: home.condition,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const change = (update: Partial<typeof details>) =>
    setDetails((current) => ({ ...current, ...update }));

  // send only what differs from what's saved
  const changes = Object.fromEntries(
    Object.entries(details).filter(
      ([key, value]) => value !== home[key as keyof typeof details],
    ),
  );
  const hasChanges = Object.keys(changes).length > 0;

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await patchJson(`/api/properties/${home.id}`, changes);
      setFieldErrors({});
      showToast({ tone: "success", title: "Details corrected" });
      await router.invalidate();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
      } else {
        setFailed(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={addressOf(home)} description={homeSummary(home)}>
      <p className="text-sm text-fg-muted">
        Access Instructions:{" "}
        <span className="whitespace-pre-line text-fg">
          {home.accessInstructions || "None given"}
        </span>
      </p>
      <Form
        validationErrors={fieldErrors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <RadioGroup
          label="Type of home"
          orientation="horizontal"
          value={details.type}
          onChange={(type) => change({ type: type as PropertyType })}
        >
          <Radio value="house">House</Radio>
          <Radio value="apartment">Apartment</Radio>
          <Radio value="townhouse">Townhouse</Radio>
        </RadioGroup>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
          <NumberField
            label="Bedrooms"
            name="bedrooms"
            minValue={0}
            maxValue={20}
            value={details.bedrooms}
            onChange={(bedrooms) => change({ bedrooms })}
          />
          <NumberField
            label="Bathrooms"
            name="bathrooms"
            minValue={0.5}
            maxValue={20}
            step={0.5}
            value={details.bathrooms}
            onChange={(bathrooms) => change({ bathrooms })}
          />
          <NumberField
            label="Floors"
            name="storeys"
            minValue={1}
            maxValue={5}
            value={details.storeys}
            onChange={(storeys) => change({ storeys })}
          />
        </div>
        <NumberField
          label="Floor area in sq ft (optional)"
          name="floorArea"
          minValue={100}
          maxValue={100_000}
          step={50}
          value={details.floorArea ?? Number.NaN}
          onChange={(area) =>
            change({ floorArea: Number.isNaN(area) ? null : area })
          }
        />
        <Checkbox
          isSelected={details.pets}
          onChange={(pets) => change({ pets })}
        >
          There are pets at home
        </Checkbox>
        <Select
          label="Condition"
          selectedKey={details.condition}
          onSelectionChange={(key) => change({ condition: key as Condition })}
        >
          <SelectItem id="light">Light</SelectItem>
          <SelectItem id="moderate">Moderate</SelectItem>
          <SelectItem id="heavy">Heavy</SelectItem>
        </Select>
        {failed && (
          <Notice tone="danger">
            The corrections weren't saved. Please try again.
          </Notice>
        )}
        <Actions>
          <Button
            type="submit"
            variant="secondary"
            isDisabled={!hasChanges}
            isPending={isSaving}
          >
            Save corrections
          </Button>
        </Actions>
      </Form>
    </Card>
  );
}
