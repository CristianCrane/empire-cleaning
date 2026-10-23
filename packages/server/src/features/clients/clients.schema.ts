import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";

// a person or business Empire Cleaning has a relationship with, from their
// first Quote Request onward. Created by Quote Requests, never by signing
// up; an Account is connected to it by proven email (ADR-0006). The rest of
// a Client's details arrive with Quote Requests (#3).
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  // the Account connected to this Client, once someone has signed up with
  // this email; kept even if either email changes later
  accountId: uuid("account_id")
    .unique()
    .references(() => accounts.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  // where we send Quotes and notices; stored lowercased
  email: text("email").notNull().unique(),
  ...timestamps,
});

export type Client = typeof clients.$inferSelect;
