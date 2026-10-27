import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type {
  OpenQuoteRequest,
  PriceList,
  QuoteRequestDetail,
  QuoteRequestReceipt,
  SignedInAccount,
  Weekday,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import {
  ConflictError,
  NotFoundError,
  RequestBodyError,
} from "../../middleware/errors.ts";
import { email } from "../../services/email/index.ts";
import {
  clientForAccount,
  createClient,
  findClientByEmail,
} from "../clients/clients.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { addressKey } from "../properties/address.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf, toPropertyView } from "../properties/property-view.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { pricedOf, suggestedPrice } from "../price-list/suggested-price.ts";
import {
  firstCleanCompleted,
  isClosed,
  quotesForRequest,
  requestStates,
} from "../quotes/quote-state.ts";
import { servicePlans } from "../service-plans/service-plans.schema.ts";
import { siteVisits } from "../site-visits/site-visits.schema.ts";
import {
  findingsRecorded,
  siteVisitStages,
} from "../site-visits/site-visits.ts";
import { siteVisitViews } from "../site-visits/views.ts";
import { addOnsForRequests } from "./add-ons.ts";
import { siteVisitOf } from "./request-views.ts";
import { quoteRequestAddOns, quoteRequests } from "./quote-requests.schema.ts";
import {
  accountSubmission,
  checkForKind,
  clientSubmission,
  guestSubmission,
  officeSubmission,
} from "./quote-requests.validation.ts";

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success) throw new RequestBodyError(result.error);
  return result.data;
};

// who the request is for (ADR-0006), and whether it may give them a business
// name they lack:
// - a Guest: the Client with their email, whose details a Guest never
//   changes, or a new Client (no Account)
// - a signed-in Client: themselves
// - a signed-in Account connected to no Client: a new Client with the
//   Account's proven email, connected straight away
const clientFor = async (caller: SignedInAccount | null, body: unknown) => {
  if (!caller) {
    const submission = parse(guestSubmission, body);
    const existing = await findClientByEmail(submission.contact.email);
    const client =
      existing ??
      (await createClient({
        ...submission.contact,
        businessName: businessNameOf(submission),
      }));
    return { client, submission, mayNameBusiness: false };
  }

  const own = await clientForAccount(caller.id);
  if (own) {
    return {
      client: own,
      submission: parse(clientSubmission, body),
      mayNameBusiness: true,
    };
  }

  const submission = parse(accountSubmission, body);
  const client =
    (await findClientByEmail(caller.email)) ??
    (await createClient({
      ...submission.contact,
      email: caller.email,
      businessName: businessNameOf(submission),
    }));
  return { client, submission, mayNameBusiness: true };
};

// the business name a request for new business premises gives
const businessNameOf = (submission: Submission) =>
  "new" in submission.property && submission.property.new.kind === "commercial"
    ? submission.businessName || null
    : null;

const refuse = (issues: z.core.$ZodIssue[]) => {
  throw new RequestBodyError(new z.ZodError(issues));
};

// only Add-ons on offer for homes now can be chosen
const checkAddOns = async (list: PriceList, keys: string[]) => {
  if (keys.length === 0) return;
  const offered = new Set(
    list.addOns
      .filter((a) => a.active && a.offeredFor !== "businesses")
      .map((a) => a.key),
  );
  const unknown = keys.findIndex((key) => !offered.has(key));
  if (unknown !== -1) {
    throw new RequestBodyError(
      new z.ZodError([
        {
          code: "custom",
          path: ["addOns", unknown],
          message: "Choose from the Add-ons listed",
          input: keys[unknown],
        },
      ]),
    );
  }
};

// only Premises Types on offer now can be chosen for new premises
const checkPremisesType = (list: PriceList, key: string) => {
  if (!list.premisesTypes.some((t) => t.active && t.key === key)) {
    refuse([
      {
        code: "custom",
        path: ["property", "new", "premisesType"],
        message: "Choose from the types of premises listed",
        input: key,
      },
    ]);
  }
};

