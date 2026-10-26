import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";
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
    // the Office Staff member who entered it for a caller; null when the
    // Client asked themselves
    enteredBy: uuid("entered_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("quote_requests_client_id_idx").on(t.clientId),
    index("quote_requests_property_id_idx").on(t.propertyId),
  ],
);

// the Add-ons a Client chose, by key (the same across Price List versions)
export const quoteRequestAddOns = pgTable(
  "quote_request_add_ons",
  {
    quoteRequestId: uuid("quote_request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    addOnKey: uuid("add_on_key").notNull(),
  },
  (t) => [primaryKey({ columns: [t.quoteRequestId, t.addOnKey] })],
);

export type QuoteRequest = typeof quoteRequests.$inferSelect;
