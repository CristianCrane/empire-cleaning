import { useState } from "react";
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
import { Card, Section, Segment, SegmentedControl } from "@empire-cleaning/ui";
import { formatMoney } from "../format.ts";
import { WorkedOutQuote } from "./WorkedOutQuote.tsx";

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
  name: input.name || "This Service",
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
              <div className="flex flex-col gap-4 border-t border-border pt-4">
                <WorkedOutQuote
                  now={now}
                  was={was}
                  place={place}
                  condition={input.conditionApplies ? condition : null}
                  crewSize={list.defaultCrewSize}
                  banner={
                    changed && was
                      ? was.totalCents === now.totalCents
                        ? "Your changes leave this Quote's price as it was"
                        : `Your changes: ${difference(now.totalCents - was.totalCents)} on this Quote`
                      : undefined
                  }
                />
              </div>
            </>
          )}
        </div>
      </Card>
    </Section>
  );
}
