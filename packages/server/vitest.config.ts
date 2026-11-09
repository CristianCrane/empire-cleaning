import { defineConfig } from "vitest/config";
import { MINUTE_MS } from "@empire-cleaning/models";
import { TEST_WORKERS } from "./tests/setup/testDatabase.ts";
import { testEnv } from "./tests/setup/testEnv.ts";

export default defineConfig({
  test: {
    maxWorkers: TEST_WORKERS,
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["src/**/*.test.ts"],
          globals: true,
          globalSetup: ["./tests/setup/globalSetup.ts"],
          setupFiles: [
            "./tests/setup/workerDatabase.ts",
            "./tests/setup/perTest.ts",
          ],
          // in that order, not all at once (Vitest's default):
          // workerDatabase.ts points the app at the worker's database before
          // perTest.ts imports it
          sequence: { setupFiles: "list" },
          env: testEnv,
          clearMocks: true,
          restoreMocks: true,
          pool: "threads",
          // files run in parallel, each worker on a database of its own
          // (tests/setup/workerDatabase.ts). One copy of the server (Better
          // Auth, Drizzle...) per worker instead of one per file: loading it
          // takes ~5 s. Safe because a worker runs its files one at a time
          // and every test starts from fresh fakes and an empty database
          // (tests/setup/perTest.ts)
          isolate: false,
        },
      },
      // The seed test (tests/seed.test.ts), after the others: it runs the
      // seed in a process of its own for each time of day it tries, each
      // loading the whole server, and beside the other tests it starved them
      // of CPU. The quick tests leave it out (`--project server`).
      {
        test: {
          name: "seed",
          environment: "node",
          include: ["tests/seed.test.ts"],
          globalSetup: ["./tests/setup/seedSetup.ts"],
          env: testEnv,
          sequence: { groupOrder: 1 },
          // as many seeds at once as test workers: each keeps up to 13
          // connections (src/db/index.ts), as a worker does
          maxConcurrency: TEST_WORKERS,
          testTimeout: 2 * MINUTE_MS,
          hookTimeout: 2 * MINUTE_MS,
        },
      },
    ],
  },
});
