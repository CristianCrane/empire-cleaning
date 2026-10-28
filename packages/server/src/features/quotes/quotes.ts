import { and, asc, eq, inArray, isNull, max, ne, or } from "drizzle-orm";
import { z } from "zod";
import type {
  AddOnChoice,
  CleanType,
  ClientQuoteView,
  Condition,
  FirstCleanFindings,
  OfficeQuote,
  OfficeQuoteOption,
  OfficeRevision,
  PlanChoice,
  PlanDayTerms,
  QuoteAddOn,
  QuoteDraftInput,
  QuoteKind,
  QuoteOption,
  QuoteStatus,
  QuoteView,
  Recurrence,
  ServicePlanInput,
  ServicePlanTerms,
  TurnDownReason,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import env from "../../env.ts";
import {
  ConflictError,
  NotFoundError,
  RequestBodyError,
} from "../../middleware/errors.ts";
import {
  addDays,
  atTime,
  clock,
  dayOf,
  startOfDay,
  timeOf,
  weekdayOf,
} from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatMoney,
  formatWhen,
  weekdayName,
} from "../../services/email/index.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { officeCompletionOf } from "../completion/completion.ts";
import { paymentMethodOf, toPaymentMethodView } from "../payments/payments.ts";
import {
  cleanTypesFor,
  currentPricing,
  serviceFor,
  type Pricing,
} from "../services/services.ts";
import { priceLists } from "../price-list/price-list.schema.ts";
import {
  addOnCents,
  pricedOf,
  suggestedPrice,
  taxOn,
} from "../price-list/suggested-price.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
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
import { describePlan, percentOf } from "./plan-days.ts";
import { bookableFor } from "./quote-room.ts";
import {
  askedOf,
  firstCleanCompleted,
  firstCleansOf,
  offers,
  revisionHistory,
  siteVisitOf,
  statusOf,
} from "./quote-state.ts";
import {
  quoteRevisions,
  quotes,
  revisionOptions,
  type Quote,
  type Revision,
  type RevisionOptionRow,
} from "./quotes.schema.ts";

// Deep Clean first: it's the one Empire Cleaning recommends
const CLEAN_TYPES: CleanType[] = ["deep", "standard"];

// a new Service Plan Quote's terms, until Office Staff change them: not a
// copy of the First Clean, whatever it was
const PLAN_DEFAULTS = {
  recurrence: "fortnightly",
  cleanType: "standard",
  condition: "moderate",
} as const satisfies {
  recurrence: Recurrence;
  cleanType: CleanType;
  condition: Condition;
};

const recurrenceLabel: Record<Recurrence, string> = {
  weekly: "every week",
  fortnightly: "every 2 weeks",
  four_weekly: "every 4 weeks",
};

const cleanTypeLabel: Record<CleanType, string> = {
  deep: "Deep Clean",
  standard: "Standard Clean",
};

const DAY_MS = 86_400_000;

const fieldError = (path: (string | number)[], message: string) =>
  new RequestBodyError(
    new z.ZodError([{ code: "custom", path, message, input: undefined }]),
  );

// A Revision with its Quote's kind, which is set by the first Revision and
// never changes: what prices and shows it
export type KindedRevision = Revision & { kind: QuoteKind };

const kinded = (quote: Quote, revision: Revision): KindedRevision => ({
  ...revision,
  kind: quote.kind!,
});

// business premises with no Site Visit findings recorded, which no Revision
// can be Sent for (ADR-0014)
const needsSiteVisit = async (property: Pick<Property, "id" | "kind">) =>
  property.kind === "commercial" &&
  !(await findingsRecorded([property.id])).has(property.id);

// a Property with its Client
const homeOf = async (propertyId: string) => {
  const [row] = await db
    .select({ client: clients, property: properties })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, propertyId));
  return row;
};

// the Add-ons a Revision can carry: those on offer for its kind of Property,
// and any asked for that have since been retired
const addOnChoices = async (
  list: Pricing,
  property: Property,
  quoteId: string,
): Promise<AddOnChoice[]> => {
  const notFor = property.kind === "commercial" ? "homes" : "businesses";
  const asked = new Set(
    ((await askedAddOns([quoteId])).get(quoteId) ?? []).map((a) => a.key),
  );
  return list.addOns
    .filter((a) => (a.active && a.offeredFor !== notFor) || asked.has(a.key))
    .map(({ key, name }) => ({ key, name }));
};

