import { describe, expect, test } from "vitest";
import { routeEmail, type Routing } from "./routing.ts";

const message = {
  to: "priya@example.com",
  subject: "Your clean is tomorrow",
};

const testSite = (allowed: string[]): Routing => ({
  mode: "test",
  allowed,
  office: "office@example.com",
});

describe("routing an email", () => {
  test("goes out unchanged outside the test site", () => {
    expect(
      routeEmail(message, { mode: "prod", allowed: [], office: "o@x.com" }),
    ).toEqual(message);
    expect(
      routeEmail(message, { mode: "dev", allowed: [], office: "o@x.com" }),
    ).toEqual(message);
  });

  test("says it's from the test site in the subject", () => {
    expect(routeEmail(message, testSite([]))).toEqual({
      to: "priya@example.com",
      subject: "[TEST] Your clean is tomorrow",
    });
  });

  test("goes to an allowed address, matched exactly or by a * pattern", () => {
    const allowed = testSite(["priya@example.com", "owner+*@gmail.com"]);

    expect(routeEmail(message, allowed).to).toBe("priya@example.com");
    expect(
      routeEmail({ ...message, to: "Owner+Cleaner-1@gmail.com" }, allowed).to,
    ).toBe("Owner+Cleaner-1@gmail.com");
  });

  test("goes to the Office inbox instead when not allowed, saying who it was for", () => {
    expect(routeEmail(message, testSite(["owner+*@gmail.com"]))).toEqual({
      to: "office@example.com",
      subject: "[TEST → priya@example.com] Your clean is tomorrow",
    });
  });

  test("a pattern matches only its own wildcard, not other characters", () => {
    const allowed = testSite(["owner+*@gmail.com"]);

    expect(routeEmail({ ...message, to: "owner@gmailxcom" }, allowed).to).toBe(
      "office@example.com",
    );
    expect(
      routeEmail({ ...message, to: "owner+a@gmail.com.evil.io" }, allowed).to,
    ).toBe("office@example.com");
  });

  test("always allows the Office inbox, and keeps an allowed copy", () => {
    const routed = routeEmail(
      { ...message, to: "office@example.com", bcc: "office@example.com" },
      testSite(["owner+*@gmail.com"]),
    );

    expect(routed).toEqual({
      to: "office@example.com",
      bcc: "office@example.com",
      subject: "[TEST] Your clean is tomorrow",
    });
  });

  test("drops a copy to an address that isn't allowed", () => {
    const routed = routeEmail(
      { ...message, bcc: "someone@example.com" },
      testSite(["priya@example.com"]),
    );

    expect(routed).toEqual({
      to: "priya@example.com",
      subject: "[TEST] Your clean is tomorrow",
    });
  });
});
