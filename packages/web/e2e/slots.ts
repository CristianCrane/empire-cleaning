import { availableParallelism } from "node:os";

// Tests run in parallel, and each Playwright worker has a slot of its own: an
// API with its control server and database, and the built app in front of it
// (playwright.config.ts). A slot's tests never see another slot's data, emails
// or clock.
export const WORKERS = Number(
  process.env.E2E_WORKERS ??
    Math.max(1, Math.min(6, Math.floor(availableParallelism() / 2))),
);

export const slotOf = (slot: number) => ({
  apiUrl: `http://localhost:${3100 + slot * 10}`,
  controlUrl: `http://127.0.0.1:${3101 + slot * 10}`,
  appUrl: `http://localhost:${4173 + slot}`,
  dbUrl: `postgresql://postgres:password@localhost:5433/empire_e2e_test_${slot}`,
});

// the slot of the worker this runs in (Playwright numbers them from 0); slot 0
// in Playwright's own process
export const slot = slotOf(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
