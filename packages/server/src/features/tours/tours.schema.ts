import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "../auth/auth.schema.ts";

// the first-time help tours an Account has seen, one row each: a tour is a
// screen's short spotlight walk-through, shown once (#291). Not the test
// site's demo people, which the people page also calls tours
export const seenTours = pgTable(
  "seen_tours",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // the web app's name for it, e.g. "portal-home"
    tour: text("tour").notNull(),
    seenAt: timestamp("seen_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.tour] })],
);
