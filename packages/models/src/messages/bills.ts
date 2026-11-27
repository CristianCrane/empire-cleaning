import type { BillPayment } from "../index.ts";
import { catalog } from "../language.ts";
import { because } from "./payments.ts";

// What the server and the screens both say about a weekly Bill
// (docs/ux-words.md, Words)

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
    // what's owed for a clean paid for on its own, as the Client is told
    CHARGED_WHEN_DONE: "is charged when the clean is done",
    billPaid: billPaidBy(true),
    // how a Client pays for their cleans: each when it's done, or on a
    // weekly Bill
    cleansPaid: (how: BillPayment | "per_clean") => cleansPaidBy(how, true),
    // for a sentence to end
    billNotPaid: (number: string) =>
      `We couldn't take payment for bill ${number}`,
    // a bank payment on its way, as the Client is told, after a sentence
    // that names it
    BANK_CLEARING: "It usually takes a few working days to go through.",
    // the Client's last payment on a Bill's page, for a sentence to end,
    // as its page says it, and Payments' card when its line names the Bill:
    // `why` as whyNotPaid gives it (#534). No amount: a Bill is paid
    // whole, and its total is right below (#534's UX review U5)
    payingFailed: (why: string | null) =>
      `Your payment didn't go through${because(why)}`,
    // the Client's last payment on a Bill's page, never approved with their
    // bank (they left its check, failed it, or let it run out), as the
    // dialog and the page say it: nothing was taken (#534's UX review U12)
    NOT_APPROVED: "Your payment wasn't approved, so nothing was taken.",
    // what to do once a payment on a Bill's page took nothing, true whichever
    // way they paid: the page's alert, and the server's refusal in its dialog
    PAY_AGAIN: "Please try again, or use another card or bank account.",
  },
  es: {
    ON_WEEKS_BILL: "va en su factura de esa semana",
    CHARGED_WHEN_DONE: "se cobra cuando la limpieza esté terminada",
    billPaid: billPaidEs,
    cleansPaid: (how: BillPayment | "per_clean") =>
      how === "per_clean"
        ? "Cada limpieza se cobra a su tarjeta cuando está terminada."
        : `Las limpiezas de cada semana van en una sola factura, ${billPaidEs[how]}.`,
    billNotPaid: (number: string) =>
      `No pudimos cobrar el pago de la factura ${number}`,
    BANK_CLEARING: "Normalmente tarda unos días hábiles en pasar.",
    payingFailed: (why: string | null) => `Su pago no pasó${because(why)}`,
    NOT_APPROVED: "Su pago no se aprobó, así que no se cobró nada.",
    PAY_AGAIN: "Vuelva a intentarlo, o use otra tarjeta o cuenta bancaria.",
  },
});

// the Office's, in English (ADR-0025)
export const ON_THAT_WEEKS_BILL = "goes on that week's bill";
export const cleansPaidForOffice = (how: BillPayment | "per_clean") =>
  cleansPaidBy(how, false);

// why Office Staff can't cancel a Bill, or record a payment on it, while
// `what` holds it (ADR-0022's one rule), and how long that `takes`: each
// dialog's words, which the server's refusal from a page opened before
// repeats, and the line under each in its menu (`item`, short, as the menu
// may cover the page's alert)
const cantWhile =
  (what: string, takes = "") =>
  (it: string) =>
    `You can't ${it} while ${what}${takes}.`;
const heldWhile = (what: string, takes = "") => {
  const cant = cantWhile(what, takes);
  return {
    cancel: cant("cancel this bill"),
    record: cant("record a payment on this bill"),
    item: `Not while ${what}`,
  };
};

// a payment on it that may still take the money: our charge to the saved
// card, or the Client's own on its page, a card or one nobody heard the end
// of yet, going through; `page`, the alert beside both greyed actions. It
// promises neither, as most go through and leave the Bill paid (design
// review U6). "Usually": the Clock asks again once an attempt is
// SETTLED_AFTER_MS old, on its next tick (TICK_MS), and an attempt stays
// open while the provider can't be reached
const GOING = [
  "its payment is going through",
  ", which usually takes under half an hour",
] as const;
export const paymentNotDone = {
  ...heldWhile(...GOING),
  page: cantWhile(...GOING)("cancel this bill or record a payment"),
};

// the Client's bank debit on it on its way (status processing), which takes
// days; the page's alert says so in its own words (#534's UX review U14)
export const bankPaymentOnWay = heldWhile(
  "the client's bank payment is on its way",
);

// A Client paying a Bill on its page while their bank asks them to approve
// it (#534), as Office Staff read it: nothing else that moves money on it
// starts till it's approved, refused or called off (ADR-0022's one rule),
// so they can't cancel it or record a payment until `until` (formatted),
// when it's called off. `name` is the Client's whole name; `first`, its
// first word, where room is short or it's said again. No amount: a Bill is
// paid whole, and its total is right below (#534's UX review U5)
export const clientPayingBill = {
  page: (name: string, until: string) =>
    `${name} is paying this bill online, waiting on their bank to approve it. If it isn't approved by ${until}, it's called off and you can cancel the bill or record a payment.`,
  // each dialog's, and the server's refusal from a page opened before
  cancel: (first: string, until: string) =>
    `You can't cancel this bill while ${first} is paying it online. If their bank hasn't approved it by ${until}, you can then.`,
  record: (first: string, until: string) =>
    `You can't record a payment on this bill while ${first} is paying it online. If their bank hasn't approved it by ${until}, you can then.`,
  item: (first: string) => `Not while ${first} is paying this bill`,
};
