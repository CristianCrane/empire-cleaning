import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import {
  CalendarCheck,
  CircleCheck,
  CircleSlash,
  FileClock,
  FilePenLine,
  Hourglass,
  Mail,
  MessageSquareText,
  Pencil,
  Send,
  Trash2,
  CalendarPlus,
  type LucideIcon,
  CircleX,
  CalendarClock,
  Repeat,
  CirclePlus,
} from "lucide-react";
import {
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
} from "@internationalized/date";
import type {
  Condition,
  DayCapacity,
  Untimely,
  FirstCleanFindings,
  OfficeQuote,
  OfficeQuoteOption,
  OfficeRevision,
  PlanChange,
  QuoteDraftInput,
  Recurrence,
  ServiceChoice,
  ServicePlanInput,
} from "@empire-cleaning/models";
import {
  firstNameOf,
  noEmailYet,
  notSeenYet,
  placeOwner,
  weekdayOf,
  whyNoRoom,
  MORE_HOURS,
  NO_ROOM,
  noRoomOf,
  runsPastMidnight,
  formats,
  messages,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Dialog,
  Form,
  FormPage,
  FormPart,
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
  Timeline,
  TimelineItem,
  showToast,
  Fold,
  RecordPage,
  type Alert,
  Facts,
  Fact,
  staleFade,
  FieldRow,
  type DialogState,
  type PageAction,
  type PageActions,
} from "@empire-cleaning/ui";
import { ApiError, deleteJson, patchJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction, useLeavingAction } from "../action.ts";
import {
  clientName,
  dayOfInstant,
  timeOfDay,
  timeOfField,
  screenWords,
} from "../format.ts";
import {
  AddOnList,
  DraftChangesBadge,
  HoursRows,
  OptionFigures,
  OptionRows,
  PlanFigures,
  PlanRows,
  PlanSaving,
  PlanTotals,
  QuoteStatusBadge,
  planDayTitle,
} from "../QuoteParts.tsx";
import { homeCrumbs } from "./trails.ts";
import {
  AskedFacts,
  askedSummary,
  FoldedPrice,
  PriceWorking,
  seeThePremises,
  WhichKindDialog,
  TurnDownQuote,
  turnDownLabel,
} from "./QuoteAsked.tsx";
import { endsAt, PickOpenTime, type TimeProblem } from "./OpenTimePicker.tsx";
import {
  BOOK_A_SITE_VISIT,
  BookSiteVisitDialog,
  visitSummary,
} from "./SiteVisitParts.tsx";
import { useStartDraft } from "./StartDraft.tsx";
import { reportUnexpected } from "../../monitoring.ts";

const {
  cleaners,
  conditionLabel,
  planName,
  planRhythm,
  recurrenceLabel,
  quoteKindName,
  formatFloorArea,
} = screenWords.en;

const { adjustmentLabel } = messages.en;

const {
  formatDate,
  formatDateTime,
  formatClock,
  formatDay,
  formatMoney,
  weekdayName,
  formatList,
} = formats.en;

// The Quote with one of its Revisions in hand: the one being drafted, or
// else the offer, so it's edited while there's a Draft Revision and
// read-only otherwise
type ShownQuote = Omit<OfficeQuote, "draft" | "offer"> &
  Omit<OfficeRevision, "id" | "number" | "status"> & {
    // the Revision shown, and its id, which accepting it names
    revision: number;
    revisionId: string;
  };

