import type { AdjustmentKind, UnpaidKind } from "../index.js";

// What the server and the screens both say about paying: a card, a payment,
// a refund, and the price changes found when a clean is done
// (docs/ux.md, Words)

export const PRICES_INCLUDE_TAX = "Prices include tax.";

// a refund, as the Client is told: `amount` already formatted
export const REFUND_TAKES_DAYS = "It can take a few days to reach you.";
export const refundedTo = (amount: string, card: string) =>
  `We've refunded ${amount} to your ${card}. ${REFUND_TAKES_DAYS}`;

// where a card is typed, as the Client is told
export const NEVER_SEE_CARD =
  "It goes straight into our payment service's secure form, so we never see your card number.";

// a payment we couldn't take, as the Client is told: `amount` already
// formatted, with what it's for ("$50 for this bill"); `card` null when
// none is saved; `why` as whyNotPaid gives it
export const notTaken = (
  amount: string,
  card: string | null,
  why: string | null = null,
) =>
  `We couldn't take ${amount}${card ? ` from your ${card}` : ""}${why ? ` (${why})` : ""}.`;

// a clean's payment that didn't go through, as its Client is told, for a
// sentence to end: `day` already formatted
export const cleanNotPaid = (day: string) =>
  `We couldn't take payment for your ${day} clean`;

// how a Client puts right a payment that didn't go through
export const UPDATE_AND_RETRY =
  "update your card and we'll try again straight away";
export const UPDATE_CARD = "Update your card";

// what happens next, once a payment didn't go through, by why: as the
// Client is told, and as the Office is
export const clientFix: Record<UnpaidKind, string> = {
  declined: `Please ${UPDATE_AND_RETRY}.`,
  no_card: "Please add a card and we'll try again straight away.",
  waiting: "We'll try again by ourselves, so there's nothing you need to do.",
  late: "Please pay it on its page.",
};
export const officeFix: Record<UnpaidKind, string> = {
  declined: "We've emailed the client to update their card, which tries again.",
  no_card: "We've emailed the client to add a card, which tries again.",
  waiting: "We'll try again by ourselves.",
  late: "We remind the client each week until it's paid.",
};

// a Client's cleaning plan, paused while a payment on it is Unpaid, and back
// on once it's paid
export const BOOKED_GO_AHEAD =
  "Cleans already booked still go ahead, but we won't book any more.";
export const PLAN_PAUSED = `Until it's paid, your cleaning plan is paused. ${BOOKED_GO_AHEAD}`;
export const PLAN_BACK_ON =
  "Your cleaning plan is back on, and we'll book your cleans as usual.";

// a fee for a clean that didn't happen, by the Job's status
export const feeName = {
  cancelled: "Late cancellation fee",
  no_access: "Couldn't-get-in fee",
};
export const LATE_MOVE_FEE = "Late move fee";

type Changed = {
  kind: AdjustmentKind;
  addOnName: string | null;
  hours: number | null;
};

// what a price change changed, by name: "Inside the fridge", "1 extra hour"
export const adjustmentItem = (a: Changed) =>
  a.kind === "extra_time"
    ? `${a.hours} extra ${a.hours === 1 ? "hour" : "hours"}`
    : a.addOnName!;

// what was reported: "Inside the oven, not done", "1.5 extra hours"
export const adjustmentLabel = (a: Changed) =>
  a.kind === "extra_time"
    ? adjustmentItem(a)
    : `${a.addOnName}, ${a.kind === "add_on_done" ? "done on the day" : "not done"}`;
