import { isDeepStrictEqual } from "node:util";
import { and, asc, eq, inArray, isNull, max, ne } from "drizzle-orm";
import type {
  AddOnChoice,
  ClientQuoteView,
  Condition,
  FirstCleanFindings,
  OfficeQuote,
  OfficeQuoteOption,
  OfficeRevision,
  PlanDayTerms,
  QuoteDraftInput,
  QuoteKind,
  QuoteOption,
  QuoteStatus,
  QuoteView,
  Recurrence,
  ServicePlanInput,
  Service,
  ServicePlanTerms,
  TurnDownReason,
} from "@empire-cleaning/models";
import {
  CANCELLATION_CUTOFF_HOURS,
  ENDS_BY_MIDNIGHT,
  noEmailYet,
  notSeenYet,
  openAlready,
  thisPlace,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import {
  ConflictError,
  fieldError,
  NotFoundError,
} from "../../middleware/errors.ts";
import {
  addDays,
  atTime,
  clock,
  DAY_MS,
  dayOf,
  timeOf,
  weekdayOf,
} from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import { weeklyBillOf } from "../bills/billed-weekly.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { endsByMidnight } from "../jobs/rules.ts";
import { officeCompletionOf } from "../completion/completion.ts";
import { paymentMethodOf, toPaymentMethodView } from "../payments/payments.ts";
import {
  choiceOf,
  currentPricing,
  NOT_A_SERVICE,
  offeredAt,
  oneOffServices,
  onOfferAt,
  serviceNameOf,
  serviceOf,
  type Pricing,
} from "../services/services.ts";
import { CREW_SIZE } from "./quotes.validation.ts";
import {
  goesWith,
  NOT_AN_ADD_ON,
  ownAddOns,
} from "../price-list/price-list.ts";
import { priceLists } from "../price-list/price-list.schema.ts";
import {
  pricedOf,
  suggestedPrice,
  taxOn,
  taxOnPart,
} from "../price-list/suggested-price.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { lockProperty } from "../properties/locking.ts";
import { addressOf, toPropertyView } from "../properties/property-view.ts";
import { planChangeOf } from "../service-plans/changing.ts";
import {
  servicePlans,
  servicePlanVisits,
} from "../service-plans/service-plans.schema.ts";
import { siteVisits } from "../site-visits/site-visits.schema.ts";
import {
  clientSiteVisits,
  findingsRecorded,
  siteVisitStages,
} from "../site-visits/site-visits.ts";
import { siteVisitViews } from "../site-visits/views.ts";
import { askedAddOns } from "./asked-add-ons.ts";
import { quoteEmail, turnDownEmail } from "./emails.ts";
import { percentOf } from "./plan-days.ts";
import { bookableFor } from "./quote-room.ts";
import {
  askedOf,
  firstCleanCompleted,
  firstCleansOf,
  hasCompletedJob,
  isOpen,
  needSiteVisit,
  offers,
  revisionHistory,
  siteVisitOf,
  sourceOf,
  statusOf,
  whatClosed,
} from "./quote-state.ts";
import {
  quoteRevisions,
  quotes,
  revisionOptions,
  type PricedAddOn,
  type Quote,
  type Revision,
  type RevisionOptionRow,
} from "./quotes.schema.ts";
import { monitoring } from "../../services/monitoring/index.ts";
import { hoursOnSiteOf } from "../jobs/jobs.ts";
import { lateFrom } from "../cancellation/cancellation.ts";

// a new Service Plan Quote's terms, until Office Staff change them: not a
// copy of the First Clean, whatever it was
const PLAN_DEFAULTS = {
  recurrence: "fortnightly",
  condition: "moderate",
} as const satisfies {
  recurrence: Recurrence;
  condition: Condition;
};

// A Revision with its Quote's kind, which is set by the first Revision and
// never changes: what prices and shows it
export type KindedRevision = Revision & { kind: QuoteKind };

const kinded = (quote: Quote, revision: Revision): KindedRevision => ({
  ...revision,
  kind: quote.kind!,
});

// whether a Revision for these Services can't be Sent yet: one of them needs
// a Site Visit, and the Property has no findings recorded (ADR-0018)
const needsSiteVisit = async (
  all: Service[],
  property: Pick<Property, "id">,
  serviceKeys: string[],
  tx: Tx | typeof db = db,
) =>
  needSiteVisit(all, serviceKeys) &&
  !(await findingsRecorded([property.id], tx)).has(property.id);

// The Services a Service Plan's days can be at a kind of Property: those on
// offer that can recur, and any `kept` (a day's own, though since retired)
const planServices = (
  all: Service[],
  kind: Property["kind"],
  kept: string[] = [],
) =>
  all.filter(
    (s) =>
      (s.active && s.canRecur && offeredAt(s, kind)) || kept.includes(s.key),
  );

// A new Service Plan Quote's Service, for its first day: the one asked for,
// if it can recur, else the first that can on offer here
const planServiceFor = (
  all: Service[],
  kind: Property["kind"],
  asked: string | null,
) => {
  const choices = planServices(all, kind);
  const service = choices.find((s) => s.key === asked) ?? choices[0];
  if (!service) {
    throw new ConflictError(
      "None of the services here can be on a cleaning plan.",
    );
  }
  return service;
};

// a Property with its Client
const homeOf = async (propertyId: string, tx: Tx | typeof db = db) => {
  const [row] = await tx
    .select({ client: clients, property: properties })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, propertyId));
  return row;
};

// The Add-ons a Quote's Revision for a Service can carry (ADR-0018): those
// that go with the Service, on offer or, if asked for, since retired
const addOnChoices = async (
  list: Pricing,
  quoteId: string,
  serviceKey: string,
): Promise<AddOnChoice[]> => {
  const asked = new Set(
    ((await askedAddOns([quoteId], list)).get(quoteId) ?? []).map((a) => a.key),
  );
  return list.addOns
    .filter((a) => goesWith(a, serviceKey) && (a.active || asked.has(a.key)))
    .map(({ key, name }) => ({ key, name }));
};

// What a Revision is priced for besides the Property and its Add-ons: a
// one-off Quote its Service (and the one recommended for a first visit,
// where that's offered) at the Property's own Condition (moderate while
// business premises have none recorded), undiscounted; a Service Plan Quote
// each of its weekdays' visits at the Condition and Plan Discount on the
// Revision; and for a Service priced by area, the area
type Terms = {
  kind: QuoteKind;
  visits: Visit[];
  condition: Condition | null;
  discountPercent: number;
  area: number | null;
};

// The area a Draft for a Service priced by area follows until Office Staff
// type one (ADR-0018): the Property's floor area, which a Site Visit finds,
// else the rough one the Client gave
const areaFromOf = (
  quote: Pick<Quote, "area">,
  property: Pick<Property, "floorArea">,
): OfficeQuote["areaFrom"] =>
  property.floorArea !== null
    ? { sqFt: property.floorArea, source: "property" }
    : quote.area !== null
      ? { sqFt: quote.area, source: "asked" }
      : null;

// the area a Revision is priced on: its own, else what it follows
const areaOf = (
  revision: Pick<Revision, "area"> | null,
  quote: Pick<Quote, "area">,
  property: Pick<Property, "floorArea">,
) => revision?.area ?? areaFromOf(quote, property)?.sqFt ?? null;

// one visit to price: one of a one-off Quote's Services, or a Service Plan
// Quote's weekday, with its first clean's time
type Visit = {
  position: number;
  serviceKey: string;
  startsAt: Date | null;
  crewSize: number;
  override: { priceCents: number; reason: string } | null;
};

// by the option's Service
type Overrides = Required<QuoteDraftInput>["overrides"];

