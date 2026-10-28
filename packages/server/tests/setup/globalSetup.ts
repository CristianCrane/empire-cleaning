import {
  copyTestDatabase,
  recreateTestDatabase,
  TEST_DB_URL,
  TEST_WORKERS,
  withSuffix,
} from "./testDatabase.ts";

// Test files run in parallel, each worker on a database of its own
// (setup/workerDatabase.ts): copies of one migrated here, so the migrations
// run once.
export async function setup() {
  await recreateTestDatabase(TEST_DB_URL);
  for (let worker = 1; worker <= TEST_WORKERS; worker++) {
    await copyTestDatabase(TEST_DB_URL, withSuffix(TEST_DB_URL, worker));
  }
}
