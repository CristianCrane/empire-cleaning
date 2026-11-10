import type { CardForm, Language, PaymentForm } from "@empire-cleaning/models";
import {
  PaymentMethodError,
  type BillPaymentInput,
  type BillPaymentOutcome,
  type ChargeInput,
  type ChargeLookup,
  type ChargeResult,
  type DepositAttempt,
  type DepositInput,
  type EventHeaders,
  type PaymentEvent,
  type PaymentGateway,
  type RefundElsewhere,
  type RefundInput,
  type RefundLookup,
  type RefundResult,
  type SavedPaymentMethod,
} from "#services/payment-gateway";
import type { TestCard } from "../contract/payment-gateway.ts";

type RecordedCharge = {
  payerId: string;
  paymentMethodId: string | null;
  amount: number;
  description: string;
  chargeId: string;
};
type RecordedRefund = RefundInput & { refundId: string };
type RefundStatus = "succeeded" | "pending" | "failed";

// what the Client's bank does when it asks them to approve a Deposit
export type Approval = "approved" | "refused" | "pending";

// what a webhook from the fake carries; its signature header must match
export const FAKE_SIGNATURE = "fake-signature";

// the last four digits of each test card (tests/contract/payment-gateway.ts),
// as Stripe's own
const LAST4: Record<TestCard, string> = {
  visa: "4242",
  mastercard: "4444",
  amex: "8431",
  insufficientFunds: "9995",
  declinesLater: "0341",
  approvalOnSetup: "3155",
  alwaysApproval: "3184",
  refundFails: "5126",
  refundPending: "7726",
};

// a token from paymentToken(card); any other test token is a Visa
const cardOf = (token: string): TestCard => {
  const card = /^tok_test_([A-Za-z]+)_/.exec(token)?.[1];
  return card && card in LAST4 ? (card as TestCard) : "visa";
};

/**
 * Stands in for the payment provider, as the contract tests
 * (tests/contract/payment-gateway.ts) show Stripe behaves. Its browser form is
 * the web app's "test" one, which needs no card: a card "entered" there is any
 * token starting `tok_test` (paymentToken() makes one, of any test card). The
 * save-only card form's token is the form's own secret, and the form is
 * finished as soon as it's started, unless abandonCardForm() says otherwise.
 */
export class FakePaymentGateway implements PaymentGateway {
  readonly payers: { clientId: string; payerId: string; language: Language }[] =
    [];
  readonly paymentMethods: (SavedPaymentMethod & { payerId: string })[] = [];
  readonly charges: RecordedCharge[] = [];
  readonly refunds: RecordedRefund[] = [];
  // made in the dashboard, by refundAtProvider
  readonly refundsAtProvider: (RefundElsewhere & { chargeId: string })[] = [];
  // every payment the provider was asked to take, declined ones included, as
  // a PaymentIntent is at Stripe
  readonly paymentAttempts: { payerId: string; amount: number }[] = [];

  private chargeFailure: string | null = null;
  private refundFailure: string | null = null;
  private approval: Approval | null = null;
  private down = false;
  // the save-only card forms started, and the card each was finished with;
  // null if the Client left it unfinished
  private readonly forms = new Map<string, TestCard | null>();
  private readonly cards = new Map<string, TestCard>();
  private readonly refundStatus = new Map<string, RefundStatus>();
  // Deposits needing approval; by card when the card itself asks for it,
  // which nothing here gives
  private readonly waiting = new Map<
    string,
    { input: DepositInput; card: TestCard; byCard: boolean }
  >();
  private readonly replies = new Map<
    string,
    { request: string; reply: unknown }
  >();
  // every payment made, by the key it was asked with, as its metadata has
  // it at the provider; kept when the keys are forgotten
  private readonly made = new Map<string, ChargeResult>();
  // and every refund, likewise
  private readonly madeRefunds = new Map<string, string>();
  private replyLost = false;
  private held: { reached: () => void; gate: Promise<void> } | null = null;
  // Bill payments started in the browser, by ref, and how each stands
  private readonly billPayments = new Map<
    string,
    { input: BillPaymentInput; outcome: BillPaymentOutcome }
  >();
  private nextId = 1;

