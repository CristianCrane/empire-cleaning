import type { BillPaying, Unpaid } from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import type { PaymentOn } from "../payments/payment-on.ts";
import { unpaidOf, whyNotPaid } from "../payments/unpaid.ts";
import type { Bill } from "./bills.schema.ts";

// where a Bill stands, as each page that shows it says it, from where its
// payments stand (paymentOn), in the reply's language: a payment going
// through is Unpaid only in that it's pending (ADR-0022), unless it already
// was, which says why; and the Client's bank asking them to approve
// theirs, or their last payment on its page, which failed or was never
// approved
export const standing = (
  bill: Pick<Bill, "status" | "unpaidSince" | "unpaidReason">,
  on: PaymentOn,
): { unpaid: Unpaid | null; paying: BillPaying | null } => {
  const lang = currentLanguage();
  const due = bill.status === "due";
  const recorded = unpaidOf(lang, bill.unpaidSince, bill.unpaidReason);
  return {
    unpaid:
      due && on.goingSince && recorded?.kind !== "waiting"
        ? { since: on.goingSince.toISOString(), kind: "waiting", why: null }
        : recorded,
    paying: !due
      ? null
      : on.approvingUntil
        ? { status: "approving", until: on.approvingUntil.toISOString() }
        : on.failed && !on.goingSince
          ? on.failed.approved
            ? {
                status: "failed",
                at: on.failed.at.toISOString(),
                why: whyNotPaid(lang, on.failed.reason).why,
              }
            : { status: "notApproved", at: on.failed.at.toISOString() }
          : null,
  };
};
