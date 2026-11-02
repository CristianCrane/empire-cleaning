import { describe, expect, test } from "vitest";
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
});
