import env from "../env.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import { timestamp } from "drizzle-orm/pg-core";

// waiting longer than this for a connection fails the request, rather than
// hanging it
const pool = { connectionString: env.DB_URL, connectionTimeoutMillis: 10_000 };

// A transaction holds one of these connections until it ends, so inside one,
// every query goes through its tx, never through db: one waiting on a second
// connection while others wait on its locks could hang every request
// (ADR-0024). Tests refuse it (tests/setup/oneConnection.ts).
export const db = drizzle({ connection: pool });

// A few connections apart, for writes that must stand whatever the
// transaction around them does, such as payment attempts (ADR-0022,
// ADR-0024). No transaction holds one, so they never wait behind one.
export const apart = drizzle({ connection: { ...pool, max: 3 } });

// what db.transaction() hands its callback
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};
