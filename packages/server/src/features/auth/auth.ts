import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import env from "../../env.ts";
import { db } from "../../db/index.ts";
import { email } from "../../services/email/index.ts";
import {
  accounts,
  sessions,
  accountIdentities,
  verifications,
} from "./auth.schema.ts";

// sign-in links are short-lived; longer-lived links (e.g. in Quote emails)
// are a separate decision for the tickets that send them
const SIGN_IN_LINK_TTL_SECONDS = 15 * 60;

const sendSignInLink = async ({ to, url }: { to: string; url: string }) => {
  await email.send({
    to,
    subject: "Sign in to Empire Cleaning",
    text: `Use this link to sign in to Empire Cleaning:\n\n${url}\n\nIt expires in 15 minutes. If you didn't ask to sign in, you can ignore this email.`,
    html: `<p>Use this link to sign in to Empire Cleaning:</p><p><a href="${url}">Sign in</a></p><p>It expires in 15 minutes. If you didn't ask to sign in, you can ignore this email.</p>`,
  });
};

const accountExists = async (address: string) => {
  const [found] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, address.toLowerCase()));
  return found !== undefined;
};

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CORS_ORIGIN_URL],
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
    database: { generateId: "uuid" },
  },
  user: {
    additionalFields: {
      // roles are granted by our own code (Quote Request, Staff invite,
      // setup script), never by the caller
      roles: { type: "string[]", required: false, input: false },
    },
  },
  session: {
    fields: { userId: "accountId" },
  },
  account: {
    fields: { userId: "accountId", accountId: "providerAccountId" },
    // Google signs in to the existing Account with the same email
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            disableSignUp: true,
          },
        }
      : {},
  plugins: [
    // Accounts are only created by our own flows, never by signing in
    magicLink({
      disableSignUp: true,
      expiresIn: SIGN_IN_LINK_TTL_SECONDS,
      storeToken: "hashed",
      sendMagicLink: async ({ email: to, url }) => {
        // same response either way, so the endpoint can't reveal who has an Account
        if (await accountExists(to)) {
          await sendSignInLink({ to, url });
        }
      },
    }),
    // non-browser clients (e.g. a future native app) use bearer tokens instead of cookies
    bearer(),
  ],
});
