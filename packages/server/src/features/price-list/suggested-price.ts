// The Suggested Price is worked out in @empire-cleaning/models, so the
// Office's Service page can show it as it's typed; here is how a Property
// row is priced
import { taxOn, type Priced } from "@empire-cleaning/models";

export {
  addOnCents,
  suggestedPrice,
  taxOn,
  type Priced,
} from "@empire-cleaning/models";

// a Property row as priced, on an area (its floor area unless said);
// the database guarantees each kind's details, a home's rooms all or none
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
        rooms:
          p.bedrooms === null
            ? null
            : {
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms!,
                storeys: p.storeys!,
                pets: p.pets!,
              },
        area,
      };

// the tax on part of a price, such as an Add-on or an Adjustment, before
// tax: none if it is tax-exempt, else the rate on all of it
export const taxOnPart = (
  priceCents: number,
  taxExempt: boolean,
  taxPercent: number,
) =>
  taxExempt
    ? 0
    : taxOn(priceCents, { hourlyRateCents: 0, taxPercent, addOns: [] });
