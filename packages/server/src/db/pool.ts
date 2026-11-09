import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient, PoolConfig } from "pg";
import { monitoring, SignalledError } from "#services/monitoring";
import env from "../env.ts";

// what every pool shares: the database, and waiting longer than this for a
// connection fails the request, rather than hanging it
const defaults = {
  connectionString: env.DB_URL,
  connectionTimeoutMillis: 10_000,
};

// pg's words when a wait for a connection gives up because every one is in
// use (pg-pool's index.js). Its other timeout, "Connection terminated due to
// connection timeout", is Postgres not answering a new connection, which the
// uptime monitor on /health covers, so that one stays an error. pg puts no
// code on either; db/pool.test.ts fails if an upgrade changes the words
const EXHAUSTED = "timeout exceeded when trying to connect";

// each pool's name, and its longest wait for a connection that ended since
// its last sample, in ms
const watched = new WeakMap<Pool, { name: string; waitMax: number }>();

// The one way a pool is built: drizzle over a node-postgres Pool, `name`d in
// what it measures and signals (#284)
export const poolOf = (name: string, options: PoolConfig = {}) => {
  const db = drizzle({ connection: { ...defaults, ...options } });
  watch(name, db.$client);
  return db;
};

type Connected = (
  error: Error | undefined,
  client: PoolClient | undefined,
  release: (release?: unknown) => void,
) => void;

// times each wait for a connection, and raises db_pool_exhausted when one
// gives up. Both ways in: pg's own `query` (each of drizzle's queries outside
// a transaction) calls `connect` with a callback, and drizzle's `transaction`
// without
const watch = (name: string, pool: Pool) => {
  const state = { name, waitMax: 0 };
  watched.set(pool, state);
  const connect = pool.connect.bind(pool);

  const timed = (callback?: Connected) => {
    const askedAt = performance.now();
    const waited = (error: Error | undefined) => {
      state.waitMax = Math.max(state.waitMax, performance.now() - askedAt);
      return error ? signalledIf(name, error) : error;
    };
    if (callback) {
      connect((error, client, release) =>
        callback(waited(error), client, release),
      );
      return undefined;
    }
    return connect().then(
      (client) => {
        waited(undefined);
        return client;
      },
      (error: Error) => {
        throw waited(error);
      },
    );
  };
  pool.connect = timed as Pool["connect"];
};

// a wait that gave up because the pool ran dry: urgent, told at most once a
// minute for each pool (signals.ts), and thrown on as a SignalledError so
// each failed request doesn't also report an error
const signalledIf = (name: string, error: Error) => {
  if (error.message !== EXHAUSTED) return error;
  monitoring.signal("db_pool_exhausted", { pool: name });
  return new SignalledError(
    "db_pool_exhausted",
    `no connection free in the ${name} pool`,
    { cause: error },
  );
};

// sends a pool's numbers now (src/index.ts, every few seconds): connections
// handed out (or opening), free, and requests waiting, and its longest wait
// since the last sample
export const samplePool = (db: { $client: Pool }) => {
  const pool = db.$client;
  const state = watched.get(pool);
  if (!state) throw new Error("only a pool built by poolOf is sampled");
  const context = { pool: state.name };
  monitoring.measure(
    "db.pool.in_use",
    pool.totalCount - pool.idleCount,
    context,
  );
  monitoring.measure("db.pool.idle", pool.idleCount, context);
  monitoring.measure("db.pool.waiting", pool.waitingCount, context);
  monitoring.measure("db.pool.wait_max", Math.round(state.waitMax), context);
  state.waitMax = 0;
};
