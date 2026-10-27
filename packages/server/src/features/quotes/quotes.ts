import { and, asc, eq, or } from "drizzle-orm";
import { z } from "zod";
import type {
  AddOnChoice,
  CleanType,
  Condition,
  FirstCleanFindings,
  OfficeQuote,
  OfficeQuoteOption,
  PlanChoice,
  PriceList,
  QuoteAddOn,
  QuoteDraftInput,
  QuoteKind,
  QuoteOption,
  QuoteView,
  Recurrence,
  ServicePlanTerms,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import env from "../../env.ts";
import {
  ConflictError,
  NotFoundError,
  RequestBodyError,
} from "../../middleware/errors.ts";
import { atTime, clock, dayOf, timeOf } from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatMoney,
  formatWhen,
} from "../../services/email/index.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { officeCompletionOf } from "../completion/completion.ts";
import { paymentMethodOf, toPaymentMethodView } from "../payments/payments.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { priceLists } from "../price-list/price-list.schema.ts";
import {
  addOnCents,
  pricedOf,
  suggestedPrice,
  taxOn,
} from "../price-list/suggested-price.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf, toPropertyView } from "../properties/property-view.ts";
import { addOnsForRequests } from "../quote-requests/add-ons.ts";
import { quoteRequests } from "../quote-requests/quote-requests.schema.ts";
import { planChangeOf } from "../service-plans/changing.ts";
import { servicePlanVisits } from "../service-plans/service-plans.schema.ts";
import { findingsRecorded } from "../site-visits/site-visits.ts";
import { bookableFor } from "./quote-room.ts";
import {
  firstCleanCompleted,
  firstCleansOf,
  requestStates,
  statusOf,
} from "./quote-state.ts";
import {
  quoteOptions,
  quotes,
  type Quote,
  type QuoteOptionRow,
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

// business premises with no Site Visit findings recorded, which no Quote
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

// the Add-ons a Quote can carry: those on offer for its kind of Property,
// and any the request it answers chose that have since been retired
const addOnChoices = async (
  list: PriceList,
  property: Property,
  quoteRequestId: string | null,
): Promise<AddOnChoice[]> => {
  const notFor = property.kind === "commercial" ? "homes" : "businesses";
  const requested = new Set(
    quoteRequestId
      ? (
          (await addOnsForRequests([quoteRequestId])).get(quoteRequestId) ?? []
        ).map((a) => a.key)
      : [],
  );
  return list.addOns
    .filter(
      (a) => (a.active && a.offeredFor !== notFor) || requested.has(a.key),
    )
    .map(({ key, name }) => ({ key, name }));
};

// What a Quote is priced for besides the Property and its Add-ons: a
// one-off Quote both Clean Types at the Property's own Condition (moderate
// while business premises have none recorded), undiscounted; a Service Plan
// Quote its one Clean Type at the Condition and Plan Discount on the Quote
type Terms = {
  kind: QuoteKind;
  cleanTypes: CleanType[];
  condition: Condition | null;
  discountPercent: number;
};

const oneOffTerms = (property: Property): Terms => ({
  kind: "one_off",
  cleanTypes: CLEAN_TYPES,
  condition: property.condition,
  discountPercent: 0,
});

const planTerms = (plan: {
  cleanType: CleanType;
  condition: Condition;
  planDiscountPercent: number;
}): Terms => ({
  kind: "service_plan",
  cleanTypes: [plan.cleanType],
  condition: plan.condition,
  discountPercent: plan.planDiscountPercent,
});

// a percentage of an amount, to the cent, halves up
const percentOf = (cents: number, percent: number) =>
  Math.floor((cents * percent + 50) / 100);

// The Quote's Clean Types priced from the Price List for the Property as it
// is now, with any override in place of the Suggested Price, then any Plan
// Discount off that, overridden or not. Tax is on what's left, at the rate
// for the kind of Job (a commercial one's, plan or not, is the commercial
// rate), with tax-exempt Add-ons discounted alike.
const priceOptions = (
  list: PriceList,
  property: Property,
  addOnKeys: string[],
  overrides: QuoteDraftInput["overrides"],
  terms: Terms,
) => {
  const chosen = list.addOns.filter((a) => addOnKeys.includes(a.key));
  const kept = (100 - terms.discountPercent) / 100;
  return terms.cleanTypes.map((cleanType) => {
    const suggested = suggestedPrice(
      list,
      pricedOf(property),
      terms.condition,
      cleanType,
      chosen,
    );
    const override = overrides[cleanType];
    const oneOffCents = override?.priceCents ?? suggested.priceCents;
    const discountCents = percentOf(oneOffCents, terms.discountPercent);
    const priceCents = oneOffCents - discountCents;
    const taxCents = taxOn(priceCents, {
      hourlyRateCents: suggested.hourlyRateCents,
      taxPercent:
        terms.kind === "service_plan" && property.kind === "residential"
          ? list.taxServicePlanPercent
          : suggested.taxPercent,
      addOns: suggested.addOns.map((a) => ({ ...a, hours: a.hours * kept })),
    });
    return {
      cleanType,
      suggested,
      overrideCents: override?.priceCents ?? null,
      overrideReason: override?.reason ?? null,
      discountCents,
      priceCents,
      taxCents,
      totalCents: priceCents + taxCents,
      labourHours: suggested.labourHours,
    };
  });
};

// A Service Plan Quote's terms and saving, from its one option: the one-off
// price, taxed as a one-off Job the way its Suggested Price was, against the
// per-Job price
const planOf = (
  quote: Quote,
  rows: QuoteOptionRow[],
): ServicePlanTerms | null => {
  if (quote.kind !== "service_plan") return null;
  const [row] = rows;
  const oneOffPriceCents = row!.priceCents + row!.discountCents;
  const oneOffTaxCents = taxOn(oneOffPriceCents, row!.suggested);
  const oneOffTotalCents = oneOffPriceCents + oneOffTaxCents;
  return {
    recurrence: quote.recurrence!,
    cleanType: row!.cleanType,
    discountPercent: quote.planDiscountPercent!,
    oneOffPriceCents,
    oneOffTaxCents,
    oneOffTotalCents,
    discountCents: row!.discountCents,
    savingCents: oneOffTotalCents - row!.totalCents,
  };
};

const optionsOf = (quoteId: string) =>
  db.select().from(quoteOptions).where(eq(quoteOptions.quoteId, quoteId));

export const toOption = (quote: Quote, row: QuoteOptionRow): QuoteOption => ({
  cleanType: row.cleanType,
  // a Service Plan's one Clean Type is the one chosen for it
  recommended: quote.kind === "one_off" && row.cleanType === "deep",
  labourHours: row.labourHours,
  hoursOnSite: Math.round((row.labourHours / quote.crewSize) * 100) / 100,
  priceCents: row.priceCents,
  taxCents: row.taxCents,
  totalCents: row.totalCents,
  // halves up, like the other roundings
  depositCents: Math.floor((row.totalCents * quote.depositPercent + 50) / 100),
});

const sortOptions = <T extends { cleanType: CleanType }>(options: T[]) =>
  [...options].sort(
    (a, b) =>
      CLEAN_TYPES.indexOf(a.cleanType) - CLEAN_TYPES.indexOf(b.cleanType),
  );

// what each Add-on on the Quote costs, tax included, from the figures the
// Quote was priced with
const addOnsOf = (rows: QuoteOptionRow[]): QuoteAddOn[] => {
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

// what a Service Plan Quote would do to its home's plan, while it's open
const planChangeFor = (quote: Quote) =>
  quote.kind === "service_plan" && ["draft", "sent"].includes(statusOf(quote))
    ? planChangeOf(quote.propertyId, quote.proposedStartsAt)
    : null;

// the Clean Types a Quote can still be booked as: none once it isn't Sent
const bookableOf = async (quote: Quote) =>
  statusOf(quote) === "sent"
    ? (
        await bookableFor([
          { id: quote.id, proposedStartsAt: quote.proposedStartsAt! },
        ])
      ).get(quote.id)!
    : [];

const findQuote = async (id: string) => {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
  if (!quote) throw new NotFoundError("Quote not found");
  return quote;
};

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
  quote: Quote,
  row: QuoteOptionRow,
): OfficeQuoteOption => ({
  ...toOption(quote, row),
  suggested: row.suggested,
  overrideCents: row.overrideCents,
  overrideReason: row.overrideReason,
});

// Standard first: it's what a plan is unless Office Staff choose otherwise
const PLAN_CLEAN_TYPES: CleanType[] = ["standard", "deep"];

// A Service Plan Draft priced as each Clean Type, for Office Staff to choose
// between: its own Clean Type as saved, and the other worked out now from
// the current Price List with the same terms and Add-ons, at its Suggested
// Price (an override is only ever for the Clean Type chosen)
const planChoicesOf = (
  quote: Quote,
  [saved]: QuoteOptionRow[],
  list: PriceList,
  property: Property,
): PlanChoice[] =>
  PLAN_CLEAN_TYPES.map((cleanType) => {
    const row =
      cleanType === saved!.cleanType
        ? saved!
        : {
            ...priceOptions(
              list,
              property,
              saved!.suggested.addOns.map((a) => a.key),
              { deep: null, standard: null },
              planTerms({
                cleanType,
                condition: quote.condition!,
                planDiscountPercent: quote.planDiscountPercent!,
              }),
            )[0]!,
            quoteId: quote.id,
          };
    return { option: officeOption(quote, row), plan: planOf(quote, [row])! };
  });

// a Quote in full, for the Office
export const officeQuote = async (id: string): Promise<OfficeQuote> => {
  const quote = await findQuote(id);
  const [home, rows, list, [priced]] = await Promise.all([
    homeOf(quote.propertyId),
    optionsOf(id),
    currentPriceList(),
    db
      .select({ version: priceLists.version })
      .from(priceLists)
      .where(eq(priceLists.id, quote.priceListId)),
  ]);
  const { client, property } = home!;
  const [paymentMethod, firstClean] = await Promise.all([
    paymentMethodOf(client.id),
    quote.kind === "service_plan" ? findingsOf(property.id) : null,
  ]);
  const plan = planOf(quote, rows);

  return {
    id: quote.id,
    quoteRequestId: quote.quoteRequestId,
    kind: quote.kind,
    status: statusOf(quote),
    client: {
      id: client.id,
      name: client.name,
      businessName: client.businessName,
      email: client.email,
    },
    needsSiteVisit: await needsSiteVisit(property),
    property: toPropertyView(property, list),
    options: sortOptions(rows).map((r) => officeOption(quote, r)),
    // with the Condition it's priced for, which is the Office's working
    plan: plan && { ...plan, condition: quote.condition! },
    firstClean,
    planChoices:
      quote.kind === "service_plan" && quote.status === "draft"
        ? planChoicesOf(quote, rows, list, property)
        : null,
    addOns: addOnsOf(rows),
    addOnChoices: await addOnChoices(list, property, quote.quoteRequestId),
    crewSize: quote.crewSize,
    depositPercent: quote.depositPercent,
    validityDays: quote.validityDays,
    priceListVersion: priced!.version,
    proposedStart: quote.proposedStartsAt && {
      date: dayOf(quote.proposedStartsAt),
      time: timeOf(quote.proposedStartsAt),
    },
    proposedStartsAt: iso(quote.proposedStartsAt),
    sentAt: iso(quote.sentAt),
    expiresAt: iso(quote.expiresAt),
    declinedAt: iso(quote.declinedAt),
    acceptedAt: iso(quote.acceptedAt),
    acceptedCleanType: quote.acceptedCleanType,
    ...(await acceptedPlanOf(quote)),
    changesPlan: await planChangeFor(quote),
    bookable: await bookableOf(quote),
    paymentMethod: toPaymentMethodView(paymentMethod),
  };
};

// a Client's own Quote; Drafts and other Clients' Quotes don't exist for them
export const clientQuote = async (
  id: string,
  clientId: string,
): Promise<QuoteView> => {
  const [found] = await db
    .select({ quote: quotes, property: properties })
    .from(quotes)
    .innerJoin(properties, eq(properties.id, quotes.propertyId))
    .where(and(eq(quotes.id, id), eq(properties.clientId, clientId)));
  if (!found || found.quote.status === "draft") {
    throw new NotFoundError("Quote not found");
  }
  const { quote, property } = found;
  const rows = await optionsOf(id);

  return {
    id: quote.id,
    quoteRequestId: quote.quoteRequestId,
    kind: quote.kind,
    status: statusOf(quote),
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
    },
    options: sortOptions(rows).map((r) => toOption(quote, r)),
    plan: planOf(quote, rows),
    addOns: addOnsOf(rows),
    crewSize: quote.crewSize,
    depositPercent: quote.depositPercent,
    proposedStartsAt: quote.proposedStartsAt!.toISOString(),
    sentAt: quote.sentAt!.toISOString(),
    expiresAt: quote.expiresAt!.toISOString(),
    declinedAt: iso(quote.declinedAt),
    acceptedAt: iso(quote.acceptedAt),
    acceptedCleanType: quote.acceptedCleanType,
    ...(await acceptedPlanOf(quote)),
    changesPlan: await planChangeFor(quote),
    bookable: await bookableOf(quote),
  };
};

