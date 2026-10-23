export class FakePaymentGateway {
    paymentMethods = [];
    charges = [];
    refunds = [];
    chargeFailure = null;
    nextId = 1;
    // every charge fails with `reason` until cleared with failCharges(null)
    failCharges(reason = "card_declined") {
        this.chargeFailure = reason;
    }
    async savePaymentMethod(input) {
        const paymentMethodId = `pm_fake_${this.nextId++}`;
        this.paymentMethods.push({ ...input, paymentMethodId });
        return { paymentMethodId };
    }
    async charge(input) {
        if (this.chargeFailure) {
            return { ok: false, reason: this.chargeFailure };
        }
        const chargeId = `ch_fake_${this.nextId++}`;
        this.charges.push({ ...input, chargeId });
        return { ok: true, chargeId };
    }
    async refund(input) {
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
