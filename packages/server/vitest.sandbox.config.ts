import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { testEnv } from "./tests/setup/testEnv.ts";

// The Payment Gateway contract on Stripe itself (tests/contract/
// stripe.sandbox.test.ts): no database and no fakes, only Stripe's keys, from
// .env by hand or the environment in CI. The webhook secret only signs the
// events the tests fetch, so any will do.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  test: {
    name: "stripe-sandbox",
    environment: "node",
    include: ["tests/contract/*.sandbox.test.ts"],
    env: {
      ...testEnv,
      DB_URL: "postgres://unused@localhost/unused",
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
      STRIPE_PUBLISHABLE_KEY:
        process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_unused",
      STRIPE_WEBHOOK_SECRET:
        process.env.STRIPE_WEBHOOK_SECRET || "whsec_contract_tests",
    },
    // each test waits on Stripe, some on its webhooks for up to five
    // minutes; one at a time, as its test-mode rate limits are strict
    testTimeout: 360_000,
    fileParallelism: false,
  },
});
