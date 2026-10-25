import {
  boolean,
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

export const condition = pgEnum("condition", ["light", "moderate", "heavy"]);

// a physical location where cleaning happens, belonging to one Client; the
// same address is the same home, however it was typed
export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: propertyType("type").notNull(),
    street: text("street").notNull(),
    unit: text("unit"),
    postcode: text("postcode").notNull(),
    // the address, normalised (see address.ts): one address is one home per Client
    addressKey: text("address_key").notNull(),
    // price-affecting details: read-only to Clients once given
    bedrooms: integer("bedrooms").notNull(),
    bathrooms: numeric("bathrooms", {
      precision: 3,
      scale: 1,
      mode: "number",
    }).notNull(),
    storeys: integer("storeys").notNull(),
    pets: boolean("pets").notNull(),
    floorArea: integer("floor_area"),
    // the latest known: stated by the Client, correctable by Staff
    condition: condition("condition").notNull(),
    // maintained by the Client; shown to Staff assigned to its Jobs
    accessInstructions: text("access_instructions"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("properties_client_id_address_key_idx").on(
      t.clientId,
      t.addressKey,
    ),
  ],
);

export type Property = typeof properties.$inferSelect;
