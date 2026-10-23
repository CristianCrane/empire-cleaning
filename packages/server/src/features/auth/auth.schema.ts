import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";

// Better Auth's tables, named after our glossary: Better Auth's "user" is our
// Account, and its "account" (a linked sign-in method, e.g. Google) is an
// account identity. An Account holds no roles: what it may do comes from the
// Client and Staff records it's connected to (ADR-0006).

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("sessions_account_id_idx").on(t.accountId)],
);

export const accountIdentities = pgTable(
  "account_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // the Account this identity signs in to. Not called accountId: that's
    // Better Auth's own name for the provider's id below, and sharing it makes
    // Better Auth look the owner up by the Google id
    ownerId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // the identity's id at the provider, e.g. the Google user id
    providerAccountId: text("provider_account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    // part of Better Auth's schema; always empty since we have no passwords (ADR-0002)
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_identities_account_id_idx").on(t.ownerId)],
);

// one-time sign-in link tokens, and the locks Better Auth takes around them;
// ids are text because Better Auth names its locks itself
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export type Account = typeof accounts.$inferSelect;
