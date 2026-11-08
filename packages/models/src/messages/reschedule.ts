import type { RescheduleCost } from "../index.js";
import { ON_WEEKS_BILL } from "./bills.js";

// What the server and the screens both say about moving a clean
// (docs/ux.md, Words)

// moving a clean this close to it is a Late Reschedule (ADR-0010)
export const LATE_RESCHEDULE_HOURS = 24;

// What moving a clean costs, the same rules for the Office and its Client
// (ADR-0010). A plan Job has no Deposit of its own: its fee is the plan's
// Deposit amount, owed with the price: charged when it's done, or on its
// week's Bill (ADR-0016). `fee` is `feeCents` as the caller formats money.
export type MoveCost = {
  cost: RescheduleCost;
  feeCents: number;
  fee: string;
  onPlan: boolean;
  weeklyBill: boolean;
};

export const moveCostForClient = ({
  cost,
  feeCents,
  fee,
  onPlan,
  weeklyBill,
}: MoveCost) => {
  switch (cost) {
    case "free":
      return "There's no charge for moving it.";
    case "free_late":
      return `Moving it less than ${LATE_RESCHEDULE_HOURS} hours before is a late move. Your first one is free${onPlan ? "" : ", and your deposit still counts toward the price"}.`;
    case "late_cancellation":
      if (feeCents === 0) {
        return onPlan
          ? "The fee from an earlier late move covers this, so there's nothing more to pay."
          : "Your deposit was already kept for an earlier late move, so there's nothing more to pay.";
      }
      return onPlan
        ? `As your second late move, it has a ${fee} late cancellation fee, which ${weeklyBill ? `${ON_WEEKS_BILL} with the price` : "is charged with the price when the clean is done"}.`
        : `As your second late move, your ${fee} deposit is kept as a late cancellation fee, and the full price ${weeklyBill ? ON_WEEKS_BILL : "is charged when the clean is done"}.`;
  }
};

export const moveCostForOffice = ({
  cost,
  feeCents,
  fee,
  onPlan,
  weeklyBill,
}: MoveCost) => {
  switch (cost) {
    case "free":
      return "Free.";
    case "free_late":
      return `A late move, free as this job's first.${onPlan ? "" : " The deposit still counts toward the price."}`;
    case "late_cancellation":
      if (feeCents === 0) {
        return "A late move. An earlier one's fee covers it, so there's nothing more to pay.";
      }
      return onPlan
        ? `A second late move, so a ${fee} late cancellation fee, ${weeklyBill ? "on that week's bill with the price" : "charged with the price when it's done"}.`
        : `A second late move, so the ${fee} deposit is kept as a late cancellation fee, and the full price ${weeklyBill ? "goes on that week's bill" : "is charged when it's done"}.`;
  }
};
