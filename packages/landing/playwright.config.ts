import { defineConfig, devices } from "@playwright/test";

const API_PORT = 3200;
const CONTROL_PORT = 3201;
const SITE_PORT = 4322;
export const siteUrl = `http://localhost:${SITE_PORT}`;
export const controlUrl = `http://127.0.0.1:${CONTROL_PORT}`;

// tests the built site in a real Chromium, as a visitor gets it, on a phone
// and a desktop. Its Quote Request form talks to the real API and a database
// of its own (packages/server/tests/e2e/server.ts), separate from the web
// app's, so both suites can run at once. Tests share that database, so they
// run one at a time.
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: siteUrl },
  webServer: [
    {
      command: "pnpm --filter @empire-cleaning/server e2e:server",
      url: `${controlUrl}/health`,
      timeout: 120_000,
      env: {
        ...process.env,
        APP_MODE: "dev",
        PORT: String(API_PORT),
        E2E_CONTROL_PORT: String(CONTROL_PORT),
        DB_URL:
          "postgresql://postgres:password@localhost:5433/empire_e2e_landing_test",
        TEST_DB_URL:
          "postgresql://postgres:password@localhost:5433/empire_e2e_landing_test",
        BETTER_AUTH_URL: `http://localhost:${API_PORT}`,
        BETTER_AUTH_SECRET: "e2e-secret-at-least-32-characters-long",
        CORS_ORIGIN_URL: "http://localhost:5299",
        LANDING_ORIGIN_URL: siteUrl,
        RESEND_API_KEY: "e2e-resend-api-key",
        GOOGLE_CLIENT_ID: "e2e-google-client-id",
        GOOGLE_CLIENT_SECRET: "e2e-google-client-secret",
        STRIPE_SECRET_KEY: "e2e-stripe-secret-key",
        STRIPE_PUBLISHABLE_KEY: "e2e-stripe-publishable-key",
        STRIPE_WEBHOOK_SECRET: "e2e-stripe-webhook-secret",
      },
    },
    {
      // built here, so the site's form points at this run's API
      command: `ASTRO_TELEMETRY_DISABLED=1 astro build && ASTRO_TELEMETRY_DISABLED=1 astro preview --port ${SITE_PORT} --ignore-lock`,
      url: siteUrl,
      timeout: 120_000,
      env: { ...process.env, PUBLIC_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    // the phone is the main screen, and runs everything. Desktop runs only the
    // tests tagged @desktop: the ones where a larger layout changes something.
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      grep: /@desktop/,
    },
  ],
});
