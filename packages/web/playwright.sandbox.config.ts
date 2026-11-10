import { existsSync } from "node:fs";
import { MINUTE_MS } from "@empire-cleaning/models";
import base from "./playwright.config.ts";

// The real card form against a Stripe sandbox (e2e/card-form.sandbox.ts):
// the end-to-end tests' own setup (playwright.config.ts), with the API
// paying through the real Stripe adapter rather than the fake
// (packages/server/tests/harness.ts). Nightly in CI after the contract run
// (.github/workflows/stripe-sandbox.yml), and by hand:
//
//   pnpm --filter @empire-cleaning/web stripe:sandbox
//
// The sandbox's keys come from STRIPE_SANDBOX_SECRET_KEY and
// STRIPE_SANDBOX_PUBLISHABLE_KEY (CI's secrets), or else from the server's
// .env, as its own sandbox run reads them. The API refuses any secret key
// but a test-mode one; the spec, a publishable key that isn't.
const serverEnv = new URL("../server/.env", import.meta.url).pathname;
if (!process.env.STRIPE_SANDBOX_SECRET_KEY && existsSync(serverEnv)) {
  process.loadEnvFile(serverEnv);
  process.env.STRIPE_SANDBOX_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SANDBOX_PUBLISHABLE_KEY =
    process.env.STRIPE_PUBLISHABLE_KEY;
}

export default {
  ...base,
  // outside the default *.spec.ts, so the e2e run and pnpm test:change never
  // take it
  testMatch: "*.sandbox.ts",
  // each test waits on Stripe: its frames, its API and its 3D Secure page
  timeout: 2 * MINUTE_MS,
  // the phone alone: the form is the same on the desktop
  projects: base.projects?.filter((project) => project.name === "phone"),
  // their environment is read as the config loads, before the keys above
  webServer: [base.webServer ?? []].flat().map((server) => ({
    ...server,
    env: {
      ...server.env,
      STRIPE_SANDBOX_SECRET_KEY: process.env.STRIPE_SANDBOX_SECRET_KEY ?? "",
      STRIPE_SANDBOX_PUBLISHABLE_KEY:
        process.env.STRIPE_SANDBOX_PUBLISHABLE_KEY ?? "",
    },
  })),
};
