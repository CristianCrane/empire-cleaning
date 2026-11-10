import type { BillPayment } from "../index.ts";
import { catalog } from "../language.ts";

// What the server and the screens both say about a weekly Bill
// (docs/ux.md, Words)

// when a weekly Bill is made, and how the Client pays it (ADR-0016): as they
// read it, or as the Office does
const billPaidBy = (you: boolean): Record<BillPayment, string> => ({
  automatic: `made the following Monday and charged to ${you ? "your" : "the client's"} card`,
  on_page: `made the following Monday, which ${you ? "you pay" : "the client pays"} on its page by its due date`,
});

const cleansPaidBy = (how: BillPayment | "per_clean", forClient: boolean) =>
  how === "per_clean"
    ? `Each clean is charged to ${forClient ? "your" : "the client's"} card when it's done.`
    : `Each week's cleans go on one bill, ${billPaidBy(forClient)[how]}.`;

const billPaidEs: Record<BillPayment, string> = {
  automatic: "que se hace el lunes siguiente y se cobra a su tarjeta",
  on_page:
    "que se hace el lunes siguiente y usted paga en su página antes de la fecha de vencimiento",
};

export const bills = catalog({
  en: {
    // where a clean, or a fee, owed before its week's Bill is made goes, as
    // the Client is told; anything settled after the clean goes on their
    // next Bill
    ON_WEEKS_BILL: "goes on your bill for that week",
    billPaid: billPaidBy(true),
    // how a Client pays for their cleans: each when it's done, or on a
    // weekly Bill
    cleansPaid: (how: BillPayment | "per_clean") => cleansPaidBy(how, true),
    // for a sentence to end
    billNotPaid: (number: string) =>
      `We couldn't take payment for bill ${number}`,
    // a bank payment on its way, as the Client is told
    BANK_CLEARING: "It usually takes a few working days to clear.",
  },
  es: {
    ON_WEEKS_BILL: "va en su factura de esa semana",
    billPaid: billPaidEs,
    cleansPaid: (how: BillPayment | "per_clean") =>
      how === "per_clean"
        ? "Cada limpieza se cobra a su tarjeta cuando está terminada."
        : `Las limpiezas de cada semana van en una sola factura, ${billPaidEs[how]}.`,
    billNotPaid: (number: string) =>
      `No pudimos cobrar el pago de la factura ${number}`,
    BANK_CLEARING: "Normalmente tarda unos días hábiles en hacerse efectivo.",
  },
});

// the Office's, in English (ADR-0025)
export const ON_THAT_WEEKS_BILL = "goes on that week's bill";
export const cleansPaidForOffice = (how: BillPayment | "per_clean") =>
  cleansPaidBy(how, false);
