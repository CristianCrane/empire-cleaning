import { sql } from "drizzle-orm";
import { db } from "#db";

// how long the database has to answer before the API counts as down
const DATABASE_TIMEOUT_MS = 2000;

// whether the database answers a `select 1` in time (ADR-0007). Stripe and
// Resend aren't checked: their outages are signals, not the API being down
export const databaseAnswers = async () => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), DATABASE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      db.execute(sql`select 1`).then(() => true),
      timeout,
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
