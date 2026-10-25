import type {
  CleanType,
  Condition,
  PriceBreakdown,
  PriceList,
} from "@empire-cleaning/models";

// The Suggested Price (#4), as the glossary and spec define it:
//
//   Labour Hours = (base + bedrooms + bathrooms + extra floors + pets)
//                  x Condition x Clean Type, plus each Add-on's own hours,
//                  rounded UP to the quarter-hour
//   Suggested Price = Labour Hours x hourly rate, to the whole dollar,
//                  never below the Minimum Charge; all before tax
//   tax = the one-off Jobs rate on the price, less any tax-exempt Add-ons'
//         share of it; the Client sees price + tax
//
// All the arithmetic is in whole numbers (hours in 1e-4, multipliers in
// hundredths), so a quarter-hour boundary is never missed by floating point.

const HOURS = 10_000; // units per hour, for the Price List's hours
const MULTIPLIER = 100; // units per 1.0, for multipliers
const QUARTER = (HOURS * MULTIPLIER * MULTIPLIER) / 4; // a quarter-hour, in hours x multiplier^2 units
const SCALE = HOURS * MULTIPLIER * MULTIPLIER; // one hour, in those units

const hoursUnits = (hours: number) => Math.round(hours * HOURS);
const multiplierUnits = (multiplier: number) =>
  Math.round(multiplier * MULTIPLIER);

type Home = {
  bedrooms: number;
  bathrooms: number;
  storeys: number;
  pets: boolean;
};

export type ChosenAddOn = PriceList["addOns"][number];

const conditionMultiplier = (list: PriceList, condition: Condition) =>
  ({
    light: list.conditionLight,
    moderate: list.conditionModerate,
    heavy: list.conditionHeavy,
  })[condition];

export const suggestedPrice = (
  list: PriceList,
  home: Home,
  condition: Condition,
  cleanType: CleanType,
  addOns: ChosenAddOn[],
): PriceBreakdown => {
  const extraStoreys = Math.max(0, home.storeys - 1);
  const parts = [
    {
      label: "Kitchen, living areas and entry",
      units: hoursUnits(list.baseHours),
    },
    {
      label: `Bedrooms (${home.bedrooms} × ${list.bedroomHours} h)`,
      units: home.bedrooms * hoursUnits(list.bedroomHours),
    },
    {
      label: `Bathrooms (${home.bathrooms} × ${list.bathroomHours} h)`,
      // bathrooms come in halves, so scale before dividing
      units: (home.bathrooms * 2 * hoursUnits(list.bathroomHours)) / 2,
    },
    {
      label: `Extra floors (${extraStoreys} × ${list.extraStoreyHours} h)`,
      units: extraStoreys * hoursUnits(list.extraStoreyHours),
    },
    {
      label: "Pets",
      units: home.pets ? hoursUnits(list.petHours) : 0,
    },
  ];
  const homeUnits = parts.reduce((sum, part) => sum + part.units, 0);

  const conditionUnits = multiplierUnits(conditionMultiplier(list, condition));
  const cleanTypeUnits =
    cleanType === "deep"
      ? multiplierUnits(list.deepCleanMultiplier)
      : MULTIPLIER;
  // Add-on hours are added after the multipliers, never multiplied by them
  const addOnUnits = addOns.reduce(
    (sum, addOn) => sum + hoursUnits(addOn.hours) * MULTIPLIER * MULTIPLIER,
    0,
  );
  const totalUnits = homeUnits * conditionUnits * cleanTypeUnits + addOnUnits;

  const labourUnits = Math.ceil(totalUnits / QUARTER) * QUARTER;

  // to the whole dollar, halves up
  const dollars = Math.floor(
    (labourUnits * list.hourlyRateCents + 50 * SCALE) / (100 * SCALE),
  );
  const workedOutCents = dollars * 100;
  const priceCents = Math.max(workedOutCents, list.minimumChargeCents);

  // tax-exempt Add-ons' share of the price isn't taxed
  const exemptUnits = addOns
    .filter((addOn) => addOn.taxExempt)
    .reduce(
      (sum, addOn) => sum + hoursUnits(addOn.hours) * MULTIPLIER * MULTIPLIER,
      0,
    );
  const exemptCents = Math.min(
    priceCents,
    Math.floor((exemptUnits * list.hourlyRateCents + SCALE / 2) / SCALE),
  );
  const taxableCents = priceCents - exemptCents;
  const thousandths = Math.round(list.taxOneOffPercent * 1000);
  const taxCents = Math.floor((taxableCents * thousandths + 50_000) / 100_000);

  return {
    cleanType,
    homeHours: parts.map(({ label, units }) => ({
      label,
      hours: units / HOURS,
    })),
    conditionMultiplier: conditionUnits / MULTIPLIER,
    cleanTypeMultiplier: cleanTypeUnits / MULTIPLIER,
    addOns: addOns.map(({ key, name, hours, taxExempt }) => ({
      key,
      name,
      hours,
      taxExempt,
    })),
    labourHours: labourUnits / SCALE,
    hourlyRateCents: list.hourlyRateCents,
    workedOutCents,
    minimumChargeCents: list.minimumChargeCents,
    minimumApplied: workedOutCents < list.minimumChargeCents,
    priceCents,
    taxPercent: list.taxOneOffPercent,
    taxCents,
    totalCents: priceCents + taxCents,
  };
};
