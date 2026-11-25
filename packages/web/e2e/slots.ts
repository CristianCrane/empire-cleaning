import { availableParallelism } from "node:os";
import { E2E_PORTS, MAX_SLOTS, slotPorts } from "@empire-cleaning/server/ports";

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

// at most the slots the block of ports has room for (MAX_SLOTS)
const workerCount = (value: string | undefined) => {
  // two: alone it's as fast as 6 for the specs a change touches, and two
  // runs at once (two checkouts) stay green, where at 6 each both slowed and
  // one failed (#309). CI's 4-core runners came to 2 already
  if (value === undefined) return 2;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_SLOTS) {
    throw new Error(
      `E2E_WORKERS or --workers must be a whole number from 1 to ${MAX_SLOTS}, not "${value}"`,
    );
  }
  return count;
};

// E2E_WORKERS overrides it. playwright.config.ts hands it on to the processes
// Playwright starts, whose command lines don't have the flag
export const WORKERS = workerCount(process.env.E2E_WORKERS ?? workersFlag());

// the slots' databases are named from this one: copies, numbered by slot, of
// one migrated for the run under a name of its own
// (packages/server/tests/e2e/servers.ts)
export const E2E_DB_URL =
  "postgresql://postgres:password@localhost:5433/empire_e2e_test";

// each slot's three servers, on its ports from the block (the server's
// tests/ports.ts)
export const slotOf = (slot: number) => {
  const { api, control, app } = slotPorts(slot);
  return {
    apiUrl: `http://localhost:${api}`,
    controlUrl: `http://127.0.0.1:${control}`,
    appUrl: `http://localhost:${app}`,
  };
};

// where the run builds the app, and e2e/preview.ts serves it from: a folder
// named for the run's block, as another run in this checkout may be building
// at the same time, and a build empties its folder first. Inside dist/, so
// every tool that skips a build skips it
export const appBuild = `dist/e2e-${E2E_PORTS}`;

// the slot of the worker this runs in (Playwright numbers them from 0); slot 0
// in Playwright's own process
const index = Number(process.env.TEST_PARALLEL_INDEX ?? 0);
if (index >= WORKERS) {
  throw new Error(`worker ${index} has no slot: there are ${WORKERS}`);
}
export const slot = slotOf(index);
