import { formats } from "@empire-cleaning/models";
import { FileText } from "lucide-react";
import type { PriceBreakdown } from "@empire-cleaning/models";
import { Figure, Figures, IconTile } from "@empire-cleaning/ui";
import { formatHours, screenWords, typedHours } from "../format.ts";

const { cleaners } = screenWords.en;

const { formatMoney } = formats.en;

// a working-out's lines, as a Quote's override and this both say them
export const working = {
  // the level, where it's known
  condition: (level: string | null, multiplier: number) =>
    `× ${level ? `${level.toLowerCase()} ` : ""}condition (${multiplier})`,
  addOn: (addOn: { name: string; taxExempt: boolean }) =>
    `+ ${addOn.name}${addOn.taxExempt ? " (no tax)" : ""}`,
  hours: "Cleaning hours, rounded up to the quarter-hour",
  // the home's hours, times what multiplies them (its Condition), as the
  // rows under add to them: "2.3375 h"
  homeTimes: (b: PriceBreakdown, multiplier: number) =>
    typedHours(
      b.homeHours.reduce((sum, part) => sum + part.hours, 0) * multiplier,
    ),
  rate: (cents: number, business = false) =>
    `× ${formatMoney(cents)} an hour${business ? " for a business" : ""}, to the whole dollar`,
  minimum: (cents: number) =>
    `At least the minimum price (${formatMoney(cents)})`,
};

// how long a Suggested Price's clean takes on site, for its Crew, to the
// minute as the Schedule books it: "1 h 38 min on site, with 2 cleaners"
export function OnSite({
  labourHours,
  crewSize,
}: {
  labourHours: number;
  crewSize: number;
}) {
  // none yet, e.g. a business with no floor area given
  if (labourHours <= 0) return null;
  return (
    <span className="text-sm text-fg-muted">
      {formatHours(labourHours / crewSize)} on site, with {cleaners(crewSize)}
    </span>
  );
}

// A Suggested Price read as a Quote: its total, what it's for and how long
// it takes on site, then each line of how it's worked out. With `was`, the
// value another working-out came to stands struck through beside each line
// that differs. Shown on a Service's page, as its example. (UX pass, #96)
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
              {condition ? `, in ${condition.toLowerCase()} condition` : ""}
            </span>
            <OnSite labourHours={now.labourHours} crewSize={crewSize} />
          </div>
        </div>
      </div>

      {/* how it's worked out */}
      <div className="border-t border-border pt-4">
        <Figures>
          {parts.map((part) => (
            <Figure
              key={part.label}
              label={part.label}
              value={typedHours(part.hours)}
              was={was && hoursOf(was, part.label, now)}
            />
          ))}
          {condition && (
            <Figure
              label={working.condition(condition, now.conditionMultiplier)}
              value={working.homeTimes(now, now.conditionMultiplier)}
              was={was && working.homeTimes(was, was.conditionMultiplier)}
            />
          )}
          {now.addOns.map((addOn) => (
            <Figure
              key={addOn.key}
              label={working.addOn(addOn)}
              value={typedHours(addOn.hours)}
            />
          ))}
          <Figure
            label={working.hours}
            value={typedHours(now.labourHours)}
            was={was && typedHours(was.labourHours)}
            strong
          />
          <Figure
            label={working.rate(now.hourlyRateCents)}
            value={formatMoney(now.workedOutCents)}
            was={was && formatMoney(was.workedOutCents)}
          />
          {(now.minimumApplied || was?.minimumApplied) && (
            <Figure
              label={working.minimum(now.minimumChargeCents)}
              value={formatMoney(now.priceCents)}
              was={was && formatMoney(was.priceCents)}
            />
          )}
          <Figure
            label={`Sales tax (${now.taxPercent}%)`}
            value={formatMoney(now.taxCents)}
            was={was && formatMoney(was.taxCents)}
          />
          <Figure label="Total" value={formatMoney(now.totalCents)} total />
        </Figures>
      </div>
    </>
  );
}

// a part's hours as the other working-out had them, by its place in the list
const hoursOf = (was: PriceBreakdown, label: string, now: PriceBreakdown) => {
  const i = now.homeHours.findIndex((part) => part.label === label);
  const part = was.homeHours[i];
  return part ? typedHours(part.hours) : null;
};