  // every Charge and Deposit is declined with `reason` until failCharges(null)
  failCharges(reason: string | null = "card_declined") {
    this.chargeFailure = reason;
  }

  // someone refunds `amount` of a Charge in the provider's dashboard, as
  // the Office might; the webhook's charge_refunded tells the app
  refundAtProvider(chargeId: string, amount: number, at = new Date()) {
    const refundId = this.id("re");
    this.refundsAtProvider.push({ chargeId, refundId, amount, at });
    this.refundStatus.set(refundId, this.refundStarts(chargeId));
    return refundId;
  }

  // The next call that moves money does, but its reply never comes back:
  // it throws, as a timeout would
  loseNextReply() {
    this.replyLost = true;
  }

  // The next Charge waits, once it's reached the provider, until release():
  // so a test can line something else up meanwhile. `reached` resolves when
  // it's waiting
  holdNextCharge() {
    let reached!: () => void;
    let release!: () => void;
    const arrived = new Promise<void>((resolve) => (reached = resolve));
    this.held = {
      reached,
      gate: new Promise<void>((resolve) => (release = resolve)),
    };
    return { reached: arrived, release };
  }

  // the provider forgets every idempotency key, as it may once a key is 24
  // hours old: asking again with one is a new request
  forgetKeys() {
    this.replies.clear();
  }

  // every refund fails with `reason` until failRefunds(null)
  failRefunds(reason: string | null = "refund_failed") {
    this.refundFailure = reason;
  }

  // A refund still on its way ends, as its card does: one of a refundFails
  // card fails, one of a refundPending card goes through. The event the
  // provider then sends, or null if there's nothing left to happen to it.
  settleRefund(refundId: string): PaymentEvent | null {
    const status = this.refundStatus.get(refundId);
    const chargeId = [...this.refunds, ...this.refundsAtProvider].find(
      (r) => r.refundId === refundId,
    )?.chargeId;
    if (!chargeId || status === "failed") return null;
    if (this.cardOfCharge(chargeId) === "refundFails") {
      this.refundStatus.set(refundId, "failed");
      return { kind: "refund_failed", chargeId, refundId };
    }
    if (status === "pending") {
      this.refundStatus.set(refundId, "succeeded");
      return { kind: "charge_refunded", chargeId };
    }
    return null;
  }

