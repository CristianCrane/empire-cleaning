import { useState } from "react";
import { FileText } from "lucide-react";
import {
  suggestedPrice,
  type Condition,
  type HomeRooms,
  type PriceBreakdown,
  type PriceList,
  type Priced,
  type Service,
  type ServiceInput,
} from "@empire-cleaning/models";
import {
  Card,
  IconTile,
  Section,
  Segment,
  SegmentedControl,
} from "@empire-cleaning/ui";
import { formatHours, formatMoney } from "../format.ts";

type Size = "small" | "typical" | "big";

const homes: Record<Size, { name: string; rooms: HomeRooms }> = {
  small: {
    name: "A 1-bedroom apartment",
    rooms: { bedrooms: 1, bathrooms: 1, storeys: 1, pets: false },
  },
  typical: {
    name: "A 2-bedroom, 1½-bathroom home",
    rooms: { bedrooms: 2, bathrooms: 1.5, storeys: 1, pets: false },
  },
  big: {
    name: "A 4-bedroom, 3-bathroom house on 2 floors, with pets",
    rooms: { bedrooms: 4, bathrooms: 3, storeys: 2, pets: true },
  },
};
const areas: Record<Size, number> = { small: 1000, typical: 2000, big: 5000 };

// what the figures on the form price, as a Service
const serviceOf = (input: ServiceInput): Service => ({
  ...input,
  key: "example",
  id: "example",
  version: 0,
  createdAt: "",
  createdByName: null,
});

// the figures that change a price, in one order whatever the form's;
// a name or description doesn't
const priceFigures = (input: ServiceInput) =>
  JSON.stringify([
    input.offeredFor,
    input.method,
    input.roomHours && [
      input.roomHours.baseHours,
      input.roomHours.bedroomHours,
      input.roomHours.bathroomHours,
      input.roomHours.extraStoreyHours,
      input.roomHours.petHours,
    ],
    input.hoursPerThousandSqFt,
    input.conditionApplies,
    input.hourlyRateCents,
    input.minimumChargeCents,
    input.taxOneOffPercent,
  ]);

// the Suggested Price, or nothing while a figure is half-typed
const workOut = (
  list: PriceList,
  input: ServiceInput,
  priced: Priced,
  condition: Condition,
): PriceBreakdown | null => {
  const numbers = [
    input.hourlyRateCents,
    input.minimumChargeCents,
    input.taxOneOffPercent,
    ...(input.method === "rooms"
      ? Object.values(input.roomHours ?? {})
      : [input.hoursPerThousandSqFt ?? NaN]),
  ];
  if (!numbers.every(Number.isFinite)) return null;
  return suggestedPrice(list, serviceOf(input), priced, condition, []);
};

// "+$17.42", "−$3.00"
const difference = (cents: number) =>
  `${cents > 0 ? "+" : "−"}${formatMoney(Math.abs(cents))}`;

// About 1 h 38 min, shared by the Crew
const onSite = (labourHours: number, crew: number) => {
  const minutes = Math.round((labourHours / crew) * 60);
  const hours = Math.floor(minutes / 60);
  return [hours && `${hours} h`, minutes % 60 && `${minutes % 60} min`]
    .filter(Boolean)
    .join(" ");
};

