import type { PropertyView } from "@empire-cleaning/models";
import type { Property } from "./properties.schema.ts";

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
