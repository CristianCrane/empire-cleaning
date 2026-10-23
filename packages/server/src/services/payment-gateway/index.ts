// amounts are integer minor units (cents)
export type SavePaymentMethodInput = {
  clientId: string;
  // the Client types their card into the payment provider's own form in the
  // browser; the provider returns this reference to it, so card numbers never
  // reach our server. We only pass it back to the provider.
  token: string;
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

export interface PaymentGateway {
  savePaymentMethod(
    input: SavePaymentMethodInput,
  ): Promise<{ paymentMethodId: string }>;
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}

class UnconfiguredPaymentGateway implements PaymentGateway {
  private fail(): never {
    throw new Error("No payment provider is configured");
  }

  async savePaymentMethod(): Promise<never> {
    this.fail();
  }

  async charge(): Promise<never> {
    this.fail();
  }

  async refund(): Promise<never> {
    this.fail();
  }
}

// the payment provider hasn't been chosen yet (see spec #1); tests swap in a fake
let current: PaymentGateway = new UnconfiguredPaymentGateway();

export const paymentGateway: PaymentGateway = {
  savePaymentMethod: (input) => current.savePaymentMethod(input),
  charge: (input) => current.charge(input),
  refund: (input) => current.refund(input),
};

export const setPaymentGateway = (next: PaymentGateway) => {
  current = next;
};
