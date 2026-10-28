import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "../auth/auth.schema.ts";
import { offeredFor } from "../price-list/price-list.schema.ts";

// how a Service is priced (ADR-0018): from a home's rooms, or by area
export const pricingMethod = pgEnum("pricing_method", ["rooms", "area"]);

// small decimals, read back as numbers; null where the method doesn't use one
const decimal = (name: string, precision = 6, scale = 2) =>
  numeric(name, { precision, scale, mode: "number" });

// What Empire Cleaning sells (ADR-0018). Every save is a new row with the
// same key, never an edit, so a Revision can point at the exact version it
// priced with; a Service's current version is its latest. Retiring one is a
// version too, so nothing that used it stops pricing. Money is in cents,
// before tax.
export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: uuid("key").notNull(),
    version: integer("version").generatedAlwaysAsIdentity().notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    offeredFor: offeredFor("offered_for").notNull(),
    method: pricingMethod("method").notNull(),
    multiplier: decimal("multiplier"),
    hoursPerThousandSqFt: decimal("hours_per_thousand_sq_ft"),
    hourlyRateCents: integer("hourly_rate_cents").notNull(),
    minimumChargeCents: integer("minimum_charge_cents").notNull(),
    taxOneOffPercent: decimal("tax_one_off_percent", 6, 3).notNull(),
    taxPlanPercent: decimal("tax_plan_percent", 6, 3),
    conditionApplies: boolean("condition_applies").notNull(),
    canRecur: boolean("can_recur").notNull(),
    needsSiteVisit: boolean("needs_site_visit").notNull(),
    firstVisitServiceKey: uuid("first_visit_service_key"),
    active: boolean("active").notNull().default(true),
    // where it sits in the list, kept from its first version
    position: integer("position").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("services_key_idx").on(t.key)],
);

export type ServiceRow = typeof services.$inferSelect;
