import { availableParallelism } from "node:os";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// the test suite owns this database: it is dropped and recreated on every run.
// It is on the test Postgres (docker-compose.yml, port 5433), not the dev one.
export const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  "postgresql://postgres:password@localhost:5433/empire_test";

export const MIGRATIONS_FOLDER = new URL("../../drizzle", import.meta.url)
  .pathname;

// how many test files run at once, each worker on a database of its own;
// SERVER_TEST_WORKERS overrides it
export const TEST_WORKERS = Number(
  process.env.SERVER_TEST_WORKERS ??
    Math.max(1, Math.floor(availableParallelism() / 2)),
);

const nameOf = (url: string) => new URL(url).pathname.slice(1);

// the same database with `_<suffix>` on its name, e.g. one per test worker
export const withSuffix = (url: string, suffix: string | number) => {
  const copy = new URL(url);
  copy.pathname = `/${nameOf(url)}_${suffix}`;
  return copy.toString();
};

// runs `work` on the server's maintenance database, from where databases are
// dropped and created
const asAdmin = async (url: string, work: (admin: pg.Client) => unknown) => {
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await work(admin);
  } finally {
    await admin.end();
  }
};

const assertTestDatabase = (name: string) => {
  if (!/^[a-z0-9_]+$/.test(name) || !name.includes("test")) {
    throw new Error(`refusing to recreate "${name}": not a test database`);
  }
};

// drops the database at `url` and creates it again, empty and migrated
export const recreateTestDatabase = async (url: string) => {
  const name = nameOf(url);
  assertTestDatabase(name);
  await asAdmin(url, async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  });

  const db = drizzle(url);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await db.$client.end();
  }
};

// drops the database at `url` and creates it again as a copy of the one at
// `template`, which is much quicker than migrating it again. Nothing may be
// connected to `template` meanwhile.
export const copyTestDatabase = async (template: string, url: string) => {
  const name = nameOf(url);
  assertTestDatabase(name);
  await asAdmin(url, async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(
      `CREATE DATABASE "${name}" TEMPLATE "${nameOf(template)}"`,
    );
  });
};
