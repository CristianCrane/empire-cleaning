import { availableParallelism } from "node:os";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { CHECKOUT } from "../checkout.ts";

const MIGRATIONS_FOLDER = new URL("../../drizzle", import.meta.url).pathname;

// a count of workers from the environment, or `fallback` when it isn't set
const workerCount = (name: string, fallback: number) => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(
      `${name} must be a whole number of 1 or more, not "${value}"`,
    );
  }
  return count;
};

// how many test files run at once, each worker on a database of its own: half
// the CPU cores, up to 6. Each worker loads the whole server and keeps up to 13 connections
// (src/db/index.ts), so many more would crowd the CPU and the test Postgres's
// connections (docker-compose.yml).
// SERVER_TEST_WORKERS overrides it
export const TEST_WORKERS = workerCount(
  "SERVER_TEST_WORKERS",
  Math.max(1, Math.min(6, Math.floor(availableParallelism() / 2))),
);

const nameOf = (url: string) => new URL(url).pathname.slice(1);

// the same database with `_<suffix>` on its name, e.g. one per test worker
export const withSuffix = (url: string, suffix: string | number) => {
  const copy = new URL(url);
  copy.pathname = `/${nameOf(url)}_${suffix}`;
  return copy.toString();
};

// the test suite owns this database: it is dropped and recreated on every run.
// It is on the test Postgres (docker-compose.yml, port 5433), not the dev one,
// and its name ends in this checkout's id (tests/checkout.ts), so another
// checkout's run never drops it: `empire_test_<id>`, or TEST_DB_URL's name
export const TEST_DB_URL = withSuffix(
  process.env.TEST_DB_URL ??
    "postgresql://postgres:password@localhost:5433/empire_test",
  CHECKOUT,
);

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
const recreateTestDatabase = async (url: string) => {
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

// drops the databases at `urls` and creates them again as copies of the one at
// `template`, which is much quicker than migrating them again
const copyTestDatabase = async (template: string, urls: string[]) => {
  const names = urls.map(nameOf);
  names.forEach(assertTestDatabase);
  await asAdmin(template, async (admin) => {
    // a copy fails while anything is connected to its template, and Postgres
    // may still be closing the connection that just migrated it
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [nameOf(template)],
    );
    for (const name of names) {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.query(
        `CREATE DATABASE "${name}" TEMPLATE "${nameOf(template)}"`,
      );
    }
  });
};

// drops the copies of the database at `url` (see withSuffix) numbered `from`
// and up: ones an earlier run with more workers left behind, or the seed
// test's own once it's done (tests/seed.test.ts). The test Postgres keeps its
// databases in memory.
export const dropTestDatabaseCopies = async (url: string, from: number) => {
  const name = nameOf(url);
  await asAdmin(url, async (admin) => {
    const { rows } = await admin.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname ~ $1",
      [`^${name}_[0-9]+$`],
    );
    for (const { datname } of rows) {
      if (Number(datname.slice(name.length + 1)) < from) continue;
      assertTestDatabase(datname);
      await admin.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  });
};

// the URLs of `count` copies of the database at `template`, numbered from
// `first` (see withSuffix)
export const copiesOf = (template: string, first: number, count: number) =>
  Array.from({ length: count }, (_, i) => withSuffix(template, first + i));

// migrates the database at `template` once and copies it to `count` databases
// numbered from `first` (copiesOf), dropping copies numbered past them that an
// earlier run left
export const migratedCopies = async (
  template: string,
  first: number,
  count: number,
) => {
  await recreateTestDatabase(template);
  await dropTestDatabaseCopies(template, first + count);
  await copyTestDatabase(template, copiesOf(template, first, count));
};
