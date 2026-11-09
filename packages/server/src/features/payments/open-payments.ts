import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { clock, MINUTE_MS } from "../../services/clock/index.ts";
import { monitoring } from "../../services/monitoring/index.ts";
import { bills } from "../bills/bills.schema.ts";
import { retryBill } from "../bills/bills.ts";
import { NOT_SETTLED } from "./unpaid.ts";
import { retryJob } from "../completion/completion.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { quotes } from "../quotes/quotes.schema.ts";
import {
  giveBackUnbookedDeposits,
  openBefore,
  refundFrom,
  WAITING_ON_PROVIDER,
} from "./money.ts";
import { charges } from "./payments.schema.ts";

// ---- the Clock: payments nobody heard the end of (ADR-0022) ----

// long enough after asking that a try still waiting on its reply has had it
const SETTLED_AFTER_MS = 15 * MINUTE_MS;

/**
 * Tries again what's waiting on the payment provider, so nobody has to:
 * each Job, Bill or Quote with a Charge or refund attempt we never heard the
 * end of, and each Job or Bill Unpaid only because the provider couldn't be
 * reached (or its payment was still processing). A Job is settled again, a
 * due Bill charged again; a Bill paid another way meanwhile gives back what
 * its lost Charge took, and so does a Quote nobody booked. Each holds what
 * it's for while it tries, so it's safe to run as often as you like, and on
 * more than one server, alongside the Client trying again themselves.
 */
export const settleOpenPayments = async () => {
  const before = new Date(clock.now().getTime() - SETTLED_AFTER_MS);
  const open = await openBefore(before);
  const unpaidJobs = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        lte(jobs.unpaidSince, before),
        inArray(jobs.unpaidReason, [...WAITING_ON_PROVIDER, NOT_SETTLED]),
      ),
    );
  const unpaidBills = await db
    .select({ id: bills.id })
    .from(bills)
    .where(
      and(
        eq(bills.status, "due"),
        isNotNull(bills.unpaidSince),
        lte(bills.unpaidSince, before),
        inArray(bills.unpaidReason, WAITING_ON_PROVIDER),
      ),
    );

  // one that fails stops no other, and the next run tries it again
  const each = async (
    what: string,
    ids: string[],
    run: (id: string) => Promise<unknown>,
  ) => {
    for (const id of new Set(ids)) {
      try {
        await run(id);
      } catch (error) {
        monitoring.error(error, { what: `${what} ${id} not settled` });
      }
    }
  };
  await each("Job", [...open.jobs, ...unpaidJobs.map((j) => j.id)], retryJob);
  await each(
    "Bill",
    [...open.bills, ...unpaidBills.map((b) => b.id)],
    retryBill,
  );
  await each("Quote", open.quotes, (quoteId) =>
    db.transaction(async (tx) => {
      // as accepting it does, so the two never both have its Deposit
      await tx
        .select({ id: quotes.id })
        .from(quotes)
        .where(eq(quotes.id, quoteId))
        .for("update");
      await giveBackUnbookedDeposits(tx, quoteId);
    }),
  );
  // a payment made twice, given back whole
  await each("Charge", open.charges, async (chargeId) => {
    const [charge] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, chargeId));
    await refundFrom(db, [charge!], charge!.amountCents, { for: charge!.id });
  });
};
