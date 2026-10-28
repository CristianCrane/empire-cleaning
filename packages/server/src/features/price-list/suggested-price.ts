import type {
  Condition,
  PriceBreakdown,
  PriceList,
  RoomHours,
  Service,
} from "@empire-cleaning/models";

// The Suggested Price (#4, #72, ADR-0018), as the glossary defines it, for
// one Service:
//
//   priced from a home's rooms: base + bedrooms + bathrooms + extra floors
//                  + pets, at the Service's hours for each
//   priced by area: the area / 1,000 x the Service's hours per 1,000 sq ft,
//                  x the Premises Type for business premises, where
//                  Condition applies
//   Labour Hours = those hours x Condition (where the Service says it
//                  applies), plus each Add-on's own hours, rounded UP to the
//                  quarter-hour
//   Suggested Price = Labour Hours x the Service's hourly rate, to the whole
//                  dollar, never below its Minimum Charge; all before tax
//   tax = the Service's one-off rate on the price, less any tax-exempt
//         Add-ons' share of it; the Client sees price + tax
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

// what is priced: a home by its rooms, or business premises by their
// Premises Type, and for a Service priced by area, the area it's priced on
// (ADR-0018), which has no hours until it's known
export type Priced = (
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
    }
) & { area: number | null };

// a Property row as priced, on an area (its floor area unless said);
// the database guarantees each kind's details
export const pricedOf = (
  p: {
    kind: "residential" | "commercial";
    bedrooms: number | null;
    bathrooms: number | null;
    storeys: number | null;
    pets: boolean | null;
    premisesTypeKey: string | null;
    floorArea: number | null;
  },
  area = p.floorArea,
): Priced =>
  p.kind === "commercial"
    ? { kind: "commercial", premisesTypeKey: p.premisesTypeKey!, area }
    : {
        kind: "residential",
        bedrooms: p.bedrooms!,
        bathrooms: p.bathrooms!,
        storeys: p.storeys!,
        pets: p.pets!,
        area,
      };

const sqFt = new Intl.NumberFormat("en-US");

const homeParts = (
  hours: RoomHours,
  home: Extract<Priced, { kind: "residential" }>,
) => {
  const extraStoreys = Math.max(0, home.storeys - 1);
  return [
    {
      label: "Kitchen, living areas and entry",
      units: hoursUnits(hours.baseHours),
    },
    {
      label: `Bedrooms (${home.bedrooms} × ${hours.bedroomHours} h)`,
      units: home.bedrooms * hoursUnits(hours.bedroomHours),
    },
    {
      label: `Bathrooms (${home.bathrooms} × ${hours.bathroomHours} h)`,
      // bathrooms come in halves, so scale before dividing
      units: (home.bathrooms * 2 * hoursUnits(hours.bathroomHours)) / 2,
    },
    {
      label: `Extra floors (${extraStoreys} × ${hours.extraStoreyHours} h)`,
      units: extraStoreys * hoursUnits(hours.extraStoreyHours),
    },
    {
      label: "Pets",
      units: home.pets ? hoursUnits(hours.petHours) : 0,
    },
  ];
};

// a Service priced by area. The Premises Type makes business premises
// quicker or slower to clean, so it counts only where Condition does; a
// home has none.
const areaParts = (list: PriceList, service: Service, property: Priced) => {
  const perThousand = service.hoursPerThousandSqFt!;
  const typeKey =
    property.kind === "commercial" && service.conditionApplies
      ? property.premisesTypeKey
      : null;
  // a retired Premises Type is still on the list, so it still prices
  const type = typeKey
    ? list.premisesTypes.find((t) => t.key === typeKey)
    : null;
  if (type === undefined) throw new Error(`no Premises Type ${typeKey}`);
  if (property.area === null) {
    return [
      {
        label: `Area not recorded yet${type ? ` (${type.name})` : ""}`,
        units: 0,
      },
    ];
  }
  const area = `${sqFt.format(property.area)} sq ft ÷ 1,000 × ${perThousand} h`;
  return [
    {
      // an office is the measure, so its multiplier of 1 goes unsaid
      label: type
        ? `${type.name}: ${area}${type.multiplier === 1 ? "" : ` × ${type.multiplier}`}`
        : area,
      // the area is whole sq ft; to the nearest unit (1e-4 h)
      units: Math.round(
        (property.area *
          hoursUnits(perThousand) *
          (type ? multiplierUnits(type.multiplier) : MULTIPLIER)) /
          (1000 * MULTIPLIER),
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
  service: Service,
  property: Priced,
  // none recorded yet (business premises before a Site Visit): moderate
  condition: Condition | null,
  addOns: ChosenAddOn[],
): PriceBreakdown => {
  if (service.method === "rooms" && property.kind !== "residential") {
    throw new Error(`${service.name} is priced from a home's rooms`);
  }
  const parts =
    service.method === "area"
      ? areaParts(list, service, property)
      : homeParts(
          service.roomHours!,
          property as Extract<Priced, { kind: "residential" }>,
        );
  const { hourlyRateCents, minimumChargeCents } = service;
  const taxPercent = service.taxOneOffPercent;
  const homeUnits = parts.reduce((sum, part) => sum + part.units, 0);

  const conditionUnits = service.conditionApplies
    ? multiplierUnits(conditionMultiplier(list, condition ?? "moderate"))
    : MULTIPLIER;
  // Add-on hours are added after Condition, never multiplied by it
  const addOnUnits = addOns.reduce(
    (sum, addOn) => sum + hoursUnits(addOn.hours) * MULTIPLIER * MULTIPLIER,
    0,
  );
  const totalUnits = homeUnits * conditionUnits * MULTIPLIER + addOnUnits;

  const labourUnits = Math.ceil(totalUnits / QUARTER) * QUARTER;

  // to the whole dollar, halves up
  const dollars = Math.floor(
    (labourUnits * hourlyRateCents + 50 * SCALE) / (100 * SCALE),
  );
  const workedOutCents = dollars * 100;
  const priceCents = Math.max(workedOutCents, minimumChargeCents);

  const taxCents = taxOn(priceCents, { hourlyRateCents, taxPercent, addOns });

  return {
    serviceName: service.name,
    propertyKind: property.kind,
    area: service.method === "area" ? property.area : null,
    homeHours: parts.map(({ label, units }) => ({
      label,
      hours: units / HOURS,
    })),
    conditionMultiplier: conditionUnits / MULTIPLIER,
    addOns: addOns.map(({ key, name, hours, taxExempt }) => ({
      key,
      name,
      hours,
      taxExempt,
    })),
    labourHours: labourUnits / SCALE,
    hourlyRateCents,
    workedOutCents,
    minimumChargeCents,
    minimumApplied: workedOutCents < minimumChargeCents,
    priceCents,
    taxPercent,
    taxCents,
    totalCents: priceCents + taxCents,
  };
};
