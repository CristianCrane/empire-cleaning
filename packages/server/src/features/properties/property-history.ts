import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type {
  OfficePropertyView,
  PropertyStatus,
  QuoteKind,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { jobViews } from "../jobs/schedule.ts";
import { quoteRequests } from "../quote-requests/quote-requests.schema.ts";
import { quoteRequestViews } from "../quote-requests/request-views.ts";
import {
  firstCleansOf,
  quotesForProperty,
  requestStates,
} from "../quotes/quote-state.ts";
import { quotes } from "../quotes/quotes.schema.ts";
import { properties } from "./properties.schema.ts";
import { toPropertyView } from "./property-view.ts";

// A Property for the Office with its whole history (ADR-0011): its requests,
// every Quote (Drafts included) and every Job, newest first
export const officePropertyView = async (
  id: string,
): Promise<OfficePropertyView | undefined> => {
  const [row] = await db
    .select({ property: properties, client: clients })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, id));
  if (!row) return undefined;

  const [requests, ownQuotes, ownJobs, firstCleans] = await Promise.all([
    quoteRequestViews(eq(quoteRequests.propertyId, id)),
    quotesForProperty(id),
    jobViews(eq(jobs.propertyId, id)),
    firstCleansOf([id]),
  ]);
  return {
    ...toPropertyView(row.property),
    client: { id: row.client.id, name: row.client.name },
    firstCleanCompleted: firstCleans.has(id),
    quoteRequests: requests,
    quotes: ownQuotes,
    jobs: ownJobs.reverse(),
  };
};

/**
 * Where each Property stands, the most pressing first: a request waiting on
 * the Office, then an open Sent Quote (a Service Plan Quote before a one-off
 * one), then its next booked Job, then a Completed First Clean.
 */
export const propertyStatuses = async (propertyIds: string[]) => {
  const statuses = new Map<string, PropertyStatus>();
  if (propertyIds.length === 0) return statuses;

  const [requests, open, booked, firstCleans] = await Promise.all([
    db
      .select({ id: quoteRequests.id, propertyId: quoteRequests.propertyId })
      .from(quoteRequests)
      .where(inArray(quoteRequests.propertyId, propertyIds)),
    db
      .select({ propertyId: quotes.propertyId, kind: quotes.kind })
      .from(quotes)
      .where(
        and(
          inArray(quotes.propertyId, propertyIds),
          eq(quotes.status, "sent"),
          gt(quotes.expiresAt, clock.now()),
        ),
      ),
    db
      .select({ propertyId: jobs.propertyId, startsAt: jobs.startsAt })
      .from(jobs)
      .where(
        and(inArray(jobs.propertyId, propertyIds), eq(jobs.status, "booked")),
      )
      .orderBy(asc(jobs.startsAt)),
    firstCleansOf(propertyIds),
  ]);
  const states = await requestStates(requests.map((r) => r.id));
  const waiting = new Set(
    requests
      .filter((r) => states.get(r.id) === "awaiting_quote")
      .map((r) => r.propertyId),
  );
  const statusOf = (id: string): PropertyStatus => {
    if (waiting.has(id)) return { kind: "request_waiting" };
    const sent = new Set<QuoteKind>(
      open.filter((q) => q.propertyId === id).map((q) => q.kind),
    );
    // a plan's offer is the newer news: it follows the First Clean
    const quoteKind = (["service_plan", "one_off"] as const).find((k) =>
      sent.has(k),
    );
    if (quoteKind) return { kind: "quote_sent", quoteKind };
    const next = booked.find((j) => j.propertyId === id);
    if (next) {
      return { kind: "job_booked", startsAt: next.startsAt.toISOString() };
    }
    if (firstCleans.has(id)) return { kind: "first_clean_done" };
    return { kind: "nothing_booked" };
  };

  for (const id of propertyIds) statuses.set(id, statusOf(id));
  return statuses;
};
