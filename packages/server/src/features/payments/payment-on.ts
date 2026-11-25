import type { BillPaying } from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { db, type Tx } from "../../db/index.ts";
import {
  attemptsFor,
  NOT_APPROVED,
  openOn,
  waitOf,
  type Offered,
} from "./money.ts";
import type { ChargeAttempt } from "./payments.schema.ts";
import { whyNotPaid } from "./unpaid.ts";

// Where the payments on a Bill, or on a Quote's Deposit, stand (#534), the
// one read each of its pages and each step that moves money on it makes:
// whether money may still move on it (`open`, ADR-0022's one rule,
// chargeOpen's), so nothing else that does starts; whether the Client's own
// payment on its page is among it (`onPage`), theirs to finish; one going
// through since `goingSince`, which may still take the money (ours to the
// saved card, or the Client's on its page: a bank debit, or one nobody
// heard the end of yet); the Client's bank asking them to approve theirs,
// until `approvingUntil`, when it's called off; or their latest payment on
// its page, which failed, and why, or which they never approved: no
// failure, as nothing was taken, but the page says so to one who comes back
// to it (#534's UX review U12). And the newest attempt, whatever it did,
// with a Deposit's offer: what a Quote's pages read for which clean it was,
// and whether it was given back
export type PaymentOn = {
  open: boolean;
  onPage: boolean;
  goingSince: Date | null;
  approvingUntil: Date | null;
  failed: { at: Date; reason: string; approved: boolean } | null;
  latest: { attempt: ChargeAttempt; offer: Offered | null } | null;
};

// whether a payment on it holds what it's for (ADR-0022's one rule), as a
// Bill's page says before Office Staff press Cancel bill or Record a
// payment (canCancelOrRecord): one going through, or the Client's bank
// asking them to approve theirs within its wait. One waited out holds
// nothing, as cancelling or recording calls it off first, as the alert
// promised (#534 review F11)
export const holds = (on: PaymentOn) =>
  on.goingSince !== null || on.approvingUntil !== null;

// the Client's payment on its page, as each page that shows it says it, in
// the reply's language: their bank asking them to approve it, or the
// latest, which failed (why, as Unpaid says it) or was never approved;
// null while one goes through, as that may still take it
export const pagePaying = (on: PaymentOn): BillPaying | null =>
  on.approvingUntil
    ? { status: "approving", until: on.approvingUntil.toISOString() }
    : on.failed && !on.goingSince
      ? on.failed.approved
        ? {
            status: "failed",
            at: on.failed.at.toISOString(),
            why: whyNotPaid(currentLanguage(), on.failed.reason).why,
          }
        : { status: "notApproved", at: on.failed.at.toISOString() }
      : null;

const NOT_PAYING: PaymentOn = {
  open: false,
  onPage: false,
  goingSince: null,
  approvingUntil: null,
  failed: null,
  latest: null,
};

// the call the Client makes on the page, by what it's for: a Bill paid on
// its page, or a Deposit paid on its Quote's
const onPageCall = { bill: "bill", deposit: "deposit" } as const;

// each Bill's, or each Quote's Deposit's, by its id, in two queries for a
// list
export const paymentOn = async (
  kind: keyof typeof onPageCall,
  ids: string[],
  tx: Tx | typeof db = db,
) => {
  const on = new Map<string, PaymentOn>();
  const decided = new Set<string>();
  const held = await openOn(ids, tx);
  for (const id of held) on.set(id, { ...NOT_PAYING, open: true });
  // newest first
  for (const { attempt, open, call, offer } of await attemptsFor(
    kind,
    ids,
    tx,
  )) {
    const paying = on.get(attempt.forId) ?? { ...NOT_PAYING };
    on.set(attempt.forId, paying);
    paying.latest ??= { attempt, offer };
    const onPage = call === onPageCall[kind];
    if (open) {
      if (onPage) paying.onPage = true;
      const wait = waitOf(attempt);
      if (!wait.onClient) paying.goingSince ??= attempt.askedAt;
      // past it, whoever acts next calls it off, or the Clock does
      else if (!wait.past) paying.approvingUntil ??= wait.until;
      continue;
    }
    if (decided.has(attempt.forId)) continue;
    // the latest that ended decides: taken, or ours to the saved card,
    // which the Bill's Unpaid tells
    decided.add(attempt.forId);
    if (attempt.status === "failed" && onPage) {
      paying.failed = failedOf(attempt);
    }
  }
  return (id: string) => on.get(id) ?? NOT_PAYING;
};

const failedOf = (attempt: ChargeAttempt): PaymentOn["failed"] => {
  const approved = !NOT_APPROVED(attempt.reason);
  return {
    // one that failed, when it did; one never approved, when it was made,
    // as the Office reads "the client's payment on Jan 12", not the day
    // the Clock called it off (#534's UX review U18)
    at: (approved && attempt.endedAt) || attempt.askedAt,
    reason: attempt.reason ?? "",
    approved,
  };
};
