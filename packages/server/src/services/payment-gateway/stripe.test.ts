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

// telling a refund made in Stripe's dashboard from ours (ADR-0021)
describe("refunds made elsewhere", () => {
  test("ours are marked as made here", async () => {
    const { stripe, client } = gateway();
    const create = vi
      .spyOn(client.refunds, "create")
      .mockResolvedValue({ id: "re_1", status: "succeeded" } as never);

    await stripe.refund({
      chargeId: "pi_1",
      amount: 1000,
      idempotencyKey: "refund:1",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { made_by: "app" } }),
      { idempotencyKey: "refund:1" },
    );
  });

  test("are a Charge's refunds not made here, as far as they've gone through or are on their way", async () => {
    const { stripe, client } = gateway();
    const refund = (
      id: string,
      status: string,
      metadata: Record<string, string> = {},
    ) => ({ id, status, metadata, amount: 500, created: 1767225600 });
    const list = vi.spyOn(client.refunds, "list").mockReturnValue({
      autoPagingToArray: async () => [
        refund("re_ours", "succeeded", { made_by: "app" }),
        refund("re_done", "succeeded"),
        refund("re_on_its_way", "pending"),
        refund("re_failed", "failed"),
      ],
    } as never);

    expect(await stripe.refundsElsewhere("pi_1")).toEqual([
      {
        refundId: "re_done",
        amount: 500,
        at: new Date("2026-01-01T00:00:00Z"),
      },
      {
        refundId: "re_on_its_way",
        amount: 500,
        at: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    expect(list).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 100 });
  });
});
