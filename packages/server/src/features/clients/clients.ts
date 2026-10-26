import { asc, eq } from "drizzle-orm";
import type { ClientView, OfficeClientView } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { connectSignedUpAccount } from "../auth/connections.ts";
import { properties } from "../properties/properties.schema.ts";
import { propertyStatuses } from "../properties/property-history.ts";
import { toPropertyView } from "../properties/property-view.ts";
import { quoteRequests } from "../quote-requests/quote-requests.schema.ts";
import { quoteRequestViews } from "../quote-requests/request-views.ts";
import { clients } from "./clients.schema.ts";

type NewClient = { email: string; name: string; phone: string };

const normalise = (email: string) => email.trim().toLowerCase();

// adds a Client; Quote Requests are what create them. If someone has already
// signed up with this email, their Account is connected straight away.
export const createClient = async ({ email, name, phone }: NewClient) => {
  const [client] = await db
    .insert(clients)
    .values({ email: normalise(email), name, phone })
    .returning();
  await connectSignedUpAccount(client!.email);

  return client!;
};

export const findClientByEmail = async (email: string) => {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, normalise(email)));
  return client;
};

export const clientForAccount = async (accountId: string) => {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.accountId, accountId));
  return client;
};

// e.g. Office Staff correcting a Client who signed up with a different email
// from their Quote Request; if that Account exists it connects straight away
export const changeClientEmail = async (id: string, email: string) => {
  const address = normalise(email);
  await db.update(clients).set({ email: address }).where(eq(clients.id, id));
  await connectSignedUpAccount(address);
};

// the Client's own edit of their contact details. Changing the email doesn't
// touch their connection to their Account (ADR-0006).
export const updateContactDetails = async (
  id: string,
  { name, email, phone }: { name: string; email: string; phone: string },
) => {
  await db
    .update(clients)
    .set({ name, email: normalise(email), phone })
    .where(eq(clients.id, id));
};

// a Client with their Properties and Quote Requests, newest requests first
export const clientView = async (
  id: string,
): Promise<ClientView | undefined> => {
  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) return undefined;

  const [ownProperties, requests] = await Promise.all([
    propertiesOf(id),
    quoteRequestViews(eq(quoteRequests.clientId, id)),
  ]);
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    properties: ownProperties.map(toPropertyView),
    quoteRequests: requests,
  };
};

const propertiesOf = (clientId: string) =>
  db
    .select()
    .from(properties)
    .where(eq(properties.clientId, clientId))
    .orderBy(asc(properties.createdAt));

// A Client for the Office: their contact details and their homes, each with
// where it stands; a home's history is on its own page (ADR-0011)
export const officeClientView = async (
  id: string,
): Promise<OfficeClientView | undefined> => {
  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) return undefined;

  const ownProperties = await propertiesOf(id);
  const statuses = await propertyStatuses(ownProperties.map((p) => p.id));
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    properties: ownProperties.map((p) => ({
      ...toPropertyView(p),
      status: statuses.get(p.id)!,
    })),
  };
};
