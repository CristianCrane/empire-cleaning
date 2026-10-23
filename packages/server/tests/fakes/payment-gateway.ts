import type {
  ChargeInput,
  ChargeResult,
  PaymentGateway,
  RefundInput,
  RefundResult,
  SavePaymentMethodInput,
} from "#services/payment-gateway";

type RecordedCharge = ChargeInput & { chargeId: string };
type RecordedRefund = RefundInput & { refundId: string };

export class FakePaymentGateway implements PaymentGateway {
  readonly paymentMethods: (SavePaymentMethodInput & {
    paymentMethodId: string;
  })[] = [];
  readonly charges: RecordedCharge[] = [];
  readonly refunds: RecordedRefund[] = [];

  private chargeFailure: string | null = null;
  private nextId = 1;

  // every charge fails with `reason` until cleared with failCharges(null)
  failCharges(reason: string | null = "card_declined") {
    this.chargeFailure = reason;
  }

  async savePaymentMethod(input: SavePaymentMethodInput) {
    const paymentMethodId = `pm_fake_${this.nextId++}`;
    this.paymentMethods.push({ ...input, paymentMethodId });
    return { paymentMethodId };
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
