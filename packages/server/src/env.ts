import { z } from "zod";

const envSchema = z.object({
  APP_MODE: z.enum(["dev", "prod"]).default("dev"),
  PORT: z.coerce.number().positive().default(3000),
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
