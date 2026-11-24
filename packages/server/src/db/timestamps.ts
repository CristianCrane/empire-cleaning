import { timestamp } from "drizzle-orm/pg-core";

// every table's created and updated times: the database's own record of a
// row's writes, which orders rows and is never shown. Apart from the pools
// (index.ts) so a schema file loads nothing that needs the server's
// environment: drizzle-kit loads every schema file to generate a migration
// (#389)
export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// when a record a person reads was made (a Quote asked, a Price List or
// Service version saved): the time the screens show as its createdAt.
// $defaultFn is the app's value on every insert; defaultNow() is the
// database's, kept for a server still running the code before this column
export const madeAt = {
  madeAt: timestamp("made_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$defaultFn(() => new Date()),
};
