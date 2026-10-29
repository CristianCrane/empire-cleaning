import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  CalendarCheck,
  CircleCheck,
  CircleSlash,
  FileClock,
  FilePenLine,
  FilePlus,
  Hourglass,
  Mail,
  MessageSquareText,
  Send,
  Trash2,
  CalendarPlus,
  type LucideIcon,
} from "lucide-react";
import {
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
} from "@internationalized/date";
import type {
  Condition,
  FirstCleanFindings,
  OfficeQuote,
  OfficeQuoteOption,
  OfficeRevision,
  PlanChange,
  PlanDayTerms,
  QuoteDraftInput,
  Recurrence,
  ScheduleDay,
  ServiceChoice,
  ServicePlanInput,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  DatePicker,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  Link,
  List,
  ListItem,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  Section,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
  TimeField,
  Timeline,
  TimelineItem,
  showToast,
} from "@empire-cleaning/ui";
import {
  ApiError,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction, useActionWith } from "../action.ts";
import {
  addressOf,
  adjustmentLabel,
  clientName,
  conditionLabel,
  dayOfInstant,
  formatClock,
  formatDate,
  formatDateTime,
  formatDay,
  formatHours,
  formatMoney,
  planName,
  planRhythm,
  propertySummary,
  recurrenceLabel,
  recurrenceWeeks,
  timeOfDay,
  weekdayOf,
} from "../format.ts";
import {
  AddOnList,
  OptionFigures,
  PlanFigures,
  PlanSaving,
  PlanTotals,
  QuoteStatusBadge,
  planDayTitle,
} from "../QuoteParts.tsx";
import { crewAt } from "../schedule-layout.ts";
import { homeCrumbs } from "./PropertyScreen.tsx";
import {
  AskedFacts,
  DraftQuote,
  PriceWorking,
  SeeThePremises,
  TurnDownQuote,
  propertyLink,
  turnDownLabel,
} from "./QuoteAsked.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";
import { BookSiteVisit, visitSummary } from "./SiteVisitParts.tsx";

// The Quote with one of its Revisions in hand: the one being drafted, or
// else the offer, so it's edited while there's a Draft Revision and
// read-only otherwise
type ShownQuote = Omit<OfficeQuote, "draft" | "offer"> &
  Omit<OfficeRevision, "id" | "number" | "status"> & {
    // the Revision shown
    revision: number;
  };

const shownOf = (quote: OfficeQuote): ShownQuote => {
  const { draft, offer, ...rest } = quote;
  const { id: _id, number, status: _status, ...fields } = (draft ?? offer)!;
  return { ...rest, ...fields, revision: number };
};

/**
 * One Quote for the Office, from asking to booking (ADR-0017), as its
 * story, newest first. On top, Now: what the Office does next and the Quote
 * itself, which is the Suggested Price while Requested, the Revision being
 * drafted (on a Sent Quote, marked as Draft changes, the offer standing
 * until it's sent, and still acceptable), or else the offer, read-only.
 * Below, each thing that happened to it, dated.
 */
