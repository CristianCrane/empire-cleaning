import Stripe from "stripe";
import { describe, expect, test, vi } from "vitest";
import { testMonitoring } from "../../../tests/harness.ts";
import { StripePaymentGateway } from "./stripe.ts";

// the real adapter, with Stripe's client answering as told
const gateway = () => {
  const stripe = new StripePaymentGateway({
    secretKey: "sk_test_fake",
    publishableKey: "pk_test_fake",
    webhookSecret: "whsec_fake",
  });
  return { stripe, client: stripe["stripe"] };
};

const charge = (stripe: StripePaymentGateway) =>
  stripe.charge({
    payerId: "cus_1",
    paymentMethodId: "pm_1",
    amount: 4200,
    description: "Balance",
    idempotencyKey: "balance:1",
  });

// which signal what Stripe refuses is (ADR-0007)
describe("Stripe's refusals", () => {
  test("a declined card is charge_declined, counted", async () => {
    const { stripe, client } = gateway();
    vi.spyOn(client.paymentIntents, "create").mockRejectedValue(
      new Stripe.errors.StripeCardError({
        type: "card_error",
        message: "Your card has insufficient funds.",
        code: "card_declined",
        decline_code: "insufficient_funds",
      }),
    );

    expect(await charge(stripe)).toEqual({
      ok: false,
      reason: "insufficient_funds",
    });
    expect(testMonitoring().signals).toEqual([
      expect.objectContaining({ name: "charge_declined", urgency: "counted" }),
    ]);
  });

  test("Stripe unreachable is payment_gateway_error, urgent", async () => {
    const { stripe, client } = gateway();
    vi.spyOn(client.refunds, "create").mockRejectedValue(
      new Stripe.errors.StripeConnectionError({
        type: "api_error",
        message: "An error occurred with our connection to Stripe.",
      }),
    );

    const refunded = await stripe.refund({
      chargeId: "pi_1",
      amount: 1000,
      idempotencyKey: "refund:1",
    });

    expect(refunded.ok).toBe(false);
    expect(testMonitoring().signals).toEqual([
      expect.objectContaining({
        name: "payment_gateway_error",
        urgency: "urgent",
        context: expect.objectContaining({ what: "a refund" }),
      }),
    ]);
  });
});
