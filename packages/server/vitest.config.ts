import { defineConfig } from "vitest/config";
import { TEST_WORKERS } from "./tests/setup/testDatabase.ts";
import { testEnv } from "./tests/setup/testEnv.ts";

export default defineConfig({
  test: {
    name: "server",
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    globalSetup: ["./tests/setup/globalSetup.ts"],
    setupFiles: ["./tests/setup/workerDatabase.ts", "./tests/setup/perTest.ts"],
    // in that order, not all at once (Vitest's default): workerDatabase.ts
    // points the app at the worker's database before perTest.ts imports it
    sequence: { setupFiles: "list" },
    env: testEnv,
    clearMocks: true,
    restoreMocks: true,
    pool: "threads",
    // files run in parallel, each worker on a database of its own
    // (tests/setup/workerDatabase.ts). One copy of the server (Better Auth,
    // Drizzle...) per worker instead of one per file: loading it takes ~5 s.
    // Safe because a worker runs its files one at a time and every test starts
    // from fresh fakes and an empty database (tests/setup/perTest.ts)
    isolate: false,
    maxWorkers: TEST_WORKERS,
  },
});
