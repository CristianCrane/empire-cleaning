import { FileText } from "lucide-react";
import type { PriceBreakdown } from "@empire-cleaning/models";
import { IconTile } from "@empire-cleaning/ui";
import { formatHours, formatMoney } from "../format.ts";

// About 1 h 38 min, shared by the Crew
const onSite = (labourHours: number, crew: number) => {
  const minutes = Math.round((labourHours / crew) * 60);
  const hours = Math.floor(minutes / 60);
  return [hours && `${hours} h`, minutes % 60 && `${minutes % 60} min`]
    .filter(Boolean)
    .join(" ");
};

// A Suggested Price read as a Quote: its total, what it's for and how long
// it takes on site, then each line of how it's worked out. With `was`, the
// value another working-out came to stands struck through beside each line
// that differs. Shown on a Service's page and on New Quote. (UX pass, #96)
export function WorkedOutQuote({
  now,
  was,
  place,
  condition,
  crewSize,
  banner,
}: {
  now: PriceBreakdown;
  was?: PriceBreakdown | null;
  // what it's priced for: "A 2-bedroom, 1½-bathroom home"
  place: string;
  // where Condition multiplies the hours
  condition: string | null;
  crewSize: number;
  // above the total, said aloud with it as it changes
  banner?: string;
}) {
  // the parts that add to the hours, here or before
  const parts = now.homeHours.filter(
    (part, i) => part.hours > 0 || (was?.homeHours[i]?.hours ?? 0) > 0,
  );

  return (
    <>
      <div aria-live="polite" className="flex flex-col gap-4">
        {banner && (
          <p className="rounded-md bg-info-subtle p-3 text-sm font-semibold text-info-strong">
            {banner}
          </p>
        )}
        <div className="flex items-start gap-3">
          <IconTile icon={FileText} />
          <div className="flex min-w-0 flex-col">
            <span className="text-sm text-fg-muted">{now.serviceName}</span>
            <span className="text-2xl font-semibold tabular-nums text-fg">
              {formatMoney(now.totalCents)}
            </span>
            <span className="text-sm text-fg-muted">
              {place}
              {condition ? `, in ${condition} Condition` : ""}
            </span>
            <span className="text-sm text-fg-muted">
              About {onSite(now.labourHours, crewSize)} on site for {crewSize}{" "}
              {crewSize === 1 ? "Cleaner" : "Cleaners"}
            </span>
          </div>
        </div>
      </div>

      {/* how it's worked out */}
      <dl className="flex flex-col gap-1 border-t border-border pt-4 text-sm">
        {parts.map((part) => (
          <Line
            key={part.label}
            label={part.label}
            value={formatHours(part.hours)}
            was={was && hoursOf(was, part.label, now)}
          />
        ))}
        {condition && (
          <Line
            label={`× ${condition} Condition (${now.conditionMultiplier})`}
            value=""
          />
        )}
        {now.addOns.map((addOn) => (
          <Line
            key={addOn.key}
            label={`+ ${addOn.name}${addOn.taxExempt ? " (tax-exempt)" : ""}`}
            value={formatHours(addOn.hours)}
          />
        ))}
        <Line
          label="Labour Hours, up to the quarter-hour"
          value={formatHours(now.labourHours)}
          was={was && formatHours(was.labourHours)}
          strong
        />
        <Line
          label={`× ${formatMoney(now.hourlyRateCents)} an hour, to the dollar`}
          value={formatMoney(now.workedOutCents)}
          was={was && formatMoney(was.workedOutCents)}
        />
        {(now.minimumApplied || was?.minimumApplied) && (
          <Line
            label={`At least the Minimum Charge (${formatMoney(now.minimumChargeCents)})`}
            value={formatMoney(now.priceCents)}
            was={was && formatMoney(was.priceCents)}
          />
        )}
        <Line
          label={`Sales tax (${now.taxPercent}%)`}
          value={formatMoney(now.taxCents)}
          was={was && formatMoney(was.taxCents)}
        />
        <div className="mt-2 flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold text-fg">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(now.totalCents)}</dd>
        </div>
      </dl>
    </>
  );
}

// a part's hours as the other working-out had them, by its place in the list
const hoursOf = (was: PriceBreakdown, label: string, now: PriceBreakdown) => {
  const i = now.homeHours.findIndex((part) => part.label === label);
  const part = was.homeHours[i];
  return part ? formatHours(part.hours) : null;
};

function Line({
  label,
  value,
  was,
  strong = false,
}: {
  label: string;
  value: string;
  // the other working-out's value: struck through beside it where it differs
  was?: string | null;
  strong?: boolean;
}) {
  const differs = was != null && was !== value;
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? "font-semibold text-fg" : "text-fg-muted"}>
        {label}
      </dt>
      <dd
        className={`flex shrink-0 gap-2 tabular-nums text-fg ${strong ? "font-semibold" : ""}`}
      >
        {differs && (
          <s className="text-fg-muted">
            <span className="sr-only">was </span>
            {was}
          </s>
        )}
        <span className={differs ? "font-semibold text-primary" : ""}>
          {value}
        </span>
      </dd>
    </div>
  );
}
