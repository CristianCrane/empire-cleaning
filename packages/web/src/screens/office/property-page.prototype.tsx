// PROTOTYPE: throwaway. /office/properties/$propertyId?variant=A|B|C|D.
// Question: how does a Property page show its details first, without its
// Service Plan, Site Visits and history piled on top?
import { useState, type ReactNode } from "react";
import {
  useLoaderData,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  MapPin,
  Pencil,
  Repeat,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type {
  OfficePropertyView,
  PremisesTypeChoice,
} from "@empire-cleaning/models";
import {
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Cell,
  Column,
  Dialog,
  DialogTrigger,
  Heading,
  IconTile,
  List,
  ListItem,
  Notice,
  Row,
  StatusBadge,
  Tab,
  Table,
  TableBody,
  TableHeader,
  TabList,
  TabPanel,
  Tabs,
} from "@empire-cleaning/ui";
import { linkTo, type AppHref } from "../../links.ts";
import {
  addressOf,
  cleanTypeLabel,
  clientName,
  conditionLabel,
  formatDate,
  formatDateTime,
  planName,
  propertySummary,
  quoteHeadline,
} from "../format.ts";
import { QuoteIcon } from "../icons.ts";
import { PlanStatusBadge } from "../PlanParts.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import {
  Details,
  History,
  HomeDetails,
  jobStatusLabel,
  PlanLink,
  PremisesDetails,
  SiteVisits,
} from "./PropertyScreen.tsx";
import {
  BookSiteVisit,
  RecordFindingsWithoutVisit,
  SiteVisitBadge,
  visitSummary,
} from "./SiteVisitParts.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";

const from = "/office/properties/$propertyId" as const;

const variants = [
  { key: "A", name: "current" },
  { key: "B", name: "Tabs per kind" },
  { key: "C", name: "Details | History" },
  { key: "D", name: "C, details read then Edit" },
  { key: "E", name: "all in Tabs, empty states" },
];

type Props = {
  home: OfficePropertyView;
  premisesTypes: PremisesTypeChoice[];
};

export function PropertyPrototype() {
  const { home, premisesTypes } = useLoaderData({ from });
  const { variant = "A" } = useSearch({ from });
  const navigate = useNavigate({ from });

  return (
    <div className="flex flex-col gap-6">
      {variant === "A" ? (
        <>
          <Header home={home} premisesTypes={premisesTypes} actions={false} />
          {home.servicePlan && <PlanLink plan={home.servicePlan} />}
          <SiteVisits home={home} premisesTypes={premisesTypes} />
          <History home={home} />
          <Details home={home} premisesTypes={premisesTypes} />
        </>
      ) : (
        <>
          <Header
            home={home}
            premisesTypes={premisesTypes}
            actions={variant !== "E"}
            subtitle
          />
          {variant !== "E" && <GoingOn home={home} />}
          {variant === "E" ? (
            <AllTabs home={home} premisesTypes={premisesTypes} />
          ) : variant === "B" ? (
            <KindTabs home={home} premisesTypes={premisesTypes} />
          ) : (
            <HistoryTabs
              home={home}
              details={
                variant === "D" ? (
                  <DetailFacts home={home} premisesTypes={premisesTypes} />
                ) : (
                  <DetailForm home={home} premisesTypes={premisesTypes} />
                )
              }
            />
          )}
        </>
      )}
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onChange={(key) =>
          void navigate({ search: { variant: key }, replace: true })
        }
      />
    </div>
  );
}

