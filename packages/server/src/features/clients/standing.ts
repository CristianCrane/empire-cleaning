import { and, eq, exists, gt, gte, inArray, ne, or, sql } from "drizzle-orm";
import type { ClientStanding } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { offers } from "../quotes/quote-state.ts";
import { quotes } from "../quotes/quotes.schema.ts";
import { servicePlans } from "../service-plans/service-plans.schema.ts";
import { clients } from "./clients.schema.ts";

export const clientStandings = ["active", "quoting", "past"] as const;

// how far back a Job keeps its Client Active
export const ACTIVE_FOR_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

// a Client's standing, worked out in the query that lists them (#96): Active
// with a Service Plan (active or On Hold) or a Job, not cancelled, coming up
// or in the last 90 days; otherwise Quoting while a Quote is open (Requested,
// Draft, or Sent and not yet Expired); otherwise Past. By the Clock.
export const standingOfClient = () => {
  const now = clock.now();
  const since = new Date(now.getTime() - ACTIVE_FOR_DAYS * DAY_MS);
  const theirs = eq(properties.clientId, clients.id);

  const hasPlan = exists(
    db
      .select({ one: sql`1` })
      .from(servicePlans)
      .innerJoin(properties, eq(properties.id, servicePlans.propertyId))
      .where(and(theirs, inArray(servicePlans.status, ["active", "on_hold"]))),
  );
  const hasRecentJob = exists(
    db
      .select({ one: sql`1` })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(
        and(theirs, ne(jobs.status, "cancelled"), gte(jobs.startsAt, since)),
      ),
  );
  const hasOpenQuote = exists(
    db
      .select({ one: sql`1` })
      .from(quotes)
      .innerJoin(properties, eq(properties.id, quotes.propertyId))
      .leftJoin(offers, eq(offers.id, quotes.sentRevisionId))
      .where(
        and(
          theirs,
          or(
            inArray(quotes.status, ["requested", "draft"]),
            and(eq(quotes.status, "sent"), gt(offers.expiresAt, now)),
          ),
        ),
      ),
  );

  return sql<ClientStanding>`case when ${or(hasPlan, hasRecentJob)} then 'active' when ${hasOpenQuote} then 'quoting' else 'past' end`;
};
