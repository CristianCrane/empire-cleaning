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
  recurrenceDays,
  weekdayOf,
  whyNoRoom,
  formats,
  messages,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Checkbox,
  DatePicker,
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
  TimeField,
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
  upperFirst,
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
import { PickFromSchedule, type Crew } from "./SchedulePicker.tsx";
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
    return (
      <div aria-busy={stale} className={busy}>
        <OfferPrice title={own.serviceName}>
          <FoldedPrice
            price={own}
            working={own.suggested}
            under={own.overrideCents !== null && <PricedFrom option={own} />}
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
          <AlsoOffered option={recommended}>
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
                option.overrideCents !== null && <PricedFrom option={option} />
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
  children,
}: {
  option: OfficeQuoteOption;
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

// Whether the clean has room at its start, for each Service: each option's
// room on the Draft as last saved, which the server works out by the rule
// accepting asks (the Jobs a plan change replaces counting as gone). A
// warning, not a rule: the Office may be about to add hours or a Cleaner. A
// Quote sent for a full day or time can't be accepted, and goes straight
// under Needs attention. Faded while a change is saved, as the prices are,
// and not shown while what's on screen is another time or crew.
function RoomOnDay({
  day,
  time,
  crewSize,
  options,
  stale,
}: {
  day: string;
  time: string | undefined;
  crewSize: number;
  options: OfficeQuoteOption[];
  stale: boolean;
}) {
  const rooms = options.map((o) => o.room);
  const onScreen = (room: DayCapacity | null): room is DayCapacity =>
    room?.date === day &&
    timeOfDay(room.startsAt) === time &&
    room.crewSize === crewSize;
  if (!rooms.every(onScreen)) return null;
  const problems = roomProblems(options, rooms);
  return (
    <div
      aria-busy={stale}
      className={`flex flex-col gap-3 ${staleFade(stale)}`}
    >
      {problems.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success-strong">
          <CircleCheck aria-hidden size={16} className="shrink-0" />
          {/* "it", the quote, as the recommended Service is an aside (the
          user, on #527); named below only when it alone doesn't fit, as
          that changes what the client can pick */}
          {formatDay(day)} has room for it.
        </p>
      ) : (
        problems.map((problem) => (
          <Notice key={problem} tone="danger">
            {problem}
          </Notice>
        ))
      )}
    </div>
  );
}

// What's wrong with these options' rooms, then how to fix it, a line for
// each of a room's rules that fails; none when every one has room. With
// none of them fitting, why, once for each reason; with one fitting, the
// others named by what keeps them out.
const roomProblems = (
  options: OfficeQuoteOption[],
  rooms: DayCapacity[],
): string[] => {
  const fitting = options.filter((_, i) => rooms[i]!.hasRoom);
  if (fitting.length === options.length) return [];
  if (fitting.length === 0) {
    return [...new Set(rooms.map((r) => whyNoRoom(r)))];
  }
  const missing = (rule: (room: DayCapacity) => boolean) =>
    options.filter((_, i) => !rooms[i]!.hasRoom && rule(rooms[i]!));
  const late = missing((r) => !r.endsByMidnight);
  const full = missing((r) => r.endsByMidnight && !r.hasHours);
  const crewless = missing((r) => r.endsByMidnight && r.hasHours);
  const them = (some: OfficeQuoteOption[]) =>
    some.length === 1 ? "it" : "them";
  const names = (some: OfficeQuoteOption[]) =>
    formatList(some.map(describeOption));
  return [
    late.length > 0 &&
      `${upperFirst(formatList(late.map(describeOption)))} would run past midnight. Pick an earlier start time to offer ${them(late)} too.`,
    full.length > 0 &&
      `That day only has room for ${names(fitting)}. Pick another day to offer ${names(full)} too.`,
    crewless.length > 0 &&
      `Not enough cleaners are free then for ${formatList(crewless.map(describeOption), "or")}. Pick another time to offer ${them(crewless)} too.`,
  ].filter((problem) => problem !== false);
};

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
  // a one-off's longest clean, as last saved, which its picker shows
  const longest = quote.options.reduce<OfficeQuoteOption | undefined>(
    (most, o) => (most && most.hoursOnSite >= o.hoursOnSite ? most : o),
    undefined,
  );
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
          isDisabled: !quote.client.email || quote.needsSiteVisit,
          onAction: () => void onSend(),
        }}
        price={priceOf(quote)}
        note={saveStateLabel[saveState]}
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
                plan={plan}
                stale={stale}
                // as last saved, at the same place
                option={quote.options[i]}
                crew={
                  quote.options[i] && { quoteId: quote.id, weekday: i, saves }
                }
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

        {/* a plan's weekdays each have their own, above; a time too soon
            is the date's error when it's sent, the server's (WEB-D) */}
        {!plan && (
          <FormPart title="Proposed time">
            <FieldRow packed>
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
            </FieldRow>
            <PickFromSchedule
              date={fields.date?.toString()}
              time={timeOfField(fields.time)}
              hoursOnSite={longest?.hoursOnSite ?? 0}
              crew={longest && { quoteId: quote.id, saves }}
              onPick={({ date, time }) =>
                set({ date: parseDate(date), time: parseTime(time) })
              }
            />
            {fields.date && (
              <RoomOnDay
                day={fields.date.toString()}
                time={timeOfField(fields.time)}
                crewSize={fields.crewSize}
                options={quote.options}
                stale={stale}
              />
            )}
          </FormPart>
        )}
      </FormPage>
    </Form>
  );
}

// a plan weekday's title, by its date as on screen: "Mondays", or
// "Weekday 2" before it has one
const dayTitle = (day: DayFields, index: number) =>
  day.date ? `${weekdayName(day.date.toString())}s` : `Weekday ${index + 1}`;

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
  title,
  day,
  plan,
  stale,
  option,
  crew,
  onChange,
  onRemove,
}: {
  index: number;
  title: string;
  day: DayFields;
  plan: PlanFields;
  stale: boolean;
  option: OfficeQuoteOption | undefined;
  // whose crew its picker marks, once it's priced
  crew: Crew | undefined;
  onChange: (change: Partial<DayFields>) => void;
  // none while it's the plan's only weekday
  onRemove: (() => void) | undefined;
}) {
  const name = `plan.days.${index}`;
  const time = timeOfField(day.time);
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
      <FieldRow packed>
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
      </FieldRow>
      <PickFromSchedule
        date={day.date?.toString()}
        time={time}
        hoursOnSite={option?.hoursOnSite ?? 0}
        crew={crew}
        repeats={{
          everyDays: recurrenceDays[plan.recurrence],
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
          stale={stale}
        />
      )}
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
      {/* its price is beside the form, with the rest */}
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
