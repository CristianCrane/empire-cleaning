import type { BillPaying, Unpaid } from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { pagePaying, type PaymentOn } from "../payments/payment-on.ts";
import { unpaidOf } from "../payments/unpaid.ts";
import type { Bill } from "./bills.schema.ts";

// where a Bill stands, as each page that shows it says it, from where its
// payments stand (paymentOn), in the reply's language: a payment going
// through is Unpaid only in that it's pending (ADR-0022), unless it already
// was, which says why; and, while it's due, the Client's payment on its
// page (pagePaying)
export const standing = (
  bill: Pick<Bill, "status" | "unpaidSince" | "unpaidReason" | "refusedAt">,
  on: PaymentOn,
): { unpaid: Unpaid | null; paying: BillPaying | null } => {
  const due = bill.status === "due";
  const recorded = unpaidOf(
    currentLanguage(),
    bill.unpaidSince,
    bill.unpaidReason,
    bill.refusedAt,
  );
  return {
    unpaid:
      due && on.goingSince && recorded?.kind !== "waiting"
        ? { since: on.goingSince.toISOString(), kind: "waiting", why: null }
        : recorded,
    paying: due ? pagePaying(on) : null,
  };
};
