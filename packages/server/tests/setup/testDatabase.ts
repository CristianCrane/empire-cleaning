import { availableParallelism } from "node:os";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

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

// the database every test run's own are named from (claimTestDatabase): on
// the test Postgres (docker-compose.yml, port 5433), not the dev one.
// TEST_DB_URL sets another
const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  "postgresql://postgres:password@localhost:5433/empire_test";

// the server's maintenance database, from where databases are dropped and
// created
const adminUrlOf = (url: string) => {
  const admin = new URL(url);
  admin.pathname = "/postgres";
  return admin.toString();
};

// runs `work` on the server's maintenance database
const asAdmin = async (url: string, work: (admin: pg.Client) => unknown) => {
  const admin = new pg.Client({ connectionString: adminUrlOf(url) });
  await admin.connect();
  try {
    await work(admin);
  } finally {
    await admin.end();
  }
};

const assertTestDatabase = (name: string) => {
  if (!/^[a-z0-9_]+$/.test(name) || !name.includes("test")) {
    throw new Error(`refusing to drop "${name}": not a test database`);
  }
};

const dropDatabase = (admin: pg.Client, name: string) => {
  assertTestDatabase(name);
  return admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
};

// what a run's hold on its databases is called on the test Postgres
// (claimTestDatabase)
const HOLDER = "empire test run";

const stopRun = (error: Error): void => {
  console.error(error.message);
  process.exit(1);
};

// claims database names of this run's own, so two runs at once, in one
// checkout or two, never drop each other's (#375): `<base>_r<id>`, and copies
// of it (withSuffix), `<base>` being TEST_DB_URL's name. `<id>` is the
// backend pid of a connection held open on the test Postgres while the run
// goes on (`release` ends it, or the process ending does). Pids are unique
// among live connections, and reused only once one ends.
//
// So a database under a name whose holder is gone is a run's that ended, or
// was killed: before naming this run's, the claim drops every one, and with
// them any under this run's own name, which can only be a dead run's whose
// connection had the same pid. A run mid-setup is never taken for dead: its
// holder connects before it makes anything. Should the holder's connection end
// while the run goes on (Postgres restarted, the connection terminated), the
// next claim would take this run for dead and drop its databases under it, so
// `onLost` stops the run then, and by default ends the process saying why
export const claimTestDatabase = async (onLost = stopRun) => {
  const baseName = nameOf(TEST_DB_URL);
  const holder = new pg.Client({
    connectionString: adminUrlOf(TEST_DB_URL),
    application_name: HOLDER,
  });
  await holder.connect();
  let done = false;
  const lost = (why: string, cause?: Error) => {
    if (done) return;
    done = true;
    onLost(
      new Error(
        `the test run's hold on its databases (${baseName}_r…) ended, and the next run would drop them: stopping. ${why}`,
        { cause },
      ),
    );
  };
  holder.on("error", (error) => lost(error.message, error));
  holder.on("end", () => lost("Its connection closed."));

  let pid: number;
  try {
    const { rows } = await holder.query<{ datname: string }>(
      `SELECT datname FROM pg_database
       WHERE datname ~ $1 AND substring(datname FROM $1)::int NOT IN (
         SELECT pid FROM pg_stat_activity
         WHERE application_name = $2 AND pid <> pg_backend_pid()
       )`,
      [`^${baseName}_r([0-9]+)(?:_|$)`, HOLDER],
    );
    for (const { datname } of rows) await dropDatabase(holder, datname);
    const {
      rows: [held],
    } = await holder.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    pid = held!.pid;
  } catch (error) {
    done = true;
    await holder.end();
    throw error;
  }
  return {
    url: withSuffix(TEST_DB_URL, `r${pid}`),
    release: async () => {
      done = true;
      await holder.end();
    },
  };
};

// creates the database at `url`, empty and migrated
const createTestDatabase = async (url: string) => {
  await asAdmin(url, (admin) =>
    admin.query(`CREATE DATABASE "${nameOf(url)}"`),
  );

  const db = drizzle(url);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await db.$client.end();
  }
};

// creates the databases at `urls` as copies of the one at `template`, which
// is much quicker than migrating each
const copyTestDatabase = async (template: string, urls: string[]) => {
  await asAdmin(template, async (admin) => {
    // a copy fails while anything is connected to its template, and Postgres
    // may still be closing the connection that just migrated it
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [nameOf(template)],
    );
    for (const url of urls) {
      await admin.query(
        `CREATE DATABASE "${nameOf(url)}" TEMPLATE "${nameOf(template)}"`,
      );
    }
  });
};

// drops every copy of the database at `url` (see withSuffix): the seed
// test's own once it's done (tests/seed.test.ts), as the test Postgres keeps
// its databases in memory
export const dropTestDatabaseCopies = async (url: string) => {
  const name = nameOf(url);
  await asAdmin(url, async (admin) => {
    const { rows } = await admin.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname ~ $1",
      [`^${name}_[0-9]+$`],
    );
    for (const { datname } of rows) await dropDatabase(admin, datname);
  });
};

// the URLs of `count` copies of the database at `template`, numbered from
// `first` (see withSuffix)
export const copiesOf = (template: string, first: number, count: number) =>
  Array.from({ length: count }, (_, i) => withSuffix(template, first + i));

// migrates the database at `template`, a run's own (claimTestDatabase), once
// and copies it to `count` databases numbered from `first` (copiesOf)
export const migratedCopies = async (
  template: string,
  first: number,
  count: number,
) => {
  await createTestDatabase(template);
  await copyTestDatabase(template, copiesOf(template, first, count));
};
