import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { seenTours } from "./tours.schema.ts";

// first-time help: which tours an Account has seen, kept on the Account so
// one seen on the phone doesn't come back on the laptop. Closing a tour
// partway counts as seeing it; the web app marks it either way

export const toursSeenBy = async (accountId: string) =>
  (
    await db
      .select({ tour: seenTours.tour })
      .from(seenTours)
      .where(eq(seenTours.accountId, accountId))
      .orderBy(seenTours.tour)
  ).map((r) => r.tour);

export const markTourSeen = async (accountId: string, tour: string) => {
  await db.insert(seenTours).values({ accountId, tour }).onConflictDoNothing();
};

// Show tips again: every tour shows once more
export const forgetToursSeen = async (accountId: string) => {
  await db.delete(seenTours).where(eq(seenTours.accountId, accountId));
};
