import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { DAY_MS, MINUTE_MS } from "@empire-cleaning/models";
import { apart, db, type Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { monitoring } from "../../services/monitoring/index.ts";
import {
  paymentGateway,
  type CallingOff,
  type BillInput,
  type ChargeInput,
  type PaymentResult,
  type DepositInput,
  type RefundResult,
  type SavedPaymentMethod,
} from "../../services/payment-gateway/index.ts";
import { bills } from "../bills/bills.schema.ts";
import type { Client } from "../clients/clients.schema.ts";
import { idempotencyKey } from "./keys.ts";
import { payerFor } from "./payments.ts";
import {
  chargeAttempts,
  charges,
  refundAttempts,
  refunds,
  type Charge,
  type ChargeItem,
  type ChargeAttempt,
  type PaymentMethodRow,
  type RefundAttempt,
} from "./payments.schema.ts";

// Money moved off-session, and kept in our ledger of Charges and Refunds.
// Refunds made in the payment provider's dashboard are recorded too.
// The Deposit is taken while the Client accepts, and recorded once the
// booking it pays for is made; takeDepositOnce() asks for it.

// what a Charge is for: a Job's Balance, or the fee for one that didn't
// happen, or a weekly Bill (ADR-0016)
export type ChargeFor =
  { jobId: string; kind: "balance" | "fee" } | { billId: string; kind: "bill" };

// what charging came to: how much was taken, or why nothing more was
export type Taken = { ok: true; cents: number } | { ok: false; reason: string };

// why nothing was taken when the provider didn't answer
export const UNREACHABLE = "the payment provider couldn't be reached";
// why nothing was taken when what the provider made of it isn't known yet:
// a later try asks again
export const WAITING_ON_PROVIDER = [UNREACHABLE, "processing"];
// why nothing was taken from a Client with no card saved
export const NO_CARD = "no Payment Method is saved";

// ---- asking the provider once (#241) ----
//
// Each payment is an attempt, committed before the provider is asked, with
// its own idempotency key. If the reply never comes, or the transaction it
// was taken in rolls back, the next try for the same thing finds the
// attempt: asks again with its key within a day, while the provider still
// replays it and it asks what the try would ask now (the amount, on the
// card), or else looks the payment up; and records what was taken rather
// than taking it again. A declined attempt is over, so the next try asks
// the card afresh.

// long enough after asking that a try still waiting on its reply has had it
export const SETTLED_AFTER_MS = 15 * MINUTE_MS;

// How long a payment waits on the Client's bank, from when they pressed,
// before anyone may call it off (#534, Q1): time to find their bank's app
// and approve it, and not so long that Office Staff, on the phone with
// them, wait long to record their acceptance, send changes, or cancel or
// record a payment on a Bill. The Clock calls off one left longer, on its
// sweep of what's been open SETTLED_AFTER_MS (giveBackUnbookedDeposits,
// settleOpenPayments)
export const APPROVAL_MS = 15 * MINUTE_MS;

// the end of a payment's wait on the Client's bank, APPROVAL_MS after they
// pressed Pay
const waitUntil = (attempt: Pick<ChargeAttempt, "askedAt">) =>
  new Date(attempt.askedAt.getTime() + APPROVAL_MS);

// Who may call off a payment waiting on the Client's bank (ADR-0022's one
// rule): the Client at once, by paying again ("client_retried"); anyone
// else, Office Staff or the Clock ("abandoned"), once it's waited
// APPROVAL_MS. Their bank finishing it, or anything but a wait on them,
// nobody may (#534 critical review C2)
export const mayCallOff = (
  attempt: Pick<ChargeAttempt, "status" | "askedAt">,
  by: CallingOff,
) =>
  attempt.status === "approving" &&
  (by === "client_retried" || waitUntil(attempt) <= clock.now());

// How a payment the Client's bank was asked to approve holds its Quote or
// Bill, as the pages say it: it waits `onClient` till `until`; `past`,
// anyone may call it off (mayCallOff), so it holds nothing, as whoever acts
// next calls it off first (#534 review F11, F12)
export const waitOf = (attempt: Pick<ChargeAttempt, "status" | "askedAt">) => ({
  until: waitUntil(attempt),
  onClient: attempt.status === "approving",
  past: mayCallOff(attempt, "abandoned"),
});

// An attempt approvalOf reads: made with the Client there, and waiting on
// their bank, or approved and their card's bank finishing it. A bank debit
// on its way, or a Charge processing, chargeOutcome reads till it ends
export const readByApproval = (
  attempt: Pick<ChargeAttempt, "status" | "processingBy" | "request">,
) =>
  attempt.status === "approving" ||
  (attempt.status === "processing" &&
    attempt.processingBy === "card" &&
    (attempt.request as Asked).call !== "charge");

// why a payment made with the Client there wasn't taken, when it's because
// it was never approved: they left their bank's check, failed it, or it was
// called off. Theirs to try again, not a payment that didn't go through
export const NOT_APPROVED = (reason: string | null) =>
  reason === "canceled" || !!reason?.endsWith("_authentication_failure");

// the offer a Deposit is for: its Revision, and the Service chosen, by key,
// so a Quote's pages say which clean a payment was for, ended or not
// (#534's UX review U16); none on attempts made before it was kept
export type Offered = { revisionId: string; serviceKey: string };

// the provider call an attempt makes, as asked but for its key: a saved
// card charged, a Deposit, or a Bill the Client pays on its page; a
// Deposit's, by the Client or the Office, with the offer it's for
type Asked =
  | {
      call: "charge";
      input: Omit<ChargeInput, "idempotencyKey">;
      offer?: Offered;
    }
  | {
      call: "deposit";
      input: Omit<DepositInput, "idempotencyKey">;
      offer?: Offered;
    }
  | { call: "bill"; input: Omit<BillInput, "idempotencyKey"> };

// what a try would ask the provider for now, against which an earlier
// attempt it never heard the end of is sent again or only looked up: the
// amount, on the saved card (null for a card typed in now, which no earlier
// attempt named); null when it would ask for nothing
type Now = { amount: number; card: string | null } | null;

// the saved card a request names; a card typed in is a token, used once,
// so it names none
const savedCardOf = (asked: Asked) =>
  asked.call === "charge"
    ? asked.input.paymentMethodId
    : asked.call === "deposit" && "paymentMethodId" in asked.input.source
      ? asked.input.source.paymentMethodId
      : null;

// whether an earlier attempt asks what a try would ask now: as much, on the
// same saved card. A Deposit on a card typed in names a token, used once,
// which can't be told from the next one, so only the amount counts. A Bill
// paid on its page is never sent again, only looked up: the Client may have
// paid it since, or paid another way, and sending it would take it twice
// (#534 critical review C2)
const asksNow = (attempt: ChargeAttempt, now: Now) => {
  if (now?.amount !== attempt.amountCents) return false;
  const asked = attempt.request as Asked;
  if (asked.call === "bill") return false;
  const card = savedCardOf(asked);
  return !card || card === now.card;
};

// where an attempt stands once asked: taken (with the card a Deposit saved,
// when it's known), or not yet known, or not taken; or, asked just now,
// waiting on the Client's bank, or going through (finishing)
type Outcome =
  | {
      status: "taken";
      attempt: ChargeAttempt;
      saved: SavedPaymentMethod | null;
    }
  | { status: "unknown"; reason: string }
  | Extract<PaymentResult, { status: "approving" | "finishing" }>
  | { status: "failed"; reason: string };

// where an earlier attempt stands, as a try reads it before asking anew:
// one going through is waited on, as one not yet known (#534's F21)
type Earlier = Exclude<Outcome, { status: "finishing" }>;
const asEarlier = (outcome: Outcome): Earlier =>
  outcome.status === "finishing"
    ? { status: "unknown", reason: "processing" }
    : outcome;

// written outside the caller's transaction, so it stands whatever that does
const update = async (
  attempt: ChargeAttempt,
  set: Partial<
    Pick<
      ChargeAttempt,
      | "status"
      | "gatewayRef"
      | "reason"
      | "sentAt"
      | "givenBackAt"
      | "processingBy"
    >
  >,
) => {
  const ended = set.status === "taken" || set.status === "failed";
  const [updated] = await apart
    .update(chargeAttempts)
    .set(ended ? { ...set, endedAt: clock.now() } : set)
    .where(eq(chargeAttempts.id, attempt.id))
    .returning();
  return updated!;
};

// keeps what the provider said of an attempt
const keep = async (
  attempt: ChargeAttempt,
  said: PaymentResult,
): Promise<Outcome> => {
  switch (said.status) {
    case "taken":
      return {
        status: "taken",
        attempt: await update(attempt, {
          status: "taken",
          gatewayRef: said.chargeId,
        }),
        saved: said.saved,
      };
    // the Client's bank wants them there: open until they approve it,
    // or it's called off or refused (approvalOf), so nothing else on its
    // Quote takes money meanwhile (#534, F15)
    case "approving":
      await update(attempt, { status: "approving", gatewayRef: said.ref });
      return said;
    // not taken yet, nor declined, and too far on to call off: a card
    // whose bank finishes it, or a bank debit, which clears or fails days
    // later (readByApproval says which reads it till it ends). A Deposit's
    // is the Client's, with nothing to approve (#534's F21)
    case "finishing":
      await update(attempt, {
        status: "processing",
        gatewayRef: said.ref,
        processingBy: said.by,
      });
      return said;
    case "failed":
      await update(attempt, { status: "failed", reason: said.reason });
      return said;
  }
};

// asks the provider with the attempt's key; no reply leaves it pending
const ask = async (attempt: ChargeAttempt): Promise<Outcome> => {
  const asked = attempt.request as Asked;
  const key = idempotencyKey.charge(attempt);
  try {
    return await keep(
      attempt,
      asked.call === "charge"
        ? await paymentGateway.charge({ ...asked.input, idempotencyKey: key })
        : asked.call === "deposit"
          ? await paymentGateway.takeDeposit({
              ...asked.input,
              idempotencyKey: key,
            })
          : await paymentGateway.payBill({
              ...asked.input,
              idempotencyKey: key,
            }),
    );
  } catch (error) {
    monitoring.signal("payment_gateway_error", {
      what: `a Charge for ${attempt.kind} ${attempt.forId}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return { status: "unknown", reason: UNREACHABLE };
  }
};

// What an earlier attempt came to, asking the provider if we never heard.
// One never heard of is sent again, within the day the provider replays it,
// only while it asks what the try would ask `now`. Otherwise sending it
// would make a payment no longer wanted, if it never reached the provider,
// or charge a card the Client has since replaced (#534, F10, F13). So it's
// looked up instead. A changed request takes a new key once the first is
// known not to have run and not to be running still
// (https://docs.stripe.com/error-low-level#content-errors): not found, it
// may still be on its way for a quarter hour after it was last sent (the
// Clock may have sent it again since it was asked), and after that it was
// never made. One waiting on the Client's bank is read by approvalOf, and
// called off as `callOff` says (approving).
const outcomeOf = async (
  attempt: ChargeAttempt,
  now: Now,
  callOff: CallingOff | null = null,
): Promise<Earlier> => {
  if (attempt.status === "taken") {
    return { status: "taken", attempt, saved: null };
  }
  if (readByApproval(attempt)) return approving(attempt, callOff);
  const pending = attempt.status === "pending";
  const fresh = clock.now().getTime() - attempt.askedAt.getTime() < DAY_MS;
  if (pending && fresh && asksNow(attempt, now)) {
    return asEarlier(await ask(await update(attempt, { sentAt: clock.now() })));
  }
  const found = await paymentGateway
    .chargeOutcome({
      payerId: (attempt.request as Asked).input.payerId,
      idempotencyKey: idempotencyKey.charge(attempt),
      chargeId: attempt.gatewayRef,
      since: attempt.askedAt,
    })
    .catch(() => undefined);
  if (found === undefined) return { status: "unknown", reason: UNREACHABLE };
  // a payment made with the Client there, found waiting on their bank
  if (found?.status === "approving") {
    return approving(
      await update(attempt, { status: "approving", gatewayRef: found.ref }),
      callOff,
    );
  }
  if (found !== null) return asEarlier(await keep(attempt, found));
  const since = clock.now().getTime() - attempt.sentAt.getTime();
  if (pending && since < SETTLED_AFTER_MS) {
    return { status: "unknown", reason: UNREACHABLE };
  }
  await update(attempt, { status: "failed", reason: "never_made" });
  return { status: "failed", reason: "never_made" };
};

// A payment waiting on the Client's bank, called off as `callOff` says if
// it may be (mayCallOff). Until then it stays open, and what's asked waits
// on it.
const approving = async (
  attempt: ChargeAttempt,
  callOff: CallingOff | null,
): Promise<Earlier> => {
  const approval = await approvalOf(
    attempt.gatewayRef!,
    attempt,
    callOff && mayCallOff(attempt, callOff) ? callOff : null,
  );
  switch (approval.status) {
    case "taken":
      return {
        status: "taken",
        attempt: await update(attempt, {
          status: "taken",
          gatewayRef: approval.chargeId ?? attempt.gatewayRef,
        }),
        saved: approval.saved,
      };
    case "approving":
      return { status: "unknown", reason: "approving" };
    // the bank finishing it: read like a processing Charge's, till it ends
    case "finishing":
      return { status: "unknown", reason: "processing" };
    case "unknown":
      return { status: "unknown", reason: approval.reason };
    case "ended":
      return { status: "failed", reason: approval.reason };
    case "called_off":
      return { status: "failed", reason: "canceled" };
  }
};

// an attempt we never heard the end of, or waiting on the Client's bank,
// or that took money no Charge records yet
const isOpen = (tx: Tx | typeof db) =>
  or(
    inArray(chargeAttempts.status, ["pending", "processing", "approving"]),
    and(
      eq(chargeAttempts.status, "taken"),
      notExists(
        tx
          .select({ one: sql`1` })
          .from(charges)
          .where(eq(charges.gatewayRef, chargeAttempts.gatewayRef)),
      ),
    ),
  );

// the open attempts for a Job, Bill or Quote, of any kind: a Job asked for
// as a fee may be charged a Balance now
const openAttempts = (tx: Tx | typeof db, forId: string) =>
  tx
    .select()
    .from(chargeAttempts)
    .where(and(eq(chargeAttempts.forId, forId), isOpen(tx)))
    .orderBy(chargeAttempts.askedAt);

// The one rule (#533, #534; the owner, 2026-11-23: "Yes, I think the one
// rule makes sense"): while a payment we asked for a Job, Bill or Quote may
// still take the money, nothing else that moves money on it starts, by us,
// by the Client paying a Bill on its page, or by Office Staff cancelling a
// Bill or recording a payment made another way. On a Quote, that's a
// Deposit, waiting on the Client's bank too (`approving`): Office Staff
// can't record acceptance or send changes meanwhile (payingOf). Two at
// once would take it twice, or leave money to give back (ADR-0022). A
// refund we never heard the end of holds it too, as it may have given the
// money back: one for it, or from a Charge for it. Which of these Jobs,
// Bills or Quotes it holds, in two queries for a list
export const openOn = async (forIds: string[], tx: Tx | typeof db = db) => {
  if (forIds.length === 0) return new Set<string>();
  const charging = await tx
    .selectDistinct({ forId: chargeAttempts.forId })
    .from(chargeAttempts)
    .where(and(inArray(chargeAttempts.forId, forIds), isOpen(tx)));
  const refunding = await tx
    .selectDistinct({
      forId: refundAttempts.forId,
      jobId: charges.jobId,
      billId: charges.billId,
    })
    .from(refundAttempts)
    .innerJoin(charges, eq(charges.id, refundAttempts.chargeId))
    .where(
      and(
        or(
          inArray(refundAttempts.forId, forIds),
          inArray(charges.jobId, forIds),
          inArray(charges.billId, forIds),
        ),
        isOpenRefund(tx),
      ),
    );
  const asked = new Set(forIds);
  return new Set([
    ...charging.map((row) => row.forId),
    ...refunding
      .flatMap((row) => [row.forId, row.jobId, row.billId])
      .filter((id): id is string => id !== null && asked.has(id)),
  ]);
};

// whether it holds one
export const chargeOpen = async (forId: string, tx: Tx | typeof db = db) =>
  (await openOn([forId], tx)).has(forId);

// every attempt for these Bills (or Jobs, or Quotes), newest first, each
// with whether it's open (isOpen's), the provider call it made, and a
// Deposit's offer: what a Bill's or a Quote's pages read to say where its
// payments stand (paymentOn)
export const attemptsFor = async (
  kind: ChargeAttempt["kind"],
  forIds: string[],
  tx: Tx | typeof db = db,
) =>
  forIds.length === 0
    ? []
    : (
        await tx
          .select({
            attempt: chargeAttempts,
            open: sql<boolean>`${isOpen(tx)}`.mapWith(Boolean),
          })
          .from(chargeAttempts)
          .where(
            and(
              eq(chargeAttempts.kind, kind),
              inArray(chargeAttempts.forId, forIds),
            ),
          )
          // the write order (created_at) breaks the Clock's tie, as in the
          // payment history
          .orderBy(desc(chargeAttempts.askedAt), desc(chargeAttempts.createdAt))
      ).map((row) => {
        const asked = row.attempt.request as Asked;
        return {
          ...row,
          call: asked.call,
          offer: ("offer" in asked && asked.offer) || null,
        };
      });

// ---- a payment waiting on the Client's bank (#534) ----
//
// An attempt "approving", a Deposit or a Bill paid on its page, may still
// be approved, for as long as the bank lets it, so it's open: nothing else
// that moves money on its Quote or Bill starts until it's taken, refused or
// called off. Within APPROVAL_MS only the Client may call it off, by paying
// again; after it, anyone acting on it calls it off first, and the Clock
// does if nobody does. Calling off
// can lose to the bank approving it just then, so it's read again after:
// one approved is the Deposit (https://docs.stripe.com/api/payment_intents/cancel).

// where a payment waiting on the Client's bank stands
export type Approval =
  // their bank approved it: taken; no charge when it only saved their
  // card, a 0% Deposit
  | {
      status: "taken";
      chargeId: string | null;
      saved: SavedPaymentMethod | null;
    }
  // still asking them, and not called off
  | { status: "approving" }
  // their bank is finishing it, so it can't be called off
  | { status: "finishing" }
  // called off just now, by this call: never taken
  | { status: "called_off" }
  // refused, or called off before: never taken
  | { status: "ended"; reason: string }
  // the provider not reached, or a call-off that didn't reach it: tried
  // again on the next read
  | { status: "unknown"; reason: string };

/**
 * Where a payment waiting on the Client's bank, `ref`, stands, asking the
 * provider; one that ended is written so on its `attempt`. One that only
 * saves a card, no money moving, has none. `callOff` calls off one still
 * waiting, saying why. One the bank refused is called off too, so it can't
 * be paid later on the same payment with another card.
 */
export const approvalOf = async (
  ref: string,
  attempt: ChargeAttempt | undefined,
  callOff: CallingOff | null,
): Promise<Approval> => {
  const read = () => paymentGateway.paymentOutcome(ref).catch(() => undefined);
  let said = await read();
  let calledOff = false;
  if (said?.status === "approving" && callOff) {
    // refused when it's just been taken, or has started processing, or the
    // provider couldn't be reached: read again
    calledOff = await paymentGateway.cancelPayment(ref, callOff).then(
      () => true,
      () => false,
    );
    said = await read();
    // still asking the Client: the call-off didn't reach the provider, and
    // is tried again on the next read (#534 critical review C8)
    if (said?.status === "approving") {
      return { status: "unknown", reason: UNREACHABLE };
    }
  }
  if (!said) return { status: "unknown", reason: UNREACHABLE };
  switch (said.status) {
    case "approving":
      return { status: "approving" };
    // approved, and too far on to call off: the pages hold its Quote or
    // Bill till it ends, saying so (payingOf, paymentOn)
    case "finishing":
      if (attempt?.status === "approving") {
        await update(attempt, { status: "processing", processingBy: said.by });
      }
      return { status: "finishing" };
    case "taken":
      return {
        status: "taken",
        chargeId: said.chargeId,
        saved: said.saved,
      };
    case "failed": {
      // called off so it can't be paid later with the secret the browser
      // holds, a 0 Deposit's card save too, which has no attempt (#534 plan
      // review F1); a call-off that failed is tried again on each read
      // (#534 review F20)
      if (said.reason !== "canceled") {
        await paymentGateway
          .cancelPayment(ref, "abandoned")
          .catch(() => undefined);
      }
      if (!attempt) return { status: "ended", reason: said.reason };
      // its first answer stands: one refused, then called off by us so it
      // can't be paid later, still ended refused (#534 review F17)
      const open = readByApproval(attempt);
      const reason = open ? said.reason : (attempt.reason ?? said.reason);
      if (open) await update(attempt, { status: "failed", reason });
      return calledOff ? { status: "called_off" } : { status: "ended", reason };
    }
  }
};

// the Deposit attempt the provider knows as `ref`
export const depositAttemptOf = async (
  ref: string,
  tx: Tx | typeof db = db,
) => {
  const [found] = await tx
    .select()
    .from(chargeAttempts)
    .where(
      and(
        eq(chargeAttempts.kind, "deposit"),
        eq(chargeAttempts.gatewayRef, ref),
      ),
    );
  return found;
};

// an approved Deposit, booked: in the booking's transaction, so it's taken
// once its Charge is recorded, and still approving if that rolls back
export const keepTaken = (tx: Tx, attempt: ChargeAttempt) =>
  tx
    .update(chargeAttempts)
    .set({ status: "taken" })
    .where(eq(chargeAttempts.id, attempt.id));

// a new attempt, committed, then asked
const attempt = async (
  kind: ChargeAttempt["kind"],
  forId: string,
  asked: Asked,
): Promise<Outcome> => {
  const now = clock.now();
  const [made] = await apart
    .insert(chargeAttempts)
    .values({
      kind,
      forId,
      request: asked,
      amountCents: asked.input.amount,
      askedAt: now,
      sentAt: now,
    })
    .returning();
  return ask(made!);
};

const forIdOf = (chargeFor: ChargeFor) =>
  "jobId" in chargeFor ? chargeFor.jobId : chargeFor.billId;

// the Charge an attempt took, recorded
const record = async (
  tx: Tx,
  chargeFor: ChargeFor,
  taken: ChargeAttempt,
  item: ChargeItem | null,
) => {
  const [charge] = await tx
    .insert(charges)
    .values({
      ...("jobId" in chargeFor
        ? { jobId: chargeFor.jobId, kind: taken.kind as "balance" | "fee" }
        : { billId: chargeFor.billId, kind: "bill" as const }),
      item,
      amountCents: taken.amountCents,
      gatewayRef: taken.gatewayRef!,
      chargedAt: taken.askedAt,
    })
    .returning();
  return charge!;
};

/**
 * Records what earlier attempts for a Job or Bill took that no Charge
 * records yet, asking the provider how each ended: the Charges, or why
 * that isn't known yet. `owed` is what the Job or Bill owes without them,
 * on the card a try would ask now (outcomeOf); each found taken takes it
 * down. One waiting on the Client's bank is called off as `callOff` says
 * (approving).
 */
export const recordTakenEarlier = async (
  tx: Tx,
  chargeFor: ChargeFor,
  owed: Now,
  callOff: CallingOff | null = null,
): Promise<Charge[] | { unknown: string }> => {
  const recorded: Charge[] = [];
  let now = owed;
  for (const earlier of await openAttempts(tx, forIdOf(chargeFor))) {
    const outcome = await outcomeOf(earlier, now, callOff);
    if (outcome.status === "unknown") return { unknown: outcome.reason };
    if (outcome.status === "taken") {
      recorded.push(await record(tx, chargeFor, outcome.attempt, null));
      if (now)
        now = { ...now, amount: now.amount - outcome.attempt.amountCents };
    }
  }
  return recorded;
};

// what's charged: a Client's saved Payment Method, without them there; or,
// on a Bill's page, the card or bank account they just entered (`token`),
// for the Bill `reference` names
export type PaySource = PaymentMethodRow | { token: string; reference: string };

// a Bill paid on its page whose bank wants the Client to approve it in the
// browser, with `secret`; the attempt waits on it (approving). Its reason
// is an Unpaid one, which unpaid.ts words, should it ever be stored
export type NeedsApproval = {
  ok: false;
  reason: "needs_approval";
  secret: string;
};

/**
 * Charges a Client, from `source`, and records the Charge. What an earlier
 * try for the same thing took, whose reply was lost or whose transaction
 * rolled back, is recorded first and counts towards `amount`; only the
 * rest is asked for, and if that isn't taken it's why, as the rest is still
 * owed. An earlier one waiting on the Client's bank is called off as
 * `callOff` says, or else waits (approving). Never throws for money that
 * couldn't be taken: no Payment Method saved, a decline, the provider
 * unreachable (or an earlier try still unknown), or a bank debit processing
 * each come back as why, for the caller to make what it charged for Unpaid.
 */
export const chargeSaved = async (
  tx: Tx,
  {
    client,
    source,
    amount,
    description,
    for: chargeFor,
    item = null,
    callOff = "abandoned",
  }: {
    client: Pick<Client, "id" | "name" | "email" | "preferredLanguage">;
    source: PaySource | null;
    amount: number;
    description: string;
    for: ChargeFor;
    // the one change to the price it's for, by name, if it is
    item?: ChargeItem | null;
    callOff?: CallingOff;
  },
): Promise<Taken | NeedsApproval> => {
  if (!source) return { ok: false, reason: NO_CARD };
  const saved = "gatewayRef" in source ? source.gatewayRef : null;
  const earlier = await recordTakenEarlier(
    tx,
    chargeFor,
    { amount, card: saved },
    callOff,
  );
  // it may yet take the money, so nothing more is asked for meanwhile
  if ("unknown" in earlier) return { ok: false, reason: earlier.unknown };
  let cents = earlier.reduce((sum, c) => sum + c.amountCents, 0);
  if (cents >= amount) return { ok: true, cents };

  const payerId = await payerFor(client).catch((error: unknown) => {
    monitoring.signal("payment_gateway_error", {
      what: `a payer for Client ${client.id}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  if (!payerId) return { ok: false, reason: UNREACHABLE };
  const rest = amount - cents;
  const outcome = await attempt(
    chargeFor.kind,
    forIdOf(chargeFor),
    saved
      ? {
          call: "charge",
          input: { payerId, paymentMethodId: saved, amount: rest, description },
        }
      : {
          call: "bill",
          input: {
            payerId,
            token: (source as { token: string }).token,
            amount: rest,
            description,
            reference: (source as { reference: string }).reference,
          },
        },
  );
  // what an earlier try took is recorded, but the rest is still owed
  // (#534, F2)
  if (outcome.status === "approving") {
    return { ok: false, reason: "needs_approval", secret: outcome.secret };
  }
  if (outcome.status === "finishing") {
    return { ok: false, reason: "processing" };
  }
  if (outcome.status !== "taken") return { ok: false, reason: outcome.reason };
  await record(tx, chargeFor, outcome.attempt, item);
  return { ok: true, cents: cents + outcome.attempt.amountCents };
};

// what taking a Deposit came to: as the provider says, a Client's going
// through (finishing) for its pending Deposit to book once it's done; or
// an earlier Deposit the Client's bank approved, `ref`, which is the
// Deposit, for its pending Deposit to book (finalizeDeposit); or nothing
// more taken, as an earlier one their bank is still finishing can't be
// called off
export type DepositTaken =
  | PaymentResult
  | { status: "approved"; ref: string }
  | { status: "still_finishing" };

// The card a taken Deposit on a card typed in saved, as the provider has
// it: a reply lost, or a booking rolled back, kept none (#534, B#1b), and
// without it the Deposit would be given back and taken again
const withSaved = async (outcome: Earlier): Promise<Earlier> => {
  if (outcome.status !== "taken" || outcome.saved) return outcome;
  const asked = outcome.attempt.request as Asked;
  if (asked.call !== "deposit" || "paymentMethodId" in asked.input.source) {
    return outcome;
  }
  const said = await paymentGateway
    .paymentOutcome(outcome.attempt.gatewayRef!)
    .catch(() => undefined);
  if (said === undefined) return { status: "unknown", reason: UNREACHABLE };
  return said.status === "taken" ? { ...outcome, saved: said.saved } : outcome;
};

/**
 * Takes a Quote's Deposit once, however often accepting it is tried: a
 * Deposit an earlier try took, whose reply was lost or whose booking rolled
 * back unrecorded, is the Deposit, if it was for as much and the card it
 * saved (if any) is known; otherwise it's given back, and a new one taken.
 * An earlier try still unknown takes nothing more. `call` says how: on
 * session, as the Client accepts, or as a Charge, as the Office does.
 *
 * One still waiting on the Client's bank is called off first, as `callOff`
 * says why; one their bank approved is the Deposit while its pending
 * Deposit, among the `unsettled` refs, can still book it, and is given
 * back if not. One their bank is finishing takes nothing more. One that
 * can't be given back takes nothing more either, for the Clock to give it
 * back: two at once would be the Client charged twice.
 */
export const takeDepositOnce = async (
  tx: Tx,
  quoteId: string,
  asked: Asked,
  { callOff, unsettled }: { callOff: CallingOff; unsettled: Set<string> },
): Promise<DepositTaken> => {
  for (const earlier of await openAttempts(tx, quoteId)) {
    if (readByApproval(earlier)) {
      // the Client may call it off (mayCallOff); Office Staff get here only
      // once payingOf finds none they may not, as the one the Client holds
      // has its pending Deposit. One with none, its acceptance rolled back,
      // no browser holds, so nobody can approve it, and it's called off
      const approval = await approvalOf(earlier.gatewayRef!, earlier, callOff);
      if (approval.status === "ended" || approval.status === "called_off") {
        continue;
      }
      if (approval.status === "taken") {
        if (unsettled.has(earlier.gatewayRef!)) {
          return { status: "approved", ref: earlier.gatewayRef! };
        }
        if (
          !(await giveBackDeposit(
            approval.chargeId,
            earlier.amountCents,
            quoteId,
          ))
        ) {
          return { status: "failed", reason: UNREACHABLE };
        }
        continue;
      }
      return approval.status === "unknown"
        ? { status: "failed", reason: approval.reason }
        : { status: "still_finishing" };
    }
    const outcome = await withSaved(
      await outcomeOf(
        earlier,
        { amount: asked.input.amount, card: savedCardOf(asked) },
        callOff,
      ),
    );
    if (outcome.status === "unknown") {
      return { status: "failed", reason: outcome.reason };
    }
    if (outcome.status !== "taken") continue;
    const before = earlier.request as Asked;
    const savedNothing =
      before.call !== "deposit" || "paymentMethodId" in before.input.source;
    if (
      outcome.attempt.amountCents === asked.input.amount &&
      (savedNothing || outcome.saved)
    ) {
      return {
        status: "taken",
        chargeId: outcome.attempt.gatewayRef!,
        saved: outcome.saved,
      };
    }
    if (
      !(await giveBackDeposit(
        outcome.attempt.gatewayRef!,
        outcome.attempt.amountCents,
        quoteId,
      ))
    ) {
      return { status: "failed", reason: UNREACHABLE };
    }
  }

  const outcome = await attempt("deposit", quoteId, asked);
  switch (outcome.status) {
    case "taken":
      return {
        status: "taken",
        chargeId: outcome.attempt.gatewayRef!,
        saved: outcome.saved,
      };
    case "unknown":
      return { status: "failed", reason: outcome.reason };
    // the Office's Charge going through has no pending Deposit to book it,
    // so it's read again, as any Charge processing is (outcomeOf)
    case "finishing":
      return asked.call === "deposit"
        ? outcome
        : { status: "failed", reason: "processing" };
    default:
      return outcome;
  }
};

// A Deposit was taken but nothing was booked: give it back. Whether it
// was given back: one that only saved a card, at 0%, has no charge, and
// nothing to give (#534 critical review C1)
export const giveBackDeposit = async (
  chargeId: string | null,
  amount: number,
  quoteId: string,
) => {
  if (!chargeId) return true;
  const ofIt = eq(chargeAttempts.gatewayRef, chargeId);
  const refunded = await paymentGateway
    .refund({
      chargeId,
      amount,
      idempotencyKey: idempotencyKey.givingBack(chargeId),
    })
    .catch((e: unknown) => ({ ok: false, reason: String(e) }) as const);
  if (!refunded.ok) {
    // taken but not booked: refund it by hand
    monitoring.signal("refund_failed", {
      chargeId,
      quoteId,
      cents: amount,
      reason: refunded.reason,
    });
    return false;
  }
  await apart
    .update(chargeAttempts)
    .set({ status: "given_back", givenBackAt: clock.now() })
    .where(ofIt);
  return true;
};

/**
 * Gives back what earlier tries to accept a Quote took as its Deposit, when
 * no booking recorded it: their reply was lost, and the Client didn't try
 * again. Hold the Quote, so no try to accept it is taking one meanwhile.
 *
 * One waiting on the Client's bank longer than APPROVAL_MS is called off.
 * One their bank approved is left to its pending Deposit to book, while
 * it's among the `unsettled` refs; once that's settled without booking it
 * (giving it back failed), it's given back here. The refs of those given
 * back, and of those it called off, for the Client to be told. One their
 * bank is finishing, too far on to call off, is left, and holds the Quote
 * till it ends (approvalOf, payingOf; #534 critical review C2).
 */
export const giveBackUnbookedDeposits = async (
  tx: Tx,
  quoteId: string,
  unsettled: Set<string>,
) => {
  const givenBack: string[] = [];
  const calledOff: string[] = [];
  for (const earlier of await openAttempts(tx, quoteId)) {
    if (readByApproval(earlier)) {
      // not asked after within its wait, whatever it's doing
      if (waitUntil(earlier) > clock.now()) continue;
      const approval = await approvalOf(
        earlier.gatewayRef!,
        earlier,
        mayCallOff(earlier, "abandoned") ? "abandoned" : null,
      );
      if (approval.status === "called_off") calledOff.push(earlier.gatewayRef!);
      if (
        approval.status === "taken" &&
        !unsettled.has(earlier.gatewayRef!) &&
        (await giveBackDeposit(approval.chargeId, earlier.amountCents, quoteId))
      ) {
        givenBack.push(earlier.gatewayRef!);
      }
      continue;
    }
    const outcome = await outcomeOf(earlier, null);
    if (outcome.status !== "taken") continue;
    await giveBackDeposit(
      outcome.attempt.gatewayRef!,
      outcome.attempt.amountCents,
      quoteId,
    );
  }
  return { givenBack, calledOff };
};

// ---- giving back once (#241) ----
//
// As with Charges: each refund is an attempt, committed before the provider
// is asked, with its own idempotency key. One the provider made, but whose
// reply was lost or whose transaction rolled back, is recorded by the next
// try for the same thing rather than given again: asked again with its key
// within a day, or else looked up by it.

// what the provider said of a refund attempt, kept outside the caller's
// transaction
const keepRefund = async (
  attempt: RefundAttempt,
  reply: RefundResult,
): Promise<RefundResult> => {
  await apart
    .update(refundAttempts)
    .set(
      reply.ok
        ? { status: "made", gatewayRef: reply.refundId }
        : { status: "refused", reason: reply.reason },
    )
    .where(eq(refundAttempts.id, attempt.id));
  return reply;
};

// asks the provider with the attempt's key; null when no reply came, which
// leaves it pending
const askRefund = async (
  attempt: RefundAttempt,
  gatewayChargeId: string,
): Promise<RefundResult | null> => {
  try {
    return await keepRefund(
      attempt,
      await paymentGateway.refund({
        chargeId: gatewayChargeId,
        amount: attempt.amountCents,
        idempotencyKey: idempotencyKey.refund(attempt),
      }),
    );
  } catch (error) {
    monitoring.signal("payment_gateway_error", {
      what: `a refund for ${attempt.forId}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

// what an earlier refund attempt came to, asking the provider if we never
// heard; null while that's still unknown
const refundOutcomeOf = async (
  attempt: RefundAttempt,
  gatewayChargeId: string,
): Promise<RefundResult | null> => {
  if (attempt.status === "made") {
    return { ok: true, refundId: attempt.gatewayRef! };
  }
  if (clock.now().getTime() - attempt.askedAt.getTime() < DAY_MS) {
    return askRefund(attempt, gatewayChargeId);
  }
  const found = await paymentGateway
    .refundOutcome({
      chargeId: gatewayChargeId,
      idempotencyKey: idempotencyKey.refund(attempt),
    })
    .catch(() => undefined);
  if (found === undefined) return null;
  return keepRefund(attempt, found ?? { ok: false, reason: "never_made" });
};

// a refund attempt we never heard the end of, or that gave back money no
// Refund records yet
const isOpenRefund = (tx: Tx | typeof db) =>
  or(
    eq(refundAttempts.status, "pending"),
    and(
      eq(refundAttempts.status, "made"),
      notExists(
        tx
          .select({ one: sql`1` })
          .from(refunds)
          .where(eq(refunds.gatewayRef, refundAttempts.gatewayRef)),
      ),
    ),
  );

// the open refund attempts for something, with the Charge each is from
const openRefundAttempts = (tx: Tx | typeof db, forId: string) =>
  tx
    .select({ attempt: refundAttempts, charge: charges })
    .from(refundAttempts)
    .innerJoin(charges, eq(charges.id, refundAttempts.chargeId))
    .where(and(eq(refundAttempts.forId, forId), isOpenRefund(tx)))
    .orderBy(refundAttempts.askedAt);

const recordRefund = (
  tx: Tx | typeof db,
  attempt: RefundAttempt,
  refundId: string,
) =>
  tx.insert(refunds).values({
    chargeId: attempt.chargeId,
    item: attempt.item,
    jobId: attempt.jobId,
    creditBillId: attempt.creditBillId,
    amountCents: attempt.amountCents,
    gatewayRef: refundId,
    refundedAt: attempt.askedAt,
  });

/**
 * What earlier refunds for something gave back that no Refund records yet,
 * recorded now, in cents; and whether one may still give it back
 * (`unknown`), which holds it, as an open Charge attempt does: nothing
 * else that moves money on it starts meanwhile (the one rule, #534)
 */
export const recordGivenEarlier = async (tx: Tx | typeof db, forId: string) => {
  let given = 0;
  for (const { attempt, charge } of await openRefundAttempts(tx, forId)) {
    const outcome = await refundOutcomeOf(attempt, charge.gatewayRef);
    if (!outcome) return { given, unknown: true };
    if (outcome.ok) {
      await recordRefund(tx, attempt, outcome.refundId);
      given += attempt.amountCents;
    }
  }
  return { given, unknown: false };
};

// what a refund gives back for, and how its Refund is recorded
type RefundFor = {
  // the Job, Bill or Bill's credit: a later try for the same thing finds
  // what an earlier one gave back
  for: string;
  // the one change to the price it gives back for, by name, if it is
  item?: ChargeItem | null;
  // when `from` are Bills' Charges: the Job it gives back for, or the Bill
  // whose credit it is
  jobId?: string | null;
  creditBillId?: string | null;
};

/**
 * Gives back up to `amount` from these Charges, latest first, each only as
 * far as it hasn't been refunded already, and records each Refund. What an
 * earlier try for the same thing gave back unrecorded is recorded first,
 * and counts towards `amount`. Stops at the first refund that fails, or
 * whose outcome isn't known yet, so trying again later takes up from there.
 * Returns how much it gave back.
 */
export const refundFrom = async (
  tx: Tx | typeof db,
  from: Charge[],
  amount: number,
  { for: forId, item = null, jobId = null, creditBillId = null }: RefundFor,
): Promise<number> => {
  if (amount <= 0) return 0;
  const earlier = await recordGivenEarlier(tx, forId);
  let left = Math.max(amount - earlier.given, 0);
  // it may yet be given, so nothing more is meanwhile
  if (earlier.unknown || left === 0 || from.length === 0) {
    return amount - left;
  }

  const given = await tx
    .select()
    .from(refunds)
    .where(
      inArray(
        refunds.chargeId,
        from.map((c) => c.id),
      ),
    );
  // one whose refund failed after it was made won't take another: the card
  // behind it is gone, so the Office gives it back another way
  const refusing = new Set(
    given.filter((r) => r.failedAt).map((r) => r.chargeId),
  );
  const latestFirst = [...from].sort(
    (a, b) =>
      b.chargedAt.getTime() - a.chargedAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  for (const charge of latestFirst) {
    if (left === 0) break;
    if (refusing.has(charge.id)) continue;
    const already = given
      .filter((r) => r.chargeId === charge.id && !r.failedAt)
      .reduce((sum, r) => sum + r.amountCents, 0);
    const part = Math.min(left, charge.amountCents - already);
    if (part <= 0) continue;
    const [attempt] = await apart
      .insert(refundAttempts)
      .values({
        forId,
        chargeId: charge.id,
        amountCents: part,
        item,
        jobId,
        creditBillId,
        askedAt: clock.now(),
      })
      .returning();
    const refunded = await askRefund(attempt!, charge.gatewayRef);
    if (!refunded) break;
    if (!refunded.ok) {
      monitoring.signal("refund_failed", {
        chargeId: charge.id,
        cents: part,
        reason: refunded.reason,
      });
      break;
    }
    await recordRefund(tx, attempt!, refunded.refundId);
    left -= part;
  }
  return amount - left;
};

/**
 * Records the refunds of a Charge that were made in the payment provider's
 * dashboard, not by us, each once, as the counted refunded_at_provider
 * signal says. The Client owes that much less: settling never charges it
 * back (refundedAtProvider). A payment we have no Charge for is only
 * signalled.
 */
export const recordRefundsAtProvider = async (gatewayChargeId: string) => {
  const [charge] = await db
    .select()
    .from(charges)
    .where(eq(charges.gatewayRef, gatewayChargeId));
  if (!charge) {
    monitoring.signal("refunded_at_provider", { ref: gatewayChargeId });
    return;
  }
  for (const refund of await paymentGateway.refundsElsewhere(gatewayChargeId)) {
    const recorded = await db
      .insert(refunds)
      .values({
        chargeId: charge.id,
        amountCents: refund.amount,
        gatewayRef: refund.refundId,
        refundedAt: refund.at,
        atProvider: true,
      })
      // told of before, or one of ours made before they were marked
      .onConflictDoNothing({ target: refunds.gatewayRef })
      .returning({ id: refunds.id });
    if (recorded.length > 0) {
      monitoring.signal("refunded_at_provider", {
        chargeId: charge.id,
        cents: refund.amount,
      });
    }
  }
};

// what the refunds made in the provider's dashboard took off what a
// Client owes: a discount, never charged back
export const refundedAtProvider = (
  given: { amountCents: number; atProvider: boolean }[],
) =>
  given.filter((r) => r.atProvider).reduce((sum, r) => sum + r.amountCents, 0);

/**
 * A refund the provider made, then failed (#241): it counts for nothing
 * from now on, as the money wasn't given back. One made in the dashboard
 * was a discount, now undone; one of ours leaves the Job (or the Bill's
 * credit) owed back again, which the urgent refund_failed signal tells the
 * Office to give another way, as settling won't refund that Charge again.
 * Told twice, it's one failure.
 */
export const recordRefundFailed = async (gatewayRefundId: string) => {
  const [failed] = await db
    .update(refunds)
    .set({ failedAt: clock.now() })
    .where(
      and(eq(refunds.gatewayRef, gatewayRefundId), isNull(refunds.failedAt)),
    )
    .returning();
  if (!failed) {
    const [known] = await db
      .select({ id: refunds.id })
      .from(refunds)
      .where(eq(refunds.gatewayRef, gatewayRefundId));
    // not one we recorded: for us to look into
    if (!known) monitoring.signal("refund_failed", { ref: gatewayRefundId });
    return;
  }
  if (failed.creditBillId) {
    await db
      .update(bills)
      .set({
        creditRefundedCents: sql`${bills.creditRefundedCents} - ${failed.amountCents}`,
        creditRefundedAt: null,
      })
      .where(eq(bills.id, failed.creditBillId));
  }
  monitoring.signal("refund_failed", {
    chargeId: failed.chargeId,
    cents: failed.amountCents,
    atProvider: failed.atProvider,
    reason: "failed at the provider after it was made",
  });
};

/**
 * What waits on payments asked for before `before` that are still open:
 * the Jobs, Bills and Quotes Charge attempts were for, and the Jobs and
 * Charges refund attempts were for. A credit's refunds are left to the run
 * that refunds lapsed credits, which tries them again anyway.
 */
export const openBefore = async (before: Date) => {
  const charging = await db
    .selectDistinct({ kind: chargeAttempts.kind, forId: chargeAttempts.forId })
    .from(chargeAttempts)
    .where(and(lte(chargeAttempts.askedAt, before), isOpen(db)));
  const refunding = await db
    .selectDistinct({
      forId: refundAttempts.forId,
      chargeId: refundAttempts.chargeId,
    })
    .from(refundAttempts)
    .where(
      and(
        lte(refundAttempts.askedAt, before),
        isNull(refundAttempts.creditBillId),
        isOpenRefund(db),
      ),
    );
  const of = (kinds: ChargeAttempt["kind"][]) =>
    charging.filter((a) => kinds.includes(a.kind)).map((a) => a.forId);
  return {
    jobs: [
      ...of(["balance", "fee"]),
      // a Job's refunds are for it; all of a Charge's are for the Charge
      ...refunding.filter((r) => r.forId !== r.chargeId).map((r) => r.forId),
    ],
    bills: of(["bill"]),
    quotes: of(["deposit"]),
    charges: refunding
      .filter((r) => r.forId === r.chargeId)
      .map((r) => r.chargeId),
  };
};
