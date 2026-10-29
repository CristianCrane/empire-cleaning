import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import type { JobList, JobsTab } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { jobs } from "./jobs.schema.ts";
import { jobViews } from "./schedule.ts";

export const jobsTabs = ["upcoming", "past", "cancelled"] as const;

// how many Jobs a page of the list holds unless more are asked for
export const JOBS_PAGE = 50;

// the Tab a Job is under: Upcoming while booked, Cancelled once cancelled
// (or Skipped), Past once Completed or No Access
const tabOf = sql<JobsTab>`case
  when ${jobs.status} = 'booked' then 'upcoming'
  when ${jobs.status} = 'cancelled' then 'cancelled'
  else 'past' end`;

// matches anywhere in the text, ignoring case: "pine" finds "30 Pine Ave"
const containing = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

// The first `limit` of the Office's Jobs under this Tab, or under any, and
// how many there are under each. Upcoming runs soonest first, the others
// newest first. With a search, only those whose Client's name, business
// name or email, or whose home's address, matches.
export const listJobs = async ({
  search,
  tab = "all",
  limit = JOBS_PAGE,
}: {
  search?: string;
  tab?: JobsTab | "all";
  limit?: number;
} = {}): Promise<JobList> => {
  const text = search?.trim();
  const pattern = text ? containing(text) : undefined;
  const matches = pattern
    ? or(
        ilike(clients.name, pattern),
        ilike(clients.businessName, pattern),
        ilike(clients.email, pattern),
        // the address as it's shown: "41-12 Austin St, 4B, 11375"
        sql`concat_ws(', ', ${properties.street}, ${properties.unit}, ${properties.postcode}) ilike ${pattern}`,
      )
    : undefined;
  const [page, tallies] = await Promise.all([
    db
      .select({ id: jobs.id })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .innerJoin(clients, eq(clients.id, properties.clientId))
      .where(and(matches, tab === "all" ? undefined : eq(tabOf, tab)))
      .orderBy(
        tab === "upcoming" ? asc(jobs.startsAt) : desc(jobs.startsAt),
        asc(jobs.id),
      )
      .limit(limit),
    db
      .select({ tab: tabOf, n: count() })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .innerJoin(clients, eq(clients.id, properties.clientId))
      .where(matches)
      .groupBy(tabOf),
  ]);

  const ids = page.map((p) => p.id);
  const views = ids.length === 0 ? [] : await jobViews(inArray(jobs.id, ids));
  const byId = new Map(views.map((v) => [v.id, v]));
  const counts = Object.fromEntries(
    jobsTabs.map((t) => [t, tallies.find((x) => x.tab === t)?.n ?? 0]),
  ) as Record<JobsTab, number>;
  return {
    jobs: ids.map((id) => byId.get(id)!),
    counts: {
      ...counts,
      all: jobsTabs.reduce((sum, t) => sum + counts[t], 0),
    },
  };
};
