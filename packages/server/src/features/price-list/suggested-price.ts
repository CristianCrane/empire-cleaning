import type {
  CleanType,
  Condition,
  PriceBreakdown,
  PriceList,
} from "@empire-cleaning/models";

// The Suggested Price (#4, #72), as the glossary and spec define it:
//
//   a home's hours = base + bedrooms + bathrooms + extra floors + pets
//   business premises' hours = floor area / 1,000 x the Premises Type's hours
//   Labour Hours = those hours x Condition x Clean Type, plus each Add-on's
//                  own hours, rounded UP to the quarter-hour
//   Suggested Price = Labour Hours x the residential or commercial hourly
//                  rate, to the whole dollar, never below the Minimum
//                  Charge; all before tax
//   tax = the residential one-off or the commercial rate on the price, less
//         any tax-exempt Add-ons' share of it; the Client sees price + tax
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

// what is priced: a home by its rooms, or business premises by floor area.
// Premises with no floor area recorded yet have no hours for it.
export type Priced =
  | {
      kind: "residential";
      bedrooms: number;
      bathrooms: number;
      storeys: number;
      pets: boolean;
    }
  | {
      kind: "commercial";
      premisesTypeKey: string;
      floorArea: number | null;
    };

// a Property row as priced; the database guarantees each kind's details
export const pricedOf = (p: {
  kind: "residential" | "commercial";
  bedrooms: number | null;
  bathrooms: number | null;
  storeys: number | null;
  pets: boolean | null;
  premisesTypeKey: string | null;
  floorArea: number | null;
}): Priced =>
  p.kind === "commercial"
    ? {
        kind: "commercial",
        premisesTypeKey: p.premisesTypeKey!,
        floorArea: p.floorArea,
      }
    : {
        kind: "residential",
        bedrooms: p.bedrooms!,
        bathrooms: p.bathrooms!,
        storeys: p.storeys!,
        pets: p.pets!,
      };

// the hourly rate and tax rate for a kind of Property's one-off Jobs
export const ratesFor = (list: PriceList, kind: Priced["kind"]) =>
  kind === "commercial"
    ? {
        hourlyRateCents: list.commercialHourlyRateCents,
        taxPercent: list.taxCommercialPercent,
      }
    : {
        hourlyRateCents: list.hourlyRateCents,
        taxPercent: list.taxOneOffPercent,
      };

const sqFt = new Intl.NumberFormat("en-US");

const homeParts = (
  list: PriceList,
  home: Extract<Priced, { kind: "residential" }>,
) => {
  const extraStoreys = Math.max(0, home.storeys - 1);
  return [
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
};

const premisesParts = (
  list: PriceList,
  premises: Extract<Priced, { kind: "commercial" }>,
) => {
  // a retired Premises Type is still on the list, so it still prices
  const type = list.premisesTypes.find(
    (t) => t.key === premises.premisesTypeKey,
  );
  if (!type) throw new Error(`no Premises Type ${premises.premisesTypeKey}`);
  if (premises.floorArea === null) {
    return [{ label: `Floor area not recorded yet (${type.name})`, units: 0 }];
  }
  return [
    {
      label: `${type.name}: ${sqFt.format(premises.floorArea)} sq ft ÷ 1,000 × ${type.hoursPerThousandSqFt} h`,
      // floor area is whole sq ft; to the nearest unit (1e-4 h)
      units: Math.round(
        (premises.floorArea * hoursUnits(type.hoursPerThousandSqFt)) / 1000,
      ),
    },
  ];
};

export type ChosenAddOn = PriceList["addOns"][number];

const conditionMultiplier = (list: PriceList, condition: Condition) =>
  ({
    light: list.conditionLight,
    moderate: list.conditionModerate,
    heavy: list.conditionHeavy,
  })[condition];

// what an Add-on's hours cost at the hourly rate, to the cent, before tax
export const addOnCents = (hours: number, hourlyRateCents: number) =>
  Math.floor((hoursUnits(hours) * hourlyRateCents + HOURS / 2) / HOURS);

// the tax on a price before tax: the rate on all of it except tax-exempt
// Add-ons' share. Used for the Suggested Price and for a price overriding it.
export const taxOn = (
  priceCents: number,
  {
    hourlyRateCents,
    taxPercent,
    addOns,
  }: {
    hourlyRateCents: number;
    taxPercent: number;
    addOns: { hours: number; taxExempt: boolean }[];
  },
) => {
  const exemptUnits = addOns
    .filter((addOn) => addOn.taxExempt)
    .reduce((sum, addOn) => sum + hoursUnits(addOn.hours), 0);
  const exemptCents = Math.min(
    priceCents,
    Math.floor((exemptUnits * hourlyRateCents + HOURS / 2) / HOURS),
  );
  const thousandths = Math.round(taxPercent * 1000);
  return Math.floor(
    ((priceCents - exemptCents) * thousandths + 50_000) / 100_000,
  );
};

export const suggestedPrice = (
  list: PriceList,
  property: Priced,
  // none recorded yet (business premises before a Site Visit): moderate
  condition: Condition | null,
  cleanType: CleanType,
  addOns: ChosenAddOn[],
): PriceBreakdown => {
  const parts =
    property.kind === "commercial"
      ? premisesParts(list, property)
      : homeParts(list, property);
  const { hourlyRateCents, taxPercent } = ratesFor(list, property.kind);
  const homeUnits = parts.reduce((sum, part) => sum + part.units, 0);

  const conditionUnits = multiplierUnits(
    conditionMultiplier(list, condition ?? "moderate"),
  );
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
    (labourUnits * hourlyRateCents + 50 * SCALE) / (100 * SCALE),
  );
  const workedOutCents = dollars * 100;
  const priceCents = Math.max(workedOutCents, list.minimumChargeCents);

  const taxCents = taxOn(priceCents, { hourlyRateCents, taxPercent, addOns });

  return {
    cleanType,
    propertyKind: property.kind,
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
    hourlyRateCents,
    workedOutCents,
    minimumChargeCents: list.minimumChargeCents,
    minimumApplied: workedOutCents < list.minimumChargeCents,
    priceCents,
    taxPercent,
    taxCents,
    totalCents: priceCents + taxCents,
  };
};
