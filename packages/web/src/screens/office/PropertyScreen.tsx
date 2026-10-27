import { useState, type ReactNode } from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import type {
  ClientName,
  Condition,
  HomeView,
  JobStatus,
  OfficePropertyView,
  PremisesTypeChoice,
  PremisesView,
  PropertyType,
  PropertyView,
  ServicePlanSummary,
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
  TextField,
  showToast,
  type Crumb,
} from "@empire-cleaning/ui";
import { ApiError, patchJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  cleanTypeLabel,
  clientName,
  conditionLabel,
  formatDate,
  formatDateTime,
  propertySummary,
  wantedCleaning,
  quoteHeadline,
  planName,
} from "../format.ts";
import { PlanStatusBadge } from "../PlanParts.tsx";
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import {
  BookSiteVisit,
  RecordFindingsWithoutVisit,
  SiteVisitBadge,
  visitSummary,
} from "./SiteVisitParts.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";

// a home for the Office: its whole history (ADR-0011), its Quote Requests,
// Quotes and Jobs, its Site Visits, and its details
export function PropertyScreen() {
  const { home, premisesTypes } = useLoaderData({
    from: "/office/properties/$propertyId",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Clients", href: linkTo({ to: "/office/clients" }) },
            clientCrumb(home.client),
            { label: addressOf(home) },
          ]}
        />
        <Heading level={1}>{addressOf(home)}</Heading>
      </div>
      {home.servicePlan && <PlanLink plan={home.servicePlan} />}
      <SiteVisits home={home} premisesTypes={premisesTypes} />
      <History home={home} />
      <Details home={home} premisesTypes={premisesTypes} />
    </div>
  );
}

const clientCrumb = (client: ClientName): Crumb => ({
  label: clientName(client),
  href: linkTo({
    to: "/office/clients/$clientId",
    params: { clientId: client.id },
  }),
});

// the crumbs for a screen below a home (a Quote Request, Quote or Job): its
// Client, then the home
export const homeCrumbs = (
  client: ClientName,
  home: Pick<PropertyView, "id" | "street" | "unit" | "postcode">,
): Crumb[] => [
  clientCrumb(client),
  {
    label: addressOf(home),
    href: linkTo({
      to: "/office/properties/$propertyId",
      params: { propertyId: home.id },
    }),
  },
];

/**
 * Its Site Visits, newest first, each opening its own screen (#73). Business
 * premises need one with findings recorded before a Quote is Sent
 * (ADR-0014); premises the Office knows can have them recorded with no
 * visit. A Property has one booked at a time.
 */
function SiteVisits({
  home,
  premisesTypes,
}: {
  home: OfficePropertyView;
  premisesTypes: PremisesTypeChoice[];
}) {
  const navigate = useNavigate();
  const premises = home.kind === "commercial";
  const booked = home.siteVisits.some((v) => v.status === "booked");
  // a Site Visit is for a Quote with nothing Sent yet
  const unsent = home.quotes.find(
    (q) => q.status === "requested" || q.status === "draft",
  );
  if (!premises && home.siteVisits.length === 0) {
    return (
      <Card
        title="Site Visits"
        description="Optional for a home: book one to see it before quoting."
        actions={unsent && <BookSiteVisit quoteId={unsent.id} />}
      />
    );
  }

  return (
    <Card title="Site Visits">
      {premises && !home.findingsRecorded && (
        <Notice>
          {booked
            ? "Record what the Site Visit finds, and a Quote can be sent."
            : "Business premises are seen before they're quoted. Book a Site Visit, or record findings you know already."}
        </Notice>
      )}
      {/* in the body, not the header, so they wrap at phone width */}
      {!booked && (
        <div className="flex flex-wrap gap-2">
          {unsent && (
            <BookSiteVisit
              quoteId={unsent.id}
              primary={premises && !home.findingsRecorded}
            />
          )}
          {premises && (
            <RecordFindingsWithoutVisit
              property={home}
              officeNotes={home.officeNotes}
              premisesTypes={premisesTypes}
            />
          )}
        </div>
      )}
      <List
        aria-label={`Site Visits to ${addressOf(home)}`}
        renderEmptyState={() => (
          <p className="p-4 text-center text-fg-muted">No Site Visits yet.</p>
        )}
        onAction={(id) =>
          void navigate({
            to: "/office/site-visits/$visitId",
            params: { visitId: String(id) },
          })
        }
      >
        {home.siteVisits.map((visit) => (
          <ListItem
            key={visit.id}
            id={visit.id}
            title={visitSummary(visit)}
            end={<SiteVisitBadge status={visit.status} />}
          />
        ))}
      </List>
    </Card>
  );
}

