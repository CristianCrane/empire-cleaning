import { defineConfig, devices } from "@playwright/test";

// tests the built site (`pnpm test` builds first) in a real Chromium, as a
// visitor gets it: on a phone and on a desktop
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:4322" },
  webServer: {
    command:
      "ASTRO_TELEMETRY_DISABLED=1 astro preview --port 4322 --ignore-lock",
    url: "http://localhost:4322",
    reuseExistingServer: false,
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
