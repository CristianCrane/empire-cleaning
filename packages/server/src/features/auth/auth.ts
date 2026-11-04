import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import env from "../../env.ts";
import { db } from "../../db/index.ts";
import { email } from "../../services/email/index.ts";
import { rateLimit, tooManyTries } from "../../services/rate-limit/index.ts";
import { connectByEmail } from "./connections.ts";
import { signInEmail } from "./emails.ts";
import {
  accounts,
  sessions,
  accountIdentities,
  verifications,
} from "./auth.schema.ts";

// sign-in links are short-lived; no other email can sign anyone in (ADR-0006)
const SIGN_IN_LINK_TTL_SECONDS = 15 * 60;

const sendSignInLink = async ({ to, url }: { to: string; url: string }) => {
  await email.send({ to, ...signInEmail({ url }) });
};

// a sign-in link is emailed to one address only so often (#32)
const limitSignInLinks = (body: Record<string, unknown> | undefined) => {
  const address: unknown = body?.email;
  if (typeof address !== "string") return;
  const verdict = rateLimit.attempt("signInLink", address);
  if (verdict.allowed) return;
  throw new APIError(
    "TOO_MANY_REQUESTS",
    { message: tooManyTries(verdict.retryAfterSeconds) },
    { "Retry-After": String(verdict.retryAfterSeconds) },
  );
};

// the Office sees an Account's picture, so only Google sets it: one a person
// chose could be any address, telling them whenever the Office looks (#243)
const refuseOwnPicture = (body: Record<string, unknown> | undefined) => {
  if (body && "image" in body) {
    throw new APIError("BAD_REQUEST", {
      message: "Your picture comes from Google.",
    });
  }
};

const beforeRequest = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/sign-in/magic-link") limitSignInLinks(ctx.body);
  if (ctx.path === "/update-user") refuseOwnPicture(ctx.body);
});

// connects a newly signed-in Account to its Client and Staff records, but
// only once its email is proven, which signing up or in always does
const connectOnSignIn = async (accountId: string) => {
  const [account] = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      proven: accounts.emailVerified,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  if (account?.proven) await connectByEmail(account);
};

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CORS_ORIGIN_URL],
  // when a sign-in fails part-way (e.g. a broken Google callback), send the
  // person to the app's sign-in page, which explains ?error=, rather than
  // Better Auth's own bare error page
  onAPIError: { errorURL: `${env.CORS_ORIGIN_URL}/sign-in` },
  telemetry: { enabled: false },
  // Better Auth's own limits count per network address, which behind Render
  // it can't tell apart: every visitor would share one count. Off whatever
  // NODE_ENV says; ours count per email address (#32)
  rateLimit: { enabled: false },
  hooks: { before: beforeRequest },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: accounts,
      session: sessions,
      account: accountIdentities,
      verification: verifications,
    },
  }),
  advanced: {
    // our ids are UUIDs, but generated here rather than with Better Auth's
    // "uuid" setting, which would also overwrite the ids Better Auth picks
    // itself (e.g. the lock around a first sign-in), silently disabling them
    database: { generateId: () => crypto.randomUUID() },
  },
  // every new session (sign-up included) connects the Account to its records;
  // what an Account may do comes from those connections, never the Account
  databaseHooks: {
    session: {
      create: { after: async (session) => connectOnSignIn(session.userId) },
    },
  },
  session: {
    fields: { userId: "accountId" },
  },
  account: {
    fields: { userId: "ownerId", accountId: "providerAccountId" },
    // Google signs in to the existing Account with the same email, once
    // Google has proven it: never a trusted provider, which skips that (#243)
    accountLinking: { enabled: true },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // every Google sign-in refreshes the Account's name and picture, also
      // for an Account first made with an emailed link (Staff avatars)
      overrideUserInfoOnSignIn: true,
    },
  },
  plugins: [
    // anyone may sign up (ADR-0006): the link creates the Account if it's new
    magicLink({
      expiresIn: SIGN_IN_LINK_TTL_SECONDS,
      storeToken: "hashed",
      sendMagicLink: async ({ email: to, url }) => sendSignInLink({ to, url }),
    }),
  ],
});
