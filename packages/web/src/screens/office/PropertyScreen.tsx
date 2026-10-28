import { useState, type ReactNode } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarCheck,
  MapPin,
  Repeat,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type {
  ClientName,
  HomeView,
  JobStatus,
  OfficePropertyView,
  OfficeServicePlan,
  OfficeSiteVisit,
  PremisesTypeChoice,
  PremisesView,
  PropertyView,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Cell,
  Checkbox,
  Column,
  EmptyState,
  Form,
  Heading,
  Link,
  Notice,
  NumberField,
  Row,
  Select,
  SelectItem,
  StatusBadge,
  Tab,
  Table,
  TableBody,
  TableHeader,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  type Crumb,
  type StatusTone,
} from "@empire-cleaning/ui";
import { patchJson } from "../../api.ts";
import { linkTo, type AppHref } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  addressOf,
  clientName,
  formatDate,
  propertySummary,
  quoteHeadline,
} from "../format.ts";
import { QuoteIcon } from "../icons.ts";
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import {
  BookSiteVisit,
  RecordFindingsWithoutVisit,
  SiteVisitBadge,
} from "./SiteVisitParts.tsx";
import { ConditionField, PlaceTiles } from "./PropertyFields.tsx";
import { PlanDetails } from "./ServicePlanScreen.tsx";
import { VisitDetails } from "./SiteVisitScreen.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";

// the Property page's Tabs, Details first: what the Office opens a home for
export const propertyTabs = ["details", "plan", "visit", "history"] as const;
export type PropertyTab = (typeof propertyTabs)[number];
export type PropertySearch = { tab?: PropertyTab };

// a home for the Office (ADR-0011): its details first, then its Service
// Plan, its Site Visit and its whole history, a Tab each
export function PropertyScreen() {
  const { home, premisesTypes, plan, visit } = useLoaderData({
    from: "/office/properties/$propertyId",
  });
  const { tab = "details" } = useSearch({
    from: "/office/properties/$propertyId",
  });
  const navigate = useNavigate({ from: "/office/properties/$propertyId" });
  const history = historyOf(home);

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
        <div className="flex flex-col gap-1">
          <Heading level={1}>{addressOf(home)}</Heading>
          <p className="text-fg-muted">
            {clientName(home.client)} · {propertySummary(home)}
          </p>
        </div>
      </div>
      {home.kind === "commercial" && !home.findingsRecorded && (
        <Notice>
          Business premises are seen before they're quoted: see the Site Visit
          Tab.
        </Notice>
      )}
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) =>
          void navigate({
            search: {
              tab: key === "details" ? undefined : (key as PropertyTab),
            },
            replace: true,
          })
        }
      >
        <TabList aria-label="About this Property">
          <Tab id="details">Details</Tab>
          <Tab id="plan">Service Plan</Tab>
          <Tab id="visit">Site Visit</Tab>
          <Tab id="history" count={history.length}>
            History
          </Tab>
        </TabList>
        <TabPanel id="details">
          <Details home={home} premisesTypes={premisesTypes} />
        </TabPanel>
        <TabPanel id="plan">
          <PlanTab home={home} plan={plan} />
        </TabPanel>
        <TabPanel id="visit">
          <VisitTab home={home} visit={visit} premisesTypes={premisesTypes} />
        </TabPanel>
        <TabPanel id="history">
          <History home={home} events={history} />
        </TabPanel>
      </Tabs>
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

// the crumbs for a screen below a home (a Quote or Job): its Client, then
// the home
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

// a Quote that stops a new Service Plan Quote, as the server would refuse
// one: a Quote asked for, or a Service Plan Quote, still open. The Office's
// own draft isn't in the way: quoting again carries on with it
const quoteInTheWay = (home: OfficePropertyView) => {
  const open = home.quotes.find(
    (q) =>
      (q.kind === "service_plan" || q.kind === null) &&
      (q.status === "requested" || q.status === "draft" || q.status === "sent"),
  );
  const resumes =
    open?.kind === "service_plan" &&
    open.status === "draft" &&
    open.origin === "office";
  return { open, resumes };
};

const inTheWayLine: Record<"requested" | "draft" | "sent", string> = {
  requested: "The Client asked for a Quote that's still open",
  draft: "A Service Plan Quote is being drafted",
  sent: "A Service Plan Quote is with the Client",
};