const kindLabel: Record<QuoteKind, string> = {
  one_off: "one-off Quote",
  service_plan: "Service Plan Quote",
};

// what a Draft is started for: a Quote Request, answered with a one-off
// Quote or a Service Plan Quote; or a Property offered a Service Plan
// unprompted
export type DraftTarget =
  | { quoteRequestId: string; kind: QuoteKind }
  | { propertyId: string; kind: "service_plan" };

/**
 * Starts a Draft, pre-filled from the Suggested Price and the Price List's
 * defaults. A one-off Quote starts with the Add-ons the Client chose; a
 * Service Plan Quote with the plan defaults (a Standard Clean every 2 weeks
 * at moderate Condition, no Add-ons, the Price List's Plan Discount). A
 * request has at most one Draft, and a Property one Service Plan Draft, so
 * if the one asked for exists already that's the one returned.
 */
export const startDraft = async (
  target: DraftTarget,
  accountId: string,
): Promise<{ quote: OfficeQuote; started: boolean }> => {
  const { kind } = target;
  let quoteRequestId: string | null = null;
  let propertyId: string;
  if ("quoteRequestId" in target) {
    const [request] = await db
      .select({ id: quoteRequests.id, propertyId: quoteRequests.propertyId })
      .from(quoteRequests)
      .where(eq(quoteRequests.id, target.quoteRequestId));
    if (!request) throw new NotFoundError("Quote Request not found");
    quoteRequestId = request.id;
    propertyId = request.propertyId;
  } else {
    propertyId = target.propertyId;
  }
  const home = await homeOf(propertyId);
  if (!home) throw new NotFoundError("Home not found");

  // the request's Draft, and the home's Service Plan Draft
  const drafts = await db
    .select({
      id: quotes.id,
      kind: quotes.kind,
      quoteRequestId: quotes.quoteRequestId,
    })
    .from(quotes)
    .where(
      and(
        eq(quotes.status, "draft"),
        or(
          quoteRequestId
            ? eq(quotes.quoteRequestId, quoteRequestId)
            : undefined,
          kind === "service_plan"
            ? and(
                eq(quotes.propertyId, propertyId),
                eq(quotes.kind, "service_plan"),
              )
            : undefined,
        ),
      ),
    );
  const same = drafts.find(
    (d) => d.kind === kind && d.quoteRequestId === quoteRequestId,
  );
  if (same) return { quote: await officeQuote(same.id), started: false };
  const [other] = drafts;
  if (other) {
    throw new ConflictError(
      other.quoteRequestId === quoteRequestId
        ? `This request has a ${kindLabel[other.kind]} Draft already: send that first, or carry on with it.`
        : "This home has a Service Plan Quote Draft already: send that first, or carry on with it.",
    );
  }
  await refuseUnquotable(kind, propertyId, quoteRequestId);

  const list = await currentPriceList();
  const plan =
    kind === "service_plan"
      ? { ...PLAN_DEFAULTS, planDiscountPercent: list.planDiscountPercent }
      : null;
  const addOnKeys =
    plan || !quoteRequestId
      ? []
      : (
          (await addOnsForRequests([quoteRequestId])).get(quoteRequestId) ?? []
        ).map((a) => a.key);
  const options = priceOptions(
    list,
    home.property,
    addOnKeys,
    { deep: null, standard: null },
    plan ? planTerms(plan) : oneOffTerms(home.property),
  );

  const id = await db.transaction(async (tx) => {
    const [quote] = await tx
      .insert(quotes)
      .values({
        propertyId,
        quoteRequestId,
        kind,
        priceListId: list.id,
        crewSize: list.defaultCrewSize,
        depositPercent: list.depositPercent,
        validityDays: list.quoteValidityDays,
        recurrence: plan?.recurrence,
        planDiscountPercent: plan?.planDiscountPercent,
        condition: plan?.condition,
        createdBy: accountId,
      })
      .returning();
    await tx
      .insert(quoteOptions)
      .values(options.map((o) => ({ ...o, quoteId: quote!.id })));
    return quote!.id;
  });
  return { quote: await officeQuote(id), started: true };
};

