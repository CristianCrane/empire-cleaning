import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { MIGRATIONS_FOLDER, TEST_DB_URL } from "./testDatabase.ts";

const testDbName = () => new URL(TEST_DB_URL).pathname.slice(1);

// connect to the server's maintenance database to (re)create the test database
const adminUrl = () => {
  const url = new URL(TEST_DB_URL);
  url.pathname = "/postgres";
  return url.toString();
};

export async function setup() {
  const name = testDbName();
  if (!/^[a-z0-9_]+$/.test(name) || !name.includes("test")) {
    throw new Error(`refusing to recreate "${name}": not a test database`);
  }

  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const db = drizzle(TEST_DB_URL);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await db.$client.end();
  }
}
