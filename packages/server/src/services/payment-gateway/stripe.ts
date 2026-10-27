import Stripe from "stripe";
import type { CardForm, PaymentForm } from "@empire-cleaning/models";
import {
  PaymentMethodError,
  type BillPaymentInput,
  type BillPaymentOutcome,
  type ChargeInput,
  type ChargeResult,
  type DepositAttempt,
  type DepositInput,
  type EventHeaders,
  type PaymentEvent,
  type PaymentGateway,
  type RefundInput,
  type RefundResult,
  type SavedPaymentMethod,
} from "./index.ts";

// pinned, so a Stripe upgrade never changes behaviour without a code change
const API_VERSION = "2026-09-30.endive";

// Cards only, deliberately not Stripe's dynamic payment methods: slower
// methods such as bank debits settle days later, which would break "the
// Deposit succeeds before anything is booked" (ADR-0001, ADR-0008). Link is
// left out too, as it also offers bank payments. The web app's Payment
// Element allows the same.
const ALLOWED: "card"[] = ["card"];

// marks our Deposits, so webhooks can tell them from anything else
const DEPOSIT = { purpose: "deposit" };
// and our Bill payments
const BILL = "bill";

// A Bill is paid on its page by card or ACH Direct Debit (ADR-0016): nothing
// waits on a Bill payment clearing, so a bank debit's days are no matter
const BILL_ALLOWED: ("card" | "us_bank_account")[] = [
  "card",
  "us_bank_account",
];

// Stripe behind our Payment Gateway (ADR-0004, ADR-0008). Nothing Stripe-shaped
// leaves this file: its ids are opaque strings to everyone else, and its
// events become PaymentEvents.
//
// - A payer is a Stripe Customer, one per Client.
// - The Deposit is a PaymentIntent confirmed here, on-session, from the
//   ConfirmationToken the browser's Payment Element made; setup_future_usage
//   saves the card on the Customer by the same payment. A 0 Deposit is a
//   SetupIntent confirmed the same way. If the bank wants the Client to
//   approve it (3D Secure), the browser runs handleNextAction with the
//   client secret and we ask again how it ended.
// - Later Charges (the Office recording acceptance, the Balance) are
//   off-session PaymentIntents on the saved card.
// - A Bill paid on its page is a PaymentIntent the browser confirms, by card
//   or bank debit; a bank debit is processing until it clears, which a
//   webhook tells us.
// - Our charge ids are PaymentIntent ids.
export class StripePaymentGateway implements PaymentGateway {
  private readonly stripe: Stripe;
  private readonly publishableKey: string;
  private readonly webhookSecret: string;

