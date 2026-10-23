import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import env from "../../env.ts";
import { db } from "../../db/index.ts";
import { email } from "../../services/email/index.ts";
import { connectByEmail } from "./connections.ts";
import {
  accounts,
  sessions,
  accountIdentities,
  verifications,
} from "./auth.schema.ts";

// sign-in links are short-lived; no other email can sign anyone in (ADR-0006)
const SIGN_IN_LINK_TTL_SECONDS = 15 * 60;

const sendSignInLink = async ({ to, url }: { to: string; url: string }) => {
  await email.send({
    to,
    subject: "Sign in to Empire Cleaning",
    text: `Use this link to sign in to Empire Cleaning:\n\n${url}\n\nIt expires in 15 minutes. If you didn't ask to sign in, you can ignore this email.`,
    html: `<p>Use this link to sign in to Empire Cleaning:</p><p><a href="${url}">Sign in</a></p><p>It expires in 15 minutes. If you didn't ask to sign in, you can ignore this email.</p>`,
  });
};

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
    // Google signs in to the existing Account with the same email
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    // anyone may sign up (ADR-0006): the link creates the Account if it's new
    magicLink({
      expiresIn: SIGN_IN_LINK_TTL_SECONDS,
      storeToken: "hashed",
      sendMagicLink: async ({ email: to, url }) => sendSignInLink({ to, url }),
    }),
    // non-browser clients (e.g. a future native app) use bearer tokens instead of cookies
    bearer(),
  ],
});
