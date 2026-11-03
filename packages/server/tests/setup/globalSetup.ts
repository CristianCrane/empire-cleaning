import type { TestProject } from "vitest/node";
import {
  copyTestDatabase,
  dropTestDatabaseCopies,
  recreateTestDatabase,
  TEST_DB_URL,
  withSuffix,
} from "./testDatabase.ts";

declare module "vitest" {
  export interface ProvidedContext {
    // how many workers there are, each with a database of its own
    testWorkers: number;
  }
}

// Test files run in parallel, each worker on a database of its own
// (setup/workerDatabase.ts): copies of one migrated here, so the migrations
// run once. One per worker the run really has: `--maxWorkers` overrides
// TEST_WORKERS (vitest.config.ts).
export async function setup(project: TestProject) {
  const workers = project.config.maxWorkers;
  await recreateTestDatabase(TEST_DB_URL);
  await dropTestDatabaseCopies(TEST_DB_URL, workers + 1);
  await copyTestDatabase(
    TEST_DB_URL,
    Array.from({ length: workers }, (_, i) => withSuffix(TEST_DB_URL, i + 1)),
  );
  project.provide("testWorkers", workers);
}
