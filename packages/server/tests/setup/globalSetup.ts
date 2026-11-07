import type { TestProject } from "vitest/node";
import { migratedCopies, TEST_DB_URL } from "./testDatabase.ts";

declare module "vitest" {
  export interface ProvidedContext {
    // how many workers there are, each with a database of its own
    testWorkers: number;
  }
}

// Test files run in parallel, each worker on a database of its own
// (setup/workerDatabase.ts): copies of one migrated here, so the migrations
// run once. One per worker the run really has: `--maxWorkers` overrides
// TEST_WORKERS (vitest.config.ts). The run's, not the project's: its projects
// share the one setting
export async function setup(project: TestProject) {
  const workers = project.globalConfig.maxWorkers;
  await migratedCopies(TEST_DB_URL, 1, workers);
  project.provide("testWorkers", workers);
}
