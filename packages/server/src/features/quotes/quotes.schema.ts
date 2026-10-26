import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { PriceBreakdown } from "@empire-cleaning/models";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";
import { cleanType, jobs } from "../jobs/jobs.schema.ts";
import { priceLists } from "../price-list/price-list.schema.ts";
import { condition, properties } from "../properties/properties.schema.ts";
import { quoteRequests } from "../quote-requests/quote-requests.schema.ts";

// A Sent Quote whose time is up is Expired whether or not this says so:
// "expired" is only written when a newer Quote is sent, so the
// one-Sent-Quote rule below can hold.
export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "superseded",
]);

// what a Quote offers: one Job, or a Service Plan, which a Property can only
// be offered once its First Clean is Completed
export const quoteKind = pgEnum("quote_kind", ["one_off", "service_plan"]);

// how often a Service Plan's Job comes round; always on the same weekday
export const recurrence = pgEnum("recurrence", [
  "weekly",
  "fortnightly",
  "four_weekly",
]);

// A priced offer for a Property (ADR-0011). A one-off Quote answers a Quote
// Request and offers both Clean Types (quote_options); a Service Plan Quote
// offers the one Clean Type Office Staff chose, on a recurrence, at the Plan
// Discount, and may answer a request or be offered unprompted. While a Draft
// it's priced afresh from the current Price List on every save; once Sent it
// never changes.
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    // the request it answers; always set on a one-off Quote
    quoteRequestId: uuid("quote_request_id").references(
      () => quoteRequests.id,
      { onDelete: "cascade" },
    ),
    kind: quoteKind("kind").notNull().default("one_off"),
    status: quoteStatus("status").notNull().default("draft"),
    // the version the prices were worked out from at the last save
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "restrict" }),
    crewSize: integer("crew_size").notNull(),
    depositPercent: integer("deposit_percent").notNull(),
    validityDays: integer("validity_days").notNull(),
    // the time of the (first) Job
    proposedStartsAt: timestamp("proposed_starts_at", { withTimezone: true }),
    // a Service Plan Quote's terms: how often, the Plan Discount, and the
    // Condition it's priced for (moderate unless Office Staff say otherwise,
    // whatever the Property's own); null on a one-off Quote
    recurrence: recurrence("recurrence"),
    planDiscountPercent: integer("plan_discount_percent"),
    condition: condition("condition"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    // the end of validity or the proposed time, whichever is first; set on
    // sending
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    // once Accepted: when, the Clean Type chosen, the Job it booked, and who
    // accepted (the Client, or Office Staff on their behalf)
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedCleanType: cleanType("accepted_clean_type"),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    acceptedBy: uuid("accepted_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("quotes_property_id_idx").on(t.propertyId),
    index("quotes_quote_request_id_idx").on(t.quoteRequestId),
    // at most one Sent Quote of each kind per Property, so a one-off offer
    // and a plan offer can stand side by side
    uniqueIndex("quotes_one_sent_per_property_kind")
      .on(t.propertyId, t.kind)
      .where(sql`${t.status} = 'sent'`),
    // at most one Draft per Quote Request, and one Service Plan Draft per
    // Property
    uniqueIndex("quotes_one_draft_per_request")
      .on(t.quoteRequestId)
      .where(sql`${t.status} = 'draft' and ${t.quoteRequestId} is not null`),
    uniqueIndex("quotes_one_plan_draft_per_property")
      .on(t.propertyId)
      .where(sql`${t.status} = 'draft' and ${t.kind} = 'service_plan'`),
  ],
);

// One Clean Type's offer on a Quote. The Suggested Price is kept with every
// Price List figure it used, so it reads the same however the Price List
// changes later. A Service Plan Quote has one, for its Clean Type, priced as a
// one-off Job, less the Plan Discount.
export const quoteOptions = pgTable(
  "quote_options",
  {
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    cleanType: cleanType("clean_type").notNull(),
    suggested: jsonb("suggested").$type<PriceBreakdown>().notNull(),
    // a price before tax replacing the Suggested Price, and why
    overrideCents: integer("override_cents"),
    overrideReason: text("override_reason"),
    // the Plan Discount off the one-off price (the override if there is one,
    // else the Suggested Price), before tax; 0 on a one-off Quote
    discountCents: integer("discount_cents").notNull().default(0),
    // the final price: the one-off price less any Plan Discount
    priceCents: integer("price_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    labourHours: numeric("labour_hours", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.quoteId, t.cleanType] })],
);

// A Client's Deposit waiting on their bank's approval (e.g. 3D Secure) in the
// browser. Nothing is booked yet: once the payment succeeds it's booked by
// whichever comes first, the browser's finalize call or the provider's
// webhook. Kept once settled, so a late success for a Quote that was accepted
// some other way meanwhile is recognised, and refunded.
export const pendingDeposits = pgTable(
  "pending_deposits",
  {
    // the Payment Gateway's id for the payment, opaque to us
    gatewayRef: text("gateway_ref").primaryKey(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    cleanType: cleanType("clean_type").notNull(),
    depositCents: integer("deposit_cents").notNull(),
    acceptedBy: uuid("accepted_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    // when it was booked, failed or refunded
    settledAt: timestamp("settled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("pending_deposits_quote_id_idx").on(t.quoteId)],
);

export type Quote = typeof quotes.$inferSelect;
export type PendingDeposit = typeof pendingDeposits.$inferSelect;
export type QuoteOptionRow = typeof quoteOptions.$inferSelect;