// the same, for a home with a plan: what the open Quote means for its terms
const newTermsLine: Record<"requested" | "draft" | "sent", string> = {
  requested: "The Client asked for a Quote: draft new terms from it",
  draft: "New terms are being drafted",
  sent: "New terms are with the Client, waiting on their answer",
};

// quoting it a Service Plan, or, with a Quote open already, where that is
function PlanAction({
  home,
  label,
  primary = false,
}: {
  home: OfficePropertyView;
  label: string;
  primary?: boolean;
}) {
  const { open, resumes } = quoteInTheWay(home);
  if (open && !resumes) {
    return (
      <Notice>
        <p>
          {inTheWayLine[open.status as keyof typeof inTheWayLine]}: carry on
          with that one.{" "}
          <Link
            href={linkTo({
              to: "/office/quotes/$quoteId",
              params: { quoteId: open.id },
            })}
          >
            Open the Quote
          </Link>
        </p>
      </Notice>
    );
  }
  return (
    <OfferServicePlan
      propertyId={home.id}
      label={resumes ? "Carry on with the draft" : label}
      primary={primary}
    />
  );
}

// its Service Plan in full; or, with none, the way to quote one: a home once
// its First Clean is Completed, business premises at any time (ADR-0014)
function PlanTab({
  home,
  plan,
}: {
  home: OfficePropertyView;
  plan: OfficeServicePlan | null;
}) {
  const canQuote = home.firstCleanCompleted || home.kind === "commercial";

  if (!plan) {
    return (
      <EmptyState
        icon={Repeat}
        title="This Property doesn't have a Service Plan"
        description={
          canQuote
            ? "Quote regular cleaning: once the Client accepts, their Jobs are booked for them."
            : "A home can be quoted a Service Plan once its First Clean is Completed."
        }
      >
        {canQuote && (
          <PlanAction home={home} label="Quote a Service Plan" primary />
        )}
      </EmptyState>
    );
  }

  // new terms wait on a Quote already open: say which, first
  const { open, resumes } = quoteInTheWay(home);
  const waiting = open && !resumes ? open : undefined;
  return (
    <PlanDetails
      plan={plan}
      changeTerms={
        waiting ? null : <PlanAction home={home} label="Change terms" />
      }
      notice={
        waiting && (
          <>
            {newTermsLine[waiting.status as keyof typeof newTermsLine]}.{" "}
            <Link
              href={linkTo({
                to: "/office/quotes/$quoteId",
                params: { quoteId: waiting.id },
              })}
            >
              Open the Quote
            </Link>
          </>
        )
      }
    />
  );
}

// the Site Visit its Tab shows: the one booked, else the last done. Earlier
// and cancelled ones are in its History
export const currentVisit = (home: OfficePropertyView) =>
  home.siteVisits.find((v) => v.status === "booked") ??
  home.siteVisits.find((v) => v.status === "done");

/**
 * Its Site Visit in full (#73), or, with none, the way to book one. Business
 * premises need findings recorded before a Quote is Sent (ADR-0014);
 * premises the Office knows can have them recorded with no visit. A Site
 * Visit is for a Quote with nothing Sent yet, and a Property has one booked
 * at a time.
 */
function VisitTab({
  home,
  visit,
  premisesTypes,
}: {
  home: OfficePropertyView;
  visit: OfficeSiteVisit | null;
  premisesTypes: PremisesTypeChoice[];
}) {
  const unsent = home.quotes.find(
    (q) => q.status === "requested" || q.status === "draft",
  );
  const premises = home.kind === "commercial";
  const actions = (primary: boolean) => (
    <>
      {unsent && <BookSiteVisit quoteId={unsent.id} primary={primary} />}
      {premises && !home.findingsRecorded && (
        <RecordFindingsWithoutVisit
          property={home}
          officeNotes={home.officeNotes}
          premisesTypes={premisesTypes}
        />
      )}
    </>
  );

  if (!visit) {
    return (
      <EmptyState
        icon={MapPin}
        title="This Property doesn't have a Site Visit"
        description={
          premises
            ? "Business premises are seen before they're quoted. Book a Site Visit, or record findings you know already."
            : unsent
              ? "Optional for a home: book one to see it before quoting."
              : "A Site Visit is booked for a Quote not sent yet."
        }
      >
        {actions(true)}
      </EmptyState>
    );
  }

  // once it's done, another can be booked for a Quote not sent yet
  return (
    <VisitDetails
      visit={visit}
      premisesTypes={premisesTypes}
      actions={visit.status !== "booked" && actions(false)}
    />
  );
}

