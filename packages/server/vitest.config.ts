import { defineConfig } from "vitest/config";
import { TEST_DB_URL } from "./tests/setup/testDatabase.ts";

export default defineConfig({
  test: {
    name: "server",
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    globalSetup: ["./tests/setup/globalSetup.ts"],
    setupFiles: ["./tests/setup/perTest.ts"],
    env: {
      APP_MODE: "dev",
      DB_URL: TEST_DB_URL,
      // fake credentials: the services behind them are faked in tests, and
      // Google only needs them to build sign-in URLs
      RESEND_API_KEY: "test-resend-api-key",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    },
    clearMocks: true,
    restoreMocks: true,
    pool: "threads",
    fileParallelism: false, // force sequential execution for tests (prevent shared db race conditions)
  },
});