  // a refund made fails after all, as one to a card since closed does: the
  // event the provider then sends
  failRefund(refundId: string): PaymentEvent {
    const chargeId = [...this.refunds, ...this.refundsAtProvider].find(
      (r) => r.refundId === refundId,
    )?.chargeId;
    if (!chargeId) throw new Error(`no refund ${refundId}`);
    this.refundStatus.set(refundId, "failed");
    return { kind: "refund_failed", chargeId, refundId };
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

  // the Client finishes paying a Bill in the browser: by card it succeeds
  // at once, unless Charges are failing; by bank debit it's processing
  // until clearBankDebit()
  payBill(ref: string, by: "card" | "bank" = "card") {
    const payment = this.billPayments.get(ref);
    if (!payment) throw new Error(`no Bill payment ${ref}`);
    payment.outcome =
      by === "bank"
        ? { status: "processing", reference: payment.input.reference }
        : this.chargeFailure
          ? { status: "failed", reason: this.chargeFailure }
          : this.takeBillPayment(ref, payment.input);
  }

  // The web app's test form stands in for the provider's in the browser, so
  // nothing there finishes a Bill payment: from now on one still waiting is
  // finished this way when asked how it went, as if the Client had paid;
  // null to stop (the end-to-end tests)
  private browserPays: "card" | "bank" | null = null;
  payBillsInBrowser(by: "card" | "bank" | null) {
    this.browserPays = by;
  }

  // a bank debit paying a Bill clears, or fails
  clearBankDebit(ref: string, cleared = true) {
    const payment = this.billPayments.get(ref)!;
    payment.outcome = cleared
      ? this.takeBillPayment(ref, payment.input)
      : { status: "failed", reason: "insufficient_funds" };
  }

  // the latest Bill payment started in the browser
  lastBillPayment() {
    const ref = [...this.billPayments.keys()].at(-1);
    if (!ref) throw new Error("no Bill payment was started");
    return { ref, ...this.billPayments.get(ref)!.input };
  }

  private takeBillPayment(
    ref: string,
    input: BillPaymentInput,
  ): BillPaymentOutcome {
    this.charges.push({
      payerId: input.payerId,
      paymentMethodId: null,
      amount: input.amount,
      description: input.description,
      chargeId: ref,
    });
    return {
      status: "succeeded",
      chargeId: ref,
      amount: input.amount,
      reference: input.reference,
    };
  }

  // a card "entered" in the test payment form
  paymentToken(card: TestCard = "visa") {
    return `tok_test_${card}_${this.nextId++}`;
  }

  // a card set up in the save-only card form, for any payer
  async cardToken(card: TestCard = "visa") {
    const { secret } = await this.startCardForm("any");
    return this.fillCardForm(secret, card);
  }

  // the Client finishes the save-only card form with `card`; its token
  fillCardForm(secret: string, card: TestCard) {
    this.forms.set(secret, card);
    return secret;
  }

  // the Client leaves the save-only card form unfinished; its token
  abandonCardForm(secret: string) {
    this.forms.set(secret, null);
    return secret;
  }

  // a webhook request from the provider, telling the app of `event`
  webhook(event: PaymentEvent, signature = FAKE_SIGNATURE) {
    return {
      body: Buffer.from(JSON.stringify(event)),
      headers: { "x-fake-signature": signature } as EventHeaders,
    };
  }

  private id(prefix: string) {
    return `${prefix}_fake_${this.nextId++}`;
  }

  private check() {
    if (this.down) throw new Error("the payment provider can't be reached");
  }

  // A repeated idempotency key gets the first reply, refusals included, as
  // at the provider; the key for a different request is refused
  private async once<T>(
    key: string,
    request: unknown,
    reply: () => Promise<T> | T,
    refused: () => T,
  ) {
    const asked = JSON.stringify(request);
    const first = this.replies.get(key);
    if (!first) {
      this.replies.set(key, { request: asked, reply: await reply() });
      if (this.replyLost) {
        this.replyLost = false;
        throw new Error("the payment provider's reply never came");
      }
    } else if (first.request !== asked) {
      return refused();
    }
    return this.replies.get(key)!.reply as T;
  }

  private attempt(payerId: string, amount: number) {
    this.paymentAttempts.push({ payerId, amount });
  }

  private save(payerId: string, card: TestCard): SavedPaymentMethod {
    const saved = {
      paymentMethodId: this.id("pm"),
      label: `Test card ending ${LAST4[card]}`,
    };
    this.paymentMethods.push({ ...saved, payerId });
    this.cards.set(saved.paymentMethodId, card);
    return saved;
  }

  private cardOfCharge(chargeId: string): TestCard {
    const method = this.charges.find(
      (c) => c.chargeId === chargeId,
    )?.paymentMethodId;
    return (method && this.cards.get(method)) || "visa";
  }

  // a refund of a Charge starts as its card has it
  private refundStarts(chargeId: string): RefundStatus {
    return this.cardOfCharge(chargeId) === "refundPending"
      ? "pending"
      : "succeeded";
  }

  // why `card` declines a payment, or null if it doesn't
  private declines(card: TestCard, onSession: boolean) {
    switch (card) {
      case "insufficientFunds":
        return "insufficient_funds";
      case "declinesLater":
        return "card_declined";
      case "alwaysApproval":
        return onSession ? null : "authentication_required";
      default:
        return null;
    }
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

  async createPayer({
    clientId,
    language,
  }: {
    clientId: string;
    language: Language;
  }) {
    this.check();
    const known = this.payers.find((p) => p.clientId === clientId);
    if (known) return { payerId: known.payerId };
    const payerId = this.id("cus");
    this.payers.push({ clientId, payerId, language });
    return { payerId };
  }

  async setPayerLanguage(payerId: string, language: Language) {
    this.check();
    const payer = this.payers.find((p) => p.payerId === payerId);
    if (payer) payer.language = language;
  }

  async startCardForm(_payerId: string): Promise<CardForm> {
    this.check();
    const secret = this.id("seti");
    this.forms.set(secret, "visa");
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
    const card = this.forms.get(token);
    if (!card) {
      throw new PaymentMethodError(`no test form ${token}`);
    }
    this.forms.delete(token);
    return this.save(payerId, card);
  }

  async takeDeposit(input: DepositInput): Promise<DepositAttempt> {
    this.check();
    const { idempotencyKey, ...request } = input;
    return this.once(
      idempotencyKey,
      request,
      (): DepositAttempt => {
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
        if (input.amount > 0) this.attempt(input.payerId, input.amount);
        if (this.chargeFailure) {
          if (input.amount > 0) {
            this.made.set(idempotencyKey, {
              ok: false,
              reason: this.chargeFailure,
            });
          }
          return { status: "failed", reason: this.chargeFailure };
        }
        const card =
          "token" in source
            ? cardOf(source.token)
            : (this.cards.get(source.paymentMethodId) ?? "visa");
        const declined = this.declines(card, true);
        // a card that declines payments still saves when nothing is taken
        if (declined && input.amount > 0) {
          this.made.set(idempotencyKey, { ok: false, reason: declined });
          return { status: "failed", reason: declined };
        }
        const byCard = card === "approvalOnSetup" || card === "alwaysApproval";
        if ("token" in source && (this.approval || byCard)) {
          const ref = this.id(input.amount > 0 ? "pi" : "seti");
          this.waiting.set(ref, { input, card, byCard });
          return { status: "needs_approval", ref, secret: `${ref}_secret` };
        }

        const saved = "token" in source ? this.save(input.payerId, card) : null;
        const chargeId = this.take(
          input,
          saved?.paymentMethodId ??
            ("paymentMethodId" in source ? source.paymentMethodId : null),
        );
        if (chargeId) this.made.set(idempotencyKey, { ok: true, chargeId });
        return { status: "succeeded", chargeId, saved };
      },
      () => ({ status: "failed", reason: "idempotency_error" }),
    );
  }

  async depositOutcome(ref: string): Promise<DepositAttempt> {
    this.check();
    const waiting = this.waiting.get(ref);
    if (!waiting) return { status: "failed", reason: "unknown_payment" };
    if (waiting.byCard || this.approval === "pending") {
      return { status: "needs_approval", ref, secret: `${ref}_secret` };
    }
    // the bank's answer, once given, stays
    return this.once(
      `outcome:${ref}`,
      null,
      (): DepositAttempt => {
        if (this.approval === "refused") {
          return { status: "failed", reason: "authentication_failed" };
        }
        const saved = this.save(waiting.input.payerId, waiting.card);
        return {
          status: "succeeded",
          chargeId: this.take(waiting.input, saved.paymentMethodId),
          saved,
        };
      },
      () => ({ status: "failed", reason: "idempotency_error" }),
    );
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    this.check();
    const held = this.held;
    if (held) {
      this.held = null;
      held.reached();
      await held.gate;
    }
    const { idempotencyKey, ...request } = input;
    return this.once(
      idempotencyKey,
      request,
      (): ChargeResult => {
        this.attempt(input.payerId, input.amount);
        const declined =
          this.chargeFailure ??
          this.declines(this.cards.get(input.paymentMethodId) ?? "visa", false);
        const result: ChargeResult = declined
          ? { ok: false, reason: declined }
          : { ok: true, chargeId: this.id("pi") };
        if (result.ok)
          this.charges.push({ ...input, chargeId: result.chargeId });
        this.made.set(idempotencyKey, result);
        return result;
      },
      () => ({ ok: false, reason: "idempotency_error" }),
    );
  }

  async chargeOutcome({
    idempotencyKey,
    chargeId,
  }: ChargeLookup): Promise<ChargeResult | null> {
    this.check();
    if (chargeId) {
      return this.charges.some((c) => c.chargeId === chargeId)
        ? { ok: true, chargeId }
        : null;
    }
    return this.made.get(idempotencyKey) ?? null;
  }

  async startBillPayment(input: BillPaymentInput) {
    this.check();
    const { idempotencyKey, ...request } = input;
    return this.once(
      idempotencyKey,
      request,
      () => {
        this.attempt(input.payerId, input.amount);
        const ref = this.id("pi");
        this.billPayments.set(ref, { input, outcome: { status: "waiting" } });
        return { ref, secret: `${ref}_secret` };
      },
      () => {
        throw new Error("the idempotency key was used for another request");
      },
    );
  }

  async billPaymentOutcome(ref: string): Promise<BillPaymentOutcome> {
    this.check();
    const payment = this.billPayments.get(ref);
    if (this.browserPays && payment?.outcome.status === "waiting") {
      this.payBill(ref, this.browserPays);
    }
    return (
      this.billPayments.get(ref)?.outcome ?? {
        status: "failed",
        reason: "unknown_payment",
      }
    );
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    this.check();
    if (this.refundFailure) return { ok: false, reason: this.refundFailure };
    const { idempotencyKey, ...request } = input;
    return this.once(
      idempotencyKey,
      request,
      (): RefundResult => {
        const charge = this.charges.find((c) => c.chargeId === input.chargeId);
        if (!charge) {
          return { ok: false, reason: "unknown_charge" };
        }

        // as the provider does, counting those made in its dashboard, and
        // not those that failed
        const refunded = [...this.refunds, ...this.refundsAtProvider]
          .filter(
            (r) =>
              r.chargeId === input.chargeId &&
              this.refundStatus.get(r.refundId) !== "failed",
          )
          .reduce((sum, r) => sum + r.amount, 0);
        if (refunded + input.amount > charge.amount) {
          return { ok: false, reason: "exceeds_charge" };
        }

        const refundId = this.id("re");
        this.refunds.push({ ...input, refundId });
        this.madeRefunds.set(idempotencyKey, refundId);
        this.refundStatus.set(refundId, this.refundStarts(input.chargeId));
        return { ok: true, refundId };
      },
      () => ({ ok: false, reason: "idempotency_error" }),
    );
  }

  async refundOutcome({
    idempotencyKey,
  }: RefundLookup): Promise<RefundResult | null> {
    this.check();
    const refundId = this.madeRefunds.get(idempotencyKey);
    if (!refundId) return null;
    return this.refundStatus.get(refundId) === "failed"
      ? { ok: false, reason: "failed" }
      : { ok: true, refundId };
  }

  async refundsElsewhere(chargeId: string): Promise<RefundElsewhere[]> {
    this.check();
    return this.refundsAtProvider
      .filter(
        (r) =>
          r.chargeId === chargeId &&
          this.refundStatus.get(r.refundId) !== "failed",
      )
      .map(({ refundId, amount, at }) => ({ refundId, amount, at }));
  }

  // a webhook body is the PaymentEvent itself, as JSON, or anything else for
  // an event we don't act on
  parseEvent(body: Buffer, headers: EventHeaders): PaymentEvent | null {
    if (headers["x-fake-signature"] !== FAKE_SIGNATURE) {
      throw new Error("the webhook isn't signed");
    }
    const event = JSON.parse(body.toString()) as { kind?: string };
    return [
      "deposit_succeeded",
      "bill_payment_succeeded",
      "bill_payment_failed",
      "charge_refunded",
      "refund_failed",
      "dispute_opened",
    ].includes(event.kind ?? "")
      ? (event as PaymentEvent)
      : null;
  }
}
