// PROTOTYPE: throwaway. Layouts for the Office's Quote page, picked by
// ?variant= (A is the current page). Each answers "what do I do next with
// this Quote?" differently; all reuse the real blocks, so every action works.
import { useState, type ReactNode } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarCheck,
  CircleCheck,
  CircleSlash,
  FileClock,
  Hourglass,
  MessageSquareText,
  Send,
  type LucideIcon,
} from "lucide-react";
import type { OfficeQuote } from "@empire-cleaning/models";
import {
  Breadcrumbs,
  Card,
  Heading,
  Link,
  Notice,
  Section,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  clientName,
  conditionLabel,
  formatDate,
  formatDateTime,
  formatMoney,
  planRhythm,
  propertySummary,
} from "../format.ts";
import { AddOnList, QuoteStatusBadge } from "../QuoteParts.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { homeCrumbs } from "./PropertyScreen.tsx";
import {
  AskedFacts,
  FirstRevision,
  SiteVisitCard,
  SuggestedPrices,
  TurnDownQuote,
  propertyLink,
  turnDownLabel,
} from "./QuoteAsked.tsx";
import {
  DraftEditor,
  FirstCleanCard,
  NewRevision,
  OfferCards,
  PlanChangeNotice,
  PricedFrom,
  RecordAcceptance,
  RevisionHistory,
  shownOf,
  unsent,
  type ShownQuote,
} from "./QuoteScreen.tsx";

const variants = [
  { key: "A", name: "Current" },
  { key: "B", name: "Next step up top" },
  { key: "C", name: "Two columns" },
  { key: "D", name: "Tabs" },
  { key: "E", name: "Timeline" },
];

export function QuotePrototype() {
  const quote = useLoaderData({ from: "/office/quotes/$quoteId" });
  const { variant } = useSearch({ from: "/office/quotes/$quoteId" });
  const navigate = useNavigate();
  const pick = (key: string) =>
    void navigate({
      to: ".",
      search: { variant: key === "A" ? "A" : key },
      replace: true,
    });

  const page =
    variant === "C" ? (
      <TwoColumns quote={quote} />
    ) : variant === "D" ? (
      <TabbedPage quote={quote} />
    ) : variant === "E" ? (
      <Timeline quote={quote} />
    ) : (
      <NextStepUpTop quote={quote} />
    );

  return (
    <>
      {page}
      <PrototypeSwitcher
        variants={variants}
        current={variant ?? "B"}
        onChange={pick}
      />
    </>
  );
}

// ---- shared: the header, the next step, the work, and the facts ----

function Header({ quote }: { quote: OfficeQuote }) {
  const kind = quote.kind === "service_plan" ? "Service Plan Quote" : "Quote";
  const revising = quote.draft !== null && quote.offer !== null;
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: "Quotes", href: linkTo({ to: "/office/quotes" }) },
          ...homeCrumbs(quote.client, quote.property),
          { label: kind },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Heading level={1}>
          {kind} for {clientName(quote.client)}
        </Heading>
        <QuoteStatusBadge status={quote.status} />
        {revising && <StatusBadge tone="info">Draft changes</StatusBadge>}
        {unsent(quote) && (
          <div className="ml-auto">
            <TurnDownQuote quote={quote} />
          </div>
        )}
      </div>
      <p className="text-fg-muted">
        {addressOf(quote.property)} · {propertySummary(quote.property)} ·{" "}
        <Link href={propertyLink(quote)}>View Property</Link>
      </p>
    </div>
  );
}

const shownFor = (quote: OfficeQuote) =>
  quote.draft || quote.offer ? shownOf(quote) : null;

