import { createServer, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { describe, expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";
import { monitoring, SignalledError } from "#services/monitoring";
import { testClock, testMonitoring } from "../../tests/harness.ts";
import { poolOf, samplePool } from "./pool.ts";

// A pool of one connection on the worker's own database, apart from `db`
// and its guards (tests/setup/oneConnection.ts), with `run` holding that one
// connection, so anything else waits for it until `run` lets it go
const withPoolHeld = async (
  connectionTimeoutMillis: number,
  run: (pool: ReturnType<typeof poolOf>, letGo: () => void) => Promise<void>,
) => {
  const pool = poolOf("test", { max: 1, connectionTimeoutMillis });
  const held = await pool.$client.connect();
  let holding = true;
  const letGo = () => {
    if (holding) held.release();
    holding = false;
  };
  try {
    await run(pool, letGo);
  } finally {
    letGo();
    await pool.$client.end();
  }
};

const failureOf = (work: Promise<unknown>) =>
  work.then(
    () => {
      throw new Error("expected it to fail");
    },
    (error: unknown) => error as Error,
  );

const exhausted = { name: "db_pool_exhausted", urgency: "urgent" };

describe("a pool run dry (#284)", () => {
  test("a query that waits too long raises db_pool_exhausted, at most once a minute", async () => {
    await withPoolHeld(100, async (pool) => {
      // pg's own query(), which asks with a callback; drizzle wraps its error
      const failed = await failureOf(pool.execute(sql`select 1`));

      expect(failed.cause).toBeInstanceOf(SignalledError);
      expect(testMonitoring().signalled("db_pool_exhausted")).toEqual([
        { ...exhausted, context: { pool: "test" } },
      ]);
      monitoring.error(failed);
      expect(testMonitoring().errors).toEqual([]);

      await failureOf(pool.execute(sql`select 1`));
      expect(testMonitoring().signalled("db_pool_exhausted")).toHaveLength(1);

      testClock().advance({ minutes: 1 });
      await failureOf(pool.execute(sql`select 1`));
      expect(testMonitoring().signalled("db_pool_exhausted")).toHaveLength(2);
    });
  });

  test("so does a transaction that waits too long", async () => {
    await withPoolHeld(100, async (pool) => {
      // drizzle's transaction(), which asks without a callback and doesn't
      // wrap the error
      const failed = await failureOf(pool.transaction(async () => {}));

      expect(failed).toBeInstanceOf(SignalledError);
      expect(testMonitoring().signalled("db_pool_exhausted")).toEqual([
        { ...exhausted, context: { pool: "test" } },
      ]);
      monitoring.error(failed);
      expect(testMonitoring().errors).toEqual([]);
    });
  });

  test("Postgres not answering is an error, not db_pool_exhausted", async () => {
    // takes connections and never answers them
    const sockets = new Set<Socket>();
    const silent = createServer((socket) => sockets.add(socket));
    await new Promise<void>((listening) =>
      silent.listen(0, "127.0.0.1", listening),
    );
    const { port } = silent.address() as AddressInfo;
    const pool = poolOf("test", {
      connectionString: `postgres://nobody@127.0.0.1:${port}/nothing`,
      connectionTimeoutMillis: 100,
    });
    try {
      const failed = await failureOf(pool.execute(sql`select 1`));

      expect((failed.cause as Error).message).toBe(
        "Connection terminated due to connection timeout",
      );
      expect(testMonitoring().signals).toEqual([]);
      monitoring.error(failed);
      expect(testMonitoring().errors).toHaveLength(1);
    } finally {
      await pool.$client.end();
      for (const socket of sockets) socket.destroy();
      await new Promise((closed) => silent.close(closed));
    }
  });

  test("its numbers: in use, idle, waiting and the longest wait", async () => {
    const measured = () =>
      Object.fromEntries(
        testMonitoring()
          .measures.splice(0)
          .map((m) => [m.name, m.value]),
      );
    await withPoolHeld(2_000, async (pool, letGo) => {
      // a sample starts the longest wait afresh, without the held one's
      samplePool(pool);
      measured();
      // drizzle runs a query once it's awaited, or then'd
      const waiting = pool.execute(sql`select 1`).then(() => {});
      await vi.waitFor(() => expect(pool.$client.waitingCount).toBe(1));

      samplePool(pool);
      expect(measured()).toEqual({
        "db.pool.in_use": 1,
        "db.pool.idle": 0,
        "db.pool.waiting": 1,
        // the wait hasn't ended yet
        "db.pool.wait_max": 0,
      });

      letGo();
      await waiting;
      samplePool(pool);
      const after = measured();
      expect(after).toMatchObject({
        "db.pool.in_use": 0,
        "db.pool.idle": 1,
        "db.pool.waiting": 0,
      });
      expect(after["db.pool.wait_max"]).toBeGreaterThan(0);

      samplePool(pool);
      expect(measured()["db.pool.wait_max"]).toBe(0);
    });
  });

  test("each measure carries its unit and the pool's name", async () => {
    const pool = poolOf("test");
    try {
      samplePool(pool);

      expect(testMonitoring().measures).toEqual([
        {
          name: "db.pool.in_use",
          value: 0,
          unit: "none",
          context: { pool: "test" },
        },
        {
          name: "db.pool.idle",
          value: 0,
          unit: "none",
          context: { pool: "test" },
        },
        {
          name: "db.pool.waiting",
          value: 0,
          unit: "none",
          context: { pool: "test" },
        },
        {
          name: "db.pool.wait_max",
          value: 0,
          unit: "millisecond",
          context: { pool: "test" },
        },
      ]);
    } finally {
      await pool.$client.end();
    }
  });
});