  constructor(keys: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
  }) {
    this.stripe = new Stripe(keys.secretKey, { apiVersion: API_VERSION });
    this.publishableKey = keys.publishableKey;
    this.webhookSecret = keys.webhookSecret;
  }

  paymentForm(): PaymentForm {
    return { form: "stripe", publishableKey: this.publishableKey };
  }

  async createPayer({
    clientId,
    name,
    email,
  }: {
    clientId: string;
    name: string;
    email: string | null;
  }) {
    const customer = await this.stripe.customers.create(
      { name, email: email ?? undefined, metadata: { clientId } },
      { idempotencyKey: `customer:${clientId}` },
    );
    return { payerId: customer.id };
  }

  async startCardForm(payerId: string): Promise<CardForm> {
    const setup = await this.stripe.setupIntents.create({
      customer: payerId,
      usage: "off_session",
      allowed_payment_method_types: ALLOWED,
    });
    return { ...this.paymentForm(), secret: setup.client_secret! };
  }

  // the token is the SetupIntent the browser confirmed
  async savePaymentMethod({
    payerId,
    token,
  }: {
    payerId: string;
    token: string;
  }): Promise<SavedPaymentMethod> {
    const setup = await this.stripe.setupIntents
      .retrieve(token, { expand: ["payment_method"] })
      .catch(() => null);
    const method = setup?.payment_method;
    if (
      setup?.status !== "succeeded" ||
      setup.customer !== payerId ||
      !method ||
      typeof method === "string"
    ) {
      throw new PaymentMethodError(
        "Your card wasn't set up. Please enter it again.",
      );
    }
    return saved(method);
  }

  async takeDeposit({
    payerId,
    source,
    amount,
    description,
    idempotencyKey,
  }: DepositInput): Promise<DepositAttempt> {
    const confirmFrom =
      "token" in source
        ? { confirmation_token: source.token }
        : { payment_method: source.paymentMethodId };
    try {
      if (amount === 0) {
        const setup = await this.stripe.setupIntents.create(
          {
            customer: payerId,
            usage: "off_session",
            allowed_payment_method_types: ALLOWED,
            confirm: true,
            ...confirmFrom,
            description,
            metadata: DEPOSIT,
            expand: ["payment_method"],
          },
          { idempotencyKey },
        );
        return outcomeOf(setup, "token" in source);
      }
      const intent = await this.stripe.paymentIntents.create(
        {
          amount,
          currency: "usd",
          customer: payerId,
          allowed_payment_method_types: ALLOWED,
          confirm: true,
          ...confirmFrom,
          // a card entered now is saved by this payment, for later Charges
          ...("token" in source && { setup_future_usage: "off_session" }),
          description,
          metadata: DEPOSIT,
          expand: ["payment_method"],
        },
        { idempotencyKey },
      );
      return outcomeOf(intent, "token" in source);
    } catch (error) {
      return { status: "failed", reason: reasonOf(error, "a Deposit") };
    }
  }

  async depositOutcome(ref: string): Promise<DepositAttempt> {
    // only a card entered just now can need approval and be saved by it,
    // except a saved card's on-session Deposit, which saves nothing new
    const intent = ref.startsWith("seti_")
      ? await this.stripe.setupIntents.retrieve(ref, {
          expand: ["payment_method"],
        })
      : await this.stripe.paymentIntents.retrieve(ref, {
          expand: ["payment_method"],
        });
    const savesCard =
      intent.object === "setup_intent" ||
      intent.setup_future_usage === "off_session";
    return outcomeOf(intent, savesCard);
  }

  async charge({
    payerId,
    paymentMethodId,
    amount,
    description,
    idempotencyKey,
  }: ChargeInput): Promise<ChargeResult> {
    try {
      const intent = await this.stripe.paymentIntents.create(
        {
          amount,
          currency: "usd",
          customer: payerId,
          payment_method: paymentMethodId,
          allowed_payment_method_types: ALLOWED,
          description,
          off_session: true,
          confirm: true,
        },
        { idempotencyKey },
      );
      return intent.status === "succeeded"
        ? { ok: true, chargeId: intent.id }
        : { ok: false, reason: intent.status };
    } catch (error) {
      // declined, or the bank wants the cardholder there to approve it
      // (authentication_required): either way, not charged
      return { ok: false, reason: reasonOf(error, "a Charge") };
    }
  }

  async startBillPayment({
    payerId,
    amount,
    description,
    reference,
    idempotencyKey,
  }: BillPaymentInput) {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount,
        currency: "usd",
        customer: payerId,
        allowed_payment_method_types: BILL_ALLOWED,
        description,
        metadata: { purpose: BILL, reference },
      },
      { idempotencyKey },
    );
    return { ref: intent.id, secret: intent.client_secret! };
  }

  async billPaymentOutcome(ref: string): Promise<BillPaymentOutcome> {
    const intent = await this.stripe.paymentIntents.retrieve(ref);
    switch (intent.status) {
      case "succeeded":
        return {
          status: "succeeded",
          chargeId: intent.id,
          amount: intent.amount_received,
          reference: intent.metadata?.reference ?? "",
        };
      case "processing":
        return { status: "processing" };
      case "canceled":
        return { status: "failed", reason: "canceled" };
      default: {
        // a failed attempt leaves it waiting for another payment method
        const error = intent.last_payment_error;
        return error
          ? {
              status: "failed",
              reason: error.decline_code ?? error.code ?? intent.status,
            }
          : { status: "waiting" };
      }
    }
  }

  async refund({
    chargeId,
    amount,
    idempotencyKey,
  }: RefundInput): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create(
        { payment_intent: chargeId, amount },
        { idempotencyKey },
      );
      return refund.status === "failed" || refund.status === "canceled"
        ? { ok: false, reason: refund.failure_reason ?? refund.status }
        : { ok: true, refundId: refund.id };
    } catch (error) {
      return { ok: false, reason: reasonOf(error, "a refund") };
    }
  }

  parseEvent(body: Buffer, headers: EventHeaders): PaymentEvent | null {
    const signature = headers["stripe-signature"];
    if (typeof signature !== "string") {
      throw new Error("the webhook isn't signed");
    }
    // throws if the signature doesn't match
    const event = this.stripe.webhooks.constructEvent(
      body,
      signature,
      this.webhookSecret,
    );
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        if (intent.metadata?.purpose === BILL) {
          return {
            kind: "bill_payment_succeeded",
            ref: intent.id,
            reference: intent.metadata.reference ?? "",
          };
        }
        return intent.metadata?.purpose === DEPOSIT.purpose
          ? { kind: "deposit_succeeded", ref: intent.id }
          : null;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        return intent.metadata?.purpose === BILL
          ? {
              kind: "bill_payment_failed",
              ref: intent.id,
              reference: intent.metadata.reference ?? "",
            }
          : null;
      }
      case "setup_intent.succeeded": {
        const intent = event.data.object;
        return intent.metadata?.purpose === DEPOSIT.purpose
          ? { kind: "deposit_succeeded", ref: intent.id }
          : null;
      }
      case "charge.refunded": {
        const chargeId = idOf(event.data.object.payment_intent);
        return chargeId ? { kind: "charge_refunded", chargeId } : null;
      }
      case "charge.dispute.created": {
        const chargeId = idOf(event.data.object.payment_intent);
        return chargeId ? { kind: "dispute_opened", chargeId } : null;
      }
      default:
        return null;
    }
  }
}

