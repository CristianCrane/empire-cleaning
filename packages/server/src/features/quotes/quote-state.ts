import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  QuoteAsked,
  QuoteStatus,
  QuoteSummary,
  RevisionSummary,
  Service,
  SiteVisitStage,
  Weekday,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { properties } from "../properties/properties.schema.ts";
import { toPropertyView } from "../properties/property-view.ts";
import { servicePlans } from "../service-plans/service-plans.schema.ts";
import { services } from "../services/services.schema.ts";
import { choiceOf, currentServices, serviceOf } from "../services/services.ts";
import { siteVisitStages } from "../site-visits/site-visits.ts";
import { askedAddOns } from "./asked-add-ons.ts";
import {
  quoteRevisions,
  quotes,
  revisionOptions,
  type Quote,
  type Revision,
  type RevisionOptionRow,
} from "./quotes.schema.ts";

// a Quote's latest Sent Revision, joined as "offers"
export const offers = alias(quoteRevisions, "offers");

// A Sent Quote Expires at the end of its offer's validity or at its proposed
// time, whichever is first, by the Clock; nothing needs to run for that to
// happen. `expiresAt` is the offer's.
export const statusOf = (quote: {
  status: Quote["status"];
  expiresAt: Date | null;
}): QuoteStatus =>
  quote.status === "sent" && quote.expiresAt! <= clock.now()
    ? "expired"
    : quote.status;

// Requested, Draft and Sent Quotes are open: a Property has at most one
// one-off Quote per Service and one Service Plan Quote, a Requested one
// counting as both where its Service can recur (ADR-0018)
export const isOpen = (status: QuoteStatus) =>
  status === "requested" || status === "draft" || status === "sent";

// still being worked on by the Office: nothing has been Sent
export const unsent = (status: QuoteStatus) =>
  status === "requested" || status === "draft";

// what a Quote was asked for, or null if the Office offered it unprompted
export const askedOf = (
  quote: Quote,
  addOns: QuoteAsked["addOns"],
  all: Service[],
): QuoteAsked | null =>
  quote.origin === "office"
    ? null
    : {
        service: choiceOf(serviceOf(all, quote.askedServiceKey!)),
        condition: quote.condition,
        wantsRegularService: quote.wantsRegularService,
        weekdays: quote.weekdays as Weekday[],
        preferredTime: quote.preferredTime,
        notes: quote.notes,
        addOns,
      };

// the options of these Revisions, by Revision
export const optionsOfRevisions = async (revisionIds: string[]) => {
  if (revisionIds.length === 0) return new Map<string, RevisionOptionRow[]>();
  const rows = await db
    .select()
    .from(revisionOptions)
    .where(inArray(revisionOptions.revisionId, revisionIds))
    .orderBy(asc(revisionOptions.position));
  return Map.groupBy(rows, (o) => o.revisionId);
};

// what a Revision leads with, tax included: a one-off Quote's first option,
// the recommended one where there is one, or a Service Plan Quote's round, a
// clean on each weekday. The options are in order.
export const headlineOf = (
  kind: Quote["kind"],
  options: RevisionOptionRow[],
) =>
  kind === "service_plan"
    ? options.reduce((total, o) => total + o.totalCents, 0)
    : options[0]!.totalCents;

/**
 * Each Property's First Clean, where it's Completed (ADR-0018): the first
 * Job a one-off Quote booked there to be Completed, of a Service that can
 * recur, with that Quote. A Move-out doesn't count. A Service Plan of a
 * Service that needs no Site Visit needs one. Every Property with one, if no
 * ids are given.
 */
export const firstCleansOf = async (propertyIds?: string[]) => {
  const firstCleans = new Map<string, { job: Job; quoteId: string }>();
  if (propertyIds?.length === 0) return firstCleans;
  const done = await db
    .select({ job: jobs, quoteId: quotes.id })
    .from(jobs)
    .innerJoin(quotes, eq(quotes.jobId, jobs.id))
    .innerJoin(services, eq(services.id, jobs.serviceId))
    .where(
      and(
        propertyIds ? inArray(jobs.propertyId, propertyIds) : undefined,
        eq(jobs.status, "completed"),
        eq(quotes.kind, "one_off"),
        eq(services.canRecur, true),
      ),
    )
    .orderBy(asc(jobs.completedAt));
  for (const { job, quoteId } of done) {
    if (!firstCleans.has(job.propertyId)) {
      firstCleans.set(job.propertyId, { job, quoteId });
    }
  }
  return firstCleans;
};

export const firstCleanCompleted = async (propertyId: string) =>
  (await firstCleansOf([propertyId])).has(propertyId);

