import type { RescheduleCost } from "../index.ts";
import { catalog } from "../language.ts";
import { bills, ON_THAT_WEEKS_BILL } from "./bills.ts";

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

export const reschedule = catalog({
  en: {
    moveCostForClient: ({
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
            ? `As your second late move, it has a ${fee} late cancellation fee, which ${weeklyBill ? `${bills.en.ON_WEEKS_BILL} with the price` : "is charged with the price when the clean is done"}.`
            : `As your second late move, your ${fee} deposit is kept as a late cancellation fee, and the full price ${weeklyBill ? bills.en.ON_WEEKS_BILL : bills.en.CHARGED_WHEN_DONE}.`;
      }
    },
  },
  es: {
    moveCostForClient: ({
      cost,
      feeCents,
      fee,
      onPlan,
      weeklyBill,
    }: MoveCost) => {
      switch (cost) {
        case "free":
          return "Reprogramarla no tiene ningún cargo.";
        case "free_late":
          return `Reprogramarla con menos de ${LATE_RESCHEDULE_HOURS} horas de anticipación es una reprogramación tardía. La primera es gratis${onPlan ? "" : ", y su depósito sigue contando para el precio"}.`;
        case "late_cancellation":
          if (feeCents === 0) {
            return onPlan
              ? "El cargo de una reprogramación tardía anterior cubre esta, así que no hay nada más que pagar."
              : "Su depósito ya se conservó por una reprogramación tardía anterior, así que no hay nada más que pagar.";
          }
          return onPlan
            ? `Como es su segunda reprogramación tardía, tiene un cargo de ${fee} por cancelación tardía, que ${weeklyBill ? `${bills.es.ON_WEEKS_BILL} con el precio` : "se cobra con el precio cuando la limpieza esté terminada"}.`
            : `Como es su segunda reprogramación tardía, su depósito de ${fee} se conserva como cargo por cancelación tardía, y el precio completo ${weeklyBill ? bills.es.ON_WEEKS_BILL : bills.es.CHARGED_WHEN_DONE}.`;
      }
    },
  },
});

// the Office's, in English (ADR-0025)
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
        : `A second late move, so the ${fee} deposit is kept as a late cancellation fee, and the full price ${weeklyBill ? ON_THAT_WEEKS_BILL : "is charged when it's done"}.`;
  }
};
