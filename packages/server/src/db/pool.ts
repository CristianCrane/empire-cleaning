import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolConfig } from "pg";
import env from "../env.ts";

// what every pool shares: the database, and waiting longer than this for a
// connection fails the request, rather than hanging it
const defaults = {
  connectionString: env.DB_URL,
  connectionTimeoutMillis: 10_000,
};

// the one way a pool is built: drizzle over a node-postgres Pool
export const poolOf = (options: PoolConfig = {}) =>
  drizzle({ connection: { ...defaults, ...options } });
