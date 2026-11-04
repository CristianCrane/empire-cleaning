import { and, eq, inArray } from "drizzle-orm";
import type { Tx } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import { rescheduleRequests } from "./reschedule.schema.ts";

/**
 * Closes the pending Reschedule Requests of Jobs that stopped being booked
 * (Cancelled, Completed or No Access), inside the transaction that does it
 * (#242): they can't be confirmed or turned down any more, and hold no room.
 *
 * Only the schema is imported here, as cancelling, completing and a plan's
 * changes all call it.
 */
export const closePendingRequests = async (tx: Tx, jobIds: string[]) => {
  if (jobIds.length === 0) return;
  await tx
    .update(rescheduleRequests)
    .set({ status: "closed", answeredAt: clock.now() })
    .where(
      and(
        inArray(rescheduleRequests.jobId, jobIds),
        eq(rescheduleRequests.status, "pending"),
      ),
    );
};
