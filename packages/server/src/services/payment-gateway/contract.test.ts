import { FakePaymentGateway } from "../../../tests/fakes/payment-gateway.ts";
import { paymentGatewayContract } from "../../../tests/contract/payment-gateway.ts";

// The fake does what Stripe does, as the same suite shows against a sandbox
// (tests/contract/stripe.sandbox.test.ts)
paymentGatewayContract("FakePaymentGateway", () => {
  const fake = new FakePaymentGateway();
  return {
    gateway: fake,
    enterCard: async (card) => fake.paymentToken(card),
    fillCardForm: async (secret, card) => fake.fillCardForm(secret, card),
    abandonCardForm: async (secret) => fake.abandonCardForm(secret),
    payByBankDebit: async (ref) => fake.payBill(ref, "bank"),
    paymentAttempts: async (payerId) =>
      fake.paymentAttempts.filter((a) => a.payerId === payerId).length,
    refundInDashboard: async (chargeId, amount) =>
      fake.refundAtProvider(chargeId, amount),
    refundWebhook: async (refundId) => {
      const event = fake.settleRefund(refundId);
      if (!event) throw new Error(`refund ${refundId} had nothing to settle`);
      return fake.webhook(event);
    },
    depositWebhook: (ref) => fake.webhook({ kind: "deposit_succeeded", ref }),
    forgedWebhook: () =>
      fake.webhook({ kind: "deposit_succeeded", ref: "pi_1" }, "forged"),
  };
});
