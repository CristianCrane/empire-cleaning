import { execFile } from "node:child_process";
import { availableParallelism } from "node:os";
import { promisify } from "node:util";
import { beforeAll, expect, test } from "vitest";
import { addDays } from "#services/clock";
import {
  copyTestDatabase,
  TEST_DB_URL,
  withSuffix,
} from "./setup/testDatabase.ts";

// The seed (seed.ts) lays out its demo by days from today, so where its cleans
// fall, and which Cleaner each lands beside, turns on the weekday and the time
// of day it runs (#238). It's run as the test site's reset runs it, as if it
// were each day of one week, in New York: before the day's first clean,
// midday, after its last, and late in the evening, which is already
// tomorrow in UTC.
const MONDAY = "2026-11-09";
const instants = Array.from({ length: 7 }, (_, i) =>
  addDays(MONDAY, i),
).flatMap((day) => [
  `${day}T12:00:00Z`,
  `${day}T17:00:00Z`,
  `${day}T23:30:00Z`,
  `${addDays(day, 1)}T03:00:00Z`,
]);

// a database each, copied from the migrated template. Numbered past the
// workers' own, so the next run's setup drops any left behind
// (dropTestDatabaseCopies)
const databaseFor = (i: number) => withSuffix(TEST_DB_URL, 100 + i);
beforeAll(() =>
  copyTestDatabase(
    TEST_DB_URL,
    instants.map((_, i) => databaseFor(i)),
  ),
);

const run = promisify(execFile);

// the line saying why, from what the seed printed as it failed
const whyFailed = (error: unknown) => {
  const stderr = (error as { stderr?: string }).stderr ?? String(error);
  return stderr.match(/^\w*Error: .*$/m)?.[0] ?? stderr.slice(-500);
};

// the seed at `now` on database `i`: why it failed, or nothing
const seedAt = async (now: string, i: number) => {
  try {
    await run(process.execPath, ["--import", "tsx", "tests/seed.ts"], {
      cwd: new URL("..", import.meta.url).pathname,
      env: {
        ...process.env,
        DB_URL: databaseFor(i),
        SEED_NOW: now,
        APP_MODE: "test",
        // which test mode needs, and the tests leave out (setup/testEnv.ts)
        BETTER_AUTH_URL: "http://localhost:3000",
      },
    });
    return [];
  } catch (error) {
    return [`${now}: ${whyFailed(error)}`];
  }
};

// a few seeds at a time: each loads the whole server and keeps up to 13
// connections (src/db/index.ts), and all of them at once ran the test
// Postgres out of connections
const AT_ONCE = Math.max(2, Math.floor(availableParallelism() / 2));

// one test, the seeds side by side: Vitest's own concurrent tests would each
// empty the worker's database at once (setup/perTest.ts)
test("the seed runs on every day of the week, at any time of day", async () => {
  const queue = instants.map((now, i) => ({ now, i }));
  const failed: string[] = [];
  await Promise.all(
    Array.from({ length: AT_ONCE }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        failed.push(...(await seedAt(next.now, next.i)));
      }
    }),
  );
  expect(failed.sort()).toEqual([]);
}, 600_000);
