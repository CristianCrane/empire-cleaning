import { eq, inArray, or } from "drizzle-orm";
import type { ClientPayment, ClientPaymentKind } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { addDays } from "../../services/clock/index.ts";
import { billNumber } from "../bills/bills.ts";
import { bills } from "../bills/bills.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { servicePlans } from "../service-plans/service-plans.schema.ts";
import { serviceNameOf } from "../services/services.ts";
import { charges, refunds, type Charge } from "./payments.schema.ts";

/**
 * Every payment between a Client and us, newest first, for their Payments
 * page: each Charge (a Job's Deposit, Balance and fees, a Service Plan's
 * Deposit, a Bill) and each refund from one. A Bill being paid by bank debit
 * shows while it clears, and one Office Staff recorded as paid another way
 * shows when it was paid. A Charge that failed moved no money, so it isn't
 * here: what's owed is on the page above it.
 */
export const paymentHistoryFor = async (
  clientId: string,
): Promise<ClientPayment[]> => {
  const [ownJobs, ownPlans, ownBills] = await Promise.all([
    db
      .select({ job: jobs })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(eq(properties.clientId, clientId)),
    db
      .select({ id: servicePlans.id })
      .from(servicePlans)
      .innerJoin(properties, eq(properties.id, servicePlans.propertyId))
      .where(eq(properties.clientId, clientId)),
    db.select().from(bills).where(eq(bills.clientId, clientId)),
  ]);
  const jobIds = ownJobs.map((r) => r.job.id);
  const planIds = ownPlans.map((p) => p.id);
  const billIds = ownBills.map((b) => b.id);

  const theirs = [
    jobIds.length > 0 && inArray(charges.jobId, jobIds),
    planIds.length > 0 && inArray(charges.servicePlanId, planIds),
    billIds.length > 0 && inArray(charges.billId, billIds),
  ].filter((c) => c !== false);
  const charged =
    theirs.length === 0
      ? []
      : await db
          .select()
          .from(charges)
          .where(or(...theirs));
  const given =
    charged.length === 0
      ? []
      : await db
          .select()
          .from(refunds)
          .where(
            inArray(
              refunds.chargeId,
              charged.map((c) => c.id),
            ),
          );

  const names = new Map<string, string>();
  for (const { job } of ownJobs) {
    if (!names.has(job.serviceId)) {
      names.set(job.serviceId, await serviceNameOf(job.serviceId));
    }
  }
  const jobOf = (jobId: string | null) => {
    const job = ownJobs.find((r) => r.job.id === jobId)?.job;
    return job
      ? {
          id: job.id,
          serviceName: names.get(job.serviceId)!,
          startsAt: job.startsAt.toISOString(),
          status: job.status,
        }
      : null;
  };
  const billOf = (billId: string | null) => {
    const bill = ownBills.find((b) => b.id === billId);
    return bill
      ? {
          id: bill.id,
          number: billNumber(bill.number),
          weekStart: bill.weekStart,
          weekEnd: addDays(bill.weekStart, 6),
        }
      : null;
  };
  const forWhat = (charge: Charge) => ({
    job: jobOf(charge.jobId),
    servicePlanId: charge.servicePlanId,
    bill: billOf(charge.billId),
  });

  // a Job's Balance taken after its first was for an increase approved later
  const firstBalance = new Map<string, Charge>();
  for (const c of [...charged].sort(
    (a, b) => a.chargedAt.getTime() - b.chargedAt.getTime(),
  )) {
    if (c.kind === "balance" && c.jobId && !firstBalance.has(c.jobId)) {
      firstBalance.set(c.jobId, c);
    }
  }
  const kindOf = (c: Charge): ClientPaymentKind =>
    c.kind === "balance" && firstBalance.get(c.jobId!)?.id !== c.id
      ? "extra"
      : c.kind;

  const history: ClientPayment[] = [
    ...charged.map((c) => ({
      id: c.id,
      at: c.chargedAt.toISOString(),
      kind: kindOf(c),
      amountCents: c.amountCents,
      ...forWhat(c),
      clearing: false,
    })),
    ...given.map((r) => {
      const from = charged.find((c) => c.id === r.chargeId)!;
      return {
        id: r.id,
        at: r.refundedAt.toISOString(),
        kind: "refund" as const,
        amountCents: -r.amountCents,
        ...forWhat(from),
        clearing: false,
      };
    }),
    // what hasn't a Charge (yet): a bank debit clearing, or paid another way
    ...ownBills
      .filter(
        (b) =>
          b.status === "processing" ||
          (b.status === "paid" && b.paidVia === "outside"),
      )
      .map((b) => ({
        id: b.id,
        at: (b.paidAt ?? b.updatedAt).toISOString(),
        kind: "bill" as const,
        amountCents: b.totalCents,
        job: null,
        servicePlanId: null,
        bill: billOf(b.id),
        clearing: b.status === "processing",
      })),
  ];
  return history.sort((a, b) => b.at.localeCompare(a.at));
};
