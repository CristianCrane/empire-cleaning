import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type {
  AddOnChoice,
  CleanType,
  OfficeQuote,
  OfficeQuoteOption,
  PriceList,
  QuoteAddOn,
  QuoteDraftInput,
  QuoteOption,
  QuoteView,
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
import { paymentMethodOf, toPaymentMethodView } from "../payments/payments.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { priceLists } from "../price-list/price-list.schema.ts";
import {
  addOnCents,
  suggestedPrice,
  taxOn,
} from "../price-list/suggested-price.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { addOnsForRequests } from "../quote-requests/add-ons.ts";
import { quoteRequests } from "../quote-requests/quote-requests.schema.ts";
import { bookableFor } from "./quote-room.ts";
import { requestStates, statusOf } from "./quote-state.ts";
import {
  quoteOptions,
  quotes,
  type Quote,
  type QuoteOptionRow,
} from "./quotes.schema.ts";

// Deep Clean first: it's the one Empire Cleaning recommends
const CLEAN_TYPES: CleanType[] = ["deep", "standard"];

const DAY_MS = 86_400_000;

const fieldError = (path: (string | number)[], message: string) =>
  new RequestBodyError(
    new z.ZodError([{ code: "custom", path, message, input: undefined }]),
  );

const requestWithHome = async (quoteRequestId: string) => {
  const [row] = await db
    .select({ request: quoteRequests, client: clients, property: properties })
    .from(quoteRequests)
    .innerJoin(clients, eq(clients.id, quoteRequests.clientId))
    .innerJoin(properties, eq(properties.id, quoteRequests.propertyId))
    .where(eq(quoteRequests.id, quoteRequestId));
  return row;
};

// the Add-ons a Quote can carry: those on offer, and any the request chose
// that have since been retired
const addOnChoices = async (
  list: PriceList,
  quoteRequestId: string,
): Promise<AddOnChoice[]> => {
  const requested = new Set(
    ((await addOnsForRequests([quoteRequestId])).get(quoteRequestId) ?? []).map(
      (a) => a.key,
    ),
  );
  return list.addOns
    .filter((a) => a.active || requested.has(a.key))
    .map(({ key, name }) => ({ key, name }));
};

// both Clean Types priced from the Price List for the home as it is now, with
// any overrides in place of the Suggested Price
const priceOptions = (
  list: PriceList,
  property: Property,
  addOnKeys: string[],
  overrides: QuoteDraftInput["overrides"],
) => {
  const chosen = list.addOns.filter((a) => addOnKeys.includes(a.key));
  return CLEAN_TYPES.map((cleanType) => {
    const suggested = suggestedPrice(
      list,
      property,
      property.condition,
      cleanType,
      chosen,
    );
    const override = overrides[cleanType];
    const priceCents = override?.priceCents ?? suggested.priceCents;
    const taxCents = taxOn(priceCents, suggested);
    return {
      cleanType,
      suggested,
      overrideCents: override?.priceCents ?? null,
      overrideReason: override?.reason ?? null,
      priceCents,
      taxCents,
      totalCents: priceCents + taxCents,
      labourHours: suggested.labourHours,
    };
  });
};

const optionsOf = (quoteId: string) =>
  db.select().from(quoteOptions).where(eq(quoteOptions.quoteId, quoteId));

export const toOption = (quote: Quote, row: QuoteOptionRow): QuoteOption => ({
  cleanType: row.cleanType,
  recommended: row.cleanType === "deep",
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

// a Quote in full, for the Office
export const officeQuote = async (id: string): Promise<OfficeQuote> => {
  const quote = await findQuote(id);
  const [row, rows, list, [priced]] = await Promise.all([
    requestWithHome(quote.quoteRequestId),
    optionsOf(id),
    currentPriceList(),
    db
      .select({ version: priceLists.version })
      .from(priceLists)
      .where(eq(priceLists.id, quote.priceListId)),
  ]);
  const { client, property } = row!;
  const paymentMethod = await paymentMethodOf(client.id);

  return {
    id: quote.id,
    quoteRequestId: quote.quoteRequestId,
    status: statusOf(quote),
    client: { id: client.id, name: client.name, email: client.email },
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
    },
    options: sortOptions(rows).map((r): OfficeQuoteOption => ({
      ...toOption(quote, r),
      suggested: r.suggested,
      overrideCents: r.overrideCents,
      overrideReason: r.overrideReason,
    })),
    addOns: addOnsOf(rows),
    addOnChoices: await addOnChoices(list, quote.quoteRequestId),
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
    .innerJoin(quoteRequests, eq(quoteRequests.id, quotes.quoteRequestId))
    .innerJoin(properties, eq(properties.id, quoteRequests.propertyId))
    .where(and(eq(quotes.id, id), eq(quoteRequests.clientId, clientId)));
  if (!found || found.quote.status === "draft") {
    throw new NotFoundError("Quote not found");
  }
  const { quote, property } = found;
  const rows = await optionsOf(id);

  return {
    id: quote.id,
    quoteRequestId: quote.quoteRequestId,
    status: statusOf(quote),
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
    },
    options: sortOptions(rows).map((r) => toOption(quote, r)),
    addOns: addOnsOf(rows),
    crewSize: quote.crewSize,
    depositPercent: quote.depositPercent,
    proposedStartsAt: quote.proposedStartsAt!.toISOString(),
    sentAt: quote.sentAt!.toISOString(),
    expiresAt: quote.expiresAt!.toISOString(),
    declinedAt: iso(quote.declinedAt),
    acceptedAt: iso(quote.acceptedAt),
    acceptedCleanType: quote.acceptedCleanType,
    bookable: await bookableOf(quote),
  };
};

// Starts a Draft for a request, pre-filled from the Suggested Price, the Add-ons
// the Client chose and the Price List's defaults; a request has at most one
// Draft, so if it has one already that's the one returned
export const startDraft = async (
  quoteRequestId: string,
  accountId: string,
): Promise<{ quote: OfficeQuote; started: boolean }> => {
  const row = await requestWithHome(quoteRequestId);
  if (!row) throw new NotFoundError("Quote Request not found");

  const [existing] = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(
      and(
        eq(quotes.quoteRequestId, quoteRequestId),
        eq(quotes.status, "draft"),
      ),
    );
  if (existing)
    return { quote: await officeQuote(existing.id), started: false };
  await refuseClosed(quoteRequestId);

  const [list, requested] = await Promise.all([
    currentPriceList(),
    addOnsForRequests([quoteRequestId]),
  ]);
  const addOnKeys = (requested.get(quoteRequestId) ?? []).map((a) => a.key);
  const options = priceOptions(list, row.property, addOnKeys, {
    deep: null,
    standard: null,
  });

  const id = await db.transaction(async (tx) => {
    const [quote] = await tx
      .insert(quotes)
      .values({
        quoteRequestId,
        priceListId: list.id,
        crewSize: list.defaultCrewSize,
        depositPercent: list.depositPercent,
        validityDays: list.quoteValidityDays,
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

// a request whose Quote the Client Accepted or Declined is closed: they ask
// again if they want something more
const refuseClosed = async (quoteRequestId: string) => {
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
};

// holds a request until the transaction ends, so sending a Quote for it and
// accepting one take turns
export const lockRequest = async (tx: Tx, quoteRequestId: string) => {
  await tx
    .select({ id: quoteRequests.id })
    .from(quoteRequests)
    .where(eq(quoteRequests.id, quoteRequestId))
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
  const [row, list] = await Promise.all([
    requestWithHome(quote.quoteRequestId),
    currentPriceList(),
  ]);

  const allowed = new Set(
    (await addOnChoices(list, quote.quoteRequestId)).map((a) => a.key),
  );
  const unknown = input.addOns.findIndex((key) => !allowed.has(key));
  if (unknown !== -1) {
    throw fieldError(["addOns", unknown], "Choose from the Add-ons listed");
  }

  const addOnKeys = [...new Set(input.addOns)];
  const options = priceOptions(list, row!.property, addOnKeys, input.overrides);
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
// Supersedes the request's open Quote, if any, in the same step, so a request
// never has two open.
export const sendQuote = async (id: string): Promise<OfficeQuote> => {
  const quote = await findDraft(id);
  const now = clock.now();
  if (!quote.proposedStartsAt) {
    throw fieldError(["proposedStart"], "Choose a proposed time");
  }
  if (quote.proposedStartsAt <= now) {
    throw fieldError(["proposedStart"], "Choose a time that's still to come");
  }
  await refuseClosed(quote.quoteRequestId);

  const expiresAt = new Date(
    Math.min(
      now.getTime() + quote.validityDays * DAY_MS,
      quote.proposedStartsAt.getTime(),
    ),
  );

  await db.transaction(async (tx) => {
    // one send (or acceptance) at a time per request
    await lockRequest(tx, quote.quoteRequestId);
    // its open Quote may have been Accepted while this waited
    await refuseClosed(quote.quoteRequestId);
    const [open] = await tx
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.quoteRequestId, quote.quoteRequestId),
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
  const row = await requestWithHome(quote.quoteRequestId);
  // the Quote is sent: an email that can't go mustn't make it look as though
  // it wasn't
  try {
    await sendQuoteEmail(row!.client, view);
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
  const [deep, standard] = quote.options;
  const lines = [
    `Hi ${firstNameOf(client.name)},`,
    `Your Quote for ${addressOf(quote.property)} is ready, for ${formatWhen(new Date(quote.proposedStartsAt!))}:`,
    `Deep Clean (recommended): ${formatMoney(deep!.totalCents)}\nStandard Clean: ${formatMoney(standard!.totalCents)}`,
    `Prices include tax. It's open until ${formatWhen(new Date(quote.expiresAt!))}. To see it in full, sign in with this email address (${client.email}):`,
  ];

  await email.send({
    to: client.email,
    subject: "Your Quote from Empire Cleaning",
    ...compose(lines, {
      href: `${env.CORS_ORIGIN_URL}/portal/quotes/${quote.id}`,
      label: "See your Quote",
    }),
  });
};
