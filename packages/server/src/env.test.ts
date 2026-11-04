import { expect, test } from "vitest";
import { envSchema } from "./env.ts";

// the variables the tests run with (vitest.config.ts), and the API's own
// address, which only dev may leave out
const base = {
  ...process.env,
  BETTER_AUTH_URL: "https://api.empirecleaningandpro.com",
};

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

// a server set up by hand without APP_MODE would otherwise run as dev, with
// the demo people public and no rate limits (#243)
test("refuses to start without APP_MODE", () => {
  const result = envSchema.safeParse({ ...base, APP_MODE: undefined });

  expect(result.error?.issues).toEqual([
    expect.objectContaining({ path: ["APP_MODE"] }),
  ]);
});

// sign-in links point at it, so a missing one breaks every sign-in (#243)
test.each(["test", "prod"])(
  "%s refuses to start without BETTER_AUTH_URL",
  (mode) => {
    const result = envSchema.safeParse({
      ...base,
      APP_MODE: mode,
      SENTRY_DSN: "https://key@o1.ingest.sentry.io/1",
      BETTER_AUTH_URL: undefined,
    });

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["BETTER_AUTH_URL"],
        message: "required outside dev",
      }),
    ]);
  },
);

test("dev starts without BETTER_AUTH_URL, as this machine's", () => {
  const result = envSchema.safeParse({
    ...base,
    APP_MODE: "dev",
    BETTER_AUTH_URL: undefined,
  });

  expect(result.data?.BETTER_AUTH_URL).toBe("http://localhost:3000");
});
