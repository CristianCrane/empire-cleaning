import { boolean, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { condition, properties } from "../properties/properties.schema.ts";

// a Client's description of the cleaning they want, asking for pricing
export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    // the Condition as the Client stated it in this request
    condition: condition("condition").notNull(),
    // asks the Office to follow up with a Service Plan after the First Clean
    wantsRegularService: boolean("wants_regular_service").notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("quote_requests_client_id_idx").on(t.clientId),
    index("quote_requests_property_id_idx").on(t.propertyId),
  ],
);

export type QuoteRequest = typeof quoteRequests.$inferSelect;
