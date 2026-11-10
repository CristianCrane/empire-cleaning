import { currentLanguage } from "#services/request";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, eq, exists, gt, ilike, or, sql } from "drizzle-orm";
import type {
  Language,
  ClientList,
  ClientStanding,
  ClientView,
  OfficeClientView,
} from "@empire-cleaning/models";
import { HOUR_MS, catalog } from "@empire-cleaning/models";
import { clock } from "#services/clock";
import { rateLimit, tooManyTries } from "#services/rate-limit";
import { db } from "../../db/index.ts";
import {
  ConflictError,
  NotFoundError,
  TooManyRequestsError,
} from "../../middleware/errors.ts";
import { accounts } from "../auth/auth.schema.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { connectSignedUpAccount } from "../auth/connections.ts";
import { properties } from "../properties/properties.schema.ts";
import { propertyStatuses } from "../properties/property-history.ts";
import { openQuotesAt } from "../quotes/quote-state.ts";
import { toPropertyView } from "../properties/property-view.ts";
import { quotesForClient } from "../quotes/quote-state.ts";
import { clients, emailChanges } from "./clients.schema.ts";
import { clientStandings, standingOfClient } from "./standing.ts";

// no email only when the Office enters a caller without one (#34); a
// business name only for a business (#72); the language of the page a
// Guest asked on, or English (ADR-0025)
type NewClient = {
  email: string | null;
  name: string;
  phone: string;
  businessName?: string | null;
  preferredLanguage?: Language;
};

const normalise = (email: string) => email.trim().toLowerCase();

// adds a Client; asking for a Quote is what creates them. If someone has already
// signed up with this email, their Account is connected straight away.
export const createClient = async ({
  email,
  name,
  phone,
  businessName,
  preferredLanguage,
}: NewClient) => {
  const [client] = await db
    .insert(clients)
    .values({
      email: email && normalise(email),
      name,
      phone,
      businessName: businessName || null,
      preferredLanguage,
    })
    .returning();
  if (!client!.email) return client!;
  await connectSignedUpAccount(client!.email);

  // as connecting left it
  const [connected] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, client!.id));
  return connected!;
};

// an email another Client already has, refused when one is given or confirmed
// in the request's language (ADR-0025), as Confirm email shows the link's
// 404 too
const words = catalog({
  en: {
    EMAIL_TAKEN:
      "That email belongs to another client. Please use a different one.",
    LINK_USED: "This link has expired or was used already.",
  },
  es: {
    EMAIL_TAKEN:
      "Ese correo electrónico es de otro cliente. Use uno diferente.",
    LINK_USED: "Este enlace venció o ya se usó.",
  },
});
export const emailTaken = () => words[currentLanguage()].EMAIL_TAKEN;

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

// the Client a signed-in Client's Account is connected to
export const ownClient = async (accountId: string) => {
  const client = await clientForAccount(accountId);
  if (!client) throw new NotFoundError("Client not found");
  return client;
};

// e.g. Office Staff correcting a Client who signed up with a different email
// from asking for a Quote; if that Account exists it connects straight away
export const changeClientEmail = async (id: string, email: string) => {
  const address = normalise(email);
  await db.update(clients).set({ email: address }).where(eq(clients.id, id));
  await connectSignedUpAccount(address);
};

// the Client's own edit of their name and phone; a new email waits for its
// link (changeOwnEmail)
export const updateContactDetails = async (
  id: string,
  { name, phone }: { name: string; phone: string },
) => {
  await db.update(clients).set({ name, phone }).where(eq(clients.id, id));
};

// how long the link to confirm a new email works
export const EMAIL_CHANGE_TTL_HOURS = 24;

const hashOf = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// the Client's own change of email (#243): held back until they open the
// link to the new address, whose token this gives. Giving their current email
// back drops a waiting change, and gives nothing to send. An address gets
// only so many links, so no one's inbox is flooded through us (#32)
export const changeOwnEmail = async (
  client: { id: string; email: string | null },
  email: string,
): Promise<{ email: string; token: string } | null> => {
  const address = normalise(email);
  if (address === client.email) {
    await db.delete(emailChanges).where(eq(emailChanges.clientId, client.id));
    return null;
  }
  const verdict = rateLimit.attempt("emailChange", address);
  if (!verdict.allowed) {
    throw new TooManyRequestsError(
      tooManyTries(currentLanguage(), verdict.retryAfterSeconds),
      verdict.retryAfterSeconds,
    );
  }
  const token = randomBytes(32).toString("base64url");
  const change = {
    email: address,
    tokenHash: hashOf(token),
    expiresAt: new Date(
      clock.now().getTime() + EMAIL_CHANGE_TTL_HOURS * HOUR_MS,
    ),
  };
  await db
    .insert(emailChanges)
    .values({ clientId: client.id, ...change })
    .onConflictDoUpdate({ target: emailChanges.clientId, set: change });
  return { email: address, token };
};

// the link to a new email opened: it's the Client's now, unless another
// Client has taken it meanwhile. Their Account stays connected (ADR-0006)
export const confirmEmailChange = async (token: string) =>
  db.transaction(async (tx) => {
    const [change] = await tx
      .delete(emailChanges)
      .where(
        and(
          eq(emailChanges.tokenHash, hashOf(token)),
          gt(emailChanges.expiresAt, clock.now()),
        ),
      )
      .returning();
    if (!change) {
      throw new NotFoundError(words[currentLanguage()].LINK_USED);
    }
    const [other] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, change.email));
    if (other && other.id !== change.clientId) {
      throw new ConflictError(emailTaken());
    }
    await tx
      .update(clients)
      .set({ email: change.email })
      .where(eq(clients.id, change.clientId));
    return { email: change.email };
  });

// the new email a Client is yet to confirm, while its link works
const pendingEmailOf = async (clientId: string) => {
  const [change] = await db
    .select({ email: emailChanges.email })
    .from(emailChanges)
    .where(
      and(
        eq(emailChanges.clientId, clientId),
        gt(emailChanges.expiresAt, clock.now()),
      ),
    );
  return change?.email ?? null;
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

  const [ownProperties, ownQuotes, list, pendingEmail] = await Promise.all([
    propertiesOf(id),
    quotesForClient(id),
    currentPriceList(),
    pendingEmailOf(id),
  ]);
  return {
    id: client.id,
    name: client.name,
    businessName: client.businessName,
    // the Client's own view: they signed in with a proven email that's theirs
    email: client.email!,
    pendingEmail,
    phone: client.phone,
    preferredLanguage: client.preferredLanguage,
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
    reviewRequestedAt: client.reviewRequestedAt?.toISOString() ?? null,
  };
};

// matches anywhere in the text, ignoring case: "nud" finds "1 Nudge Lane"
const containing = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

// a search that could be (part of) a phone number, however it's written
const phoneLike = /^[\d\s()+.-]+$/;

// how many Clients a page of the list holds unless more are asked for
const CLIENTS_PAGE = 50;

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
