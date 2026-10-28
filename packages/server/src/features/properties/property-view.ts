import type { PriceList, PropertyView } from "@empire-cleaning/models";
import type { Property } from "./properties.schema.ts";

// "41-12 Austin St, 4B, 11375", as emails write it
export const addressOf = (p: {
  street: string;
  unit?: string | null;
  postcode: string;
}) => [p.street, p.unit, p.postcode].filter(Boolean).join(", ");

// a Premises Type's name, from the Price List (retired ones keep theirs)
export const premisesTypeName = (list: PriceList, key: string) =>
  list.premisesTypes.find((t) => t.key === key)?.name ?? "Premises";

// the database guarantees each kind's details (properties_kind_details), a
// home's rooms all known or none; business premises name their Premises
// Type from the Price List
export const toPropertyView = (p: Property, list: PriceList): PropertyView => {
  const base = {
    id: p.id,
    street: p.street,
    unit: p.unit,
    postcode: p.postcode,
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
