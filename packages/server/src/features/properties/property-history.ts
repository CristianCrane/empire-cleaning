import { and, asc, eq, inArray } from "drizzle-orm";
import type {
  OfficePropertyView,
  PropertyStatus,
  QuoteKind,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { jobViews } from "../jobs/schedule.ts";
import { propertyServicePlan } from "../service-plans/service-plans.ts";
import {
  firstCleansOf,
  offers,
  quotesForProperty,
  statusOf as quoteStatusOf,
} from "../quotes/quote-state.ts";
import { quotes } from "../quotes/quotes.schema.ts";
import { siteVisits } from "../site-visits/site-visits.schema.ts";
import { siteVisitViews } from "../site-visits/views.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { properties } from "./properties.schema.ts";
import { toPropertyView } from "./property-view.ts";

// A Property for the Office with its whole history (ADR-0011): every Quote
// and every Job, newest first
export const officePropertyView = async (
  id: string,
): Promise<OfficePropertyView | undefined> => {
  const [row] = await db
    .select({ property: properties, client: clients })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, id));
  if (!row) return undefined;

  const [ownQuotes, ownJobs, firstCleans, servicePlan, list, visits] =
    await Promise.all([
      quotesForProperty(id),
      jobViews(eq(jobs.propertyId, id)),
      firstCleansOf([id]),
      propertyServicePlan(id),
      currentPriceList(),
      siteVisitViews(eq(siteVisits.propertyId, id)),
    ]);
  return {
    ...toPropertyView(row.property, list),
    client: {
      id: row.client.id,
      name: row.client.name,
      businessName: row.client.businessName,
    },
    firstCleanCompleted: firstCleans.has(id),
    servicePlan,
    quotes: ownQuotes,
    jobs: ownJobs.reverse(),
    // newest first: by when it is, or for findings without a visit, when
    // they were recorded
    siteVisits: visits.sort((a, b) =>
      (b.startsAt ?? b.doneAt!).localeCompare(a.startsAt ?? a.doneAt!),
    ),
    findingsRecorded: visits.some((v) => v.status === "done"),
    officeNotes: row.property.officeNotes,
  };
};

/**
 * Where each Property stands, the most pressing first: a Quote asked for
 * waiting on the Office, then an open Sent Quote (a Service Plan Quote before a one-off
 * one), then its next booked Job, then a Completed First Clean.
 */
export const propertyStatuses = async (propertyIds: string[]) => {
  const statuses = new Map<string, PropertyStatus>();
  if (propertyIds.length === 0) return statuses;

  const [open, booked, firstCleans] = await Promise.all([
    db
      .select({
        propertyId: quotes.propertyId,
        kind: quotes.kind,
        origin: quotes.origin,
        status: quotes.status,
        expiresAt: offers.expiresAt,
      })
      .from(quotes)
      .leftJoin(offers, eq(offers.id, quotes.sentRevisionId))
      .where(
        and(
          inArray(quotes.propertyId, propertyIds),
          inArray(quotes.status, ["requested", "draft", "sent"]),
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
  // asked for, with nothing Sent yet
  const waiting = new Set(
    open
      .filter((q) => q.origin !== "office" && q.status !== "sent")
      .map((q) => q.propertyId),
  );
  const statusOf = (id: string): PropertyStatus => {
    if (waiting.has(id)) return { kind: "quote_requested" };
    const sent = new Set<QuoteKind>(
      open
        .filter((q) => q.propertyId === id && quoteStatusOf(q) === "sent")
        .map((q) => q.kind!),
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