// whether any Job at the Property is Completed: until one is, a Quote offers
// its Service's first-visit recommendation too (ADR-0018)
export const hasCompletedJob = async (propertyId: string) => {
  const [done] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.propertyId, propertyId), eq(jobs.status, "completed")))
    .limit(1);
  return done !== undefined;
};

// whether any of these Services needs a Site Visit before it's quoted
export const needSiteVisit = (all: Service[], keys: string[]) =>
  keys.some((key) => serviceOf(all, key).needsSiteVisit);

/**
 * The First Cleans whose Property should now be offered a Service Plan,
 * earliest Completed first: the Quote that booked the First Clean asked for
 * regular visits, and no Service Plan Quote there is open, Accepted or
 * Declined (one that Expired or was Turned Down doesn't count).
 */
export const servicePlansDue = async () => {
  const firstCleans = await firstCleansOf();
  if (firstCleans.size === 0) return [];
  const [wanting, offered] = await Promise.all([
    db
      .select({ id: quotes.id })
      .from(quotes)
      .where(
        and(
          inArray(
            quotes.id,
            [...firstCleans.values()].map((f) => f.quoteId),
          ),
          eq(quotes.wantsRegularService, true),
        ),
      ),
    db
      .select({
        propertyId: quotes.propertyId,
        status: quotes.status,
        expiresAt: offers.expiresAt,
      })
      .from(quotes)
      .leftJoin(offers, eq(offers.id, quotes.sentRevisionId))
      .where(
        and(
          inArray(quotes.propertyId, [...firstCleans.keys()]),
          eq(quotes.kind, "service_plan"),
          inArray(quotes.status, ["sent", "accepted", "declined"]),
        ),
      ),
  ]);
  const wanted = new Set(wanting.map((r) => r.id));
  const answered = new Set(
    offered.filter((q) => statusOf(q) !== "expired").map((q) => q.propertyId),
  );
  return [...firstCleans.entries()]
    .filter(
      ([propertyId, { quoteId }]) =>
        wanted.has(quoteId) && !answered.has(propertyId),
    )
    .map(([, { job }]) => ({ jobId: job.id, since: job.completedAt! }));
};

// Where a Quote stands for a Site Visit, only while nothing is Sent: one
// booked, or one needed by its Services with no findings recorded
export const siteVisitOf = (
  status: QuoteStatus,
  stage: "done" | "booked" | undefined,
  needed: boolean,
): SiteVisitStage =>
  !unsent(status)
    ? null
    : stage === "booked"
      ? "booked"
      : stage === undefined && needed
        ? "needed"
        : null;

