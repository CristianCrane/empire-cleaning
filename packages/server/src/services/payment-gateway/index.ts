import type {
  Card,
  CardForm,
  Language,
  PaymentForm,
} from "@empire-cleaning/models";
import env from "../../env.ts";
import { StripePaymentGateway } from "./stripe.ts";

// A provider-neutral seam (ADR-0004): nothing past it knows which provider is
// behind it, beyond which browser form to show. Amounts are integer minor
// units (cents); every id is an opaque string. Calls that move money take an
// idempotency key, so a retry never takes or gives it twice.

export type SavedPaymentMethod = {
  paymentMethodId: string;
  // its brand and last 4, for people to know it by
  card: Card;
};

// where a Deposit comes from: what the Client just entered in the browser's
// payment form (which also saves it for later), or a Payment Method they
// saved before
type DepositSource = { token: string } | { paymentMethodId: string };

export type DepositInput = {
  payerId: string;
  source: DepositSource;
  // 0 takes nothing, and only saves the Payment Method
  amount: number;
  description: string;
  idempotencyKey: string;
};

// How a payment stands, as the provider says, whichever call made it: a
// Deposit or a Bill paid on its page, with the Client there, or a Charge to
// a saved card without them (#534, one status from the provider to the
// screen).
// - taken: the money's ours, or the card's saved (a 0 Deposit)
// - approving: the Client's bank wants them to approve it in the browser
//   (e.g. 3D Secure) with `secret`; then paymentOutcome(ref) says how it
//   ended. It can still be called off
// - finishing: going through, with nothing more to ask of anyone, and too
//   far on to call off: by "card", which settles soon, or by "bank", a bank
//   debit, for days until it clears or fails. A Bill's page says the two
//   apart (#534's critical review C6)
// - failed: never taken, and why
export type PaymentResult =
  | {
      status: "taken";
      // null when nothing was taken (a 0 Deposit)
      chargeId: string | null;
      // set when the source was entered just now, and so saved by this
      saved: SavedPaymentMethod | null;
    }
  | { status: "approving"; ref: string; secret: string }
  | { status: "finishing"; ref: string; by: "card" | "bank" }
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

// how to find a Charge asked for before: by its id, once known, or else by
// the idempotency key it was asked with, at or after `since`
export type ChargeLookup = {
  payerId: string;
  idempotencyKey: string;
  chargeId: string | null;
  since: Date;
};

export type RefundResult =
  { ok: true; refundId: string } | { ok: false; reason: string };

// how to find a refund asked for before: by the idempotency key it was
// asked with, among its Charge's
export type RefundLookup = { chargeId: string; idempotencyKey: string };

// a refund of a Charge that wasn't made by refund(), e.g. in the provider's
// dashboard
export type RefundElsewhere = { refundId: string; amount: number; at: Date };

// a Bill the Client pays on its page (ADR-0016), by a card or bank account
// entered just now in the browser's payment form, which saves neither;
// `reference` is ours (the Bill), and comes back in its events
export type BillInput = {
  payerId: string;
  token: string;
  amount: number;
  description: string;
  reference: string;
  idempotencyKey: string;
};

// a webhook request's headers, as Express gives them
export type EventHeaders = Record<string, string | string[] | undefined>;

// what the provider tells us happened, in our own terms
export type PaymentEvent =
  | { kind: "deposit_succeeded"; ref: string }
  | { kind: "bill_payment_succeeded"; ref: string; reference: string }
  | { kind: "bill_payment_failed"; ref: string; reference: string }
  // a Charge's refunds changed: one was made, or one on its way went through
  | { kind: "charge_refunded"; chargeId: string }
  // a refund, ours or one made in the dashboard, failed after it was made:
  // the money wasn't given back
  | { kind: "refund_failed"; chargeId: string; refundId: string }
  | { kind: "dispute_opened"; chargeId: string };

// why a payment waiting on the Client's bank is called off
export type CallingOff = "client_retried" | "abandoned";

