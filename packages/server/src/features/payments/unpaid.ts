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

// ours, and the provider's own that needs nothing from the Client
const ours: Record<string, { kind: UnpaidKind; why: string }> = {
  [UNREACHABLE]: {
    kind: "waiting",
    why: "We couldn't reach the payment service.",
  },
  processing: { kind: "waiting", why: "The bank payment is still clearing." },
  [NOT_SETTLED]: { kind: "waiting", why: "Something went wrong on our side." },
  [NO_CARD]: { kind: "no_card", why: "No card is saved." },
  [LATE]: { kind: "late", why: "It wasn't paid by its due date." },
  needs_approval: {
    kind: "declined",
    why: "The bank asked for it to be approved first.",
  },
};

// the few declines worth naming; any other, the fraud-type ones too, is
// only "didn't go through", as the provider advises for what a customer sees
const declines: Record<string, string> = {
  expired_card: "The card has expired.",
  insufficient_funds: "There wasn't enough money in the account.",
  account_closed: "That bank account is closed.",
  no_account: "That bank account is closed.",
};

export const whyNotPaid = (reason: string): Omit<Unpaid, "since"> =>
  ours[reason] ?? { kind: "declined", why: declines[reason] ?? null };

// as a view shows it
export const unpaidOf = (since: Date | null, reason: string | null) =>
  since ? { since: since.toISOString(), ...whyNotPaid(reason ?? "") } : null;