// the home's Service Plan, opening its own screen
function PlanLink({ plan }: { plan: ServicePlanSummary }) {
  const navigate = useNavigate();
  return (
    <Card title="Service Plan">
      <List aria-label="Service Plan">
        <ListItem
          id={plan.id}
          title={planName(plan)}
          description={
            plan.nextStartsAt
              ? `Next: ${formatDateTime(plan.nextStartsAt)}`
              : "No Job booked just now"
          }
          end={<PlanStatusBadge status={plan.status} />}
          onAction={() =>
            void navigate({
              to: "/office/service-plans/$planId",
              params: { planId: plan.id },
            })
          }
        />
      </List>
    </Card>
  );
}

// a home's requests, Quotes and Jobs, newest first, each opening its own
// screen; and the way to offer it a plan: a home once its First Clean is
// Completed, business premises at any time (ADR-0014)
function History({ home }: { home: OfficePropertyView }) {
  const navigate = useNavigate();
  const { quotes, jobs } = home;
  const empty = (what: string) => () => (
    <p className="p-4 text-center text-fg-muted">No {what} yet.</p>
  );

  return (
    <Card
      title="History"
      actions={
        (home.firstCleanCompleted || home.kind === "commercial") && (
          <OfferServicePlan
            propertyId={home.id}
            label={home.servicePlan ? "Change its Service Plan" : undefined}
          />
        )
      }
    >
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
                ? `Sent ${formatDate(quote.sentAt)}${quote.origin === "office" ? ", unprompted" : ""}`
                : `Asked ${formatDate(quote.createdAt)}`
            }
            end={<QuoteStatusBadge status={quote.status} />}
            onAction={() =>
              void navigate(
                quote.status === "requested"
                  ? {
                      to: "/office/requests/$requestId",
                      params: { requestId: quote.id },
                    }
                  : {
                      to: "/office/quotes/$quoteId",
                      params: { quoteId: quote.id },
                    },
              )
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

export const jobStatusLabel: Record<JobStatus, string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  no_access: "No Access",
};

// Corrections to the details that affect the price: only what differs from
// what's saved is sent
function useCorrection<T extends Record<string, unknown>>(
  home: PropertyView,
  saved: T,
) {
  const router = useRouter();
  const [details, setDetails] = useState(saved);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const change = (update: Partial<T>) =>
    setDetails((current) => ({ ...current, ...update }));
  const changes = Object.fromEntries(
    Object.entries(details).filter(([key, value]) => value !== saved[key]),
  );

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

  return {
    details,
    change,
    hasChanges: Object.keys(changes).length > 0,
    save,
    fieldErrors,
    isSaving,
    failed,
  };
}

// the details that affect the price. Clients keep what they first gave and ask
// for a new Quote to change it; the Office corrects it here, or a Site
// Visit's findings do (#73). The address is the Property's identity, so it
// isn't editable.
function Details({
  home,
  premisesTypes,
}: {
  home: OfficePropertyView;
  premisesTypes: PremisesTypeChoice[];
}) {
  return (
    <Card title="Details" description={propertySummary(home)}>
      <p className="text-sm text-fg-muted">
        Access Instructions:{" "}
        <span className="whitespace-pre-line text-fg">
          {home.accessInstructions || "None given"}
        </span>
      </p>
      {home.kind === "commercial" ? (
        <PremisesDetails
          premises={home}
          officeNotes={home.officeNotes}
          premisesTypes={premisesTypes}
        />
      ) : (
        <HomeDetails home={home} officeNotes={home.officeNotes} />
      )}
    </Card>
  );
}

function CorrectionForm({
  correction,
  children,
}: {
  correction: ReturnType<typeof useCorrection>;
  children: ReactNode;
}) {
  return (
    <Form
      validationErrors={correction.fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void correction.save();
      }}
    >
      {children}
      {correction.failed && (
        <Notice tone="danger">
          The corrections weren't saved. Please try again.
        </Notice>
      )}
      <Actions>
        <Button
          type="submit"
          variant="secondary"
          isDisabled={!correction.hasChanges}
          isPending={correction.isSaving}
        >
          Save corrections
        </Button>
      </Actions>
    </Form>
  );
}

