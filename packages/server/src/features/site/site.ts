import { eq, ne } from "drizzle-orm";
import { db } from "#db";
import env from "../../env.ts";
import { site } from "./site.schema.ts";

type Mode = typeof env.APP_MODE;

// The server marks its database with its APP_MODE as it starts, and a
// database the production server ever ran on stays marked prod, even if a
// dev server is pointed at it later. So scripts that wipe or rewrite data
// can tell production's database apart, whatever their own APP_MODE says.
export const markDatabase = async (mode: Mode = env.APP_MODE) => {
  await db
    .insert(site)
    .values({ mode })
    .onConflictDoUpdate({
      target: site.id,
      set: { mode },
      setWhere: ne(site.mode, "prod"),
    });
};

// the database's mark, or null if no server has run on it yet
export const databaseMode = async (): Promise<Mode | null> => {
  const [row] = await db.select().from(site).where(eq(site.id, 1));
  return row?.mode ?? null;
};

// for scripts that wipe or make up data (the seed, the testers): refuses to
// run in production, or on production's database from anywhere else
export const refuseOnProduction = async (what: string) => {
  if (env.APP_MODE === "prod" || (await databaseMode()) === "prod") {
    throw new Error(`${what} never runs on the production database`);
  }
};

// The seed rewrites the whole database over minutes (~7 against the test
// site's, over the network), and the test site's server keeps running
// meanwhile: its scheduler, on the real clock, booked the regulars' plan
// cleans into days the seed had yet to fill around them, and the seed's own
// Quote then found its day full (run 43616542411). So the seed holds this
// lock alone for its run, and each tick shares it, skipping its jobs while
// the seed has it. Held for a session, not a transaction (the seed runs
// through db), on a connection of its own, which is closed to let it go: the
// lock ends with the session, so no unlock can fail and leave it on a pooled
// connection, where it would hold off every later seed
const SEEDING = 4006;

// for the seed: waits out a tick under way, then holds the scheduler off
// until the process ends, or until the returned function lets it go
export const holdSeeding = async () => {
  const client = await db.$client.connect();
  await client.query("select pg_advisory_lock($1)", [SEEDING]);
  // resolves once the connection has closed, and Postgres with it has let
  // the lock go
  return () =>
    new Promise<void>((ended) => {
      client.once("end", ended);
      client.release(true);
    });
};

// for the scheduler: runs `run` unless the seed holds the lock, saying
// whether it ran
export const unlessSeeding = async (run: () => Promise<unknown>) => {
  const client = await db.$client.connect();
  try {
    const { rows } = await client.query<{ free: boolean }>(
      "select pg_try_advisory_lock_shared($1) as free",
      [SEEDING],
    );
    if (!rows[0]!.free) return false;
    await run();
    return true;
  } finally {
    client.release(true);
  }
};
