import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "server",
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    globalSetup: ["./tests/setup/globalSetup.ts"],
    clearMocks: true,
    restoreMocks: true,
    pool: "threads",
    fileParallelism: false, // force sequential execution for tests (prevent shared db race conditions)
  },
});
