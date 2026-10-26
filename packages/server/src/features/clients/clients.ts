import { asc, desc, eq, inArray } from "drizzle-orm";
import type { ClientView, OfficeClientView } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { connectSignedUpAccount } from "../auth/connections.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { jobViews } from "../jobs/schedule.ts";
import { properties } from "../properties/properties.schema.ts";
import { toPropertyView } from "../properties/property-view.ts";
import { addOnsForRequests } from "../quote-requests/add-ons.ts";
import { quoteRequests } from "../quote-requests/quote-requests.schema.ts";
import {
  firstCleansOf,
  quotesForClient,
  requestStates,
} from "../quotes/quote-state.ts";
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

  const ownProperties = await db
    .select()
    .from(properties)
    .where(eq(properties.clientId, id))
    .orderBy(asc(properties.createdAt));
  const requests = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.clientId, id))
    .orderBy(desc(quoteRequests.createdAt));
  const ids = requests.map((r) => r.id);
  const [addOns, states] = await Promise.all([
    addOnsForRequests(ids),
    requestStates(ids),
  ]);

  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    properties: ownProperties.map(toPropertyView),
    quoteRequests: requests.map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      condition: r.condition,
      wantsRegularService: r.wantsRegularService,
      notes: r.notes,
      addOns: addOns.get(r.id) ?? [],
      createdAt: r.createdAt.toISOString(),
      state: states.get(r.id)!,
    })),
  };
};

// A Client for the Office: with each Property's whole history (every Quote,
// Drafts included, and every Job, newest first), and which Properties have
// a Completed First Clean, so can be offered a Service Plan
export const officeClientView = async (
  id: string,
): Promise<OfficeClientView | undefined> => {
  const view = await clientView(id);
  if (!view) return undefined;
  const propertyIds = view.properties.map((p) => p.id);
  const [quotes, ownJobs, firstCleans] = await Promise.all([
    quotesForClient(id, { drafts: true }),
    propertyIds.length === 0
      ? []
      : jobViews(inArray(jobs.propertyId, propertyIds)),
    firstCleansOf(propertyIds),
  ]);
  return {
    ...view,
    properties: view.properties.map((p) => ({
      ...p,
      firstCleanCompleted: firstCleans.has(p.id),
    })),
    quotes,
    jobs: ownJobs.reverse(),
  };
};