// what the Office does next with the Quote, and the buttons for it, whatever
// its status
function NextStep({ quote }: { quote: OfficeQuote }) {
  const shown = shownFor(quote);
  const revising = quote.draft !== null && quote.offer !== null;

  switch (quote.status) {
    case "requested":
      return quote.siteVisit === "needed" && !quote.bookedSiteVisit ? (
        <SiteVisitCard quote={quote} />
      ) : (
        <FirstRevision quote={quote} />
      );
    case "draft":
      return (
        <Notice>
          Drafting Revision {shown!.revision}: set the prices and time below,
          then send it from the bar at the bottom. Nothing reaches{" "}
          {quote.client.name} until then.
        </Notice>
      );
    case "sent":
      if (revising) {
        return (
          <div className="flex flex-col gap-4">
            <Notice>
              You're drafting Revision {shown!.revision}. {quote.client.name}{" "}
              still sees Revision {quote.offer!.number} until you send it.
            </Notice>
            {quote.bookable.length > 0 && (
              <RecordAcceptance
                quote={shownOf({ ...quote, draft: null })}
                drafting={shown!.revision}
              />
            )}
          </div>
        );
      }
      return quote.bookable.length > 0 ? (
        <div className="flex flex-col gap-3">
          <RecordAcceptance quote={shown!} />
          <NewRevision quote={shown!} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Notice tone="danger">
            The time offered has filled up since this Quote was sent, so{" "}
            {quote.client.name} can't accept it. Draft a new Revision with
            another time: it replaces this offer.
          </Notice>
          <NewRevision quote={shown!} />
        </div>
      );
    case "expired":
      return (
        <Card>
          <p>
            <strong>Expired {formatDateTime(shown!.expiresAt!)}</strong> without
            a reply. To offer it again, draft a new Revision.
          </p>
          <NewRevision quote={shown!} />
        </Card>
      );
    case "declined":
      return (
        <Card>
          <p>
            <strong>
              {quote.client.name} declined it{" "}
              {formatDateTime(quote.declinedAt!)}.
            </strong>{" "}
            To offer something different, draft a new Revision.
          </p>
          <NewRevision quote={shown!} />
        </Card>
      );
    case "accepted":
      return (
        <Notice tone="success">
          Accepted {formatDateTime(quote.acceptedAt!)}:{" "}
          {quote.servicePlanId ? (
            <Link
              href={linkTo({
                to: "/office/service-plans/$planId",
                params: { planId: quote.servicePlanId },
              })}
            >
              {quote.changedPlan
                ? "its Service Plan has changed"
                : "its Service Plan has started"}
            </Link>
          ) : (
            `${shown!.options.find((o) => o.serviceKey === quote.acceptedServiceKey)?.serviceName}, booked`
          )}
          . Nothing more to do here.
        </Notice>
      );
    case "turned_down":
      return (
        <Notice>
          Turned Down {formatDate(quote.turnedDownAt!)}:{" "}
          {turnDownLabel[quote.turnDownReason!].toLowerCase()}. The Client can
          ask for a new Quote.
        </Notice>
      );
  }
}

// the Quote itself: the Suggested Price before any Revision, the editor
// while one's drafted, else the offer
function Work({ quote }: { quote: OfficeQuote }) {
  const shown = shownFor(quote);
  if (quote.status === "turned_down") return null;
  if (!shown) return <SuggestedPrices quote={quote} />;
  if (quote.draft) return <DraftEditor key={quote.id} quote={shown} />;
  return <Offer quote={shown} />;
}

// the offer, read-only, under a title on the page
function Offer({ quote }: { quote: ShownQuote }) {
  return (
    <Section
      title={`Revision ${quote.revision}`}
      description={`Sent ${formatDateTime(quote.sentAt!)} to ${quote.client.email}`}
    >
      <OfferFacts quote={quote} />
      <OfferCards quote={quote}>
        {(option) => <PricedFrom option={option} />}
      </OfferCards>
      {quote.firstClean && <FirstCleanCard firstClean={quote.firstClean} />}
      <p className="text-sm text-fg-muted">
        Priced from Price List version {quote.priceListVersion}. A Sent Revision
        never changes: to offer something different, draft a new one.
      </p>
    </Section>
  );
}