// What a Revision is priced for besides the Property and its Add-ons: a
// one-off Quote both Clean Types at the Property's own Condition (moderate
// while business premises have none recorded), undiscounted; a Service Plan
// Quote each of its weekdays' visits at the Condition and Plan Discount on
// the Revision
type Terms = {
  kind: QuoteKind;
  visits: Visit[];
  condition: Condition | null;
  discountPercent: number;
};

// one visit to price: one of a one-off Quote's Clean Types, or a Service
// Plan Quote's weekday, with its first clean's time
type Visit = {
  position: number;
  cleanType: CleanType;
  startsAt: Date | null;
  crewSize: number;
  override: { priceCents: number; reason: string } | null;
};

type Overrides = Required<QuoteDraftInput>["overrides"];

const NO_OVERRIDES: Overrides = { deep: null, standard: null };

const oneOffTerms = (
  property: Property,
  crewSize: number,
  overrides: Overrides,
): Terms => ({
  kind: "one_off",
  visits: cleanTypesFor(property.kind).map((cleanType) => ({
    position: 0,
    cleanType,
    startsAt: null,
    crewSize,
    override: overrides[cleanType],
  })),
  condition: property.condition,
  discountPercent: 0,
});

const planTerms = (
  plan: { condition: Condition; planDiscountPercent: number },
  days: Omit<Visit, "position">[],
): Terms => ({
  kind: "service_plan",
  visits: days.map((day, position) => ({ ...day, position })),
  condition: plan.condition,
  discountPercent: plan.planDiscountPercent,
});

// The Revision's visits priced from the Price List and the Service each
// Clean Type stands for, for the Property as it is now, with any override in
// place of the Suggested Price, then any Plan Discount off that, overridden
// or not. Tax is on what's left, at the Service's one-off or plan rate, with
// tax-exempt Add-ons discounted alike.
const priceOptions = (
  list: Pricing,
  property: Property,
  addOnKeys: string[],
  terms: Terms,
) => {
  const chosen = list.addOns.filter((a) => addOnKeys.includes(a.key));
  const kept = (100 - terms.discountPercent) / 100;
  return terms.visits.map(
    ({ position, cleanType, startsAt, crewSize, override }) => {
      const service = serviceFor(list.services, property.kind, cleanType);
      const suggested = suggestedPrice(
        list,
        service,
        pricedOf(property),
        terms.condition,
        cleanType,
        chosen,
      );
      const oneOffCents = override?.priceCents ?? suggested.priceCents;
      const discountCents = percentOf(oneOffCents, terms.discountPercent);
      const priceCents = oneOffCents - discountCents;
      const taxCents = taxOn(priceCents, {
        hourlyRateCents: suggested.hourlyRateCents,
        taxPercent:
          terms.kind === "service_plan"
            ? (service.taxPlanPercent ?? service.taxOneOffPercent)
            : suggested.taxPercent,
        addOns: suggested.addOns.map((a) => ({
          ...a,
          hours: a.hours * kept,
        })),
      });
      return {
        position,
        cleanType,
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
        labourHours: suggested.labourHours,
      };
    },
  );
};

