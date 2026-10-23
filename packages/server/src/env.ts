import { z } from "zod";

const DEV_AUTH_SECRET = "dev-only-secret-not-for-production-use";

const envSchema = z
  .object({
    APP_MODE: z.enum(["dev", "prod"]).default("dev"),
    CORS_ORIGIN_URL: z.url().default("localhost"),
    PORT: z.coerce.number().positive().default(3000),
    DB_URL: z.url().nonempty(),
    // optional in dev only: without it, emails are printed to the console
    RESEND_API_KEY: z.string().nonempty().optional(),
    EMAIL_FROM: z
      .string()
      .default("Empire Cleaning <no-reply@empirecleaningandpro.com>"),
    // public URL of this API; sign-in links point here
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    // signs session cookies and tokens; the dev default is never valid in prod
    BETTER_AUTH_SECRET: z.string().min(32).default(DEV_AUTH_SECRET),
    // optional in dev only: without them, Google sign-in is unavailable
    GOOGLE_CLIENT_ID: z.string().nonempty().optional(),
    GOOGLE_CLIENT_SECRET: z.string().nonempty().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.APP_MODE !== "prod") return;

    const requiredInProd = [
      "RESEND_API_KEY",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ] as const;
    for (const key of requiredInProd) {
      if (!env[key]) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "required when APP_MODE=prod",
        });
      }
    }

    if (env.BETTER_AUTH_SECRET === DEV_AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "must be set when APP_MODE=prod",
      });
    }
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
