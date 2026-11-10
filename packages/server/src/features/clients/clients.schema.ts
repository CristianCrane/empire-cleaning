import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { LANGUAGES } from "@empire-cleaning/models";
import { timestamps } from "../../db/timestamps.ts";
import { accounts } from "../auth/auth.schema.ts";

// how a Client billed weekly pays each Bill: charged to their saved Payment
// Method when it's made, or paid by them on its page by its due date
export const billPayment = pgEnum("bill_payment", ["automatic", "on_page"]);

// the languages a Client or a Staff member reads screens and messages in
// (ADR-0025)
export const language = pgEnum("language", LANGUAGES);

// a person or business Empire Cleaning has a relationship with, from their
// first asking for a Quote onward. Created by asking for one, never by
// signing up; an Account is connected to it by proven email (ADR-0006).
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  // the Account connected to this Client, once someone has signed up with
  // this email; kept even if either email changes later
  accountId: uuid("account_id")
    .unique()
    .references(() => accounts.id, { onDelete: "set null" }),
  // the contact person's, for a business
  name: text("name").notNull(),
  // a business Client's own name (#72)
  businessName: text("business_name"),
  // where we send Quotes and notices; stored lowercased. None for a Client
  // the Office entered without one, who can't sign in or be sent a Quote
  // until it's added (#34)
  email: text("email").unique(),
  // shown to the Cleaners assigned to a Job, on the day
  phone: text("phone").notNull(),
  // the language their screens and messages are in: a Guest's first Quote
  // sets it from the page they asked on, the Office for a caller it enters,
  // and the Office or the Client may change it (ADR-0025)
  preferredLanguage: language("preferred_language").notNull().default("en"),
  // weekly billing (ADR-0016), for a commercial Client only: the Monday of
  // the week it was switched on, from which their Jobs go on Bills; null
  // while it's off. How they pay and their terms stay set while it's off.
  billedWeeklyFrom: date("billed_weekly_from", { mode: "string" }),
  billPayment: billPayment("bill_payment").notNull().default("automatic"),
  // days from a Bill being made to its due date, when it's paid on its page
  billTermsDays: integer("bill_terms_days").notNull().default(14),
  // where Bills and their receipts go instead of the Client's own email;
  // stored lowercased
  billingEmail: text("billing_email"),
  // when they were asked for a Google review, the day after their first
  // Completed Job (#175); asked once, never again
  reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
  ...timestamps,
});

export type Client = typeof clients.$inferSelect;

// a Client's change of their own email, waiting for them to open the link
// sent to the new address (#243): until then the Client keeps the old one,
// so nobody can claim an address they don't own. At most one per Client,
// gone once used
export const emailChanges = pgTable("email_changes", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  // stored lowercased
  email: text("email").notNull(),
  // the link's token is never stored, only its SHA-256
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});