export const submitQuoteRequest = async (
  caller: SignedInAccount | null,
  body: unknown,
): Promise<QuoteRequestReceipt> => {
  const { client, submission, mayNameBusiness } = await clientFor(caller, body);
  const { property, request } = await recordRequest(
    client,
    submission,
    null,
    mayNameBusiness,
  );

  // the request is saved: a receipt that can't be sent mustn't make it look
  // as though it wasn't
  try {
    await sendReceipt(client, property);
  } catch (error) {
    console.error(`receipt for Quote Request ${request.id} not sent:`, error);
  }
  // a Guest gave one, and a signed-in Account proved one
  return { id: request.id, emailedTo: client.email! };
};

/**
 * Office Staff enter a caller's Quote Request (#34): for an existing Client,
 * or a new one, whose email is optional. As for a Guest, a new Client gets no
 * Account, and an email that's already a Client's adds the request to that
 * Client without changing their details. No receipt is sent: the Office
 * quotes them straight away.
 */
export const enterQuoteRequest = async (enteredBy: string, body: unknown) => {
  const submission = parse(officeSubmission, body);
  let client: Client | undefined;
  if (submission.clientId) {
    [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, submission.clientId));
    if (!client) throw new NotFoundError("Client not found");
  } else {
    const contact = submission.contact!;
    client =
      (contact.email ? await findClientByEmail(contact.email) : undefined) ??
      (await createClient({
        ...contact,
        email: contact.email ?? null,
        businessName: businessNameOf(submission),
      }));
  }
  const { request } = await recordRequest(client, submission, enteredBy, true);
  return request;
};

type Submission = z.infer<typeof clientSubmission>;

// "this home" or "these premises", as the Client or the Office would say it
const thisPlace = (kind: Property["kind"]) =>
  kind === "commercial" ? "these premises" : "this home";

