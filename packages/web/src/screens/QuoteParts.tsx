import type { ReactNode } from "react";
import type {
  PlanChange,
  QuoteAddOn,
  QuoteOption,
  QuoteStatus,
  ServicePlanTerms,
} from "@empire-cleaning/models";
import { Card, StatusBadge } from "@empire-cleaning/ui";
import {
  cleanTypeLabel,
  formatHours,
  formatMoney,
  quoteStatusLabel,
  quoteStatusTone,
  recurrenceLabel,
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
      title={cleanTypeLabel[option.cleanType]}
      headingLevel={3}
      actions={
        option.recommended && (
          <StatusBadge tone="success">Recommended</StatusBadge>
        )
      }
    >
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
      {children}
    </Card>
  );
}

// A Service Plan Quote's offer: each clean's price, and the saving against
// the same clean as a one-off Job
export function PlanCard({
  option,
  plan,
  crewSize,
  depositPercent,
  change,
  children,
}: {
  option: QuoteOption;
  plan: ServicePlanTerms;
  crewSize: number;
  depositPercent: number;
  // when it changes the home's plan, whose Deposit carries over
  change?: PlanChange | null;
  // anything more, e.g. the Office's override
  children?: ReactNode;
}) {
  return (
    <Card
      title={planTitle(option, plan)}
      headingLevel={3}
      actions={<PlanSaving plan={plan} />}
    >
      <PlanFigures
        option={option}
        plan={plan}
        crewSize={crewSize}
        depositPercent={depositPercent}
        change={change}
      />
      {children}
    </Card>
  );
}

// "Standard Clean, every 2 weeks"
export const planTitle = (option: QuoteOption, plan: ServicePlanTerms) =>
  `${cleanTypeLabel[option.cleanType]}, ${recurrenceLabel[plan.recurrence].toLowerCase()}`;

export function PlanSaving({ plan }: { plan: ServicePlanTerms }) {
  return (
    <StatusBadge tone="success">
      Save {formatMoney(plan.savingCents)} a clean
    </StatusBadge>
  );
}

// a plan clean's price, against the same clean as a one-off Job
export function PlanFigures({
  option,
  plan,
  crewSize,
  depositPercent,
  change,
}: {
  option: QuoteOption;
  plan: ServicePlanTerms;
  crewSize: number;
  depositPercent: number;
  change?: PlanChange | null;
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
          {formatMoney(plan.oneOffTotalCents)}
        </dd>
        <dt className="text-fg-muted">
          Plan Discount ({plan.discountPercent}%)
        </dt>
        <dd className="text-right tabular-nums">
          −{formatMoney(plan.savingCents)}
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
          Time on site, with a crew of {crewSize}
        </dt>
        <dd className="text-right tabular-nums">
          {formatHours(option.hoursOnSite)}
        </dd>
        <dt className="text-fg-muted">
          {change
            ? "Deposit, carried over from the plan"
            : `Deposit (${depositPercent}%), held while the plan runs`}
        </dt>
        <dd className="text-right tabular-nums">
          {formatMoney(change ? change.depositCents : option.depositCents)}
        </dd>
      </dl>
    </>
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