// What the figures on a Service's form come to, as a Quote for an example
// place, worked out as its Suggested Price is while they're typed. Try a
// smaller or bigger place, or another Condition; with `saved`, what the
// saved figures came to stands beside each line that changed. (UX pass, #96)
export function ExampleQuote({
  input,
  saved,
  list,
}: {
  input: ServiceInput;
  // the Service's saved figures; none for a new one
  saved?: ServiceInput;
  list: PriceList;
}) {
  const [size, setSize] = useState<Size>("typical");
  const [condition, setCondition] = useState<Condition>("moderate");
  const types = list.premisesTypes.filter((t) => t.active);
  const [typeKey, setTypeKey] = useState(types[0]?.key);

  const byRooms = input.method === "rooms";
  // business premises have a type; a home priced by area doesn't
  const forBusiness = input.offeredFor !== "homes" && typeKey !== undefined;
  const type = types.find((t) => t.key === typeKey);
  const priced: Priced = byRooms
    ? { kind: "residential", rooms: homes[size].rooms, area: null }
    : forBusiness
      ? { kind: "commercial", premisesTypeKey: typeKey, area: areas[size] }
      : { kind: "residential", rooms: null, area: areas[size] };
  const now = workOut(list, input, priced, condition);
  const changed = saved && priceFigures(saved) !== priceFigures(input);
  const was =
    changed && saved.method === input.method
      ? workOut(list, saved, priced, condition)
      : null;
  const place = byRooms
    ? homes[size].name
    : `${areas[size].toLocaleString("en-US")} sq ft${forBusiness && type ? ` of ${type.name.toLowerCase()}` : ""}`;
  // the parts that add to the hours, here or before
  const parts = (now?.homeHours ?? []).filter(
    (part, i) => part.hours > 0 || (was?.homeHours[i]?.hours ?? 0) > 0,
  );

  return (
    <Section
      title="Example Quote"
      description="Worked out as a Suggested Price is, as you type. Add-ons and the Plan Discount come on top."
    >
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <SegmentedControl
              label="For"
              value={size}
              onChange={(value) => setSize(value as Size)}
            >
              <Segment value="small">
                {byRooms ? "1 bed" : "1,000 sq ft"}
              </Segment>
              <Segment value="typical">
                {byRooms ? "2 bed" : "2,000 sq ft"}
              </Segment>
              <Segment value="big">{byRooms ? "4 bed" : "5,000 sq ft"}</Segment>
            </SegmentedControl>
            {!byRooms && forBusiness && input.conditionApplies && (
              <SegmentedControl
                label="Type of premises"
                value={typeKey ?? null}
                onChange={setTypeKey}
              >
                {types.map((t) => (
                  <Segment key={t.key} value={t.key}>
                    {t.name}
                  </Segment>
                ))}
              </SegmentedControl>
            )}
            {input.conditionApplies && (
              <SegmentedControl
                label="Condition"
                value={condition}
                onChange={(value) => setCondition(value as Condition)}
              >
                <Segment value="light">Light</Segment>
                <Segment value="moderate">Moderate</Segment>
                <Segment value="heavy">Heavy</Segment>
              </SegmentedControl>
            )}
          </div>

          {now === null ? (
            <p className="border-t border-border pt-4 text-sm text-fg-muted">
              Fill in the figures to see what they come to.
            </p>
          ) : (
            <>
              {/* said aloud as it changes: what it comes to, and what the
                  changes did */}
              <div
                aria-live="polite"
                className="flex flex-col gap-4 border-t border-border pt-4"
              >
                {changed && was && (
                  <p className="rounded-md bg-info-subtle p-3 text-sm font-semibold text-info-strong">
                    {was.totalCents === now.totalCents
                      ? "Your changes leave this Quote's price as it was"
                      : `Your changes: ${difference(now.totalCents - was.totalCents)} on this Quote`}
                  </p>
                )}
                <div className="flex items-start gap-3">
                  <IconTile icon={FileText} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm text-fg-muted">
                      {input.name || "This Service"}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-fg">
                      {formatMoney(now.totalCents)}
                    </span>
                    <span className="text-sm text-fg-muted">
                      {place}
                      {input.conditionApplies
                        ? `, in ${condition} Condition`
                        : ""}
                    </span>
                    <span className="text-sm text-fg-muted">
                      About {onSite(now.labourHours, list.defaultCrewSize)} on
                      site for {list.defaultCrewSize}{" "}
                      {list.defaultCrewSize === 1 ? "Cleaner" : "Cleaners"}
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
                {input.conditionApplies && (
                  <Line
                    label={`× ${condition} Condition (${now.conditionMultiplier})`}
                    value=""
                  />
                )}
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
                  <dd className="tabular-nums">
                    {formatMoney(now.totalCents)}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </Card>
    </Section>
  );
}

// a part's hours as the saved figures had them, by its place in the list
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
  // the saved figures' value: struck through beside it where it differs
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
