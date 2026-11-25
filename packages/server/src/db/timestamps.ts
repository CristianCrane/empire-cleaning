import { timestamp } from "drizzle-orm/pg-core";
import { clock } from "../services/clock/index.ts";

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
// Service version saved), by the Clock, as every other moment of its story
// is: the time the screens show as its createdAt (#520). $defaultFn is the
// app's value on every insert; defaultNow() is the database's, kept for a
// server still running the code before this column. A Bill's made_at is the
// same idea, set at its one insert from that transaction's now, with no
// default: no older server makes a Bill without one. The Clock imports only
// models, so drizzle-kit can load it
export const madeAt = {
  madeAt: timestamp("made_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$defaultFn(() => clock.now()),
};
