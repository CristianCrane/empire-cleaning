import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import {
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
} from "@internationalized/date";
import type {
  CleanType,
  Condition,
  FirstCleanFindings,
  OfficeQuote,
  OfficeQuoteOption,
  OfficeRevision,
  PlanChange,
  PlanChoice,
  QuoteDraftInput,
  Recurrence,
  ScheduleDay,
  ServicePlanInput,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
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
  RadioCard,
  RadioGroup,
  Section,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
  TimeField,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, getJson, patchJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  addressOf,
  adjustmentLabel,
  cleanTypeLabel,
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
  OptionCard,
  PlanDayCard,
  PlanFigures,
  PlanSaving,
  PlanTotals,
  QuoteStatusBadge,
} from "../QuoteParts.tsx";
import { crewAt } from "../schedule-layout.ts";
import { homeCrumbs } from "./PropertyScreen.tsx";
import {
  AskedCard,
  FirstRevision,
  SiteVisitCard,
  SuggestedPrices,
  TurnDownQuote,
  turnDownLabel,
} from "./QuoteAsked.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";

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

// a one-off Quote's options as cards, or a Service Plan Quote's weekdays,
// with their Deposit and, on several, a week's total
function OfferCards({
  quote,
  children,
}: {
  quote: ShownQuote;
  // anything more on each option, e.g. how it's priced
  children: (option: OfficeQuoteOption) => ReactNode;
}) {
  const { plan } = quote;
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {plan
          ? plan.days.map((day, i) => (
              <PlanDayCard
                key={day.startsAt ?? i}
                option={quote.options[i]!}
                day={day}
                discountPercent={plan.discountPercent}
              >
                {children(quote.options[i]!)}
              </PlanDayCard>
            ))
          : quote.options.map((option) => (
              <OptionCard
                key={option.cleanType}
                option={option}
                crewSize={quote.crewSize}
                depositPercent={quote.depositPercent}
              >
                {children(option)}
              </OptionCard>
            ))}
      </div>
      {plan && (
        <Card title={plan.days.length > 1 ? "Each week" : "Deposit"}>
          <PlanTotals
            plan={plan}
            depositPercent={quote.depositPercent}
            change={quote.changesPlan}
          />
        </Card>
      )}
    </>
  );
}

/**
 * One Quote for the Office, from asking to booking (ADR-0017): what was
 * asked, its Site Visit, and its Revisions. While Requested it shows the
 * Suggested Price and the way to draft it; while a Revision is drafted, that
 * Revision, edited (on a Sent Quote, marked as Draft changes, the offer
 * standing until it's sent); otherwise the offer, read-only. Every Sent
 * Revision is listed below as its history.
 */
export function QuoteScreen() {
  const quote = useLoaderData({ from: "/office/quotes/$quoteId" });
  const kind = quote.kind === "service_plan" ? "Service Plan Quote" : "Quote";
  const shown = quote.draft || quote.offer ? shownOf(quote) : null;
  const revising = quote.draft !== null && quote.offer !== null;
  const closed = quote.status === "turned_down";

  return (
    <div className="flex flex-col gap-6">
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
          {addressOf(quote.property)} · {propertySummary(quote.property)}
        </p>
      </div>
      {closed && (
        <Notice>
          Turned Down {formatDate(quote.turnedDownAt!)}:{" "}
          {turnDownLabel[quote.turnDownReason!].toLowerCase()}. The Client can
          ask for a new Quote.
        </Notice>
      )}
      {!closed && shown?.changesPlan && (
        <PlanChangeNotice quote={shown} change={shown.changesPlan} />
      )}
      <AskedCard quote={quote} />
      <SiteVisitCard quote={quote} />
      {closed ? null : !shown ? (
        <>
          <FirstRevision quote={quote} />
          <SuggestedPrices quote={quote} />
        </>
      ) : quote.draft ? (
        <>
          {revising && (
            <Notice>
              You're drafting Revision {shown.revision}. {quote.client.name}{" "}
              still sees Revision {quote.offer!.number} until you send it.
            </Notice>
          )}
          {/* a save gives fresh prices; the form keeps what's typed */}
          <DraftEditor key={quote.id} quote={shown} />
        </>
      ) : (
        <SentQuote quote={shown} />
      )}
      <RevisionHistory quote={quote} />
    </div>
  );
}