const oneOffTerms = (
  list: Pricing,
  property: Property,
  service: Service,
  firstVisit: boolean,
  crewSize: number,
  overrides: Overrides,
  area: number | null,
): Terms => ({
  kind: "one_off",
  visits: oneOffServices(list.services, service, property.kind, firstVisit).map(
    (s, position) => ({
      position,
      serviceKey: s.key,
      startsAt: null,
      crewSize,
      override: overrides[s.key] ?? null,
    }),
  ),
  condition: property.condition,
  discountPercent: 0,
  area,
});

const planTerms = (
  plan: { condition: Condition; planDiscountPercent: number },
  days: Omit<Visit, "position">[],
  area: number | null,
): Terms => ({
  kind: "service_plan",
  visits: days.map((day, position) => ({ ...day, position })),
  condition: plan.condition,
  discountPercent: plan.planDiscountPercent,
  area,
});

// The Revision's visits priced from the Price List and each one's Service,
// for the Property as it is now, with the chosen Add-ons that go with that
// Service, and any override in place of the Suggested Price, then any Plan
// Discount off that, overridden or not. Tax is on what's left, at the
// Service's one-off or plan rate, with tax-exempt Add-ons discounted alike.
// Each Add-on is priced at what it adds (PricedAddOn).
const priceOptions = (
  list: Pricing,
  property: Property,
  addOnKeys: string[],
  terms: Terms,
) => {
  const chosen = list.addOns.filter((a) => addOnKeys.includes(a.key));
  const kept = (100 - terms.discountPercent) / 100;
  const priced = pricedOf(property, terms.area);
  // the price before tax, from the one-off price
  const discounted = (oneOffCents: number) =>
    oneOffCents - percentOf(oneOffCents, terms.discountPercent);
  return terms.visits.map(
    ({ position, serviceKey, startsAt, crewSize, override }) => {
      const service = serviceOf(list.services, serviceKey);
      const own = ownAddOns(chosen, serviceKey);
      const suggestedWith = (addOns: typeof own) =>
        suggestedPrice(list, service, priced, terms.condition, addOns);
      const suggested = suggestedWith(own);
      const oneOffCents = override?.priceCents ?? suggested.priceCents;
      const discountCents = percentOf(oneOffCents, terms.discountPercent);
      const priceCents = oneOffCents - discountCents;
      const taxPercent =
        terms.kind === "service_plan"
          ? (service.taxPlanPercent ?? service.taxOneOffPercent)
          : suggested.taxPercent;
      const taxCents = taxOn(priceCents, {
        hourlyRateCents: suggested.hourlyRateCents,
        taxPercent,
        addOns: suggested.addOns.map((a) => ({
          ...a,
          hours: a.hours * kept,
        })),
      });
      const addOns = own.map((addOn): PricedAddOn => {
        const without = suggestedWith(own.filter((a) => a !== addOn));
        // an override's share, as the Suggested Price would have fallen
        const withoutCents = !override
          ? without.priceCents
          : suggested.priceCents === 0
            ? override.priceCents
            : Math.round(
                (override.priceCents * without.priceCents) /
                  suggested.priceCents,
              );
        const addedCents = priceCents - discounted(withoutCents);
        const addedTaxCents = taxOnPart(
          addedCents,
          addOn.taxExempt,
          taxPercent,
        );
        return {
          key: addOn.key,
          name: addOn.name,
          priceCents: addedCents,
          taxCents: addedTaxCents,
          totalCents: addedCents + addedTaxCents,
        };
      });
      return {
        position,
        serviceKey,
        serviceId: service.id,
        startsAt,
        crewSize,
        suggested,
        overrideCents: override?.priceCents ?? null,
        overrideReason: override?.reason ?? null,
        discountCents,
        priceCents,
        taxCents,
        totalCents: priceCents + taxCents,
        addOns,
        labourHours: suggested.labourHours,
      };
    },
  );
};

// an option as priced, before it's written to its Revision
type PricedOption = Omit<RevisionOptionRow, "id" | "revisionId">;

// a Revision's option for its own Service, which has every Add-on it chose:
// a one-off Quote's recommended Service prices only those that go with it
const ownOption = <T extends { serviceKey: string }>(
  revision: Pick<Revision, "serviceKey">,
  rows: T[],
) => rows.find((row) => row.serviceKey === revision.serviceKey)!;

// A Revision's terms as it set them, priced afresh by priceOptions: a one-off
// Quote its own Service (and the one recommended for a first visit, where
// that's offered), crew and overrides; a Service Plan Quote its weekdays,
// Condition and Plan Discount; either its Add-ons and its area, or what that
// follows
const repriced = (
  list: Pricing,
  property: Property,
  quote: Pick<Quote, "area">,
  revision: KindedRevision,
  options: RevisionOptionRow[],
  firstVisit: boolean,
) => {
  const rows = inOrder(options);
  const addOnKeys = ownOption(revision, rows).suggested.addOns.map(
    (a) => a.key,
  );
  const area = areaOf(revision, quote, property);
  const overrideOf = (row: RevisionOptionRow) =>
    row.overrideCents === null
      ? null
      : { priceCents: row.overrideCents, reason: row.overrideReason! };
  const terms =
    revision.kind === "service_plan"
      ? planTerms(
          {
            condition: revision.condition!,
            planDiscountPercent: revision.planDiscountPercent!,
          },
          rows.map((row) => ({ ...row, override: overrideOf(row) })),
          area,
        )
      : oneOffTerms(
          list,
          property,
          serviceOf(list.services, revision.serviceKey),
          firstVisit,
          revision.crewSize,
          Object.fromEntries(rows.map((r) => [r.serviceKey, overrideOf(r)])),
          area,
        );
  return priceOptions(list, property, addOnKeys, terms);
};

// A Service Plan Quote's weekday and its saving, from its option: the
// one-off price, taxed as a one-off Job the way its Suggested Price was,
// against the plan clean's price
const dayTermsOf = (row: PricedOption): PlanDayTerms => {
  const oneOffPriceCents = row.priceCents + row.discountCents;
  const oneOffTaxCents = taxOn(oneOffPriceCents, row.suggested);
  const oneOffTotalCents = oneOffPriceCents + oneOffTaxCents;
  return {
    startsAt: iso(row.startsAt),
    serviceKey: row.serviceKey,
    serviceName: row.suggested.serviceName,
    crewSize: row.crewSize,
    oneOffPriceCents,
    oneOffTaxCents,
    oneOffTotalCents,
    discountCents: row.discountCents,
    savingCents: oneOffTotalCents - row.totalCents,
  };
};

// a Service Plan Quote's terms, from its Revision's options, one for each
// weekday
const planOf = (
  revision: KindedRevision,
  rows: PricedOption[],
): ServicePlanTerms | null => {
  if (revision.kind !== "service_plan") return null;
  const days = inOrder(rows);
  return {
    recurrence: revision.recurrence!,
    discountPercent: revision.planDiscountPercent!,
    days: days.map(dayTermsOf),
    roundTotalCents: days.reduce((total, row) => total + row.totalCents, 0),
    // each day's own Deposit, as each would be a one-off Job's (ADR-0013)
    depositCents: days.reduce(
      (total, row) =>
        total + percentOf(row.totalCents, revision.depositPercent),
      0,
    ),
  };
};

export const optionsOf = (revisionId: string, tx: Tx | typeof db = db) =>
  tx
    .select()
    .from(revisionOptions)
    .where(eq(revisionOptions.revisionId, revisionId));

export const toOption = (
  revision: Pick<KindedRevision, "kind" | "depositPercent" | "serviceKey">,
  row: PricedOption,
): QuoteOption => ({
  serviceKey: row.serviceKey,
  serviceName: row.suggested.serviceName,
  // a Service Plan's Services are the ones chosen for it
  recommended:
    revision.kind === "one_off" && row.serviceKey !== revision.serviceKey,
  labourHours: row.labourHours,
  hoursOnSite: hoursOnSiteOf(row),
  priceCents: row.priceCents,
  taxCents: row.taxCents,
  totalCents: row.totalCents,
  depositCents: percentOf(row.totalCents, revision.depositPercent),
  addOns: row.addOns.map(({ key, name, totalCents }) => ({
    key,
    name,
    totalCents,
  })),
});