function OfferFacts({ quote }: { quote: ShownQuote }) {
  return (
    <Card>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">
          {quote.changesPlan || quote.changedPlan
            ? "New terms start"
            : quote.plan
              ? "Starts"
              : "Proposed time"}
        </dt>
        <dd>{formatDateTime(quote.proposedStartsAt!)}</dd>
        {quote.plan && (
          <>
            <dt className="font-semibold">Then</dt>
            <dd>
              {planRhythm(quote.plan)}, priced for{" "}
              {conditionLabel[quote.plan.condition].toLowerCase()} Condition
            </dd>
          </>
        )}
        <dt className="font-semibold">
          {quote.status === "expired" ? "Expired" : "Expires"}
        </dt>
        <dd>{formatDateTime(quote.expiresAt!)}</dd>
        <dt className="font-semibold">Add-ons</dt>
        <dd>
          {quote.addOns.length === 0 ? (
            "None"
          ) : (
            <AddOnList addOns={quote.addOns} />
          )}
        </dd>
      </dl>
    </Card>
  );
}

function Asked({ quote }: { quote: OfficeQuote }) {
  if (!quote.asked) return null;
  return (
    <Section title="What was asked">
      <Card>
        <AskedFacts quote={quote} />
      </Card>
    </Section>
  );
}

// the Site Visit while nothing is Sent, unless the next step already shows it
function Visit({ quote }: { quote: OfficeQuote }) {
  const inNextStep =
    quote.status === "requested" &&
    quote.siteVisit === "needed" &&
    !quote.bookedSiteVisit;
  return inNextStep ? null : <SiteVisitCard quote={quote} />;
}

function Change({ quote }: { quote: OfficeQuote }) {
  const shown = shownFor(quote);
  return quote.status !== "turned_down" && shown?.changesPlan ? (
    <PlanChangeNotice quote={shown} change={shown.changesPlan} />
  ) : null;
}

// ---- B: the next step up top, then the Quote, then what was asked ----

function NextStepUpTop({ quote }: { quote: OfficeQuote }) {
  return (
    <div className="flex flex-col gap-6">
      <Header quote={quote} />
      <Change quote={quote} />
      <NextStep quote={quote} />
      <Work quote={quote} />
      <Asked quote={quote} />
      <Visit quote={quote} />
      <RevisionHistory quote={quote} />
    </div>
  );
}

// ---- C: the work in a wide column, the facts beside it ----

function TwoColumns({ quote }: { quote: OfficeQuote }) {
  return (
    <div className="flex flex-col gap-6">
      <Header quote={quote} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Change quote={quote} />
          <NextStep quote={quote} />
          <Work quote={quote} />
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          {quote.asked && (
            <Section title="What was asked" headingLevel={2}>
              <Card className="text-sm">
                <AskedFacts quote={quote} />
              </Card>
            </Section>
          )}
          <Visit quote={quote} />
          <RevisionHistory quote={quote} />
        </aside>
      </div>
    </div>
  );
}

// ---- D: the next step, then Tabs for the Quote, the ask and its history ----