/**
 * A request whose Quote the Client Accepted or Declined is closed to Quotes
 * of either kind: they ask again if they want something more (and the
 * Office can still offer a plan unprompted). A Service Plan Quote also needs
 * the Property's First Clean Completed.
 */
const refuseUnquotable = async (
  kind: QuoteKind,
  propertyId: string,
  quoteRequestId: string | null,
) => {
  if (quoteRequestId) {
    const state = (await requestStates([quoteRequestId])).get(quoteRequestId);
    if (state === "booked") {
      throw new ConflictError(
        "The Client accepted a Quote for this request, so it's booked. They can ask for a new Quote.",
      );
    }
    if (state === "ended") {
      throw new ConflictError(
        "The Client declined the last Quote for this request, so it has ended. They can ask for a new Quote.",
      );
    }
  }
  if (kind === "service_plan" && !(await firstCleanCompleted(propertyId))) {
    throw new ConflictError(
      "A Service Plan can only start once this home's First Clean is Completed.",
    );
  }
};

// holds a Property until the transaction ends, so sending a Quote for it and
// accepting one take turns
export const lockProperty = async (tx: Tx, propertyId: string) => {
  await tx
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .for("update");
};

const findDraft = async (id: string) => {
  const quote = await findQuote(id);
  if (quote.status !== "draft") {
    throw new ConflictError("A Quote can't be changed once it's been sent");
  }
  return quote;
};

