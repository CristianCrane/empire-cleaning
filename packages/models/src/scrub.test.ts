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
    // emails that touch, which a match starting only where a run starts misses
    ["a@b.com.x@c.com", "[email][email]"],
    ["a@b.com+x@c.com", "[email][email]"],
    // a key ending in "?", which a key without "?" misses
    ["/x?foo?=secret", "/x?foo?=[redacted]"],
  ])("scrubs %j from text", (text, scrubbed) => {
    expect(scrub(text)).toBe(scrubbed);
  });

  // a long run a visitor sends can end up in an error message: a pattern
  // that tries every start in it and scans to its end took 1.8–2.8 s on
  // 50,000 characters (#292). It takes ~0.2 ms. The fastest of three runs,
  // under 100 ms, rides out a pause on a busy machine and still fails the
  // old patterns on one twice as fast
  test.each(["+", "a", "?"])("scrubs a long run of %j quickly", (character) => {
    const text = character.repeat(50_000);

    const times = [1, 2, 3].map(() => {
      const start = performance.now();
      expect(scrub(text)).toBe(text);
      return performance.now() - start;
    });

    expect(Math.min(...times)).toBeLessThan(100);
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
