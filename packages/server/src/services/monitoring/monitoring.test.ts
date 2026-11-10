import { describe, expect, test } from "vitest";
import { email, paragraph } from "#services/email";
import { testEmail, testMonitoring } from "../../../tests/harness.ts";
import { withRequest } from "#services/request";
import { createLogger } from "./log.ts";
import { monitoring, SignalledError } from "./index.ts";

// Client details never reach Sentry or the logs (ADR-0007)
describe("scrubbing", () => {
  test("log lines are scrubbed and carry the request ID", () => {
    const lines: string[] = [];
    const logger = createLogger({
      destination: { write: (line: string) => lines.push(line) },
    });

    withRequest({ requestId: "req-1" }, () =>
      logger.error(
        {
          clientId: "c1",
          email: "casey@example.com",
          err: new Error("x@y.com"),
        },
        "not sent to casey@example.com",
      ),
    );

    const line = JSON.parse(lines[0]!);
    expect(line).toMatchObject({
      requestId: "req-1",
      clientId: "c1",
      email: "[redacted]",
      msg: "not sent to [email]",
      err: { message: "[email]" },
    });
    expect(lines[0]).not.toContain("example.com");
  });

  test("an error's context is scrubbed before it's reported", () => {
    monitoring.error(new Error("boom"), {
      clientId: "c1",
      email: "casey@example.com",
      what: "receipt to casey@example.com",
    });

    expect(testMonitoring().errors[0]!.context).toEqual({
      clientId: "c1",
      email: "[redacted]",
      what: "receipt to [email]",
    });
  });
});

describe("signals", () => {
  test("carry their urgency", () => {
    monitoring.signal("charge_declined", { reason: "card_declined" });

    expect(testMonitoring().signals).toEqual([
      {
        name: "charge_declined",
        urgency: "counted",
        context: { reason: "card_declined" },
      },
    ]);
  });

  test("an email the service refuses is email_send_failed, alerted in bulk", async () => {
    testEmail().failSending();

    const sending = email.send({
      to: "casey@example.com",
      subject: "Hello",
      blocks: [paragraph("Hi")],
    });

    await expect(sending).rejects.toBeInstanceOf(SignalledError);
    expect(testMonitoring().signals).toEqual([
      {
        name: "email_send_failed",
        urgency: "in_bulk",
        context: { reason: "the email service is down" },
      },
    ]);
  });

  test("a failure already signalled isn't reported again as an error", () => {
    monitoring.error(new SignalledError("email_send_failed", "email not sent"));

    expect(testMonitoring().errors).toEqual([]);
  });
});