// saves what Office Staff set on a Draft, pricing it afresh from the current
// Price List and the home's current details
export const saveDraft = async (
  id: string,
  input: QuoteDraftInput,
): Promise<OfficeQuote> => {
  const quote = await findDraft(id);
  const [home, list] = await Promise.all([
    homeOf(quote.propertyId),
    currentPriceList(),
  ]);

  const allowed = new Set(
    (await addOnChoices(list, home!.property, quote.quoteRequestId)).map(
      (a) => a.key,
    ),
  );
  const unknown = input.addOns.findIndex((key) => !allowed.has(key));
  if (unknown !== -1) {
    throw fieldError(["addOns", unknown], "Choose from the Add-ons listed");
  }

  const plan = input.plan ?? null;
  if (quote.kind === "service_plan") {
    if (!plan) {
      throw fieldError(
        ["plan"],
        "Choose how often, the Clean Type, the Plan Discount and the Condition",
      );
    }
    // only the plan's own Clean Type has a price to override
    const other = CLEAN_TYPES.find(
      (t) => t !== plan.cleanType && input.overrides[t],
    );
    if (other) {
      throw fieldError(
        ["overrides", other],
        `This Service Plan's Jobs are ${cleanTypeLabel[plan.cleanType]}s`,
      );
    }
  } else if (plan) {
    throw fieldError(["plan"], "Only a Service Plan Quote has plan terms");
  }

  const addOnKeys = [...new Set(input.addOns)];
  const planColumns = plan && {
    recurrence: plan.recurrence,
    planDiscountPercent: plan.discountPercent,
    condition: plan.condition,
  };
  const options = priceOptions(
    list,
    home!.property,
    addOnKeys,
    input.overrides,
    plan
      ? planTerms({ ...planColumns!, cleanType: plan.cleanType })
      : oneOffTerms(home!.property),
  );
  await db.transaction(async (tx) => {
    await tx
      .update(quotes)
      .set({
        priceListId: list.id,
        crewSize: input.crewSize,
        depositPercent: input.depositPercent,
        validityDays: input.validityDays,
        proposedStartsAt:
          input.proposedStart &&
          atTime(input.proposedStart.date, input.proposedStart.time),
        ...planColumns,
      })
      .where(eq(quotes.id, id));
    await tx.delete(quoteOptions).where(eq(quoteOptions.quoteId, id));
    await tx
      .insert(quoteOptions)
      .values(options.map((o) => ({ ...o, quoteId: id })));
  });
  return officeQuote(id);
};

