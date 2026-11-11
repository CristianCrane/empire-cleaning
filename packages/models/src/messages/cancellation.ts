import type { PlanCancelled } from "../index.ts";
import { catalog } from "../language.ts";
import { ON_THAT_WEEKS_BILL } from "./bills.ts";

// What the server and the screens both say about cancelling or skipping a
// clean, and about one we couldn't get in for (docs/ux.md, Words)

// why a plan clean was cancelled with its plan, in each language
const PLAN_CANCELLED: Record<PlanCancelled, string> = {
  changed: "The cleaning plan changed",
  ended: "The cleaning plan ended",
};
const PLAN_CANCELLED_ES: Record<PlanCancelled, string> = {
  changed: "El plan de limpieza cambió",
  ended: "El plan de limpieza terminó",
};

// cancelling is free until this long before a Job starts; after that it's a
// Late Cancellation
export const CANCELLATION_CUTOFF_HOURS = 24;

// What cancelling, or skipping a plan Job, costs (ADR-0010), the same rules
// for the Office and its Client, said so it's true before and after. A plan
// Job has no Deposit of its own: its fee is the plan's Deposit amount, and
// the plan's Deposit stays held (ADR-0013). `fee` is `feeCents` as the
// caller formats money.
export type CancelCost = {
  onPlan: boolean;
  late: boolean;
  feeCents: number;
  fee: string;
};

// for the Office: also how a plan Job's fee is taken, charged or on its
// week's Bill (ADR-0016), unless it couldn't be (`failed`, said apart),
// and a one-off's Deposit refunded, as formatted
export type OfficeCancelCost = CancelCost & {
  weeklyBill: boolean;
  failed?: boolean;
  refund: string | null;
};

// a fee a Late Reschedule left on the Job, which cancelling doesn't undo
const earlierMoveFee = (fee: string) =>
  `${fee} fee from an earlier late move is still to pay`;
const earlierMoveFeeEs = (fee: string) =>
  `cargo de ${fee} por una reprogramación tardía anterior sigue pendiente`;

export const cancellation = catalog({
  en: {
    // a plan Job skipped or not done: the plan itself is unchanged
    PLAN_CARRIES_ON: "Your cleaning plan carries on as usual.",
    cancelCostForClient: ({ onPlan, late, feeCents, fee }: CancelCost) => {
      if (late && feeCents > 0) {
        return onPlan
          ? `Skipping it less than ${CANCELLATION_CUTOFF_HOURS} hours before is a late cancellation, with a ${fee} fee, the same as your plan's deposit. Your deposit stays held.`
          : `Cancelling less than ${CANCELLATION_CUTOFF_HOURS} hours before is a late cancellation, so your ${fee} deposit is kept as the fee.`;
      }
      if (feeCents > 0) {
        return onPlan
          ? `The ${earlierMoveFee(fee)}, and skipping costs nothing more.`
          : `Your ${fee} deposit was already kept for an earlier late move, so there's nothing more to pay.`;
      }
      return onPlan
        ? "There's no charge for skipping it."
        : "There's no charge for cancelling.";
    },
    // why a plan clean was cancelled with its plan
    planCancelled: PLAN_CANCELLED,
    // a plan Job cancelled as its plan ended or changed, not skipped, as its
    // Client is told. It's never a Late Cancellation (ending.ts,
    // changing.ts), so its only fee is one a Late Reschedule left
    cancelledWithPlanForClient: (
      why: PlanCancelled,
      { feeCents, fee }: Pick<CancelCost, "feeCents" | "fee">,
    ) =>
      `${PLAN_CANCELLED[why]}, so this clean was cancelled. ${feeCents > 0 ? `The ${earlierMoveFee(fee)}.` : "There's no charge for it."}`,
    // the fee for a clean we couldn't get in for, as its Client is told:
    // charged as a late cancellation is
    noAccessFee: ({ onPlan, fee }: Pick<CancelCost, "onPlan" | "fee">) =>
      onPlan
        ? `As with a late cancellation, there's a ${fee} fee, the same as your plan's deposit. Your deposit stays held.`
        : `As with a late cancellation, your ${fee} deposit is kept as the fee.`,
  },
  es: {
    PLAN_CARRIES_ON: "Su plan de limpieza sigue como siempre.",
    cancelCostForClient: ({ onPlan, late, feeCents, fee }: CancelCost) => {
      if (late && feeCents > 0) {
        return onPlan
          ? `Saltarla con menos de ${CANCELLATION_CUTOFF_HOURS} horas de anticipación es una cancelación tardía, con un cargo de ${fee}, igual al depósito de su plan. Su depósito sigue retenido.`
          : `Cancelar con menos de ${CANCELLATION_CUTOFF_HOURS} horas de anticipación es una cancelación tardía, así que su depósito de ${fee} se conserva como cargo.`;
      }
      if (feeCents > 0) {
        return onPlan
          ? `El ${earlierMoveFeeEs(fee)}, y saltarla no cuesta nada más.`
          : `Su depósito de ${fee} ya se conservó por una reprogramación tardía anterior, así que no hay nada más que pagar.`;
      }
      return onPlan
        ? "Saltarla no tiene ningún cargo."
        : "Cancelar no tiene ningún cargo.";
    },
    planCancelled: PLAN_CANCELLED_ES,
    cancelledWithPlanForClient: (
      why: PlanCancelled,
      { feeCents, fee }: Pick<CancelCost, "feeCents" | "fee">,
    ) =>
      `${PLAN_CANCELLED_ES[why]}, así que esta limpieza se canceló. ${feeCents > 0 ? `El ${earlierMoveFeeEs(fee)}.` : "No tiene ningún cargo."}`,
    noAccessFee: ({ onPlan, fee }: Pick<CancelCost, "onPlan" | "fee">) =>
      onPlan
        ? `Como en una cancelación tardía, hay un cargo de ${fee}, igual al depósito de su plan. Su depósito sigue retenido.`
        : `Como en una cancelación tardía, su depósito de ${fee} se conserva como cargo.`,
  },
});

// the Office's, in English (ADR-0025)
const officeCost = ({ onPlan, late, feeCents, fee }: CancelCost) => {
  if (late && feeCents > 0) {
    return onPlan
      ? `A late cancellation: a ${fee} fee, the plan's deposit amount. The plan's deposit stays held.`
      : `A late cancellation: the ${fee} deposit is kept as the fee.`;
  }
  if (feeCents > 0) {
    return onPlan
      ? `Free, but the ${earlierMoveFee(fee)}.`
      : `Free, but the ${fee} deposit was already kept for an earlier late move.`;
  }
  return "Free.";
};

export const cancelCostForOffice = (cost: OfficeCancelCost) =>
  [
    officeCost(cost),
    cost.onPlan &&
      cost.feeCents > 0 &&
      !cost.failed &&
      `The fee ${cost.weeklyBill ? ON_THAT_WEEKS_BILL : "is charged"}.`,
    cost.refund && `The ${cost.refund} deposit is refunded.`,
  ]
    .filter(Boolean)
    .join(" ");