const shownOf = (quote: OfficeQuote): ShownQuote => {
  const { draft, offer, ...rest } = quote;
  const { id, number, status: _status, ...fields } = (draft ?? offer)!;
  return { ...rest, ...fields, revision: number, revisionId: id };
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

  const kind = quoteKindName(quote.kind);
  const revising = quote.draft !== null && quote.offer !== null;
  const now = useNow(quote);

  return (
    <RecordPage
      trail={[
        { label: "Quotes", href: linkTo({ to: "/office/quotes" }) },
        ...homeCrumbs(quote.client, quote.property),
        { label: kind },
      ]}
      title={`${kind} for ${clientName(quote.client)}`}
      status={
        <>
          <QuoteStatusBadge status={quote.status} />
          {revising && <DraftChangesBadge />}
        </>
      }
      next={now.next}
      actions={now.actions}
      alerts={[
        ...now.alerts,
        quote.status !== "turned_down" &&
          shown?.changesPlan && {
            key: "plan change",
            children: (
              <PlanChangeText quote={shown} change={shown.changesPlan} />
            ),
          },
      ]}
    >
      {/* its story is its body: no History of its own (#145) */}
      <Timeline aria-label="This quote's story, newest first">
        {offer && (
          <TimelineItem icon={FileClock} title="Now" current>
            <Offer quote={offer} />
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
    </RecordPage>
  );
}

const shownFor = (quote: OfficeQuote) =>
  quote.draft || quote.offer ? shownOf(quote) : null;

// a sent quote's draft, which its Client doesn't see till it's sent
const stillSees = (name: string) =>
  `${name} still sees the quote as you sent it until you send your changes.`;

const draftLink = (quote: OfficeQuote) =>
  linkTo({
    to: "/office/quotes/$quoteId/draft",
    params: { quoteId: quote.id },
  });

// What there is to do with the Quote, worked out once from its state
// (docs/ux.md, Page structure and Notices): its next step, the page's
// primary; the rest behind its arrow; and alerts above its story saying
// why, or what it came to, where its badge, its facts and its story don't
// say it already. An alert's one action is never the next step
type Now = {
  next?: PageAction;
  actions: PageActions;
  alerts: (Alert | false | null)[];
};

function useNow(quote: OfficeQuote): Now {
  const { start, starting } = useStartDraft();
  const name = quote.client.name;
  const offer = quote.offer ? shownOf({ ...quote, draft: null }) : null;
  // the offer can still be accepted: by phone, the Office records it, which
  // needs a card saved, unless it only changes a plan (charging nothing)
  const acceptable =
    offer !== null && quote.status === "sent" && quote.bookable.length > 0;
  const recordable =
    acceptable && (offer.changesPlan !== null || quote.paymentMethod !== null);

  const recordAcceptance: PageAction | false = recordable && {
    label: "Record acceptance",
    icon: CircleCheck,
    dialog: (state) => (
      <RecordAcceptanceDialog
        quote={offer!}
        drafting={quote.draft?.number}
        {...state}
      />
    ),
  };
  const noCard: Alert | false = acceptable &&
    !recordable && {
      key: "card",
      action: <EmailCardLink quote={quote} />,
      children: (
        <p>
          {firstNameOf(name)} has no card saved, so a yes by phone can't be
          recorded yet.
        </p>
      ),
    };
  // a new Revision replaces the offer, from its terms
  const changeQuote: PageAction = {
    label: "Change quote",
    icon: Pencil,
    onAction: () => void start({ quoteId: quote.id, kind: quote.kind! }),
    isPending: starting !== undefined,
  };
  // nothing of it Sent yet, so it may still be Turned Down
  const turnDown: PageAction = {
    label: "Turn down",
    icon: CircleX,
    danger: true,
    dialog: (state) => <TurnDownQuote quote={quote} {...state} />,
  };
  const bookVisit: PageAction = {
    label: BOOK_A_SITE_VISIT,
    icon: CalendarPlus,
    dialog: (state) => <BookSiteVisitDialog quoteId={quote.id} {...state} />,
  };
  // optional, unless its Service is seen first: then it's the next step
  const mayBookVisit = !quote.needsSiteVisit && !quote.bookedSiteVisit;

  // a Revision being written
  if (quote.draft) {
    return {
      next: {
        label: "Carry on with the draft",
        icon: FilePenLine,
        href: draftLink(quote),
      },
      actions: quote.offer
        ? [recordAcceptance]
        : [mayBookVisit && bookVisit, turnDown],
      alerts: [
        {
          key: "draft",
          tone: "warning",
          children: (
            <p>
              {quote.offer
                ? stillSees(name)
                : `Nothing reaches ${name} until you send it.`}
            </p>
          ),
        },
        noCard,
      ],
    };
  }

  switch (quote.status) {
    case "requested":
    case "draft":
      return toQuote(quote, {
        draft: draftTheQuote(quote, start, starting),
        bookVisit,
        turnDown,
      });
    case "sent":
      return acceptable
        ? {
            next: recordAcceptance || undefined,
            actions: [changeQuote],
            alerts: [noCard],
          }
        : {
            next: changeQuote,
            actions: [],
            alerts: [
              {
                key: "full",
                tone: "danger",
                children: (
                  <p>
                    {offer!.plan && offer!.plan.days.length > 1
                      ? "One of its first days has"
                      : `${formatDateTime(offer!.proposedStartsAt!)} has`}{" "}
                    filled up since this quote was sent, so {name} can't accept
                    it.
                  </p>
                ),
              },
            ],
          };
    // the badge, the Expired fact and the story's moment say what
    // happened; an Expired one can be offered again, a Declined one is
    // closed, as the server holds (openQuote), the Client asking anew
    case "expired":
      return { actions: [changeQuote], alerts: [] };
    case "declined":
      return { actions: [], alerts: [] };
    // the badge and the story say when, and the quote what was booked; a
    // plan's says where it went on
    case "accepted":
      return {
        actions: [],
        alerts: [
          !!quote.servicePlanId && {
            key: "accepted",
            tone: "success",
            children: (
              <p>
                <Link
                  href={linkTo({
                    to: "/office/service-plans/$planId",
                    params: { planId: quote.servicePlanId },
                  })}
                >
                  {quote.changedPlan
                    ? "Its cleaning plan has changed"
                    : "Its cleaning plan has started"}
                </Link>
                .
              </p>
            ),
          },
        ],
      };
    // the badge and the story's moment say when, and why
    case "turned_down":
      return { actions: [], alerts: [] };
  }
}

// A Requested Quote's first Revision, which sets its kind: asked which
// first where either kind is possible (the home's First Clean is
// Completed, or for business premises at any time, ADR-0014)
const draftTheQuote = (
  quote: OfficeQuote,
  start: ReturnType<typeof useStartDraft>["start"],
  starting: ReturnType<typeof useStartDraft>["starting"],
): PageAction => {
  const eitherKind =
    quote.firstCleanCompleted || quote.property.kind === "commercial";
  return {
    label: "Draft the quote",
    icon: FilePenLine,
    ...(eitherKind
      ? {
          dialog: (state: DialogState) => (
            <WhichKindDialog quote={quote} {...state} />
          ),
        }
      : {
          onAction: () => void start({ quoteId: quote.id, kind: "one_off" }),
          isPending: starting !== undefined,
        }),
  };
};

// a Quote asked for, nothing drafted yet: see the premises first if its
// Service is seen before it's quoted (ADR-0018), with nothing to do while
// the visit's to come but Turn it down, else draft it
const toQuote = (
  quote: OfficeQuote,
  {
    draft,
    bookVisit,
    turnDown,
  }: { draft: PageAction; bookVisit: PageAction; turnDown: PageAction },
): Now => {
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
    return {
      next: bookVisit,
      actions: [turnDown],
      alerts: [seeThePremises(quote)],
    };
  }
  if (quote.needsSiteVisit) {
    return {
      actions: [turnDown],
      alerts: [
        {
          key: "visit",
          children: (
            <p>
              <strong>Site visit booked:</strong> {visitLink}. Draft the quote
              once it's done and what it found is recorded.
            </p>
          ),
        },
      ],
    };
  }
  return {
    next: draft,
    actions: [!visit && bookVisit, turnDown],
    alerts: [
      visit && {
        key: "visit",
        children: (
          <p>
            <strong>Site visit booked:</strong> {visitLink}.
          </p>
        ),
      },
      !!quote.homePlanId && {
        key: "plan",
        children: (
          <p>
            This home has a{" "}
            <Link
              href={linkTo({
                to: "/office/service-plans/$planId",
                params: { planId: quote.homePlanId },
              })}
            >
              cleaning plan
            </Link>
            . A cleaning plan quote changes it once the client accepts.
          </p>
        ),
      },
    ],
  };
};

// throws the Draft away, once Office Staff are sure: see discardDraft
function DeleteDraft({
  quote,
  isOpen,
  onOpenChange,
}: { quote: OfficeQuote } & DialogState) {
  const navigate = useNavigate();
  const action = useLeavingAction(
    "The draft wasn't deleted. Please try again.",
  );
  // what discarding leaves is the server's to say: nothing (204) once the
  // Quote has gone with its Draft
  const remove = (close: () => void) =>
    action.run(async () => {
      const left = await deleteJson<OfficeQuote | undefined>(
        `/api/quotes/${quote.id}/draft`,
      );
      close();
      await (!left
        ? navigate({
            to: "/office/properties/$propertyId",
            params: { propertyId: quote.property.id },
          })
        : navigate({
            to: "/office/quotes/$quoteId",
            params: { quoteId: quote.id },
          }));
    }, "Draft deleted");
  return (
    <Dialog
      title="Delete the draft?"
      role="alertdialog"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      {({ close }) => (
        <>
          <p>
            {quote.offer
              ? `Your changes are lost. ${quote.client.name} keeps the quote you sent.`
              : !quote.asked
                ? "Nothing was asked for or sent, so the quote goes too."
                : `The quote goes back to asked for, so you can draft it again. If ${quote.client.name} has asked for a ${quote.asked.service.name} again since, that one carries on and this one goes.`}
          </p>
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              Keep it
            </Button>
            <Button
              variant="danger"
              isPending={action.isPending}
              onPress={() => void remove(close)}
            >
              Delete the draft
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}

/**
 * Building a Revision, on a page of its own (a Form page, #434): the
 * editor, its prices worked out afresh from the Price List as it's changed,
 * beside it. Sending it returns to the Quote. With no Draft, it's the
 * Quote's page.
 */
export function QuoteDraftScreen() {
  const quote = useLoaderData({ from: "/office/quotes/$quoteId/draft" });
  // a save gives fresh prices; the form keeps what's typed
  return <DraftEditor key={quote.draft!.id} loaded={quote} />;
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
          : `${quote.client.name} asked for a quote`,
      description: quote.asked.service.name,
      details: <WhatWasAsked quote={quote} />,
    });
  }
  if (visit?.doneAt) {
    moments.push({
      key: "visit",
      at: visit.doneAt,
      icon: CalendarCheck,
      title: "Site visit done",
      description: visit.visitor ? `By ${visit.visitor.name}` : undefined,
    });
  }
  // oldest first, as they happened (quote.revisions is newest first)
  for (const revision of [...quote.revisions].reverse()) {
    moments.push({
      key: revision.id,
      at: revision.sentAt,
      icon: Send,
      title: "Quote sent",
      // what it was sent for, and when: "Standard Clean $194.89 · for …"
      description: `${[revision.headlineServiceName, formatMoney(revision.headlineTotalCents)].filter(Boolean).join(" ")} · for ${formatDateTime(revision.proposedStartsAt)}`,
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
      title: "Turned down",
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
function WhatWasAsked({ quote }: { quote: OfficeQuote }) {
  return (
    <Fold label="What was asked" defaultOpen={unsent(quote)}>
      <Card>
        <AskedFacts quote={quote} />
      </Card>
    </Fold>
  );
}

// nothing of it Sent yet
const unsent = (quote: OfficeQuote) =>
  quote.status === "requested" || quote.status === "draft";

// what accepting a Quote for a home with a plan does to that plan, said in
// an alert
function PlanChangeText({
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
    <>
      <p>
        <strong>This changes {quote.client.name}'s </strong>
        <Link
          href={linkTo({
            to: "/office/service-plans/$planId",
            params: { planId: change.servicePlanId },
          })}
        >
          cleaning plan
        </Link>
        <strong> from {from}.</strong> Its jobs before then go ahead as they
        are.
      </p>
      {change.replaces.length > 0 && (
        <p>
          Its booked jobs from then on are cancelled, free of charge:{" "}
          {change.replaces.map((at) => formatDateTime(at)).join("; ")}.
        </p>
      )}
      <p>
        The plan's {formatMoney(change.depositCents)} deposit carries over, so
        accepting charges nothing.
      </p>
    </>
  );
}

// The offer, read-only, as one card: its terms, each Service's price (or
// each weekday's, on a plan) and the Deposit. A Sent Revision never changes
function Offer({ quote }: { quote: ShownQuote }) {
  const { plan } = quote;
  // once a one-off is accepted, the Service booked alone: the other was
  // never taken
  const booked = quote.status === "accepted" && !plan;
  const options = booked
    ? quote.options.filter((o) => o.serviceKey === quote.acceptedServiceKey)
    : quote.options;
  return (
    <Section
      title="Current quote"
      description={`Sent ${formatDateTime(quote.sentAt!)} to ${quote.client.email}`}
    >
      <Card>
        <Facts>
          <Fact
            icon={CalendarClock}
            label={
              quote.changesPlan || quote.changedPlan
                ? "New terms start"
                : plan
                  ? "Starts"
                  : booked
                    ? "Booked for"
                    : "Proposed time"
            }
            value={formatDateTime(quote.proposedStartsAt!)}
          />
          {plan && (
            <Fact
              icon={Repeat}
              label="Then"
              value={planRhythm(plan)}
              line={`Then, priced for ${conditionLabel[plan.condition].toLowerCase()} condition`}
            />
          )}
          {/* once answered, when it would have expired is no one's concern */}
          {(quote.status === "sent" || quote.status === "expired") && (
            <Fact
              icon={Hourglass}
              label={quote.status === "expired" ? "Expired" : "Expires"}
              value={formatDateTime(quote.expiresAt!)}
            />
          )}
          <Fact
            icon={CirclePlus}
            label="Extras"
            value={
              quote.addOns.length === 0
                ? "None"
                : quote.addOns.map((a) => a.name).join(", ")
            }
          />
        </Facts>
        {/* two side by side from lg; one alone takes the card's width */}
        <div
          className={`grid gap-6 border-t border-border pt-4 ${options.length > 1 ? "lg:grid-cols-2" : ""}`}
        >
          {options.map((option, i) => {
            const day = plan?.days[i];
            return (
              <OfferPrice
                key={day?.startsAt ?? option.serviceKey}
                title={day ? planDayTitle("en", day) : option.serviceName}
                badge={
                  day ? (
                    <PlanSaving
                      day={day}
                      discountPercent={plan!.discountPercent}
                    />
                  ) : (
                    option.recommended &&
                    !booked && (
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
                  >
                    <HoursRows option={option} crewSize={day.crewSize} />
                  </PlanFigures>
                ) : (
                  <OptionFigures
                    option={option}
                    crewSize={quote.crewSize}
                    depositPercent={quote.depositPercent}
                  />
                )}
                <AddOnList addOns={option.addOns} />
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
          Priced from version {quote.priceListVersion} of the prices.
        </p>
      </Card>
    </Section>
  );
}

// What the Draft comes to as last saved, beside it (#434): a one-off
// Quote's own price, the one asked for, and the Service recommended for a
// first visit quiet under it (the user, on #527); or each plan weekday's
// price, then the plan's week. Read-only, each working folded under its
// price. Faded and busy while a change is saved; each price is set in the
// part it prices
function DraftPrices({
  quote,
  dayTitles,
  stale,
}: {
  quote: ShownQuote;
  // a plan's weekdays as they're on screen: "Mondays", "Weekday 2"
  dayTitles: string[];
  stale: boolean;
}) {
  const { plan } = quote;
  // a plan's week, what it comes to, first: below xl the prices lead the
  // page, and three weekdays' pushed it off a laptop's screen
  const week = plan && plan.days.length > 1 && (
    <OfferPrice title="Each week">
      <PlanTotals
        plan={plan}
        depositPercent={quote.depositPercent}
        change={quote.changesPlan}
      />
    </OfferPrice>
  );
  const busy = `flex flex-col gap-5 [&>section+section]:border-t [&>section+section]:border-border [&>section+section]:pt-5 ${staleFade(stale)}`;
  const version = (
    <p className="text-sm text-fg-muted">
      From your prices, version {quote.priceListVersion}.
    </p>
  );
  if (!plan) {
    const own = ownOption(quote);
    const recommended = recommendedOption(quote);
    const shared = sameNoRoom(own, recommended);
    return (
      <div aria-busy={stale} className={busy}>
        <OfferPrice title={own.serviceName}>
          <FoldedPrice
            price={own}
            working={own.suggested}
            under={
              <>
                {own.overrideCents !== null && <PricedFrom option={own} />}
                <NoRoomLine room={own.room} with={shared} />
              </>
            }
          >
            <OptionRows
              option={own}
              crewSize={quote.crewSize}
              depositPercent={quote.depositPercent}
            />
            {version}
          </FoldedPrice>
        </OfferPrice>
        {recommended && (
          <AlsoOffered option={recommended} roomSaid={shared !== undefined}>
            <OptionRows
              option={recommended}
              crewSize={quote.crewSize}
              depositPercent={quote.depositPercent}
            />
            {version}
          </AlsoOffered>
        )}
      </div>
    );
  }
  return (
    <div aria-busy={stale} className={busy}>
      {week}
      {/* as the sent Quote's Offer draws them, a weekday each */}
      {quote.options.map((option, i) => {
        const day = plan.days[i];
        if (!day) return null;
        return (
          <OfferPrice
            key={option.serviceKey + String(i)}
            title={
              plan.days.length === 1
                ? `${option.serviceName}, ${recurrenceLabel[plan.recurrence].toLowerCase()}`
                : `${dayTitles[i] ?? `Weekday ${i + 1}`}: ${option.serviceName}`
            }
            badge={
              <PlanSaving day={day} discountPercent={plan.discountPercent} />
            }
          >
            <FoldedPrice
              price={option}
              working={option.suggested}
              perClean
              under={
                <>
                  {option.overrideCents !== null && (
                    <PricedFrom option={option} />
                  )}
                  <NoRoomLine room={option.room} />
                </>
              }
            >
              <PlanRows
                option={option}
                day={day}
                discountPercent={plan.discountPercent}
              >
                <HoursRows option={option} crewSize={day.crewSize} />
              </PlanRows>
              {plan.discountPercent > 0 && (
                <p className="text-sm text-fg-muted">
                  The plan discount comes off the one-off price, whoever set it.
                </p>
              )}
              {version}
            </FoldedPrice>
          </OfferPrice>
        );
      })}
      {!week && (
        <OfferPrice title="Deposit">
          <PlanTotals
            plan={plan}
            depositPercent={quote.depositPercent}
            change={quote.changesPlan}
          />
        </OfferPrice>
      )}
    </div>
  );
}

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

// The Service recommended for a first visit, which the sent Quote offers
// beside the one asked for (ADR-0018): an aside to the Draft's price, one
// quiet line under it, its price and working folded behind it (the user, on
// #527: "The recommendation is an aside")
function AlsoOffered({
  option,
  roomSaid,
  children,
}: {
  option: OfficeQuoteOption;
  // its no-room line is said under the own price, with the own one's
  roomSaid: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label={option.serviceName} className="flex flex-col text-sm">
      <Fold
        label={`Also offered: ${option.serviceName} ${formatMoney(option.totalCents)}`}
      >
        <div className="flex flex-col gap-3">
          <p className="flex flex-col gap-1 text-fg-muted">
            <span>Shown to the client as recommended; they pick one.</span>
            <span>Includes {formatMoney(option.taxCents)} tax</span>
          </p>
          {option.overrideCents !== null && <PricedFrom option={option} />}
          <PriceWorking breakdown={option.suggested} />
          {children}
        </div>
      </Fold>
      {/* unfolded, as it changes what the client can do; the proposed
          time's part says how to fix it */}
      {!roomSaid && <NoRoomLine room={option.room} />}
    </section>
  );
}

// Office Staff never take card details: the Client adds a card from a link
// emailed to them, before an acceptance by phone can be recorded
function EmailCardLink({ quote }: { quote: OfficeQuote }) {
  const action = useAction("The link wasn't sent. Please try again.", {
    toast: true,
  });
  const firstName = firstNameOf(quote.client.name);
  return (
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
  );
}

// Records the Client's yes, charging the Deposit to the card they saved (a
// plan change charges nothing): it asks which Service they chose and
// confirms. While a new Revision is `drafting`, it's the offer standing
// that's accepted, and accepting it discards the Draft. Offered once a yes
// can be recorded (a card saved, or a plan change): the page's next step,
// or behind the arrow while a change is drafted
function RecordAcceptanceDialog({
  quote,
  drafting,
  ...state
}: {
  quote: ShownQuote;
  drafting?: number;
} & Partial<DialogState>) {
  // the recommended Service, unless only the other still fits
  const [serviceKey, setServiceKey] = useState(
    quote.options.find((o) => quote.bookable.includes(o.serviceKey))!
      .serviceKey,
  );
  const action = useAction("That didn't work. Please try again.");
  const chosen = quote.options.find((o) => o.serviceKey === serviceKey)!;
  const depositCents = quote.plan?.depositCents ?? chosen.depositCents;

  const accept = async (close: () => void) => {
    const ok = await action.run(
      // a plan is accepted whole
      () =>
        postJson<OfficeQuote>(
          `/api/quotes/${quote.id}/accept`,
          quote.plan
            ? { revisionId: quote.revisionId }
            : { revisionId: quote.revisionId, serviceKey },
        ),
      quote.changesPlan
        ? "Accepted: the cleaning plan has changed"
        : quote.plan
          ? "Accepted: the cleaning plan has started"
          : "Accepted and booked",
    );
    if (ok) close();
  };

  return (
    <Dialog title="Record acceptance?" role="alertdialog" {...state}>
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
                      ? `${formatMoney(option.totalCents)}, deposit ${formatMoney(option.depositCents)}`
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
              ? `This changes ${quote.client.name}'s cleaning plan to ${planName(quote.plan!)} from ${formatDateTime(quote.proposedStartsAt!)}, and cancels its booked jobs from then on. Nothing is charged.`
              : quote.plan
                ? `This charges the ${formatMoney(depositCents)} deposit to ${quote.client.name}'s ${quote.paymentMethod!.label}, kept for as long as the plan runs, and starts their cleaning plan, ${planName(quote.plan)}, with its first clean on ${formatDateTime(quote.proposedStartsAt!)}.`
                : `This charges the ${formatMoney(chosen.depositCents)} deposit to ${quote.client.name}'s ${quote.paymentMethod!.label} and books their ${chosen.serviceName} for ${formatDateTime(quote.proposedStartsAt!)}.`}{" "}
            {drafting
              ? "It accepts the quote you sent, and deletes your draft."
              : ""}{" "}
            Only do this if they've told you they accept.
          </p>
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
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
  );
}

// the Suggested Price, and the override that replaced it
function PricedFrom({ option }: { option: OfficeQuoteOption }) {
  if (option.overrideCents === null) {
    return (
      <p className="text-sm text-fg-muted">
        The suggested price, {formatMoney(option.suggested.priceCents)} before
        tax.
      </p>
    );
  }
  return (
    <p className="text-sm text-fg-muted">
      <strong className="text-fg">
        Set to {formatMoney(option.overrideCents)} before tax
      </strong>{" "}
      from the suggested {formatMoney(option.suggested.priceCents)}:{" "}
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
  // a one-off Draft's Service, the Quote's once it's sent
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
  date && time ? { date: date.toString(), time: timeOfField(time) } : null;

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

// What's wrong with a clean's time, for the picker to say over its tile, of
// the Draft as last saved and only while what's on screen is that time and
// crew (`fits` when that time is all well, said while its tile is paged
// off): what Send refuses it for (too soon, past midnight), alone, in
// danger; else whether each option has room then, by the rule accepting
// asks (the Jobs a plan change replaces counted as gone), a warning, not a
// rule, as the Office may be about to add hours or a Cleaner and it can
// still be sent (Jen's to answer, #206). The tile is marked when it's the
// quote's own clean (`own`, its place in `options`) that has a problem,
// not only the Service recommended beside it; when it isn't, the others are
// named, for the picker to find a time with room for them too.
const timeCheck = ({
  options,
  own,
  untimely,
  date,
  time,
  crewSize,
}: {
  options: OfficeQuoteOption[];
  own: number;
  untimely: Untimely[];
  date: string | undefined;
  time: string | undefined;
  crewSize: number;
}): { problem?: TimeProblem; fits: boolean } => {
  const rooms = options.map((o) => o.room);
  const onScreen = (room: DayCapacity | null): room is DayCapacity =>
    room !== null &&
    room.date === date &&
    timeOfDay(room.startsAt) === time &&
    room.crewSize === crewSize;
  if (!rooms.every(onScreen)) return { fits: false };
  const refused = untimely.find((u) => u.reason !== "no_time");
  if (refused) {
    // past midnight, it may be only the Service beside it that runs on,
    // which the server's line names
    const flags =
      refused.reason !== "past_midnight" || !rooms[own]!.endsByMidnight;
    const late = options.filter((_, i) => !rooms[i]!.endsByMidnight);
    return {
      problem: {
        tone: "danger",
        lines: [refused.message],
        flags,
        // a time ending by midnight being room it lacks, the picker's
        // nearest time with room for it too
        ...(!flags && { alsoFor: formatList(late.map(describeOption)) }),
      },
      fits: false,
    };
  }
  const lines = roomProblems(options, rooms);
  if (lines.length === 0) return { fits: true };
  if (!rooms[own]!.hasRoom) {
    return { problem: { tone: "warning", lines, flags: true }, fits: false };
  }
  const others = options.filter((_, i) => !rooms[i]!.hasRoom);
  return {
    problem: {
      tone: "warning",
      lines,
      flags: false,
      alsoFor: formatList(others.map(describeOption)),
    },
    fits: false,
  };
};

// What's wrong with these options' rooms, then how to fix it, a line for
// each of a room's rules that fails; none when every one has room. With
// none of them fitting, why, once for each reason, and that the client
// can't accept the quote then; with one fitting, the others named by what
// keeps them out, which the client sees but can't pick (PortalQuote's
// `bookable`): the picker offers a time with room for them too.
const roomProblems = (
  options: OfficeQuoteOption[],
  rooms: DayCapacity[],
): string[] => {
  const fitting = options.filter((_, i) => rooms[i]!.hasRoom);
  if (fitting.length === options.length) return [];
  if (fitting.length === 0) {
    return [
      ...new Set(
        rooms.map((r) =>
          whyNoRoom(
            r,
            `So the client can't accept the quote: pick another time, or ${MORE_HOURS}.`,
          ),
        ),
      ),
    ];
  }
  // none runs past midnight here: that one can't be sent, which
  // timeCheck says first
  return (["full", "crew"] as const).flatMap((why) => {
    const some = options.filter(
      (_, i) => !rooms[i]!.hasRoom && noRoomOf(rooms[i]!) === why,
    );
    if (some.length === 0) return [];
    const names = formatList(some.map(describeOption));
    return [`The client can't pick ${names} at this time: ${NO_ROOM[why]}.`];
  });
};

// Under each option's price, why the client can't pick it at the time
// proposed, so the card, the client's view, doesn't read as if the others
// can be (#493's UX review round 2, U1): a warning, as the quote can still
// be sent, but danger when it would run past midnight, which Send refuses.
// Nothing while it has room, or before it has a time.
// `with` names the Service offered beside it when it has the same problem,
// said once in this line and not again under its price (round 3, U7).
function NoRoomLine({
  room,
  with: other,
}: {
  room: DayCapacity | null;
  with?: string;
}) {
  if (!room || room.hasRoom) return null;
  const why = noRoomOf(room);
  return why === "past_midnight" ? (
    <p className="text-sm text-danger-strong">
      {runsPastMidnight(other ? `it and ${other}` : "it")}
    </p>
  ) : (
    <p className="text-sm text-warning-strong">
      The client can't pick {other ? `it or ${other}` : "it"} at this time:{" "}
      {NO_ROOM[why]}.
    </p>
  );
}

// the Service offered beside the own one, when its time has the own one's
// problem, so the card says it once
const sameNoRoom = (
  own: OfficeQuoteOption,
  other: OfficeQuoteOption | undefined,
) =>
  other &&
  own.room &&
  other.room &&
  !own.room.hasRoom &&
  !other.room.hasRoom &&
  noRoomOf(own.room) === noRoomOf(other.room)
    ? describeOption(other)
    : undefined;

const describeOption = (o: OfficeQuoteOption) => `the ${o.serviceName}`;

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
      <FieldRow>
        <NumberField
          label="Plan discount (%)"
          name="plan.discountPercent"
          minValue={0}
          maxValue={100}
          value={plan.discountPercent}
          onChange={(discountPercent) => onChange({ discountPercent })}
        />
        <Select
          label="Priced for condition"
          width="medium"
          selectedKey={plan.condition}
          onSelectionChange={(key) => onChange({ condition: key as Condition })}
        >
          {(["light", "moderate", "heavy"] as const).map((c) => (
            <SelectItem key={c} id={c}>
              {conditionLabel[c]}
            </SelectItem>
          ))}
        </Select>
      </FieldRow>
    </>
  );
}

// the way to replace the Suggested Price with a price and a reason, in the
// part it prices (the price and its working are beside the form)
function OverrideFields({
  override,
  label,
  name,
  onChange,
}: {
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
      <Checkbox isSelected={override.on} onChange={(on) => onChange({ on })}>
        Set the {label} price yourself
      </Checkbox>
      {override.on && (
        <div className="flex flex-col gap-4">
          <NumberField
            label={`${label === "one-off" ? "One-off" : label} price before tax`}
            name={`${name}.priceCents`}
            minValue={0}
            maxValue={100_000}
            formatOptions={dollars}
            value={override.price}
            onChange={(price) => onChange({ price })}
          />
          <TextField
            label="Why this price"
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
  saved: "Saved",
  changed: "Updating prices…",
  saving: "Updating prices…",
  incomplete: "Give a reason for the new price to update the prices",
  invalid: "Fix the marked fields to update the prices",
  failed: "Your changes didn't save. We'll try again as you edit.",
};

// how long after the last change the Draft is saved and priced again
const SAVE_DELAY_MS = 500;

// a one-off Quote's own option: its Service, the one asked for unless the
// Office changed it, after any recommended for a first visit (ADR-0018)
const ownOption = (quote: ShownQuote) =>
  quote.options.find((o) => !o.recommended)!;
// and the Service it recommends in its place for a first visit, if any
const recommendedOption = (quote: ShownQuote) =>
  quote.options.find((o) => o.recommended);

// the price as last worked out: in a line, as a phone's foot shows it, and
// in the fewest words, for the header that sticks on a wider screen. A
// one-off Quote's is its own Service's, the one asked for unless the Office
// changed it: the Service recommended for a first visit is an aside, in
// neither (the user, on #527's U1)
const priceOf = (quote: ShownQuote) => {
  const { plan } = quote;
  if (plan) {
    const clean = formatMoney(quote.options[0]!.totalCents);
    const week = formatMoney(plan.roundTotalCents);
    return plan.days.length === 1
      ? {
          line: `${planName(plan)}: ${clean} a clean`,
          short: `${clean} a clean`,
        }
      : {
          line: `${plan.days.length} cleans a week: ${week} a week`,
          short: `${week} a week`,
        };
  }
  const own = ownOption(quote);
  const named = `${own.serviceName} ${formatMoney(own.totalCents)}`;
  return { line: named, short: named };
};

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
      ? `Leave empty to use the floor area, ${formatFloorArea(from.sqFt)}.`
      : `Leave empty to use the client's rough figure, ${formatFloorArea(from.sqFt)}.`;
  return (
    <NumberField
      label="Area in sq ft"
      name="area"
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
 * so the prices always follow what's on screen; a phone's bar at the foot,
 * or a wider screen's header that sticks, keeps them in view wherever the
 * change was made. On a Service Plan Quote, the
 * plan's Service is chosen from its price cards.
 */
function DraftEditor({ loaded }: { loaded: OfficeQuote }) {
  const navigate = useNavigate();
  const router = useRouter();
  // the Draft as last saved, and its revision as shown: what's said
  // above the form (the plan it changes, from when) follows each save
  const [draft, setDraft] = useState(loaded);
  const quote = shownOf(draft);
  const [fields, setFields] = useState(() => toFields(quote));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  // how many saves have landed, so what's worked out from the Draft as
  // saved loads again
  const [saves, setSaves] = useState(0);
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
  // each option's own, so its "Why this price" is told apart from the other's
  const overrideGroup = (option: OfficeQuoteOption) => (
    <div
      role="group"
      aria-label={option.serviceName}
      className="flex flex-col gap-4"
    >
      <OverrideFields
        override={overrideFor(option)}
        label={option.serviceName}
        name={`overrides.${option.serviceKey}`}
        onChange={(change) => setOverride(option, change)}
      />
    </div>
  );
  const recommended = recommendedOption(quote);
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

  // saves what's on screen, one save at a time, unless it's saved already
  // (`again` saves it anyway, priced afresh); says whether it's all saved
  const saveNow = (again = false): Promise<boolean> => {
    queue.current = queue.current.then(async () => {
      const edit = edits.current;
      if (!again && edit === saved.current.edit) return saved.current.ok;
      setSaveState("saving");
      try {
        setDraft(
          await patchJson<OfficeQuote>(
            `/api/quotes/${quote.id}/draft`,
            toInput(latest.current),
          ),
        );
        setFieldErrors({});
        setFailure(undefined);
        setSaves((n) => n + 1);
        saved.current = { edit, ok: true };
      } catch (e) {
        reportUnexpected(e);
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

  // saveNow reads the latest fields itself
  const saveLatest = useEffectEvent(() => void saveNow());
  useEffect(() => {
    if (edits.current === saved.current.edit) return;
    if (missingReason(fields)) {
      setSaveState("incomplete");
      return;
    }
    const timer = setTimeout(() => saveLatest(), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
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
      reportUnexpected(e);
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
      } else if (e instanceof ApiError && e.status === 409) {
        // refused for new prices, saving again shows them; refused as the
        // Quote has closed, the page shows how
        if (!(await saveNow(true))) await router.invalidate();
        setFailure(e.message);
      } else {
        setFailure("That didn't work. Please try again.");
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
  const areaField = areaPriced && (
    <AreaField
      area={fields.area}
      from={quote.areaFrom}
      onChange={(area) => set({ area })}
    />
  );
  const dayTitles = plan?.days.map(dayTitle) ?? [];
  const extras = quote.addOnChoices
    .filter((a) => fields.addOns.includes(a.key))
    .map((a) => a.name);
  const problems = [
    failure && (
      <Notice key="failure" tone="danger">
        {failure}
      </Notice>
    ),
    // a Quote goes by email, and is accepted signed in with it (#34)
    !quote.client.email && (
      <Notice key="email" tone="warning">
        <p>
          {noEmailYet(quote.client.name)} Add their email on{" "}
          <Link
            href={linkTo({
              to: "/office/clients/$clientId",
              params: { clientId: quote.client.id },
            })}
          >
            their client page
          </Link>
          , then send it.
        </p>
      </Notice>
    ),
    // a Service seen first is seen before it's quoted (ADR-0018)
    quote.needsSiteVisit && (
      <Notice key="visit" tone="warning">
        <p>
          {notSeenYet(quote.property.kind)} Book one, or record what it found on{" "}
          <Link
            href={linkTo({
              to: "/office/properties/$propertyId",
              params: { propertyId: quote.property.id },
            })}
          >
            {placeOwner(quote.property.kind)} page
          </Link>
          , then send it.
        </p>
      </Notice>
    ),
  ].filter(Boolean);

  return (
    <Form
      validationErrors={fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void saveNow();
      }}
    >
      <FormPage
        trail={[
          { label: "Quotes", href: linkTo({ to: "/office/quotes" }) },
          ...homeCrumbs(draft.client, draft.property),
          {
            label: quoteKindName(draft.kind),
            href: linkTo({
              to: "/office/quotes/$quoteId",
              params: { quoteId: draft.id },
            }),
          },
          { label: "Draft quote" },
        ]}
        // the title says it's a draft, not sent: no badge to say it again
        title={`Draft quote for ${clientName(draft.client)}`}
        actions={[
          {
            label: "Delete draft",
            icon: Trash2,
            danger: true,
            // never while it's being sent (docs/ux.md, Form page)
            isPending: isSending,
            dialog: (state) => <DeleteDraft quote={draft} {...state} />,
          },
        ]}
        alerts={[
          draft.offer && {
            key: "sees",
            children: stillSees(draft.client.name),
          },
          draft.changesPlan && {
            key: "plan",
            children: (
              <PlanChangeText quote={quote} change={draft.changesPlan} />
            ),
          },
        ]}
        aside={{
          // the quote the client will see (the user, on #527)
          title: "Quote",
          leads: true,
          children: (
            <DraftPrices quote={quote} dayTitles={dayTitles} stale={stale} />
          ),
        }}
        end={problems.length > 0 && problems}
        // the page's next step; the prices and whether they're saved stay
        // in view wherever the change was made: a phone's bar at the foot,
        // a wider screen's header that sticks (#425, #493 D1)
        next={{
          // just Send, so a long name doesn't squeeze the prices; the
          // heading names who it goes to, and so does this for a screen
          // reader
          label: "Send",
          srLabel: `to ${quote.client.name}`,
          icon: Send,
          isPending: isSending,
          // and while a time can't be sent, which the line beside it says
          isDisabled:
            !quote.client.email ||
            quote.needsSiteVisit ||
            quote.untimely.length > 0,
          onAction: () => void onSend(),
        }}
        price={priceOf(quote)}
        note={noteOf(saveState, sendHold(quote, dayTitles))}
      >
        {draft.asked && (
          <FormPart title="What was asked" summary={askedSummary(draft)}>
            <AskedFacts quote={draft} />
          </FormPart>
        )}
        {draft.firstClean && (
          <FormPart
            title="First clean"
            summary={firstCleanSummary(draft.firstClean)}
          >
            <FirstCleanFacts firstClean={draft.firstClean} />
          </FormPart>
        )}
        {plan ? (
          <>
            <FormPart
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
              {areaField}
            </FormPart>
            {plan.days.map((day, i) => (
              <PlanDayFields
                key={day.key}
                index={i}
                title={dayTitles[i]!}
                day={day}
                stale={stale}
                quoteId={quote.id}
                saves={saves}
                // as last saved, at the same place
                option={quote.options[i]}
                untimely={quote.untimely.filter((u) => u.weekday === i)}
                // the plan's other weekdays, which this one can't be on
                taken={plan.days.flatMap((d) =>
                  d.key !== day.key && d.date
                    ? [weekdayOf(d.date.toString())]
                    : [],
                )}
                weekdays={plan.days.length}
                onChange={(change) => setDay(day.key, change)}
                onRemove={
                  plan.days.length > 1
                    ? () =>
                        setDays((days) => days.filter((d) => d.key !== day.key))
                    : undefined
                }
              />
            ))}
          </>
        ) : (
          <FormPart title="Service">
            {/* "Type", as the part already says Service (the user, on
                #527); its region names it Service to a screen reader */}
            <Select
              label="Type"
              name="serviceKey"
              selectedKey={fields.serviceKey}
              onSelectionChange={(key) => set({ serviceKey: String(key) })}
            >
              {quote.serviceChoices.map((s) => (
                <SelectItem key={s.key} id={s.key}>
                  {s.name}
                </SelectItem>
              ))}
            </Select>
            {areaField}
            {overrideGroup(ownOption(quote))}
            {recommended && (
              // an aside, as beside the form (the user, on #527): its own
              // price set behind a fold, open while it's set
              <Fold
                label={`${recommended.serviceName}, also offered for a first visit`}
                defaultOpen={overrideFor(recommended).on}
              >
                {overrideGroup(recommended)}
              </Fold>
            )}
          </FormPart>
        )}

        <FormPart
          title="Extras"
          summary={extras.length > 0 ? extras.join(", ") : "None"}
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
        </FormPart>

        <FormPart
          title="Terms"
          summary={[
            // each of a plan's weekdays has its own
            !plan && cleaners(fields.crewSize),
            `${fields.depositPercent}% deposit`,
            `valid ${fields.validityDays} days`,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <FieldRow>
            {!plan && (
              <NumberField
                label="Cleaners"
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
          </FieldRow>
        </FormPart>

        {/* a plan's weekdays each have their own, above */}
        {!plan && (
          <ProposedTime
            quote={quote}
            fields={fields}
            saves={saves}
            stale={stale}
            onChange={set}
          />
        )}
      </FormPage>
    </Form>
  );
}

// a plan weekday's title, by its date as on screen: "Mondays", or
// "Weekday 2" before it has one
const dayTitle = (day: DayFields, index: number) =>
  day.date ? `${weekdayName(day.date.toString())}s` : `Weekday ${index + 1}`;

// A new weekday for a Service Plan Draft: its Cleaners like the last's, and
// no time yet, for Office Staff to pick the weekday the client asked for
// (a guess at it would lock its strip to the guessed weekday's dates)
const anotherDay = (days: DayFields[]): DayFields => ({
  key: nextKey(),
  date: null,
  time: null,
  crewSize: days.at(-1)!.crewSize,
  override: { on: false, price: 0, reason: "" },
});

// A one-off Draft's proposed time, picked from the open times in its part
// as the asked-for Service's clean (folded as `timeFold` says)
function ProposedTime({
  quote,
  fields,
  saves,
  stale,
  onChange,
}: {
  quote: ShownQuote;
  fields: Fields;
  saves: number;
  stale: boolean;
  onChange: (change: Partial<Fields>) => void;
}) {
  const own = ownOption(quote);
  const date = fields.date?.toString();
  const time = timeOfField(fields.time);
  const untimely = quote.untimely.filter((u) => u.weekday === null);
  const { problem, fits } = timeCheck({
    options: quote.options,
    own: quote.options.indexOf(own),
    untimely,
    date,
    time,
    crewSize: fields.crewSize,
  });
  return (
    <FormPart
      title="Proposed time"
      {...timeFold({
        date,
        time,
        hoursOnSite: own.hoursOnSite,
        problem,
        untimely,
      })}
    >
      <PickOpenTime
        quoteId={quote.id}
        saves={saves}
        hoursOnSite={own.hoursOnSite}
        date={fields.date}
        time={fields.time}
        problem={problem}
        fits={fits}
        stale={stale}
        name="proposedStart"
        onChange={onChange}
        onPick={(picked) =>
          onChange({
            date: parseDate(picked.date),
            time: parseTime(picked.time),
          })
        }
      />
    </FormPart>
  );
}

// A Proposed time part's fold, as the other parts fold to what's set: its
// line, the time set ("Fri, Dec 4 · 11:30 AM to 2:00 PM", when it ends once
// priced) or that there's none; and folded on load only when that time is
// set, has room and can be sent, open otherwise, where there's something
// to do. Folded by hand, its line follows the time picked since.
const timeFold = ({
  date,
  time,
  hoursOnSite,
  problem,
  untimely,
}: {
  date: string | undefined;
  time: string | undefined;
  hoursOnSite: number | undefined;
  problem: TimeProblem | undefined;
  untimely: Untimely[];
}) => {
  if (!date || !time) return { summary: "Not picked yet", defaultOpen: true };
  const ends =
    hoursOnSite === undefined ? undefined : endsAt(time, hoursOnSite);
  return {
    summary: `${formatDay(date)} · ${formatClock(time)}${ends ? ` to ${ends}` : ""}`,
    defaultOpen:
      hoursOnSite === undefined || problem !== undefined || untimely.length > 0,
  };
};

// What Send waits on, said beside it after "Saved", of the Draft as last
// saved: a time to pick, a later or an earlier one, or that the one picked
// has no room, named, as the picker may be out of view. None when it can go.
const sendHold = (quote: ShownQuote, dayTitles: string[]) => {
  const untimed = quote.untimely.filter((u) => u.reason === "no_time");
  if (untimed.length > 0) {
    if (!quote.plan) return "Pick a time to send";
    return untimed.length === dayTitles.length && untimed.length > 1
      ? "Pick a time for each weekday"
      : `Pick a time for ${formatList(untimed.map((u) => dayTitles[u.weekday!]!))}`;
  }
  const [refused] = quote.untimely;
  if (refused) {
    const which =
      refused.weekday === null ? "" : ` for ${dayTitles[refused.weekday]}`;
    return refused.reason === "too_soon"
      ? `Pick a later time${which}`
      : `Pick an earlier start time${which}`;
  }
  // a one-off's own clean, or any plan weekday's
  const rooms = quote.plan
    ? quote.options.map((o) => o.room)
    : [ownOption(quote).room];
  const full = rooms.find((room) => room && !room.hasRoom);
  return full
    ? `No room on ${formatDay(full.date)} at ${formatClock(timeOfDay(full.startsAt))}`
    : undefined;
};

// the line beside Send: whether it's saved, then once it is, what Send
// waits on
const noteOf = (state: SaveState, hold: string | undefined) =>
  state === "saved" && hold
    ? `${saveStateLabel.saved} · ${hold}`
    : saveStateLabel[state];

// A plan's weekday: its Cleaners, then its proposed time, picked from the
// open times as the Draft's one-off's is, then its price set by hand. Its
// time folds as on load again when a weekday's added or removed, so a
// finished one steps out of the way of the new one: once that saves, as
// whether it's finished is the Draft's as last saved, and a time typed just
// before the press may still be saving.
function PlanDayFields({
  index,
  title,
  day,
  stale,
  quoteId,
  saves,
  option,
  untimely,
  taken,
  weekdays,
  onChange,
  onRemove,
}: {
  index: number;
  title: string;
  day: DayFields;
  stale: boolean;
  quoteId: string;
  saves: number;
  // as last saved, none until it's priced
  option: OfficeQuoteOption | undefined;
  untimely: Untimely[];
  taken: number[];
  // how many the plan has
  weekdays: number;
  onChange: (change: Partial<DayFields>) => void;
  // none while it's the plan's only weekday
  onRemove: (() => void) | undefined;
}) {
  const [foldFor, setFoldFor] = useState(weekdays);
  if (foldFor !== weekdays && !stale) setFoldFor(weekdays);
  const name = `plan.days.${index}`;
  const date = day.date?.toString();
  const time = timeOfField(day.time);
  const { problem, fits } = option
    ? timeCheck({
        options: [option],
        own: 0,
        untimely,
        date,
        time,
        crewSize: day.crewSize,
      })
    : { fits: false };
  return (
    <FormPart
      title={title}
      actions={
        onRemove && (
          // not red: nothing sent or booked is lost, only a day's few
          // fields, and Add a weekday gives a day again in a tap
          <Button variant="text" size="sm" onPress={onRemove}>
            <Trash2 aria-hidden size={16} />
            Remove {title}
          </Button>
        )
      }
    >
      {/* first, as its open times are for this many */}
      <FieldRow>
        <NumberField
          label="Cleaners"
          name={`${name}.crewSize`}
          minValue={1}
          maxValue={10}
          value={day.crewSize}
          onChange={(crewSize) => onChange({ crewSize })}
        />
      </FieldRow>
      {/* its price is beside the form, with the rest; over the time, as
          the one-off's is in its Service, not under a long picker where it
          reads as one of the picker's (#493's UX review round 2, U5) */}
      {option && (
        <OverrideFields
          override={day.override}
          label="one-off"
          name={`${name}.override`}
          onChange={(change) =>
            onChange({ override: { ...day.override, ...change } })
          }
        />
      )}
      <FormPart
        key={foldFor}
        title="Proposed time"
        headingLevel={3}
        {...timeFold({
          date,
          time,
          hoursOnSite: option?.hoursOnSite,
          problem,
          untimely,
        })}
      >
        <PickOpenTime
          quoteId={quoteId}
          weekday={index}
          title={title}
          saves={saves}
          hoursOnSite={option?.hoursOnSite}
          date={day.date}
          time={day.time}
          taken={taken}
          problem={problem}
          fits={fits}
          stale={stale}
          name={`${name}.start`}
          onChange={onChange}
          onPick={(picked) =>
            onChange({
              date: parseDate(picked.date),
              time: parseTime(picked.time),
            })
          }
        />
      </FormPart>
    </FormPart>
  );
}

// what the home's first clean found, in a line: "The home was heavy · 2
// price changes"
const firstCleanSummary = ({ condition, adjustments }: FirstCleanFindings) =>
  [
    `The home was ${conditionLabel[condition].toLowerCase()}`,
    adjustments.length === 0
      ? "no price changes"
      : `${adjustments.length} price change${adjustments.length > 1 ? "s" : ""}`,
  ].join(" · ");

function FirstCleanFacts({ firstClean }: { firstClean: FirstCleanFindings }) {
  const { job } = firstClean;
  return (
    <>
      <p className="text-sm text-fg-muted">
        {job.serviceName} on {formatDateTime(job.startsAt)}, done{" "}
        {formatDate(firstClean.completedAt)} ·{" "}
        <Link
          href={linkTo({
            to: "/office/jobs/$jobId",
            params: { jobId: job.id },
          })}
        >
          See the job
        </Link>
      </p>
      <p>
        Its cleaners found the home{" "}
        <strong>{conditionLabel[firstClean.condition].toLowerCase()}</strong>.
      </p>
      {firstClean.adjustments.length === 0 ? (
        <p className="text-fg-muted">No price changes.</p>
      ) : (
        <List aria-label="Price changes at the first clean">
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
    </>
  );
}
