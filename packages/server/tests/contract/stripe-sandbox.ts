// What every run against a Stripe sandbox shares: the contract on the real
// adapter (stripe.sandbox.test.ts), the recordings (record-stripe.ts) and
// the e2e API's sandbox run (tests/harness.ts). Each refuses any key but a
// test-mode one, before its first call to Stripe.
import Stripe from "stripe";
import { MINUTE_MS } from "@empire-cleaning/models";
// before stripe.ts: the gateway's index makes the app's adapter on loading,
// so it has to load first
import "../../src/services/payment-gateway/index.ts";
import { API_VERSION } from "../../src/services/payment-gateway/stripe.ts";
import type { TestCard } from "./payment-gateway.ts";

// the secret key, once it's shown to be a sandbox's (sk_test_)
const testModeKey = (secretKey: string) => {
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error(
      "refusing to run: the Stripe secret key isn't a test-mode key",
    );
  }
  return secretKey;
};

// Stripe's API in the sandbox, at the version the adapter pins
export const sandboxStripe = (secretKey: string) =>
  new Stripe(testModeKey(secretKey), { apiVersion: API_VERSION });

// Stripe's test PaymentMethods for each (docs.stripe.com/testing)
export const PAYMENT_METHOD: Record<TestCard, string> = {
  visa: "pm_card_visa",
  mastercard: "pm_card_mastercard",
  amex: "pm_card_amex",
  insufficientFunds: "pm_card_visa_chargeDeclinedInsufficientFunds",
  declinesLater: "pm_card_chargeCustomerFail",
  approvalOnSetup: "pm_card_authenticationRequiredOnSetup",
  alwaysApproval: "pm_card_authenticationRequired",
  refundFails: "pm_card_refundFail",
  refundPending: "pm_card_pendingRefund",
};

// what Stripe.js's confirmSetup does in the browser, with one of Stripe's
// test PaymentMethods: the save-only card form's SetupIntent (its client
// secret) confirmed. Its id is the token our server keeps the card by
export const fillCardForm = async (
  stripe: Stripe,
  secret: string,
  paymentMethod: string,
) => {
  const setupId = secret.split("_secret_")[0]!;
  await stripe.setupIntents.confirm(setupId, { payment_method: paymentMethod });
  return setupId;
};

// Stripe's event of `type` about `objectId` (the object's own id, or its
// PaymentIntent's), once it's been sent, waiting up to `within`
export const eventFor = async (
  stripe: Stripe,
  type: string,
  objectId: string,
  matches: (object: Record<string, unknown>) => boolean = () => true,
  within = 5 * MINUTE_MS,
) => {
  const deadline = Date.now() + within;
  for (;;) {
    const { data } = await stripe.events.list({ type, limit: 50 });
    const event = data.find((e) => {
      const object = e.data.object as unknown as Record<string, unknown>;
      return (
        (object.id === objectId || object.payment_intent === objectId) &&
        matches(object)
      );
    });
    if (event) return event;
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(
    `no ${type} event for ${objectId} within ${within / MINUTE_MS} minutes`,
  );
};

// How long the sandbox can take to fail a refund of pm_card_refundFail.
// Stripe says only "after a few minutes" (docs.stripe.com/testing, Refunds):
// it took 124 to 155 s in 33 runs, then 1030 s and 1792 s on 11-21 and
// 11-22, every event for those refunds late with it (#528)
export const REFUND_FAILS_WITHIN = 35 * MINUTE_MS;

// Stripe's refund.failed event for refund `refundId`, once it's been sent
export const refundFailedEvent = (stripe: Stripe, refundId: string) =>
  eventFor(stripe, "refund.failed", refundId, undefined, REFUND_FAILS_WITHIN);
