import { defineConfig } from "vitest/config";
import { TEST_WORKERS } from "./tests/setup/testDatabase.ts";

export default defineConfig({
  test: {
    name: "server",
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    globalSetup: ["./tests/setup/globalSetup.ts"],
    setupFiles: ["./tests/setup/workerDatabase.ts", "./tests/setup/perTest.ts"],
    env: {
      APP_MODE: "dev",
      CORS_ORIGIN_URL: "http://localhost:5173",
      LANDING_ORIGIN_URL: "http://localhost:4321",
      // fake credentials: the services behind them are faked in tests, and
      // Google only needs them to build sign-in URLs
      RESEND_API_KEY: "test-resend-api-key",
      OFFICE_EMAIL: "office@example.com",
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
    // files run in parallel, each worker on a database of its own
    // (tests/setup/workerDatabase.ts). One copy of the server (Better Auth,
    // Drizzle...) per worker instead of one per file: loading it takes ~5 s.
    // Safe because a worker runs its files one at a time and every test starts
    // from fresh fakes and an empty database (tests/setup/perTest.ts)
    isolate: false,
    maxWorkers: TEST_WORKERS,
  },
});
