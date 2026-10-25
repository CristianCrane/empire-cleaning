import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import type {
  OpenQuoteRequest,
  QuoteRequestReceipt,
  SignedInAccount,
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
import { quoteRequests } from "./quote-requests.schema.ts";
import {
  accountSubmission,
  clientSubmission,
  guestSubmission,
} from "./quote-requests.validation.ts";

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success) throw new RequestBodyError(result.error);
  return result.data;
};

// who the request is for (ADR-0006):
// - a Guest: the Client with their email, or a new Client (no Account)
// - a signed-in Client: themselves
// - a signed-in Account connected to no Client: a new Client with the
//   Account's proven email, connected straight away
const clientFor = async (caller: SignedInAccount | null, body: unknown) => {
  if (!caller) {
    const submission = parse(guestSubmission, body);
    // an existing Client's details are never changed by a Guest
    const client =
      (await findClientByEmail(submission.contact.email)) ??
      (await createClient(submission.contact));
    return { client, submission };
  }

  const own = await clientForAccount(caller.id);
  if (own) return { client: own, submission: parse(clientSubmission, body) };

  const submission = parse(accountSubmission, body);
  const client =
    (await findClientByEmail(caller.email)) ??
    (await createClient({ ...submission.contact, email: caller.email }));
  return { client, submission };
};

export const submitQuoteRequest = async (
  caller: SignedInAccount | null,
  body: unknown,
): Promise<QuoteRequestReceipt> => {
  const { client, submission } = await clientFor(caller, body);

  // one address is one home, and a home has one request waiting at a time.
  // Done under a lock on the home so two requests at once can't both get in.
  const { property, request } = await db.transaction(async (tx) => {
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
      const address = submission.property.new;
      [property] = await tx
        .insert(properties)
        .values({
          ...address,
          addressKey: addressKey(address),
          clientId: client.id,
          condition: submission.condition,
        })
        .onConflictDoNothing({
          target: [properties.clientId, properties.addressKey],
        })
        .returning();
      isNew = property !== undefined;
      // the Client already has this address, however it was typed: it's the
      // same home, with the details it was first given
      property ??= (
        await tx
          .select()
          .from(properties)
          .where(
            and(
              eq(properties.clientId, client.id),
              eq(properties.addressKey, addressKey(address)),
            ),
          )
          .for("update")
      )[0];
    }

    if (!isNew) {
      // until #5 and #6 let a request end (Quote Accepted, Declined or
      // Expired, or Turned Down), every request is still waiting
      const [waiting] = await tx
        .select({ id: quoteRequests.id })
        .from(quoteRequests)
        .where(eq(quoteRequests.propertyId, property!.id))
        .limit(1);
      if (waiting) {
        throw new ConflictError(
          `You've already asked us for a Quote for this home. We'll email it to ${client.email} soon.`,
        );
      }

      // the Condition stated now is the latest known; the other details stay
      // as first given, because only the Office changes those
      [property] = await tx
        .update(properties)
        .set({ condition: submission.condition })
        .where(eq(properties.id, property!.id))
        .returning();
    }

    const [request] = await tx
      .insert(quoteRequests)
      .values({
        clientId: client.id,
        propertyId: property!.id,
        condition: submission.condition,
        wantsRegularService: submission.wantsRegularService,
        notes: submission.notes,
      })
      .returning();
    return { property: property!, request: request! };
  });

  // the request is saved: a receipt that can't be sent mustn't make it look
  // as though it wasn't
  try {
    await sendReceipt(client, property);
  } catch (error) {
    console.error(`receipt for Quote Request ${request.id} not sent:`, error);
  }
  return { id: request.id, emailedTo: client.email };
};

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export const addressOf = (p: Pick<Property, "street" | "unit" | "postcode">) =>
  [p.street, p.unit, p.postcode].filter(Boolean).join(", ");

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

// every Quote Request for the Office, newest first; Turning Down (#6) and
// Quotes (#5) will narrow this to the open ones
export const openQuoteRequests = async (): Promise<OpenQuoteRequest[]> => {
  const rows = await db
    .select({
      request: quoteRequests,
      client: { id: clients.id, name: clients.name },
      property: {
        street: properties.street,
        unit: properties.unit,
        postcode: properties.postcode,
        type: properties.type,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
      },
    })
    .from(quoteRequests)
    .innerJoin(clients, eq(clients.id, quoteRequests.clientId))
    .innerJoin(properties, eq(properties.id, quoteRequests.propertyId))
    .orderBy(desc(quoteRequests.createdAt));

  return rows.map(({ request, client, property }) => ({
    id: request.id,
    propertyId: request.propertyId,
    condition: request.condition,
    wantsRegularService: request.wantsRegularService,
    notes: request.notes,
    createdAt: request.createdAt.toISOString(),
    client,
    property,
  }));
};