export interface PaymentGateway {
  // which browser form takes a payment, for the web app to show
  paymentForm(): PaymentForm;
  // the Client as the provider knows them; created once per Client
  createPayer(input: {
    clientId: string;
    name: string;
    // none for a Client the Office entered without one (#34)
    email: string | null;
    // their Preferred Language, which the provider's own pages and emails
    // follow (ADR-0025)
    language: Language;
  }): Promise<{ payerId: string }>;
  // the Client's Preferred Language changed, by them or the Office
  setPayerLanguage(payerId: string, language: Language): Promise<void>;
  // a browser form that only saves a Payment Method, taking nothing
  startCardForm(payerId: string): Promise<CardForm>;
  // keeps what that form set up; throws PaymentMethodError if it wasn't
  savePaymentMethod(input: {
    payerId: string;
    token: string;
  }): Promise<SavedPaymentMethod>;
  // the Deposit, with the Client there to approve it if their bank asks
  takeDeposit(input: DepositInput): Promise<PaymentResult>;
  // a Bill paid on its page, likewise; a bank debit is finishing until it
  // clears or fails, days later, which its events tell
  payBill(input: BillInput): Promise<PaymentResult>;
  // how a payment made with the Client there, that needed approval or was
  // finishing, stands now, with the card it saved
  paymentOutcome(ref: string): Promise<PaymentResult>;
  // calls off a payment waiting on the Client's bank, or one it refused, so
  // it's never taken, or a 0 Deposit's card save, so it's never saved:
  // because the Client tried again, or nobody came back to approve it.
  // Throws if it can't be (taken, or a card's still processing): then
  // paymentOutcome(ref) says how it stands
  cancelPayment(ref: string, why: CallingOff): Promise<void>;
  // a later Charge to a saved Payment Method, without the Client there
  charge(input: ChargeInput): Promise<PaymentResult>;
  // how any payment stands whose reply never came, or that was finishing,
  // with no card read as saved (paymentOutcome reads that); null if the
  // provider never made it. Asks afresh, unlike repeating its idempotency
  // key, which only replays the first reply
  chargeOutcome(lookup: ChargeLookup): Promise<PaymentResult | null>;
  refund(input: RefundInput): Promise<RefundResult>;
  // a refund whose reply never came, as the provider has it now; null if it
  // was never made
  refundOutcome(lookup: RefundLookup): Promise<RefundResult | null>;
  // a Charge's refunds made outside the app, as far as they've gone through
  // or are on their way
  refundsElsewhere(chargeId: string): Promise<RefundElsewhere[]>;
  // checks a webhook really came from the provider (throws if not) and says
  // what it means; null for events we don't act on
  parseEvent(body: Buffer, headers: EventHeaders): PaymentEvent | null;
}

// the provider refused a form's result, e.g. it was never completed; the
// message is for the logs, and payments.ts words it for the Client
export class PaymentMethodError extends Error {}

let current: PaymentGateway = new StripePaymentGateway({
  secretKey: env.STRIPE_SECRET_KEY,
  publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
});

export const paymentGateway: PaymentGateway = {
  paymentForm: () => current.paymentForm(),
  createPayer: (input) => current.createPayer(input),
  setPayerLanguage: (payerId, language) =>
    current.setPayerLanguage(payerId, language),
  startCardForm: (payerId) => current.startCardForm(payerId),
  savePaymentMethod: (input) => current.savePaymentMethod(input),
  takeDeposit: (input) => current.takeDeposit(input),
  payBill: (input) => current.payBill(input),
  paymentOutcome: (ref) => current.paymentOutcome(ref),
  cancelPayment: (ref, why) => current.cancelPayment(ref, why),
  charge: (input) => current.charge(input),
  chargeOutcome: (lookup) => current.chargeOutcome(lookup),
  refund: (input) => current.refund(input),
  refundOutcome: (lookup) => current.refundOutcome(lookup),
  refundsElsewhere: (chargeId) => current.refundsElsewhere(chargeId),
  parseEvent: (body, headers) => current.parseEvent(body, headers),
};

// tests swap in a fake
export const setPaymentGateway = (next: PaymentGateway) => {
  current = next;
};
