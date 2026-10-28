import { TEST_DB_URL, withSuffix } from "./testDatabase.ts";

// each worker has a database of its own, made by setup/globalSetup.ts, so
// test files can run in parallel. Before anything imports the app, which
// connects on import.
process.env.DB_URL = withSuffix(TEST_DB_URL, process.env.VITEST_POOL_ID!);
