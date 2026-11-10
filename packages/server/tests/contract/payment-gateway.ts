// What every Payment Gateway does, as Stripe really does it: one suite, run
// on FakePaymentGateway in `pnpm test` (src/services/payment-gateway/
// contract.test.ts) and on StripePaymentGateway in a sandbox, nightly and by
// hand (stripe.sandbox.test.ts). Where the two disagree, the fake is wrong,
// and the feature tests built on it can't be trusted (#241).
//
// Each test makes its own payer, so what a card did in one test never carries
// over to the next, as Stripe asks.
import { describe, expect, test } from "vitest";
import {
  PaymentMethodError,
  type EventHeaders,
  type PaymentGateway,
} from "#services/payment-gateway";

// the test cards the cases use, by how they behave
export type TestCard =
  | "visa"
  | "mastercard"
  | "amex"
  // declined for insufficient funds
  | "insufficientFunds"
  // saves fine; every payment from it is then declined
  | "declinesLater"
  // its bank asks the holder to approve saving it
  | "approvalOnSetup"
  // its bank asks the holder to approve every payment
  | "alwaysApproval"
  // a refund of it is made, then fails
  | "refundFails"
  // a refund of it is pending, then goes through
  | "refundPending";

type Webhook = { body: Buffer; headers: EventHeaders };

// The gateway, and the parts of the outside world it can't drive itself: the
// browser's forms, the provider's dashboard, and the webhooks it sends
export type GatewayUnderTest = {
  gateway: PaymentGateway;
  // the token the browser's payment form hands over for `card`, which also
  // saves it for later
  enterCard(card: TestCard): Promise<string>;
  // the Client finishes the save-only card form with `card`; its token
  fillCardForm(secret: string, card: TestCard): Promise<string>;
  // the token of a save-only card form the Client left unfinished
  abandonCardForm(secret: string): Promise<string>;
  // the Client pays a Bill in the browser by a bank debit that stays
  // processing
  payByBankDebit(ref: string): Promise<void>;
  // every payment the provider was asked to take from this payer, declined
  // ones included
  paymentAttempts(payerId: string): Promise<number>;
  // as the Office would in the provider's dashboard; the refund's id
  refundInDashboard(chargeId: string, amount: number): Promise<string>;
  // the webhook the provider sends once refund `refundId` has failed, or
  // gone through after it was pending; waits for it
  refundWebhook(
    refundId: string,
    became: "failed" | "succeeded",
  ): Promise<Webhook>;
  // the webhook the provider sends when a Deposit needing approval succeeds
  depositWebhook(ref: string): Webhook;
  // a webhook claiming to be from the provider, with a forged signature
  forgedWebhook(): Webhook;
};

