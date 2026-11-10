import { currentLanguage } from "#services/request";
import { messages } from "@empire-cleaning/models";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type {
  HomeRooms,
  PriceList,
  QuoteAskReceipt,
  QuoteSource,
  Service,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import {
  ConflictError,
  fieldError,
  NotFoundError,
  RequestBodyError,
  TooManyRequestsError,
} from "../../middleware/errors.ts";
import { email } from "../../services/email/index.ts";
import { rateLimit, tooManyTries } from "../../services/rate-limit/index.ts";
import {
  clientForAccount,
  createClient,
  findClientByEmail,
} from "../clients/clients.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { addressKey } from "../properties/address.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import {
  currentPriceList,
  notAPremisesType,
  notAnAddOn,
  offeredWith,
  offersPremisesType,
} from "../price-list/price-list.ts";
import {
  currentServices,
  notAService,
  onOfferAt,
} from "../services/services.ts";
import {
  accountSubmission,
  checkCondition,
  checkForKind,
  checkRooms,
  clientSubmission,
  guestSubmission,
  officeSubmission,
} from "./asking.validation.ts";
import { tellOfficeStaff } from "../staff/staff.ts";
import {
  askClash,
  askClashEmail,
  quoteReceivedEmail,
  quoteRequestedEmail,
} from "./emails.ts";
import { openAlongside, openAlreadyAt } from "./quotes.ts";
import { quoteAddOns, quotes, type Quote } from "./quotes.schema.ts";
import { monitoring } from "../../services/monitoring/index.ts";

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success) throw new RequestBodyError(result.error);
  return result.data;
};

// who the Quote is for (ADR-0006), whether it's `trusted` to fill in or
// restate their details, and where a Guest asked from:
// - a Guest: the Client with their email, whose details, and Properties',
//   a Guest never changes (#243), or a new Client (no Account)
// - a signed-in Client: themselves
// - a signed-in Account connected to no Client: a new Client with the
//   Account's proven email, connected straight away
const clientFor = async (caller: SignedInAccount | null, body: unknown) => {
  if (!caller) {
    const submission = parse(guestSubmission, body);
    // a Guest's receipt goes to whatever address was typed, so one address
    // gets only so many (#32)
    const verdict = rateLimit.attempt(
      "guestQuoteRequest",
      submission.contact.email,
    );
    if (!verdict.allowed) {
      throw new TooManyRequestsError(
        tooManyTries(currentLanguage(), verdict.retryAfterSeconds),
        verdict.retryAfterSeconds,
      );
    }
    const existing = await findClientByEmail(submission.contact.email);
    const client =
      existing ??
      (await createClient({
        ...submission.contact,
        businessName: businessNameOf(submission),
        // the language of the page they asked on (ADR-0025)
        preferredLanguage: currentLanguage(),
      }));
    return {
      client,
      submission,
      trusted: false,
      source: submission.source ?? null,
    };
  }

  const own = await clientForAccount(caller.id);
  if (own) {
    return {
      client: own,
      submission: parse(clientSubmission, body),
      trusted: true,
      source: null,
    };
  }

  const submission = parse(accountSubmission, body);
  const client =
    (await findClientByEmail(caller.email)) ??
    (await createClient({
      ...submission.contact,
      email: caller.email,
      businessName: businessNameOf(submission),
      preferredLanguage: currentLanguage(),
    }));
  return { client, submission, trusted: true, source: null };
};

// the business name an ask for new business premises gives
const businessNameOf = (submission: Submission) =>
  "new" in submission.property && submission.property.new.kind === "commercial"
    ? submission.businessName || null
    : null;

// only Add-ons on offer now that go with the Service can be chosen
const checkAddOns = (list: PriceList, service: Service, keys: string[]) => {
  if (keys.length === 0) return;
  const offered = new Set(
    list.addOns.filter((a) => offeredWith(a, service.key)).map((a) => a.key),
  );
  const unknown = keys.findIndex((key) => !offered.has(key));
  if (unknown !== -1) {
    throw fieldError(
      ["addOns", unknown],
      notAnAddOn[currentLanguage()],
      keys[unknown],
    );
  }
};

// only Premises Types on offer now can be chosen for new premises
const checkPremisesType = (list: PriceList, key: string) => {
  if (!offersPremisesType(list, key)) {
    throw fieldError(
      ["property", "new", "premisesType"],
      notAPremisesType[currentLanguage()],
      key,
    );
  }
};

// The Guest form's field people never see (#32): filled, a bot filled it. It
// is told it worked, so it doesn't try another way, and nothing is saved or
// sent
const filledHoneypot = (body: unknown) =>
  z.looseObject({ website: z.string().trim().nonempty() }).safeParse(body)
    .success;