// nothing of it Sent yet, so it may still be Turned Down
const unsent = (quote: OfficeQuote) =>
  quote.status === "requested" || quote.status === "draft";

// every Sent Revision, newest first: the offer, then those it replaced
function RevisionHistory({ quote }: { quote: OfficeQuote }) {
  if (quote.revisions.length === 0) return null;
  return (
    <Section title="Revisions">
      <List aria-label="Revisions">
        {quote.revisions.map((revision) => (
          <ListItem
            key={revision.id}
            id={revision.id}
            title={`Revision ${revision.number}, sent ${formatDate(revision.sentAt)}`}
            description={`${formatMoney(revision.headlineTotalCents)} · for ${formatDateTime(revision.proposedStartsAt)}`}
            end={
              revision.id === quote.offer?.id && (
                <StatusBadge tone="info">The offer</StatusBadge>
              )
            }
          />
        ))}
      </List>
    </Section>
  );
}

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

function SentQuote({ quote }: { quote: ShownQuote }) {
  return (
    <>
      <Card title="Offer">
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
          <dt className="font-semibold">Sent</dt>
          <dd>
            {formatDateTime(quote.sentAt!)} to {quote.client.email}
          </dd>
          <dt className="font-semibold">
            {quote.status === "expired" ? "Expired" : "Expires"}
          </dt>
          <dd>{formatDateTime(quote.expiresAt!)}</dd>
          {quote.declinedAt && (
            <>
              <dt className="font-semibold">Declined</dt>
              <dd>{formatDateTime(quote.declinedAt)}</dd>
            </>
          )}
          {quote.acceptedAt && (
            <>
              <dt className="font-semibold">Accepted</dt>
              <dd>
                {formatDateTime(quote.acceptedAt)}:{" "}
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
                  `${cleanTypeLabel[quote.acceptedCleanType!]}, booked`
                )}
              </dd>
            </>
          )}
        </dl>
      </Card>
      {quote.status === "sent" &&
        (quote.bookable.length > 0 ? (
          <RecordAcceptance quote={quote} />
        ) : (
          <Notice tone="danger">
            {quote.plan && quote.plan.days.length > 1
              ? "A day its first cleans are on has"
              : `${formatDateTime(quote.proposedStartsAt!)} has`}{" "}
            filled up since this Quote was sent, so {quote.client.name} can't
            accept it. Draft a new Revision with another time: it replaces this
            offer.
          </Notice>
        ))}
      {(quote.status === "sent" || quote.status === "expired") && (
        <NewRevision quote={quote} />
      )}
      <OfferCards quote={quote}>
        {(option) => <PricedFrom option={option} />}
      </OfferCards>
      <Card
        title="Add-ons"
        description={
          quote.plan ? "On every clean, before the Plan Discount." : undefined
        }
      >
        <AddOnList addOns={quote.addOns} />
      </Card>
      {quote.firstClean && <FirstCleanCard firstClean={quote.firstClean} />}
      <p className="text-sm text-fg-muted">
        Priced from Price List version {quote.priceListVersion}. A Sent Revision
        never changes: to offer something different, draft a new one.
      </p>
    </>
  );
}

// starts a new Revision of a Sent or Expired Quote, from the offer's terms
function NewRevision({ quote }: { quote: ShownQuote }) {
  const action = useAction(
    "The new Revision couldn't be started. Please try again.",
  );
  return (
    <div className="flex flex-col gap-2">
      <Actions>
        <Button
          variant="secondary"
          isPending={action.isPending}
          onPress={() =>
            void action.run(() =>
              postJson<OfficeQuote>(`/api/quotes/${quote.id}/revisions`, {}),
            )
          }
        >
          Draft a new Revision
        </Button>
      </Actions>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
    </div>
  );
}

