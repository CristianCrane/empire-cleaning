import { and, asc, count, eq, exists, ilike, or, sql } from "drizzle-orm";
import type {
  ClientList,
  ClientStanding,
  ClientView,
  OfficeClientView,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { connectSignedUpAccount } from "../auth/connections.ts";
import { properties } from "../properties/properties.schema.ts";
import { propertyStatuses } from "../properties/property-history.ts";
import { openQuotesAt } from "../quotes/quote-state.ts";
import { toPropertyView } from "../properties/property-view.ts";
import { quotesForClient } from "../quotes/quote-state.ts";
import { clients } from "./clients.schema.ts";
import { clientStandings, standingOfClient } from "./standing.ts";

// no email only when the Office enters a caller without one (#34); a
// business name only for a business (#72)
type NewClient = {
  email: string | null;
  name: string;
  phone: string;
  businessName?: string | null;
};

const normalise = (email: string) => email.trim().toLowerCase();

// adds a Client; asking for a Quote is what creates them. If someone has already
// signed up with this email, their Account is connected straight away.
export const createClient = async ({
  email,
  name,
  phone,
  businessName,
}: NewClient) => {
  const [client] = await db
    .insert(clients)
    .values({
      email: email && normalise(email),
      name,
      phone,
      businessName: businessName || null,
    })
    .returning();
  if (client!.email) await connectSignedUpAccount(client!.email);

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
// from asking for a Quote; if that Account exists it connects straight away
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

// Office Staff correcting a Client's contact details, or adding the email of
// one entered without it. A Client's email can be changed but never
// removed, and once it's theirs, an Account that signed up with it connects
// straight away.
export const officeUpdateContactDetails = async (
  id: string,
  {
    name,
    email,
    phone,
    businessName,
  }: {
    name: string;
    email: string | null;
    phone: string;
    // absent leaves it as it is
    businessName?: string | null;
  },
) => {
  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) return undefined;
  const address = email ? normalise(email) : client.email;
  await db
    .update(clients)
    .set({
      name,
      email: address,
      phone,
      ...(businessName !== undefined && {
        businessName: businessName || null,
      }),
    })
    .where(eq(clients.id, id));
  if (address && address !== client.email) {
    await connectSignedUpAccount(address);
  }
  return officeClientView(id);
};

// a Client with their Properties and Quotes, newest Quotes first
export const clientView = async (
  id: string,
): Promise<ClientView | undefined> => {
  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) return undefined;

  const [ownProperties, ownQuotes, list] = await Promise.all([
    propertiesOf(id),
    quotesForClient(id),
    currentPriceList(),
  ]);
  return {
    id: client.id,
    name: client.name,
    businessName: client.businessName,
    // the Client's own view: they signed in with a proven email that's theirs
    email: client.email!,
    phone: client.phone,
    properties: ownProperties.map((p) => toPropertyView(p, list)),
    quotes: ownQuotes,
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

  const [ownProperties, list] = await Promise.all([
    propertiesOf(id),
    currentPriceList(),
  ]);
  const ids = ownProperties.map((p) => p.id);
  const [statuses, open] = await Promise.all([
    propertyStatuses(ids),
    openQuotesAt(ids),
  ]);
  return {
    id: client.id,
    name: client.name,
    businessName: client.businessName,
    email: client.email,
    phone: client.phone,
    properties: ownProperties.map((p) => ({
      ...toPropertyView(p, list),
      status: statuses.get(p.id)!,
      openQuotes: open.filter((q) => q.propertyId === p.id),
    })),
    billing: {
      weeklyFrom: client.billedWeeklyFrom,
      canBillWeekly: ownProperties.some((p) => p.kind === "commercial"),
      payment: client.billPayment,
      termsDays: client.billTermsDays,
      billingEmail: client.billingEmail,
    },
  };
};

// matches anywhere in the text, ignoring case: "nud" finds "1 Nudge Lane"
const containing = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

// a search that could be (part of) a phone number, however it's written
const phoneLike = /^[\d\s()+.-]+$/;

// how many Clients a page of the list holds unless more are asked for
export const CLIENTS_PAGE = 50;

// the first `limit` Clients in name order (a business by its own) with this
// standing, or of any, and how many there are in each. With a search, only
// those whose name, business name, email, phone or Property address matches.
// A phone matches on its digits alone, so "(718) 555" and "718555" find the
// same Client.
export const listClients = async ({
  search,
  standing = "all",
  limit = CLIENTS_PAGE,
}: {
  search?: string;
  standing?: ClientStanding | "all";
  limit?: number;
} = {}): Promise<ClientList> => {
  const text = search?.trim();
  const pattern = text ? containing(text) : undefined;
  const digits = text && phoneLike.test(text) ? text.replace(/\D/g, "") : "";

  const matches = pattern
    ? or(
        ilike(clients.name, pattern),
        ilike(clients.businessName, pattern),
        ilike(clients.email, pattern),
        exists(
          db
            .select()
            .from(properties)
            .where(
              and(
                eq(properties.clientId, clients.id),
                // the address as it's shown: "41-12 Austin St, 4B, 11375"
                sql`concat_ws(', ', ${properties.street}, ${properties.unit}, ${properties.postcode}) ilike ${pattern}`,
              ),
            ),
        ),
        digits
          ? sql`regexp_replace(${clients.phone}, '\\D', '', 'g') like ${`%${digits}%`}`
          : undefined,
      )
    : undefined;

  const listed = db.$with("listed").as(
    db
      .select({
        id: clients.id,
        name: clients.name,
        businessName: clients.businessName,
        email: clients.email,
        phone: clients.phone,
        // the connected Account's picture, if any
        imageUrl: accounts.image,
        standing: standingOfClient().as("standing"),
        createdAt: clients.createdAt,
      })
      .from(clients)
      .leftJoin(accounts, eq(accounts.id, clients.accountId))
      .where(matches),
  );

  const [page, tallies] = await Promise.all([
    db
      .with(listed)
      .select()
      .from(listed)
      .where(standing === "all" ? undefined : eq(listed.standing, standing))
      // a business by its own name
      .orderBy(
        asc(sql`lower(coalesce(${listed.businessName}, ${listed.name}))`),
        asc(listed.createdAt),
      )
      .limit(limit),
    db
      .with(listed)
      .select({ standing: listed.standing, n: count() })
      .from(listed)
      .groupBy(listed.standing),
  ]);

  const counts = Object.fromEntries(
    clientStandings.map((s) => [
      s,
      tallies.find((t) => t.standing === s)?.n ?? 0,
    ]),
  ) as Record<ClientStanding, number>;
  return {
    clients: page.map(({ createdAt: _, ...client }) => client),
    counts: {
      ...counts,
      all: clientStandings.reduce((sum, s) => sum + counts[s], 0),
    },
  };
};
