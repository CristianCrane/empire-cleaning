import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";

// a person or business Empire Cleaning has a relationship with, from their
// first Quote Request onward. Created by Quote Requests, never by signing
// up; an Account is connected to it by proven email (ADR-0006).
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
  ...timestamps,
});

export type Client = typeof clients.$inferSelect;
