import type { BillPayment } from "@empire-cleaning/models";
import { and, count, eq, ne, sum } from "drizzle-orm";
import type { db, Tx } from "../../db/index.ts";
import { startOfDay } from "../../services/clock/index.ts";
import type { Client } from "../clients/clients.schema.ts";
import type { Job } from "../jobs/jobs.schema.ts";
import { billLines, bills } from "./bills.schema.ts";

// Only schemas are imported here, as settling a Job's money calls it and
// most features call that.

// what a Bill bills a Job for: being Completed, or a fee for not happening
export const owesOnBill = (job: Pick<Job, "status" | "feeCents">) =>
  job.status === "completed" ||
  ((job.status === "cancelled" || job.status === "no_access") &&
    (job.feeCents ?? 0) > 0);

// what a Job's lines on Bills not voided come to, and whether it has any
export const billedOf = async (jobId: string, tx: Tx | typeof db) => {
  const [row] = await tx
    .select({
      cents: sum(billLines.amountCents).mapWith(Number),
      lines: count(),
    })
    .from(billLines)
    .innerJoin(bills, eq(bills.id, billLines.billId))
    .where(and(eq(billLines.jobId, jobId), ne(bills.status, "void")));
  return { cents: row?.cents ?? 0, lines: row?.lines ?? 0 };
};

// how a Client pays for their cleans: on a weekly Bill, charged or paid on
// its page (ADR-0016), or null when each is charged when it's done
export const weeklyBillOf = (
  client: Pick<Client, "billedWeeklyFrom" | "billPayment">,
) => (client.billedWeeklyFrom ? client.billPayment : null);

// how a Job's Client pays for it: weeklyBillOf, once the Job starts in or
// after the week weekly billing was switched on, or null when it's charged
// when it's done
export const weeklyBillFor = (
  job: Pick<Job, "startsAt">,
  client: Pick<Client, "billedWeeklyFrom" | "billPayment">,
) =>
  client.billedWeeklyFrom && job.startsAt >= startOfDay(client.billedWeeklyFrom)
    ? client.billPayment
    : null;

// where a clean, or a fee, owed before its week's Bill is made goes, as the
// Client is told; anything settled after the clean goes on their next Bill
export const ON_WEEKS_BILL = "goes on your Bill for that week";

// when a weekly Bill is made, and how the Client pays it
export const billPaid: Record<BillPayment, string> = {
  automatic:
    "made the following Monday and charged to your saved Payment Method",
  on_page:
    "made the following Monday, which you pay on its page by its due date",
};

/**
 * Whether a Job's money goes on its Client's weekly Bills rather than being
 * charged on its own (ADR-0016): its Client is billed weekly, it starts in
 * or after the week that was switched on, and it owes something a Bill
 * bills, or a Bill has billed it before (a completion undone then credits
 * the next). Anything else, such as a free cancellation giving back a
 * Deposit, is settled per Job as before.
 */
export const isBilledWeekly = (
  job: Pick<Job, "status" | "feeCents" | "startsAt">,
  client: Pick<Client, "billedWeeklyFrom" | "billPayment">,
  billed: { lines: number },
) =>
  weeklyBillFor(job, client) !== null && (owesOnBill(job) || billed.lines > 0);
