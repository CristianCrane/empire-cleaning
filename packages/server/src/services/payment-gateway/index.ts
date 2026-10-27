import type { CardForm, PaymentForm } from "@empire-cleaning/models";
import env from "../../env.ts";
import { StripePaymentGateway } from "./stripe.ts";

// A provider-neutral seam (ADR-0004): nothing past it knows which provider is
// behind it, beyond which browser form to show. Amounts are integer minor
// units (cents); every id is an opaque string. Calls that move money take an
// idempotency key, so a retry never takes or gives it twice.

export type SavedPaymentMethod = {
  paymentMethodId: string;
  // how to describe it to people, e.g. "Visa ending 4242"
  label: string;
};

// where a Deposit comes from: what the Client just entered in the browser's
// payment form (which also saves it for later), or a Payment Method they
// saved before
export type DepositSource = { token: string } | { paymentMethodId: string };

export type DepositInput = {
  payerId: string;
  source: DepositSource;
  // 0 takes nothing, and only saves the Payment Method
  amount: number;
  description: string;
  idempotencyKey: string;
};

// how taking a Deposit went. Needing approval means the Client's bank wants
// them to approve it in the browser (e.g. 3D Secure) with `secret`; then
// `depositOutcome(ref)` says how it ended.
export type DepositAttempt =
  | {
      status: "succeeded";
      // null when nothing was taken (a 0 Deposit)
      chargeId: string | null;
      // set when the source was entered just now, and so saved by this
      saved: SavedPaymentMethod | null;
    }
  | { status: "needs_approval"; ref: string; secret: string }
  | { status: "failed"; reason: string };

export type ChargeInput = {
  payerId: string;
  paymentMethodId: string;
  amount: number;
  description: string;
  idempotencyKey: string;
};

export type RefundInput = {
  chargeId: string;
  amount: number;
  idempotencyKey: string;
};

export type ChargeResult =
  { ok: true; chargeId: string } | { ok: false; reason: string };

export type RefundResult =
  { ok: true; refundId: string } | { ok: false; reason: string };

// a Bill the Client pays on its page (ADR-0016), in the browser, by card or
// bank debit; `reference` is ours (the Bill), and comes back in its events
export type BillPaymentInput = {
  payerId: string;
  amount: number;
  description: string;
  reference: string;
  idempotencyKey: string;
};

// how a Bill payment started in the browser stands. A bank debit is
// processing for days until it clears or fails; waiting means the Client
// hasn't finished the form.
export type BillPaymentOutcome =
  | {
      status: "succeeded";
      chargeId: string;
      // what it paid, and for what: the reference it was started with
      amount: number;
      reference: string;
    }
  | { status: "processing" }
  | { status: "waiting" }
  | { status: "failed"; reason: string };

// a webhook request's headers, as Express gives them
export type EventHeaders = Record<string, string | string[] | undefined>;

// what the provider tells us happened, in our own terms
export type PaymentEvent =
  | { kind: "deposit_succeeded"; ref: string }
  | { kind: "bill_payment_succeeded"; ref: string; reference: string }
  | { kind: "bill_payment_failed"; ref: string; reference: string }
  | { kind: "charge_refunded"; chargeId: string }
  | { kind: "dispute_opened"; chargeId: string };

export interface PaymentGateway {
  // which browser form takes a payment, for the web app to show
  paymentForm(): PaymentForm;
  // the Client as the provider knows them; created once per Client
  createPayer(input: {
    clientId: string;
    name: string;
    // none for a Client the Office entered without one (#34)
    email: string | null;
  }): Promise<{ payerId: string }>;
  // a browser form that only saves a Payment Method, taking nothing
  startCardForm(payerId: string): Promise<CardForm>;
  // keeps what that form set up; throws PaymentMethodError if it wasn't
  savePaymentMethod(input: {
    payerId: string;
    token: string;
  }): Promise<SavedPaymentMethod>;
  // the Deposit, with the Client there to approve it if their bank asks
  takeDeposit(input: DepositInput): Promise<DepositAttempt>;
  // how a Deposit that needed approval ended
  depositOutcome(ref: string): Promise<DepositAttempt>;
  // a later Charge to a saved Payment Method, without the Client there
  charge(input: ChargeInput): Promise<ChargeResult>;
  // a payment the Client makes in the browser, with `secret`; `ref` asks how
  // it went
  startBillPayment(
    input: BillPaymentInput,
  ): Promise<{ ref: string; secret: string }>;
  billPaymentOutcome(ref: string): Promise<BillPaymentOutcome>;
  refund(input: RefundInput): Promise<RefundResult>;
  // checks a webhook really came from the provider (throws if not) and says
  // what it means; null for events we don't act on
  parseEvent(body: Buffer, headers: EventHeaders): PaymentEvent | null;
}

// the provider refused a form's result, e.g. it was never completed; the
// message is for the Client
export class PaymentMethodError extends Error {}

let current: PaymentGateway = new StripePaymentGateway({
  secretKey: env.STRIPE_SECRET_KEY,
  publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
});

export const paymentGateway: PaymentGateway = {
  paymentForm: () => current.paymentForm(),
  createPayer: (input) => current.createPayer(input),
  startCardForm: (payerId) => current.startCardForm(payerId),
  savePaymentMethod: (input) => current.savePaymentMethod(input),
  takeDeposit: (input) => current.takeDeposit(input),
  depositOutcome: (ref) => current.depositOutcome(ref),
  charge: (input) => current.charge(input),
  startBillPayment: (input) => current.startBillPayment(input),
  billPaymentOutcome: (ref) => current.billPaymentOutcome(ref),
  refund: (input) => current.refund(input),
  parseEvent: (body, headers) => current.parseEvent(body, headers),
};

// tests swap in a fake
export const setPaymentGateway = (next: PaymentGateway) => {
  current = next;
};