// a Service Plan Quote's weekdays in order; a one-off Quote's recommended
// Service first
export const inOrder = <T extends { position: number }>(options: T[]) =>
  [...options].sort((a, b) => a.position - b.position);

// the figures a Client is shown of a Revision priced so: each option's,
// with its Add-ons', and a Service Plan Quote's terms
const pricesShown = (revision: KindedRevision, rows: PricedOption[]) => ({
  options: inOrder(rows).map((row) => toOption(revision, row)),
  plan: planOf(revision, rows),
});

const iso = (date: Date | null) => date?.toISOString() ?? null;

// the Service Plan an Accepted Service Plan Quote started, or changed: one
// that changed it didn't book its first visit
const acceptedPlanOf = async (quote: Quote) => {
  const none = { servicePlanId: null, changedPlan: false };
  if (quote.kind !== "service_plan" || quote.status !== "accepted") return none;
  const [plan] = await db
    .select({ id: servicePlanVisits.servicePlanId })
    .from(servicePlanVisits)
    .where(eq(servicePlanVisits.quoteId, quote.id))
    .limit(1);
  if (!plan) return none;
  const [first] = await db
    .select({ quoteId: servicePlanVisits.quoteId })
    .from(servicePlanVisits)
    .where(eq(servicePlanVisits.servicePlanId, plan.id))
    .orderBy(asc(servicePlanVisits.createdAt))
    .limit(1);
  return { servicePlanId: plan.id, changedPlan: first!.quoteId !== quote.id };
};

// what a Service Plan Quote would do to its home's plan, while it's open,
// from the time of `revision`
const planChangeFor = (
  quote: Quote,
  status: QuoteStatus,
  revision: Revision | undefined,
) =>
  quote.kind === "service_plan" && (status === "draft" || status === "sent")
    ? planChangeOf(quote.propertyId, revision?.proposedStartsAt ?? null)
    : null;

// the Services a Quote can still be booked as: none once it isn't Sent
const bookableOf = async (
  quote: Quote,
  status: QuoteStatus,
  offer: Revision | undefined,
) =>
  status === "sent"
    ? (
        await bookableFor([
          { id: quote.id, proposedStartsAt: offer!.proposedStartsAt! },
        ])
      ).get(quote.id)!
    : [];

const findQuote = async (id: string, tx: Tx | typeof db = db) => {
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, id));
  if (!quote) throw new NotFoundError("Quote not found");
  return quote;
};

const findRevision = async (id: string | null, tx: Tx | typeof db = db) => {
  if (!id) return undefined;
  const [revision] = await tx
    .select()
    .from(quoteRevisions)
    .where(eq(quoteRevisions.id, id));
  return revision;
};

// the Revision being written for a Quote, if any
const draftRevisionOf = async (quoteId: string, tx: Tx | typeof db = db) => {
  const [draft] = await tx
    .select()
    .from(quoteRevisions)
    .where(
      and(eq(quoteRevisions.quoteId, quoteId), isNull(quoteRevisions.sentAt)),
    );
  return draft;
};

// a Quote's status, with its offer's expiry
const currentStatusOf = (quote: Quote, offer: Revision | undefined) =>
  statusOf({ status: quote.status, expiresAt: offer?.expiresAt ?? null });

// what the Property's First Clean found, to price a plan by
const findingsOf = async (
  propertyId: string,
): Promise<FirstCleanFindings | null> => {
  const firstClean = (await firstCleansOf([propertyId])).get(propertyId);
  if (!firstClean) return null;
  const { job } = firstClean;
  const completion = await officeCompletionOf(job);
  return {
    job: {
      id: job.id,
      startsAt: job.startsAt.toISOString(),
      serviceName: await serviceNameOf(job.serviceId),
    },
    completedAt: completion!.completedAt,
    condition: completion!.condition,
    adjustments: completion!.adjustments,
  };
};

const officeOption = (
  revision: KindedRevision,
  row: RevisionOptionRow,
): OfficeQuoteOption => ({
  ...toOption(revision, row),
  suggested: row.suggested,
  overrideCents: row.overrideCents,
  overrideReason: row.overrideReason,
});

// one Revision in full, for the Office
const officeRevision = async (
  revision: KindedRevision,
): Promise<OfficeRevision> => {
  const [rows, [priced]] = await Promise.all([
    optionsOf(revision.id),
    db
      .select({ version: priceLists.version })
      .from(priceLists)
      .where(eq(priceLists.id, revision.priceListId)),
  ]);
  const plan = planOf(revision, rows);
  const sent = revision.sentAt !== null;
  return {
    id: revision.id,
    number: revision.number,
    status: sent ? "sent" : "draft",
    serviceKey: revision.serviceKey!,
    area: revision.area,
    options: inOrder(rows).map((r) => officeOption(revision, r)),
    // with the Condition it's priced for, which is the Office's working
    plan: plan && { ...plan, condition: revision.condition! },
    addOns: ownOption(revision, rows).suggested.addOns.map(({ key, name }) => ({
      key,
      name,
    })),
    crewSize: revision.crewSize,
    depositPercent: revision.depositPercent,
    validityDays: revision.validityDays,
    priceListVersion: priced!.version,
    proposedStart: revision.proposedStartsAt && {
      date: dayOf(revision.proposedStartsAt),
      time: timeOf(revision.proposedStartsAt),
    },
    proposedStartsAt: iso(revision.proposedStartsAt),
    sentAt: iso(revision.sentAt),
    expiresAt: iso(revision.expiresAt),
  };
};

// its home's Service Plan, unless it has none or it has Ended
const homePlanIdOf = async (propertyId: string) => {
  const [plan] = await db
    .select({ id: servicePlans.id })
    .from(servicePlans)
    .where(
      and(
        eq(servicePlans.propertyId, propertyId),
        ne(servicePlans.status, "ended"),
      ),
    );
  return plan?.id ?? null;
};

