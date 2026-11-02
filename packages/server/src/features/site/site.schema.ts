import { pgTable, smallint, text } from "drizzle-orm/pg-core";

// which site's server last ran on this database (site.ts); one row
export const site = pgTable("site", {
  id: smallint("id").primaryKey().default(1),
  mode: text("mode", { enum: ["dev", "test", "prod"] }).notNull(),
});
