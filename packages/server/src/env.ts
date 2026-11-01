import { z } from "zod";

// the same variables are required in every mode; see .env.example
const envSchema = z.object({
  // test is the test site (ADR-0020): set up as prod, but it says so
  // everywhere and emails only allowed addresses
  APP_MODE: z.enum(["dev", "test", "prod"]).default("dev"),
  // the web app's origin: the only browser origin trusted to call the API,
  // and where sign-in flows return to
  CORS_ORIGIN_URL: z.url(),
  // the landing site's origin, allowed to send a Guest's ask for a Quote
  LANDING_ORIGIN_URL: z.url(),
  PORT: z.coerce.number().positive().default(3000),
  DB_URL: z.url().nonempty(),
  RESEND_API_KEY: z.string().nonempty(),
  EMAIL_FROM: z
    .string()
    .default("Empire Cleaning <no-reply@empirecleaningandpro.com>"),
  // the Office's shared inbox, copied on reminders for late Bills
  OFFICE_EMAIL: z.email(),
  // on the test site, who may be emailed: comma-separated addresses or
  // patterns with * (e.g. owner+*@gmail.com); the rest goes to OFFICE_EMAIL.
  // Empty sends to anyone
  EMAIL_ALLOWED: z
    .string()
    .default("")
    .transform((list) =>
      list
        .split(",")
        .map((address) => address.trim())
        .filter(Boolean),
    ),
  // Google's write-a-review link for the business (#174, #175). Unset or empty,
  // no Client is asked for a review
  GOOGLE_REVIEW_URL: z
    .url()
    .or(z.literal(""))
    .optional()
    .transform((url) => url || undefined),
  // public URL of this API; sign-in links point here
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  // signs session cookies and tokens
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().nonempty(),
  GOOGLE_CLIENT_SECRET: z.string().nonempty(),
  // Stripe takes every payment (ADR-0004); test-mode keys in dev
  STRIPE_SECRET_KEY: z.string().nonempty(),
  // given to the browser for Stripe's payment form
  STRIPE_PUBLISHABLE_KEY: z.string().nonempty(),
  // proves webhooks come from Stripe (`stripe listen` prints one locally)
  STRIPE_WEBHOOK_SECRET: z.string().nonempty(),
});

const result = envSchema.safeParse(process.env);

if (result.error) {
  console.error("Server failed to start, invalid environment variables:\n");
  console.error(
    result.error.issues
      .map((issue) => `[${issue.path}]: ${issue.message}`)
      .join("\n"),
  );

  process.exit(1);
}

console.log(`APP_MODE=${result.data.APP_MODE}`);

export type Env = z.infer<typeof envSchema>;

export default result.data;
