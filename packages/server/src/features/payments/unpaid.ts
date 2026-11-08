import type { Unpaid, UnpaidKind } from "@empire-cleaning/models";
import { NO_CARD, UNREACHABLE } from "./money.ts";

// Why a Job or a Bill is Unpaid, from the reason stored with it, in words a
// person reads (docs/ux.md, Words). The stored reason is the payment
// provider's code, or one of ours below, and stays as it is: open-payments.ts
// finds the payments it tries again by it.

// why a Job is Unpaid when settling it failed for want of anything the
// Client could fix
export const NOT_SETTLED = "its payment couldn't be worked out";
// why a Bill paid on its page is Unpaid
export const LATE = "not paid by its due date";

// ours, and the provider's own that we know: each with its kind. A bank
// asking for approval reads as a decline, as a new card is how they fix it
const known: Record<string, { kind: UnpaidKind; why: string }> = {
  [UNREACHABLE]: {
    kind: "waiting",
    why: "we couldn't reach the payment service",
  },
  processing: { kind: "waiting", why: "the bank payment is still clearing" },
  [NOT_SETTLED]: { kind: "waiting", why: "something went wrong on our side" },
  [NO_CARD]: { kind: "no_card", why: "no card is saved" },
  [LATE]: { kind: "late", why: "it wasn't paid by its due date" },
  needs_approval: {
    kind: "declined",
    why: "the bank asked for it to be approved first",
  },
};

// the few declines worth naming; any other, the fraud-type ones too, is
// only "didn't go through", as the provider advises for what a customer sees
const declines: Record<string, string> = {
  expired_card: "the card has expired",
  insufficient_funds: "there wasn't enough money in the account",
  account_closed: "that bank account is closed",
  no_account: "that bank account is closed",
};

export const whyNotPaid = (reason: string): Omit<Unpaid, "since"> =>
  known[reason] ?? { kind: "declined", why: declines[reason] ?? null };

// whether a payment that failed is now the Client's to put right, and they
// haven't been told: before, it was paid (`before` null), or only waiting
// on the provider, which we try again ourselves
export const nowTheirs = (before: string | null, failure: string) =>
  whyNotPaid(failure).kind !== "waiting" &&
  (before === null || whyNotPaid(before).kind === "waiting");

// as a view shows it
export const unpaidOf = (since: Date | null, reason: string | null) =>
  since ? { since: since.toISOString(), ...whyNotPaid(reason ?? "") } : null;
