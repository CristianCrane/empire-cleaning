// Records what Stripe really sends, for the adapter's own tests
// (src/services/payment-gateway/stripe.test.ts) to answer with, rather than
// replies written by hand (#241). Run it by hand, with a sandbox (sk_test_)
// key in .env, when the adapter or its pinned API version changes:
//
//   pnpm --filter @empire-cleaning/server stripe:record
//
// It makes test Customers and payments in the sandbox, and waits for a
// refund to fail, which takes Stripe about two minutes. Recordings go to
// tests/stripe-recordings/, one JSON file each.
import { mkdirSync, writeFileSync } from "node:fs";
import Stripe from "stripe";
import env from "../../src/env.ts";
// before stripe.ts, as the gateway's index makes the app's adapter on loading
import { eventFor, fillCardForm, sandboxStripe } from "./stripe-sandbox.ts";
import { StripePaymentGateway } from "../../src/services/payment-gateway/stripe.ts";

const OUT = new URL("../stripe-recordings/", import.meta.url);
const stripe = sandboxStripe(env.STRIPE_SECRET_KEY);
const gateway = new StripePaymentGateway({
  secretKey: env.STRIPE_SECRET_KEY,
  publishableKey: "pk_test_unused",
  webhookSecret: "whsec_unused",
});
const run = `record-${Date.now()}`;

// client secrets let a browser finish a payment: none are kept, though
// these are only the sandbox's
const save = (name: string, recorded: unknown) => {
  writeFileSync(
    new URL(`${name}.json`, OUT),
    `${JSON.stringify(
      recorded,
      (key, value: unknown) =>
        key === "client_secret" && value ? "redacted_secret" : value,
      2,
    )}\n`,
  );
  console.log(`recorded ${name}`);
};

const customer = async () =>
  (await stripe.customers.create({ name: "Recording", metadata: { run } })).id;

// a saved card, as the save-only card form leaves one
const savedCard = async (payerId: string, card: string) => {
  const setup = await stripe.setupIntents.create({
    customer: payerId,
    usage: "off_session",
    allowed_payment_method_types: ["card"],
  });
  await fillCardForm(stripe, setup.client_secret!, card);
  return (await stripe.setupIntents.retrieve(setup.id))
    .payment_method as string;
};

// an off-session Charge, through the adapter
const charged = async (card: string, amount = 5000) => {
  const payerId = await customer();
  const result = await gateway.charge({
    payerId,
    paymentMethodId: await savedCard(payerId, card),
    amount,
    description: "Recording: Balance",
    idempotencyKey: `${run}:${payerId}`,
  });
  if (!result.ok) throw new Error(`not charged: ${result.reason}`);
  return result.chargeId;
};

const onPage = async (card: string, reference: string) => {
  const payerId = await customer();
  const { ref } = await gateway.startBillPayment({
    payerId,
    amount: 12000,
    description: "Recording: Bill",
    reference,
    idempotencyKey: `${run}:bill:${payerId}`,
  });
  await stripe.paymentIntents
    .confirm(ref, { payment_method: card })
    .catch(() => undefined);
  return ref;
};

mkdirSync(OUT, { recursive: true });

// ---- replies ----

// a declined off-session Charge: Stripe's error, as the SDK receives it
{
  const payerId = await customer();
  const card = await savedCard(payerId, "pm_card_chargeCustomerFail");
  const error = await stripe.paymentIntents
    .create({
      amount: 4200,
      currency: "usd",
      customer: payerId,
      payment_method: card,
      allowed_payment_method_types: ["card"],
      off_session: true,
      confirm: true,
    })
    .then(() => {
      throw new Error("expected a decline");
    })
    .catch((e: unknown) => e);
  if (!(error instanceof Stripe.errors.StripeCardError)) throw error;
  save("declined-charge-error", error.raw);
}

