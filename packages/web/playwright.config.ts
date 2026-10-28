import { defineConfig, devices } from "@playwright/test";
import { slot, slotOf, WORKERS } from "./e2e/slots.ts";

// the slot of the worker this runs in (e2e/slots.ts)
export const { appUrl, apiUrl, controlUrl } = slot;

const slots = Array.from({ length: WORKERS }, (_, i) => slotOf(i));

// end to end: a production build of the app, in a real Chromium, against the
// real API and a real database. Only email, payments and the clock are faked
// (packages/server/tests/e2e/server.ts). Tests run in parallel, each worker
// with an API and a database of its own (e2e/slots.ts). E2E_WORKERS sets how
// many.
export default defineConfig({
  testDir: "./e2e",
  workers: WORKERS,
  fullyParallel: true,
  // CI also keeps an HTML report, and the trace of every failed test
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: appUrl, trace: "retain-on-failure" },
  webServer: [
    ...slots.map((s) => ({
      command: "pnpm --filter @empire-cleaning/server e2e:server",
      url: `${s.controlUrl}/health`,
      timeout: 120_000,
      env: {
        ...process.env,
        APP_MODE: "dev",
        PORT: new URL(s.apiUrl).port,
        E2E_CONTROL_PORT: new URL(s.controlUrl).port,
        DB_URL: s.dbUrl,
        TEST_DB_URL: s.dbUrl,
        BETTER_AUTH_URL: s.apiUrl,
        BETTER_AUTH_SECRET: "e2e-secret-at-least-32-characters-long",
        CORS_ORIGIN_URL: s.appUrl,
        LANDING_ORIGIN_URL: "http://localhost:4399",
        RESEND_API_KEY: "e2e-resend-api-key",
        OFFICE_EMAIL: "office@example.com",
        GOOGLE_CLIENT_ID: "e2e-google-client-id",
        GOOGLE_CLIENT_SECRET: "e2e-google-client-secret",
        STRIPE_SECRET_KEY: "e2e-stripe-secret-key",
        STRIPE_PUBLISHABLE_KEY: "e2e-stripe-publishable-key",
        STRIPE_WEBHOOK_SECRET: "e2e-stripe-webhook-secret",
      },
    })),
    {
      command: "vite build && node e2e/preview.ts",
      // the last slot's app is served last
      url: slots.at(-1)!.appUrl,
      timeout: 120_000,
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
