import type { ReactNode } from "react";
import type {
  QuoteAddOn,
  QuoteOption,
  QuoteStatus,
} from "@empire-cleaning/models";
import { Card, StatusBadge } from "@empire-cleaning/ui";
import {
  cleanTypeLabel,
  formatHours,
  formatMoney,
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