// a PaymentIntent processing, as only a bank debit is in test mode
{
  const payerId = await customer();
  const intent = await stripe.paymentIntents.create({
    amount: 4200,
    currency: "usd",
    customer: payerId,
    allowed_payment_method_types: ["us_bank_account"],
    payment_method: "pm_usBankAccount_processing",
    mandate_data: {
      customer_acceptance: {
        type: "online",
        online: { ip_address: "127.0.0.1", user_agent: "recording" },
      },
    },
    confirm: true,
  });
  if (intent.status !== "processing") throw new Error(intent.status);
  save("processing-payment-intent", intent);
}

// a Charge's refunds, each kind: ours, and the dashboard's gone through, on
// their way, and failed
const refunded = await charged("pm_card_visa");
const ours = await stripe.refunds.create({
  payment_intent: refunded,
  amount: 1000,
  metadata: { made_by: "app" },
});
save("refund", ours);
await stripe.refunds.create({ payment_intent: refunded, amount: 500 });
const pending = await stripe.refunds.create({
  payment_intent: await charged("pm_card_pendingRefund"),
  amount: 500,
});
const failing = await stripe.refunds.create({
  payment_intent: await charged("pm_card_refundFail"),
  amount: 500,
});

// ---- webhook events ----

{
  const payerId = await customer();
  const deposit = await gateway.takeDeposit({
    payerId,
    source: {
      token: (
        await stripe.testHelpers.confirmationTokens.create({
          payment_method: "pm_card_visa",
          setup_future_usage: "off_session",
        })
      ).id,
    },
    amount: 2500,
    description: "Recording: Deposit",
    idempotencyKey: `${run}:deposit:${payerId}`,
  });
  if (deposit.status !== "succeeded") throw new Error(deposit.status);
  save(
    "event-deposit-succeeded",
    await eventFor(stripe, "payment_intent.succeeded", deposit.chargeId!),
  );
}
{
  const payerId = await customer();
  await gateway.takeDeposit({
    payerId,
    source: {
      token: (
        await stripe.testHelpers.confirmationTokens.create({
          payment_method: "pm_card_visa",
          setup_future_usage: "off_session",
        })
      ).id,
    },
    amount: 0,
    description: "Recording: 0% Deposit",
    idempotencyKey: `${run}:setup:${payerId}`,
  });
  const { data } = await stripe.setupIntents.list({
    customer: payerId,
    limit: 1,
  });
  save(
    "event-setup-deposit-succeeded",
    await eventFor(stripe, "setup_intent.succeeded", data[0]!.id),
  );
}
save(
  "event-bill-payment-succeeded",
  await eventFor(
    stripe,
    "payment_intent.succeeded",
    await onPage("pm_card_visa", "bill-paid"),
  ),
);
save(
  "event-bill-payment-failed",
  await eventFor(
    stripe,
    "payment_intent.payment_failed",
    await onPage("pm_card_chargeDeclined", "bill-declined"),
  ),
);
save(
  "event-charge-refunded",
  await eventFor(stripe, "charge.refunded", refunded),
);
{
  const disputed = await charged("pm_card_createDispute");
  save(
    "event-dispute-created",
    await eventFor(stripe, "charge.dispute.created", disputed),
  );
}
save(
  "event-customer-created",
  (await stripe.events.list({ type: "customer.created", limit: 1 })).data[0],
);
// these two take Stripe a couple of minutes
save(
  "event-refund-went-through",
  await eventFor(
    stripe,
    "refund.updated",
    pending.id,
    (refund) => refund.status === "succeeded",
  ),
);
save(
  "event-refund-failed",
  await eventFor(stripe, "refund.failed", failing.id),
);

// every refund kind: ours and the dashboard's gone through, one on its way
// as it was made, and the failing one now it's failed
save("refunds-list", [
  ...(await stripe.refunds.list({ payment_intent: refunded })).data,
  pending,
  await stripe.refunds.retrieve(failing.id),
]);
