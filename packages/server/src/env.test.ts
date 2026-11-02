import { expect, test } from "vitest";
import { envSchema } from "./env.ts";

// the variables the tests run with (vitest.config.ts)
const base = { ...process.env };

// Sentry's keys are the one exception to "required in every mode" (ADR-0007)
test("prod refuses to start without SENTRY_DSN", () => {
  const result = envSchema.safeParse({
    ...base,
    APP_MODE: "prod",
    SENTRY_DSN: undefined,
  });

  expect(result.error?.issues).toEqual([
    expect.objectContaining({
      path: ["SENTRY_DSN"],
      message: "required in prod",
    }),
  ]);
});

test("prod starts with SENTRY_DSN", () => {
  const result = envSchema.safeParse({
    ...base,
    APP_MODE: "prod",
    SENTRY_DSN: "https://key@o1.ingest.sentry.io/1",
  });

  expect(result.success).toBe(true);
});

test.each(["dev", "test"])("%s starts without SENTRY_DSN", (mode) => {
  const result = envSchema.safeParse({
    ...base,
    APP_MODE: mode,
    SENTRY_DSN: undefined,
  });

  expect(result.success).toBe(true);
});
