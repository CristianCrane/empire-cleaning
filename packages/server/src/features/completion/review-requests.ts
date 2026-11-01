import { and, eq, gte, isNotNull, isNull, lt, min } from "drizzle-orm";
import { db } from "../../db/index.ts";
import env from "../../env.ts";
import {
  addDays,
  clock,
  dayOf,
  startOfDay,
  timeOf,
} from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { reviewRequestEmail } from "./emails.ts";

// review requests go out from this time, New York, on the day after a
// Client's first Completed Job, a day apart from its receipt
export const REVIEW_REQUEST_TIME = "10:00";

// a Client whose first Completed Job is older than this isn't asked: they
// were served before review requests began, or the server was down for days
export const REVIEW_REQUEST_WITHIN_DAYS = 7;

/**
 * Asks each Client for a Google review, once ever, from 10am on the day after
 * their first Completed Job (New York), whichever of their Properties it was
 * at. None without `reviewUrl` (GOOGLE_REVIEW_URL), or for a Client with no
 * email (ADR-0012). Safe to run as often as you like, and on more than one
 * server: each Client is claimed before their email goes, and let go again
 * if the email fails, so the next run tries again.
 *
 * Nothing calls this but the timer in src/index.ts (and tests).
 */
export const sendDueReviewRequests = async (
  reviewUrl = env.GOOGLE_REVIEW_URL,
) => {
  if (!reviewUrl) return 0;
  const now = clock.now();
  const today = dayOf(now);
  if (timeOf(now) < REVIEW_REQUEST_TIME) return 0;

  const firstCompleted = min(jobs.completedAt);
  const due = await db
    .select({ id: clients.id, name: clients.name, email: clients.email })
    .from(clients)
    .innerJoin(properties, eq(properties.clientId, clients.id))
    .innerJoin(jobs, eq(jobs.propertyId, properties.id))
    .where(
      and(
        isNull(clients.reviewRequestedAt),
        isNotNull(clients.email),
        eq(jobs.status, "completed"),
      ),
    )
    .groupBy(clients.id)
    .having(
      and(
        lt(firstCompleted, startOfDay(today)),
        gte(
          firstCompleted,
          startOfDay(addDays(today, -REVIEW_REQUEST_WITHIN_DAYS)),
        ),
      ),
    );

  let sent = 0;
  for (const client of due) {
    const [claimed] = await db
      .update(clients)
      .set({ reviewRequestedAt: now })
      .where(and(eq(clients.id, client.id), isNull(clients.reviewRequestedAt)))
      .returning({ id: clients.id });
    if (!claimed) continue;

    try {
      await email.send({
        to: client.email!,
        ...reviewRequestEmail({ name: client.name, reviewUrl }),
      });
      sent += 1;
    } catch (error) {
      console.error(`review request for Client ${client.id} not sent:`, error);
      await db
        .update(clients)
        .set({ reviewRequestedAt: null })
        .where(eq(clients.id, client.id));
    }
  }
  return sent;
};
