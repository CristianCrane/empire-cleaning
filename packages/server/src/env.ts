import { z } from "zod";

// the same variables are required in every mode; see .env.example
const envSchema = z.object({
  APP_MODE: z.enum(["dev", "prod"]).default("dev"),
  CORS_ORIGIN_URL: z.url().default("localhost"),
  PORT: z.coerce.number().positive().default(3000),
  DB_URL: z.url().nonempty(),
  RESEND_API_KEY: z.string().nonempty(),
  EMAIL_FROM: z
    .string()
    .default("Empire Cleaning <no-reply@empirecleaningandpro.com>"),
  // public URL of this API; sign-in links point here
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  // signs session cookies and tokens
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().nonempty(),
  GOOGLE_CLIENT_SECRET: z.string().nonempty(),
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
