import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { quotes } from "../quotes/quotes.schema.ts";
import { staff } from "../staff/staff.schema.ts";

// booked, then Done once its findings are recorded, or Cancelled
export const siteVisitStatus = pgEnum("site_visit_status", [
  "booked",
  "done",
  "cancelled",
]);

// A free visit by one Staff member to see a Property for a Quote, before its
// first Revision is Sent (ADR-0015, ADR-0017); its findings go on the
// Property. It's not a Job: no Deposit, Charges or Assignments.
// Office Staff book it for a named Staff member, with no Offer or Confirm;
// it ends Done when its findings are recorded on the Property, or
// Cancelled. Findings recorded without a visit, for premises the Office
// knew, are a Done one with no time or visitor.
export const siteVisits = pgTable(
  "site_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    // the Quote it's for; none on findings recorded without a visit
    quoteId: uuid("quote_id").references(() => quotes.id, {
      onDelete: "cascade",
    }),
    status: siteVisitStatus("status").notNull().default("booked"),
    // who visits, when, and for how long
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "restrict",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    minutes: integer("minutes").notNull().default(30),
    // by the Clock, and by whom
    bookedAt: timestamp("booked_at", { withTimezone: true }).notNull(),
    bookedBy: uuid("booked_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    recordedBy: uuid("recorded_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    // only findings recorded without a visit have no time or visitor
    check(
      "site_visits_visited",
      sql`${t.status} = 'done' or (${t.staffId} is not null and ${t.startsAt} is not null)`,
    ),
    index("site_visits_starts_at_idx").on(t.startsAt),
    index("site_visits_property_id_idx").on(t.propertyId),
    index("site_visits_quote_id_idx").on(t.quoteId),
    // one booked at a time per Property
    uniqueIndex("site_visits_one_booked_per_property")
      .on(t.propertyId)
      .where(sql`${t.status} = 'booked'`),
  ],
);

export type SiteVisit = typeof siteVisits.$inferSelect;
