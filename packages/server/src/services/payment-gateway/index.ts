import type { CardForm } from "@empire-cleaning/models";
import env from "../../env.ts";
import { StripePaymentGateway } from "./stripe.ts";

// amounts are integer minor units (cents)
export type SavePaymentMethodInput = {
  clientId: string;
  // the Client types their card into the payment provider's own form in the
  // browser (startCardForm); the form hands back this reference to what was
  // set up, so card numbers never reach our server. We only pass it back to
  // the provider.
  token: string;
};

export type SavedPaymentMethod = {
  paymentMethodId: string;
  // how to describe it to people, e.g. "Visa ending 4242"
  label: string;
};

export type ChargeInput = {
  paymentMethodId: string;
  amount: number;
  description: string;
};

export type RefundInput = {
  chargeId: string;
  amount: number;
};

export type ChargeResult =
  { ok: true; chargeId: string } | { ok: false; reason: string };

export type RefundResult =
  { ok: true; refundId: string } | { ok: false; reason: string };

// A provider-neutral seam (ADR-0004): nothing past it knows which provider is
// behind it, beyond which browser card form to show.
export interface PaymentGateway {
  // what the browser needs to show the provider's card form, once
  startCardForm(): Promise<CardForm>;
  // keeps what the card form set up, for charging later; throws
  // PaymentMethodError if the provider won't keep it
  savePaymentMethod(input: SavePaymentMethodInput): Promise<SavedPaymentMethod>;
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}

// the provider refused a card form's result, e.g. it was never completed;
// the message is for the Client
export class PaymentMethodError extends Error {}

let current: PaymentGateway = new StripePaymentGateway(
  env.STRIPE_SECRET_KEY,
  env.STRIPE_PUBLISHABLE_KEY,
);

export const paymentGateway: PaymentGateway = {
  startCardForm: () => current.startCardForm(),
  savePaymentMethod: (input) => current.savePaymentMethod(input),
  charge: (input) => current.charge(input),
  refund: (input) => current.refund(input),
};

// tests swap in a fake
export const setPaymentGateway = (next: PaymentGateway) => {
  current = next;
};
