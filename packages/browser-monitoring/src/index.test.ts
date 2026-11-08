import * as Sentry from "@sentry/react";
import type { ErrorEvent, Event } from "@sentry/react";
import { describe, expect, test } from "vitest";
import { scrubBreadcrumb, scrubEvent, startMonitoring } from "./index.ts";

// no Client's details reach Sentry from the browser (ADR-0007)
describe("scrubbing", () => {
  test("an event keeps the page, browser, Account ID and error, not personal details", () => {
    const event: ErrorEvent = {
      type: undefined,
      message: "couldn't send the Quote for casey@example.com",
      exception: {
        values: [
          {
            type: "Error",
            value: "no Quote for (718) 555-0123",
            stacktrace: {
              frames: [{ filename: "https://app.example.com/assets/index.js" }],
            },
          },
        ],
      },
      request: {
        url: "https://app.example.com/sign-in?token=abc123",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://app.example.com/portal/details?email=casey",
        },
        cookies: { session: "abc" },
      },
      user: {
        id: "account-1",
        email: "casey@example.com",
        ip_address: "203.0.113.4",
      },
      extra: {
        form: {
          email: "casey@example.com",
          phone: "718-555-0123",
          address: { line1: "41 Austin St" },
          accessInstructions: "key under the mat",
        },
      },
      tags: { area: "portal" },
    };

    const scrubbed = scrubEvent(event);

    expect(scrubbed).toEqual({
      type: undefined,
      message: "couldn't send the Quote for [email]",
      exception: {
        values: [
          {
            type: "Error",
            value: "no Quote for [phone]",
            stacktrace: {
              frames: [{ filename: "https://app.example.com/assets/index.js" }],
            },
          },
        ],
      },
      request: {
        url: "https://app.example.com/sign-in?token=[redacted]",
        headers: { "User-Agent": "Mozilla/5.0" },
      },
      user: { id: "account-1" },
      extra: {
        form: {
          email: "[redacted]",
          phone: "[redacted]",
          address: "[redacted]",
          accessInstructions: "[redacted]",
        },
      },
      tags: { area: "portal" },
    });
  });

  test("a report from the feedback button keeps the page, the Account ID and what they noticed, scrubbed", () => {
    const report: Event = {
      type: "feedback",
      contexts: {
        feedback: {
          message: "Helen's card says casey@example.com, not hers",
          url: "https://app.test.example.com/office/clients?q=helen",
        },
      },
      request: { url: "https://app.test.example.com/office/clients?q=helen" },
      user: { id: "account-1", email: "jen@example.com" },
    };

    expect(scrubEvent(report)).toEqual({
      type: "feedback",
      contexts: {
        feedback: {
          message: "Helen's card says [email], not hers",
          url: "https://app.test.example.com/office/clients?q=[redacted]",
        },
      },
      request: {
        url: "https://app.test.example.com/office/clients?q=[redacted]",
      },
      user: { id: "account-1" },
    });
  });

  test("a signed-out person's event has no user", () => {
    expect(scrubEvent({ type: undefined, user: {} })).toEqual({
      type: undefined,
    });
  });

  test("a page change keeps where from and to, its query scrubbed", () => {
    expect(
      scrubBreadcrumb({
        category: "navigation",
        data: { from: "/sign-in?next=%2Fportal", to: "/portal/jobs/job-1" },
      }),
    ).toEqual({
      category: "navigation",
      data: { from: "/sign-in?next=[redacted]", to: "/portal/jobs/job-1" },
    });
  });

  test("a call to the API keeps its method, path and status, its query scrubbed", () => {
    expect(
      scrubBreadcrumb({
        category: "fetch",
        data: {
          method: "GET",
          url: "/api/clients?email=casey@example.com",
          status_code: 500,
        },
      }),
    ).toEqual({
      category: "fetch",
      data: {
        method: "GET",
        url: "/api/clients?email=[redacted]",
        status_code: 500,
      },
    });
  });

  test("console lines are dropped", () => {
    expect(
      scrubBreadcrumb({
        category: "console",
        message: "Casey Client, 41 Austin St",
      }),
    ).toBeNull();
  });
});

test("without a DSN nothing starts, so nothing is sent", () => {
  startMonitoring({ dsn: undefined, environment: "dev" });

  expect(Sentry.isInitialized()).toBe(false);
});