// A Quote in full, for the Office (ADR-0017): what was asked, with the
// Suggested Price for the Service being worked on (the Draft's, else the
// offer's or the Quote's) and any first-visit recommendation,
// worked out now from the current Services and Price List and the
// Property's current details and Condition (which Staff may have
// corrected); the Revision being drafted and the offer; and every Sent
// Revision
export const officeQuote = async (id: string): Promise<OfficeQuote> => {
  const quote = await findQuote(id);
  const [home, list, draft, offer] = await Promise.all([
    homeOf(quote.propertyId),
    currentPricing(),
    draftRevisionOf(id),
    findRevision(quote.sentRevisionId),
  ]);
  const { client, property } = home!;
  const propertyId = property.id;
  const status = currentStatusOf(quote, offer);
  const [
    paymentMethod,
    firstClean,
    addOns,
    stages,
    booked,
    done,
    firstCleanDone,
    homePlanId,
    revisions,
    anyCompleted,
    shownRows,
  ] = await Promise.all([
    paymentMethodOf(client.id),
    quote.kind === "service_plan" ? findingsOf(propertyId) : null,
    askedAddOns([id], list),
    siteVisitStages([propertyId]),
    siteVisitViews(
      and(
        eq(siteVisits.propertyId, propertyId),
        eq(siteVisits.status, "booked"),
      ),
    ),
    findingsRecorded([propertyId]),
    firstCleanCompleted(propertyId),
    homePlanIdOf(propertyId),
    revisionHistory(quote),
    hasCompletedJob(propertyId),
    draft || offer ? optionsOf((draft ?? offer)!.id) : [],
  ]);
  const asked = addOns.get(id) ?? [];
  const chosen = list.addOns.filter((a) => asked.some((c) => c.key === a.key));
  // a Draft's Service is the Quote's only once it's sent (saveDraft)
  const serviceKey = (draft ?? offer)?.serviceKey ?? quote.serviceKey;
  const service = serviceOf(list.services, serviceKey);
  // the Services it's for: its own, and its Revision's days' or options'
  const quoted = [serviceKey, ...shownRows.map((r) => r.serviceKey)];
  const choices =
    quote.kind === "service_plan"
      ? planServices(list.services, property.kind)
      : onOfferAt(list.services, property.kind);

  return {
    id: quote.id,
    kind: quote.kind,
    status,
    origin: quote.origin,
    asked: askedOf(quote, asked, list.services),
    source: sourceOf(quote),
    createdAt: quote.createdAt.toISOString(),
    client: {
      id: client.id,
      name: client.name,
      businessName: client.businessName,
      email: client.email,
      phone: client.phone,
    },
    property: toPropertyView(property, list),
    service: choiceOf(service),
    serviceChoices: (choices.some((s) => s.key === service.key)
      ? choices
      : [...choices, service]
    ).map(choiceOf),
    areaFrom: areaFromOf(quote, property),
    suggested: {
      priceListVersion: list.version,
      prices: oneOffServices(
        list.services,
        service,
        property.kind,
        !anyCompleted,
      ).map((s) => ({
        ...suggestedPrice(
          list,
          s,
          pricedOf(property, areaOf(draft ?? offer ?? null, quote, property)),
          property.condition,
          ownAddOns(chosen, s.key),
        ),
        serviceKey: s.key,
        recommended: s.key !== service.key,
      })),
    },
    needsSiteVisit: await needsSiteVisit(list.services, property, quoted),
    siteVisit: siteVisitOf(
      status,
      stages.get(propertyId),
      needSiteVisit(list.services, quoted),
    ),
    bookedSiteVisit: booked[0] ?? null,
    findingsRecorded: done.has(propertyId),
    firstCleanCompleted: firstCleanDone,
    homePlanId,
    firstClean,
    addOnChoices: await addOnChoices(list, id, serviceKey),
    draft: draft ? await officeRevision(kinded(quote, draft)) : null,
    offer: offer ? await officeRevision(kinded(quote, offer)) : null,
    revisions,
    declinedAt: iso(quote.declinedAt),
    acceptedAt: iso(quote.acceptedAt),
    acceptedServiceKey: quote.acceptedServiceKey,
    ...(await acceptedPlanOf(quote)),
    changesPlan: await planChangeFor(quote, status, draft ?? offer),
    bookable: await bookableOf(quote, status, offer),
    turnedDownAt: iso(quote.turnedDownAt),
    turnDownReason: quote.turnDownReason,
    paymentMethod: toPaymentMethodView(paymentMethod),
  };
};

// A Client's own Quote, as its offer: one with nothing Sent, or another
// Client's, doesn't exist for them
export const clientQuote = async (
  id: string,
  clientId: string,
): Promise<QuoteView> => {
  const [found] = await db
    .select({
      quote: quotes,
      offer: offers,
      property: properties,
      client: clients,
    })
    .from(quotes)
    .innerJoin(offers, eq(offers.id, quotes.sentRevisionId))
    .innerJoin(properties, eq(properties.id, quotes.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(and(eq(quotes.id, id), eq(properties.clientId, clientId)));
  if (!found) throw new NotFoundError("Quote not found");
  const { quote, offer, property, client } = found;
  const revision = kinded(quote, offer);
  const rows = await optionsOf(offer.id);
  const status = currentStatusOf(quote, offer);

  return {
    id: quote.id,
    revisionId: offer.id,
    kind: quote.kind!,
    status,
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
    },
    ...pricesShown(revision, rows),
    crewSize: offer.crewSize,
    depositPercent: offer.depositPercent,
    proposedStartsAt: offer.proposedStartsAt!.toISOString(),
    sentAt: offer.sentAt!.toISOString(),
    // the email for a later Revision says it's updated, too
    updatedAt: offer.number > 1 ? offer.sentAt!.toISOString() : null,
    expiresAt: offer.expiresAt!.toISOString(),
    declinedAt: iso(quote.declinedAt),
    acceptedAt: iso(quote.acceptedAt),
    acceptedServiceKey: quote.acceptedServiceKey,
    ...(await acceptedPlanOf(quote)),
    changesPlan: await planChangeFor(quote, status, offer),
    bookable: await bookableOf(quote, status, offer),
    weeklyBill: weeklyBillOf(client),
  };
};

// A Client's own Quote, wherever it stands (ADR-0017): its offer once a
// Revision is Sent; before that, what they asked, Requested or Turned Down.
// One the Office started that hasn't been Sent, or another Client's,
// doesn't exist for them.
export const clientQuoteView = async (
  id: string,
  clientId: string,
): Promise<ClientQuoteView> => {
  const [found] = await db
    .select({ quote: quotes, property: properties })
    .from(quotes)
    .innerJoin(properties, eq(properties.id, quotes.propertyId))
    .where(and(eq(quotes.id, id), eq(properties.clientId, clientId)));
  if (!found) throw new NotFoundError("Quote not found");
  const { quote, property } = found;
  if (quote.sentRevisionId) return clientQuote(id, clientId);
  if (quote.origin === "office") throw new NotFoundError("Quote not found");
  const list = await currentPricing();
  const [addOns, visits] = await Promise.all([
    askedAddOns([id], list),
    clientSiteVisits(clientId),
  ]);

  return {
    id: quote.id,
    status: quote.status === "turned_down" ? "turned_down" : "requested",
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
    },
    asked: askedOf(quote, addOns.get(id) ?? [], list.services)!,
    createdAt: quote.createdAt.toISOString(),
    sentAt: null,
    siteVisit:
      quote.status === "turned_down"
        ? null
        : (visits.find((v) => v.property.id === property.id) ?? null),
    turnedDownAt: iso(quote.turnedDownAt),
    turnDownReason: quote.turnDownReason,
  };
};

const kindLabel: Record<QuoteKind, string> = {
  one_off: "one-off quote",
  service_plan: "cleaning plan quote",
};

/**
 * A Service Plan Quote needs its Property's First Clean Completed, unless
 * every one of its Services needs a Site Visit: then the visit's findings,
 * which every Quote for those needs before it's Sent, do instead (ADR-0018,
 * ADR-0014).
 */
const refuseUnquotable = async (
  kind: QuoteKind,
  property: Pick<Property, "id" | "kind">,
  all: Service[],
  serviceKeys: string[],
  tx: Tx | typeof db = db,
) => {
  if (
    kind === "service_plan" &&
    !serviceKeys.every((key) => serviceOf(all, key).needsSiteVisit) &&
    !(await firstCleanCompleted(property.id, tx))
  ) {
    throw new ConflictError(
      `The first clean at ${thisPlace(property.kind)} isn't done yet. Quote a cleaning plan once it is.`,
    );
  }
};

// What an open Quote holds at its Property (ADR-0018): a one-off Quote, its
// Service's one-off; a Service Plan Quote, the Service Plan Quote; a
// Requested one, both, the second only if its Service can recur
const holdsOf = (
  all: Service[],
  quote: { kind: QuoteKind | null; serviceKey: string },
) => [
  ...(quote.kind === "service_plan" ? [] : [`one_off:${quote.serviceKey}`]),
  ...(quote.kind === "service_plan" ||
  (quote.kind === null && serviceOf(all, quote.serviceKey).canRecur)
    ? ["service_plan"]
    : []),
];