export const paymentGatewayContract = (
  name: string,
  setup: () => GatewayUnderTest | Promise<GatewayUnderTest>,
) =>
  describe(`${name} as a Payment Gateway`, () => {
    const run = `${Date.now()}`;
    let payers = 0;

    // a Client of its own, as the provider knows them
    const payer = async (t: GatewayUnderTest) => {
      const clientId = `contract-${run}-${(payers += 1)}`;
      const { payerId } = await t.gateway.createPayer({
        clientId,
        name: "Contract Check",
        email: "contract-check@example.com",
        language: "en",
      });
      return { clientId, payerId };
    };

    // a card the Client saved with the save-only card form
    const savedCard = async (
      t: GatewayUnderTest,
      payerId: string,
      card: TestCard,
    ) => {
      const form = await t.gateway.startCardForm(payerId);
      const token = await t.fillCardForm(form.secret, card);
      return t.gateway.savePaymentMethod({ payerId, token });
    };

    // a Charge taken from `card`, and its id
    const charged = async (
      t: GatewayUnderTest,
      card: TestCard,
      amount = 5000,
    ) => {
      const { payerId } = await payer(t);
      const { paymentMethodId } = await savedCard(t, payerId, card);
      const charge = await t.gateway.charge({
        payerId,
        paymentMethodId,
        amount,
        description: "Contract check: Balance",
        idempotencyKey: `balance:${run}:${payerId}`,
      });
      if (!charge.ok) throw new Error(`not charged: ${charge.reason}`);
      return charge.chargeId;
    };

    describe("payers", () => {
      test("a Client's payer is created once", async () => {
        const t = await setup();
        const { clientId, payerId } = await payer(t);

        const again = await t.gateway.createPayer({
          clientId,
          name: "Contract Check",
          email: "contract-check@example.com",
          language: "en",
        });

        expect(again.payerId).toBe(payerId);
      });

      test("a payer's language can change, for the provider's own pages (ADR-0025)", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        await expect(
          t.gateway.setPayerLanguage(payerId, "es"),
        ).resolves.toBeUndefined();
      });
    });

    describe("Deposits", () => {
      test("from a card entered now, it's taken and the card is saved", async () => {
        const t = await setup();
        const { payerId } = await payer(t);

        const deposit = await t.gateway.takeDeposit({
          payerId,
          source: { token: await t.enterCard("visa") },
          amount: 2500,
          description: "Contract check: Deposit",
          idempotencyKey: `deposit:${run}:${payerId}`,
        });

        expect(deposit).toEqual({
          status: "succeeded",
          chargeId: expect.any(String),
          saved: {
            paymentMethodId: expect.any(String),
            card: expect.objectContaining({ last4: "4242" }),
          },
        });
      });

      test("from a saved card, it's taken and nothing new is saved", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const { paymentMethodId } = await savedCard(t, payerId, "visa");

        const deposit = await t.gateway.takeDeposit({
          payerId,
          source: { paymentMethodId },
          amount: 1000,
          description: "Contract check: Deposit from a saved card",
          idempotencyKey: `deposit:${run}:${payerId}`,
        });

        expect(deposit).toEqual({
          status: "succeeded",
          chargeId: expect.any(String),
          saved: null,
        });
      });

      test("a declined card fails, with why", async () => {
        const t = await setup();
        const { payerId } = await payer(t);

        const deposit = await t.gateway.takeDeposit({
          payerId,
          source: { token: await t.enterCard("insufficientFunds") },
          amount: 2500,
          description: "Contract check: declined Deposit",
          idempotencyKey: `deposit:${run}:${payerId}`,
        });

        expect(deposit).toEqual({
          status: "failed",
          reason: "insufficient_funds",
        });
      });

      test("a card whose bank wants approval asks for it, until it's given", async () => {
        const t = await setup();
        const { payerId } = await payer(t);

        const deposit = await t.gateway.takeDeposit({
          payerId,
          source: { token: await t.enterCard("approvalOnSetup") },
          amount: 2500,
          description: "Contract check: Deposit needing approval",
          idempotencyKey: `deposit:${run}:${payerId}`,
        });

        expect(deposit).toEqual({
          status: "needs_approval",
          ref: expect.any(String),
          secret: expect.stringMatching(/.+/),
        });
        if (deposit.status !== "needs_approval") return;
        expect(await t.gateway.depositOutcome(deposit.ref)).toMatchObject({
          status: "needs_approval",
          ref: deposit.ref,
        });
      });

      test("a 0 Deposit takes nothing, and saves the card", async () => {
        const t = await setup();
        const { payerId } = await payer(t);

        const deposit = await t.gateway.takeDeposit({
          payerId,
          source: { token: await t.enterCard("mastercard") },
          amount: 0,
          description: "Contract check: 0% Deposit",
          idempotencyKey: `deposit:${run}:${payerId}`,
        });

        expect(deposit).toEqual({
          status: "succeeded",
          chargeId: null,
          saved: {
            paymentMethodId: expect.any(String),
            card: expect.objectContaining({ last4: "4444" }),
          },
        });
        expect(await t.paymentAttempts(payerId)).toBe(0);
      });

      test("saving a card whose bank always wants approval asks for it", async () => {
        const t = await setup();
        const { payerId } = await payer(t);

        const deposit = await t.gateway.takeDeposit({
          payerId,
          source: { token: await t.enterCard("alwaysApproval") },
          amount: 0,
          description: "Contract check: save a card that always asks",
          idempotencyKey: `deposit:${run}:${payerId}`,
        });

        expect(deposit.status).toBe("needs_approval");
      });
    });

    describe("the save-only card form", () => {
      test("a finished form saves the card", async () => {
        const t = await setup();
        const { payerId } = await payer(t);

        const saved = await savedCard(t, payerId, "amex");

        expect(saved.card.last4).toBe("8431");
      });

      test("an unfinished form saves nothing", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const form = await t.gateway.startCardForm(payerId);
        const token = await t.abandonCardForm(form.secret);

        await expect(
          t.gateway.savePaymentMethod({ payerId, token }),
        ).rejects.toBeInstanceOf(PaymentMethodError);
      });
    });

    // Stripe keeps a key's first reply, errors included, and refuses the key
    // for a different request (docs.stripe.com/api/idempotent_requests)
    describe("Charges and their idempotency keys", () => {
      test("an off-session Charge to a saved card is taken", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const { paymentMethodId } = await savedCard(t, payerId, "visa");

        const charge = await t.gateway.charge({
          payerId,
          paymentMethodId,
          amount: 7500,
          description: "Contract check: Balance",
          idempotencyKey: `balance:${run}:${payerId}`,
        });

        expect(charge).toEqual({ ok: true, chargeId: expect.any(String) });
        expect(await t.paymentAttempts(payerId)).toBe(1);
      });

      test("the same key and request get the first Charge back, and charge once", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const { paymentMethodId } = await savedCard(t, payerId, "visa");
        const charge = () =>
          t.gateway.charge({
            payerId,
            paymentMethodId,
            amount: 7500,
            description: "Contract check: Balance",
            idempotencyKey: `balance:${run}:${payerId}`,
          });

        const [first, again] = [await charge(), await charge()];

        expect(first.ok).toBe(true);
        expect(again).toEqual(first);
        expect(await t.paymentAttempts(payerId)).toBe(1);
      });

      test("the same key for a different amount is refused, and charges nothing more", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const { paymentMethodId } = await savedCard(t, payerId, "visa");
        const charge = (amount: number) =>
          t.gateway.charge({
            payerId,
            paymentMethodId,
            amount,
            description: "Contract check: Balance",
            idempotencyKey: `balance:${run}:${payerId}`,
          });

        expect((await charge(7500)).ok).toBe(true);
        expect((await charge(9000)).ok).toBe(false);
        expect(await t.paymentAttempts(payerId)).toBe(1);
      });

      test("a decline comes back again for its key, without trying the card again", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const { paymentMethodId } = await savedCard(
          t,
          payerId,
          "declinesLater",
        );
        const charge = (key: string) =>
          t.gateway.charge({
            payerId,
            paymentMethodId,
            amount: 7500,
            description: "Contract check: declined Balance",
            idempotencyKey: `balance:${run}:${payerId}:${key}`,
          });

        const first = await charge("a");
        const again = await charge("a");

        expect(first.ok).toBe(false);
        expect(again).toEqual(first);
        expect(await t.paymentAttempts(payerId)).toBe(1);
        // a new key is a new attempt, declined again
        expect((await charge("b")).ok).toBe(false);
        expect(await t.paymentAttempts(payerId)).toBe(2);
      });
    });

    // when the reply never came, the payment is found by what it was asked
    // with, however old its key (#241, finding 1)
    describe("finding a Charge asked for before", () => {
      test("one taken is found by its key, and by its id", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const { paymentMethodId } = await savedCard(t, payerId, "visa");
        const since = new Date();
        const idempotencyKey = `balance:${run}:${payerId}`;
        const charge = await t.gateway.charge({
          payerId,
          paymentMethodId,
          amount: 7500,
          description: "Contract check: Balance",
          idempotencyKey,
        });

        const lookup = { payerId, idempotencyKey, since };
        expect(
          await t.gateway.chargeOutcome({ ...lookup, chargeId: null }),
        ).toEqual(charge);
        if (!charge.ok) return;
        expect(
          await t.gateway.chargeOutcome({
            ...lookup,
            chargeId: charge.chargeId,
          }),
        ).toEqual(charge);
      });

      test("one declined is found declined", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const { paymentMethodId } = await savedCard(
          t,
          payerId,
          "declinesLater",
        );
        const since = new Date();
        const idempotencyKey = `balance:${run}:${payerId}`;
        const declined = await t.gateway.charge({
          payerId,
          paymentMethodId,
          amount: 7500,
          description: "Contract check: declined Balance",
          idempotencyKey,
        });

        expect(declined.ok).toBe(false);
        expect(
          await t.gateway.chargeOutcome({
            payerId,
            idempotencyKey,
            chargeId: null,
            since,
          }),
        ).toEqual(declined);
      });

      test("a Deposit taken is found by its key", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const since = new Date();
        const idempotencyKey = `deposit:${run}:${payerId}`;
        const deposit = await t.gateway.takeDeposit({
          payerId,
          source: { token: await t.enterCard("visa") },
          amount: 2500,
          description: "Contract check: Deposit",
          idempotencyKey,
        });

        expect(
          await t.gateway.chargeOutcome({
            payerId,
            idempotencyKey,
            chargeId: null,
            since,
          }),
        ).toEqual({
          ok: true,
          chargeId: deposit.status === "succeeded" ? deposit.chargeId : null,
        });
      });

      test("one never made isn't found", async () => {
        const t = await setup();
        const { payerId } = await payer(t);

        expect(
          await t.gateway.chargeOutcome({
            payerId,
            idempotencyKey: `balance:${run}:${payerId}:never`,
            chargeId: null,
            since: new Date(),
          }),
        ).toBeNull();
      });
    });

    describe("refunds", () => {
      test("repeated with the same key, a refund is made once", async () => {
        const t = await setup();
        const chargeId = await charged(t, "visa");
        const refund = () =>
          t.gateway.refund({
            chargeId,
            amount: 2000,
            idempotencyKey: `refund:${run}:${chargeId}`,
          });

        const [first, again] = [await refund(), await refund()];

        expect(first).toEqual({ ok: true, refundId: expect.any(String) });
        expect(again).toEqual(first);
      });

      // when the reply never came (#241)
      test("one of ours is found by the key it was asked with", async () => {
        const t = await setup();
        const chargeId = await charged(t, "visa");
        const idempotencyKey = `refund:${run}:${chargeId}`;
        const refund = await t.gateway.refund({
          chargeId,
          amount: 2000,
          idempotencyKey,
        });

        expect(
          await t.gateway.refundOutcome({ chargeId, idempotencyKey }),
        ).toEqual(refund);
        expect(
          await t.gateway.refundOutcome({
            chargeId,
            idempotencyKey: `${idempotencyKey}:never`,
          }),
        ).toBeNull();
      });

      test("one made in the dashboard is told apart from ours", async () => {
        const t = await setup();
        const chargeId = await charged(t, "visa");
        await t.gateway.refund({
          chargeId,
          amount: 2000,
          idempotencyKey: `refund:${run}:${chargeId}`,
        });

        const refundId = await t.refundInDashboard(chargeId, 1500);

        expect(await t.gateway.refundsElsewhere(chargeId)).toEqual([
          { refundId, amount: 1500, at: expect.any(Date) },
        ]);
      });

      test("one that fails after it's made is told by a refund_failed event", async () => {
        const t = await setup();
        const chargeId = await charged(t, "refundFails");

        const refund = await t.gateway.refund({
          chargeId,
          amount: 2000,
          idempotencyKey: `refund:${run}:${chargeId}`,
        });

        // made, as far as anyone can tell yet
        expect(refund).toEqual({ ok: true, refundId: expect.any(String) });
        if (!refund.ok) return;
        const { body, headers } = await t.refundWebhook(
          refund.refundId,
          "failed",
        );
        expect(t.gateway.parseEvent(body, headers)).toEqual({
          kind: "refund_failed",
          chargeId,
          refundId: refund.refundId,
        });
      });

      test("one that's pending, then goes through, is told by a charge_refunded event", async () => {
        const t = await setup();
        const chargeId = await charged(t, "refundPending");

        const refund = await t.gateway.refund({
          chargeId,
          amount: 2000,
          idempotencyKey: `refund:${run}:${chargeId}`,
        });

        expect(refund).toEqual({ ok: true, refundId: expect.any(String) });
        if (!refund.ok) return;
        const { body, headers } = await t.refundWebhook(
          refund.refundId,
          "succeeded",
        );
        expect(t.gateway.parseEvent(body, headers)).toEqual({
          kind: "charge_refunded",
          chargeId,
        });
      });
    });

    describe("Bill payments", () => {
      test("by bank debit, one stays processing, and says what it's for", async () => {
        const t = await setup();
        const { payerId } = await payer(t);
        const { ref } = await t.gateway.startBillPayment({
          payerId,
          amount: 12000,
          description: "Contract check: Bill",
          reference: `bill-${run}`,
          idempotencyKey: `bill:${run}:${payerId}`,
        });

        await t.payByBankDebit(ref);

        expect(await t.gateway.billPaymentOutcome(ref)).toEqual({
          status: "processing",
          reference: `bill-${run}`,
        });
      });

      test("one the provider doesn't know has failed", async () => {
        const t = await setup();

        expect(
          await t.gateway.billPaymentOutcome("pi_made_up_by_a_client"),
        ).toEqual({ status: "failed", reason: "unknown_payment" });
      });
    });

    describe("webhooks", () => {
      test("a signed one for a Deposit that needed approval is deposit_succeeded", async () => {
        const t = await setup();
        const { body, headers } = t.depositWebhook("pi_contract");

        expect(t.gateway.parseEvent(body, headers)).toEqual({
          kind: "deposit_succeeded",
          ref: "pi_contract",
        });
      });

      test("a forged one is refused", async () => {
        const t = await setup();
        const { body, headers } = t.forgedWebhook();

        expect(() => t.gateway.parseEvent(body, headers)).toThrow();
      });
    });
  });
