import { timestamp } from "drizzle-orm/pg-core";

// every table's created and updated times. Apart from the pools (index.ts)
// so a schema file loads nothing that needs the server's environment:
// drizzle-kit loads every schema file to generate a migration (#389)
export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};
