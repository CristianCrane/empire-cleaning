import env from "../env.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import { timestamp } from "drizzle-orm/pg-core";

export const db = drizzle(env.DB_URL);

// what db.transaction() hands its callback
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};