// the page's title, whose it is, and what can be done to it: booking a Site
// Visit (it has no Section of its own) and offering a Service Plan
function Header({
  home,
  premisesTypes,
  actions,
  subtitle = actions,
}: Props & { actions: boolean; subtitle?: boolean }) {
  const premises = home.kind === "commercial";
  const booked = home.siteVisits.some((v) => v.status === "booked");
  const unsent = home.quotes.find(
    (q) => q.status === "requested" || q.status === "draft",
  );
  const needsVisit = premises && !home.findingsRecorded;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: "Clients", href: linkTo({ to: "/office/clients" }) },
          {
            label: clientName(home.client),
            href: linkTo({
              to: "/office/clients/$clientId",
              params: { clientId: home.client.id },
            }),
          },
          { label: addressOf(home) },
        ]}
      />
      <div className="flex flex-col gap-1">
        <Heading level={1}>{addressOf(home)}</Heading>
        {subtitle && (
          <p className="text-fg-muted">
            {clientName(home.client)} · {propertySummary(home)}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {unsent && !booked && (
            <BookSiteVisit quoteId={unsent.id} primary={needsVisit} />
          )}
          {premises && !booked && !home.findingsRecorded && (
            <RecordFindingsWithoutVisit
              property={home}
              officeNotes={home.officeNotes}
              premisesTypes={premisesTypes}
            />
          )}
          {(home.firstCleanCompleted || premises) && (
            <OfferServicePlan
              propertyId={home.id}
              label={home.servicePlan ? "Change its Service Plan" : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

// what's under way at the home, each a row opening its own page: its
// Service Plan and a booked Site Visit. Business premises not yet seen say so
function GoingOn({ home }: { home: OfficePropertyView }) {
  const navigate = useNavigate();
  const booked = home.siteVisits.find((v) => v.status === "booked");
  const needsVisit = home.kind === "commercial" && !home.findingsRecorded;
  const plan = home.servicePlan;

  return (
    <>
      {needsVisit && (
        <Notice>
          {booked
            ? "Record what the Site Visit finds, and a Quote can be sent."
            : "Business premises are seen before they're quoted. Book a Site Visit, or record findings you know already."}
        </Notice>
      )}
      {(plan || booked) && (
        <List aria-label="Under way">
          {plan ? (
            <ListItem
              id={`plan ${plan.id}`}
              start={<IconTile icon={Repeat} tone="success" />}
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
          ) : null}
          {booked ? (
            <ListItem
              id={`visit ${booked.id}`}
              start={<IconTile icon={MapPin} tone="info" />}
              title="Site Visit"
              description={visitSummary(booked)}
              end={<SiteVisitBadge status={booked.status} />}
              onAction={() =>
                void navigate({
                  to: "/office/site-visits/$visitId",
                  params: { visitId: booked.id },
                })
              }
            />
          ) : null}
        </List>
      )}
    </>
  );
}

// B: a Tab for each kind of thing the home has
function KindTabs({ home, premisesTypes }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>("details");
  const empty = (what: string) => () => (
    <p className="p-4 text-center text-fg-muted">No {what} yet.</p>
  );

  return (
    <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
      <TabList aria-label="About this Property">
        <Tab id="details">Details</Tab>
        <Tab id="quotes" count={home.quotes.length}>
          Quotes
        </Tab>
        <Tab id="jobs" count={home.jobs.length}>
          Jobs
        </Tab>
        <Tab id="visits" count={home.siteVisits.length}>
          Site Visits
        </Tab>
      </TabList>
      <TabPanel id="details">
        <DetailForm home={home} premisesTypes={premisesTypes} />
      </TabPanel>
      <TabPanel id="quotes">
        <List
          aria-label={`Quotes for ${addressOf(home)}`}
          renderEmptyState={empty("Quotes")}
        >
          {home.quotes.map((quote) => (
            <ListItem
              key={quote.id}
              id={quote.id}
              title={quoteHeadline(quote)}
              description={
                quote.sentAt
                  ? `Sent ${formatDate(quote.sentAt)}`
                  : `Asked ${formatDate(quote.createdAt)}`
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
      </TabPanel>
      <TabPanel id="jobs">
        <List
          aria-label={`Jobs at ${addressOf(home)}`}
          renderEmptyState={empty("Jobs")}
        >
          {home.jobs.map((job) => (
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
      </TabPanel>
      <TabPanel id="visits">
        <List
          aria-label={`Site Visits to ${addressOf(home)}`}
          renderEmptyState={empty("Site Visits")}
        >
          {home.siteVisits.map((visit) => (
            <ListItem
              key={visit.id}
              id={visit.id}
              title={visitSummary(visit)}
              end={<SiteVisitBadge status={visit.status} />}
              onAction={() =>
                void navigate({
                  to: "/office/site-visits/$visitId",
                  params: { visitId: visit.id },
                })
              }
            />
          ))}
        </List>
      </TabPanel>
    </Tabs>
  );
}

type Event = {
  id: string;
  on: string;
  icon: LucideIcon;
  kind: string;
  what: string;
  status: ReactNode;
  href: AppHref;
};

// C and D: its details, and everything that's happened there in one
// History, newest first
function HistoryTabs({
  home,
  details,
}: {
  home: OfficePropertyView;
  details: ReactNode;
}) {
  const [tab, setTab] = useState<string>("details");
  const events = historyOf(home);

  return (
    <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
      <TabList aria-label="About this Property">
        <Tab id="details">Details</Tab>
        <Tab id="history" count={events.length}>
          History
        </Tab>
      </TabList>
      <TabPanel id="details">{details}</TabPanel>
      <TabPanel id="history">
        <HistoryTable home={home} />
      </TabPanel>
    </Tabs>
  );
}

const historyOf = (home: OfficePropertyView): Event[] =>
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
      what: cleanTypeLabel[job.cleanType],
      status: <StatusBadge>{jobStatusLabel[job.status]}</StatusBadge>,
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

function HistoryTable({ home }: { home: OfficePropertyView }) {
  const navigate = useNavigate();
  const events = historyOf(home);
  return (
    <Table
      aria-label={`History of ${addressOf(home)}`}
      onRowAction={(id) => {
        const href = events.find((e) => e.id === id)?.href;
        if (href) void navigate(href);
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

// B and C: the details as today's form, always open
function DetailForm({ home, premisesTypes }: Props) {
  return (
    <Card>
      <p className="text-sm text-fg-muted">
        Access Instructions:{" "}
        <span className="whitespace-pre-line text-fg">
          {home.accessInstructions || "None given"}
        </span>
      </p>
      <CorrectionFields home={home} premisesTypes={premisesTypes} />
    </Card>
  );
}

function CorrectionFields({ home, premisesTypes }: Props) {
  return home.kind === "commercial" ? (
    <PremisesDetails
      premises={home}
      officeNotes={home.officeNotes}
      premisesTypes={premisesTypes}
    />
  ) : (
    <HomeDetails home={home} officeNotes={home.officeNotes} />
  );
}

const typeLabel = {
  house: "House",
  apartment: "Apartment",
  townhouse: "Townhouse",
};

// D: the details to read, with an Edit button for corrections, as a
// Client's contact details are
function DetailFacts({ home, premisesTypes }: Props) {
  const facts: [string, ReactNode][] =
    home.kind === "commercial"
      ? [
          ["Premises", home.premisesType.name],
          [
            "Floor area",
            home.floorArea ? `${home.floorArea} sq ft` : "Not known yet",
          ],
        ]
      : [
          ["Type", typeLabel[home.type]],
          ["Bedrooms", home.bedrooms],
          ["Bathrooms", home.bathrooms],
          ["Floors", home.storeys],
          [
            "Floor area",
            home.floorArea ? `${home.floorArea} sq ft` : "Not given",
          ],
          ["Pets", home.pets ? "Yes" : "No"],
        ];
  facts.push(
    [
      "Condition",
      home.condition ? conditionLabel[home.condition] : "Not recorded yet",
    ],
    ["Access", home.accessInstructions || "None given"],
    ["Office notes", home.officeNotes || "None"],
  );

  return (
    <Card>
      <div className="flex items-start gap-3">
        <dl className="grid flex-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold">{label}</dt>
              <dd className="whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
        <DialogTrigger>
          <Button variant="text" size="sm">
            <Pencil aria-hidden size={16} />
            Edit
          </Button>
          <Dialog title="Correct the details">
            <CorrectionFields home={home} premisesTypes={premisesTypes} />
          </Dialog>
        </DialogTrigger>
      </div>
    </Card>
  );
}

// E: everything in Tabs, Details first. The Service Plan and Site Visit
// Tabs show the one the home has, or say it has none and offer the action
function AllTabs({ home, premisesTypes }: Props) {
  const [tab, setTab] = useState<string>("details");
  const needsVisit = home.kind === "commercial" && !home.findingsRecorded;

  return (
    <>
      {needsVisit && (
        <Notice>
          Business premises are seen before they're quoted: see the Site Visit
          Tab.
        </Notice>
      )}
      <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
        <TabList aria-label="About this Property">
          <Tab id="details">Details</Tab>
          <Tab id="plan">Service Plan</Tab>
          <Tab id="visit">Site Visit</Tab>
          <Tab id="history" count={historyOf(home).length}>
            History
          </Tab>
        </TabList>
        <TabPanel id="details">
          <DetailForm home={home} premisesTypes={premisesTypes} />
        </TabPanel>
        <TabPanel id="plan">
          <PlanTab home={home} />
        </TabPanel>
        <TabPanel id="visit">
          <VisitTab home={home} premisesTypes={premisesTypes} />
        </TabPanel>
        <TabPanel id="history">
          <HistoryTable home={home} />
        </TabPanel>
      </Tabs>
    </>
  );
}

// a Tab with nothing in it yet: what's missing, and the way to add it
function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="items-center py-10 text-center">
      <IconTile icon={icon} tone="neutral" />
      <div className="flex max-w-md flex-col gap-1">
        <Heading level={2} size={4}>
          {title}
        </Heading>
        <p className="text-fg-muted">{description}</p>
      </div>
      {children && (
        <div className="flex flex-wrap justify-center gap-2">{children}</div>
      )}
    </Card>
  );
}

function PlanTab({ home }: { home: OfficePropertyView }) {
  const plan = home.servicePlan;
  const canOffer = home.firstCleanCompleted || home.kind === "commercial";

  if (!plan) {
    return (
      <EmptyState
        icon={Repeat}
        title="This Property doesn't have a Service Plan"
        description={
          canOffer
            ? "Quote regular cleaning: the Client accepts the Quote and their Jobs are booked for them."
            : "A home can be quoted a Service Plan once its First Clean is Completed."
        }
      >
        {canOffer && (
          <OfferServicePlan
            propertyId={home.id}
            label="Quote a Service Plan"
            primary
          />
        )}
      </EmptyState>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level={2} size={4}>
              {planName(plan)}
            </Heading>
            <PlanStatusBadge status={plan.status} />
          </div>
          <p className="text-fg-muted">
            {plan.nextStartsAt
              ? `Next Job: ${formatDateTime(plan.nextStartsAt)}`
              : "No Job booked just now"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OfferServicePlan propertyId={home.id} label="Change terms" />
          <ButtonLink
            variant="text"
            size="sm"
            href={linkTo({
              to: "/office/service-plans/$planId",
              params: { planId: plan.id },
            })}
          >
            <ArrowRight aria-hidden size={16} />
            Open the plan
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}

// the home's Site Visit: the one booked, else the last done. Earlier ones
// are in History
function VisitTab({ home, premisesTypes }: Props) {
  const visit =
    home.siteVisits.find((v) => v.status === "booked") ??
    home.siteVisits.find((v) => v.status === "done");
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

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level={2} size={4}>
              {visit.status === "booked" ? "Booked" : "Seen"}
            </Heading>
            <SiteVisitBadge status={visit.status} />
          </div>
          <p className="text-fg-muted">{visitSummary(visit)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visit.status !== "booked" && actions(false)}
          <ButtonLink
            variant="text"
            size="sm"
            href={linkTo({
              to: "/office/site-visits/$visitId",
              params: { visitId: visit.id },
            })}
          >
            <ArrowRight aria-hidden size={16} />
            Open the Site Visit
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}
