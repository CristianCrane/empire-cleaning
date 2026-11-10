// The contract suite on the real Stripe adapter, in a Stripe sandbox, with
// Stripe's test cards and its real webhooks: nightly in CI, and by hand when
// the adapter changes, with a sandbox (sk_test_) key in .env:
//
//   pnpm --filter @empire-cleaning/server stripe:sandbox
//
// It makes test Customers and payments in the sandbox. The browser's part
// (the Payment Element, 3D Secure) runs in the web app's sandbox run
// (packages/web/e2e/card-form.sandbox.ts): here ConfirmationTokens come from
// Stripe's test helper, and forms are confirmed as the browser would.
// Webhooks are the real events, fetched from the Events API and signed here.
import env from "../../src/env.ts";
// before stripe.ts, as the gateway's index makes the app's adapter on loading
import {
  eventFor,
  fillCardForm,
  PAYMENT_METHOD,
  sandboxStripe,
} from "./stripe-sandbox.ts";
import { paymentGatewayContract } from "./payment-gateway.ts";
import { StripePaymentGateway } from "../../src/services/payment-gateway/stripe.ts";

const stripe = sandboxStripe(env.STRIPE_SECRET_KEY);
const gateway = new StripePaymentGateway({
  secretKey: env.STRIPE_SECRET_KEY,
  publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
});

// a webhook request as Stripe would sign it to our endpoint
const signed = (payload: string) => ({
  body: Buffer.from(payload),
  headers: {
    "stripe-signature": stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    }),
  },
});

paymentGatewayContract("StripePaymentGateway in a sandbox", () => ({
  gateway,
  enterCard: async (card) =>
    (
      await stripe.testHelpers.confirmationTokens.create({
        payment_method: PAYMENT_METHOD[card],
        setup_future_usage: "off_session",
      })
    ).id,
  fillCardForm: (secret, card) =>
    fillCardForm(stripe, secret, PAYMENT_METHOD[card]),
  abandonCardForm: async (secret) => secret.split("_secret_")[0]!,
  // what confirmPayment does in the browser, by a test bank account
  payByBankDebit: async (ref) => {
    await stripe.paymentIntents.confirm(ref, {
      payment_method: "pm_usBankAccount_processing",
      mandate_data: {
        customer_acceptance: {
          type: "online",
          online: { ip_address: "127.0.0.1", user_agent: "contract tests" },
        },
      },
    });
  },
  paymentAttempts: async (payerId) =>
    (await stripe.paymentIntents.list({ customer: payerId, limit: 100 })).data
      .length,
  // no mark of ours, as in the dashboard
  refundInDashboard: async (chargeId, amount) =>
    (await stripe.refunds.create({ payment_intent: chargeId, amount })).id,
  refundWebhook: async (refundId, became) => {
    const event =
      became === "failed"
        ? await eventFor(stripe, "refund.failed", refundId)
        : await eventFor(
            stripe,
            "refund.updated",
            refundId,
            (refund) => refund.status === "succeeded",
          );
    return signed(JSON.stringify(event));
  },
  depositWebhook: (ref) =>
    signed(
      JSON.stringify({
        id: `evt_contract_${Date.now()}`,
        object: "event",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: ref,
            object: "payment_intent",
            metadata: { purpose: "deposit" },
          },
        },
      }),
    ),
  forgedWebhook: () => ({
    body: Buffer.from(
      JSON.stringify({ id: "evt_forged", type: "payment_intent.succeeded" }),
    ),
    headers: { "stripe-signature": "t=1,v1=forged" },
  }),
}));
