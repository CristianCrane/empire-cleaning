// the test suite owns this database: it is dropped and recreated on every run
export const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  "postgresql://postgres:password@localhost:5432/empire_test";

export const MIGRATIONS_FOLDER = new URL("../../drizzle", import.meta.url)
  .pathname;
