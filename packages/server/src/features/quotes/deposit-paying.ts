import type { DepositPaying, QuoteStatus } from "@empire-cleaning/models";
import { inArray } from "drizzle-orm";
import { db, type Tx } from "../../db/index.ts";
import { waitOf } from "../payments/money.ts";
import { pagePaying, paymentOn } from "../payments/payment-on.ts";
import { pendingDeposits } from "./quotes.schema.ts";

type Shown = { id: string; sentRevisionId: string | null; status: QuoteStatus };

// Where the Client's latest Deposit payment on each Quote stands (#534), the
// one answer its pages and the Office's read, and which Service it's for,
// as a Bill's pages read where a payment on it stands (pagePaying): going
// through, which may still take it; their bank asking them to approve it,
// or past that wait, never approved; the latest that didn't go through, on
// the offer still Sent and open, as the Client may answer it again; or
// given back, as it couldn't be booked, and why. None once it's Accepted,
// as its page says it's booked, and none after a payment the Office took
// on their saved card, which the Office's page tells. For a list, in three
// queries.
export const depositPaying = async (
  quotes: Shown[],
  tx: Tx | typeof db = db,
) => {
  const on = await paymentOn(
    "deposit",
    quotes.map((q) => q.id),
    tx,
  );
  const refs = quotes.flatMap((q) => on(q.id).latest?.attempt.gatewayRef ?? []);
  const pending = new Map(
    (refs.length === 0
      ? []
      : await tx
          .select()
          .from(pendingDeposits)
          .where(inArray(pendingDeposits.gatewayRef, refs))
    ).map((p) => [p.gatewayRef, p]),
  );
  return (quote: Shown): DepositPaying | null => {
    const paying = on(quote.id);
    if (!paying.latest || quote.status === "accepted") return null;
    const { attempt, offer } = paying.latest;
    // the offer it was for: its pending Deposit's, kept while it was open,
    // else what it asked for (none on one asked before attempts kept it)
    const row = attempt.gatewayRef
      ? pending.get(attempt.gatewayRef)
      : undefined;
    const serviceKey = row?.serviceKey ?? offer?.serviceKey;
    if (!serviceKey) return null;
    const of = { serviceKey, depositCents: attempt.amountCents };
    if (paying.goingSince) return { status: "goingThrough", ...of };
    if (attempt.status === "given_back") {
      return row?.unbookedWhy
        ? {
            status: "refunded",
            why: row.unbookedWhy,
            at: attempt.givenBackAt!.toISOString(),
            ...of,
          }
        : null;
    }
    if (
      quote.status !== "sent" ||
      (row?.revisionId ?? offer?.revisionId) !== quote.sentRevisionId
    ) {
      return null;
    }
    // past its wait, it's called off when anyone acts on it next, or the
    // Clock does: never approved, as a Bill's page says it once it is
    if (attempt.status === "approving" && waitOf(attempt).past) {
      return {
        status: "notApproved",
        at: attempt.askedAt.toISOString(),
        ...of,
      };
    }
    const page = pagePaying(paying);
    return page && { ...page, ...of };
  };
};
