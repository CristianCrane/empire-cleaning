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
      CORS_ORIGIN_URL: "http://localhost:5173",
      LANDING_ORIGIN_URL: "http://localhost:4321",
      // fake credentials: the services behind them are faked in tests, and
      // Google only needs them to build sign-in URLs
      RESEND_API_KEY: "test-resend-api-key",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      STRIPE_SECRET_KEY: "test-stripe-secret-key",
      STRIPE_PUBLISHABLE_KEY: "test-stripe-publishable-key",
      STRIPE_WEBHOOK_SECRET: "test-stripe-webhook-secret",
    },
    clearMocks: true,
    restoreMocks: true,
    pool: "threads",
    fileParallelism: false, // force sequential execution for tests (prevent shared db race conditions)
    // one copy of the server (Better Auth, Drizzle...) for every file instead of one
    // per file: loading it takes ~5 s. Safe because files run one at a time and
    // every test starts from fresh fakes and an empty database (tests/setup/perTest.ts)
    isolate: false,
  },
});
