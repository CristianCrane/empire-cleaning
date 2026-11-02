import { describe, expect, test } from "vitest";
import { scrub } from "./scrub.js";

// Client details never reach Sentry or the logs (ADR-0007)
describe("scrubbing", () => {
  test("drops personal details and keeps IDs", () => {
    expect(
      scrub({
        clientId: "c1",
        email: "casey@example.com",
        phone: "718-555-0123",
        address: { line1: "41 Austin St" },
        accessInstructions: "key under the mat",
        body: { name: "Casey" },
        headers: { cookie: "session=abc", authorization: "Bearer x" },
      }),
    ).toEqual({
      clientId: "c1",
      email: "[redacted]",
      phone: "[redacted]",
      address: "[redacted]",
      accessInstructions: "[redacted]",
      body: "[redacted]",
      headers: { cookie: "[redacted]", authorization: "[redacted]" },
    });
  });

  test.each([
    ["email to casey+home@example.com failed", "email to [email] failed"],
    ["call (718) 555-0123 or +1 718.555.0124", "call [phone] or [phone]"],
    ["7185550123", "[phone]"],
    [
      "/api/auth/magic-link/verify?token=abc123&callbackURL=%2F",
      "/api/auth/magic-link/verify?token=[redacted]&callbackURL=[redacted]",
    ],
  ])("scrubs %j from text", (text, scrubbed) => {
    expect(scrub(text)).toBe(scrubbed);
  });

  test.each([
    "Job 0b8f6c2e-1d4a-4c39-9a51-3e0f2d1c7b6a on 2026-11-03",
    "a Charge of 1234567890123 cents",
    "at node_modules/.pnpm/drizzle-orm@1.0.0-rc.4_@types+pg@8.23.1_pg@8.23.0/node_modules/session.ts:71:11",
  ])("leaves IDs, dates and amounts in %j", (text) => {
    expect(scrub(text)).toBe(text);
  });

  test("drops a failed query's values", () => {
    const failed = Object.assign(
      new Error(
        "Failed query: insert into clients (name, email) values ($1, $2)\nparams: Casey Client,casey@example.com",
      ),
      { params: ["Casey Client", "casey@example.com"] },
    );

    const scrubbed = scrub({ err: failed });

    expect(scrubbed.err).toMatchObject({
      message:
        "Failed query: insert into clients (name, email) values ($1, $2)\nparams: [redacted]",
      params: "[redacted]",
    });
    expect(JSON.stringify(scrubbed)).not.toContain("Casey");
  });

  test("keeps an Error's message, stack and cause, scrubbed", () => {
    const cause = new Error("connection to casey@example.com refused");
    // as Drizzle sets it: enumerable, so it would be seen twice
    const failed = Object.assign(new Error("Failed query"), { cause });

    const scrubbed = scrub({ err: failed, again: cause });

    expect(scrubbed).toMatchObject({
      err: {
        type: "Error",
        message: "Failed query",
        stack: expect.stringContaining("Failed query"),
        cause: { type: "Error", message: "connection to [email] refused" },
      },
      // the same object twice isn't circular
      again: { message: "connection to [email] refused" },
    });
  });
});
