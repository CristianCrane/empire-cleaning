import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { properties } from "../properties/properties.schema.ts";

export const cleanType = pgEnum("clean_type", ["standard", "deep"]);

// only booked so far; Completed, No Access and cancellation come with their
// tickets (#10, #11)
export const jobStatus = pgEnum("job_status", ["booked"]);

// A single cleaning visit at one Property, booked for a confirmed time. The
// Schedule is every booked Job. Accepting a Quote (#8) and Service Plans (#14)
// create them; until then only tests do.
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    cleanType: cleanType("clean_type").notNull(),
    status: jobStatus("status").notNull().default("booked"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    labourHours: numeric("labour_hours", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    crewSize: integer("crew_size").notNull(),
    ...timestamps,
  },
  (t) => [index("jobs_starts_at_idx").on(t.startsAt)],
);

export type Job = typeof jobs.$inferSelect;