// Saves a request for the Client: one address is one Property, and a
// Property has one request waiting at a time. Done under a lock on the
// Property so two requests at once can't both get in. A business that has no
// business name yet is given the one asked with, where `mayNameBusiness`.
const recordRequest = async (
  client: Client,
  submission: Submission,
  enteredBy: string | null,
  mayNameBusiness: boolean,
) => {
  const list = await currentPriceList();
  const addOnKeys = [...new Set(submission.addOns ?? [])];
  await checkAddOns(list, addOnKeys);
  if ("new" in submission.property) {
    const { new: place } = submission.property;
    if (place.kind === "commercial")
      checkPremisesType(list, place.premisesType);
  }

  return db.transaction(async (tx) => {
    let property: Property | undefined;
    let isNew = false;

    if ("existing" in submission.property) {
      [property] = await tx
        .select()
        .from(properties)
        .where(
          and(
            eq(properties.id, submission.property.existing),
            eq(properties.clientId, client.id),
          ),
        )
        .for("update");
      if (!property) throw new NotFoundError("Property not found");
    } else {
      const place = submission.property.new;
      const { premisesType, ...details } =
        place.kind === "commercial" ? place : { ...place, premisesType: null };
      [property] = await tx
        .insert(properties)
        .values({
          ...details,
          premisesTypeKey: premisesType,
          addressKey: addressKey(place),
          clientId: client.id,
          // business premises' is found on a Site Visit
          condition: place.kind === "residential" ? submission.condition : null,
        })
        .onConflictDoNothing({
          target: [properties.clientId, properties.addressKey],
        })
        .returning();
      isNew = property !== undefined;
      // the Client already has this address, however it was typed: it's the
      // same Property, with the details it was first given
      property ??= (
        await tx
          .select()
          .from(properties)
          .where(
            and(
              eq(properties.clientId, client.id),
              eq(properties.addressKey, addressKey(place)),
            ),
          )
          .for("update")
      )[0];
      if (property!.kind !== place.kind) {
        throw new ConflictError(
          `${addressOf(property!)} is already ${enteredBy ? "their" : "your"} ${property!.kind === "commercial" ? "business premises" : "home"}: choose it from the list to ask about it.`,
        );
      }
    }

    if (!isNew) {
      const problems = checkForKind(property!.kind, submission, {
        isNew: false,
      });
      if (problems.length > 0)
        throw new RequestBodyError(new z.ZodError(problems));

      // a request is waiting until it closes: its Quote Accepted or Declined
      // (and, with #6, Turned Down)
      const asked = await tx
        .select({ id: quoteRequests.id })
        .from(quoteRequests)
        .where(eq(quoteRequests.propertyId, property!.id));
      const states = await requestStates(asked.map((r) => r.id));
      if ([...states.values()].some((state) => !isClosed(state))) {
        const place = thisPlace(property!.kind);
        throw new ConflictError(
          enteredBy
            ? `${place[0]!.toUpperCase()}${place.slice(1)} ${property!.kind === "commercial" ? "have" : "has"} a Quote Request waiting already: answer that one from Requests.`
            : `You've already asked us for a Quote for ${place}. We'll email it to ${client.email} soon.`,
        );
      }

      // a home's Condition stated now is the latest known; the other details
      // stay as first given, because only the Office changes those
      if (property!.kind === "residential") {
        [property] = await tx
          .update(properties)
          .set({ condition: submission.condition })
          .where(eq(properties.id, property!.id))
          .returning();
      }
    }

    if (
      property!.kind === "commercial" &&
      submission.businessName &&
      !client.businessName &&
      mayNameBusiness
    ) {
      await tx
        .update(clients)
        .set({ businessName: submission.businessName })
        .where(eq(clients.id, client.id));
    }

    const regular = submission.wantsRegularService;
    const [request] = await tx
      .insert(quoteRequests)
      .values({
        clientId: client.id,
        propertyId: property!.id,
        condition:
          property!.kind === "residential" ? submission.condition : null,
        wantsRegularService: regular,
        // a business's days and time, for regular cleaning
        weekdays:
          property!.kind === "commercial" && regular
            ? [...new Set(submission.weekdays)].sort((a, b) => a - b)
            : [],
        preferredTime:
          property!.kind === "commercial" && regular
            ? submission.preferredTime
            : null,
        notes: submission.notes,
        enteredBy,
      })
      .returning();
    if (addOnKeys.length > 0) {
      await tx.insert(quoteRequestAddOns).values(
        addOnKeys.map((addOnKey) => ({
          quoteRequestId: request!.id,
          addOnKey,
        })),
      );
    }
    return { property: property!, request: request! };
  });
};

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// always to the Client's own address, so an existing Client hears about any
// request made with their email; it carries no sign-in power (ADR-0006)
const sendReceipt = async (client: Client, property: Property) => {
  const [firstName] = client.name.split(" ");
  const address = addressOf(property);
  const lines = [
    `Hi ${firstName},`,
    `Thanks for asking Empire Cleaning for a Quote for ${address}. We'll email your Quote to ${client.email}, usually within a working day.`,
    `If you didn't ask for a Quote, you can ignore this email, or reply and let us know.`,
  ];

  await email.send({
    to: client.email,
    subject: "We've received your Quote Request",
    text: lines.join("\n\n"),
    html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(""),
  });
};

// its home's Service Plan, unless it has none or it has Ended
const currentPlanOfRequest = and(
  eq(servicePlans.propertyId, quoteRequests.propertyId),
  ne(servicePlans.status, "ended"),
);

