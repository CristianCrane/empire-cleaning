import type { ReactNode } from "react";
import type {
  PlanChange,
  PlanDayTerms,
  QuoteAddOn,
  QuoteOption,
  QuoteStatus,
  ServicePlanTerms,
} from "@empire-cleaning/models";
import { Card, StatusBadge } from "@empire-cleaning/ui";
import {
  formatHours,
  formatMoney,
  planDayWhen,
  quoteStatusLabel,
  quoteStatusTone,
} from "./format.ts";

// how a Quote reads, the same for the Office and its Client: prices include
// tax, as Clients always see them

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <StatusBadge tone={quoteStatusTone[status]}>
      {quoteStatusLabel[status]}
    </StatusBadge>
  );
}

export function OptionCard({
  option,
  crewSize,
  depositPercent,
  children,
}: {
  option: QuoteOption;
  crewSize: number;
  depositPercent: number;
  // anything more, e.g. the Office's override
  children?: ReactNode;
}) {
  return (
    <Card
      title={option.serviceName}
      headingLevel={3}
      actions={
        option.recommended && (
          <StatusBadge tone="success">Recommended</StatusBadge>
        )
      }
    >
      <OptionFigures
        option={option}
        crewSize={crewSize}
        depositPercent={depositPercent}
      />
      {children}
    </Card>
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
        <dt className="text-fg-muted">Labour Hours</dt>
        <dd className="text-right tabular-nums">
          {formatHours(option.labourHours)}
        </dd>
        <dt className="text-fg-muted">
          Time on site, with a crew of {crewSize}
        </dt>
        <dd className="text-right tabular-nums">
          {formatHours(option.hoursOnSite)}
        </dd>
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
        <dt className="text-fg-muted">Plan Discount ({discountPercent}%)</dt>
        <dd className="text-right tabular-nums">
          −{formatMoney(day.savingCents)}
        </dd>
        <dt className="font-semibold">On the plan</dt>
        <dd className="text-right font-semibold tabular-nums">
          {formatMoney(option.totalCents)}
        </dd>
        <dt className="text-fg-muted">Labour Hours</dt>
        <dd className="text-right tabular-nums">
          {formatHours(option.labourHours)}
        </dd>
        <dt className="text-fg-muted">
          Time on site, with a crew of {day.crewSize}
        </dt>
        <dd className="text-right tabular-nums">
          {formatHours(option.hoursOnSite)}
        </dd>
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

export function AddOnList({ addOns }: { addOns: QuoteAddOn[] }) {
  if (addOns.length === 0) return <p className="text-fg-muted">None</p>;
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      {addOns.map((addOn) => (
        <div key={addOn.key} className="contents">
          <dt>{addOn.name}</dt>
          <dd className="text-right tabular-nums">
            {formatMoney(addOn.totalCents)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
