import { sql } from "drizzle-orm";
import { inLanguage } from "@empire-cleaning/models";
import type {
  Address,
  AddressParts,
  PriceList,
  PropertyView,
} from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { properties, type Property } from "./properties.schema.ts";

// the address written out whole, as emails write it (the rule: models)
export { addressOf } from "@empire-cleaning/models";

// a Property's address, as each view that shows it carries it
export const addressFields = (p: Pick<Property, AddressParts>): Address => ({
  street: p.street,
  unit: p.unit,
  city: p.city,
  postcode: p.postcode,
});

// the same, as a select's columns
export const addressColumns = {
  street: properties.street,
  unit: properties.unit,
  city: properties.city,
  postcode: properties.postcode,
};

// the address as addressOf writes it, for a search to match what's shown
export const addressSql = sql`concat_ws(', ', ${properties.street}, ${properties.unit}, ${properties.city}, ${properties.postcode})`;

// a Premises Type's name, from the Price List (which keeps every one,
// retired too), in the reply's language (ADR-0025)
const premisesTypeName = (list: PriceList, key: string) =>
  inLanguage(
    currentLanguage(),
    list.premisesTypes.find((t) => t.key === key)!,
  ).name;

// the database guarantees each kind's details (properties_kind_details), a
// home's rooms all known or none; business premises name their Premises
// Type from the Price List. For a reply only, in its language
export const toPropertyView = (p: Property, list: PriceList): PropertyView => {
  const base = {
    id: p.id,
    ...addressFields(p),
    floorArea: p.floorArea,
    condition: p.condition,
    accessInstructions: p.accessInstructions,
  };
  return p.kind === "commercial"
    ? {
        ...base,
        kind: "commercial",
        premisesType: {
          key: p.premisesTypeKey!,
          name: premisesTypeName(list, p.premisesTypeKey!),
        },
      }
    : {
        ...base,
        kind: "residential",
        type: p.type!,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        storeys: p.storeys,
        pets: p.pets,
      };
};
