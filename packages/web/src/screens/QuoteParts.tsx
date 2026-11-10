import type { ReactNode } from "react";
import type {
  PlanChange,
  PlanDayTerms,
  QuoteAddOn,
  QuoteAsked,
  QuoteOption,
  QuoteStatus,
  ServicePlanTerms,
} from "@empire-cleaning/models";
import { Card, StatusBadge } from "@empire-cleaning/ui";
import { formats, messages } from "@empire-cleaning/models";
import {
  cleaners,
  formatHours,
  clientQuoteStatus,
  quoteStatusLabel,
  quoteStatusTone,
  wantedCleaning,
} from "./format.ts";

const { planDayWhen, quoteEmailedTo } = messages.en;

const { formatMoney } = formats.en;

// how a Quote reads, the same for the Office and its Client: prices include
// tax, as Clients always see them

// the end of what was asked, in a dl after the reader's own rows: the
// cleaning a business wants, or a home's extras and regular visits, then
// any notes
export function AskedRows({
  asked,
  premises,
}: {
  asked: QuoteAsked;
  premises: boolean;
}) {
  return (
    <>
      {premises ? (
        <>
          <dt className="font-semibold">Cleaning wanted</dt>
          <dd>{wantedCleaning(asked)}</dd>
        </>
      ) : (
        <>
          <dt className="font-semibold">Extras</dt>
          <dd>
            {asked.addOns.length > 0
              ? asked.addOns.map((a) => a.name).join(", ")
              : "None"}
          </dd>
          <dt className="font-semibold">Regular visits</dt>
          <dd>
            {asked.wantsRegularService
              ? "Wanted after the first clean"
              : "Not asked for"}
          </dd>
        </>
      )}
      {asked.notes && (
        <>
          <dt className="font-semibold">Notes</dt>
          <dd className="whitespace-pre-line">{asked.notes}</dd>
        </>
      )}
    </>
  );
}

// an option's hours, in a dl: its cleaning hours, and how long its crew is
// there
function HoursRows({
  option,
  crewSize,
}: {
  option: QuoteOption;
  crewSize: number;
}) {
  return (
    <>
      <dt className="text-fg-muted">Cleaning hours</dt>
      <dd className="text-right tabular-nums">
        {formatHours(option.labourHours)}
      </dd>
      <dt className="text-fg-muted">On site, with {cleaners(crewSize)}</dt>
      <dd className="text-right tabular-nums">
        {formatHours(option.hoursOnSite)}
      </dd>
    </>
  );
}

// the toast once a Quote is asked for, by the Client or someone signing up
export const quoteRequested = (emailedTo: string) => ({
  tone: "success" as const,
  title: "Quote requested",
  description: quoteEmailedTo(emailedTo),
});

// a Sent or Expired Quote with a Revision being drafted
export function DraftChangesBadge() {
  return <StatusBadge tone="info">Being updated</StatusBadge>;
}

// a Quote's state as its Client reads it: QuoteStatusBadge's, in their words
export function ClientQuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { tone, label } = clientQuoteStatus[status];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <StatusBadge tone={quoteStatusTone[status]}>
      {quoteStatusLabel[status]}
    </StatusBadge>
  );
}

// a one-off clean's price, its hours and its Deposit
export function OptionFigures({
  option,
  crewSize,
  depositPercent,
}: {
  option: QuoteOption;
  crewSize: number;
  depositPercent: number;
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="font-display text-4xl font-bold tracking-wide">
          {formatMoney(option.totalCents)}
        </p>
        <p className="text-sm text-fg-muted">
          Includes {formatMoney(option.taxCents)} tax
        </p>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <HoursRows option={option} crewSize={crewSize} />
        <dt className="text-fg-muted">Deposit ({depositPercent}%)</dt>
        <dd className="text-right tabular-nums">
          {formatMoney(option.depositCents)}
        </dd>
      </dl>
    </>
  );
}

// One weekday of a Service Plan Quote: when, its clean's price, and the
// saving against the same clean as a one-off Job
export function PlanDayCard({
  option,
  day,
  discountPercent,
  children,
}: {
  option: QuoteOption;
  day: PlanDayTerms;
  discountPercent: number;
  // anything more, e.g. the Office's override
  children?: ReactNode;
}) {
  return (
    <Card
      title={planDayTitle(day)}
      headingLevel={3}
      actions={<PlanSaving day={day} />}
    >
      <PlanFigures
        option={option}
        day={day}
        discountPercent={discountPercent}
      />
      {children}
    </Card>
  );
}

// "Mondays at 9:00 AM: Standard Clean", or a Draft's weekday with no time
// yet, "Standard Clean"
export const planDayTitle = (day: PlanDayTerms) =>
  day.startsAt
    ? `${planDayWhen(day.startsAt)}: ${day.serviceName}`
    : day.serviceName;

export function PlanSaving({ day }: { day: PlanDayTerms }) {
  return (
    <StatusBadge tone="success">
      Save {formatMoney(day.savingCents)} a clean
    </StatusBadge>
  );
}

// a plan clean's price, against the same clean as a one-off Job
export function PlanFigures({
  option,
  day,
  discountPercent,
}: {
  option: QuoteOption;
  day: PlanDayTerms;
  discountPercent: number;
}) {
  return (
    <>
      <span className="flex flex-col gap-1">
        <span className="font-display text-4xl font-bold tracking-wide">
          {formatMoney(option.totalCents)}
          <span className="text-base font-normal text-fg-muted"> a clean</span>
        </span>
        <span className="text-sm text-fg-muted">
          Includes {formatMoney(option.taxCents)} tax
        </span>
      </span>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-fg-muted">As a one-off clean</dt>
        <dd className="text-right tabular-nums">
          {formatMoney(day.oneOffTotalCents)}
        </dd>
        <dt className="text-fg-muted">Plan discount ({discountPercent}%)</dt>
        <dd className="text-right tabular-nums">
          −{formatMoney(day.savingCents)}
        </dd>
        <dt className="font-semibold">On the plan</dt>
        <dd className="text-right font-semibold tabular-nums">
          {formatMoney(option.totalCents)}
        </dd>
        <HoursRows option={option} crewSize={day.crewSize} />
      </dl>
    </>
  );
}

// A Service Plan Quote as a whole: what a week of cleans costs, on several
// weekdays, and its Deposit, for one clean on each, or the plan's own when
// it changes the home's plan
export function PlanTotals({
  plan,
  depositPercent,
  change,
}: {
  plan: ServicePlanTerms;
  depositPercent: number;
  change?: PlanChange | null;
}) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      {plan.days.length > 1 && (
        <>
          <dt>A week, with a clean on each day</dt>
          <dd className="text-right font-semibold tabular-nums">
            {formatMoney(plan.roundTotalCents)}
          </dd>
        </>
      )}
      <dt>
        {change
          ? "Deposit, carried over from the plan"
          : `Deposit (${depositPercent}%${plan.days.length > 1 ? " of a clean on each day" : ""}), held while the plan runs`}
      </dt>
      <dd className="text-right tabular-nums">
        {formatMoney(change ? change.depositCents : plan.depositCents)}
      </dd>
    </dl>
  );
}

// what each Add-on adds to an option's price, tax included; nothing for an
// option with none
export function AddOnList({ addOns }: { addOns: QuoteAddOn[] }) {
  if (addOns.length === 0) return null;
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      {addOns.map((addOn) => (
        <div key={addOn.key} className="contents">
          <dt className="text-fg-muted">{addOn.name}</dt>
          <dd className="text-right tabular-nums">
            +{formatMoney(addOn.totalCents)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
