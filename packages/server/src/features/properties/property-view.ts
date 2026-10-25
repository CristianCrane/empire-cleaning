import type { PropertyView } from "@empire-cleaning/models";
import type { Property } from "./properties.schema.ts";

// "41-12 Austin St, 4B, 11375", as emails write it
export const addressOf = (p: {
  street: string;
  unit?: string | null;
  postcode: string;
}) => [p.street, p.unit, p.postcode].filter(Boolean).join(", ");

export const toPropertyView = (p: Property): PropertyView => ({
  id: p.id,
  type: p.type,
  street: p.street,
  unit: p.unit,
  postcode: p.postcode,
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  storeys: p.storeys,
  pets: p.pets,
  floorArea: p.floorArea,
  condition: p.condition,
  accessInstructions: p.accessInstructions,
});
