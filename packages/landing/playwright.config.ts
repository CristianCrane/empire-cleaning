import { defineConfig, devices } from "@playwright/test";
import { E2E_PORTS } from "@empire-cleaning/server/checkout";

// Keep headless Chromium off the WSLg display so it doesn't steal Windows focus
delete process.env.DISPLAY;
delete process.env.WAYLAND_DISPLAY;

// the last ports of this checkout's block (the server's tests/checkout.ts),
// after the web e2e slots' (packages/web/e2e/slots.ts)
const API_PORT = E2E_PORTS + 190;
const CONTROL_PORT = E2E_PORTS + 191;
const SITE_PORT = E2E_PORTS + 192;
export const siteUrl = `http://localhost:${SITE_PORT}`;
export const controlUrl = `http://127.0.0.1:${CONTROL_PORT}`;
// where the header's Sign in goes, as built for these tests
export const appUrl = "https://app.example.test";

// tests the built site in a real Chromium, as a visitor gets it, on a phone
// and a desktop. Its Request a Quote form talks to the real API and a database
// of its own (packages/server/tests/e2e/servers.ts), separate from the web
// app's, so both suites can run at once. The tests share that API and
// database, and run at once all the same: nothing resets them, and a test
// that sends the form asks as a Client of its own, by its email (newEmail in
// tests/harness.ts), so it sees only its own Quotes and emails. 2 workers
// (why: ADR-0026); --workers sets it
export default defineConfig({
  testDir: "./tests",
  workers: 2,
  fullyParallel: true,
  // CI also keeps an HTML report, and the trace of every failed test
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: siteUrl, trace: "retain-on-failure" },
  // as the web app's (packages/web/playwright.config.ts): one entry builds
  // the site while the API starts, ready once both say so, and either one
  // exiting ends it at once and takes the other with it
  webServer: [
    {
      // the site built here, so its form points at this run's API, and Sign
      // in at a known address
      command: `bash -c 'trap "kill 0" EXIT; pnpm --filter @empire-cleaning/server e2e:servers & (ASTRO_TELEMETRY_DISABLED=1 astro build && ASTRO_TELEMETRY_DISABLED=1 astro preview --port ${SITE_PORT} --ignore-lock) & wait -n'`,
      wait: {
        stdout: new RegExp(
          `(?=[\\s\\S]*e2e APIs ready)(?=[\\s\\S]*Local\\s+${siteUrl})`,
        ),
      },
      timeout: 120_000,
      env: {
        ...process.env,
        // the API's database is a copy of this one, `_0`: slot 0 of 1
        // (packages/server/tests/e2e/servers.ts)
        TEST_DB_URL:
          "postgresql://postgres:password@localhost:5433/empire_e2e_landing_test",
        E2E_SLOTS: JSON.stringify([
          {
            apiUrl: `http://localhost:${API_PORT}`,
            controlUrl,
            appUrl: "http://localhost:5299",
          },
        ]),
        LANDING_ORIGIN_URL: siteUrl,
        PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        PUBLIC_APP_URL: appUrl,
      },
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
