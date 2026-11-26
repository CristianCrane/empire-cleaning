import type { CardForm, Language, PaymentForm } from "@empire-cleaning/models";
import {
  APPROVE,
  PaymentMethodError,
  type BillInput,
  type CallingOff,
  type ChargeInput,
  type ChargeLookup,
  type DepositInput,
  type EventHeaders,
  type JobInput,
  type PaymentEvent,
  type PaymentSource,
  type PaymentGateway,
  type PaymentResult,
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
// a payment made with the Client there: a Deposit's, or a Bill's
type Payment = { payerId: string; amount: number; description: string };
type RefundStatus = "succeeded" | "pending" | "failed";

// what the Client's bank does with a payment it asked them to approve:
// "pending" until they do, "processing" once they have and the bank is
// still finishing it (when, for a card, it can't be called off)
export type Approval = "approved" | "refused" | "pending" | "processing";

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

// a bank account "entered" in the test payment form (bankToken())
const BANK = "tok_test_bank_";

// a token from paymentToken(card); any other test token is a Visa
const cardOf = (token: string): TestCard => {
  const card = /^tok_test_([A-Za-z]+)_/.exec(token)?.[1];
  return card && card in LAST4 ? (card as TestCard) : "visa";
};

// the provider's answers, as a Stripe PaymentIntent's status reads
const taken = (
  chargeId: string | null,
  saved: SavedPaymentMethod | null = null,
): PaymentResult => ({ status: "taken", chargeId, saved });
const failed = (reason: string, ref?: string): PaymentResult => ({
  status: "failed",
  reason,
  ...(ref && { ref }),
});
const approving = (ref: string): PaymentResult => ({
  status: "approving",
  ref,
  secret: `${ref}_secret`,
});
const finishing = (ref: string, by: "card" | "bank"): PaymentResult => ({
  status: "finishing",
  ref,
  by,
});

/**
 * Stands in for the payment provider, as the contract tests
 * (tests/contract/payment-gateway.ts) show Stripe behaves. Its browser form is
 * the web app's "test" one, which needs no card: a card "entered" there is any
 * token starting `tok_test` (paymentToken() makes one, of any test card), and
 * a bank account one bankToken() makes, which only a Bill takes. The
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
  // a card entered just now, paying a Deposit or a Bill, that its bank
  // finishes before it's taken, from its first reply, until
  // finishCards(false) (#534's critical review C6, F21)
  private cardsFinishing = false;
  // what the browser's test payment form enters for a Bill (payBillsBy())
  private billsBy: "card" | "bank" = "card";
  private down = false;
  // the save-only card forms started, and the card each was finished with;
  // null if the Client left it unfinished
  private readonly forms = new Map<string, TestCard | null>();
  private readonly cards = new Map<string, TestCard>();
  private readonly refundStatus = new Map<string, RefundStatus>();
  // payments needing approval, the key each was asked with, the saved card
  // it's from (if it is), and whether it saves the card once approved; by
  // card when the card itself asks for it, which nothing here gives
  private readonly waiting = new Map<
    string,
    {
      input: Payment;
      key: string;
      card: TestCard;
      paymentMethodId: string | null;
      byCard: boolean;
      saves: boolean;
      // processing, left so by finishCards() or failCharges("processing")
      finishing: "cards" | "charges" | null;
    }
  >();
  // Charges the Client's bank wanted them to approve (APPROVE), each left
  // open, by ref, until a payment on its page approves it again
  private readonly toApprove = new Map<
    string,
    { payerId: string; amount: number }
  >();
  // and those called off, never to be taken
  readonly canceled = new Set<string>();
  // Deposits taken without asking, by charge, as the provider still has them
  private readonly takenAtOnce = new Map<string, PaymentResult>();
  private readonly replies = new Map<
    string,
    { request: string; reply: unknown }
  >();
  // every payment made, by the key it was asked with, as its metadata has
  // it at the provider; kept when the keys are forgotten
  private readonly made = new Map<string, PaymentResult>();
  // and every refund, likewise
  private readonly madeRefunds = new Map<string, string>();
  // Charges still processing, by the key each was asked with
  private readonly processing = new Map<string, RecordedCharge>();
  // bank debits paying a Bill, by ref: `ended` is null while processing,
  // then "cleared", or why it failed, once clearBankDebit() ends it
  private readonly debits = new Map<
    string,
    { key: string; charge: RecordedCharge; ended: string | null }
  >();
  private replyLost = false;
  private held: { reached: () => void; gate: Promise<void> } | null = null;
  private nextId = 1;

  // every Charge and Deposit is declined with `reason` until
  // failCharges(null); "processing" leaves a Charge, or a card payment made
  // with the Client there, processing instead, as Stripe does, until
  // clearCharges()
  failCharges(reason: string | null = "card_declined") {
    this.chargeFailure = reason;
  }

  // every Charge left processing goes through, and every card payment made
  // with the Client there is taken as it's next read
  clearCharges() {
    for (const [key, charge] of this.processing) {
      this.charges.push(charge);
      this.made.set(key, taken(charge.chargeId));
    }
    this.processing.clear();
    for (const waiting of this.waiting.values()) {
      if (waiting.finishing === "charges") waiting.finishing = null;
    }
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

  // every card saved so far is one whose bank asks its holder to approve
  // each payment (alwaysApproval): one taken without them is stopped, and
  // one they make on a page asks them there
  savedCardsAsk() {
    for (const id of this.cards.keys()) this.cards.set(id, "alwaysApproval");
  }

  // a card entered just now needs its holder's approval from now on, which
  // their bank then gives, refuses, or is still waiting on; null to stop
  requireApproval(then: Approval | null = "approved") {
    this.approval = then;
  }

  // from now, each card entered just now, paying a Deposit or a Bill, is
  // processing from its first reply, its bank finishing it, as Stripe can
  // say it, until finishCards(false), when it's taken
  finishCards(finishing = true) {
    this.cardsFinishing = finishing;
  }

  // every call throws, as when the provider can't be reached, until
  // goDown(false)
  goDown(isDown = true) {
    this.down = isDown;
  }

  // a card "entered" in the test payment form
  paymentToken(card: TestCard = "visa") {
    return `tok_test_${card}_${this.nextId++}`;
  }

  // a bank account "entered" in the test payment form, linked at once: a
  // Bill paid with it is processing until clearBankDebit()
  bankToken() {
    return `${BANK}${this.nextId++}`;
  }

  // the browser's test payment form, which enters a test card, pays a Bill
  // from now on by that card, or as if a bank account had been entered
  payBillsBy(by: "card" | "bank") {
    this.billsBy = by;
  }

  // the newest bank debit paying a Bill, as its ref
  lastBankDebit() {
    const ref = [...this.debits.keys()].at(-1);
    if (!ref) throw new Error("no bank debit made");
    return ref;
  }

  // a bank debit paying a Bill clears, or fails as with too little in the
  // account; the provider's webhook then tells the app
  clearBankDebit(ref: string, cleared = true) {
    const debit = this.debits.get(ref);
    if (!debit || debit.ended)
      throw new Error(`no bank debit ${ref} on its way`);
    if (cleared) {
      this.charges.push(debit.charge);
      this.made.set(debit.key, taken(ref));
      debit.ended = "cleared";
    } else {
      this.made.set(debit.key, failed("insufficient_funds"));
      debit.ended = "insufficient_funds";
    }
  }

  // a card the payer saved, as if they'd approved saving it with their bank
  approvedCard(payerId: string, card: TestCard) {
    return this.save(payerId, card);
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
      card: { brand: "Test card", last4: LAST4[card] },
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

  // a payment made with the Client there, under the ref it was asked as if
  // their bank had to approve it first, as a Stripe PaymentIntent keeps its
  // id
  private take(input: Payment, paymentMethodId: string | null, ref?: string) {
    const chargeId = input.amount > 0 ? (ref ?? this.id("pi")) : null;
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

  async takeDeposit(input: DepositInput): Promise<PaymentResult> {
    this.check();
    const { idempotencyKey, ...request } = input;
    return this.once(
      idempotencyKey,
      request,
      () =>
        this.payWithClient(input, input.source, {
          // a card entered now is saved by this payment
          saves: "token" in input.source,
          banks: false,
        }),
      () => failed("idempotency_error"),
    );
  }

  async payBill(input: BillInput): Promise<PaymentResult> {
    this.check();
    const { idempotencyKey, ...request } = input;
    const { source } = input;
    const paid =
      "token" in source &&
      this.billsBy === "bank" &&
      !source.token.startsWith(BANK)
        ? { token: this.bankToken() }
        : source;
    return this.once(
      idempotencyKey,
      request,
      () =>
        this.payWithClient(input, paid, {
          saves: false,
          banks: true,
          again: input.again,
        }),
      () => failed("idempotency_error"),
    );
  }

  async payJob(input: JobInput): Promise<PaymentResult> {
    this.check();
    const { idempotencyKey, ...request } = input;
    return this.once(
      idempotencyKey,
      request,
      () =>
        this.payWithClient(
          input,
          { paymentMethodId: input.paymentMethodId },
          { saves: false, banks: false, again: input.again },
        ),
      () => failed("idempotency_error"),
    );
  }

  // A payment made with the Client there, from a card they entered just
  // now (or, when it `banks`, a bank account), saved by it when `saves`,
  // or from a card they saved before, which asks them to approve it only
  // when it always does (alwaysApproval), as their bank does then
  // (requireApproval). A saved card's is `again`, a Charge their bank
  // wanted approved, while it's for the same payment, as Stripe confirms
  // that PaymentIntent. Each one asked for is kept by its key in `made`,
  // for chargeOutcome to find, as the provider's metadata keeps it
  private payWithClient(
    input: Payment & { idempotencyKey: string },
    source: PaymentSource,
    {
      saves,
      banks,
      again = null,
    }: { saves: boolean; banks: boolean; again?: string | null },
  ): PaymentResult {
    const { idempotencyKey: key } = input;
    if ("token" in source && !source.token.startsWith("tok_test")) {
      return failed("invalid_token");
    }
    const bank = "token" in source && source.token.startsWith(BANK);
    if (bank && !banks) return failed("payment_method_not_allowed");
    if (
      "paymentMethodId" in source &&
      !this.paymentMethods.some(
        (m) =>
          m.paymentMethodId === source.paymentMethodId &&
          m.payerId === input.payerId,
      )
    ) {
      return failed("unknown_payment_method");
    }
    const savedId = "paymentMethodId" in source ? source.paymentMethodId : null;
    const open = again ? this.toApprove.get(again) : undefined;
    const reused =
      again &&
      savedId &&
      open?.payerId === input.payerId &&
      open.amount === input.amount &&
      !this.canceled.has(again)
        ? again
        : undefined;
    // the same payment confirmed again is no new one
    if (input.amount > 0 && !reused) this.attempt(input.payerId, input.amount);
    // a card's bank leaves it processing, as `charge` does, until
    // clearCharges(): Stripe never ends one "processing" at once
    // (docs/testing-log.md, 2026-11-26); it waits below, as one
    // finishCards() leaves does (critical review C18)
    const processing =
      this.chargeFailure === "processing" && input.amount > 0 && !bank;
    if (this.chargeFailure && !processing) {
      if (input.amount > 0) this.made.set(key, failed(this.chargeFailure));
      return failed(this.chargeFailure);
    }
    // a bank debit is processing for days, until it clears or fails
    if (bank) {
      const ref = this.id("pi");
      this.debits.set(ref, {
        key,
        charge: {
          payerId: input.payerId,
          paymentMethodId: null,
          amount: input.amount,
          description: input.description,
          chargeId: ref,
        },
        ended: null,
      });
      this.made.set(key, finishing(ref, "bank"));
      return finishing(ref, "bank");
    }
    const card =
      "token" in source
        ? cardOf(source.token)
        : (this.cards.get(source.paymentMethodId) ?? "visa");
    const declined = this.declines(card, true);
    // a card that declines payments still saves when nothing is taken
    if (declined && input.amount > 0) {
      this.made.set(key, failed(declined));
      return failed(declined);
    }
    if (reused) this.toApprove.delete(reused);
    const byCard =
      "token" in source &&
      (card === "approvalOnSetup" || card === "alwaysApproval");
    const asks =
      ("token" in source && (this.approval || byCard)) ||
      (savedId && card === "alwaysApproval");
    // which switch it's left processing by, until that switch lets it go;
    // a card that asks the Client asks first, as Stripe does (C20)
    const finishes =
      processing && !asks
        ? "charges"
        : this.cardsFinishing && "token" in source && input.amount > 0
          ? "cards"
          : null;
    if (finishes || asks) {
      const ref = reused ?? this.id(input.amount > 0 ? "pi" : "seti");
      this.waiting.set(ref, {
        input,
        key,
        card,
        paymentMethodId: savedId,
        byCard,
        saves,
        finishing: finishes,
      });
      const said = finishes ? finishing(ref, "card") : approving(ref);
      if (input.amount > 0) this.made.set(key, said);
      return said;
    }

    const saved =
      "token" in source && saves ? this.save(input.payerId, card) : null;
    const chargeId = this.take(
      input,
      saved?.paymentMethodId ?? savedId,
      reused,
    );
    const said = taken(chargeId, saved);
    if (chargeId) {
      this.made.set(key, taken(chargeId));
      this.takenAtOnce.set(chargeId, said);
    }
    return said;
  }

  async paymentOutcome(ref: string): Promise<PaymentResult> {
    this.check();
    const atOnce = this.takenAtOnce.get(ref);
    if (atOnce) return atOnce;
    const debit = this.debits.get(ref);
    if (debit) {
      if (!debit.ended) return finishing(ref, "bank");
      return debit.ended === "cleared" ? taken(ref) : failed(debit.ended);
    }
    const waiting = this.waiting.get(ref);
    if (!waiting) return failed("unknown_payment");
    if (this.canceled.has(ref)) return failed("canceled");
    // the bank's answer, once given (below), stays, whatever's asked of
    // the next payment (critical review C10)
    const answered = this.replies.get(`outcome:${ref}`);
    if (answered) return answered.reply as PaymentResult;
    if (
      (waiting.finishing === "cards" && this.cardsFinishing) ||
      waiting.finishing === "charges"
    ) {
      return finishing(ref, "card");
    }
    if (!waiting.byCard && this.approval === "processing") {
      return finishing(ref, "card");
    }
    if (waiting.byCard || this.approval === "pending") return approving(ref);
    // the bank answers once, and it's kept for the read above
    return this.once(
      `outcome:${ref}`,
      null,
      (): PaymentResult => {
        if (this.approval === "refused") {
          // as Stripe says it once the Client fails or closes the check
          const reason = "payment_intent_authentication_failure";
          if (waiting.input.amount > 0)
            this.made.set(waiting.key, failed(reason));
          return failed(reason);
        }
        const saved = waiting.saves
          ? this.save(waiting.input.payerId, waiting.card)
          : null;
        const chargeId = this.take(
          waiting.input,
          saved?.paymentMethodId ?? waiting.paymentMethodId,
          ref,
        );
        if (chargeId) this.made.set(waiting.key, taken(chargeId));
        return taken(chargeId, saved);
      },
      () => failed("idempotency_error"),
    );
  }

  // as at Stripe, refused once taken, called off already, or while a
  // card's bank is finishing it; the bank's answer, if it's given one, is
  // what decides
  async cancelPayment(ref: string, _why: CallingOff) {
    this.check();
    if (this.toApprove.has(ref) && !this.canceled.has(ref)) {
      this.canceled.add(ref);
      return;
    }
    const waiting = this.waiting.get(ref);
    if (!waiting || this.canceled.has(ref)) {
      throw new Error(`no payment ${ref} to call off`);
    }
    // read as paymentOutcome says it, so the two never disagree (#534
    // review F29)
    const said = await this.paymentOutcome(ref);
    if (said.status === "finishing") {
      throw new Error(`payment ${ref} is processing`);
    }
    if (said.status === "taken") {
      throw new Error(`payment ${ref} was taken`);
    }
    this.canceled.add(ref);
    const made = this.made.get(waiting.key);
    if (made && made.status !== "taken" && said.status !== "failed") {
      this.made.set(waiting.key, failed("canceled"));
    }
  }

  async charge(input: ChargeInput): Promise<PaymentResult> {
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
      (): PaymentResult => {
        this.attempt(input.payerId, input.amount);
        const declined =
          this.chargeFailure ??
          this.declines(this.cards.get(input.paymentMethodId) ?? "visa", false);
        const chargeId = this.id("pi");
        if (declined === "processing") {
          this.processing.set(idempotencyKey, { ...input, chargeId });
          this.made.set(idempotencyKey, finishing(chargeId, "card"));
        } else if (declined === APPROVE) {
          // left open for the Client to approve on its page
          this.toApprove.set(chargeId, {
            payerId: input.payerId,
            amount: input.amount,
          });
          this.made.set(idempotencyKey, failed(declined, chargeId));
        } else if (declined) {
          this.made.set(idempotencyKey, failed(declined));
        } else {
          this.charges.push({ ...input, chargeId });
          this.made.set(idempotencyKey, taken(chargeId));
        }
        return this.made.get(idempotencyKey)!;
      },
      () => failed("idempotency_error"),
    );
  }

  // as Stripe reads any PaymentIntent, a Charge's or one made with the
  // Client there (#534's critical review C1), with no card read as saved
  async chargeOutcome({
    idempotencyKey,
    chargeId,
  }: ChargeLookup): Promise<PaymentResult | null> {
    this.check();
    if (chargeId) {
      if ([...this.processing.values()].some((c) => c.chargeId === chargeId)) {
        return finishing(chargeId, "card");
      }
      if (this.debits.has(chargeId) || this.waiting.has(chargeId)) {
        const said = await this.paymentOutcome(chargeId);
        return said.status === "taken" ? { ...said, saved: null } : said;
      }
      if (this.toApprove.has(chargeId)) {
        return failed(this.canceled.has(chargeId) ? "canceled" : APPROVE);
      }
      return this.charges.some((c) => c.chargeId === chargeId)
        ? taken(chargeId)
        : null;
    }
    return this.made.get(idempotencyKey) ?? null;
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