/**
 * The statuses of the other open Quotes at the Property holding what
 * `quote` would (holdsOf). Sent ones whose offer has Expired are written as
 * Expired, so they stand aside and aren't among them. Inside a transaction
 * holding the Property (lockProperty).
 */
export const openAlongside = async (
  tx: Tx,
  quote: { id: string | null; propertyId: string },
  holding: { kind: QuoteKind | null; serviceKey: string },
  all: Service[],
) => {
  const wanted = holdsOf(all, holding);
  const others = (
    await tx
      .select({
        id: quotes.id,
        kind: quotes.kind,
        serviceKey: quotes.serviceKey,
        status: quotes.status,
        expiresAt: offers.expiresAt,
      })
      .from(quotes)
      .leftJoin(offers, eq(offers.id, quotes.sentRevisionId))
      .where(
        and(
          eq(quotes.propertyId, quote.propertyId),
          quote.id ? ne(quotes.id, quote.id) : undefined,
          inArray(quotes.status, ["requested", "draft", "sent"]),
        ),
      )
  ).filter((q) => holdsOf(all, q).some((h) => wanted.includes(h)));
  const lapsed = others.filter((q) => statusOf(q) === "expired");
  if (lapsed.length > 0) {
    await tx
      .update(quotes)
      .set({ status: "expired" })
      .where(
        inArray(
          quotes.id,
          lapsed.map((q) => q.id),
        ),
      );
  }
  return others.map(statusOf).filter(isOpen);
};

// refuses a Quote becoming open while another holding the same is
// (openAlongside)
const refuseAnotherOpen = async (
  tx: Tx,
  quote: { id: string | null; propertyId: string },
  holding: { kind: QuoteKind | null; serviceKey: string },
  all: Service[],
  message: string,
) => {
  if ((await openAlongside(tx, quote, holding, all)).length > 0) {
    throw new ConflictError(message);
  }
};

// Reviving an Expired Quote, by starting or sending a Revision, is refused
// while a newer one holds its place (openAlongside). Says whether it was
// Expired.
const refuseRevivingPastNewer = async (
  tx: Tx,
  current: Quote,
  holding: { kind: QuoteKind; serviceKey: string },
  all: Service[],
  property: Pick<Property, "kind">,
) => {
  const offer = await findRevision(current.sentRevisionId, tx);
  if (currentStatusOf(current, offer) !== "expired") return false;
  await refuseAnotherOpen(
    tx,
    current,
    holding,
    all,
    `There's a newer ${kindLabel[holding.kind]} for ${thisPlace(property.kind)}. Carry on with that one.`,
  );
  return true;
};

// refusing a Quote while `what` (another Quote) is open at the Property
export const openAlreadyAt = (property: Pick<Property, "kind">, what: string) =>
  `${openAlready(property.kind, what)} Carry on with that one.`;

// a one-off Quote's name for another open at the Property: "a Deep Clean
// quote", or a cleaning plan quote
const quoteName = (all: Service[], kind: QuoteKind, serviceKey: string) =>
  kind === "service_plan"
    ? "a cleaning plan quote"
    : `a ${serviceOf(all, serviceKey).name} quote`;

// What a new Revision starts from: a copy of the offer's terms, or for the
// first, the Price List's defaults and the Add-ons asked for (none on a
// Service Plan Quote, whose first day is of the Service it was started
// with). A one-off Quote's is for its Service, and the one recommended for a
// first visit while the Property has no Completed Job.
const newRevisionOptions = async (
  quote: Quote,
  kind: QuoteKind,
  property: Property,
  list: Pricing,
  tx: Tx,
) => {
  const offer = await findRevision(quote.sentRevisionId, tx);
  const anyCompleted = await hasCompletedJob(property.id, tx);
  const service = serviceOf(list.services, quote.serviceKey);
  // a Service Plan Quote's was one that can recur when it was started
  const serviceKey = quote.serviceKey;
  if (offer) {
    return {
      revision: {
        serviceKey,
        area: offer.area,
        crewSize: offer.crewSize,
        depositPercent: offer.depositPercent,
        validityDays: offer.validityDays,
        proposedStartsAt: offer.proposedStartsAt,
        recurrence: offer.recurrence,
        planDiscountPercent: offer.planDiscountPercent,
        condition: offer.condition,
      },
      options: repriced(
        list,
        property,
        quote,
        { ...offer, kind },
        await optionsOf(offer.id, tx),
        !anyCompleted,
      ),
    };
  }

  const plan =
    kind === "service_plan"
      ? { ...PLAN_DEFAULTS, planDiscountPercent: list.planDiscountPercent }
      : null;
  // those asked for that go with its Service, though the Office may have
  // changed which Services an Add-on goes with since
  const asked = new Set(
    ((await askedAddOns([quote.id], list, tx)).get(quote.id) ?? []).map(
      (a) => a.key,
    ),
  );
  const addOnKeys = plan
    ? []
    : ownAddOns(
        list.addOns.filter((a) => asked.has(a.key)),
        serviceKey,
      ).map((a) => a.key);
  const area = areaOf(null, quote, property);
  return {
    revision: {
      serviceKey,
      area: null,
      crewSize: list.defaultCrewSize,
      depositPercent: list.depositPercent,
      validityDays: list.quoteValidityDays,
      proposedStartsAt: null,
      recurrence: plan?.recurrence ?? null,
      planDiscountPercent: plan?.planDiscountPercent ?? null,
      condition: plan?.condition ?? null,
    },
    options: priceOptions(
      list,
      property,
      addOnKeys,
      plan
        ? planTerms(
            plan,
            [
              {
                serviceKey,
                startsAt: null,
                crewSize: list.defaultCrewSize,
                override: null,
              },
            ],
            area,
          )
        : oneOffTerms(
            list,
            property,
            service,
            !anyCompleted,
            list.defaultCrewSize,
            {},
            area,
          ),
    ),
  };
};

// inserts a Quote's next Revision, unsent
const insertRevision = async (
  tx: Tx,
  quote: Quote,
  kind: QuoteKind,
  property: Property,
  accountId: string,
  list: Pricing,
) => {
  const { revision, options } = await newRevisionOptions(
    quote,
    kind,
    property,
    list,
    tx,
  );
  const [{ last }] = (await tx
    .select({ last: max(quoteRevisions.number) })
    .from(quoteRevisions)
    .where(eq(quoteRevisions.quoteId, quote.id))) as [{ last: number | null }];
  const [inserted] = await tx
    .insert(quoteRevisions)
    .values({
      ...revision,
      quoteId: quote.id,
      number: (last ?? 0) + 1,
      priceListId: list.id,
      createdBy: accountId,
    })
    .returning();
  await tx
    .insert(revisionOptions)
    .values(options.map((o) => ({ ...o, revisionId: inserted!.id })));
};

// the Quote, refused once it has closed: accepted, declined or turned
// down (accept.ts says why one can't be accepted)
const openQuote = async (id: string, tx: Tx | typeof db = db) => {
  const quote = await findQuote(id, tx);
  if (
    quote.status === "accepted" ||
    quote.status === "declined" ||
    quote.status === "turned_down"
  ) {
    throw new ConflictError(
      `${whatClosed(quote.status)} The client can ask for a new one.`,
    );
  }
  return quote;
};

// holds the Quote's Property (lockProperty) and reads the Quote as it is now,
// refusing it once it has closed
const lockOpenQuote = async (
  tx: Tx,
  quote: Pick<Quote, "id" | "propertyId">,
) => {
  await lockProperty(tx, quote.propertyId);
  return openQuote(quote.id, tx);
};