const idOf = (ref: string | { id: string } | null | undefined) =>
  typeof ref === "string" ? ref : (ref?.id ?? null);

// "Visa ending 4242"; "american_express" -> "American Express"
const labelOf = (method: Stripe.PaymentMethod) => {
  const brand = (method.card?.display_brand ?? method.card?.brand ?? "card")
    .split("_")
    .map((word) => `${word[0]!.toUpperCase()}${word.slice(1)}`)
    .join(" ");
  return `${brand} ending ${method.card?.last4 ?? "????"}`;
};

const saved = (method: Stripe.PaymentMethod): SavedPaymentMethod => ({
  paymentMethodId: method.id,
  label: labelOf(method),
});

const outcomeOf = (
  intent: Stripe.PaymentIntent | Stripe.SetupIntent,
  savesCard: boolean,
): DepositAttempt => {
  const method = intent.payment_method;
  switch (intent.status) {
    case "succeeded":
      return {
        status: "succeeded",
        chargeId: intent.object === "payment_intent" ? intent.id : null,
        saved:
          savesCard && method && typeof method !== "string"
            ? saved(method)
            : null,
      };
    // the bank wants the Client to approve it; processing is rare for cards
    // and settles soon, so it's waited on the same way
    case "requires_action":
    case "processing":
      return {
        status: "needs_approval",
        ref: intent.id,
        secret: intent.client_secret!,
      };
    default: {
      const error =
        intent.object === "payment_intent"
          ? intent.last_payment_error
          : intent.last_setup_error;
      return {
        status: "failed",
        reason: error?.decline_code ?? error?.code ?? intent.status,
      };
    }
  }
};

// Stripe's short code for why it refused, which callers pass on; its full
// message (e.g. "No such customer: 'cus_123'") goes to the log, for us
const reasonOf = (error: unknown, what: string) => {
  if (error instanceof Stripe.errors.StripeError) {
    console.error(`Stripe refused ${what}: ${error.message}`);
    return error.decline_code ?? error.code ?? error.type;
  }
  throw error;
};
