import type { DepositPaying, QuoteStatus } from "@empire-cleaning/models";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type Tx } from "../../db/index.ts";
import { waitOf } from "../payments/money.ts";
import { pagePaying, paymentOn } from "../payments/payment-on.ts";
import { chargeAttempts } from "../payments/payments.schema.ts";
import { pendingDeposits } from "./quotes.schema.ts";

type Shown = { id: string; sentRevisionId: string | null; status: QuoteStatus };

// The Client paying a Quote's Deposit now, the one check the Client's pages
// and the Office's make of it (ADR-0022's one rule; #534 review F9): their
// bank asking them to approve it, within APPROVAL_MS of their pressing,
// till `until`; after it, while their bank finishes it (`finishing`, too
// far on to call off; #534 critical review C2); or `past` it, as settling
// it couldn't reach the provider to call it off or read it, so it may yet
// pay the offer sent (#534 review F28, critical review C9). Its pending
// Deposit is saved as the Client's try lets go of the Quote; once settled,
// it's booked or ended, as its attempt waits on giving it back (C3), so
// it's none. A payment whose reply never came, or the Office's Charge still
// processing, is none either: the next press of Accept reads it, and books
// with it (takeDepositOnce, #241), as the Client is told to try again in a
// few minutes. For a list, in one query
export const clientHolds = async (
  quoteIds: string[],
  tx: Tx | typeof db = db,
) => {
  const held = new Map<
    string,
    ReturnType<typeof waitOf> & {
      attempt: typeof chargeAttempts.$inferSelect;
      pending: typeof pendingDeposits.$inferSelect;
    }
  >();
  const rows =
    quoteIds.length === 0
      ? []
      : await tx
          .select({ attempt: chargeAttempts, pending: pendingDeposits })
          .from(chargeAttempts)
          .innerJoin(
            pendingDeposits,
            eq(pendingDeposits.gatewayRef, chargeAttempts.gatewayRef),
          )
          .where(
            and(
              eq(chargeAttempts.kind, "deposit"),
              inArray(chargeAttempts.forId, quoteIds),
              // waiting on their bank, or approved and their card's
              // finishing it
              inArray(chargeAttempts.status, ["approving", "processing"]),
              isNull(pendingDeposits.settledAt),
            ),
          )
          .orderBy(desc(chargeAttempts.askedAt));
  for (const { attempt, pending } of rows) {
    if (!held.has(attempt.forId)) {
      held.set(attempt.forId, { attempt, pending, ...waitOf(attempt) });
    }
  }
  return (id: string) => held.get(id) ?? null;
};

// Where the Client's latest Deposit payment on each Quote stands (#534), the
// one answer its pages and the Office's read, and which Service it's for,
// as a Bill's pages read where a payment on it stands (pagePaying): going
// through, which may still take it, or their bank asking them to approve
// it, as it holds the Quote (clientHolds); past that wait, never approved;
// the latest that didn't go through, on the offer still Sent and open, as
// the Client may answer it again; or given back, as it couldn't be booked,
// and why. None once it's Accepted, as its page says it's booked, and none
// after a payment the Office took on their saved card, which the Office's
// page tells. For a list, in four queries.
export const depositPaying = async (
  quotes: Shown[],
  tx: Tx | typeof db = db,
) => {
  const ids = quotes.map((q) => q.id);
  const on = await paymentOn("deposit", ids, tx);
  const holds = await clientHolds(ids, tx);
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
    const held = holds(quote.id);
    if (held && !held.onClient) return { status: "goingThrough", ...of };
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
    if (held && !held.past) {
      return { status: "approving", until: held.until.toISOString(), ...of };
    }
    // the latest that ended: one still open holds nothing here, as pressing
    // Accept again reads it
    const page = pagePaying({ ...paying, approvingUntil: null });
    return page && { ...page, ...of };
  };
};
