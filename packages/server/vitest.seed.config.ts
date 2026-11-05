import { defineConfig } from "vitest/config";
import { TEST_WORKERS } from "./tests/setup/testDatabase.ts";
import { testEnv } from "./tests/setup/testEnv.ts";

// The seed test (tests/seed.test.ts), apart from the others: it runs the
// seed in a process of its own for each time of day it tries, each loading
// the whole server, and beside the other tests it starved them of CPU. So
// `pnpm test` runs it after them, and the quick tests leave it out.
export default defineConfig({
  test: {
    name: "seed",
    environment: "node",
    include: ["tests/seed.test.ts"],
    env: testEnv,
    // as many seeds at once as test workers: each keeps up to 13
    // connections (src/db/index.ts), as a worker does
    maxConcurrency: TEST_WORKERS,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
