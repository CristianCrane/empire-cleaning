import { useState, type ReactNode } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  CalendarCheck,
  House,
  KeyRound,
  MapPin,
  NotebookPen,
  Ruler,
  Sparkles,
  SquarePen,
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
  ActionRow,
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  IconTile,
  List,
  ListItem,
  Notice,
  NumberField,
  Section,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
  Timeline,
  TimelineItem,
  type Crumb,
  type StatusTone,
} from "@empire-cleaning/ui";
import { patchJson } from "../../api.ts";
import { linkTo, type AppHref } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  addressOf,
  clientName,
  conditionText,
  formatDate,
  formatDateTime,
  formatFloorArea,
  formatMinutes,
  propertySummary,
  quoteHeadline,
} from "../format.ts";
import { Fact } from "../Fact.tsx";
import { QuoteIcon } from "../icons.ts";
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import {
  BookSiteVisit,
  RecordFindingsWithoutVisit,
  SiteVisitBadge,
} from "./SiteVisitParts.tsx";
import { ConditionField, PlaceTiles } from "./PropertyFields.tsx";
import { PlanDetails } from "./ServicePlanScreen.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";

// A home for the Office (ADR-0011), read as a whole (UX pass, #96): what to
// know first in Notices; then its details, its Service Plan and its Site
// Visit on the left, and its whole history on the right, newest first. One
// column on a phone.
export function PropertyScreen() {
  const { home, premisesTypes, plan, visit } = useLoaderData({
    from: "/office/properties/$propertyId",
  });
  const history = historyOf(home);
  // new terms for its plan wait on a Quote already open: say which, first
  const { open, resumes } = quoteInTheWay(home);
  const newTerms = plan && open && !resumes ? open : undefined;

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
          <p className="text-fg-muted">{clientName(home.client)}</p>
        </div>
      </div>
      {home.kind === "commercial" && !home.findingsRecorded && (
        <Notice>
          Business premises are seen before they're quoted: book a Site Visit,
          or record findings you know already.
        </Notice>
      )}
      {newTerms && (
        <Notice action={<OpenQuote quoteId={newTerms.id} />}>
          {newTermsLine[newTerms.status as keyof typeof newTermsLine]}.
        </Notice>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Details home={home} premisesTypes={premisesTypes} />
          <PlanPart home={home} plan={plan} newTerms={!!newTerms} />
          <VisitPart home={home} visit={visit} premisesTypes={premisesTypes} />
        </div>
        <History home={home} events={history} />
      </div>
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

function OpenQuote({ quoteId }: { quoteId: string }) {
  return (
    <ButtonLink
      variant="text"
      size="sm"
      href={linkTo({ to: "/office/quotes/$quoteId", params: { quoteId } })}
    >
      Open the Quote
    </ButtonLink>
  );
}

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

// its Service Plan in full; or, with none, the way to quote one: a home once
// its First Clean is Completed, business premises at any time (ADR-0014)
function PlanPart({
  home,
  plan,
  newTerms,
}: {
  home: OfficePropertyView;
  plan: OfficeServicePlan | null;
  // new terms are open already, so none are offered
  newTerms: boolean;
}) {
  const { open, resumes } = quoteInTheWay(home);

  if (plan) {
    return (
      <PlanDetails
        plan={plan}
        changeTerms={
          !newTerms && (
            <OfferServicePlan
              propertyId={home.id}
              label={resumes ? "Carry on with the draft" : "Change terms"}
            />
          )
        }
      />
    );
  }

  const canQuote = home.firstCleanCompleted || home.kind === "commercial";
  // premises seen first: booking that visit is the page's one primary
  const seenFirst = home.kind === "commercial" && !home.findingsRecorded;
  const inTheWay = canQuote && open && !resumes ? open : undefined;
  return (
    <Section title="Service Plan">
      <Card>
        <ActionRow
          actions={
            inTheWay ? (
              <ButtonLink
                variant="secondary"
                href={linkTo({
                  to: "/office/quotes/$quoteId",
                  params: { quoteId: inTheWay.id },
                })}
              >
                Open the Quote
              </ButtonLink>
            ) : (
              canQuote && (
                <OfferServicePlan
                  propertyId={home.id}
                  label={
                    resumes ? "Carry on with the draft" : "Quote a Service Plan"
                  }
                  primary={!seenFirst}
                />
              )
            )
          }
        >
          <p>
            {inTheWay
              ? `${inTheWayLine[inTheWay.status as keyof typeof inTheWayLine]}: carry on with that one.`
              : canQuote
                ? "Quote regular cleaning: once the Client accepts, their Jobs are booked for them."
                : "A home can be quoted a Service Plan once its First Clean is Completed."}
          </p>
        </ActionRow>
      </Card>
    </Section>
  );
}

// the Site Visit a home's page shows: the one booked, else the last done.
// Earlier and cancelled ones are in its History
export const currentVisit = (home: OfficePropertyView) =>
  home.siteVisits.find((v) => v.status === "booked") ??
  home.siteVisits.find((v) => v.status === "done");

/**
 * Its Site Visit (#73) as a row opening its page, or, with none, the way to
 * book one. Business premises need findings recorded before a Quote is Sent
 * (ADR-0014); premises the Office knows can have them recorded with no visit.
 * A Site Visit is for a Quote with nothing Sent yet, and a Property has one
 * booked at a time.
 */
function VisitPart({
  home,
  visit,
  premisesTypes,
}: {
  home: OfficePropertyView;
  visit: OfficeSiteVisit | null;
  premisesTypes: PremisesTypeChoice[];
}) {
  const navigate = useNavigate();
  const unsent = home.quotes.find(
    (q) => q.status === "requested" || q.status === "draft",
  );
  const premises = home.kind === "commercial";
  const recordWithout = premises && !home.findingsRecorded;
  const actions = (primary: boolean) =>
    (unsent || recordWithout) && (
      <>
        {recordWithout && (
          <RecordFindingsWithoutVisit
            property={home}
            officeNotes={home.officeNotes}
            premisesTypes={premisesTypes}
          />
        )}
        {unsent && <BookSiteVisit quoteId={unsent.id} primary={primary} />}
      </>
    );

  if (!visit) {
    const can = actions(premises);
    // nothing to book it for: nothing to say
    if (!can) return null;
    return (
      <Section title="Site Visit">
        <Card>
          <ActionRow actions={can}>
            <p>
              {premises
                ? "Business premises are seen before they're quoted. Book a Site Visit, or record findings you know already."
                : "Optional for a home: book one to see it before quoting."}
            </p>
          </ActionRow>
        </Card>
      </Section>
    );
  }

  // once it's done, another can be booked for a Quote not sent yet
  return (
    <Section
      title="Site Visit"
      actions={
        visit.status !== "booked" &&
        unsent && <BookSiteVisit quoteId={unsent.id} />
      }
    >
      <List
        aria-label="Site Visit"
        onAction={() =>
          void navigate({
            to: "/office/site-visits/$visitId",
            params: { visitId: visit.id },
          })
        }
      >
        <ListItem
          id={visit.id}
          start={<IconTile icon={visit.startsAt ? MapPin : CalendarCheck} />}
          title={
            visit.startsAt
              ? formatDateTime(visit.startsAt)
              : "Findings recorded, with no visit"
          }
          description={
            visit.startsAt &&
            [
              visit.visitor?.name,
              formatMinutes(visit.minutes),
              visit.status === "booked" && "findings to record",
            ]
              .filter(Boolean)
              .join(" · ")
          }
          end={<SiteVisitBadge status={visit.status} />}
        />
      </List>
    </Section>
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

// its story, newest first, beside the rest: each thing opens its page
function History({
  home,
  events,
}: {
  home: OfficePropertyView;
  events: HistoryEvent[];
}) {
  return (
    <Section title="History">
      <Card>
        {events.length === 0 ? (
          <p className="text-center text-fg-muted">Nothing yet.</p>
        ) : (
          <Timeline aria-label={`History of ${addressOf(home)}`}>
            {events.map((event) => (
              <TimelineItem
                key={event.id}
                icon={event.icon}
                title={`${event.kind} · ${event.what}`}
                href={event.href}
                when={formatDate(event.on)}
                description={event.status}
              />
            ))}
          </Timeline>
        )}
      </Card>
    </Section>
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

// What the home is, large, then the details that affect the price and how
// it's got into, across (UX pass, #96). Clients keep what they first gave and
// ask for a new Quote to change it; the Office corrects it in a dialog, or a
// Site Visit's findings do (#73). The address is the Property's identity, so
// it isn't corrected.
function Details({
  home,
  premisesTypes,
}: {
  home: OfficePropertyView;
  premisesTypes: PremisesTypeChoice[];
}) {
  const premises = home.kind === "commercial";
  return (
    <Section
      title={premises ? "Premises details" : "Home details"}
      actions={
        <DialogTrigger>
          <Button variant="text" size="sm">
            <SquarePen aria-hidden size={16} />
            Correct
          </Button>
          <Dialog
            title={premises ? "Correct the premises" : "Correct the home"}
            size="lg"
          >
            {({ close }) =>
              home.kind === "commercial" ? (
                <PremisesDetails
                  premises={home}
                  officeNotes={home.officeNotes}
                  premisesTypes={premisesTypes}
                  close={close}
                />
              ) : (
                <HomeDetails
                  home={home}
                  officeNotes={home.officeNotes}
                  close={close}
                />
              )
            }
          </Dialog>
        </DialogTrigger>
      }
    >
      <Card>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <IconTile icon={premises ? Building2 : House} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm text-fg-muted">
                {premises ? "Business premises" : "A home"}
              </p>
              <p className="text-xl font-semibold text-fg">
                {propertySummary(home)}
              </p>
            </div>
          </div>
          {home.kind !== "commercial" && home.bedrooms === null && (
            <Notice tone="warning">
              Its rooms aren't recorded yet: it was asked about for a Service
              that isn't priced from them. Correct them to quote it for one that
              is.
            </Notice>
          )}
          {/* the columns follow the card's width, not the screen's: it
              shares the screen with the History */}
          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
              <Fact
                icon={Ruler}
                label="Floor area"
                value={
                  home.floorArea === null
                    ? "Not known yet"
                    : formatFloorArea(home.floorArea)
                }
              />
              <Fact
                icon={Sparkles}
                label="Condition"
                value={conditionText(home.condition)}
                line="Condition, at the last visit"
              />
              <Fact
                icon={KeyRound}
                label="How we get in"
                value={
                  <span className="whitespace-pre-line">
                    {home.accessInstructions || "Not added yet"}
                  </span>
                }
                line="How we get in: the Client's, and the crew's"
              />
              <Fact
                icon={NotebookPen}
                label="Office notes"
                value={
                  <span className="whitespace-pre-line">
                    {home.officeNotes || "None"}
                  </span>
                }
                line="Office notes: only Office Staff see them"
              />
            </dl>
          </div>
        </div>
      </Card>
    </Section>
  );
}

function CorrectionForm({
  correction,
  close,
  children,
}: {
  correction: ReturnType<typeof useCorrection>;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <Form
      validationErrors={correction.fieldErrors}
      onSubmit={async (e) => {
        e.preventDefault();
        if (await correction.save()) close();
      }}
    >
      <p className="text-sm text-fg-muted">
        Corrections to what it is change the price of Quotes made from now on.
      </p>
      {children}
      {correction.problem && (
        <Notice tone="danger">{correction.problem}</Notice>
      )}
      <Actions>
        <Button variant="quiet" onPress={close}>
          Cancel
        </Button>
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
  close,
}: {
  home: HomeView;
  officeNotes: string | null;
  close: () => void;
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
    <CorrectionForm correction={correction} close={close}>
      <PlaceTiles value={details.type} onChange={(type) => change({ type })} />
      {noRooms && (
        <Notice tone="warning">
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
  close,
}: {
  premises: PremisesView;
  officeNotes: string | null;
  premisesTypes: PremisesTypeChoice[];
  close: () => void;
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
    <CorrectionForm correction={correction} close={close}>
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