/**
 * Starts a Quote's Draft Revision, pre-filled: the first from the Suggested
 * Price and the Price List's defaults (a one-off Quote with the Add-ons
 * asked for; a Service Plan Quote with the plan defaults, its Service every
 * 2 weeks at moderate Condition, no Add-ons, the Price List's Plan
 * Discount), a later one from the offer's terms. A Requested Quote's first
 * sets its kind, one-off unless said otherwise, which then never changes.
 * A Quote drafts one Revision at a time, so if it has one, that's the one
 * returned. An Expired Quote may be revived this way unless a newer Quote
 * holding the same is open for the Property (ADR-0018).
 */
export const startRevision = async (
  id: string,
  wanted: QuoteKind | undefined,
  accountId: string,
): Promise<{ quote: OfficeQuote; started: boolean }> => {
  const quote = await openQuote(id);
  const kind = quote.kind ?? wanted ?? "one_off";
  if (wanted && wanted !== kind) {
    throw new ConflictError(
      `This is a ${kindLabel[kind]}. Start a new quote for the other kind.`,
    );
  }
  if (await draftRevisionOf(id)) {
    return { quote: await officeQuote(id), started: false };
  }
  const [{ property }, list] = await Promise.all([
    homeOf(quote.propertyId).then((home) => home!),
    currentPricing(),
  ]);
  // a Requested Quote becoming a plan is of a Service that can recur
  const serviceKey =
    kind === "service_plan"
      ? planServiceFor(list.services, property.kind, quote.serviceKey).key
      : quote.serviceKey;
  await refuseUnquotable(kind, property, list.services, [serviceKey]);

  await db.transaction(async (tx) => {
    const current = await lockOpenQuote(tx, quote);
    // two at once: the other started it
    if (await draftRevisionOf(id, tx)) return;
    const holding = { kind, serviceKey };
    await refuseRevivingPastNewer(
      tx,
      current,
      holding,
      list.services,
      property,
    );
    if (current.status === "requested") {
      await refuseAnotherOpen(
        tx,
        current,
        holding,
        list.services,
        openAlreadyAt(property, quoteName(list.services, kind, serviceKey)),
      );
      await tx
        .update(quotes)
        .set({ kind, serviceKey, status: "draft" })
        .where(eq(quotes.id, id));
    }
    await insertRevision(
      tx,
      { ...current, kind, serviceKey },
      kind,
      property,
      accountId,
      list,
    );
  });
  return { quote: await officeQuote(id), started: true };
};

/**
 * Office Staff offer a Service Plan nobody asked for (ADR-0011, ADR-0017):
 * a Service Plan Quote with nothing asked, of the first Service on offer
 * here that can recur, starting as a Draft with its first Revision. If the
 * Office has one for the Property still a Draft, that's the one returned;
 * otherwise it's refused while the Property has a Service Plan Quote, or a
 * Requested one that could be, open.
 */
export const offerServicePlan = async (
  propertyId: string,
  accountId: string,
): Promise<{ quote: OfficeQuote; started: boolean }> => {
  const home = await homeOf(propertyId);
  if (!home) throw new NotFoundError("Home not found");
  const { property } = home;
  const list = await currentPricing();
  const service = planServiceFor(list.services, property.kind, null);
  await refuseUnquotable("service_plan", property, list.services, [
    service.key,
  ]);
  const { id, started } = await db.transaction(async (tx) => {
    await lockProperty(tx, propertyId);
    const [drafting] = await tx
      .select({ id: quotes.id })
      .from(quotes)
      .where(
        and(
          eq(quotes.propertyId, propertyId),
          eq(quotes.kind, "service_plan"),
          eq(quotes.status, "draft"),
          eq(quotes.origin, "office"),
        ),
      );
    if (drafting) return { id: drafting.id, started: false };
    await refuseAnotherOpen(
      tx,
      { id: null, propertyId },
      { kind: "service_plan", serviceKey: service.key },
      list.services,
      openAlreadyAt(property, "a cleaning plan quote or a quote request"),
    );
    const [quote] = await tx
      .insert(quotes)
      .values({
        propertyId,
        kind: "service_plan",
        serviceKey: service.key,
        status: "draft",
        origin: "office",
        createdBy: accountId,
      })
      .returning();
    await insertRevision(tx, quote!, "service_plan", property, accountId, list);
    return { id: quote!.id, started: true };
  });
  return { quote: await officeQuote(id), started };
};

const SENT_ALREADY =
  "This quote has already been sent, so it can't change. Start an updated quote.";

// the Revision being drafted, which is all Office Staff can change, while
// the Quote is open
const findDraftRevision = async (id: string, tx: Tx | typeof db = db) => {
  const quote = await openQuote(id, tx);
  const draft = await draftRevisionOf(id, tx);
  if (!draft) {
    throw new ConflictError(SENT_ALREADY);
  }
  return { quote, draft: kinded(quote, draft) };
};

// A Service Plan Draft's weekdays as Office Staff set them, in their order:
// each on a weekday of its own, all within a week of the first, and on
// several only every week (ADR-0013), every one of the plan's Service.
// Days not yet timed are left be.
const planVisits = (plan: ServicePlanInput, service: Service) => {
  const days = plan.days.map((day) => ({
    serviceKey: service.key,
    crewSize: day.crewSize,
    override: day.override,
    startsAt: day.start && atTime(day.start.date, day.start.time),
  }));
  if (days.length > 1 && plan.recurrence !== "weekly") {
    throw fieldError(
      ["plan", "recurrence"],
      "A plan on more than one day a week has to be every week",
    );
  }
  const timed = days.flatMap((d, i) =>
    d.startsAt ? [{ i, day: dayOf(d.startsAt) }] : [],
  );
  const first = timed.map((t) => t.day).sort()[0];
  for (const [n, { i, day }] of timed.entries()) {
    if (timed.slice(0, n).some((t) => weekdayOf(t.day) === weekdayOf(day))) {
      throw fieldError(
        ["plan", "days", i, "start"],
        "This plan already has a clean on that day. Pick another day",
      );
    }
    if (day >= addDays(first!, 7)) {
      throw fieldError(
        ["plan", "days", i, "start"],
        "Pick a day within a week of the plan's first clean",
      );
    }
  }
  return days;
};

// The Service a one-off Draft is to be for: as asked to change it to (one
// on offer here, or the one it's for now), or as it is
const draftServiceOf = (
  list: Pricing,
  property: Property,
  now: string,
  wanted: string | undefined,
) => {
  if (!wanted || wanted === now) return serviceOf(list.services, now);
  const service = onOfferAt(list.services, property.kind).find(
    (s) => s.key === wanted,
  );
  if (!service) {
    throw fieldError(["serviceKey"], NOT_A_SERVICE);
  }
  return service;
};

// The Service a Service Plan Draft is to be for: one on offer here that can
// recur, or the one it's for now
const planServiceOf = (
  list: Pricing,
  property: Property,
  now: string,
  wanted: string,
) => {
  const service = planServices(list.services, property.kind, [now]).find(
    (s) => s.key === wanted,
  );
  if (!service) {
    throw fieldError(
      ["plan", "serviceKey"],
      "Pick a service that can be on a cleaning plan",
    );
  }
  return service;
};

