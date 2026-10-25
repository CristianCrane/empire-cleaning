import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import type { StaffRole } from "@empire-cleaning/models";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";

// a person working for Empire Cleaning. Created only by invitation (or the
// owner setup script), never by signing up; an Account is connected to it
// by proven email (ADR-0006)
export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  // the Account connected to this Staff member, once someone has signed up
  // with this email; kept even if either email changes later
  accountId: uuid("account_id")
    .unique()
    .references(() => accounts.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  // stored lowercased, as Accounts' emails are
  email: text("email").notNull().unique(),
  roles: text("roles").$type<StaffRole>().array().notNull(),
  // a deactivated Staff member keeps their record but has no Staff access
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

export type Staff = typeof staff.$inferSelect;

const hours = (name: string) =>
  numeric(name, { precision: 4, scale: 2, mode: "number" }).notNull();

// the hours a Staff member is usually available on each weekday (0 is
// Monday). A weekday with no row is 0 hours.
export const staffUsualHours = pgTable(
  "staff_usual_hours",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    hours: hours("hours"),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.weekday] })],
);

// a day that differs from the usual week, such as a holiday or an extra day;
// it replaces that day's usual hours
export const staffAvailabilityExceptions = pgTable(
  "staff_availability_exceptions",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    hours: hours("hours"),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.date] })],
);
