import type { AdjustmentKind } from "../index.js";

// What the server and the screens both say about paying: a card, a payment,
// a refund, and the price changes found when a clean is done
// (docs/ux.md, Words)

export const PRICES_INCLUDE_TAX = "Prices include tax.";

// a refund, as the Client is told: `amount` already formatted
export const REFUND_TAKES_DAYS = "It can take a few days to reach you.";
export const refundedTo = (amount: string, card: string) =>
  `We've refunded ${amount} to your ${card}. ${REFUND_TAKES_DAYS}`;

// how a Client puts right a payment that didn't go through
export const UPDATE_AND_RETRY =
  "update your Payment Method and we'll try again straight away";

// a fee for a clean that didn't happen, by the Job's status
export const feeName = {
  cancelled: "Late Cancellation fee",
  no_access: "No Access fee",
};

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