// saves what Office Staff set on a Quote's Draft Revision, pricing it afresh
// from the current Services and Price List and the home's current details.
// A one-off Draft may change its Service, unless another Quote for that one
// is open here. The Quote takes the new Service now while nothing's Sent;
// while an offer stands it keeps the offer's until this is sent. It's
// written under the Property's lock, so a save that waited on a send or a
// close is refused.
export const saveDraft = async (
  id: string,
  input: QuoteDraftInput,
): Promise<OfficeQuote> => {
  const { quote, draft } = await findDraftRevision(id);
  const [home, list, anyCompleted] = await Promise.all([
    homeOf(quote.propertyId),
    currentPricing(),
    hasCompletedJob(quote.propertyId),
  ]);
  const { property } = home!;

  const plan = input.plan ?? null;
  if (draft.kind === "service_plan" && input.serviceKey) {
    throw fieldError(
      ["serviceKey"],
      "Pick a cleaning plan's service with its other terms",
    );
  }
  const service =
    draft.kind === "one_off"
      ? draftServiceOf(list, property, draft.serviceKey, input.serviceKey)
      : plan &&
        planServiceOf(list, property, draft.serviceKey, plan.serviceKey);
  const serviceKey = service?.key ?? draft.serviceKey;
  const allowed = new Set(
    (await addOnChoices(list, quote.id, serviceKey)).map((a) => a.key),
  );
  const chosen = list.addOns.filter((a) => input.addOns.includes(a.key));
  // only those that go with the Service are priced, by any option: one the
  // Office ticked before switching to a Service it doesn't go with stays
  // ticked on the Draft page, and switching back prices it again
  const addOnKeys = ownAddOns(chosen, serviceKey).map((a) => a.key);
  const unknown = input.addOns.findIndex(
    (key) =>
      !chosen.some((a) => a.key === key) ||
      (addOnKeys.includes(key) && !allowed.has(key)),
  );
  if (unknown !== -1) {
    throw fieldError(["addOns", unknown], NOT_AN_ADD_ON);
  }

  // typed, or following the Property (or the Client's rough one)
  const typedArea = input.area ?? null;
  const area = areaOf({ area: typedArea }, quote, property);
  let terms: Terms;
  let timing: { crewSize: number; proposedStartsAt: Date | null };
  if (draft.kind === "service_plan") {
    if (!plan) {
      throw fieldError(
        ["plan"],
        "Pick how often, the discount, the condition and the days",
      );
    }
    // each weekday has its own
    const other = Object.keys(input.overrides ?? {}).find(
      (key) => input.overrides![key],
    );
    if (other) {
      throw fieldError(
        ["overrides", other],
        "Change each day's price on that day",
      );
    }
    const days = planVisits(plan, service!);
    terms = planTerms(
      { condition: plan.condition, planDiscountPercent: plan.discountPercent },
      days,
      area,
    );
    // its first clean, once every weekday has one
    const starts = days.map((d) => d.startsAt);
    timing = {
      crewSize: days[0]!.crewSize,
      proposedStartsAt: starts.every((s) => s !== null)
        ? new Date(Math.min(...starts.map((s) => s.getTime())))
        : null,
    };
  } else {
    if (plan) {
      throw fieldError(["plan"], "Only a cleaning plan quote has plan terms");
    }
    if (input.crewSize === undefined) {
      throw fieldError(["crewSize"], CREW_SIZE);
    }
    terms = oneOffTerms(
      list,
      property,
      service!,
      !anyCompleted,
      input.crewSize,
      input.overrides ?? {},
      area,
    );
    timing = {
      crewSize: input.crewSize,
      proposedStartsAt: input.proposedStart
        ? atTime(input.proposedStart.date, input.proposedStart.time)
        : null,
    };
  }

  const options = priceOptions(list, property, addOnKeys, terms);
  await db.transaction(async (tx) => {
    await lockProperty(tx, quote.propertyId);
    const { quote: current, draft: unsent } = await findDraftRevision(id, tx);
    // sent, and a newer one started, while this waited
    if (unsent.id !== draft.id) throw new ConflictError(SENT_ALREADY);
    if (service!.key !== current.serviceKey) {
      // a one-off Quote holds its Service; there's one open Service Plan
      // Quote, whatever its Service
      if (draft.kind === "one_off") {
        await refuseAnotherOpen(
          tx,
          current,
          { kind: "one_off", serviceKey: service!.key },
          list.services,
          openAlreadyAt(
            property,
            quoteName(list.services, "one_off", service!.key),
          ),
        );
      }
      // while an offer stands, sending this switches it (sendQuote)
      if (!current.sentRevisionId) {
        await tx
          .update(quotes)
          .set({ serviceKey: service!.key })
          .where(eq(quotes.id, id));
      }
    }
    await tx
      .update(quoteRevisions)
      .set({
        priceListId: list.id,
        depositPercent: input.depositPercent,
        validityDays: input.validityDays,
        serviceKey: service!.key,
        area: typedArea,
        ...timing,
        ...(plan && {
          recurrence: plan.recurrence,
          planDiscountPercent: plan.discountPercent,
          condition: plan.condition,
        }),
      })
      .where(eq(quoteRevisions.id, draft.id));
    await tx
      .delete(revisionOptions)
      .where(eq(revisionOptions.revisionId, draft.id));
    await tx
      .insert(revisionOptions)
      .values(options.map((o) => ({ ...o, revisionId: draft.id })));
  });
  return officeQuote(id);
};

// Each clean a Draft Revision would book first, with the field that sets its
// time: a one-off Quote's Job, the longest of its Services; a Service Plan
// Quote's first on each weekday. Each must be more than a Late
// Cancellation's 24 hours away, when the Quote would Expire, and end by
// midnight.
const refuseUntimely = (revision: KindedRevision, rows: PricedOption[]) => {
  const now = clock.now();
  const cleans =
    revision.kind === "service_plan"
      ? inOrder(rows).map((row, i) => ({
          path: ["plan", "days", i, "start"],
          startsAt: row.startsAt,
          option: toOption(revision, row),
        }))
      : [
          {
            path: ["proposedStart"],
            startsAt: revision.proposedStartsAt,
            option: rows
              .map((row) => toOption(revision, row))
              .sort((a, b) => b.hoursOnSite - a.hoursOnSite)[0]!,
          },
        ];
  for (const { path, startsAt, option } of cleans) {
    if (!startsAt) {
      throw fieldError(
        path,
        revision.kind === "service_plan"
          ? "Pick when this day's first clean is"
          : "Pick a time",
      );
    }
    // it Expires from then (sendQuote)
    if (lateFrom(startsAt) <= now) {
      throw fieldError(
        path,
        `Pick a time more than ${CANCELLATION_CUTOFF_HOURS} hours away`,
      );
    }
    if (!endsByMidnight(startsAt, option.hoursOnSite)) {
      throw fieldError(path, ENDS_BY_MIDNIGHT);
    }
  }
};

