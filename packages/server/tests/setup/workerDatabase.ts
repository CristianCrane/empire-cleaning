import { inject } from "vitest";
import { withSuffix } from "./testDatabase.ts";

// each worker has a database of its own, made by setup/globalSetup.ts, so
// test files can run in parallel. Before anything imports the app, which
// connects on import: vitest.config.ts runs the setup files in order.
const worker = Number(process.env.VITEST_POOL_ID);
const workers = inject("testWorkers");
if (!Number.isInteger(worker) || worker < 1 || worker > workers) {
  throw new Error(
    `worker ${process.env.VITEST_POOL_ID} has no database: globalSetup.ts made ${workers}`,
  );
}
process.env.DB_URL = withSuffix(inject("testDatabase"), worker);