// Sends a Draft as it was last saved, and emails the Client a link to it. It
// Supersedes the Property's open Quote of the same kind, if any, in the same
// step, so a Property never has two of a kind open; one of the other kind
// stands beside it.
export const sendQuote = async (id: string): Promise<OfficeQuote> => {
  const quote = await findDraft(id);
  const now = clock.now();
  if (!quote.proposedStartsAt) {
    throw fieldError(["proposedStart"], "Choose a proposed time");
  }
  if (quote.proposedStartsAt <= now) {
    throw fieldError(["proposedStart"], "Choose a time that's still to come");
  }
  await refuseUnquotable(quote.kind, quote.propertyId, quote.quoteRequestId);
  // it goes by email, and is accepted signed in with that email (#34)
  const { client, property } = (await homeOf(quote.propertyId))!;
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
      now.getTime() + quote.validityDays * DAY_MS,
      quote.proposedStartsAt.getTime(),
    ),
  );

  await db.transaction(async (tx) => {
    // one send (or acceptance) at a time per Property
    await lockProperty(tx, quote.propertyId);
    // a Quote for its request may have been Accepted while this waited
    await refuseUnquotable(quote.kind, quote.propertyId, quote.quoteRequestId);
    const [open] = await tx
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.propertyId, quote.propertyId),
          eq(quotes.kind, quote.kind),
          eq(quotes.status, "sent"),
        ),
      );
    if (open) {
      await tx
        .update(quotes)
        .set({
          status: statusOf(open) === "expired" ? "expired" : "superseded",
        })
        .where(eq(quotes.id, open.id));
    }
    const [sent] = await tx
      .update(quotes)
      .set({ status: "sent", sentAt: now, expiresAt })
      .where(and(eq(quotes.id, id), eq(quotes.status, "draft")))
      .returning();
    if (!sent) {
      throw new ConflictError("A Quote can't be changed once it's been sent");
    }
  });

  const view = await officeQuote(id);
  const home = await homeOf(quote.propertyId);
  // the Quote is sent: an email that can't go mustn't make it look as though
  // it wasn't
  try {
    await sendQuoteEmail(home!.client, view);
  } catch (error) {
    console.error(`email for Quote ${id} not sent:`, error);
  }
  return view;
};

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
  await db
    .update(quotes)
    .set({ status: "declined", declinedAt: clock.now() })
    .where(and(eq(quotes.id, id), eq(quotes.status, "sent")));
  return clientQuote(id, clientId);
};