const pretendReceipt = (body: unknown): QuoteAskReceipt => ({
  id: crypto.randomUUID(),
  emailedTo:
    z
      .looseObject({ contact: z.looseObject({ email: z.string() }) })
      .safeParse(body).data?.contact.email ?? "",
});

/**
 * A Client (or Guest) asks for a Quote: it starts Requested, holding what
 * they asked, and they're sent a receipt (ADR-0017). Office Staff are
 * emailed, so they hear of it wherever they are.
 */
export const askForQuote = async (
  caller: SignedInAccount | null,
  body: unknown,
): Promise<QuoteAskReceipt> => {
  if (!caller && filledHoneypot(body)) return pretendReceipt(body);
  const { client, submission, trusted, source } = await clientFor(caller, body);
  const recorded = await recordAsk(client, submission, null, trusted, source);
  if ("clash" in recorded) {
    if (caller) {
      throw new ConflictError(clashMessage(recorded.clash, client, null));
    }
    // a Guest is told what anyone would be, so the reply can't show what a
    // Client has at an address; the Client hears why, at their own (#243)
    try {
      await tellOfClash(client, recorded.clash);
    } catch (error) {
      monitoring.error(error, {
        what: `clash not told to Client ${client.id}`,
      });
    }
    return { id: crypto.randomUUID(), emailedTo: client.email! };
  }
  const { property, quote, serviceName } = recorded;

  // the Quote is saved: a receipt that can't be sent mustn't make it look as
  // though it wasn't
  try {
    await sendReceipt(client, property, quote.id);
  } catch (error) {
    monitoring.error(error, { what: `receipt for Quote ${quote.id} not sent` });
  }
  await tellOffice(client, property, quote, serviceName);
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
  const recorded = await recordAsk(client, submission, enteredBy, true);
  if ("clash" in recorded) {
    throw new ConflictError(clashMessage(recorded.clash, client, enteredBy));
  }
  return recorded.quote;
};

type Submission = z.infer<typeof clientSubmission>;

// Why an ask can't go ahead at a Property the Client already has: it's the
// other kind of Property, or a Quote that holds the Service is open there,
// `asked` for or already `sent`
type Clash = { property: Property; why: "otherKind" | "asked" | "sent" };

// a clash, as the reply tells it to the signed-in Client, in the language
// of their screen, or to Office Staff entering a caller's ask (`enteredBy`),
// in English
const clashMessage = (
  { property, why }: Clash,
  client: Client,
  enteredBy: string | null,
) => {
  const lang = enteredBy ? "en" : currentLanguage();
  const { alreadyAsked, alreadyYours, PICK_IT } = askClash[lang];
  if (why === "otherKind") {
    return `${alreadyYours(addressOf(property), property.kind, enteredBy ? "their" : "your")} ${PICK_IT}`;
  }
  if (enteredBy) {
    return openAlreadyAt(property, "a quote");
  }
  return alreadyAsked(
    why,
    messages[lang].thisPlace(property.kind),
    client.email,
  );
};

// The Service asked for, which must be on offer for the kind of Property
const askedService = (all: Service[], kind: Property["kind"], key: string) => {
  const service = onOfferAt(all, kind).find((s) => s.key === key);
  if (!service) {
    throw fieldError(["serviceKey"], notAService[currentLanguage()], key);
  }
  return service;
};

// the rooms an ask gives a home, and where they are in it: a new home's
// with its details, or for one of the Client's, beside it
const roomsGiven = (submission: Submission) =>
  "new" in submission.property
    ? {
        given:
          submission.property.new.kind === "residential"
            ? submission.property.new
            : undefined,
        at: ["property", "new"],
      }
    : { given: submission.property.rooms, at: ["property", "rooms"] };

// all four of a home's rooms, if they were given (checkRooms has seen to
// all or none)
const roomsOf = (given: Partial<HomeRooms> | undefined): HomeRooms | null =>
  given?.bedrooms != null
    ? {
        bedrooms: given.bedrooms,
        bathrooms: given.bathrooms!,
        storeys: given.storeys!,
        pets: given.pets!,
      }
    : null;

// A home's Condition as stated in the ask, where the Service asked for uses
// one. Business premises' is found on a Site Visit, and a home asked about
// for a Service Condition doesn't apply to has none yet.
const conditionOf = (
  kind: Property["kind"],
  service: Service,
  submission: Submission,
) =>
  kind === "residential" && service.conditionApplies
    ? (submission.condition ?? null)
    : null;

