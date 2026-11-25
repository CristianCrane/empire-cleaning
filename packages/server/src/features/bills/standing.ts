import type { BillPaying, Unpaid } from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { db, type Tx } from "../../db/index.ts";
import {
  attemptsFor,
  NOT_APPROVED,
  openOn,
  waitOf,
} from "../payments/money.ts";
import { unpaidOf, whyNotPaid } from "../payments/unpaid.ts";
import type { Bill } from "./bills.schema.ts";

// Where the payments on a Bill stand (#534), the one read each of its pages
// and each step that moves money on it makes: whether money may still move
// on it (`open`, ADR-0022's one rule, chargeOpen's), so nothing else that
// does starts; whether the Client's own payment on its page is among it
// (`onPage`), theirs to finish; one going through since `goingSince`,
// which may still take the money (ours to the saved card, or the Client's
// on its page: a bank debit, or one nobody heard the end of yet); the
// Client's bank asking them to approve theirs, until `approvingUntil`, when
// it's called off; or their latest payment on its page, which failed, and
// why, or which they never approved: no failure, as nothing was taken, but
// the page says so to one who comes back to it (#534's UX review U12)
export type PaymentOn = {
  open: boolean;
  onPage: boolean;
  goingSince: Date | null;
  approvingUntil: Date | null;
  failed: { at: Date; reason: string; approved: boolean } | null;
};

// whether a payment on it holds the Bill (ADR-0022's one rule), as its
// page says before Office Staff press Cancel bill or Record a payment
// (canCancelOrRecord): one going through, or the Client's bank asking them
// to approve theirs within its wait. One waited out holds nothing, as
// cancelling or recording calls it off first, as the alert promised
// (#534 review F11)
export const holds = (on: PaymentOn) =>
  on.goingSince !== null || on.approvingUntil !== null;

const NOT_PAYING: PaymentOn = {
  open: false,
  onPage: false,
  goingSince: null,
  approvingUntil: null,
  failed: null,
};

// each Bill's, by its id, in two queries for a list
export const paymentOn = async (billIds: string[], tx: Tx | typeof db = db) => {
  const on = new Map<string, PaymentOn>();
  const decided = new Set<string>();
  const held = await openOn(billIds, tx);
  for (const billId of held) on.set(billId, { ...NOT_PAYING, open: true });
  // newest first
  for (const { attempt, open, call } of await attemptsFor(
    "bill",
    billIds,
    tx,
  )) {
    const paying = on.get(attempt.forId) ?? { ...NOT_PAYING };
    on.set(attempt.forId, paying);
    if (open) {
      if (call === "bill") paying.onPage = true;
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
    if (attempt.status === "failed" && call === "bill") {
      const approved = !NOT_APPROVED(attempt.reason);
      paying.failed = {
        // one that failed, when it did; one never approved, when it was
        // made, as the Office reads "the client's payment on Jan 12", not
        // the day the Clock called it off (#534's UX review U18)
        at: (approved && attempt.endedAt) || attempt.askedAt,
        reason: attempt.reason ?? "",
        approved,
      };
    }
  }
  return (billId: string) => on.get(billId) ?? NOT_PAYING;
};

// where a Bill stands, as each page that shows it says it, from where its
// payments stand (paymentOn), in the reply's language: a payment going
// through is Unpaid only in that it's pending (ADR-0022), unless it already
// was, which says why; and the Client's bank asking them to approve
// theirs, or their last payment on its page, which failed or was never
// approved
export const standing = (
  bill: Pick<Bill, "status" | "unpaidSince" | "unpaidReason">,
  on: PaymentOn,
): { unpaid: Unpaid | null; paying: BillPaying | null } => {
  const lang = currentLanguage();
  const due = bill.status === "due";
  const recorded = unpaidOf(lang, bill.unpaidSince, bill.unpaidReason);
  return {
    unpaid:
      due && on.goingSince && recorded?.kind !== "waiting"
        ? { since: on.goingSince.toISOString(), kind: "waiting", why: null }
        : recorded,
    paying: !due
      ? null
      : on.approvingUntil
        ? { status: "approving", until: on.approvingUntil.toISOString() }
        : on.failed && !on.goingSince
          ? on.failed.approved
            ? {
                status: "failed",
                at: on.failed.at.toISOString(),
                why: whyNotPaid(lang, on.failed.reason).why,
              }
            : { status: "notApproved", at: on.failed.at.toISOString() }
          : null,
  };
};