// the Quote Requests that haven't closed, for the Office, newest first
export const openQuoteRequests = async (): Promise<OpenQuoteRequest[]> => {
  const rows = await db
    .select({
      request: quoteRequests,
      client: {
        id: clients.id,
        name: clients.name,
        businessName: clients.businessName,
      },
      servicePlanId: servicePlans.id,
      property: properties,
    })
    .from(quoteRequests)
    .innerJoin(clients, eq(clients.id, quoteRequests.clientId))
    .innerJoin(properties, eq(properties.id, quoteRequests.propertyId))
    .leftJoin(servicePlans, currentPlanOfRequest)
    .orderBy(desc(quoteRequests.createdAt));

  const ids = rows.map((r) => r.request.id);
  const [addOns, states, list, stages] = await Promise.all([
    addOnsForRequests(ids),
    requestStates(ids),
    currentPriceList(),
    siteVisitStages(rows.map((r) => r.request.propertyId)),
  ]);
  return rows
    .filter(({ request }) => !isClosed(states.get(request.id)!))
    .map(({ request, client, property, servicePlanId }) => ({
      id: request.id,
      propertyId: request.propertyId,
      condition: request.condition,
      wantsRegularService: request.wantsRegularService,
      weekdays: request.weekdays as Weekday[],
      preferredTime: request.preferredTime,
      notes: request.notes,
      addOns: addOns.get(request.id) ?? [],
      createdAt: request.createdAt.toISOString(),
      state: states.get(request.id)!,
      siteVisit: siteVisitOf(
        states.get(request.id)!,
        stages.get(request.propertyId),
      ),
      client,
      property: toPropertyView(property, list),
      servicePlanId,
    }));
};

// the requests waiting for the Office to send a Quote, longest waiting first:
// none sent yet, or the last one Expired
export const quoteRequestsAwaitingQuote = async (): Promise<
  OpenQuoteRequest[]
> =>
  (await openQuoteRequests())
    .filter((request) => request.state === "awaiting_quote")
    .reverse();

// one request in full for the Office, with the Suggested Price for both Clean
// Types worked out now from the current Price List, using the home's current
// details and Condition (which Staff may have corrected). Freezing it into a
// Quote is #5.
export const quoteRequestDetail = async (
  id: string,
): Promise<QuoteRequestDetail | undefined> => {
  const [row] = await db
    .select({
      request: quoteRequests,
      client: clients,
      property: properties,
      servicePlanId: servicePlans.id,
    })
    .from(quoteRequests)
    .innerJoin(clients, eq(clients.id, quoteRequests.clientId))
    .innerJoin(properties, eq(properties.id, quoteRequests.propertyId))
    .leftJoin(servicePlans, currentPlanOfRequest)
    .where(eq(quoteRequests.id, id));
  if (!row) return undefined;

  const propertyId = row.property.id;
  const [list, addOns, states, quotes, firstCleanDone, stages, visits, done] =
    await Promise.all([
      currentPriceList(),
      addOnsForRequests([id]),
      requestStates([id]),
      quotesForRequest(id),
      firstCleanCompleted(propertyId),
      siteVisitStages([propertyId]),
      siteVisitViews(
        and(
          eq(siteVisits.propertyId, propertyId),
          eq(siteVisits.status, "booked"),
        ),
      ),
      findingsRecorded([propertyId]),
    ]);
  const choices = addOns.get(id) ?? [];
  const chosen = list.addOns.filter((a) =>
    choices.some((c) => c.key === a.key),
  );
  const price = (cleanType: "standard" | "deep") =>
    suggestedPrice(
      list,
      pricedOf(row.property),
      row.property.condition,
      cleanType,
      chosen,
    );

  return {
    id: row.request.id,
    createdAt: row.request.createdAt.toISOString(),
    statedCondition: row.request.condition,
    wantsRegularService: row.request.wantsRegularService,
    weekdays: row.request.weekdays as Weekday[],
    preferredTime: row.request.preferredTime,
    notes: row.request.notes,
    addOns: choices,
    client: {
      id: row.client.id,
      name: row.client.name,
      businessName: row.client.businessName,
      email: row.client.email,
      phone: row.client.phone,
    },
    property: toPropertyView(row.property, list),
    suggested: {
      priceListVersion: list.version,
      standard: price("standard"),
      deep: price("deep"),
    },
    state: states.get(id)!,
    quotes,
    firstCleanCompleted: firstCleanDone,
    servicePlanId: row.servicePlanId,
    siteVisit: siteVisitOf(states.get(id)!, stages.get(propertyId)),
    bookedSiteVisit: visits[0] ?? null,
    findingsRecorded: done.has(propertyId),
  };
};
