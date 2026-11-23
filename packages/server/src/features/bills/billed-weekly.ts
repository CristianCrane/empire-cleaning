import { and, asc, eq, ne } from "drizzle-orm";
import { startOfDay } from "@empire-cleaning/models";
import type { db, Tx } from "../../db/index.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import type { Job } from "../jobs/jobs.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { billLines, bills } from "./bills.schema.ts";

// Only schemas are imported here, as settling a Job's money calls it and
// most features call that.

// what a Bill bills a Job for: being Completed, or a fee for not happening
export const owesOnBill = (job: Pick<Job, "status" | "feeCents">) =>
  job.status === "completed" ||
  ((job.status === "cancelled" || job.status === "no_access") &&
    (job.feeCents ?? 0) > 0);

// EC-000123
export const billNumber = (number: number) =>
  `EC-${String(number).padStart(6, "0")}`;

// a Job's lines on Bills not voided, each with its Bill: what's billed it,
// what for, and where those Bills stand
export const billLinesOf = (jobId: string, tx: Tx | typeof db) =>
  tx
    .select({ line: billLines, bill: bills })
    .from(billLines)
    .innerJoin(bills, eq(bills.id, billLines.billId))
    .where(and(eq(billLines.jobId, jobId), ne(bills.status, "void")))
    .orderBy(asc(bills.number));

// the Bills voided since they billed a Job, whose own Charge may still
// have taken its money
export const voidedBillsOf = async (jobId: string, tx: Tx | typeof db) =>
  (
    await tx
      .selectDistinct({ id: bills.id })
      .from(billLines)
      .innerJoin(bills, eq(bills.id, billLines.billId))
      .where(and(eq(billLines.jobId, jobId), eq(bills.status, "void")))
  ).map((b) => b.id);

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

// weeklyBillFor a Job, read from its home's Client, for the Job's views
export const weeklyBillOfJob = async (
  job: Pick<Job, "propertyId" | "startsAt">,
  tx: Tx | typeof db,
) => {
  const [owner] = await tx
    .select({
      billedWeeklyFrom: clients.billedWeeklyFrom,
      billPayment: clients.billPayment,
    })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, job.propertyId));
  return weeklyBillFor(job, owner!);
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
