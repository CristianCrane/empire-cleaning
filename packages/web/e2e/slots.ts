import { availableParallelism } from "node:os";

// Tests run in parallel, and each Playwright worker has a slot of its own: an
// API with its control server and database, and the built app in front of it
// (playwright.config.ts). A slot's tests never see another slot's data, emails
// or clock.

// `--workers` (or `-j`) on Playwright's command line: a count, or a share of
// the CPU cores. Playwright applies it only after loading the config, so it's
// read here too, and a run starts a slot for each worker it really has
const workersFlag = () => {
  const value = /(?:^| )(?:--workers|-j)[= ]?(\S+)/.exec(
    process.argv.join(" "),
  )?.[1];
  if (!value?.endsWith("%")) return value;
  const share = Number(value.slice(0, -1)) / 100;
  return String(Math.max(1, Math.floor(availableParallelism() * share)));
};

const workerCount = (value: string | undefined) => {
  // half the CPU cores, up to 6: more weren't faster
  if (value === undefined) {
    return Math.max(1, Math.min(6, Math.floor(availableParallelism() / 2)));
  }
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(
      `E2E_WORKERS or --workers must be a whole number of 1 or more, not "${value}"`,
    );
  }
  return count;
};

// E2E_WORKERS overrides it. playwright.config.ts hands it on to the processes
// Playwright starts, whose command lines don't have the flag
export const WORKERS = workerCount(process.env.E2E_WORKERS ?? workersFlag());

// the slots' databases: each API makes its own from this one's name and its
// slot's number (packages/server/tests/e2e/server.ts)
export const E2E_DB_URL =
  "postgresql://postgres:password@localhost:5433/empire_e2e_test";

export const slotOf = (slot: number) => ({
  apiUrl: `http://localhost:${3100 + slot * 10}`,
  controlUrl: `http://127.0.0.1:${3101 + slot * 10}`,
  appUrl: `http://localhost:${4173 + slot}`,
});

// the slot of the worker this runs in (Playwright numbers them from 0); slot 0
// in Playwright's own process
const index = Number(process.env.TEST_PARALLEL_INDEX ?? 0);
if (index >= WORKERS) {
  throw new Error(`worker ${index} has no slot: there are ${WORKERS}`);
}
export const slot = slotOf(index);
