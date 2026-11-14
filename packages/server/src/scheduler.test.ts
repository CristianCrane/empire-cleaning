import { describe, expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "#db";
import { holdSeeding } from "#features/site";
import { testMonitoring } from "../tests/harness.ts";
import { tick } from "./scheduler.ts";

const succeeds = (name: string) => ({ name, run: async () => {} });
const fails = (name: string) => ({
  name,
  run: async () => {
    throw new Error(`${name} broke`);
  },
});

// one heartbeat for the scheduler as a whole (ADR-0007)
describe("the scheduler's heartbeat", () => {
  test("checks in after a tick in which every job succeeded", async () => {
    await tick([succeeds("reminders"), succeeds("weekly Bills")]);

    expect(testMonitoring().heartbeats).toBe(1);
    expect(testMonitoring().errors).toEqual([]);
  });

  test("doesn't check in when a job fails, which is reported by name, and runs the rest", async () => {
    let ran = false;
    await tick([
      fails("weekly Bills"),
      { name: "reminders", run: async () => void (ran = true) },
    ]);

    expect(testMonitoring().heartbeats).toBe(0);
    expect(ran).toBe(true);
    expect(testMonitoring().errors).toEqual([
      {
        error: expect.objectContaining({ message: "weekly Bills broke" }),
        context: { job: "weekly Bills" },
      },
    ]);
  });

  test("doesn't check in when the seed's lock can't be asked for, which is reported", async () => {
    const down = new Error("connection refused");
    vi.spyOn(db.$client, "connect").mockRejectedValueOnce(down as never);

    await tick([succeeds("reminders")]);

    expect(testMonitoring().heartbeats).toBe(0);
    expect(testMonitoring().errors).toEqual([
      { error: down, context: { job: "seeding lock" } },
    ]);
  });
});

// the seed lays out its own days, so the scheduler keeps off the database
// while it runs (features/site)
describe("while the seed runs", () => {
  test("a tick runs no job, and still checks in", async () => {
    const letGo = await holdSeeding();
    let ran = false;
    try {
      await tick([
        { name: "Service Plan Jobs", run: async () => void (ran = true) },
      ]);
    } finally {
      await letGo();
    }

    expect(ran).toBe(false);
    expect(testMonitoring().heartbeats).toBe(1);
  });

  test("a seed started during a tick waits for it, then holds the scheduler off", async () => {
    let finish!: () => void;
    const running = tick([
      {
        name: "Service Plan Jobs",
        run: () => new Promise<void>((done) => (finish = done)),
      },
    ]);
    await vi.waitFor(() => expect(finish).toBeDefined());
    let held = false;
    const holding = holdSeeding().then((letGo) => {
      held = true;
      return letGo;
    });
    // the seed's lock is asked for, and not yet given
    await vi.waitFor(async () => {
      const { rows } = await db.execute<{ waiting: number }>(
        sql`select count(*)::int as waiting from pg_locks
            where locktype = 'advisory' and objid = 4006 and not granted`,
      );
      expect(rows[0]!.waiting).toBe(1);
    });
    expect(held).toBe(false);

    finish();
    await running;
    const letGo = await holding;
    let ran = false;
    try {
      await tick([
        { name: "Service Plan Jobs", run: async () => void (ran = true) },
      ]);
    } finally {
      await letGo();
    }

    expect(ran).toBe(false);
  });
});
