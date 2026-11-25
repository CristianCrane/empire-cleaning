import { and, asc, eq } from "drizzle-orm";
import {
  addDays,
  dayOf,
  mondayOf,
  type NextCharge,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clock } from "../../services/clock/index.ts";
import {
  billMadeOn,
  weeklyBillFor,
  weeklyBillOf,
} from "../bills/billed-weekly.ts";
import { billedNow } from "../bills/bills.ts";
import type { Client } from "../clients/clients.schema.ts";
import { owedOnceDone } from "../completion/balance.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { properties } from "../properties/properties.schema.ts";

/**
 * What a Client's card or weekly Bill takes next, by the rules that take
 * it, or null when nothing is to come (#508). Only a look: nothing charges.
 * Billed weekly, cleans done and not yet billed go on next Monday's Bill
 * first (billedNow, makeBill's own rule); then their soonest booked clean
 * that will owe anything once done, a clean not yet marked done included.
 */
export const nextChargeFor = async (
  client: Pick<Client, "id" | "billedWeeklyFrom" | "billPayment">,
): Promise<NextCharge | null> => {
  const today = dayOf(clock.now());
  if (weeklyBillOf(client)) {
    // next Monday's Bill is for this week
    const thisWeek = mondayOf(today);
    const billed = await billedNow(client, thisWeek, db, { lock: false });
    const cents = billed?.lines.reduce((s, l) => s + l.amountCents, 0) ?? 0;
    if (cents > 0) {
      return { kind: "bill", cents, billOn: addDays(thisWeek, 7) };
    }
  }
  const booked = await db
    .select({ job: jobs })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(and(eq(properties.clientId, client.id), eq(jobs.status, "booked")))
    .orderBy(asc(jobs.startsAt), asc(jobs.id));
  for (const { job } of booked) {
    const startsAt = job.startsAt.toISOString();
    if (weeklyBillFor(job, client)) {
      return { kind: "billedClean", startsAt, billOn: billMadeOn(job, today) };
    }
    const cents = await owedOnceDone(job);
    if (cents > 0) return { kind: "clean", cents, startsAt };
  }
  return null;
};
