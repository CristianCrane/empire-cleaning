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
