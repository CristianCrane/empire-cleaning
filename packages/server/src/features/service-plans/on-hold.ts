import { and, count, eq, isNotNull } from "drizzle-orm";
import type { Tx } from "../../db/index.ts";
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

  // held while its Jobs are counted, so two Jobs settling at once take turns
  const [plan] = await tx
    .select({ status: servicePlans.status })
    .from(servicePlans)
    .where(eq(servicePlans.id, visit.planId))
    .for("update");
  if (plan!.status === "ended") return null;

  const [{ unpaid }] = (await tx
    .select({ unpaid: count() })
    .from(servicePlanVisits)
    .innerJoin(jobs, eq(jobs.id, servicePlanVisits.jobId))
    .where(
      and(
        eq(servicePlanVisits.servicePlanId, visit.planId),
        isNotNull(jobs.unpaidSince),
      ),
    )) as [{ unpaid: number }];
  const status = unpaid > 0 ? "on_hold" : "active";
  if (status === plan!.status) return null;

  await tx
    .update(servicePlans)
    .set({ status })
    .where(eq(servicePlans.id, visit.planId));
  return status === "on_hold" ? "held" : "resumed";
};
