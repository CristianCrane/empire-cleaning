import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import type { Tx } from "../../db/index.ts";
import { billLines, bills } from "../bills/bills.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { servicePlans, servicePlanVisits } from "./service-plans.schema.ts";

/**
 * Keeps a plan Job's Service Plan On Hold while any of its Jobs is Unpaid,
 * inside the transaction settling that Job: On Hold once one is, active
 * again once none are, when generating picks it up on its next run. An Ended
 * plan stays Ended; a one-off Job has no plan to hold.
 *
 * Only schemas are imported here, as settling a Job's money calls it and
 * most features call that.
 */
export const holdOrResume = async (
  tx: Tx,
  jobId: string,
): Promise<"held" | "resumed" | null> => {
  const [visit] = await tx
    .select({ planId: servicePlanVisits.servicePlanId })
    .from(servicePlanVisits)
    .where(eq(servicePlanVisits.jobId, jobId));
  if (!visit) return null;
  return holdOrResumePlan(tx, visit.planId);
};

// whether any of these plans is On Hold
export const anyOnHold = async (tx: Tx, planIds: string[]) =>
  planIds.length > 0 &&
  (
    await tx
      .select({ id: servicePlans.id })
      .from(servicePlans)
      .where(
        and(
          inArray(servicePlans.id, planIds),
          eq(servicePlans.status, "on_hold"),
        ),
      )
  ).length > 0;

// whether a Job's plan is On Hold; false for a one-off Job
export const planOnHold = async (tx: Tx, jobId: string) =>
  anyOnHold(
    tx,
    (
      await tx
        .select({ planId: servicePlanVisits.servicePlanId })
        .from(servicePlanVisits)
        .where(eq(servicePlanVisits.jobId, jobId))
    ).map((v) => v.planId),
  );

/**
 * Puts a Service Plan On Hold while any of its Jobs, or a Bill with any of
 * its Jobs on it (ADR-0016), is Unpaid, and back to active once none is. A
 * Bill with a bank debit paying it on its way holds nothing while it clears.
 */
export const holdOrResumePlan = async (
  tx: Tx,
  planId: string,
): Promise<"held" | "resumed" | null> => {
  // held while its Jobs are counted, so two Jobs settling at once take turns
  const [plan] = await tx
    .select({ status: servicePlans.status })
    .from(servicePlans)
    .where(eq(servicePlans.id, planId))
    .for("update");
  if (plan!.status === "ended") return null;

  // one after the other, as a transaction's queries share one connection
  // (ADR-0024)
  const [{ unpaidJobs }] = (await tx
    .select({ unpaidJobs: count() })
    .from(servicePlanVisits)
    .innerJoin(jobs, eq(jobs.id, servicePlanVisits.jobId))
    .where(
      and(
        eq(servicePlanVisits.servicePlanId, planId),
        isNotNull(jobs.unpaidSince),
      ),
    )) as [{ unpaidJobs: number }];
  const [{ unpaidBills }] = (await tx
    .select({ unpaidBills: count() })
    .from(servicePlanVisits)
    .innerJoin(billLines, eq(billLines.jobId, servicePlanVisits.jobId))
    .innerJoin(bills, eq(bills.id, billLines.billId))
    .where(
      and(
        eq(servicePlanVisits.servicePlanId, planId),
        isNotNull(bills.unpaidSince),
        // not while a bank debit paying it clears
        eq(bills.status, "due"),
      ),
    )) as [{ unpaidBills: number }];
  const status = unpaidJobs + unpaidBills > 0 ? "on_hold" : "active";
  if (status === plan!.status) return null;

  await tx
    .update(servicePlans)
    .set({ status })
    .where(eq(servicePlans.id, planId));
  return status === "on_hold" ? "held" : "resumed";
};
