import type { CardForm } from "@empire-cleaning/models";
import {
  PaymentMethodError,
  type ChargeInput,
  type ChargeResult,
  type PaymentGateway,
  type RefundInput,
  type RefundResult,
  type SavePaymentMethodInput,
} from "#services/payment-gateway";

type RecordedCharge = ChargeInput & { chargeId: string };
type RecordedRefund = RefundInput & { refundId: string };

// The card form it hands out is the web app's "test" one, which needs no
// card: its token is the form's own secret, so any secret this gave out
// saves as a card.
export class FakePaymentGateway implements PaymentGateway {
  readonly paymentMethods: (SavePaymentMethodInput & {
    paymentMethodId: string;
  })[] = [];
  readonly charges: RecordedCharge[] = [];
  readonly refunds: RecordedRefund[] = [];

  private chargeFailure: string | null = null;
  private readonly forms = new Set<string>();
  private nextId = 1;

  // every charge fails with `reason` until cleared with failCharges(null)
  failCharges(reason: string | null = "card_declined") {
    this.chargeFailure = reason;
  }

  async startCardForm(): Promise<CardForm> {
    const secret = `form_fake_${this.nextId++}`;
    this.forms.add(secret);
    return { form: "test", secret };
  }

  // a card set up in a test card form, e.g. testPayments().cardToken()
  async cardToken() {
    return (await this.startCardForm()).secret;
  }

  async savePaymentMethod(input: SavePaymentMethodInput) {
    if (!this.forms.has(input.token)) {
      throw new PaymentMethodError(
        "Your card wasn't set up. Please enter it again.",
      );
    }
    const paymentMethodId = `pm_fake_${this.nextId++}`;
    this.paymentMethods.push({ ...input, paymentMethodId });
    return { paymentMethodId, label: "Test card ending 4242" };
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (this.chargeFailure) {
      return { ok: false, reason: this.chargeFailure };
    }

    const chargeId = `ch_fake_${this.nextId++}`;
    this.charges.push({ ...input, chargeId });
    return { ok: true, chargeId };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const charge = this.charges.find((c) => c.chargeId === input.chargeId);
    if (!charge) {
      return { ok: false, reason: "unknown_charge" };
    }

    const refunded = this.refunds
      .filter((r) => r.chargeId === input.chargeId)
      .reduce((sum, r) => sum + r.amount, 0);
    if (refunded + input.amount > charge.amount) {
      return { ok: false, reason: "exceeds_charge" };
    }

    const refundId = `re_fake_${this.nextId++}`;
    this.refunds.push({ ...input, refundId });
    return { ok: true, refundId };
  }
}