export function QuoteScreen() {
  const quote = useLoaderData({ from: "/office/quotes/$quoteId" });
  const shown = shownFor(quote);
  const moments = momentsOf(quote);
  const offer =
    quote.offer && quote.status !== "turned_down"
      ? shownOf({ ...quote, draft: null })
      : null;

  return (
    <div className="flex flex-col gap-6">
      <QuoteHeader quote={quote} />
      <WhatsNext quote={quote} />
      {quote.status !== "turned_down" && shown?.changesPlan && (
        <PlanChangeNotice quote={shown} change={shown.changesPlan} />
      )}
      <Timeline aria-label="This Quote's story, newest first">
        {offer && (
          <TimelineItem icon={FileClock} title="Now" current>
            <Offer
              quote={offer}
              // a new Revision replaces it, unless one's being written
              actions={
                !quote.draft &&
                ["sent", "expired", "declined"].includes(quote.status) && (
                  <NewRevision quote={quote} />
                )
              }
            />
          </TimelineItem>
        )}
        {moments.map((moment) => (
          <TimelineItem
            key={moment.key}
            icon={moment.icon}
            title={moment.title}
            when={formatDate(moment.at)}
            description={moment.description}
          >
            {moment.details}
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
}

function QuoteHeader({ quote }: { quote: OfficeQuote }) {
  const kind = kindOf(quote);
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
          <div className="ml-auto flex flex-wrap gap-2">
            {/* optional for a home; business premises' notice asks for it */}
            {quote.property.kind !== "commercial" && !quote.bookedSiteVisit && (
              <BookSiteVisit quoteId={quote.id} />
            )}
            <TurnDownQuote quote={quote} />
          </div>
        )}
      </div>
      <PropertyLine quote={quote} />
    </div>
  );
}

const kindOf = (quote: OfficeQuote) =>
  quote.kind === "service_plan" ? "Service Plan Quote" : "Quote";

function PropertyLine({ quote }: { quote: OfficeQuote }) {
  return (
    <p className="text-fg-muted">
      {addressOf(quote.property)} · {propertySummary(quote.property)} ·{" "}
      <Link href={propertyLink(quote)}>View Property</Link>
    </p>
  );
}

const shownFor = (quote: OfficeQuote) =>
  quote.draft || quote.offer ? shownOf(quote) : null;

const draftLink = (quote: OfficeQuote) =>
  linkTo({
    to: "/office/quotes/$quoteId/draft",
    params: { quoteId: quote.id },
  });

// What there is to do with the Quote, above its story: one notice per
// thing, each with at most one action (a text button: a notice is passing
// news, never the page's main action); or what it came to, once settled
function WhatsNext({ quote }: { quote: OfficeQuote }) {
  const notices = noticesFor(quote);
  if (notices.length === 0) return null;
  return <div className="flex flex-col gap-3">{notices}</div>;
}

const noticesFor = (quote: OfficeQuote): ReactNode[] => {
  const shown = shownFor(quote);
  const name = quote.client.name;
  const [firstName] = name.split(" ");
  const offer = quote.offer ? shownOf({ ...quote, draft: null }) : null;
  // the offer can still be accepted: by phone, the Office records it, which
  // needs a card saved, unless it only changes a plan (charging nothing)
  const acceptable =
    offer !== null && quote.status === "sent" && quote.bookable.length > 0;
  const needsCard = acceptable && !offer.changesPlan && !quote.paymentMethod;

  const acceptance = acceptable && (
    <Notice
      key="accept"
      action={
        needsCard ? (
          <EmailCardLink quote={quote} />
        ) : (
          <RecordAcceptance quote={offer} drafting={quote.draft?.number} />
        )
      }
    >
      <p>
        <strong>
          Waiting for {firstName} to accept
          {quote.draft ? ` Revision ${offer.revision}` : ""}, until{" "}
          {formatDateTime(offer.expiresAt!)}.
        </strong>{" "}
        {needsCard
          ? "To record an acceptance by phone, they need a card saved first: we never take card details for them."
          : offer.changesPlan
            ? "If they accept by phone, record it: it changes their plan and charges nothing."
            : `If they accept by phone, record it: the Deposit is charged to their ${quote.paymentMethod!.label}.`}
      </p>
    </Notice>
  );

  // a Revision being written
  if (quote.draft) {
    return [
      <Notice
        key="draft"
        action={
          <ButtonLink variant="text" size="sm" href={draftLink(quote)}>
            <FilePenLine aria-hidden size={16} />
            Continue the Draft
          </ButtonLink>
        }
      >
        <p>
          <strong>
            Revision {quote.draft.number} is a Draft, not sent yet.
          </strong>{" "}
          {quote.offer
            ? `${name} still sees Revision ${quote.offer.number} until you send it.`
            : `Nothing reaches ${name} until you send it.`}
        </p>
      </Notice>,
      acceptance,
    ].filter(Boolean);
  }

  switch (quote.status) {
    case "requested":
    case "draft":
      return toQuote(quote);
    case "sent":
      return acceptable
        ? [acceptance]
        : [
            <Notice key="full" tone="danger">
              <p>
                {offer!.plan && offer!.plan.days.length > 1
                  ? "A day its first cleans are on has"
                  : `${formatDateTime(offer!.proposedStartsAt!)} has`}{" "}
                filled up since this Quote was sent, so {name} can't accept it.
                Draft a new Revision with another time: it replaces this offer.
              </p>
            </Notice>,
          ];
    case "expired":
      return [
        <Notice key="expired">
          <p>
            <strong>Expired {formatDateTime(shown!.expiresAt!)}</strong> without
            a reply. To offer it again, draft a new Revision.
          </p>
        </Notice>,
      ];
    case "declined":
      return [
        <Notice key="declined">
          <p>
            <strong>
              {name} declined it {formatDateTime(quote.declinedAt!)}.
            </strong>{" "}
            To offer something different, draft a new Revision.
          </p>
        </Notice>,
      ];
    case "accepted":
      return [
        <Notice key="accepted" tone="success">
          <p>
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
            .
          </p>
        </Notice>,
      ];
    case "turned_down":
      return [
        <Notice key="turned-down">
          Turned Down {formatDate(quote.turnedDownAt!)}:{" "}
          {turnDownLabel[quote.turnDownReason!].toLowerCase()}. The Client can
          ask for a new Quote.
        </Notice>,
      ];
  }
};

// a Quote asked for, nothing drafted yet: see the premises first if they're
// a business not yet seen (ADR-0014), else draft it
const toQuote = (quote: OfficeQuote): ReactNode[] => {
  const visit = quote.bookedSiteVisit;
  const visitLink = visit && (
    <Link
      href={linkTo({
        to: "/office/site-visits/$visitId",
        params: { visitId: visit.id },
      })}
    >
      {visitSummary(visit)}
    </Link>
  );
  if (quote.needsSiteVisit && !visit) {
    return [<SeeThePremises key="see" quote={quote} />];
  }
  if (quote.needsSiteVisit) {
    return [
      <Notice key="visit">
        <p>
          <strong>Site Visit booked:</strong> {visitLink}. Draft the Quote once
          it's done and its findings are recorded.
        </p>
      </Notice>,
    ];
  }
  return [
    <Notice key="draft" action={<DraftQuote quote={quote} />}>
      <p>
        <strong>
          {quote.client.name} asked for a {quote.asked?.service.name ?? "Quote"}
          .
        </strong>{" "}
        Draft the Quote to send them a price.
        {visit && <> Site Visit booked: {visitLink}.</>}
      </p>
    </Notice>,
    quote.homePlanId && (
      <Notice key="plan">
        <p>
          This home has a{" "}
          <Link
            href={linkTo({
              to: "/office/service-plans/$planId",
              params: { planId: quote.homePlanId },
            })}
          >
            Service Plan
          </Link>
          . A Service Plan Quote changes its terms once the Client accepts it.
        </p>
      </Notice>
    ),
  ].filter(Boolean);
};

// throws the Draft away, once Office Staff are sure: see discardDraft
function DeleteDraft({ quote }: { quote: OfficeQuote }) {
  const navigate = useNavigate();
  const action = useActionWith(
    () => Promise.resolve(),
    "The Draft wasn't deleted. Please try again.",
  );
  const gone = !quote.offer && !quote.asked;
  const remove = async (close: () => void) => {
    const ok = await action.run(
      () => deleteJson(`/api/quotes/${quote.id}/draft`),
      "Draft deleted",
    );
    if (!ok) return;
    close();
    await (gone
      ? navigate({
          to: "/office/properties/$propertyId",
          params: { propertyId: quote.property.id },
        })
      : navigate({
          to: "/office/quotes/$quoteId",
          params: { quoteId: quote.id },
        }));
  };
  return (
    <DialogTrigger>
      <Button variant="danger-text" size="sm">
        <Trash2 aria-hidden size={16} />
        Delete the Draft
      </Button>
      <Dialog title="Delete the Draft?" role="alertdialog">
        {({ close }) => (
          <>
            <p>
              {quote.offer
                ? `Revision ${quote.draft!.number}'s changes are lost. ${quote.client.name} keeps Revision ${quote.offer.number}, as sent.`
                : gone
                  ? "Nothing was asked or sent, so the Quote goes with it."
                  : `The Quote goes back to Requested, to be drafted afresh.`}
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() => void remove(close)}
              >
                Delete the Draft
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

/**
 * Building a Revision, on a page of its own: the editor, its prices worked
 * out afresh from the Price List as it's changed, and what was asked beside
 * it. Sending it returns to the Quote. With no Draft, it's the Quote's page.
 */
export function QuoteDraftScreen() {
  const quote = useLoaderData({ from: "/office/quotes/$quoteId/draft" });
  const draft = quote.draft!;
  const kind = kindOf(quote);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Quotes", href: linkTo({ to: "/office/quotes" }) },
            ...homeCrumbs(quote.client, quote.property),
            {
              label: kind,
              href: linkTo({
                to: "/office/quotes/$quoteId",
                params: { quoteId: quote.id },
              }),
            },
            { label: `Revision ${draft.number}` },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>
            Revision {draft.number} for {clientName(quote.client)}
          </Heading>
          <StatusBadge tone="neutral">Not sent yet</StatusBadge>
          <div className="ml-auto">
            <DeleteDraft quote={quote} />
          </div>
        </div>
        <PropertyLine quote={quote} />
      </div>
      {quote.offer && (
        <Notice>
          {quote.client.name} still sees Revision {quote.offer.number} until you
          send this one.
        </Notice>
      )}
      {quote.changesPlan && (
        <PlanChangeNotice quote={shownOf(quote)} change={quote.changesPlan} />
      )}
      {quote.asked && <WhatWasAsked quote={quote} open />}
      {quote.firstClean && <FirstCleanNote firstClean={quote.firstClean} />}
      {/* a save gives fresh prices; the form keeps what's typed */}
      <DraftEditor key={draft.id} quote={shownOf(quote)} />
    </div>
  );
}

type Moment = {
  key: string;
  at: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  details?: ReactNode;
};

// each thing that happened to the Quote, newest first
const momentsOf = (quote: OfficeQuote): Moment[] => {
  const shown = shownFor(quote);
  const visit = quote.bookedSiteVisit;
  const moments: Moment[] = [];
  if (quote.asked) {
    moments.push({
      key: "asked",
      at: quote.createdAt,
      icon: MessageSquareText,
      title:
        quote.origin === "caller"
          ? `${quote.client.name} asked by phone`
          : `${quote.client.name} asked for a Quote`,
      description: quote.asked.service.name,
      details: <WhatWasAsked quote={quote} />,
    });
  }
  if (visit?.doneAt) {
    moments.push({
      key: "visit",
      at: visit.doneAt,
      icon: CalendarCheck,
      title: "Site Visit done",
      description: visit.visitor ? `By ${visit.visitor.name}` : undefined,
    });
  }
  // oldest first, as they happened (quote.revisions is newest first)
  for (const revision of [...quote.revisions].reverse()) {
    moments.push({
      key: revision.id,
      at: revision.sentAt,
      icon: Send,
      title: `Revision ${revision.number} sent`,
      description: `${formatMoney(revision.headlineTotalCents)} · for ${formatDateTime(revision.proposedStartsAt)}`,
    });
  }
  if (quote.status === "expired" && shown?.expiresAt) {
    moments.push({
      key: "expired",
      at: shown.expiresAt,
      icon: Hourglass,
      title: "Expired",
    });
  }
  if (quote.declinedAt) {
    moments.push({
      key: "declined",
      at: quote.declinedAt,
      icon: CircleSlash,
      title: `${quote.client.name} declined it`,
    });
  }
  if (quote.acceptedAt) {
    moments.push({
      key: "accepted",
      at: quote.acceptedAt,
      icon: CircleCheck,
      title: `${quote.client.name} accepted it`,
    });
  }
  if (quote.turnedDownAt) {
    moments.push({
      key: "turned-down",
      at: quote.turnedDownAt,
      icon: CircleSlash,
      title: "Turned Down",
      description: turnDownLabel[quote.turnDownReason!],
    });
  }
  // added in the order they happen, which breaks ties (asked and sent in
  // the same minute)
  return moments
    .map((moment, order) => ({ moment, order }))
    .sort(
      (a, b) =>
        Date.parse(b.moment.at) - Date.parse(a.moment.at) || b.order - a.order,
    )
    .map(({ moment }) => moment);
};

// what the Client (or a caller) asked for: open while the Quote's being
// written from it, else folded away, the Quote saying what's offered
function WhatWasAsked({
  quote,
  open = unsent(quote),
}: {
  quote: OfficeQuote;
  open?: boolean;
}) {
  return (
    <details className="group" open={open}>
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        What was asked
      </summary>
      <Card className="mt-2">
        <AskedFacts quote={quote} />
      </Card>
    </details>
  );
}

// nothing of it Sent yet, so it may still be Turned Down
const unsent = (quote: OfficeQuote) =>
  quote.status === "requested" || quote.status === "draft";

// what accepting a Quote for a home with a plan does to that plan
function PlanChangeNotice({
  quote,
  change,
}: {
  quote: ShownQuote;
  change: PlanChange;
}) {
  const from = quote.proposedStartsAt
    ? formatDateTime(quote.proposedStartsAt)
    : "its start";
  return (
    <Notice>
      <p>
        <strong>This changes {quote.client.name}'s </strong>
        <Link
          href={linkTo({
            to: "/office/service-plans/$planId",
            params: { planId: change.servicePlanId },
          })}
        >
          Service Plan
        </Link>
        <strong> from {from}.</strong> Its Jobs before then go ahead as they
        are.
      </p>
      {change.replaces.length > 0 && (
        <p>
          Its booked Jobs from then on are cancelled, free:{" "}
          {change.replaces.map((at) => formatDateTime(at)).join("; ")}.
        </p>
      )}
      <p>
        The plan's {formatMoney(change.depositCents)} Deposit carries over, so
        accepting charges nothing.
      </p>
    </Notice>
  );
}

// The offer, read-only, as one card: its terms, each Service's price (or
// each weekday's, on a plan) and the Deposit. A Sent Revision never changes
function Offer({ quote, actions }: { quote: ShownQuote; actions?: ReactNode }) {
  const { plan } = quote;
  return (
    <Section
      title="Current Quote"
      description={`Revision ${quote.revision}, sent ${formatDateTime(quote.sentAt!)} to ${quote.client.email}`}
      actions={actions}
    >
      <Card>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">
            {quote.changesPlan || quote.changedPlan
              ? "New terms start"
              : plan
                ? "Starts"
                : "Proposed time"}
          </dt>
          <dd>{formatDateTime(quote.proposedStartsAt!)}</dd>
          {plan && (
            <>
              <dt className="font-semibold">Then</dt>
              <dd>
                {planRhythm(plan)}, priced for{" "}
                {conditionLabel[plan.condition].toLowerCase()} Condition
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
              <>
                <AddOnList addOns={quote.addOns} />
                {plan && (
                  <span className="text-sm text-fg-muted">
                    On every clean, before the Plan Discount.
                  </span>
                )}
              </>
            )}
          </dd>
        </dl>
        <div className="grid gap-6 border-t border-border pt-4 lg:grid-cols-2">
          {quote.options.map((option, i) => {
            const day = plan?.days[i];
            return (
              <OfferPrice
                key={day?.startsAt ?? option.serviceKey}
                title={day ? planDayTitle(day) : option.serviceName}
                badge={
                  day ? (
                    <PlanSaving day={day} />
                  ) : (
                    option.recommended && (
                      <StatusBadge tone="success">Recommended</StatusBadge>
                    )
                  )
                }
              >
                {day ? (
                  <PlanFigures
                    option={option}
                    day={day}
                    discountPercent={plan!.discountPercent}
                  />
                ) : (
                  <OptionFigures
                    option={option}
                    crewSize={quote.crewSize}
                    depositPercent={quote.depositPercent}
                  />
                )}
                <PricedFrom option={option} />
              </OfferPrice>
            );
          })}
        </div>
        {plan && (
          <div className="border-t border-border pt-4">
            <PlanTotals
              plan={plan}
              depositPercent={quote.depositPercent}
              change={quote.changesPlan}
            />
          </div>
        )}
        <p className="border-t border-border pt-4 text-sm text-fg-muted">
          Priced from Price List version {quote.priceListVersion}. A Sent
          Revision never changes: to offer something different, draft a new one.
        </p>
      </Card>
    </Section>
  );
}

// one part of the Revision being written, ruled off from the one before
function DraftPart({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0"
    >
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Heading level={2} size={3} id={headingId}>
            {title}
          </Heading>
          {description && (
            <p className="text-sm text-fg-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

// prices being worked out again after a change fade until they're back
const staleStyle = (stale: boolean) =>
  `transition-opacity ${stale ? "opacity-60" : ""}`;

// one Service's price (or a plan weekday's) in the Current Quote
function OfferPrice({
  title,
  badge,
  headingLevel = 3,
  children,
}: {
  title: string;
  badge?: ReactNode;
  headingLevel?: 3 | 4;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Heading
          level={headingLevel}
          size={headingLevel === 4 ? 4 : 3}
          id={headingId}
        >
          {title}
        </Heading>
        {badge}
      </div>
      {children}
    </section>
  );
}

// starts a new Revision of a Sent or Expired Quote, from the offer's terms,
// and opens it; primary only when it's the one thing to do
function NewRevision({ quote }: { quote: OfficeQuote }) {
  const navigate = useNavigate();
  const action = useActionWith(
    () => Promise.resolve(),
    "The new Revision couldn't be started. Please try again.",
  );
  return (
    <>
      <Button
        variant="text"
        size="sm"
        isPending={action.isPending}
        onPress={async () => {
          const ok = await action.run(() =>
            postJson<OfficeQuote>(`/api/quotes/${quote.id}/revisions`, {}),
          );
          if (ok) {
            await navigate({
              to: "/office/quotes/$quoteId/draft",
              params: { quoteId: quote.id },
            });
          }
        }}
      >
        <FilePlus aria-hidden size={16} />
        Draft a new Revision
      </Button>
      {action.problem && <ActionProblem>{action.problem}</ActionProblem>}
    </>
  );
}

// why a button in a box didn't work, under its buttons
function ActionProblem({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="basis-full text-sm text-danger-strong">
      {children}
    </p>
  );
}

// Office Staff never take card details: the Client adds a card from a link
// emailed to them, before an acceptance by phone can be recorded
function EmailCardLink({ quote }: { quote: OfficeQuote }) {
  const action = useAction("The link wasn't sent. Please try again.");
  const [firstName] = quote.client.name.split(" ");
  return (
    <>
      <Button
        variant="text"
        size="sm"
        isPending={action.isPending}
        onPress={() =>
          void action.run(
            () =>
              postJson("/api/payment-methods/requests", {
                clientId: quote.client.id,
              }),
            `Link sent to ${quote.client.email}`,
          )
        }
      >
        <Mail aria-hidden size={16} />
        Email {firstName} a link to add a card
      </Button>
      {action.problem && <ActionProblem>{action.problem}</ActionProblem>}
    </>
  );
}

// The Client said yes another way, e.g. by phone: the Office records it,
// charging the Deposit to the card the Client saved (a plan change charges
// nothing). The dialog asks which Service they chose and confirms. While a
// new Revision is `drafting`, it's the offer standing that's accepted, and
// accepting it discards the Draft.
function RecordAcceptance({
  quote,
  drafting,
}: {
  quote: ShownQuote;
  drafting?: number;
}) {
  // the recommended Service, unless only the other still fits
  const [serviceKey, setServiceKey] = useState(
    quote.options.find((o) => quote.bookable.includes(o.serviceKey))!
      .serviceKey,
  );
  const action = useAction("That didn't work. Please try again.");
  const chosen = quote.options.find((o) => o.serviceKey === serviceKey)!;
  const depositCents = quote.plan?.depositCents ?? chosen.depositCents;
  // without a card only a plan change, which charges nothing, can go ahead
  if (!quote.changesPlan && !quote.paymentMethod) return null;

  const accept = async (close: () => void) => {
    const ok = await action.run(
      // a plan is accepted whole
      () =>
        postJson<OfficeQuote>(
          `/api/quotes/${quote.id}/accept`,
          quote.plan ? {} : { serviceKey },
        ),
      quote.changesPlan
        ? "Accepted: the Service Plan has changed"
        : quote.plan
          ? "Accepted: the Service Plan has started"
          : "Accepted and booked",
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <CircleCheck aria-hidden size={16} />
        Record acceptance
      </Button>
      <Dialog title="Record acceptance?" role="alertdialog">
        {({ close }) => (
          <>
            {!quote.plan && !quote.changesPlan && (
              <RadioGroup
                label="Service they chose"
                value={serviceKey}
                onChange={setServiceKey}
              >
                {quote.options.map((option) => (
                  <Radio
                    key={option.serviceKey}
                    value={option.serviceKey}
                    isDisabled={!quote.bookable.includes(option.serviceKey)}
                    description={
                      quote.bookable.includes(option.serviceKey)
                        ? `${formatMoney(option.totalCents)}, Deposit ${formatMoney(option.depositCents)}`
                        : "No longer fits: its time has filled up"
                    }
                  >
                    {option.serviceName}
                  </Radio>
                ))}
              </RadioGroup>
            )}
            <p>
              {quote.changesPlan
                ? `This changes ${quote.client.name}'s Service Plan to ${planName(quote.plan!)} from ${formatDateTime(quote.proposedStartsAt!)}, cancelling its booked Jobs from then on. Nothing is charged.`
                : quote.plan
                  ? `This charges the ${formatMoney(depositCents)} Deposit to ${quote.client.name}'s ${quote.paymentMethod!.label}, held for the life of the plan, and starts their Service Plan, ${planName(quote.plan)}, with its first clean on ${formatDateTime(quote.proposedStartsAt!)}.`
                  : `This charges the ${formatMoney(chosen.depositCents)} Deposit to ${quote.client.name}'s ${quote.paymentMethod!.label} and books their ${chosen.serviceName} for ${formatDateTime(quote.proposedStartsAt!)}.`}{" "}
              {drafting
                ? `It accepts Revision ${quote.revision}, as sent, and deletes your Draft of Revision ${drafting}.`
                : ""}{" "}
              Only do this if they've told you they accept.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Cancel
              </Button>
              <Button
                isPending={action.isPending}
                onPress={() => void accept(close)}
              >
                {quote.changesPlan ? "Change the plan" : "Charge and book"}
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// the Suggested Price, and the override that replaced it
function PricedFrom({ option }: { option: OfficeQuoteOption }) {
  if (option.overrideCents === null) {
    return (
      <p className="text-sm text-fg-muted">
        The Suggested Price, {formatMoney(option.suggested.priceCents)} before
        tax.
      </p>
    );
  }
  return (
    <p className="text-sm text-fg-muted">
      <strong className="text-fg">
        Overridden to {formatMoney(option.overrideCents)} before tax
      </strong>{" "}
      from the Suggested {formatMoney(option.suggested.priceCents)}:{" "}
      {option.overrideReason}
    </p>
  );
}

// what's on screen: money in dollars, the time as the pickers hold it
type Override = { on: boolean; price: number; reason: string };

// one of a Service Plan Draft's weekdays, as the pickers hold it; `key` is
// the screen's own, to tell the weekdays apart as they're added and removed
type DayFields = {
  key: number;
  date: CalendarDate | null;
  time: Time | null;
  crewSize: number;
  override: Override;
};

type PlanFields = Omit<ServicePlanInput, "days"> & { days: DayFields[] };

type Fields = {
  // a one-off Quote's Service
  serviceKey: string;
  // for a Service priced by area; null follows the Property's (or the
  // Client's rough one)
  area: number | null;
  addOns: string[];
  crewSize: number;
  depositPercent: number;
  validityDays: number;
  date: CalendarDate | null;
  time: Time | null;
  // by the option's Service
  overrides: Record<string, Override>;
  // a Service Plan Quote's terms, and its weekdays, each with its own time,
  // crew and override
  plan: PlanFields | null;
};

let lastKey = 0;
const nextKey = () => (lastKey += 1);

const overrideOf = (option: OfficeQuoteOption | undefined): Override => ({
  on: option?.overrideCents != null,
  price: (option?.overrideCents ?? option?.suggested.priceCents ?? 0) / 100,
  reason: option?.overrideReason ?? "",
});

const toFields = (quote: ShownQuote): Fields => {
  return {
    serviceKey: quote.serviceKey,
    area: quote.area,
    addOns: quote.addOns.map((a) => a.key),
    crewSize: quote.crewSize,
    depositPercent: quote.depositPercent,
    validityDays: quote.validityDays,
    plan: quote.plan && {
      serviceKey: quote.serviceKey,
      recurrence: quote.plan.recurrence,
      discountPercent: quote.plan.discountPercent,
      condition: quote.plan.condition,
      days: quote.plan.days.map((day, i) => ({
        key: nextKey(),
        date: day.startsAt ? parseDate(dayOfInstant(day.startsAt)) : null,
        time: day.startsAt ? parseTime(timeOfDay(day.startsAt)) : null,
        crewSize: day.crewSize,
        override: overrideOf(quote.options[i]),
      })),
    },
    date: quote.proposedStart && parseDate(quote.proposedStart.date),
    time: quote.proposedStart && parseTime(quote.proposedStart.time),
    overrides: Object.fromEntries(
      quote.plan ? [] : quote.options.map((o) => [o.serviceKey, overrideOf(o)]),
    ),
  };
};

const startOf = (date: CalendarDate | null, time: Time | null) =>
  date && time
    ? { date: date.toString(), time: time.toString().slice(0, 5) }
    : null;

const priced = ({ on, price, reason }: Override) =>
  on ? { priceCents: Math.round(price * 100), reason } : null;

const toInput = (fields: Fields): QuoteDraftInput => {
  const terms = {
    area: fields.area,
    addOns: fields.addOns,
    depositPercent: fields.depositPercent,
    validityDays: fields.validityDays,
  };
  // a Service Plan Quote's time, crew and override are each weekday's
  if (fields.plan) {
    const { days, ...plan } = fields.plan;
    return {
      ...terms,
      plan: {
        ...plan,
        days: days.map((day) => ({
          start: startOf(day.date, day.time),
          crewSize: day.crewSize,
          override: priced(day.override),
        })),
      },
    };
  }
  return {
    ...terms,
    serviceKey: fields.serviceKey,
    crewSize: fields.crewSize,
    proposedStart: startOf(fields.date, fields.time),
    overrides: Object.fromEntries(
      Object.entries(fields.overrides).map(([key, o]) => [key, priced(o)]),
    ),
  };
};

const dollars = { style: "currency", currency: "USD" } as const;

// Whether the proposed day has room for each Service, from its free
// Cleaner hours now and the Labour Hours as last saved, and whether a crew
// is free at the proposed time (#62). A warning, not a rule: the Office may
// be about to add hours or a Cleaner. A Quote sent for a full day or time
// can't be accepted, and goes straight under Needs attention.
function RoomOnDay({
  day,
  time,
  crewSize,
  options,
}: {
  day: string;
  time?: string;
  crewSize: number;
  options: OfficeQuoteOption[];
}) {
  const [found, setFound] = useState<ScheduleDay>();

  useEffect(() => {
    let current = true;
    getJson<ScheduleDay[]>(`/api/schedule?from=${day}&to=${day}`)
      .then(([found]) => current && setFound(found))
      // nothing to say if it can't be found out
      .catch(() => current && setFound(undefined));
    return () => {
      current = false;
    };
  }, [day]);

  if (found?.date !== day) return null;
  const free = { day, hours: found.freeHours };
  // in hundredths, as the server compares them
  const fits = (option: OfficeQuoteOption) =>
    Math.round(free.hours * 100) >= Math.round(option.labourHours * 100);
  const crew = (option: OfficeQuoteOption) =>
    time ? crewAt(found, time, option.hoursOnSite, { crewSize }) : undefined;
  // those with the hours but no crew free then
  const crewless = options.filter((o) => fits(o) && crew(o)?.hasCrew === false);
  const crewNotice = crewless.length > 0 && time && (
    <Notice tone="danger">
      {noCrewAt(time, crewSize, crew(crewless[0]!)!)}{" "}
      {crewless.length === options.length
        ? `The Client couldn't accept this Quote: choose another time, or give a Cleaner hours that day.`
        : `The Client couldn't choose ${crewless.map(describeOption).join(" or ")}.`}
    </Notice>
  );
  const fitting = options.filter(fits);
  const missing = options.filter((o) => !fits(o));
  const describe = describeOption;
  const opening = `${formatDay(day)} has ${formatHours(Math.max(free.hours, 0))} of Cleaner time free`;

  if (missing.length === 0) {
    return (
      <>
        <p className="text-sm text-fg-muted">
          {opening}: room for {options.length === 1 ? "it" : "either clean"}.
        </p>
        {crewNotice}
      </>
    );
  }
  return (
    <>
      <Notice tone="danger">
        {fitting.length > 0
          ? `${opening}: room for ${fitting.map(describe).join(" and ")}, but not ${missing.map(describe).join(" or ")}. The Client will only be able to choose ${fitting.length === 1 ? "that one" : "those"}.`
          : `${opening}, not enough for ${missing.map(describe).join(" or ")}. The Client couldn't accept this Quote: choose another day, or give a Cleaner more hours that day.`}
      </Notice>
      {crewNotice}
    </>
  );
}

const describeOption = (o: OfficeQuoteOption) =>
  `the ${o.serviceName} (${formatHours(o.labourHours)})`;

// why a crew can't be had at a time
const noCrewAt = (
  time: string,
  crewSize: number,
  { busy, cleaners }: { busy: number; cleaners: number },
) => {
  const free = Math.max(cleaners - busy, 0);
  return `Not enough Cleaners are free at ${formatClock(time)}: a crew of ${crewSize} is needed, and ${free} of the ${cleaners} available that day ${free === 1 ? "is" : "are"}.`;
};

// A Service Plan Quote's own terms: how often, the Plan Discount, and the
// Condition it's priced for, which is moderate unless changed here (the
// home's own Condition is left as it is). Each weekday's Service is chosen
// from its price cards. A plan on several weekdays comes round every week.
function PlanTerms({
  plan,
  services,
  onChange,
}: {
  plan: PlanFields;
  // those it can be for
  services: ServiceChoice[];
  onChange: (change: Partial<Omit<ServicePlanInput, "days">>) => void;
}) {
  const several = plan.days.length > 1;
  return (
    <>
      <Select
        label="Service"
        name="plan.serviceKey"
        className="sm:max-w-xs"
        description="Every clean on the plan is of it."
        selectedKey={plan.serviceKey}
        onSelectionChange={(key) => onChange({ serviceKey: String(key) })}
      >
        {services.map((s) => (
          <SelectItem key={s.key} id={s.key}>
            {s.name}
          </SelectItem>
        ))}
      </Select>
      <RadioGroup
        label="How often"
        name="plan.recurrence"
        description={
          several
            ? "A plan on several weekdays comes round every week."
            : undefined
        }
        value={plan.recurrence}
        onChange={(value) => onChange({ recurrence: value as Recurrence })}
      >
        {(["weekly", "fortnightly", "four_weekly"] as const).map((r) => (
          <Radio key={r} value={r} isDisabled={several && r !== "weekly"}>
            {recurrenceLabel[r]}
          </Radio>
        ))}
      </RadioGroup>
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
        <NumberField
          label="Plan Discount (%)"
          name="plan.discountPercent"
          minValue={0}
          maxValue={100}
          value={plan.discountPercent}
          onChange={(discountPercent) => onChange({ discountPercent })}
        />
        <Select
          label="Priced for Condition"
          selectedKey={plan.condition}
          onSelectionChange={(key) => onChange({ condition: key as Condition })}
        >
          {(["light", "moderate", "heavy"] as const).map((c) => (
            <SelectItem key={c} id={c}>
              {conditionLabel[c]}
            </SelectItem>
          ))}
        </Select>
      </div>
    </>
  );
}

// the Suggested Price, and the way to replace it with a price and a reason
function OverrideFields({
  option,
  override,
  label,
  name,
  onChange,
}: {
  option: OfficeQuoteOption;
  override: Override;
  // what the price is called: "Deep Clean", or a plan's "one-off"
  label: string;
  // where its fields' errors are reported: "overrides.deep", or a plan's
  // "plan.days.0.override"
  name: string;
  onChange: (change: Partial<Override>) => void;
}) {
  return (
    <>
      <details className="text-sm">
        <summary className="cursor-pointer text-fg-muted">
          Suggested Price {formatMoney(option.suggested.priceCents)} before tax,
          for {option.suggested.labourHours} Labour Hours.{" "}
          <span className="font-semibold text-primary">
            How it's worked out
          </span>
        </summary>
        <div className="pt-2">
          <PriceWorking breakdown={option.suggested} />
        </div>
      </details>
      <Checkbox isSelected={override.on} onChange={(on) => onChange({ on })}>
        Override the {label} price
      </Checkbox>
      {override.on && (
        <div className="flex flex-col gap-4">
          <NumberField
            label={`${label === "one-off" ? "One-off" : label} price before tax`}
            name={`${name}.priceCents`}
            minValue={0}
            formatOptions={dollars}
            value={override.price}
            onChange={(price) => onChange({ price })}
          />
          <TextField
            label="Reason for the override"
            name={`${name}.reason`}
            value={override.reason}
            onChange={(reason) => onChange({ reason })}
          />
        </div>
      )}
    </>
  );
}

// where the Draft stands against what's on screen
type SaveState =
  | "saved"
  // changed, and about to be saved
  | "changed"
  | "saving"
  // an override without its reason yet: nothing to save until it has one
  | "incomplete"
  // the API refused it: see the fields marked
  | "invalid"
  | "failed";

const saveStateLabel: Record<SaveState, string> = {
  saved: "All changes saved",
  changed: "Updating prices…",
  saving: "Updating prices…",
  incomplete: "Give a reason for the override to update the prices",
  invalid: "Fix the fields marked to update the prices",
  failed: "Changes couldn't be saved. They'll be tried again as you edit.",
};

// how long after the last change the Draft is saved and priced again
const SAVE_DELAY_MS = 500;

// the prices as last worked out, in a line: what the bar at the bottom shows
const priceSummary = (quote: ShownQuote) => {
  const { plan } = quote;
  if (plan) {
    return plan.days.length === 1
      ? `${planName(plan)}: ${formatMoney(quote.options[0]!.totalCents)} a clean`
      : `${plan.days.length} cleans a week: ${formatMoney(plan.roundTotalCents)} a week`;
  }
  return quote.options
    .map((o) => `${o.serviceName} ${formatMoney(o.totalCents)}`)
    .join(" · ");
};

const sqFt = new Intl.NumberFormat("en-US");

// The area a Service priced by area is priced on: typed, or left empty to
// follow the Property's floor area, else the Client's rough one (ADR-0018)
function AreaField({
  area,
  from,
  onChange,
}: {
  area: number | null;
  from: OfficeQuote["areaFrom"];
  onChange: (area: number | null) => void;
}) {
  const following = !from
    ? "None recorded yet: enter one to price it."
    : from.source === "property"
      ? `Leave empty to use the floor area, ${sqFt.format(from.sqFt)} sq ft.`
      : `Leave empty to use the Client's rough figure, ${sqFt.format(from.sqFt)} sq ft.`;
  return (
    <NumberField
      label="Area in sq ft"
      name="area"
      className="sm:max-w-xs"
      minValue={1}
      maxValue={1_000_000}
      value={area ?? Number.NaN}
      onChange={(value) => onChange(Number.isNaN(value) ? null : value)}
      description={area === null ? following : undefined}
    />
  );
}

/**
 * A Draft, saved and priced again by the server a moment after each change,
 * so the prices always follow what's on screen; a bar at the bottom keeps
 * them in view wherever the change was made. On a Service Plan Quote, the
 * plan's Service is chosen from its price cards.
 */
function DraftEditor({ quote: loaded }: { quote: ShownQuote }) {
  const navigate = useNavigate();
  const [quote, setQuote] = useState(loaded);
  const [fields, setFields] = useState(() => toFields(loaded));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [isSending, setSending] = useState(false);

  // every change counts up; a save records the change it saved, so a save
  // started before a later change doesn't count as saving it
  const latest = useRef(fields);
  const edits = useRef(0);
  const saved = useRef({ edit: 0, ok: true });
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));

  // a change worked out from what's on screen as it is then, so two changes
  // in a row (a field committed on blur, then the click that blurred it)
  // both count
  const update = (change: (current: Fields) => Partial<Fields>) => {
    edits.current += 1;
    setFields((current) => {
      latest.current = { ...current, ...change(current) };
      return latest.current;
    });
    setSaveState("changed");
  };
  const set = (change: Partial<Fields>) => update(() => change);
  // an option new since the Service changed has none yet
  const overrideFor = (option: OfficeQuoteOption) =>
    fields.overrides[option.serviceKey] ?? overrideOf(option);
  const setOverride = (option: OfficeQuoteOption, change: Partial<Override>) =>
    update(({ overrides }) => ({
      overrides: {
        ...overrides,
        [option.serviceKey]: {
          ...(overrides[option.serviceKey] ?? overrideOf(option)),
          ...change,
        },
      },
    }));
  const setPlan = (change: (plan: PlanFields) => Partial<PlanFields>) =>
    update(({ plan }) => ({ plan: { ...plan!, ...change(plan!) } }));

  // a Service Plan's weekdays: one changed, added or removed
  const setDays = (change: (days: DayFields[]) => DayFields[]) =>
    setPlan(({ days }) => {
      const changed = change(days);
      // several come round every week
      return changed.length > 1
        ? { days: changed, recurrence: "weekly" }
        : { days: changed };
    });
  const setDay = (key: number, change: Partial<DayFields>) =>
    setDays((days) =>
      days.map((d) => (d.key === key ? { ...d, ...change } : d)),
    );

  const missingReason = (f: Fields) =>
    f.plan
      ? f.plan.days.some((d) => d.override.on && !d.override.reason.trim())
      : Object.values(f.overrides).some((o) => o.on && !o.reason.trim());

  // saves what's on screen, one save at a time; says whether it's all saved
  const saveNow = (): Promise<boolean> => {
    queue.current = queue.current.then(async () => {
      const edit = edits.current;
      if (edit === saved.current.edit) return saved.current.ok;
      setSaveState("saving");
      try {
        setQuote(
          shownOf(
            await patchJson<OfficeQuote>(
              `/api/quotes/${quote.id}/draft`,
              toInput(latest.current),
            ),
          ),
        );
        setFieldErrors({});
        setFailure(undefined);
        saved.current = { edit, ok: true };
      } catch (e) {
        const invalid =
          e instanceof ApiError && Object.keys(e.fieldErrors).length > 0;
        if (invalid) setFieldErrors(e.fieldErrors);
        saved.current = { edit, ok: false };
        if (edit === edits.current)
          setSaveState(invalid ? "invalid" : "failed");
        return false;
      }
      if (edit === edits.current) setSaveState("saved");
      return true;
    });
    return queue.current;
  };

  useEffect(() => {
    if (edits.current === saved.current.edit) return;
    if (missingReason(fields)) {
      setSaveState("incomplete");
      return;
    }
    const timer = setTimeout(() => void saveNow(), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // saveNow reads the latest fields itself
  }, [fields]);

  // what's on screen is what's sent: save it, then send it
  const onSend = async () => {
    setSending(true);
    setFailure(undefined);
    try {
      if (!(await saveNow())) return;
      await postJson<OfficeQuote>(`/api/quotes/${quote.id}/send`);
      showToast({
        tone: "success",
        title: `Quote sent to ${quote.client.email}`,
      });
      await navigate({
        to: "/office/quotes/$quoteId",
        params: { quoteId: quote.id },
      });
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
      } else {
        setFailure(
          e instanceof ApiError && e.status === 409
            ? e.message
            : "That didn't work. Please try again.",
        );
      }
    } finally {
      setSending(false);
    }
  };

  const stale = saveState === "changed" || saveState === "saving";
  const plan = fields.plan;
  const areaPriced =
    quote.serviceChoices.find(
      (s) => s.key === (plan?.serviceKey ?? fields.serviceKey),
    )?.method === "area";

  return (
    <Form
      validationErrors={fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void saveNow();
      }}
    >
      {failure && <Notice tone="danger">{failure}</Notice>}

      <Card>
        {plan ? (
          <>
            <DraftPart
              title="Plan"
              actions={
                <Button
                  variant="text"
                  size="sm"
                  isDisabled={plan.days.length >= 7}
                  onPress={() => setDays((days) => [...days, anotherDay(days)])}
                >
                  <CalendarPlus aria-hidden size={16} />
                  Add a weekday
                </Button>
              }
            >
              <PlanTerms
                plan={plan}
                services={quote.serviceChoices}
                onChange={(change) => setPlan(() => change)}
              />
            </DraftPart>
            {plan.days.map((day, i) => (
              <PlanDayFields
                key={day.key}
                index={i}
                day={day}
                plan={plan}
                stale={stale}
                // as last saved, at the same place
                option={quote.options[i]}
                terms={quote.plan?.days[i]}
                onChange={(change) => setDay(day.key, change)}
                onRemove={
                  plan.days.length > 1
                    ? () =>
                        setDays((days) => days.filter((d) => d.key !== day.key))
                    : undefined
                }
              />
            ))}
            <DraftPart title={plan.days.length > 1 ? "Each week" : "Deposit"}>
              {quote.plan && (
                <div className={staleStyle(stale)} aria-busy={stale}>
                  <PlanTotals
                    plan={quote.plan}
                    depositPercent={quote.depositPercent}
                    change={quote.changesPlan}
                  />
                </div>
              )}
            </DraftPart>
          </>
        ) : (
          <DraftPart title="Service and prices">
            <Select
              label="Service"
              name="serviceKey"
              className="sm:max-w-xs"
              description={
                quote.options.length > 1
                  ? `With a ${quote.options[0]!.serviceName} recommended for a first visit`
                  : undefined
              }
              selectedKey={fields.serviceKey}
              onSelectionChange={(key) => set({ serviceKey: String(key) })}
            >
              {quote.serviceChoices.map((s) => (
                <SelectItem key={s.key} id={s.key}>
                  {s.name}
                </SelectItem>
              ))}
            </Select>
            {areaPriced && (
              <AreaField
                area={fields.area}
                from={quote.areaFrom}
                onChange={(area) => set({ area })}
              />
            )}
            <div
              aria-busy={stale}
              className={`grid gap-6 lg:grid-cols-2 ${staleStyle(stale)}`}
            >
              {quote.options.map((option) => (
                <OfferPrice
                  key={option.serviceKey}
                  title={option.serviceName}
                  headingLevel={3}
                  badge={
                    option.recommended && (
                      <StatusBadge tone="success">Recommended</StatusBadge>
                    )
                  }
                >
                  <OptionFigures
                    option={option}
                    crewSize={quote.crewSize}
                    depositPercent={quote.depositPercent}
                  />
                  <OverrideFields
                    option={option}
                    override={overrideFor(option)}
                    label={option.serviceName}
                    name={`overrides.${option.serviceKey}`}
                    onChange={(change) => setOverride(option, change)}
                  />
                </OfferPrice>
              ))}
            </div>
            <p className="text-sm text-fg-muted">
              Prices are worked out again from the current Price List (version{" "}
              {quote.priceListVersion}) and the home's details as you make
              changes. Sending fixes them.
            </p>
          </DraftPart>
        )}
        {plan && areaPriced && (
          <DraftPart title="Area">
            <AreaField
              area={fields.area}
              from={quote.areaFrom}
              onChange={(area) => set({ area })}
            />
          </DraftPart>
        )}

        <DraftPart
          title="Add-ons"
          description={
            quote.plan
              ? "Done on every clean. Each adds its hours to the price, and the Plan Discount comes off it too."
              : "Each adds its hours to both prices."
          }
        >
          <div className="flex flex-col">
            {quote.addOnChoices.map((addOn) => (
              <Checkbox
                key={addOn.key}
                isSelected={fields.addOns.includes(addOn.key)}
                onChange={(on) =>
                  set({
                    addOns: on
                      ? [...fields.addOns, addOn.key]
                      : fields.addOns.filter((key) => key !== addOn.key),
                  })
                }
              >
                {addOn.name}
              </Checkbox>
            ))}
          </div>
        </DraftPart>

        <DraftPart title="Terms">
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
            {/* each of a plan's weekdays has its own */}
            {!plan && (
              <NumberField
                label="Crew Size"
                name="crewSize"
                minValue={1}
                maxValue={10}
                value={fields.crewSize}
                onChange={(crewSize) => set({ crewSize })}
              />
            )}
            <NumberField
              label="Deposit (%)"
              name="depositPercent"
              minValue={0}
              maxValue={100}
              value={fields.depositPercent}
              onChange={(depositPercent) => set({ depositPercent })}
            />
            <NumberField
              label="Valid for (days)"
              name="validityDays"
              minValue={1}
              maxValue={90}
              value={fields.validityDays}
              onChange={(validityDays) => set({ validityDays })}
            />
          </div>
        </DraftPart>

        {/* a plan's weekdays each have their own, above */}
        {!plan && (
          <DraftPart
            title="Proposed time"
            description="New York time. The Quote Expires at this time if it isn't accepted first."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker
                label="Date"
                name="proposedStart"
                value={fields.date}
                onChange={(date) => set({ date })}
              />
              <TimeField
                label="Start time"
                value={fields.time}
                onChange={(time) => set({ time })}
              />
            </div>
            <PickFromSchedule
              date={fields.date?.toString()}
              time={fields.time?.toString().slice(0, 5)}
              hoursOnSite={Math.max(
                0,
                ...quote.options.map((o) => o.hoursOnSite),
              )}
              crew={{ crewSize: fields.crewSize }}
              onPick={({ date, time }) =>
                set({ date: parseDate(date), time: parseTime(time) })
              }
            />
            {fields.date && (
              <RoomOnDay
                day={fields.date.toString()}
                time={fields.time?.toString().slice(0, 5)}
                crewSize={fields.crewSize}
                options={quote.options}
              />
            )}
          </DraftPart>
        )}
      </Card>

      {/* a Quote goes by email, and is accepted signed in with it (#34) */}
      {!quote.client.email && (
        <Notice>
          <p>
            {quote.client.name} has no email yet, so this Quote can't be sent.
            Add their email on{" "}
            <Link
              href={linkTo({
                to: "/office/clients/$clientId",
                params: { clientId: quote.client.id },
              })}
            >
              their Client screen
            </Link>
            , then send it.
          </p>
        </Notice>
      )}

      {/* business premises are seen before they're quoted (ADR-0014) */}
      {quote.needsSiteVisit && (
        <Notice>
          <p>
            These premises haven't had a Site Visit, so this Quote can't be
            sent. Book one or record its findings on{" "}
            <Link
              href={linkTo({
                to: "/office/properties/$propertyId",
                params: { propertyId: quote.property.id },
                search: { tab: "visit" },
              })}
            >
              the Property
            </Link>
            , then send it.
          </p>
        </Notice>
      )}

      {/* the prices stay in view wherever the change was made */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3 shadow-raised sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold tabular-nums">
            {priceSummary(quote)}
          </span>
          <span role="status" className="text-sm text-fg-muted">
            {saveStateLabel[saveState]}
          </span>
        </div>
        <Button
          isPending={isSending}
          isDisabled={!quote.client.email || quote.needsSiteVisit}
          onPress={() => void onSend()}
        >
          Send to {quote.client.name}
        </Button>
      </div>
    </Form>
  );
}

// A new weekday for a Service Plan Draft: like the last, on the day after
// it if that's still within a week of the first, at the same time
const anotherDay = (days: DayFields[]): DayFields => {
  const last = days.at(-1)!;
  const dates = days.flatMap((d) => (d.date ? [d.date] : []));
  const first = dates.reduce<CalendarDate | undefined>(
    (min, d) => (!min || d.compare(min) < 0 ? d : min),
    undefined,
  );
  const next = last.date?.add({ days: 1 });
  const taken = (d: CalendarDate) =>
    dates.some((t) => weekdayOf(t.toString()) === weekdayOf(d.toString()));
  return {
    key: nextKey(),
    date:
      next && first && next.compare(first.add({ days: 7 })) < 0 && !taken(next)
        ? next
        : null,
    time: last.time,
    crewSize: last.crewSize,
    override: { on: false, price: 0, reason: "" },
  };
};

function PlanDayFields({
  index,
  day,
  plan,
  stale,
  option,
  terms,
  onChange,
  onRemove,
}: {
  index: number;
  day: DayFields;
  plan: PlanFields;
  stale: boolean;
  option: OfficeQuoteOption | undefined;
  terms: PlanDayTerms | undefined;
  onChange: (change: Partial<DayFields>) => void;
  // none while it's the plan's only weekday
  onRemove: (() => void) | undefined;
}) {
  const name = `plan.days.${index}`;
  const time = day.time?.toString().slice(0, 5);
  const one = plan.days.length === 1;
  const title = day.date
    ? `${weekdayOf(day.date.toString())}s`
    : `Weekday ${index + 1}`;
  return (
    <DraftPart
      title={title}
      description={
        one
          ? `Its first clean, New York time. Then ${recurrenceLabel[plan.recurrence].toLowerCase()} on the same weekday. The Quote Expires at the plan's first clean if it isn't accepted first.`
          : "Its first clean, New York time. Then every week on the same weekday."
      }
      actions={
        onRemove && (
          <Button variant="danger-text" size="sm" onPress={onRemove}>
            <Trash2 aria-hidden size={16} />
            Remove {title}
          </Button>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker
          label="Date"
          name={`${name}.start`}
          value={day.date}
          onChange={(date) => onChange({ date })}
        />
        <TimeField
          label="Start time"
          value={day.time}
          onChange={(time) => onChange({ time })}
        />
      </div>
      <PickFromSchedule
        date={day.date?.toString()}
        time={time}
        hoursOnSite={option?.hoursOnSite ?? 0}
        crew={{ crewSize: day.crewSize }}
        repeats={{
          everyWeeks: recurrenceWeeks[plan.recurrence],
          label: recurrenceLabel[plan.recurrence],
        }}
        onPick={(picked) =>
          onChange({
            date: parseDate(picked.date),
            time: parseTime(picked.time),
          })
        }
      />
      {day.date && option && (
        <RoomOnDay
          day={day.date.toString()}
          time={time}
          crewSize={day.crewSize}
          options={[option]}
        />
      )}
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
        <NumberField
          label="Crew Size"
          name={`${name}.crewSize`}
          minValue={1}
          maxValue={10}
          value={day.crewSize}
          onChange={(crewSize) => onChange({ crewSize })}
        />
      </div>
      {option && terms && (
        <div aria-busy={stale} className={staleStyle(stale)}>
          <OfferPrice
            title={
              one
                ? `${option.serviceName}, ${recurrenceLabel[plan.recurrence].toLowerCase()}`
                : `${title}: ${option.serviceName}`
            }
            badge={<PlanSaving day={terms} />}
          >
            <PlanFigures
              option={option}
              day={terms}
              discountPercent={plan.discountPercent}
            />
            <p className="text-sm text-fg-muted">
              The Plan Discount comes off the one-off price, overridden or not.
            </p>
            <OverrideFields
              option={option}
              override={day.override}
              label="one-off"
              name={`${name}.override`}
              onChange={(change) =>
                onChange({ override: { ...day.override, ...change } })
              }
            />
          </OfferPrice>
        </div>
      )}
    </DraftPart>
  );
}

function FirstCleanNote({ firstClean }: { firstClean: FirstCleanFindings }) {
  const { job } = firstClean;
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        First Clean: the home was{" "}
        {conditionLabel[firstClean.condition].toLowerCase()}
        {firstClean.adjustments.length > 0 &&
          `, with ${firstClean.adjustments.length} Adjustment${firstClean.adjustments.length > 1 ? "s" : ""}`}
      </summary>
      <Card className="mt-2">
        <p className="text-sm text-fg-muted">
          {job.serviceName} on {formatDateTime(job.startsAt)}, Completed{" "}
          {formatDate(firstClean.completedAt)} ·{" "}
          <Link
            href={linkTo({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            })}
          >
            See the Job
          </Link>
        </p>
        <p>
          Its Cleaner found the home{" "}
          <strong>{conditionLabel[firstClean.condition].toLowerCase()}</strong>.
        </p>
        {firstClean.adjustments.length === 0 ? (
          <p className="text-fg-muted">No Adjustments.</p>
        ) : (
          <List aria-label="First Clean Adjustments">
            {firstClean.adjustments.map((a) => (
              <ListItem
                key={a.id}
                id={a.id}
                title={`${adjustmentLabel(a)}: ${formatMoney(a.totalCents)}`}
                description={`"${a.reason}"`}
              />
            ))}
          </List>
        )}
      </Card>
    </details>
  );
}