// Quotes in a list, newest first. A Client sees only their offers (their
// latest Sent Revisions) and what they asked; the Office sees a Draft
// Revision's figures until one is Sent.
const summaries = async (
  where: SQL | undefined,
  { forClient = false } = {},
): Promise<QuoteSummary[]> => {
  const rows = await db
    .select({
      quote: quotes,
      offer: offers,
      client: {
        id: clients.id,
        name: clients.name,
        businessName: clients.businessName,
      },
      property: properties,
      homePlanId: servicePlans.id,
    })
    .from(quotes)
    .leftJoin(offers, eq(offers.id, quotes.sentRevisionId))
    .innerJoin(properties, eq(properties.id, quotes.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .leftJoin(
      servicePlans,
      and(
        eq(servicePlans.propertyId, quotes.propertyId),
        ne(servicePlans.status, "ended"),
      ),
    )
    .where(where)
    .orderBy(desc(quotes.createdAt));
  const ids = rows.map((r) => r.quote.id);
  const drafts =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(quoteRevisions)
          .where(
            and(
              inArray(quoteRevisions.quoteId, ids),
              isNull(quoteRevisions.sentAt),
            ),
          );
  const draftOf = new Map(drafts.map((d) => [d.quoteId, d]));
  const [options, addOns, stages] = await Promise.all([
    optionsOfRevisions([
      ...rows.flatMap((r) => (r.offer ? [r.offer.id] : [])),
      ...(forClient ? [] : drafts.map((d) => d.id)),
    ]),
    askedAddOns(ids),
    siteVisitStages(rows.map((r) => r.property.id)),
  ]);
  const [list, all] = await Promise.all([
    currentPriceList(),
    currentServices(),
  ]);

  return rows.map(
    ({ quote, offer, client, property, homePlanId }): QuoteSummary => {
      const status = statusOf({
        ...quote,
        expiresAt: offer?.expiresAt ?? null,
      });
      const draft = draftOf.get(quote.id);
      const shown: Revision | null =
        offer ?? (forClient ? null : (draft ?? null));
      const offered = shown ? (options.get(shown.id) ?? []) : [];
      const plan = quote.kind === "service_plan";
      return {
        id: quote.id,
        kind: quote.kind,
        // a Draft is still being written: to its Client it's as they asked
        status: forClient && status === "draft" ? "requested" : status,
        origin: quote.origin,
        asked: askedOf(quote, addOns.get(quote.id) ?? [], all),
        service: choiceOf(serviceOf(all, quote.serviceKey)),
        client,
        property: toPropertyView(property, list),
        homePlanId,
        headlineTotalCents:
          offered.length > 0 ? headlineOf(quote.kind, offered) : null,
        plan:
          plan && shown
            ? {
                recurrence: shown.recurrence!,
                days: offered.map((o) => ({
                  startsAt: o.startsAt?.toISOString() ?? null,
                  serviceName: o.suggested.serviceName,
                })),
              }
            : null,
        proposedStartsAt: shown?.proposedStartsAt?.toISOString() ?? null,
        sentAt: offer?.sentAt?.toISOString() ?? null,
        expiresAt: offer?.expiresAt?.toISOString() ?? null,
        drafting: !forClient && draft !== undefined,
        siteVisit: siteVisitOf(
          status,
          stages.get(property.id),
          needSiteVisit(all, [
            quote.serviceKey,
            ...offered.map((o) => o.serviceKey),
          ]),
        ),
        createdAt: quote.createdAt.toISOString(),
      };
    },
  );
};

// Every Sent Revision of a Quote, newest first
export const revisionHistory = async (
  quote: Pick<Quote, "id" | "kind">,
): Promise<RevisionSummary[]> => {
  const sent = await db
    .select()
    .from(quoteRevisions)
    .where(
      and(
        eq(quoteRevisions.quoteId, quote.id),
        isNotNull(quoteRevisions.sentAt),
      ),
    )
    .orderBy(desc(quoteRevisions.number));
  const options = await optionsOfRevisions(sent.map((r) => r.id));
  return sent.map((r) => ({
    id: r.id,
    number: r.number,
    headlineTotalCents: headlineOf(quote.kind, options.get(r.id) ?? []),
    proposedStartsAt: r.proposedStartsAt!.toISOString(),
    sentAt: r.sentAt!.toISOString(),
    expiresAt: r.expiresAt!.toISOString(),
  }));
};

// A Client's own Quotes, newest first: those they asked for (by phone too),
// and any offered to them: one the Office offered unprompted is theirs to
// see once a Revision of it is Sent
export const quotesForClient = (clientId: string) =>
  summaries(
    and(
      eq(properties.clientId, clientId),
      or(ne(quotes.origin, "office"), isNotNull(quotes.sentRevisionId)),
    ),
    { forClient: true },
  );

// every Quote for a Property, newest first (for the Office)
export const quotesForProperty = (propertyId: string) =>
  summaries(eq(quotes.propertyId, propertyId));

// how long an Expired Quote stays on the Office's list, to be revived
export const RECENTLY_EXPIRED_DAYS = 30;

// the Office's open Quotes, newest first: Requested, Draft and Sent, and
// those Expired in the last RECENTLY_EXPIRED_DAYS, which may be revived
export const openQuoteList = () =>
  summaries(
    or(
      inArray(quotes.status, ["requested", "draft"]),
      and(
        eq(quotes.status, "sent"),
        gt(
          offers.expiresAt,
          new Date(clock.now().getTime() - RECENTLY_EXPIRED_DAYS * 86_400_000),
        ),
      ),
    ),
  );

// Quotes someone asked for that wait on the Office, longest waiting first:
// Requested, or a Draft whose first Revision isn't Sent yet
export const quotesAwaitingOffice = async () =>
  (
    await summaries(
      and(
        inArray(quotes.status, ["requested", "draft"]),
        ne(quotes.origin, "office"),
      ),
    )
  ).reverse();

// every Sent Quote still open (not yet Expired), newest first
export const openQuotes = () =>
  summaries(and(eq(quotes.status, "sent"), gt(offers.expiresAt, clock.now())));

// Sent Quotes that Expire within this many hours, soonest first
export const quotesExpiringWithin = async (hours: number) => {
  const now = clock.now();
  const until = new Date(now.getTime() + hours * 3_600_000);
  const expiring = await summaries(
    and(
      eq(quotes.status, "sent"),
      gt(offers.expiresAt, now),
      lte(offers.expiresAt, until),
    ),
  );
  return expiring.sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!));
};
