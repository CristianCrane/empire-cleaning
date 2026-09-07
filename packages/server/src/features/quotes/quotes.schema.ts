import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientFirstName: text("client_first_name").notNull(),
  ...timestamps,
});

export type Quote = typeof quotes.$inferSelect;
export const insertQuoteSchema = createInsertSchema(quotes);
export const selectQuoteSchema = createSelectSchema(quotes);
