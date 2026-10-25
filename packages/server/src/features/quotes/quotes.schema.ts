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

// A priced offer answering a Quote Request. A First Clean Quote offers both
// Clean Types (quote_options). While a Draft it's priced afresh from the
// current Price List on every save; once Sent it never changes.
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteRequestId: uuid("quote_request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    status: quoteStatus("status").notNull().default("draft"),
    // the version the prices were worked out from at the last save
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "restrict" }),
    crewSize: integer("crew_size").notNull(),
    depositPercent: integer("deposit_percent").notNull(),
    validityDays: integer("validity_days").notNull(),
    proposedStartsAt: timestamp("proposed_starts_at", { withTimezone: true }),
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
    index("quotes_quote_request_id_idx").on(t.quoteRequestId),
    // at most one Sent and one Draft per Quote Request
    uniqueIndex("quotes_one_sent_per_request")
      .on(t.quoteRequestId)
      .where(sql`${t.status} = 'sent'`),
    uniqueIndex("quotes_one_draft_per_request")
      .on(t.quoteRequestId)
      .where(sql`${t.status} = 'draft'`),
  ],
);

// One Clean Type's offer on a Quote. The Suggested Price is kept with every
// Price List figure it used, so it reads the same however the Price List
// changes later.
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
    // the final price: the override if there is one, else the Suggested Price
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
