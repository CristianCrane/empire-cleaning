import { z } from "zod";

const envSchema = z.object({
  APP_MODE: z.enum(["dev", "prod"]).default("dev"),
  CORS_ORIGIN_URL: z.url().default("localhost"),
  PORT: z.coerce.number().positive().default(3000),
  DB_URL: z.url().nonempty(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z
    .string()
    .default("Empire Cleaning <no-reply@empirecleaningandpro.com>"),
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
