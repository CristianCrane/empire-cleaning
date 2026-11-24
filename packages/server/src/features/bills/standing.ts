import type { BillPaying, Unpaid } from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { db, type Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { APPROVAL_MS, attemptsFor, NOT_APPROVED } from "../payments/money.ts";
import { unpaidOf, whyNotPaid } from "../payments/unpaid.ts";
import type { Bill } from "./bills.schema.ts";

// Where the payments on a Bill stand, as its pages say it (#534): one going
// through since `goingSince`, which may still take the money (ours to the
// saved card, or the Client's on its page: a bank debit, or one nobody
// heard the end of yet); the Client's bank asking them to approve theirs,
// until `approvingUntil`, when it's called off; or their latest payment on
// its page, which failed, and why. One never approved isn't a failure:
// nothing was taken, and the dialog said so
export type PayingOn = {
  goingSince: Date | null;
  approvingUntil: Date | null;
  failed: { at: Date; reason: string } | null;
};

const NOT_PAYING: PayingOn = {
  goingSince: null,
  approvingUntil: null,
  failed: null,
};

// each Bill's, by its id, in one query for a list
export const payingOn = async (billIds: string[], tx: Tx | typeof db = db) => {
  const now = clock.now().getTime();
  const on = new Map<string, PayingOn>();
  const decided = new Set<string>();
  // newest first
  for (const { attempt, open, call } of await attemptsFor(
    "bill",
    billIds,
    tx,
  )) {
    const paying = on.get(attempt.forId) ?? { ...NOT_PAYING };
    on.set(attempt.forId, paying);
    if (open) {
      const until = attempt.askedAt.getTime() + APPROVAL_MS;
      if (attempt.status !== "approving" || attempt.bankFinishingAt) {
        paying.goingSince ??= attempt.askedAt;
      }
      // past it, the next try calls it off, or the Clock does
      else if (until > now) paying.approvingUntil ??= new Date(until);
      continue;
    }
    if (decided.has(attempt.forId)) continue;
    if (attempt.status === "failed" && NOT_APPROVED(attempt.reason)) continue;
    // the latest that ended decides: taken, or ours to the saved card,
    // which the Bill's Unpaid tells
    decided.add(attempt.forId);
    if (attempt.status === "failed" && call === "bill") {
      paying.failed = {
        at: attempt.endedAt ?? attempt.askedAt,
        reason: attempt.reason ?? "",
      };
    }
  }
  return (billId: string) => on.get(billId) ?? NOT_PAYING;
};

// where a Bill stands, as each page that shows it says it, from where its
// payments stand (payingOn), in the reply's language: a payment going
// through is Unpaid only in that it's pending (ADR-0022), unless it already
// was, which says why; and the Client's bank asking them to approve
// theirs, or their last payment on its page, which failed
export const standing = (
  bill: Pick<Bill, "status" | "unpaidSince" | "unpaidReason">,
  on: PayingOn,
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
          ? {
              status: "failed",
              at: on.failed.at.toISOString(),
              why: whyNotPaid(lang, on.failed.reason).why,
            }
          : null,
  };
};
