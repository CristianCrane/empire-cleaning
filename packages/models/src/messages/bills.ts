import type { BillPayment } from "../index.js";

// What the server and the screens both say about a weekly Bill
// (docs/ux.md, Words)

// where a clean, or a fee, owed before its week's Bill is made goes, as the
// Client is told; anything settled after the clean goes on their next Bill
export const ON_WEEKS_BILL = "goes on your bill for that week";
// the same, as the Office reads it
export const ON_THAT_WEEKS_BILL = "goes on that week's bill";

// when a weekly Bill is made, and how the Client pays it (ADR-0016): as they
// read it, or as the Office does
const billPaidBy = (you: boolean): Record<BillPayment, string> => ({
  automatic: `made the following Monday and charged to ${you ? "your" : "the client's"} card`,
  on_page: `made the following Monday, which ${you ? "you pay" : "the client pays"} on its page by its due date`,
});
export const billPaid = billPaidBy(true);

// how a Client pays for their cleans: each when it's done, or on a weekly Bill
export const cleansPaid = (how: BillPayment | "per_clean", forClient = true) =>
  how === "per_clean"
    ? `Each clean is charged to ${forClient ? "your" : "the client's"} card when it's done.`
    : `Each week's cleans go on one bill, ${billPaidBy(forClient)[how]}.`;

// for a sentence to end
export const billNotPaid = (number: string) =>
  `We couldn't take payment for bill ${number}`;

// a bank payment on its way, as the Client is told
export const BANK_CLEARING = "It usually takes a few working days to clear.";