function TabbedPage({ quote }: { quote: OfficeQuote }) {
  const [tab, setTab] = useState<string>("quote");
  const workLabel = quote.draft
    ? "Draft"
    : quote.offer
      ? "Offer"
      : "Suggested Price";
  return (
    <div className="flex flex-col gap-6">
      <Header quote={quote} />
      <Change quote={quote} />
      <NextStep quote={quote} />
      <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
        <TabList aria-label="About this Quote">
          <Tab id="quote">{workLabel}</Tab>
          <Tab id="asked">What was asked</Tab>
          <Tab id="history" count={quote.revisions.length}>
            Revisions
          </Tab>
        </TabList>
        <TabPanel id="quote">
          <div className="flex flex-col gap-6 pt-2">
            {quote.status === "turned_down" ? (
              <p className="text-fg-muted">Turned Down before it was quoted.</p>
            ) : (
              <Work quote={quote} />
            )}
          </div>
        </TabPanel>
        <TabPanel id="asked">
          <div className="flex flex-col gap-6 pt-2">
            {quote.asked ? (
              <Card>
                <AskedFacts quote={quote} />
              </Card>
            ) : (
              <p className="text-fg-muted">
                The Office offered this Quote without being asked.
              </p>
            )}
            <Visit quote={quote} />
          </div>
        </TabPanel>
        <TabPanel id="history">
          <div className="pt-2">
            {quote.revisions.length > 0 ? (
              <RevisionHistory quote={quote} />
            ) : (
              <p className="text-fg-muted">Nothing has been sent yet.</p>
            )}
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}

// ---- E: the Quote as a story, newest first ----

type Moment = {
  at: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  details?: ReactNode;
};

const momentsOf = (quote: OfficeQuote): Moment[] => {
  const shown = shownFor(quote);
  const moments: Moment[] = [];
  if (quote.asked) {
    moments.push({
      at: quote.createdAt,
      icon: MessageSquareText,
      title:
        quote.origin === "caller"
          ? `${quote.client.name} asked by phone`
          : `${quote.client.name} asked for a Quote`,
      description: quote.asked.service.name,
      details: <AskedFacts quote={quote} />,
    });
  }
  const visitAt = quote.bookedSiteVisit?.startsAt;
  if (visitAt) {
    moments.push({
      at: visitAt,
      icon: CalendarCheck,
      title: "Site Visit",
      description: formatDateTime(visitAt),
    });
  }
  // oldest Revision first here; sorted below
  for (const revision of quote.revisions) {
    moments.push({
      at: revision.sentAt,
      icon: Send,
      title: `Revision ${revision.number} sent`,
      description: `${formatMoney(revision.headlineTotalCents)} · for ${formatDateTime(revision.proposedStartsAt)}`,
    });
  }
  if (quote.status === "expired" && shown?.expiresAt) {
    moments.push({ at: shown.expiresAt, icon: Hourglass, title: "Expired" });
  }
  if (quote.declinedAt) {
    moments.push({
      at: quote.declinedAt,
      icon: CircleSlash,
      title: `${quote.client.name} declined it`,
    });
  }
  if (quote.acceptedAt) {
    moments.push({
      at: quote.acceptedAt,
      icon: CircleCheck,
      title: `${quote.client.name} accepted it`,
    });
  }
  if (quote.turnedDownAt) {
    moments.push({
      at: quote.turnedDownAt,
      icon: CircleSlash,
      title: "Turned Down",
      description: turnDownLabel[quote.turnDownReason!],
    });
  }
  return moments.sort((a, b) => b.at.localeCompare(a.at));
};

function Timeline({ quote }: { quote: OfficeQuote }) {
  const moments = momentsOf(quote);
  return (
    <div className="flex flex-col gap-6">
      <Header quote={quote} />
      <Change quote={quote} />
      <ol className="flex flex-col">
        <TimelineEntry icon={FileClock} title="Now" current>
          <div className="flex flex-col gap-6">
            <NextStep quote={quote} />
            <Work quote={quote} />
            <Visit quote={quote} />
          </div>
        </TimelineEntry>
        {moments.map((moment, i) => (
          <TimelineEntry
            key={`${moment.at}-${i}`}
            icon={moment.icon}
            title={moment.title}
            when={formatDate(moment.at)}
            description={moment.description}
            last={i === moments.length - 1}
          >
            {moment.details && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  Show details
                </summary>
                <Card className="mt-2">{moment.details}</Card>
              </details>
            )}
          </TimelineEntry>
        ))}
      </ol>
    </div>
  );
}

function TimelineEntry({
  icon: Icon,
  title,
  when,
  description,
  current,
  last,
  children,
}: {
  icon: LucideIcon;
  title: string;
  when?: string;
  description?: string;
  current?: boolean;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3">
      <div className="flex flex-col items-center">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            current
              ? "bg-primary text-primary-fg"
              : "bg-surface-sunken text-fg-muted"
          }`}
        >
          <Icon aria-hidden size={18} />
        </span>
        {!last && <span className="w-px flex-1 bg-border" aria-hidden />}
      </div>
      <div className="flex min-w-0 flex-col gap-2 pb-8 pt-2">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{title}</span>
          {when && <span className="text-sm text-fg-muted">{when}</span>}
        </p>
        {description && (
          <p className="-mt-1 text-sm text-fg-muted">{description}</p>
        )}
        {children}
      </div>
    </li>
  );
}
