// Exercises the real Stripe adapter against a Stripe sandbox, with Stripe's
// test cards: the paths the fake stands in for everywhere else. Run by hand
// with sandbox (sk_test_) keys in .env:
//
//   pnpm --filter @empire-cleaning/server stripe:sandbox
//
// It makes test Customers and payments in the sandbox, and refunds what it
// takes. The browser's part (the Payment Element, 3D Secure) can't run here:
// ConfirmationTokens come from Stripe's test helper instead.
import Stripe from "stripe";
import env from "../src/env.ts";
import { PaymentMethodError } from "../src/services/payment-gateway/index.ts";
import { StripePaymentGateway } from "../src/services/payment-gateway/stripe.ts";

if (!env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  throw new Error("refusing to run: STRIPE_SECRET_KEY isn't a test-mode key");
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const gateway = new StripePaymentGateway({
  secretKey: env.STRIPE_SECRET_KEY,
  publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
});
const run = `${Date.now()}`;

let failures = 0;
const check = (what: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`, ok ? "" : detail);
};

// what the browser's Payment Element would hand over for this test card
const tokenFor = async (
  paymentMethod: string,
  setupFutureUsage?: "off_session",
) =>
  (
    await stripe.testHelpers.confirmationTokens.create({
      payment_method: paymentMethod,
      ...(setupFutureUsage && { setup_future_usage: setupFutureUsage }),
    })
  ).id;

const clientId = `sandbox-check-${run}`;
const { payerId } = await gateway.createPayer({
  clientId,
  name: "Sandbox Check",
  email: "sandbox-check@example.com",
});
const again = await gateway.createPayer({
  clientId,
  name: "Sandbox Check",
  email: "sandbox-check@example.com",
});
check(
  "a Client's payer is created once (idempotent)",
  again.payerId === payerId,
);

// 1. the Deposit from a card entered now, which saves it
const deposit = await gateway.takeDeposit({
  payerId,
  source: { token: await tokenFor("pm_card_visa", "off_session") },
  amount: 2500,
  description: "Sandbox check: Deposit",
  idempotencyKey: `deposit:${run}:visa`,
});
check(
  "Deposit with 4242 succeeds and saves the card",
  deposit.status === "succeeded" &&
    deposit.chargeId !== null &&
    deposit.saved?.label === "Visa ending 4242",
  deposit,
);
const savedCard =
  deposit.status === "succeeded" ? deposit.saved!.paymentMethodId : "";

// 2. a later off-session Charge to it
const charge = await gateway.charge({
  payerId,
  paymentMethodId: savedCard,
  amount: 7500,
  description: "Sandbox check: Balance",
  idempotencyKey: `balance:${run}`,
});
check("an off-session Charge to the saved card succeeds", charge.ok, charge);

// 3. refunds, idempotently
if (charge.ok) {
  const refund = () =>
    gateway.refund({
      chargeId: charge.chargeId,
      amount: 7500,
      idempotencyKey: `refund:${charge.chargeId}`,
    });
  const [first, second] = [await refund(), await refund()];
  check(
    "a refund repeated with the same key refunds once",
    first.ok && second.ok && first.refundId === second.refundId,
    { first, second },
  );
}

// 4. an on-session Deposit from the saved card saves nothing new
const fromSaved = await gateway.takeDeposit({
  payerId,
  source: { paymentMethodId: savedCard },
  amount: 1000,
  description: "Sandbox check: Deposit from a saved card",
  idempotencyKey: `deposit:${run}:saved`,
});
check(
  "a Deposit from the saved card succeeds",
  fromSaved.status === "succeeded" && fromSaved.saved === null,
  fromSaved,
);

// 5. declined (4000000000009995, insufficient funds)
const declined = await gateway.takeDeposit({
  payerId,
  source: {
    token: await tokenFor(
      "pm_card_visa_chargeDeclinedInsufficientFunds",
      "off_session",
    ),
  },
  amount: 2500,
  description: "Sandbox check: declined Deposit",
  idempotencyKey: `deposit:${run}:declined`,
});
check(
  "a declined card fails with its reason",
  declined.status === "failed" && declined.reason === "insufficient_funds",
  declined,
);

// 6. needs 3D Secure (4000002500003155)
const approval = await gateway.takeDeposit({
  payerId,
  source: {
    token: await tokenFor(
      "pm_card_authenticationRequiredOnSetup",
      "off_session",
    ),
  },
  amount: 2500,
  description: "Sandbox check: Deposit needing approval",
  idempotencyKey: `deposit:${run}:3ds`,
});
check(
  "a card needing 3D Secure asks for approval, with a client secret",
  approval.status === "needs_approval" && approval.secret.length > 0,
  approval,
);
if (approval.status === "needs_approval") {
  const outcome = await gateway.depositOutcome(approval.ref);
  check(
    "until it's approved, it still needs approval",
    outcome.status === "needs_approval",
    outcome,
  );
}

// 7. a 0 Deposit only saves the card
const setupOnly = await gateway.takeDeposit({
  payerId,
  source: { token: await tokenFor("pm_card_mastercard", "off_session") },
  amount: 0,
  description: "Sandbox check: 0% Deposit",
  idempotencyKey: `deposit:${run}:zero`,
});
check(
  "a 0 Deposit saves the card and takes nothing",
  setupOnly.status === "succeeded" &&
    setupOnly.chargeId === null &&
    setupOnly.saved?.label === "Mastercard ending 4444",
  setupOnly,
);

// 8. the save-only card form (the add-a-card link page)
const form = await gateway.startCardForm(payerId);
const setupId = form.secret.split("_secret_")[0]!;
try {
  await gateway.savePaymentMethod({ payerId, token: setupId });
  check("an unfinished card form isn't saved", false);
} catch (error) {
  check(
    "an unfinished card form isn't saved",
    error instanceof PaymentMethodError,
    error,
  );
}
// what confirmSetup does in the browser
await stripe.setupIntents.confirm(setupId, { payment_method: "pm_card_amex" });
const kept = await gateway.savePaymentMethod({ payerId, token: setupId });
check(
  "a finished card form is saved",
  kept.label === "American Express ending 8431",
  kept,
);

// 9. off-session, a card that always wants its holder there fails plainly
const alwaysAuth = await gateway.takeDeposit({
  payerId,
  source: {
    token: await tokenFor("pm_card_authenticationRequired", "off_session"),
  },
  amount: 0,
  description: "Sandbox check: save a card that always authenticates",
  idempotencyKey: `deposit:${run}:always`,
});
check(
  "saving a card that always authenticates needs approval",
  alwaysAuth.status === "needs_approval",
  alwaysAuth,
);

// 10. webhooks: signed events become ours; unsigned ones are refused
const payload = JSON.stringify({
  id: `evt_${run}`,
  object: "event",
  type: "payment_intent.succeeded",
  api_version: "2026-09-30.endive",
  data: {
    object: {
      id: "pi_sandbox",
      object: "payment_intent",
      metadata: { purpose: "deposit" },
    },
  },
});
const signature = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: env.STRIPE_WEBHOOK_SECRET,
});
const event = gateway.parseEvent(Buffer.from(payload), {
  "stripe-signature": signature,
});
check(
  "a signed payment_intent.succeeded for a Deposit is deposit_succeeded",
  event?.kind === "deposit_succeeded" && event.ref === "pi_sandbox",
  event,
);
try {
  gateway.parseEvent(Buffer.from(payload), {
    "stripe-signature": "t=1,v1=forged",
  });
  check("a forged signature is refused", false);
} catch {
  check("a forged signature is refused", true);
}

// tidy up: give back the Deposits taken
for (const attempt of [deposit, fromSaved]) {
  if (attempt.status === "succeeded" && attempt.chargeId) {
    await gateway.refund({
      chargeId: attempt.chargeId,
      amount: attempt === deposit ? 2500 : 1000,
      idempotencyKey: `refund:${attempt.chargeId}`,
    });
  }
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