function ConditionSelect({
  value,
  onChange,
}: {
  value: Condition | null;
  onChange: (condition: Condition) => void;
}) {
  return (
    <Select
      label="Condition"
      placeholder="Not recorded yet"
      selectedKey={value}
      onSelectionChange={(key) => onChange(key as Condition)}
    >
      <SelectItem id="light">Light</SelectItem>
      <SelectItem id="moderate">Moderate</SelectItem>
      <SelectItem id="heavy">Heavy</SelectItem>
    </Select>
  );
}

// the Office's own notes on it, from a Site Visit or otherwise
function OfficeNotesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (notes: string) => void;
}) {
  return (
    <TextField
      label="Office notes"
      name="officeNotes"
      description="Only Office Staff see these."
      multiline
      value={value}
      onChange={onChange}
    />
  );
}

function HomeDetails({
  home,
  officeNotes,
}: {
  home: HomeView;
  officeNotes: string | null;
}) {
  const correction = useCorrection(home, {
    type: home.type,
    bedrooms: home.bedrooms,
    bathrooms: home.bathrooms,
    storeys: home.storeys,
    pets: home.pets,
    floorArea: home.floorArea,
    condition: home.condition,
    officeNotes: officeNotes ?? "",
  });
  const { details, change } = correction;

  return (
    <CorrectionForm correction={correction}>
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
      <Checkbox isSelected={details.pets} onChange={(pets) => change({ pets })}>
        There are pets at home
      </Checkbox>
      <ConditionSelect
        value={details.condition}
        onChange={(condition) => change({ condition })}
      />
      <OfficeNotesField
        value={details.officeNotes}
        onChange={(notes) => change({ officeNotes: notes })}
      />
    </CorrectionForm>
  );
}

// business premises: their Premises Type (one on offer, or the retired one
// they have), floor area and Condition
function PremisesDetails({
  premises,
  officeNotes,
  premisesTypes,
}: {
  premises: PremisesView;
  officeNotes: string | null;
  premisesTypes: PremisesTypeChoice[];
}) {
  const correction = useCorrection(premises, {
    premisesType: premises.premisesType.key,
    floorArea: premises.floorArea,
    condition: premises.condition,
    officeNotes: officeNotes ?? "",
  });
  const { details, change } = correction;
  const choices = premisesTypes.some((t) => t.key === premises.premisesType.key)
    ? premisesTypes
    : [premises.premisesType, ...premisesTypes];

  return (
    <CorrectionForm correction={correction}>
      <Select
        label="Type of premises"
        name="premisesType"
        selectedKey={details.premisesType}
        onSelectionChange={(key) => change({ premisesType: String(key) })}
      >
        {choices.map((t) => (
          <SelectItem key={t.key} id={t.key}>
            {t.name}
          </SelectItem>
        ))}
      </Select>
      <NumberField
        label="Floor area in sq ft"
        name="floorArea"
        description="Leave empty until it's known: it's priced at the Minimum Charge until then."
        minValue={100}
        maxValue={1_000_000}
        step={100}
        value={details.floorArea ?? Number.NaN}
        onChange={(area) =>
          change({ floorArea: Number.isNaN(area) ? null : area })
        }
      />
      <ConditionSelect
        value={details.condition}
        onChange={(condition) => change({ condition })}
      />
      <OfficeNotesField
        value={details.officeNotes}
        onChange={(notes) => change({ officeNotes: notes })}
      />
    </CorrectionForm>
  );
}
