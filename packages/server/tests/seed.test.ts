import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, test } from "vitest";
import { addDays } from "@empire-cleaning/models";
import {
  copiesOf,
  dropTestDatabaseCopies,
  migratedCopies,
  TEST_DB_URL,
  withSuffix,
} from "./setup/testDatabase.ts";

// The seed (seed.ts) lays out its demo by days from today, so where its cleans
// fall, and which Cleaner each lands beside, turns on the weekday and the time
// of day it runs (#238). It's run as the test site's reset runs it, as if it
// were each day of one week, in New York: before the day's first clean,
// midday, after its last, and late in the evening, which is already
// tomorrow in UTC. A Vitest project of its own runs it after the other
// tests (vitest.config.ts).
const MONDAY = "2026-11-09";
const every = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i)).flatMap(
  (day) => [
    `${day}T12:00:00Z`,
    `${day}T17:00:00Z`,
    `${day}T23:30:00Z`,
    `${addDays(day, 1)}T03:00:00Z`,
  ],
);

// SEED_SHARD=<n>/<of> runs every <of>th instant from the <n>th, so CI's seed
// jobs share them out (.github/workflows/ci.yml); without it, every one
const shardOf = (value = "1/1") => {
  const [, part, of] = (value.match(/^(\d+)\/(\d+)$/) ?? []).map(Number);
  if (!part || !of || part > of) {
    throw new Error(`SEED_SHARD must be like 1/2, not "${value}"`);
  }
  return every.filter((_, i) => i % of === part - 1);
};
const instants = shardOf(process.env.SEED_SHARD);

// a database each, copied from one migrated for the seed test alone, and
// dropped after: the test Postgres keeps them in memory
const TEMPLATE = withSuffix(TEST_DB_URL, "seed");
const databases = copiesOf(TEMPLATE, 0, instants.length);
beforeAll(() => migratedCopies(TEMPLATE, 0, instants.length));
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
            DB_URL: databases[i],
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
