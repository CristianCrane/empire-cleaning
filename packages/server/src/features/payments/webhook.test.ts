import { describe, expect, test } from "vitest";
import { FAKE_SIGNATURE } from "../../../tests/fakes/payment-gateway.ts";
import { api, testMonitoring } from "../../../tests/harness.ts";

const webhook = (event: unknown) =>
  api()
    .post("/api/payments/webhook")
    .set("content-type", "application/json")
    .set("x-fake-signature", FAKE_SIGNATURE)
    .send(JSON.stringify(event));

describe("what the provider tells us of Charges (ADR-0007)", () => {
  test("a dispute is the urgent dispute_opened signal", async () => {
    await webhook({ kind: "dispute_opened", chargeId: "pi_1" }).expect(200);

    expect(testMonitoring().signals).toEqual([
      { name: "dispute_opened", urgency: "urgent", context: { ref: "pi_1" } },
    ]);
  });

  test("a refund made in the provider's dashboard is counted", async () => {
    await webhook({ kind: "charge_refunded", chargeId: "pi_1" }).expect(200);

    expect(testMonitoring().signals).toEqual([
      {
        name: "refunded_at_provider",
        urgency: "counted",
        context: { ref: "pi_1" },
      },
    ]);
  });
});