// The Client said yes another way, e.g. by phone: the Office records it,
// charging the Deposit to the card the Client saved. Office Staff never take
// card details, so without one they email the Client a link to add it.
function RecordAcceptance({ quote }: { quote: ShownQuote }) {
  const [cleanType, setCleanType] = useState<CleanType>(
    quote.bookable.includes("deep") ? "deep" : quote.bookable[0]!,
  );
  const action = useAction("That didn't work. Please try again.");
  const chosen = quote.options.find((o) => o.cleanType === cleanType)!;
  const depositCents = quote.plan?.depositCents ?? chosen.depositCents;
  const [firstName] = quote.client.name.split(" ");

  const accept = async (close: () => void) => {
    const ok = await action.run(
      // a plan is accepted whole
      () =>
        postJson<OfficeQuote>(
          `/api/quotes/${quote.id}/accept`,
          quote.plan ? {} : { cleanType },
        ),
      quote.changesPlan
        ? "Accepted: the Service Plan has changed"
        : quote.plan
          ? "Accepted: the Service Plan has started"
          : "Accepted and booked",
      "accept",
    );
    if (ok) close();
  };

  const sendLink = () =>
    action.run(
      () =>
        postJson("/api/payment-methods/requests", {
          clientId: quote.client.id,
        }),
      `Link sent to ${quote.client.email}`,
      "link",
    );

  const linkButton = (
    <Button
      variant="secondary"
      isPending={action.pending === "link"}
      onPress={() => void sendLink()}
    >
      Email {firstName} a link to add a card
    </Button>
  );

  // changing a plan charges nothing: its Deposit carries over
  if (quote.changesPlan) {
    return (
      <Card
        title="Record acceptance"
        description="If the Client accepts by phone or in person."
      >
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <DialogTrigger>
            <Button>Record acceptance</Button>
            <Dialog title="Record acceptance?" role="alertdialog">
              {({ close }) => (
                <>
                  <p>
                    This changes {quote.client.name}'s Service Plan to{" "}
                    {planName(quote.plan!)} from{" "}
                    {formatDateTime(quote.proposedStartsAt!)}, cancelling its
                    booked Jobs from then on. Nothing is charged. Only do this
                    if they've told you they accept.
                  </p>
                  {action.problem && (
                    <Notice tone="danger">{action.problem}</Notice>
                  )}
                  <Actions>
                    <Button variant="secondary" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      isPending={action.pending === "accept"}
                      onPress={() => void accept(close)}
                    >
                      Change the plan
                    </Button>
                  </Actions>
                </>
              )}
            </Dialog>
          </DialogTrigger>
        </Actions>
      </Card>
    );
  }

  if (!quote.paymentMethod) {
    return (
      <Card
        title="Record acceptance"
        description="If the Client accepts by phone or in person."
      >
        <Notice>
          {quote.client.name} hasn't saved a Payment Method yet. We never take
          card details for them: email them a link to add one, then record their
          acceptance here.
        </Notice>
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>{linkButton}</Actions>
      </Card>
    );
  }

  return (
    <Card
      title="Record acceptance"
      description="If the Client accepts by phone or in person."
    >
      {!quote.plan && (
        <RadioGroup
          label="Clean Type they chose"
          value={cleanType}
          onChange={(value) => setCleanType(value as CleanType)}
        >
          {quote.options.map((option) => (
            <Radio
              key={option.cleanType}
              value={option.cleanType}
              isDisabled={!quote.bookable.includes(option.cleanType)}
              description={
                quote.bookable.includes(option.cleanType)
                  ? `${formatMoney(option.totalCents)}, Deposit ${formatMoney(option.depositCents)}`
                  : "No longer fits: its time has filled up"
              }
            >
              {cleanTypeLabel[option.cleanType]}
            </Radio>
          ))}
        </RadioGroup>
      )}
      <p className="text-sm text-fg-muted">
        Charged to their {quote.paymentMethod.label}, saved{" "}
        {formatDateTime(quote.paymentMethod.savedAt)}.
      </p>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        {linkButton}
        <DialogTrigger>
          <Button>Record acceptance</Button>
          <Dialog title="Record acceptance?" role="alertdialog">
            {({ close }) => (
              <>
                {quote.plan ? (
                  <p>
                    This charges the {formatMoney(depositCents)} Deposit to{" "}
                    {quote.client.name}'s {quote.paymentMethod!.label}, held for
                    the life of the plan, and starts their Service Plan,{" "}
                    {planName(quote.plan)}, with its first clean on{" "}
                    {formatDateTime(quote.proposedStartsAt!)}. Only do this if
                    they've told you they accept.
                  </p>
                ) : (
                  <p>
                    This charges the {formatMoney(chosen.depositCents)} Deposit
                    to {quote.client.name}'s {quote.paymentMethod!.label} and
                    books their {cleanTypeLabel[cleanType]} for{" "}
                    {formatDateTime(quote.proposedStartsAt!)}. Only do this if
                    they've told you they accept.
                  </p>
                )}
                {action.problem && (
                  <Notice tone="danger">{action.problem}</Notice>
                )}
                <Actions>
                  <Button variant="secondary" onPress={close}>
                    Cancel
                  </Button>
                  <Button
                    isPending={action.pending === "accept"}
                    onPress={() => void accept(close)}
                  >
                    Charge and book
                  </Button>
                </Actions>
              </>
            )}
          </Dialog>
        </DialogTrigger>
      </Actions>
    </Card>
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
    <Notice>
      Overridden to {formatMoney(option.overrideCents)} before tax from the
      Suggested {formatMoney(option.suggested.priceCents)}:{" "}
      {option.overrideReason}
    </Notice>
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
  cleanType: CleanType;
  crewSize: number;
  override: Override;
};

type PlanFields = Omit<ServicePlanInput, "days"> & { days: DayFields[] };

type Fields = {
  addOns: string[];
  crewSize: number;
  depositPercent: number;
  validityDays: number;
  date: CalendarDate | null;
  time: Time | null;
  overrides: Record<CleanType, Override>;
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
  const override = (cleanType: CleanType) =>
    overrideOf(
      quote.plan
        ? undefined
        : quote.options.find((o) => o.cleanType === cleanType),
    );
  return {
    addOns: quote.addOns.map((a) => a.key),
    crewSize: quote.crewSize,
    depositPercent: quote.depositPercent,
    validityDays: quote.validityDays,
    plan: quote.plan && {
      recurrence: quote.plan.recurrence,
      discountPercent: quote.plan.discountPercent,
      condition: quote.plan.condition,
      days: quote.plan.days.map((day, i) => ({
        key: nextKey(),
        date: day.startsAt ? parseDate(dayOfInstant(day.startsAt)) : null,
        time: day.startsAt ? parseTime(timeOfDay(day.startsAt)) : null,
        cleanType: day.cleanType,
        crewSize: day.crewSize,
        override: overrideOf(quote.options[i]),
      })),
    },
    date: quote.proposedStart && parseDate(quote.proposedStart.date),
    time: quote.proposedStart && parseTime(quote.proposedStart.time),
    overrides: { deep: override("deep"), standard: override("standard") },
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
          cleanType: day.cleanType,
          crewSize: day.crewSize,
          override: priced(day.override),
        })),
      },
    };
  }
  return {
    ...terms,
    crewSize: fields.crewSize,
    proposedStart: startOf(fields.date, fields.time),
    overrides: {
      deep: priced(fields.overrides.deep),
      standard: priced(fields.overrides.standard),
    },
  };
};

