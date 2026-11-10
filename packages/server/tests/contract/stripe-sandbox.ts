// What every run against a Stripe sandbox shares: the contract on the real
// adapter (stripe.sandbox.test.ts), the recordings (record-stripe.ts) and
// the e2e API's sandbox run (tests/harness.ts). Each refuses any key but a
// test-mode one, before its first call to Stripe.
import Stripe from "stripe";
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
