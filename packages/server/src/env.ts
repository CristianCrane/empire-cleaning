import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().positive().default(3000),
});

const result = envSchema.safeParse(process.env);

if (result.error) {
  console.error("Server failed to start, invalid environment variables:");

  console.error(
    result.error.issues
      .map((issue, index) => `${index}. [${issue.path}]: ${issue.message}`)
      .join("\n"),
  );

  process.exit(1);
}

export type Env = z.infer<typeof envSchema>

export default result.data
