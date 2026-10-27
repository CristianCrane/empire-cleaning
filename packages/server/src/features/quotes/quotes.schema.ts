import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { PriceBreakdown } from "@empire-cleaning/models";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";
import { cleanType, jobs } from "../jobs/jobs.schema.ts";
import { priceLists } from "../price-list/price-list.schema.ts";
import { condition, properties } from "../properties/properties.schema.ts";

// A Sent Quote whose offer's time is up is Expired whether or not this says
// so: "expired" is only written when another Quote of its kind is started
// for the Property, so the one-open-of-each-kind rule below can hold.
export const quoteStatus = pgEnum("quote_status", [
  "requested",
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "turned_down",
]);

// what a Quote offers: one Job, or a Service Plan, which a home can only be
// offered once its First Clean is Completed (business premises need no First
// Clean, ADR-0014)
export const quoteKind = pgEnum("quote_kind", ["one_off", "service_plan"]);

// how a Quote started (ADR-0017): a Client's (or Guest's) own ask; Office
// Staff entering a caller's; or Office Staff offering a Service Plan nobody
// asked for, which has nothing asked
export const quoteOrigin = pgEnum("quote_origin", [
  "client",
  "caller",
  "office",
]);

// why Office Staff Turned Down a Quote
export const turnDownReason = pgEnum("turn_down_reason", [
  "out_of_area",
  "out_of_scope",
  "no_capacity",
]);

// how often a Service Plan comes round on each of its weekdays: every week,
// always, when it has several
export const recurrence = pgEnum("recurrence", [
  "weekly",
  "fortnightly",
  "four_weekly",
]);

// Empire Cleaning's offer for one Property, from the ask (or the Office
// starting it) to its outcome (ADR-0017). It keeps what was asked, never
// changed, and its Revisions, the latest Sent one being the offer. Its kind
// is set by its first Revision; a Requested Quote has none yet.
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    kind: quoteKind("kind"),
    status: quoteStatus("status").notNull(),
    origin: quoteOrigin("origin").notNull(),

    // what was asked, as the Client (or the caller) said it; nothing on a
    // Quote the Office offered unprompted. A home's Condition; a business
    // states none (a Site Visit finds it). A home may ask the Office to
    // follow up with a Service Plan after the First Clean; business premises
    // wanting regular cleaning ask for `weekdays` (0 is Monday), starting
    // around `preferredTime` ("08:00"). The Add-ons are quote_add_ons.
    condition: condition("condition"),
    wantsRegularService: boolean("wants_regular_service")
      .notNull()
      .default(false),
    weekdays: integer("weekdays").array().notNull().default([]),
    preferredTime: text("preferred_time"),
    notes: text("notes"),

    // the latest Sent Revision: the offer, and once Accepted the one accepted
    sentRevisionId: uuid("sent_revision_id").references(
      (): AnyPgColumn => quoteRevisions.id,
      { onDelete: "restrict" },
    ),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    // once Accepted: when, the Clean Type chosen, the Job it booked (a
    // plan's first), and who accepted (the Client, or Office Staff on their
    // behalf)
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedCleanType: cleanType("accepted_clean_type"),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    acceptedBy: uuid("accepted_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    // once Turned Down: when, why, and by whom
    turnedDownAt: timestamp("turned_down_at", { withTimezone: true }),
    turnDownReason: turnDownReason("turn_down_reason"),
    turnedDownBy: uuid("turned_down_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    // the Office Staff member who started it; null when a Client asked
    createdBy: uuid("created_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("quotes_property_id_idx").on(t.propertyId),
    // only a Requested Quote, or one Turned Down while Requested, has no
    // kind yet
    check(
      "quotes_kind_set",
      sql`${t.kind} is not null or ${t.status} in ('requested', 'turned_down')`,
    ),
    // at most one open Quote of each kind per Property, so a one-off offer
    // and a plan offer can stand side by side. A Requested Quote counts as
    // both, which asking checks under a lock on the Property.
    uniqueIndex("quotes_one_open_per_property_kind")
      .on(t.propertyId, t.kind)
      .where(sql`${t.status} in ('draft', 'sent')`),
  ],
);

// the Add-ons a Client asked for, by key (the same across Price List
// versions)
export const quoteAddOns = pgTable(
  "quote_add_ons",
  {
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    addOnKey: uuid("add_on_key").notNull(),
  },
  (t) => [primaryKey({ columns: [t.quoteId, t.addOnKey] })],
);

// One priced version of a Quote. A one-off Quote's offers both Clean Types
// (revision_options); a Service Plan Quote's a visit on each of its weekdays
// (revision_options too), on a recurrence, at the Plan Discount. While
// unsent it's priced afresh from the current Price List on every save; once
// Sent it never changes. A Quote has one unsent at a time.
export const quoteRevisions = pgTable(
  "quote_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    // 1 for the first, counting up
    number: integer("number").notNull(),
    // the version the prices were worked out from at the last save
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "restrict" }),
    // a one-off Quote's crew; a Service Plan Quote's first weekday's, each
    // having its own
    crewSize: integer("crew_size").notNull(),
    depositPercent: integer("deposit_percent").notNull(),
    validityDays: integer("validity_days").notNull(),
    // the time of the Job; a Service Plan Quote's first clean, the earliest
    // of its weekdays', once they all have one
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
    createdBy: uuid("created_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("quote_revisions_number").on(t.quoteId, t.number),
    uniqueIndex("quote_revisions_one_unsent")
      .on(t.quoteId)
      .where(sql`${t.sentAt} is null`),
  ],
);

// One Clean Type's offer on a Revision. The Suggested Price is kept with
// every Price List figure it used, so it reads the same however the Price
// List changes later. A Service Plan Quote's Revision has one for each of
// its weekdays (ADR-0013), each its own visit: its Clean Type priced as a
// one-off Job, less the Plan Discount, its first clean's time and its crew.
export const revisionOptions = pgTable(
  "revision_options",
  {
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: "cascade" }),
    // which of a Service Plan Quote's weekdays, from 0, earliest first once
    // they're all timed; 0 on a one-off Quote
    position: smallint("position").notNull().default(0),
    cleanType: cleanType("clean_type").notNull(),
    // a Service Plan weekday's first clean, which every later one there
    // repeats; null on a one-off Quote (its Revision's proposed time is its
    // Job's), and on an unsent weekday until it's chosen
    startsAt: timestamp("starts_at", { withTimezone: true }),
    // the crew each clean gets: a one-off Quote's, or its weekday's
    crewSize: integer("crew_size").notNull(),
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
  (t) => [primaryKey({ columns: [t.revisionId, t.position, t.cleanType] })],
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
    // the Revision being accepted: a newer one Sent meanwhile isn't booked
    // on this one's Deposit
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: "cascade" }),
    // the Clean Type chosen; a Service Plan Quote's first weekday's
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
export type Revision = typeof quoteRevisions.$inferSelect;
export type PendingDeposit = typeof pendingDeposits.$inferSelect;
export type RevisionOptionRow = typeof revisionOptions.$inferSelect;
