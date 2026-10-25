import type { CardForm, PaymentForm } from "@empire-cleaning/models";
import {
  PaymentMethodError,
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
} from "#services/payment-gateway";

type RecordedCharge = {
  payerId: string;
  paymentMethodId: string | null;
  amount: number;
  description: string;
  chargeId: string;
};
type RecordedRefund = RefundInput & { refundId: string };

// what the Client's bank does when it asks them to approve a Deposit
export type Approval = "approved" | "refused" | "pending";

// what a webhook from the fake carries; its signature header must match
export const FAKE_SIGNATURE = "fake-signature";

/**
 * Stands in for the payment provider. Its browser form is the web app's
 * "test" one, which needs no card: a card "entered" there is any token
 * starting `tok_test` (paymentToken() makes one). The save-only card form's
 * token is the form's own secret.
 */
export class FakePaymentGateway implements PaymentGateway {
  readonly payers: { clientId: string; payerId: string }[] = [];
  readonly paymentMethods: (SavedPaymentMethod & { payerId: string })[] = [];
  readonly charges: RecordedCharge[] = [];
  readonly refunds: RecordedRefund[] = [];

  private chargeFailure: string | null = null;
  private approval: Approval | null = null;
  private down = false;
  private readonly forms = new Set<string>();
  private readonly waiting = new Map<string, DepositInput>();
  private readonly replies = new Map<string, unknown>();
  private nextId = 1;

  // every Charge and Deposit is declined with `reason` until failCharges(null)
  failCharges(reason: string | null = "card_declined") {
    this.chargeFailure = reason;
  }

  // a card entered just now needs its holder's approval from now on, which
  // their bank then gives, refuses, or is still waiting on; null to stop
  requireApproval(then: Approval | null = "approved") {
    this.approval = then;
  }

  // every call throws, as when the provider can't be reached, until
  // goDown(false)
  goDown(isDown = true) {
    this.down = isDown;
  }

  // a card "entered" in the test payment form
  paymentToken() {
    return `tok_test_${this.nextId++}`;
  }

  // a card set up in the save-only card form, for any payer
  async cardToken() {
    return (await this.startCardForm("any")).secret;
  }

  private id(prefix: string) {
    return `${prefix}_fake_${this.nextId++}`;
  }

  private check() {
    if (this.down) throw new Error("the payment provider can't be reached");
  }

  // a repeated idempotency key gets the first reply, as at the provider
  private async once<T>(key: string, reply: () => Promise<T> | T) {
    if (!this.replies.has(key)) this.replies.set(key, await reply());
    return this.replies.get(key) as T;
  }

  private save(payerId: string): SavedPaymentMethod {
    const saved = {
      paymentMethodId: this.id("pm"),
      label: "Test card ending 4242",
    };
    this.paymentMethods.push({ ...saved, payerId });
    return saved;
  }

  private take(input: DepositInput, paymentMethodId: string | null) {
    const chargeId = input.amount > 0 ? this.id("pi") : null;
    if (chargeId) {
      this.charges.push({
        payerId: input.payerId,
        paymentMethodId,
        amount: input.amount,
        description: input.description,
        chargeId,
      });
    }
    return chargeId;
  }

  paymentForm(): PaymentForm {
    return { form: "test" };
  }

  async createPayer({ clientId }: { clientId: string }) {
    this.check();
    const known = this.payers.find((p) => p.clientId === clientId);
    if (known) return { payerId: known.payerId };
    const payerId = this.id("cus");
    this.payers.push({ clientId, payerId });
    return { payerId };
  }

  async startCardForm(_payerId: string): Promise<CardForm> {
    this.check();
    const secret = this.id("seti");
    this.forms.add(secret);
    return { form: "test", secret };
  }

  async savePaymentMethod({
    payerId,
    token,
  }: {
    payerId: string;
    token: string;
  }) {
    this.check();
    if (!this.forms.has(token)) {
      throw new PaymentMethodError(
        "Your card wasn't set up. Please enter it again.",
      );
    }
    this.forms.delete(token);
    return this.save(payerId);
  }

  async takeDeposit(input: DepositInput): Promise<DepositAttempt> {
    this.check();
    return this.once(input.idempotencyKey, (): DepositAttempt => {
      const { source } = input;
      if ("token" in source && !source.token.startsWith("tok_test")) {
        return { status: "failed", reason: "invalid_token" };
      }
      if (
        "paymentMethodId" in source &&
        !this.paymentMethods.some(
          (m) =>
            m.paymentMethodId === source.paymentMethodId &&
            m.payerId === input.payerId,
        )
      ) {
        return { status: "failed", reason: "unknown_payment_method" };
      }
      if (this.chargeFailure) {
        return { status: "failed", reason: this.chargeFailure };
      }
      if ("token" in source && this.approval) {
        const ref = this.id(input.amount > 0 ? "pi" : "seti");
        this.waiting.set(ref, input);
        return { status: "needs_approval", ref, secret: `${ref}_secret` };
      }

      const saved = "token" in source ? this.save(input.payerId) : null;
      return {
        status: "succeeded",
        chargeId: this.take(
          input,
          saved?.paymentMethodId ??
            ("paymentMethodId" in source ? source.paymentMethodId : null),
        ),
        saved,
      };
    });
  }

  async depositOutcome(ref: string): Promise<DepositAttempt> {
    this.check();
    const input = this.waiting.get(ref);
    if (!input) return { status: "failed", reason: "unknown_payment" };
    if (this.approval === "pending") {
      return { status: "needs_approval", ref, secret: `${ref}_secret` };
    }
    // the bank's answer, once given, stays
    return this.once(`outcome:${ref}`, (): DepositAttempt => {
      if (this.approval === "refused") {
        return { status: "failed", reason: "authentication_failed" };
      }
      const saved = this.save(input.payerId);
      return {
        status: "succeeded",
        chargeId: this.take(input, saved.paymentMethodId),
        saved,
      };
    });
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    this.check();
    return this.once(input.idempotencyKey, (): ChargeResult => {
      if (this.chargeFailure) {
        return { ok: false, reason: this.chargeFailure };
      }
      const chargeId = this.id("pi");
      this.charges.push({ ...input, chargeId });
      return { ok: true, chargeId };
    });
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    this.check();
    return this.once(input.idempotencyKey, (): RefundResult => {
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

      const refundId = this.id("re");
      this.refunds.push({ ...input, refundId });
      return { ok: true, refundId };
    });
  }

  // a webhook body is the PaymentEvent itself, as JSON, or anything else for
  // an event we don't act on
  parseEvent(body: Buffer, headers: EventHeaders): PaymentEvent | null {
    if (headers["x-fake-signature"] !== FAKE_SIGNATURE) {
      throw new Error("the webhook isn't signed");
    }
    const event = JSON.parse(body.toString()) as { kind?: string };
    return ["deposit_succeeded", "charge_refunded", "dispute_opened"].includes(
      event.kind ?? "",
    )
      ? (event as PaymentEvent)
      : null;
  }
}
