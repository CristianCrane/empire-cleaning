import type { TestProject } from "vitest/node";
import { claimTestDatabase, migratedCopies } from "./testDatabase.ts";

declare module "vitest" {
  export interface ProvidedContext {
    // this run's database (claimTestDatabase): the one each server test
    // worker has a copy of, or the seed test's (seedSetup.ts)
    testDatabase: string;
    // how many workers there are, each with a database of its own
    testWorkers: number;
  }
}

// Test files run in parallel, each worker on a database of its own
// (setup/workerDatabase.ts): copies of one migrated here, so the migrations
// run once, all under names this run claims, so another run in this checkout
// never drops them. One per worker the run really has: `--maxWorkers`
// overrides TEST_WORKERS (vitest.config.ts). The run's, not the project's:
// its projects share the one setting
export async function setup(project: TestProject) {
  const workers = project.globalConfig.maxWorkers;
  const claim = await claimTestDatabase();
  try {
    await migratedCopies(claim.url, 1, workers);
  } catch (error) {
    // else its hold keeps Vitest from exiting
    await claim.release();
    throw error;
  }
  project.provide("testDatabase", claim.url);
  project.provide("testWorkers", workers);
  return claim.release;
}
