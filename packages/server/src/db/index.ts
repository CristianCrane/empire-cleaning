import { timestamp } from "drizzle-orm/pg-core";
import { poolOf, samplePool } from "./pool.ts";

// A transaction holds one of these connections until it ends, so inside one,
// every query goes through its tx, never through db: one waiting on a second
// connection while others wait on its locks could hang every request
// (ADR-0024). Tests refuse it (tests/setup/oneConnection.ts).
export const db = poolOf("db");

// A few connections apart, for writes that must stand whatever the
// transaction around them does, such as payment attempts (ADR-0022,
// ADR-0024). No transaction holds one, so they never wait behind one.
export const apart = poolOf("apart", { max: 3 });

// how often both pools' numbers are sent (src/index.ts): often enough that a
// short run dry shows. It sets the volume: 2 pools x 4 measures x 6 a minute
// is ~2M a month, against the free plan's 5 GB of metrics (#284)
export const SAMPLE_MS = 10_000;

export const samplePools = () => {
  samplePool(db);
  samplePool(apart);
};

// what db.transaction() hands its callback
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};