// a plain link to the Quote's page: it carries no sign-in power (ADR-0006), so
// a signed-out Client signs in (or up) with this email and comes back to it
const sendQuoteEmail = async (client: Client, quote: OfficeQuote) => {
  const [first, second] = quote.options;
  const offer = quote.plan
    ? [
        `Your Service Plan Quote for ${addressOf(quote.property)} is ready: a ${cleanTypeLabel[quote.plan.cleanType]} ${recurrenceLabel[quote.plan.recurrence]}, starting ${formatWhen(new Date(quote.proposedStartsAt!))}.`,
        `${formatMoney(first!.totalCents)} a clean, saving ${formatMoney(quote.plan.savingCents)} on the one-off price of ${formatMoney(quote.plan.oneOffTotalCents)} (Plan Discount ${quote.plan.discountPercent}%).`,
      ]
    : [
        `Your Quote for ${addressOf(quote.property)} is ready, for ${formatWhen(new Date(quote.proposedStartsAt!))}:`,
        `Deep Clean (recommended): ${formatMoney(first!.totalCents)}\nStandard Clean: ${formatMoney(second!.totalCents)}`,
      ];
  const lines = [
    `Hi ${firstNameOf(client.name)},`,
    ...offer,
    `Prices include tax. It's open until ${formatWhen(new Date(quote.expiresAt!))}. To see it in full, sign in with this email address (${client.email}):`,
  ];

  await email.send({
    to: client.email,
    subject: quote.plan
      ? "Your Service Plan Quote from Empire Cleaning"
      : "Your Quote from Empire Cleaning",
    ...compose(lines, {
      href: `${env.CORS_ORIGIN_URL}/portal/quotes/${quote.id}`,
      label: "See your Quote",
    }),
  });
};