type HistoryEvent = {
  id: string;
  on: string;
  icon: LucideIcon;
  kind: string;
  what: string;
  status: ReactNode;
  href: AppHref;
};

// everything that's happened at the home, newest first: its Quotes (when
// Sent, or asked for), Jobs and Site Visits
const historyOf = (home: OfficePropertyView): HistoryEvent[] =>
  [
    ...home.quotes.map((quote) => ({
      id: `quote ${quote.id}`,
      on: quote.sentAt ?? quote.createdAt,
      icon: QuoteIcon,
      kind: "Quote",
      what: quoteHeadline(quote),
      status: <QuoteStatusBadge status={quote.status} />,
      href: linkTo({
        to: "/office/quotes/$quoteId",
        params: { quoteId: quote.id },
      }),
    })),
    ...home.jobs.map((job) => ({
      id: `job ${job.id}`,
      on: job.startsAt,
      icon: Sparkles,
      kind: "Job",
      what: job.serviceName,
      status: <JobStatusBadge status={job.status} />,
      href: linkTo({ to: "/office/jobs/$jobId", params: { jobId: job.id } }),
    })),
    ...home.siteVisits.map((visit) => ({
      id: `visit ${visit.id}`,
      on: visit.startsAt ?? visit.doneAt ?? visit.bookedAt,
      icon: visit.startsAt ? MapPin : CalendarCheck,
      kind: "Site Visit",
      what: visit.startsAt
        ? [visit.visitor?.name, `${visit.minutes} min`]
            .filter(Boolean)
            .join(" · ")
        : "Findings recorded, no visit",
      status: <SiteVisitBadge status={visit.status} />,
      href: linkTo({
        to: "/office/site-visits/$visitId",
        params: { visitId: visit.id },
      }),
    })),
  ].sort((a, b) => (a.on < b.on ? 1 : -1));

function History({
  home,
  events,
}: {
  home: OfficePropertyView;
  events: HistoryEvent[];
}) {
  const navigate = useNavigate();
  return (
    <Table
      aria-label={`History of ${addressOf(home)}`}
      onRowAction={(id) => {
        const event = events.find((e) => e.id === id);
        if (event) void navigate(event.href);
      }}
    >
      <TableHeader>
        <Column id="on" isRowHeader>
          Date
        </Column>
        <Column id="what">What</Column>
        <Column id="status">Status</Column>
      </TableHeader>
      <TableBody
        items={events}
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">Nothing yet.</p>
        )}
      >
        {(event) => (
          <Row id={event.id}>
            <Cell>{formatDate(event.on)}</Cell>
            <Cell>
              <span className="flex items-center gap-2">
                <event.icon
                  aria-hidden
                  size={16}
                  className="shrink-0 text-fg-muted"
                />
                <span>
                  <span className="font-semibold">{event.kind}</span>
                  {" · "}
                  {event.what}
                </span>
              </span>
            </Cell>
            <Cell>{event.status}</Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );
}

export const jobStatusLabel: Record<JobStatus, string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  no_access: "No Access",
};

// a Job's status in the tones every status takes: booked is just so, done
// went well, cancelled is over, No Access went wrong
const jobStatusTone: Record<JobStatus, StatusTone> = {
  booked: "info",
  completed: "success",
  cancelled: "neutral",
  no_access: "danger",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <StatusBadge tone={jobStatusTone[status]}>
      {jobStatusLabel[status]}
    </StatusBadge>
  );
}

