import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";

// how a Client billed weekly pays each Bill: charged to their saved Payment
// Method when it's made, or paid by them on its page by its due date
export const billPayment = pgEnum("bill_payment", ["automatic", "on_page"]);

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
