import {
  boolean,
  index,
  integer,
  numeric,
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
// change underneath it). The current one is the latest. Money is in cents,
// before tax.
export const priceLists = pgTable("price_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: integer("version").generatedAlwaysAsIdentity().notNull().unique(),
  // the starting figures, until Office Staff save their own
  placeholder: boolean("placeholder").notNull().default(false),

  hourlyRateCents: integer("hourly_rate_cents").notNull(),
  minimumChargeCents: integer("minimum_charge_cents").notNull(),

  baseHours: decimal("base_hours"),
  bedroomHours: decimal("bedroom_hours"),
  bathroomHours: decimal("bathroom_hours"),
  extraStoreyHours: decimal("extra_storey_hours"),
  petHours: decimal("pet_hours"),

  conditionLight: decimal("condition_light"),
  conditionModerate: decimal("condition_moderate"),
  conditionHeavy: decimal("condition_heavy"),
  deepCleanMultiplier: decimal("deep_clean_multiplier"),

  depositPercent: integer("deposit_percent").notNull(),
  planDiscountPercent: integer("plan_discount_percent").notNull(),
  quoteValidityDays: integer("quote_validity_days").notNull(),
  defaultCrewSize: integer("default_crew_size").notNull(),

  taxOneOffPercent: decimal("tax_one_off_percent", 6, 3),
  taxServicePlanPercent: decimal("tax_service_plan_percent", 6, 3),
  taxFeePercent: decimal("tax_fee_percent", 6, 3),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => accounts.id, {
    onDelete: "set null",
  }),
});

// An Add-on in one version of the Price List. Its key is the same in every
// version, so a Quote Request that chose it keeps meaning the same thing after
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
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull(),
  },
  (t) => [
    unique("price_list_add_ons_version_key").on(t.priceListId, t.key),
    index("price_list_add_ons_price_list_id_idx").on(t.priceListId),
  ],
);

export type PriceListRow = typeof priceLists.$inferSelect;
export type PriceListAddOnRow = typeof priceListAddOns.$inferSelect;
