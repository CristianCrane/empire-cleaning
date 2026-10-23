import { defineConfig, devices } from "@playwright/test";

const API_PORT = 3100;
const CONTROL_PORT = 3101;
const APP_PORT = 4173;
export const appUrl = `http://localhost:${APP_PORT}`;
export const controlUrl = `http://127.0.0.1:${CONTROL_PORT}`;

// end to end: a production build of the app, in a real Chromium, against the
// real API and a real database of its own. Only email, payments and the clock
// are faked (packages/server/tests/e2e/server.ts). Tests share that database,
// so they run one at a time.
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: appUrl },
  webServer: [
    {
      command: "pnpm --filter @empire-cleaning/server e2e:server",
      url: `${controlUrl}/health`,
      env: {
        ...process.env,
        APP_MODE: "dev",
        PORT: String(API_PORT),
        E2E_CONTROL_PORT: String(CONTROL_PORT),
        DB_URL: "postgresql://postgres:password@localhost:5432/empire_e2e_test",
        TEST_DB_URL:
          "postgresql://postgres:password@localhost:5432/empire_e2e_test",
        BETTER_AUTH_URL: `http://localhost:${API_PORT}`,
        BETTER_AUTH_SECRET: "e2e-secret-at-least-32-characters-long",
        CORS_ORIGIN_URL: appUrl,
        RESEND_API_KEY: "e2e-resend-api-key",
        GOOGLE_CLIENT_ID: "e2e-google-client-id",
        GOOGLE_CLIENT_SECRET: "e2e-google-client-secret",
      },
    },
    {
      command: `vite build && vite preview --port ${APP_PORT} --strictPort`,
      url: appUrl,
      env: { ...process.env, API_URL: `http://localhost:${API_PORT}` },
    },
  ],
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
