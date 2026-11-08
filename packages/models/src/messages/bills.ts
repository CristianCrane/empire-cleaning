import type { BillPayment } from "../index.js";

// What the server and the screens both say about a weekly Bill
// (docs/ux.md, Words)

// where a clean, or a fee, owed before its week's Bill is made goes, as the
// Client is told; anything settled after the clean goes on their next Bill
export const ON_WEEKS_BILL = "goes on your Bill for that week";

// when a weekly Bill is made, and how the Client pays it (ADR-0016)
export const billPaid: Record<BillPayment, string> = {
  automatic:
    "made the following Monday and charged to your saved Payment Method",
  on_page:
    "made the following Monday, which you pay on its page by its due date",
};
