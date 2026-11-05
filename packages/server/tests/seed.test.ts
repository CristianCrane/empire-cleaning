import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, test } from "vitest";
import { addDays } from "#services/clock";
import {
  copyTestDatabase,
  dropTestDatabaseCopies,
  recreateTestDatabase,
  TEST_DB_URL,
  withSuffix,
} from "./setup/testDatabase.ts";

// The seed (seed.ts) lays out its demo by days from today, so where its cleans
// fall, and which Cleaner each lands beside, turns on the weekday and the time
// of day it runs (#238). It's run as the test site's reset runs it, as if it
// were each day of one week, in New York: before the day's first clean,
// midday, after its last, and late in the evening, which is already
// tomorrow in UTC. Its own config runs it apart from the other tests
// (vitest.seed.config.ts).
const MONDAY = "2026-11-09";
const instants = Array.from({ length: 7 }, (_, i) =>
  addDays(MONDAY, i),
).flatMap((day) => [
  `${day}T12:00:00Z`,
  `${day}T17:00:00Z`,
  `${day}T23:30:00Z`,
  `${addDays(day, 1)}T03:00:00Z`,
]);

// a database each, copied from one migrated for the seed test alone, and
// dropped after: the test Postgres keeps them in memory
const TEMPLATE = withSuffix(TEST_DB_URL, "seed");
const databaseFor = (i: number) => withSuffix(TEMPLATE, i);
beforeAll(async () => {
  await recreateTestDatabase(TEMPLATE);
  await copyTestDatabase(
    TEMPLATE,
    instants.map((_, i) => databaseFor(i)),
  );
});
afterAll(() => dropTestDatabaseCopies(TEMPLATE, 0));

const run = promisify(execFile);

// the line saying why, from what the seed printed as it failed
const whyFailed = (error: unknown) => {
  const stderr = (error as { stderr?: string }).stderr ?? String(error);
  return stderr.match(/^\w*Error: .*$/m)?.[0] ?? stderr.slice(-500);
};

// as many at once as the config allows (maxConcurrency)
describe.concurrent("the seed runs", () => {
  test.each(instants.map((now, i) => ({ now, i })))(
    "as if at $now",
    async ({ now, i }) => {
      try {
        await run(process.execPath, ["--import", "tsx", "tests/seed.ts"], {
          cwd: new URL("..", import.meta.url).pathname,
          env: {
            ...process.env,
            DB_URL: databaseFor(i),
            SEED_NOW: now,
            APP_MODE: "test",
            // which test mode needs, and the tests leave out
            // (setup/testEnv.ts)
            BETTER_AUTH_URL: "http://localhost:3000",
          },
        });
      } catch (error) {
        throw new Error(whyFailed(error));
      }
    },
  );
});
