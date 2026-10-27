import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { clients } from "../clients/clients.schema.ts";

export const propertyType = pgEnum("property_type", [
  "house",
  "apartment",
  "townhouse",
]);

export const propertyKind = pgEnum("property_kind", [
  "residential",
  "commercial",
]);

export const condition = pgEnum("condition", ["light", "moderate", "heavy"]);

// a physical location where cleaning happens, belonging to one Client; the
// same address is the same Property, however it was typed. A home is
// described by its rooms, business premises by their Premises Type and floor
// area (#72).
export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    kind: propertyKind("kind").notNull().default("residential"),
    street: text("street").notNull(),
    unit: text("unit"),
    postcode: text("postcode").notNull(),
    // the address, normalised (see address.ts): one address is one home per Client
    addressKey: text("address_key").notNull(),
    // price-affecting details: read-only to Clients once given. A home's:
    type: propertyType("type"),
    bedrooms: integer("bedrooms"),
    bathrooms: numeric("bathrooms", {
      precision: 3,
      scale: 1,
      mode: "number",
    }),
    storeys: integer("storeys"),
    pets: boolean("pets"),
    // business premises': a Premises Type on the Price List, by key
    premisesTypeKey: uuid("premises_type_key"),
    // optional for both: business premises may not know theirs until a
    // Site Visit
    floorArea: integer("floor_area"),
    // the latest known: stated by the Client, correctable by Staff. Business
    // premises have none until a Site Visit records it
    condition: condition("condition"),
    // maintained by the Client; shown to Staff assigned to its Jobs
    accessInstructions: text("access_instructions"),
    // the Office's own, from a Site Visit or otherwise; never shown to the
    // Client
    officeNotes: text("office_notes"),
    ...timestamps,
  },
  (t) => [
    check(
      "properties_kind_details",
      sql`(${t.kind} = 'residential' and ${t.type} is not null and ${t.bedrooms} is not null and ${t.bathrooms} is not null and ${t.storeys} is not null and ${t.pets} is not null and ${t.condition} is not null and ${t.premisesTypeKey} is null)
        or (${t.kind} = 'commercial' and ${t.premisesTypeKey} is not null and ${t.type} is null and ${t.bedrooms} is null and ${t.bathrooms} is null and ${t.storeys} is null and ${t.pets} is null)`,
    ),
    uniqueIndex("properties_client_id_address_key_idx").on(
      t.clientId,
      t.addressKey,
    ),
  ],
);

export type Property = typeof properties.$inferSelect;