const dollars = { style: "currency", currency: "USD" } as const;

// Whether the proposed day has room for each Clean Type, from its free
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
  `the ${cleanTypeLabel[o.cleanType]} (${formatHours(o.labourHours)})`;

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
// home's own Condition is left as it is). Each weekday's Clean Type is chosen
// from its price cards. A plan on several weekdays comes round every week.
function PlanTerms({
  plan,
  onChange,
}: {
  plan: PlanFields;
  onChange: (change: Partial<Omit<ServicePlanInput, "days">>) => void;
}) {
  const several = plan.days.length > 1;
  return (
    <Card title="Plan">
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
    </Card>
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
      <p className="text-sm text-fg-muted">
        Suggested Price {formatMoney(option.suggested.priceCents)} before tax,
        for {option.suggested.labourHours} Labour Hours.
      </p>
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
    .map((o) => `${cleanTypeLabel[o.cleanType]} ${formatMoney(o.totalCents)}`)
    .join(" · ");
};

/**
 * A Draft, saved and priced again by the server a moment after each change,
 * so the prices always follow what's on screen; a bar at the bottom keeps
 * them in view wherever the change was made. On a Service Plan Quote, the
 * plan's Clean Type is chosen from its price cards.
 */
function DraftEditor({ quote: loaded }: { quote: ShownQuote }) {
  const router = useRouter();
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
  const setOverride = (cleanType: CleanType, change: Partial<Override>) =>
    update(({ overrides }) => ({
      overrides: {
        ...overrides,
        [cleanType]: { ...overrides[cleanType], ...change },
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
      : (Object.keys(f.overrides) as CleanType[]).some(
          (t) => f.overrides[t].on && !f.overrides[t].reason.trim(),
        );

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
      await router.invalidate();
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

  return (
    <Form
      validationErrors={fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void saveNow();
      }}
    >
      {failure && <Notice tone="danger">{failure}</Notice>}

      <section
        aria-labelledby="prices-title"
        aria-busy={stale}
        className="flex flex-col gap-4"
      >
        <Heading level={2} id="prices-title">
          Prices
        </Heading>
        <div
          className={`flex flex-col gap-4 transition-opacity ${stale ? "opacity-60" : ""}`}
        >
          {plan ? (
            <>
              {plan.days.map((day, i) => (
                <PlanDayFields
                  key={day.key}
                  index={i}
                  day={day}
                  plan={plan}
                  // as last saved, at the same place
                  option={quote.options[i]}
                  choices={quote.planChoices?.[i]}
                  onChange={(change) => setDay(day.key, change)}
                  onRemove={
                    plan.days.length > 1
                      ? () =>
                          setDays((days) =>
                            days.filter((d) => d.key !== day.key),
                          )
                      : undefined
                  }
                />
              ))}
              <Button
                variant="secondary"
                className="self-start"
                isDisabled={plan.days.length >= 7}
                onPress={() => setDays((days) => [...days, anotherDay(days)])}
              >
                Add a weekday
              </Button>
              {quote.plan && (
                <Card
                  title={quote.plan.days.length > 1 ? "Each week" : "Deposit"}
                  headingLevel={3}
                >
                  <PlanTotals
                    plan={quote.plan}
                    depositPercent={quote.depositPercent}
                    change={quote.changesPlan}
                  />
                </Card>
              )}
            </>
          ) : (
            <OfferCards quote={quote}>
              {(option) => (
                <OverrideFields
                  option={option}
                  override={fields.overrides[option.cleanType]}
                  label={cleanTypeLabel[option.cleanType]}
                  name={`overrides.${option.cleanType}`}
                  onChange={(change) => setOverride(option.cleanType, change)}
                />
              )}
            </OfferCards>
          )}
        </div>
        <p className="text-sm text-fg-muted">
          Prices are worked out again from the current Price List (version{" "}
          {quote.priceListVersion}) and the home's details as you make changes.
          Sending fixes them.
        </p>
      </section>

      {plan && (
        <PlanTerms plan={plan} onChange={(change) => setPlan(() => change)} />
      )}
      {quote.firstClean && <FirstCleanCard firstClean={quote.firstClean} />}

      <Card
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
      </Card>

      <Card title="Terms">
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
      </Card>

      {/* a plan's weekdays each have their own, above */}
      {!plan && (
        <Card
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
        </Card>
      )}

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
    cleanType: last.cleanType,
    crewSize: last.crewSize,
    override: { on: false, price: 0, reason: "" },
  };
};

/**
 * One weekday of a Service Plan Draft: its first clean's day and time,
 * picked from the Schedule too, which every later one there repeats, and
 * its crew; its Clean Type, chosen from its price cards; and its own
 * override. `option` and `choices` are its prices as last saved, while
 * there are any.
 */
function PlanDayFields({
  index,
  day,
  plan,
  option,
  choices,
  onChange,
  onRemove,
}: {
  index: number;
  day: DayFields;
  plan: PlanFields;
  option: OfficeQuoteOption | undefined;
  choices: PlanChoice[] | undefined;
  onChange: (change: Partial<DayFields>) => void;
  // none while it's the plan's only weekday
  onRemove: (() => void) | undefined;
}) {
  const headingId = useId();
  const name = `plan.days.${index}`;
  const time = day.time?.toString().slice(0, 5);
  const chosen = choices?.find((c) => c.option.cleanType === day.cleanType);
  const one = plan.days.length === 1;
  const title = day.date
    ? `${weekdayOf(day.date.toString())}s`
    : `Weekday ${index + 1}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={3} id={headingId}>
          {title}
        </Heading>
        {onRemove && (
          <Button variant="secondary" onPress={onRemove}>
            Remove {title}
          </Button>
        )}
      </div>
      <Card
        title="Time and crew"
        headingLevel={4}
        description={
          one
            ? `Its first clean, New York time. Then ${recurrenceLabel[plan.recurrence].toLowerCase()} on the same weekday. The Quote Expires at the plan's first clean if it isn't accepted first.`
            : "Its first clean, New York time. Then every week on the same weekday."
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
          hoursOnSite={chosen?.option.hoursOnSite ?? option?.hoursOnSite ?? 0}
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
      </Card>
      {choices && (
        <RadioGroup
          label="Clean Type"
          description={
            one
              ? "Choose the one the plan is for. The Client is offered only that."
              : "Choose the one for this weekday. The Client is offered only that."
          }
          layout="cards"
          value={day.cleanType}
          onChange={(value) => onChange({ cleanType: value as CleanType })}
        >
          {choices.map((choice) => (
            <RadioCard
              key={choice.option.cleanType}
              value={choice.option.cleanType}
              title={
                // on one weekday, how often too
                one
                  ? `${cleanTypeLabel[choice.option.cleanType]}, ${recurrenceLabel[plan.recurrence].toLowerCase()}`
                  : cleanTypeLabel[choice.option.cleanType]
              }
              badge={<PlanSaving day={choice.day} />}
            >
              <PlanFigures
                option={choice.option}
                day={choice.day}
                discountPercent={plan.discountPercent}
              />
            </RadioCard>
          ))}
        </RadioGroup>
      )}
      {chosen && (
        <Card
          title={
            one
              ? `${cleanTypeLabel[day.cleanType]} price`
              : `${title}: ${cleanTypeLabel[day.cleanType]} price`
          }
          headingLevel={4}
          description="The Plan Discount comes off the one-off price, overridden or not."
        >
          <OverrideFields
            option={chosen.option}
            override={day.override}
            label="one-off"
            name={`${name}.override`}
            onChange={(change) =>
              onChange({ override: { ...day.override, ...change } })
            }
          />
        </Card>
      )}
    </section>
  );
}

// What the home's First Clean found, to price the plan by: the Condition
// its Cleaner reported, and any Adjustments
function FirstCleanCard({ firstClean }: { firstClean: FirstCleanFindings }) {
  const { job } = firstClean;
  return (
    <Card
      title="First Clean"
      description={`${cleanTypeLabel[job.cleanType]} on ${formatDateTime(job.startsAt)}, Completed ${formatDate(firstClean.completedAt)}`}
      actions={
        <Link
          href={linkTo({
            to: "/office/jobs/$jobId",
            params: { jobId: job.id },
          })}
        >
          See the Job
        </Link>
      }
    >
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
  );
}