// Sends a Quote's Draft Revision, making it the offer, and emails the Client
// a link to the Quote. It's priced afresh first, from the current Services
// and Price List and the Property as it is now, and refused if that changes
// any figure the Client would be shown, so nothing goes at a price the
// Office hasn't seen (an override's Suggested Price may move under it). A
// Service Plan Quote's weekdays are put in order, earliest first. The Quote
// takes the Draft's Service, refused while another Quote for that one is
// open here. Sending one on an Expired Quote revives it, unless a newer
// Quote of its kind is open for the Property.
export const sendQuote = async (id: string): Promise<OfficeQuote> => {
  const quote = await findQuote(id);
  const list = await currentPricing();
  const now = clock.now();

  const client = await db.transaction(async (tx) => {
    // one send (or acceptance, save or close) at a time per Property; it may
    // have been Accepted while this waited
    await lockProperty(tx, quote.propertyId);
    const { quote: current, draft } = await findDraftRevision(id, tx);
    const { client, property } = (await homeOf(current.propertyId, tx))!;
    const saved = await optionsOf(draft.id, tx);
    const options = repriced(
      list,
      property,
      current,
      draft,
      saved,
      !(await hasCompletedJob(property.id, tx)),
    );
    if (
      !isDeepStrictEqual(pricesShown(draft, saved), pricesShown(draft, options))
    ) {
      throw new ConflictError(
        "The prices have changed since you saved this. Check them, then send it.",
      );
    }

    refuseUntimely(draft, options);
    const quoted = options.map((o) => o.serviceKey);
    await refuseUnquotable(draft.kind, property, list.services, quoted, tx);
    // it goes by email, and is accepted signed in with that email (#34)
    if (!client.email) {
      throw new ConflictError(
        `${noEmailYet(client.name)} Add their email on their client page, then send it.`,
      );
    }
    // some Services are seen before they're quoted (ADR-0018)
    if (await needsSiteVisit(list.services, property, quoted, tx)) {
      throw new ConflictError(
        `${notSeenYet(property.kind)} Record what the visit found on the property page, then send it.`,
      );
    }
    // a Service priced by area is priced on one, which sending fixes
    const methodOf = (o: PricedOption) =>
      serviceOf(list.services, o.serviceKey).method;
    const byArea = options.find((o) => methodOf(o) === "area");
    if (byArea && (byArea.suggested.area ?? null) === null) {
      throw fieldError(["area"], "Enter the area in sq ft");
    }
    // and one priced from a home's rooms needs them known
    if (
      property.kind === "residential" &&
      property.bedrooms === null &&
      options.some((o) => methodOf(o) === "rooms")
    ) {
      throw new ConflictError(
        "This home's rooms aren't filled in yet, so this quote can't be sent. Add them on the property page, then send it.",
      );
    }

    // reviving it, or switching it to the Draft's Service (saveDraft)
    const holding = { kind: draft.kind, serviceKey: draft.serviceKey };
    const revived = await refuseRevivingPastNewer(
      tx,
      current,
      holding,
      list.services,
      property,
    );
    if (!revived && draft.serviceKey !== current.serviceKey) {
      await refuseAnotherOpen(
        tx,
        current,
        holding,
        list.services,
        openAlreadyAt(
          property,
          quoteName(list.services, draft.kind, draft.serviceKey),
        ),
      );
    }
    const written =
      draft.kind === "service_plan"
        ? [...options]
            .sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime())
            .map((option, position) => ({ ...option, position }))
        : options;
    await tx
      .update(quoteRevisions)
      .set({
        sentAt: now,
        // or once cancelling it would be a Late Cancellation
        expiresAt: new Date(
          Math.min(
            now.getTime() + draft.validityDays * DAY_MS,
            lateFrom(draft.proposedStartsAt!).getTime(),
          ),
        ),
        priceListId: list.id,
        area: byArea?.suggested.area ?? null,
        ...(draft.kind === "service_plan" && {
          crewSize: written[0]!.crewSize,
        }),
      })
      .where(eq(quoteRevisions.id, draft.id));
    await tx
      .delete(revisionOptions)
      .where(eq(revisionOptions.revisionId, draft.id));
    await tx
      .insert(revisionOptions)
      .values(written.map((o) => ({ ...o, revisionId: draft.id })));
    await tx
      .update(quotes)
      .set({
        status: "sent",
        sentRevisionId: draft.id,
        serviceKey: draft.serviceKey,
      })
      .where(eq(quotes.id, id));
    return client;
  });

  const view = await officeQuote(id);
  // the Quote is sent: an email that can't go mustn't make it look as though
  // it wasn't
  try {
    await sendQuoteEmail(client, view);
  } catch (error) {
    monitoring.error(error, { what: `email for Quote ${id} not sent` });
  }
  return view;
};

/**
 * Office Staff throw away the Revision being written. What's left depends
 * on what came before it: a Sent Quote keeps its offer; one asked for with
 * nothing sent is Requested again, of the Service asked for, its kind
 * unset, unless another one-off Quote for that Service is open here now (it
 * was asked for again once this was drafted as another), which carries the
 * ask on, so this one goes; and a Service Plan offered unprompted, never
 * sent, had nothing but its Draft, so it goes too. A Quote that goes leaves
 * its Site Visits on the Property. Returns the Quote, or null once it's gone.
 */
export const discardDraft = async (id: string): Promise<OfficeQuote | null> => {
  const quote = await findQuote(id);
  const { services } = await currentPricing();
  const gone = await db.transaction(async (tx) => {
    await lockProperty(tx, quote.propertyId);
    const current = await findQuote(id, tx);
    if (!(await draftRevisionOf(id, tx))) {
      throw new ConflictError("There's no draft to delete.");
    }
    if (current.sentRevisionId) {
      await dropDraftRevision(tx, id);
      return false;
    }
    if (
      current.askedServiceKey === null ||
      (
        await openAlongside(
          tx,
          current,
          { kind: "one_off", serviceKey: current.askedServiceKey },
          services,
        )
      ).length > 0
    ) {
      await tx.delete(quotes).where(eq(quotes.id, id));
      return true;
    }
    await dropDraftRevision(tx, id);
    await tx
      .update(quotes)
      .set({
        status: "requested",
        kind: null,
        serviceKey: current.askedServiceKey,
      })
      .where(eq(quotes.id, id));
    return false;
  });
  return gone ? null : officeQuote(id);
};

// a closed Quote's unsent Revision can never be sent, so it goes
export const dropDraftRevision = (tx: Tx | typeof db, quoteId: string) =>
  tx
    .delete(quoteRevisions)
    .where(
      and(eq(quoteRevisions.quoteId, quoteId), isNull(quoteRevisions.sentAt)),
    );

// the Client says no to a Sent Quote; nothing else can be Declined
export const declineQuote = async (
  id: string,
  clientId: string,
): Promise<QuoteView> => {
  const quote = await clientQuote(id, clientId);
  if (quote.status !== "sent") {
    throw new ConflictError(whatClosed(quote.status));
  }
  await db.transaction(async (tx) => {
    // takes turns with a send of a newer Revision
    await lockProperty(tx, quote.property.id);
    const [declined] = await tx
      .update(quotes)
      .set({ status: "declined", declinedAt: clock.now() })
      .where(and(eq(quotes.id, id), eq(quotes.status, "sent")))
      .returning({ id: quotes.id });
    if (declined) await dropDraftRevision(tx, id);
  });
  return clientQuote(id, clientId);
};

/**
 * Office Staff Turn Down a Quote before any Revision of it is Sent, with a
 * reason, and the Client is emailed (unless the Office entered them without
 * an email). It's final: the Client asks for a new Quote.
 */
export const turnDownQuote = async (
  id: string,
  reason: TurnDownReason,
  accountId: string,
): Promise<OfficeQuote> => {
  const quote = await findQuote(id);
  await db.transaction(async (tx) => {
    // takes turns with a send, which it may have waited on
    const current = await lockOpenQuote(tx, quote);
    if (current.sentRevisionId) {
      throw new ConflictError(
        "This quote has already been sent, so it can't be turned down.",
      );
    }
    await tx
      .update(quotes)
      .set({
        status: "turned_down",
        turnedDownAt: clock.now(),
        turnDownReason: reason,
        turnedDownBy: accountId,
      })
      .where(eq(quotes.id, id));
    await dropDraftRevision(tx, id);
  });
  const { client, property } = (await homeOf(quote.propertyId))!;
  if (client.email) {
    try {
      await sendTurnDownEmail(client, property, id, reason);
    } catch (error) {
      monitoring.error(error, {
        what: `Turn Down email for Quote ${id} not sent`,
      });
    }
  }
  return officeQuote(id);
};

const sendTurnDownEmail = async (
  client: Client,
  property: Property,
  quoteId: string,
  reason: TurnDownReason,
) => {
  await email.send({
    to: client.email,
    ...turnDownEmail({
      name: client.name,
      address: addressOf(property),
      quoteId,
      reason,
    }),
  });
};

const sendQuoteEmail = async (client: Client, quote: OfficeQuote) => {
  const offer = quote.offer!;
  if (!client.email) return;
  await email.send({
    to: client.email,
    ...quoteEmail({
      name: client.name,
      email: client.email,
      quoteId: quote.id,
      address: addressOf(quote.property),
      offer: {
        ...offer,
        proposedStartsAt: offer.proposedStartsAt!,
        expiresAt: offer.expiresAt!,
      },
    }),
  });
};
