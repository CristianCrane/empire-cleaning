import { useState } from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import type {
  Condition,
  JobStatus,
  OfficeClientView,
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
  cleanTypeLabel,
  conditionLabel,
  formatDate,
  formatDateTime,
  homeSummary,
  quoteHeadline,
} from "../format.ts";
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";

// a Client for the Office: each home with its details and its whole
// history, its Quote Requests, Quotes and Jobs
export function ClientDetail() {
  const client = useLoaderData({ from: "/office/clients/$clientId" });

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
        <section
          key={home.id}
          aria-label={addressOf(home)}
          className="flex flex-col gap-4"
        >
          <Heading level={2}>{addressOf(home)}</Heading>
          <History client={client} home={home} />
          <Home home={home} />
        </section>
      ))}
    </div>
  );
}

type Client = OfficeClientView;
type ClientHome = Client["properties"][number];

// a home's requests, Quotes and Jobs, newest first, each opening its own
// screen; and once its First Clean is Completed, the way to offer it a plan
function History({ client, home }: { client: Client; home: ClientHome }) {
  const navigate = useNavigate();
  const requests = client.quoteRequests.filter((r) => r.propertyId === home.id);
  const quotes = client.quotes.filter((q) => q.property.id === home.id);
  const jobs = client.jobs.filter((j) => j.property.id === home.id);
  const empty = (what: string) => () => (
    <p className="p-4 text-center text-fg-muted">No {what} yet.</p>
  );

  return (
    <Card
      title="History"
      actions={
        home.firstCleanCompleted && <OfferServicePlan propertyId={home.id} />
      }
    >
      <Heading level={3}>Quote Requests</Heading>
      <List
        aria-label={`Quote Requests for ${addressOf(home)}`}
        renderEmptyState={empty("Quote Requests")}
      >
        {requests.map((request) => (
          <ListItem
            key={request.id}
            id={request.id}
            title={formatDate(request.createdAt)}
            description={[
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
            onAction={() =>
              void navigate({
                to: "/office/requests/$requestId",
                params: { requestId: request.id },
              })
            }
          />
        ))}
      </List>
      <Heading level={3}>Quotes</Heading>
      <List
        aria-label={`Quotes for ${addressOf(home)}`}
        renderEmptyState={empty("Quotes")}
      >
        {quotes.map((quote) => (
          <ListItem
            key={quote.id}
            id={quote.id}
            title={quoteHeadline(quote)}
            description={
              quote.sentAt
                ? `Sent ${formatDate(quote.sentAt)}${quote.quoteRequestId ? "" : ", unprompted"}`
                : `Started ${formatDate(quote.createdAt)}`
            }
            end={<QuoteStatusBadge status={quote.status} />}
            onAction={() =>
              void navigate({
                to: "/office/quotes/$quoteId",
                params: { quoteId: quote.id },
              })
            }
          />
        ))}
      </List>
      <Heading level={3}>Jobs</Heading>
      <List
        aria-label={`Jobs at ${addressOf(home)}`}
        renderEmptyState={empty("Jobs")}
      >
        {jobs.map((job) => (
          <ListItem
            key={job.id}
            id={job.id}
            title={formatDateTime(job.startsAt)}
            description={cleanTypeLabel[job.cleanType]}
            end={<StatusBadge>{jobStatusLabel[job.status]}</StatusBadge>}
            onAction={() =>
              void navigate({
                to: "/office/jobs/$jobId",
                params: { jobId: job.id },
              })
            }
          />
        ))}
      </List>
    </Card>
  );
}

const jobStatusLabel: Record<JobStatus, string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  no_access: "No Access",
};

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
    <Card title="Details" description={homeSummary(home)}>
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
