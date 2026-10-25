import Stripe from "stripe";
import type { CardForm } from "@empire-cleaning/models";
import {
  PaymentMethodError,
  type ChargeInput,
  type ChargeResult,
  type PaymentGateway,
  type RefundInput,
  type RefundResult,
  type SavePaymentMethodInput,
} from "./index.ts";

// Stripe behind our Payment Gateway (ADR-0004). Nothing Stripe-shaped leaves
// this file: its ids are opaque strings to everyone else.
//
// A card is set up in the browser with a SetupIntent for later off-session
// use (the Deposit now, the Balance when the Job is Completed), then kept on
// a Stripe Customer of its own, labelled with our Client's id. Charging finds
// that Customer from the card, so we hold only the card's id.
export class StripePaymentGateway implements PaymentGateway {
  private readonly stripe: Stripe;
  private readonly publishableKey: string;

  constructor(secretKey: string, publishableKey: string) {
    this.stripe = new Stripe(secretKey);
    this.publishableKey = publishableKey;
  }

  async startCardForm(): Promise<CardForm> {
    const setup = await this.stripe.setupIntents.create({
      usage: "off_session",
      allowed_payment_method_types: ["card"],
    });
    return {
      form: "stripe",
      publishableKey: this.publishableKey,
      secret: setup.client_secret!,
    };
  }

  // the token is the SetupIntent the browser confirmed
  async savePaymentMethod({ clientId, token }: SavePaymentMethodInput) {
    const setup = await this.stripe.setupIntents
      .retrieve(token, { expand: ["payment_method"] })
      .catch(() => null);
    const card = setup?.payment_method;
    if (setup?.status !== "succeeded" || !card || typeof card === "string") {
      throw new PaymentMethodError(
        "Your card wasn't set up. Please enter it again.",
      );
    }

    const customer = await this.stripe.customers.create({
      metadata: { clientId },
    });
    await this.stripe.paymentMethods.attach(card.id, { customer: customer.id });

    const brand = card.card?.display_brand ?? card.card?.brand ?? "Card";
    const label = `${brand[0]!.toUpperCase()}${brand.slice(1).replaceAll("_", " ")} ending ${card.card?.last4 ?? "????"}`;
    return { paymentMethodId: card.id, label };
  }

  async charge({
    paymentMethodId,
    amount,
    description,
  }: ChargeInput): Promise<ChargeResult> {
    try {
      const card = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      const customer =
        typeof card.customer === "string" ? card.customer : card.customer?.id;
      const intent = await this.stripe.paymentIntents.create({
        amount,
        currency: "usd",
        customer,
        payment_method: paymentMethodId,
        description,
        off_session: true,
        confirm: true,
      });
      return intent.status === "succeeded"
        ? { ok: true, chargeId: intent.id }
        : { ok: false, reason: intent.status };
    } catch (error) {
      // declined, or the bank wants the cardholder there to approve it
      // (authentication_required): either way, not charged
      if (error instanceof Stripe.errors.StripeError) {
        return {
          ok: false,
          reason: error.decline_code ?? error.code ?? error.type,
        };
      }
      throw error;
    }
  }

  async refund({ chargeId, amount }: RefundInput): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: chargeId,
        amount,
      });
      return refund.status === "failed" || refund.status === "canceled"
        ? { ok: false, reason: refund.failure_reason ?? refund.status }
        : { ok: true, refundId: refund.id };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        return { ok: false, reason: error.code ?? error.type };
      }
      throw error;
    }
  }
}
