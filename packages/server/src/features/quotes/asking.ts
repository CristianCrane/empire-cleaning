import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type {
  PriceList,
  QuoteAskReceipt,
  Service,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import env from "../../env.ts";
import {
  ConflictError,
  NotFoundError,
  RequestBodyError,
} from "../../middleware/errors.ts";
import { compose, email, firstNameOf } from "../../services/email/index.ts";
import {
  clientForAccount,
  createClient,
  findClientByEmail,
} from "../clients/clients.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { addressKey } from "../properties/address.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { currentServices, onOfferAt } from "../services/services.ts";
import {
  accountSubmission,
  checkForKind,
  clientSubmission,
  guestSubmission,
  officeSubmission,
} from "./asking.validation.ts";
import { openAlongside } from "./quotes.ts";
import { quoteAddOns, quotes } from "./quotes.schema.ts";

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success) throw new RequestBodyError(result.error);
  return result.data;
};

// who the Quote is for (ADR-0006), and whether it may give them a business
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

// the business name an ask for new business premises gives
const businessNameOf = (submission: Submission) =>
  "new" in submission.property && submission.property.new.kind === "commercial"
    ? submission.businessName || null
    : null;

const refuse = (issues: z.core.$ZodIssue[]) => {
  throw new RequestBodyError(new z.ZodError(issues));
};

// only Add-ons on offer now that go with the Service can be chosen
const checkAddOns = (list: PriceList, service: Service, keys: string[]) => {
  if (keys.length === 0) return;
  const offered = new Set(
    list.addOns
      .filter((a) => a.active && a.serviceKeys.includes(service.key))
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

/**
 * A Client (or Guest) asks for a Quote: it starts Requested, holding what
 * they asked, and they're sent a receipt (ADR-0017).
 */
export const askForQuote = async (
  caller: SignedInAccount | null,
  body: unknown,
): Promise<QuoteAskReceipt> => {
  const { client, submission, mayNameBusiness } = await clientFor(caller, body);
  const { property, quote } = await recordAsk(
    client,
    submission,
    null,
    mayNameBusiness,
  );

  // the Quote is saved: a receipt that can't be sent mustn't make it look as
  // though it wasn't
  try {
    await sendReceipt(client, property, quote.id);
  } catch (error) {
    console.error(`receipt for Quote ${quote.id} not sent:`, error);
  }
  // a Guest gave one, and a signed-in Account proved one
  return { id: quote.id, emailedTo: client.email! };
};

/**
 * Office Staff enter a caller's ask (#34): for an existing Client, or a new
 * one, whose email is optional. As for a Guest, a new Client gets no
 * Account, and an email that's already a Client's adds the Quote to that
 * Client without changing their details. No receipt is sent: the Office
 * quotes them straight away, so the caller's routes start its Draft.
 */
export const enterCallerAsk = async (enteredBy: string, body: unknown) => {
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
  const { quote } = await recordAsk(client, submission, enteredBy, true);
  return quote;
};

type Submission = z.infer<typeof clientSubmission>;

// "this home" or "these premises", as the Client or the Office would say it
const thisPlace = (kind: Property["kind"]) =>
  kind === "commercial" ? "these premises" : "this home";

// The Service asked for: one on offer for the kind of Property, or without
// one, the first that is (until the form asks, #122)
const askedService = (
  all: Service[],
  kind: Property["kind"],
  key: string | undefined,
) => {
  const offered = onOfferAt(all, kind);
  const service = key ? offered.find((s) => s.key === key) : offered[0];
  if (!service) {
    refuse([
      {
        code: "custom",
        path: ["serviceKey"],
        message: "Choose from the Services listed",
        input: key,
      },
    ]);
  }
  return service!;
};

// Saves a Requested Quote for the Client, holding what was asked: one
// address is one Property, and a Requested Quote counts as an open one-off
// Quote for its Service and, if that can recur, as an open Service Plan
// Quote, so it can't be asked for while the Property has one of those open
// (ADR-0018). Done under a lock on the Property so two asks at once can't
// both get in. A business that has no business name yet is given the one
// asked with, where `mayNameBusiness`.
const recordAsk = async (
  client: Client,
  submission: Submission,
  enteredBy: string | null,
  mayNameBusiness: boolean,
) => {
  const [list, all] = await Promise.all([
    currentPriceList(),
    currentServices(),
  ]);
  const addOnKeys = [...new Set(submission.addOns ?? [])];
  if ("new" in submission.property) {
    const { new: place } = submission.property;
    checkAddOns(
      list,
      askedService(all, place.kind, submission.serviceKey),
      addOnKeys,
    );
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

    const service = askedService(all, property!.kind, submission.serviceKey);
    if (!isNew) {
      const problems = checkForKind(property!.kind, submission, {
        isNew: false,
      });
      if (problems.length > 0)
        throw new RequestBodyError(new z.ZodError(problems));
      checkAddOns(list, service, addOnKeys);

      // a Quote is open until it's Accepted, Declined, Turned Down or
      // Expired; asking after one Expired starts a new Quote
      const open = await openAlongside(
        tx,
        { id: null, propertyId: property!.id },
        { kind: null, serviceKey: service.key },
        all,
      );
      if (open.length > 0) {
        const place = thisPlace(property!.kind);
        throw new ConflictError(
          enteredBy
            ? `${place[0]!.toUpperCase()}${place.slice(1)} ${property!.kind === "commercial" ? "have" : "has"} a Quote open already: carry on with that one.`
            : open.includes("sent")
              ? `We've sent you a Quote for ${place} already: you'll find it in your account.`
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
    const [quote] = await tx
      .insert(quotes)
      .values({
        propertyId: property!.id,
        // a caller's starts as a Draft once its first Revision is started
        status: "requested",
        origin: enteredBy ? "caller" : "client",
        serviceKey: service.key,
        askedServiceKey: service.key,
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
        area: service.method === "area" ? (submission.area ?? null) : null,
        notes: submission.notes,
        createdBy: enteredBy,
      })
      .returning();
    if (addOnKeys.length > 0) {
      await tx
        .insert(quoteAddOns)
        .values(
          addOnKeys.map((addOnKey) => ({ quoteId: quote!.id, addOnKey })),
        );
    }
    return { property: property!, quote: quote! };
  });
};

// Always to the Client's own address, so an existing Client hears about any
// Quote asked for with their email. Like every Quote email it links to the
// Quote, with no sign-in power (ADR-0006): the same page shows the offer
// once it's Sent.
const sendReceipt = async (
  client: Client,
  property: Property,
  quoteId: string,
) => {
  await email.send({
    to: client.email,
    subject: "We've received your request for a Quote",
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        `Thanks for asking Empire Cleaning for a Quote for ${addressOf(property)}. We'll email your Quote to ${client.email}, usually within a working day.`,
        `If you didn't ask for a Quote, you can ignore this email, or reply and let us know.`,
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/quotes/${quoteId}`,
        label: "See your Quote",
      },
    ),
  });
};
