import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "../auth/auth.schema.ts";

// hours, multipliers and percentages: small decimals, read back as numbers
const decimal = (name: string, precision = 6, scale = 2) =>
  numeric(name, { precision, scale, mode: "number" }).notNull();

// The Price List the Office maintains. Every save is a new row, never an edit,
// so a Quote can point at the exact version it used (and nothing it used can
// change underneath it). The current one is the latest. Each Service's own
// hours, rate, Minimum Charge and tax are on the Service (ADR-0018).
export const priceLists = pgTable("price_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: integer("version").generatedAlwaysAsIdentity().notNull().unique(),
  // the starting figures, until Office Staff save their own
  placeholder: boolean("placeholder").notNull().default(false),

  conditionLight: decimal("condition_light"),
  conditionModerate: decimal("condition_moderate"),
  conditionHeavy: decimal("condition_heavy"),

  depositPercent: integer("deposit_percent").notNull(),
  planDiscountPercent: integer("plan_discount_percent").notNull(),
  quoteValidityDays: integer("quote_validity_days").notNull(),
  defaultCrewSize: integer("default_crew_size").notNull(),

  taxFeePercent: decimal("tax_fee_percent", 6, 3),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => accounts.id, {
    onDelete: "set null",
  }),
});

// which kind of Property a Service is offered for
export const offeredFor = pgEnum("offered_for", [
  "homes",
  "businesses",
  "both",
]);

// An Add-on in one version of the Price List. Its key is the same in every
// version, so a Quote that asked for it keeps meaning the same thing after
// the Price List changes; retiring an Add-on keeps its row.
export const priceListAddOns = pgTable(
  "price_list_add_ons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    key: uuid("key").notNull(),
    name: text("name").notNull(),
    hours: decimal("hours"),
    taxExempt: boolean("tax_exempt").notNull().default(false),
    // the Services it goes with, by key (ADR-0018)
    serviceKeys: uuid("service_keys").array().notNull().default([]),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull(),
  },
  (t) => [
    unique("price_list_add_ons_version_key").on(t.priceListId, t.key),
    index("price_list_add_ons_price_list_id_idx").on(t.priceListId),
  ],
);

// A Premises Type in one version of the Price List, keyed like an Add-on:
// its key is the same in every version, and retiring it keeps its row, so a
// commercial Property of that type still prices
export const priceListPremisesTypes = pgTable(
  "price_list_premises_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    key: uuid("key").notNull(),
    name: text("name").notNull(),
    // on the hours of a Service priced by area (ADR-0018)
    multiplier: decimal("multiplier"),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull(),
  },
  (t) => [
    unique("price_list_premises_types_version_key").on(t.priceListId, t.key),
    index("price_list_premises_types_price_list_id_idx").on(t.priceListId),
  ],
);

export type PriceListRow = typeof priceLists.$inferSelect;
export type PriceListAddOnRow = typeof priceListAddOns.$inferSelect;
export type PriceListPremisesTypeRow =
  typeof priceListPremisesTypes.$inferSelect;