// Saves a Requested Quote for the Client, holding what was asked: one
// address is one Property, and a Requested Quote counts as an open one-off
// Quote for its Service and, if that can recur, as an open Service Plan
// Quote, so it can't be asked for while the Property has one of those open
// (ADR-0018); that, or an address that's the other kind of Property, is the
// clash returned instead. Done under a lock on the Property so two asks at
// once can't both get in. Only a `trusted` ask, from the signed-in Client or
// the Office, changes what the Client has: it names a business that has no
// name yet, restates a home's Condition and gives a home without them its
// rooms; a Guest's leaves them on the Quote (#243). A Guest's says where on
// the landing site they asked from (`source`).
const recordAsk = async (
  client: Client,
  submission: Submission,
  enteredBy: string | null,
  trusted: boolean,
  source: QuoteSource | null = null,
): Promise<
  { property: Property; quote: Quote; serviceName: string } | { clash: Clash }
> => {
  const [list, all] = await Promise.all([
    currentPriceList(),
    currentServices(),
  ]);
  const addOnKeys = [...new Set(submission.addOns ?? [])];
  if ("new" in submission.property) {
    const { new: place } = submission.property;
    const service = askedService(all, place.kind, submission.serviceKey);
    const problems = [
      ...checkCondition(place.kind, service.conditionApplies, submission),
      ...(place.kind === "residential"
        ? checkRooms(place, {
            needed: service.method === "rooms",
            at: ["property", "new"],
          })
        : []),
    ];
    if (problems.length > 0)
      throw new RequestBodyError(new z.ZodError(problems));
    checkAddOns(list, service, addOnKeys);
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
          condition: conditionOf(
            place.kind,
            askedService(all, place.kind, submission.serviceKey),
            submission,
          ),
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
        return { clash: { property: property!, why: "otherKind" } };
      }
    }

    const service = askedService(all, property!.kind, submission.serviceKey);
    const condition = conditionOf(property!.kind, service, submission);
    const { given, at } = roomsGiven(submission);
    if (!isNew) {
      // a home without its rooms gives them now, if it's asked about for a
      // Service priced from them
      const lacksRooms =
        property!.kind === "residential" && property!.bedrooms === null;
      const problems = [
        ...checkForKind(property!.kind, submission, { isNew: false }),
        ...checkCondition(property!.kind, service.conditionApplies, submission),
        ...(lacksRooms
          ? checkRooms(given, { needed: service.method === "rooms", at })
          : []),
      ];
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
        return {
          clash: {
            property: property!,
            why: open.includes("sent") ? "sent" : "asked",
          },
        };
      }

      // a home's Condition stated now is the latest known; its other details
      // stay as first given, because only the Office changes those, except
      // rooms it never had. A Guest could be anyone, so theirs stay on the
      // Quote
      const rooms = lacksRooms ? roomsOf(given) : null;
      if (trusted && (condition || rooms)) {
        [property] = await tx
          .update(properties)
          .set({ ...(condition && { condition }), ...rooms })
          .where(eq(properties.id, property!.id))
          .returning();
      }
    }

    if (
      property!.kind === "commercial" &&
      submission.businessName &&
      !client.businessName &&
      trusted
    ) {
      await tx
        .update(clients)
        .set({ businessName: submission.businessName })
        .where(eq(clients.id, client.id));
    }

    // only a Service that can recur can lead to regular visits
    const regular = submission.wantsRegularService && service.canRecur;
    const [quote] = await tx
      .insert(quotes)
      .values({
        propertyId: property!.id,
        // a caller's starts as a Draft once its first Revision is started
        status: "requested",
        origin: enteredBy ? "caller" : "client",
        serviceKey: service.key,
        askedServiceKey: service.key,
        condition,
        rooms: property!.kind === "residential" ? roomsOf(given) : null,
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
        sourcePage: source?.page ?? null,
        utmSource: source?.utmSource ?? null,
        utmMedium: source?.utmMedium ?? null,
        utmCampaign: source?.utmCampaign ?? null,
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
    return { property: property!, quote: quote!, serviceName: service.name };
  });
};

const tellOffice = async (
  client: Client,
  property: Property,
  quote: Quote,
  serviceName: string,
) =>
  tellOfficeStaff(`Quote ${quote.id} to the Office`, async () =>
    quoteRequestedEmail({
      client: client.name,
      businessName: client.businessName,
      serviceName,
      regular: quote.wantsRegularService,
      address: addressOf(property),
      quoteId: quote.id,
    }),
  );

const tellOfClash = async (client: Client, { property, why }: Clash) => {
  if (!client.email) return;
  await email.send({
    to: client.email,
    ...askClashEmail(client.preferredLanguage, {
      name: client.name,
      email: client.email,
      address: addressOf(property),
      kind: property.kind,
      why,
    }),
  });
};

const sendReceipt = async (
  client: Client,
  property: Property,
  quoteId: string,
) => {
  if (!client.email) return;
  await email.send({
    to: client.email,
    ...quoteReceivedEmail(client.preferredLanguage, {
      name: client.name,
      email: client.email,
      address: addressOf(property),
      quoteId,
    }),
  });
};