// A Service Plan Quote's weekday and its saving, from its option: the
// one-off price, taxed as a one-off Job the way its Suggested Price was,
// against the plan clean's price
const dayTermsOf = (row: RevisionOptionRow): PlanDayTerms => {
  const oneOffPriceCents = row.priceCents + row.discountCents;
  const oneOffTaxCents = taxOn(oneOffPriceCents, row.suggested);
  const oneOffTotalCents = oneOffPriceCents + oneOffTaxCents;
  return {
    startsAt: iso(row.startsAt),
    cleanType: row.cleanType,
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
  rows: RevisionOptionRow[],
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
  revision: Pick<KindedRevision, "kind" | "depositPercent">,
  row: RevisionOptionRow,
): QuoteOption => ({
  cleanType: row.cleanType,
  serviceName: row.suggested.serviceName ?? null,
  // a Service Plan's Clean Types are the ones chosen for it
  recommended: revision.kind === "one_off" && row.cleanType === "deep",
  labourHours: row.labourHours,
  hoursOnSite: Math.round((row.labourHours / row.crewSize) * 100) / 100,
  priceCents: row.priceCents,
  taxCents: row.taxCents,
  totalCents: row.totalCents,
  depositCents: percentOf(row.totalCents, revision.depositPercent),
});

// a Service Plan Quote's weekdays in order; a one-off Quote's Deep Clean
// first
export const inOrder = <T extends { position: number; cleanType: CleanType }>(
  options: T[],
) =>
  [...options].sort(
    (a, b) =>
      a.position - b.position ||
      CLEAN_TYPES.indexOf(a.cleanType) - CLEAN_TYPES.indexOf(b.cleanType),
  );

// what each Add-on on the Revision costs, tax included, from the figures it
// was priced with
const addOnsOf = (rows: RevisionOptionRow[]): QuoteAddOn[] => {
  const { suggested } = rows[0]!;
  return suggested.addOns.map((addOn) => {
    const cents = addOnCents(addOn.hours, suggested.hourlyRateCents);
    const tax = addOn.taxExempt
      ? 0
      : taxOn(cents, { ...suggested, addOns: [] });
    return { key: addOn.key, name: addOn.name, totalCents: cents + tax };
  });
};

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

// the Clean Types a Quote can still be booked as: none once it isn't Sent
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

const findRevision = async (id: string | null) => {
  if (!id) return undefined;
  const [revision] = await db
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
      cleanType: job.cleanType,
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

// Standard first: it's what a plan is unless Office Staff choose otherwise
const PLAN_CLEAN_TYPES: CleanType[] = ["standard", "deep"];

// An unsent Service Plan Revision's weekdays each priced as each Clean Type,
// for Office Staff to choose between: the day's own Clean Type as saved, and
// the other worked out now from the current Price List with the same terms
// and Add-ons, at its Suggested Price (an override is only ever for the
// Clean Type chosen)
const planChoicesOf = (
  revision: KindedRevision,
  rows: RevisionOptionRow[],
  list: Pricing,
  property: Property,
): PlanChoice[][] =>
  inOrder(rows).map((saved) =>
    PLAN_CLEAN_TYPES.filter((t) =>
      cleanTypesFor(property.kind).includes(t),
    ).map((cleanType) => {
      const row =
        cleanType === saved.cleanType
          ? saved
          : {
              ...priceOptions(
                list,
                property,
                saved.suggested.addOns.map((a) => a.key),
                planTerms(
                  {
                    condition: revision.condition!,
                    planDiscountPercent: revision.planDiscountPercent!,
                  },
                  [{ ...saved, cleanType, override: null }],
                ),
              )[0]!,
              position: saved.position,
              revisionId: revision.id,
            };
      return { option: officeOption(revision, row), day: dayTermsOf(row) };
    }),
  );

// one Revision in full, for the Office
const officeRevision = async (
  revision: KindedRevision,
  list: Pricing,
  property: Property,
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
    options: inOrder(rows).map((r) => officeOption(revision, r)),
    // with the Condition it's priced for, which is the Office's working
    plan: plan && { ...plan, condition: revision.condition! },
    planChoices:
      revision.kind === "service_plan" && !sent
        ? planChoicesOf(revision, rows, list, property)
        : null,
    addOns: addOnsOf(rows),
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
// Suggested Price for both Clean Types worked out now from the current
// Price List and the Property's current details and Condition (which Staff
// may have corrected); the Revision being drafted and the offer; and every
// Sent Revision
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
  ] = await Promise.all([
    paymentMethodOf(client.id),
    quote.kind === "service_plan" ? findingsOf(propertyId) : null,
    askedAddOns([id]),
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
  ]);
  const asked = addOns.get(id) ?? [];
  const chosen = list.addOns.filter((a) => asked.some((c) => c.key === a.key));
  const price = (cleanType: CleanType) =>
    suggestedPrice(
      list,
      serviceFor(list.services, property.kind, cleanType),
      pricedOf(property),
      property.condition,
      cleanType,
      chosen,
    );

  return {
    id: quote.id,
    kind: quote.kind,
    status,
    origin: quote.origin,
    asked: askedOf(quote, asked),
    createdAt: quote.createdAt.toISOString(),
    client: {
      id: client.id,
      name: client.name,
      businessName: client.businessName,
      email: client.email,
      phone: client.phone,
    },
    property: toPropertyView(property, list),
    suggested: {
      priceListVersion: list.version,
      standard: price("standard"),
      // business premises have only their commercial cleaning
      deep: property.kind === "commercial" ? null : price("deep"),
    },
    needsSiteVisit: await needsSiteVisit(property),
    siteVisit: siteVisitOf(status, stages.get(propertyId)),
    bookedSiteVisit: booked[0] ?? null,
    findingsRecorded: done.has(propertyId),
    firstCleanCompleted: firstCleanDone,
    homePlanId,
    firstClean,
    addOnChoices: await addOnChoices(list, property, id),
    draft: draft
      ? await officeRevision(kinded(quote, draft), list, property)
      : null,
    offer: offer
      ? await officeRevision(kinded(quote, offer), list, property)
      : null,
    revisions,
    declinedAt: iso(quote.declinedAt),
    acceptedAt: iso(quote.acceptedAt),
    acceptedCleanType: quote.acceptedCleanType,
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
    .select({ quote: quotes, offer: offers, property: properties })
    .from(quotes)
    .innerJoin(offers, eq(offers.id, quotes.sentRevisionId))
    .innerJoin(properties, eq(properties.id, quotes.propertyId))
    .where(and(eq(quotes.id, id), eq(properties.clientId, clientId)));
  if (!found) throw new NotFoundError("Quote not found");
  const { quote, offer, property } = found;
  const revision = kinded(quote, offer);
  const rows = await optionsOf(offer.id);
  const status = currentStatusOf(quote, offer);

  return {
    id: quote.id,
    kind: quote.kind!,
    status,
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
    },
    options: inOrder(rows).map((r) => toOption(revision, r)),
    plan: planOf(revision, rows),
    addOns: addOnsOf(rows),
    crewSize: offer.crewSize,
    depositPercent: offer.depositPercent,
    proposedStartsAt: offer.proposedStartsAt!.toISOString(),
    sentAt: offer.sentAt!.toISOString(),
    // the email for a later Revision says it's updated, too
    updatedAt: offer.number > 1 ? offer.sentAt!.toISOString() : null,
    expiresAt: offer.expiresAt!.toISOString(),
    declinedAt: iso(quote.declinedAt),
    acceptedAt: iso(quote.acceptedAt),
    acceptedCleanType: quote.acceptedCleanType,
    ...(await acceptedPlanOf(quote)),
    changesPlan: await planChangeFor(quote, status, offer),
    bookable: await bookableOf(quote, status, offer),
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
  const [addOns, visits] = await Promise.all([
    askedAddOns([id]),
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
    asked: askedOf(quote, addOns.get(id) ?? [])!,
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
  one_off: "one-off Quote",
  service_plan: "Service Plan Quote",
};

/**
 * A Service Plan Quote for a home also needs its First Clean Completed;
 * business premises need none, only the Site Visit every Quote for them
 * needs before it's Sent (ADR-0014).
 */
const refuseUnquotable = async (
  kind: QuoteKind,
  property: Pick<Property, "id" | "kind">,
) => {
  if (
    kind === "service_plan" &&
    property.kind === "residential" &&
    !(await firstCleanCompleted(property.id))
  ) {
    throw new ConflictError(
      "A Service Plan can only start once this home's First Clean is Completed.",
    );
  }
};

// holds a Property until the transaction ends, so starting, sending and
// accepting its Quotes take turns
export const lockProperty = async (tx: Tx, propertyId: string) => {
  await tx
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .for("update");
};

/**
 * Refuses a Quote of `kind` becoming open at the Property while another is
 * (ADR-0017): a Requested one counts as both kinds. Sent ones whose offer
 * has Expired are written as Expired, so they stand aside. Inside a
 * transaction holding the Property (lockProperty).
 */
const refuseAnotherOpen = async (
  tx: Tx,
  quote: Pick<Quote, "propertyId"> & { id: string | null },
  kind: QuoteKind,
  message: string,
) => {
  const others = await tx
    .select({
      id: quotes.id,
      kind: quotes.kind,
      status: quotes.status,
      expiresAt: offers.expiresAt,
    })
    .from(quotes)
    .leftJoin(offers, eq(offers.id, quotes.sentRevisionId))
    .where(
      and(
        eq(quotes.propertyId, quote.propertyId),
        quote.id ? ne(quotes.id, quote.id) : undefined,
        or(eq(quotes.kind, kind), isNull(quotes.kind)),
        inArray(quotes.status, ["requested", "draft", "sent"]),
      ),
    );
  const lapsed = others.filter((q) => statusOf(q) === "expired");
  if (lapsed.length < others.length) throw new ConflictError(message);
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
};

// what a new Revision starts from: a copy of the offer's terms, or for the
// first, the Price List's defaults and the Add-ons asked for (none on a
// Service Plan Quote)
const newRevisionOptions = async (
  quote: Quote,
  kind: QuoteKind,
  property: Property,
  list: Pricing,
) => {
  const offer = await findRevision(quote.sentRevisionId);
  if (offer) {
    const rows = inOrder(await optionsOf(offer.id));
    const addOnKeys = rows[0]!.suggested.addOns.map((a) => a.key);
    const overrideOf = (row: RevisionOptionRow | undefined) =>
      !row || row.overrideCents === null
        ? null
        : { priceCents: row.overrideCents, reason: row.overrideReason! };
    const terms =
      kind === "service_plan"
        ? planTerms(
            {
              condition: offer.condition!,
              planDiscountPercent: offer.planDiscountPercent!,
            },
            rows.map((row) => ({ ...row, override: overrideOf(row) })),
          )
        : oneOffTerms(property, offer.crewSize, {
            deep: overrideOf(rows.find((r) => r.cleanType === "deep")),
            standard: overrideOf(rows.find((r) => r.cleanType === "standard")),
          });
    return {
      revision: {
        crewSize: offer.crewSize,
        depositPercent: offer.depositPercent,
        validityDays: offer.validityDays,
        proposedStartsAt: offer.proposedStartsAt,
        recurrence: offer.recurrence,
        planDiscountPercent: offer.planDiscountPercent,
        condition: offer.condition,
      },
      options: priceOptions(list, property, addOnKeys, terms),
    };
  }

  const plan =
    kind === "service_plan"
      ? { ...PLAN_DEFAULTS, planDiscountPercent: list.planDiscountPercent }
      : null;
  const addOnKeys = plan
    ? []
    : ((await askedAddOns([quote.id])).get(quote.id) ?? []).map((a) => a.key);
  return {
    revision: {
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
        ? planTerms(plan, [
            {
              cleanType: plan.cleanType,
              startsAt: null,
              crewSize: list.defaultCrewSize,
              override: null,
            },
          ])
        : oneOffTerms(property, list.defaultCrewSize, NO_OVERRIDES),
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
) => {
  const list = await currentPricing();
  const { revision, options } = await newRevisionOptions(
    quote,
    kind,
    property,
    list,
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

const closedMessage: Partial<Record<QuoteStatus, string>> = {
  accepted:
    "The Client accepted this Quote, so it's booked. They can ask for a new Quote.",
  declined:
    "The Client declined this Quote, so it has ended. They can ask for a new Quote.",
  turned_down:
    "This Quote was Turned Down. The Client can ask for a new Quote.",
};

/**
 * Starts a Quote's Draft Revision, pre-filled: the first from the Suggested
 * Price and the Price List's defaults (a one-off Quote with the Add-ons
 * asked for; a Service Plan Quote with the plan defaults, a Standard Clean
 * every 2 weeks at moderate Condition, no Add-ons, the Price List's Plan
 * Discount), a later one from the offer's terms. A Requested Quote's first
 * sets its kind, one-off unless said otherwise, which then never changes.
 * A Quote drafts one Revision at a time, so if it has one, that's the one
 * returned. An Expired Quote may be revived this way unless a newer Quote
 * of its kind is open for the Property (ADR-0017).
 */
export const startRevision = async (
  id: string,
  wanted: QuoteKind | undefined,
  accountId: string,
): Promise<{ quote: OfficeQuote; started: boolean }> => {
  const quote = await findQuote(id);
  const closed = closedMessage[quote.status];
  if (closed) throw new ConflictError(closed);
  const kind = quote.kind ?? wanted ?? "one_off";
  if (wanted && wanted !== kind) {
    throw new ConflictError(
      `This is a ${kindLabel[kind]}: its kind can't change. Start a new Quote for the other.`,
    );
  }
  if (await draftRevisionOf(id)) {
    return { quote: await officeQuote(id), started: false };
  }
  const { property } = (await homeOf(quote.propertyId))!;
  await refuseUnquotable(kind, property);

  await db.transaction(async (tx) => {
    await lockProperty(tx, quote.propertyId);
    const current = await findQuote(id, tx);
    if (closedMessage[current.status]) {
      throw new ConflictError(closedMessage[current.status]!);
    }
    // two at once: the other started it
    if (await draftRevisionOf(id, tx)) return;
    const offer = await findRevision(current.sentRevisionId);
    if (currentStatusOf(current, offer) === "expired") {
      await refuseAnotherOpen(
        tx,
        current,
        kind,
        `A newer ${kindLabel[kind]} is open for this ${property.kind === "commercial" ? "business" : "home"}: carry on with that one.`,
      );
    }
    if (current.status === "requested") {
      await refuseAnotherOpen(
        tx,
        current,
        kind,
        `This ${property.kind === "commercial" ? "business" : "home"} has a ${kindLabel[kind]} open already: carry on with that one.`,
      );
      await tx
        .update(quotes)
        .set({ kind, status: "draft" })
        .where(eq(quotes.id, id));
    }
    await insertRevision(tx, { ...current, kind }, kind, property, accountId);
  });
  return { quote: await officeQuote(id), started: true };
};

/**
 * Office Staff offer a Service Plan nobody asked for (ADR-0011, ADR-0017):
 * a Service Plan Quote with nothing asked, starting as a Draft with its
 * first Revision. If the Office has one for the Property still a Draft,
 * that's the one returned; otherwise it's refused while the Property has a
 * Service Plan Quote, or a Requested one, open.
 */
export const offerServicePlan = async (
  propertyId: string,
  accountId: string,
): Promise<{ quote: OfficeQuote; started: boolean }> => {
  const home = await homeOf(propertyId);
  if (!home) throw new NotFoundError("Home not found");
  const { property } = home;
  await refuseUnquotable("service_plan", property);
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
      "service_plan",
      "This home has a Service Plan Quote, or a Quote asked for, open already: carry on with that one.",
    );
    const [quote] = await tx
      .insert(quotes)
      .values({
        propertyId,
        kind: "service_plan",
        status: "draft",
        origin: "office",
        createdBy: accountId,
      })
      .returning();
    await insertRevision(tx, quote!, "service_plan", property, accountId);
    return { id: quote!.id, started: true };
  });
  return { quote: await officeQuote(id), started };
};

// the Revision being drafted, which is all Office Staff can change
const findDraftRevision = async (id: string) => {
  const quote = await findQuote(id);
  const draft = await draftRevisionOf(id);
  if (!draft) {
    throw new ConflictError(
      "A Revision can't be changed once it's been sent: start a new one.",
    );
  }
  return { quote, draft: kinded(quote, draft) };
};

// A Service Plan Draft's weekdays as Office Staff set them, in their order:
// each on a weekday of its own, all within a week of the first, and on
// several only every week (ADR-0013). Days not yet timed are left be.
const planVisits = (plan: ServicePlanInput) => {
  const days = plan.days.map((day) => ({
    cleanType: day.cleanType,
    crewSize: day.crewSize,
    override: day.override,
    startsAt: day.start && atTime(day.start.date, day.start.time),
  }));
  if (days.length > 1 && plan.recurrence !== "weekly") {
    throw fieldError(
      ["plan", "recurrence"],
      "A plan on several weekdays comes round every week",
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
        "Another day of this plan is on that weekday: choose another",
      );
    }
    if (day >= addDays(first!, 7)) {
      throw fieldError(
        ["plan", "days", i, "start"],
        "Start each weekday within a week of the plan's first clean",
      );
    }
  }
  return days;
};

// saves what Office Staff set on a Quote's Draft Revision, pricing it afresh
// from the current Price List and the home's current details
export const saveDraft = async (
  id: string,
  input: QuoteDraftInput,
): Promise<OfficeQuote> => {
  const { quote, draft } = await findDraftRevision(id);
  const [home, list] = await Promise.all([
    homeOf(quote.propertyId),
    currentPricing(),
  ]);

  const allowed = new Set(
    (await addOnChoices(list, home!.property, id)).map((a) => a.key),
  );
  const unknown = input.addOns.findIndex((key) => !allowed.has(key));
  if (unknown !== -1) {
    throw fieldError(["addOns", unknown], "Choose from the Add-ons listed");
  }

  const plan = input.plan ?? null;
  let terms: Terms;
  let timing: { crewSize: number; proposedStartsAt: Date | null };
  if (draft.kind === "service_plan") {
    if (!plan) {
      throw fieldError(
        ["plan"],
        "Choose how often, the Plan Discount, the Condition and the weekdays",
      );
    }
    // each weekday has its own
    const other = CLEAN_TYPES.find((t) => input.overrides?.[t]);
    if (other) {
      throw fieldError(
        ["overrides", other],
        "Override each weekday's price on that weekday",
      );
    }
    const days = planVisits(plan);
    terms = planTerms(
      { condition: plan.condition, planDiscountPercent: plan.discountPercent },
      days,
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
      throw fieldError(["plan"], "Only a Service Plan Quote has plan terms");
    }
    if (input.crewSize === undefined) {
      throw fieldError(["crewSize"], "Enter a Crew Size");
    }
    terms = oneOffTerms(
      home!.property,
      input.crewSize,
      input.overrides ?? NO_OVERRIDES,
    );
    timing = {
      crewSize: input.crewSize,
      proposedStartsAt: input.proposedStart
        ? atTime(input.proposedStart.date, input.proposedStart.time)
        : null,
    };
  }

  const options = priceOptions(
    list,
    home!.property,
    [...new Set(input.addOns)],
    terms,
  );
  await db.transaction(async (tx) => {
    await tx
      .update(quoteRevisions)
      .set({
        priceListId: list.id,
        depositPercent: input.depositPercent,
        validityDays: input.validityDays,
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

const HOUR_MS = 3_600_000;

// Each clean a Draft Revision would book first, with the field that sets its
// time: a one-off Quote's Job, the longer of its Clean Types; a Service Plan
// Quote's first on each weekday. Each must have a time still to come, and
// end by midnight.
const refuseUntimely = (
  revision: KindedRevision,
  rows: RevisionOptionRow[],
) => {
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
          ? "Choose when this weekday's first clean is"
          : "Choose a proposed time",
      );
    }
    if (startsAt <= now) {
      throw fieldError(path, "Choose a time that's still to come");
    }
    const midnight = startOfDay(addDays(dayOf(startsAt), 1));
    if (
      startsAt.getTime() + option.hoursOnSite * HOUR_MS >
      midnight.getTime()
    ) {
      throw fieldError(
        path,
        "Cleans end by midnight: choose an earlier start time",
      );
    }
  }
};

// Sends a Quote's Draft Revision as it was last saved, making it the offer,
// and emails the Client a link to the Quote. A Service Plan Quote's weekdays
// are put in order, earliest first. Sending one on an Expired Quote revives
// it, unless a newer Quote of its kind is open for the Property.
export const sendQuote = async (id: string): Promise<OfficeQuote> => {
  const { quote, draft } = await findDraftRevision(id);
  const closed = closedMessage[quote.status];
  if (closed) throw new ConflictError(closed);
  const now = clock.now();
  const rows = await optionsOf(draft.id);
  refuseUntimely(draft, rows);
  const { client, property } = (await homeOf(quote.propertyId))!;
  await refuseUnquotable(draft.kind, property);
  // it goes by email, and is accepted signed in with that email (#34)
  if (!client.email) {
    throw new ConflictError(
      `${client.name} has no email yet, so the Quote can't be sent. Add their email on their Client screen, then send it.`,
    );
  }
  // business premises are seen before they're quoted (ADR-0014)
  if (await needsSiteVisit(property)) {
    throw new ConflictError(
      "These premises haven't had a Site Visit, so the Quote can't be sent. Record its findings on the Property, then send it.",
    );
  }

  const expiresAt = new Date(
    Math.min(
      now.getTime() + draft.validityDays * DAY_MS,
      draft.proposedStartsAt!.getTime(),
    ),
  );
  const days =
    draft.kind === "service_plan"
      ? [...rows]
          .sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime())
          .map((row, position) => ({ ...row, position }))
      : null;

  await db.transaction(async (tx) => {
    // one send (or acceptance) at a time per Property
    await lockProperty(tx, quote.propertyId);
    // it may have been Accepted while this waited
    const current = await findQuote(id, tx);
    if (closedMessage[current.status]) {
      throw new ConflictError(closedMessage[current.status]!);
    }
    const offer = await findRevision(current.sentRevisionId);
    if (currentStatusOf(current, offer) === "expired") {
      await refuseAnotherOpen(
        tx,
        current,
        draft.kind,
        `A newer ${kindLabel[draft.kind]} is open for this ${property.kind === "commercial" ? "business" : "home"}, so this one can't be sent again.`,
      );
    }
    const [sent] = await tx
      .update(quoteRevisions)
      .set({
        sentAt: now,
        expiresAt,
        ...(days && { crewSize: days[0]!.crewSize }),
      })
      .where(
        and(eq(quoteRevisions.id, draft.id), isNull(quoteRevisions.sentAt)),
      )
      .returning();
    if (!sent) {
      throw new ConflictError(
        "A Revision can't be changed once it's been sent: start a new one.",
      );
    }
    if (days) {
      await tx
        .delete(revisionOptions)
        .where(eq(revisionOptions.revisionId, draft.id));
      await tx.insert(revisionOptions).values(days);
    }
    await tx
      .update(quotes)
      .set({ status: "sent", sentRevisionId: draft.id })
      .where(eq(quotes.id, id));
  });

  const view = await officeQuote(id);
  // the Quote is sent: an email that can't go mustn't make it look as though
  // it wasn't
  try {
    await sendQuoteEmail(client, view);
  } catch (error) {
    console.error(`email for Quote ${id} not sent:`, error);
  }
  return view;
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
    throw new ConflictError(
      quote.status === "expired"
        ? "This Quote has expired, so there's nothing to decline."
        : "This Quote is no longer open.",
    );
  }
  await db.transaction(async (tx) => {
    const [declined] = await tx
      .update(quotes)
      .set({ status: "declined", declinedAt: clock.now() })
      .where(and(eq(quotes.id, id), eq(quotes.status, "sent")))
      .returning({ id: quotes.id });
    if (declined) await dropDraftRevision(tx, id);
  });
  return clientQuote(id, clientId);
};

// why, as the Client is told it
const turnDownWording: Record<TurnDownReason, string> = {
  out_of_area: "it's outside the area we clean",
  out_of_scope: "it needs more than the cleaning we offer",
  no_capacity: "we don't have room for it at the moment",
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
  const [turned] = await db
    .update(quotes)
    .set({
      status: "turned_down",
      turnedDownAt: clock.now(),
      turnDownReason: reason,
      turnedDownBy: accountId,
    })
    .where(
      and(eq(quotes.id, id), inArray(quotes.status, ["requested", "draft"])),
    )
    .returning();
  if (!turned) {
    throw new ConflictError(
      quote.sentRevisionId
        ? "A Revision of this Quote has been sent, so it can't be Turned Down: the Client declines it, or it Expires."
        : "This Quote has closed already.",
    );
  }
  const { client, property } = (await homeOf(quote.propertyId))!;
  if (client.email) {
    try {
      await sendTurnDownEmail(client, property, id, reason);
    } catch (error) {
      console.error(`Turn Down email for Quote ${id} not sent:`, error);
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
    subject: "About your Quote from Empire Cleaning",
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        `Thanks for asking Empire Cleaning for a Quote for ${addressOf(property)}. We're sorry, but we can't quote for it: ${turnDownWording[reason]}.`,
        "If anything changes, you're welcome to ask us again.",
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/quotes/${quoteId}`,
        label: "See your Quote",
      },
    ),
  });
};

// a Service Plan Quote's offer, in an email: on one weekday, what each clean
// saves; on several, each weekday and what a week of them costs
const planOffer = (
  quote: OfficeQuote,
  offer: OfficeRevision,
  plan: ServicePlanTerms,
) => {
  const starting = formatWhen(new Date(offer.proposedStartsAt!));
  const address = addressOf(quote.property);
  if (plan.days.length === 1) {
    const [day] = plan.days;
    return [
      `Your Service Plan Quote for ${address} is ready: a ${cleanTypeLabel[day!.cleanType]} ${recurrenceLabel[plan.recurrence]}, starting ${starting}.`,
      `${formatMoney(offer.options[0]!.totalCents)} a clean, saving ${formatMoney(day!.savingCents)} on the one-off price of ${formatMoney(day!.oneOffTotalCents)} (Plan Discount ${plan.discountPercent}%).`,
    ];
  }
  return [
    `Your Service Plan Quote for ${address} is ready: ${describePlan(
      plan.recurrence,
      plan.days.map((d) => ({ ...d, startsAt: new Date(d.startsAt!) })),
    )}, starting ${starting}.`,
    offer.options
      .map(
        (option, i) =>
          `${weekdayName(new Date(plan.days[i]!.startsAt!))}: ${formatMoney(option.totalCents)}`,
      )
      .join("\n"),
    `${formatMoney(plan.roundTotalCents)} a week, ${plan.discountPercent}% off the one-off prices (Plan Discount).`,
  ];
};

// A plain link to the Quote's page, not the Revision's: it carries no
// sign-in power (ADR-0006), so a signed-out Client signs in (or up) with
// this email and comes back to it. A later Revision says the Quote has
// changed.
const sendQuoteEmail = async (client: Client, quote: OfficeQuote) => {
  const offer = quote.offer!;
  const [first, second] = offer.options;
  const lines = offer.plan
    ? planOffer(quote, offer, offer.plan)
    : [
        `Your Quote for ${addressOf(quote.property)} is ready, for ${formatWhen(new Date(offer.proposedStartsAt!))}:`,
        `Deep Clean (recommended): ${formatMoney(first!.totalCents)}\nStandard Clean: ${formatMoney(second!.totalCents)}`,
      ];
  const revised = offer.number > 1;
  if (revised) {
    lines[0] = lines[0]!.replace(" is ready", " has been updated");
  }

  await email.send({
    to: client.email,
    subject: `${revised ? "Your updated" : "Your"} ${offer.plan ? "Service Plan Quote" : "Quote"} from Empire Cleaning`,
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        ...lines,
        `Prices include tax. It's open until ${formatWhen(new Date(offer.expiresAt!))}. To see it in full, sign in with this email address (${client.email}):`,
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/quotes/${quote.id}`,
        label: "See your Quote",
      },
    ),
  });
};
