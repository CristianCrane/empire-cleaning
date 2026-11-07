import { defineConfig, devices } from "@playwright/test";
import { E2E_DB_URL, slot, slotOf, WORKERS } from "./e2e/slots.ts";

// Keep headless Chromium off the WSLg display so it doesn't steal Windows focus
delete process.env.DISPLAY;
delete process.env.WAYLAND_DISPLAY;

// the same count of slots in the workers and servers Playwright starts
process.env.E2E_WORKERS = String(WORKERS);

// the slot of the worker this runs in (e2e/slots.ts)
export const { appUrl, apiUrl, controlUrl } = slot;

const slots = Array.from({ length: WORKERS }, (_, i) => slotOf(i));

// end to end: a production build of the app, in a real Chromium, against the
// real API and a real database. Only email, payments and the clock are faked
// (packages/server/tests/e2e/server.ts). Tests run in parallel, each worker
// with an API and a database of its own (e2e/slots.ts). E2E_WORKERS or
// --workers sets how many.
export default defineConfig({
  testDir: "./e2e",
  workers: WORKERS,
  fullyParallel: true,
  // CI also keeps an HTML report, and the trace of every failed test
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: appUrl, trace: "retain-on-failure" },
  webServer: [
    {
      // every slot's API at once, each on a copy of one database migrated for
      // the run (packages/server/tests/e2e/servers.ts)
      command: "pnpm --filter @empire-cleaning/server e2e:servers",
      wait: { stdout: /e2e APIs ready/ },
      timeout: 120_000,
      env: {
        ...process.env,
        TEST_DB_URL: E2E_DB_URL,
        E2E_SLOTS: JSON.stringify(slots),
        LANDING_ORIGIN_URL: "http://localhost:4399",
      },
    },
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