// Corrections to the details that affect the price: only what differs from
// what's saved is sent
function useCorrection<T extends Record<string, unknown>>(
  home: PropertyView,
  saved: T,
  // what is sent of the changes, if not just them
  toSend: (changes: Partial<T>, details: T) => Partial<T> = (c) => c,
) {
  const [details, setDetails] = useState(saved);
  const action = useAction("The corrections weren't saved. Please try again.");

  const change = (update: Partial<T>) =>
    setDetails((current) => ({ ...current, ...update }));
  const changes = Object.fromEntries(
    Object.entries(details).filter(([key, value]) => value !== saved[key]),
  ) as Partial<T>;

  // Access Instructions are saved apart: the Client keeps them too
  const { accessInstructions, ...priced } = toSend(changes, details);
  const save = () =>
    action.run(async () => {
      if (Object.keys(priced).length > 0)
        await patchJson(`/api/properties/${home.id}`, priced);
      if (accessInstructions !== undefined)
        await patchJson(`/api/properties/${home.id}/access-instructions`, {
          accessInstructions,
        });
    }, "Details corrected");

  return {
    details,
    change,
    hasChanges: Object.keys(changes).length > 0,
    save,
    fieldErrors: action.fieldErrors,
    isSaving: action.isPending,
    problem: action.problem,
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
    <Card>
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
      {correction.problem && (
        <Notice tone="danger">{correction.problem}</Notice>
      )}
      <Actions>
        <Button
          type="submit"
          isDisabled={!correction.hasChanges}
          isPending={correction.isSaving}
        >
          Save corrections
        </Button>
      </Actions>
    </Form>
  );
}

// how the crew gets in: the Client's to keep, which the Office may
// correct too
function AccessInstructionsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (instructions: string) => void;
}) {
  return (
    <TextField
      label="Access Instructions"
      name="accessInstructions"
      description="The Client sees these, and can change them too."
      multiline
      value={value}
      onChange={onChange}
    />
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

const ROOMS = ["bedrooms", "bathrooms", "storeys", "pets"] as const;

function HomeDetails({
  home,
  officeNotes,
}: {
  home: HomeView;
  officeNotes: string | null;
}) {
  const noRooms = home.bedrooms === null;
  const correction = useCorrection(
    home,
    {
      type: home.type,
      bedrooms: home.bedrooms,
      bathrooms: home.bathrooms,
      storeys: home.storeys,
      pets: home.pets ?? false,
      floorArea: home.floorArea,
      condition: home.condition,
      officeNotes: officeNotes ?? "",
      accessInstructions: home.accessInstructions ?? "",
    },
    // a home without its rooms is given all four at once
    (changes, details) =>
      noRooms && ROOMS.some((r) => r in changes)
        ? {
            ...changes,
            ...Object.fromEntries(ROOMS.map((r) => [r, details[r]])),
          }
        : changes,
  );
  const { details, change } = correction;
  // a cleared field is no number
  const count = (value: number) => (Number.isNaN(value) ? null : value);

  return (
    <CorrectionForm correction={correction}>
      <PlaceTiles value={details.type} onChange={(type) => change({ type })} />
      {noRooms && (
        <Notice>
          Its rooms aren't recorded yet: it was asked about for a Service that
          isn't priced from them. Enter them to quote it for one that is.
        </Notice>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
        <NumberField
          label="Bedrooms"
          name="bedrooms"
          minValue={0}
          maxValue={20}
          value={details.bedrooms ?? Number.NaN}
          onChange={(bedrooms) => change({ bedrooms: count(bedrooms) })}
        />
        <NumberField
          label="Bathrooms"
          name="bathrooms"
          minValue={0.5}
          maxValue={20}
          step={0.5}
          value={details.bathrooms ?? Number.NaN}
          onChange={(bathrooms) => change({ bathrooms: count(bathrooms) })}
        />
        <NumberField
          label="Floors"
          name="storeys"
          minValue={1}
          maxValue={5}
          value={details.storeys ?? Number.NaN}
          onChange={(storeys) => change({ storeys: count(storeys) })}
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
      <ConditionField
        value={details.condition}
        onChange={(condition) => change({ condition })}
      />
      <AccessInstructionsField
        value={details.accessInstructions}
        onChange={(accessInstructions) => change({ accessInstructions })}
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
    accessInstructions: premises.accessInstructions ?? "",
  });
  const { details, change } = correction;
  const choices = premisesTypes.some((t) => t.key === premises.premisesType.key)
    ? premisesTypes
    : [premises.premisesType, ...premisesTypes];

  return (
    <CorrectionForm correction={correction}>
      <PlaceTiles value="commercial" />
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
      <ConditionField
        value={details.condition}
        onChange={(condition) => change({ condition })}
      />
      <AccessInstructionsField
        value={details.accessInstructions}
        onChange={(accessInstructions) => change({ accessInstructions })}
      />
      <OfficeNotesField
        value={details.officeNotes}
        onChange={(notes) => change({ officeNotes: notes })}
      />
    </CorrectionForm>
  );
}
