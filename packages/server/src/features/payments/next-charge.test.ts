import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type { NextCharge, SignedInAccount } from "@empire-cleaning/models";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import { completeJob, paymentOf } from "#features/completion";
import { jobs } from "#features/jobs";
import { signIn, testClock } from "../../../tests/harness.ts";
import {
  acceptedJob,
  billWeekly,
  billedWeek,
  casey,
  completedFirstClean,
  signInAsOffice,
  staffMember,
} from "../../../tests/fixtures.ts";

// The test clock starts at 4am on Monday 5 January 2026 in New York.
const WEDNESDAY_9AM = "2026-01-07T14:00:00.000Z";

const officeAccount = async () => {
  const office = await signInAsOffice();
  return (await office.get("/api/me").expect(200)).body as SignedInAccount;
};

const nextOf = async () => {
  const client = await signIn(casey.email);
  const res = await client.get("/api/payments/mine/next").expect(200);
  return JSON.parse(res.text) as NextCharge | null;
};

// the rest of a booked clean's price, its Deposit taken
const restOf = async (jobId: string) => {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const payment = await paymentOf(row!);
  return payment.totalCents - payment.charges[0]!.amountCents;
};

describe("what a Client's card or Bill takes next (#508)", () => {
  test("a booked clean, its Deposit taken: the rest of its price, once it's done", async () => {
    const me = await officeAccount();
    await staffMember("Cory Cleaner");
    const job = await acceptedJob({
      startsAt: WEDNESDAY_9AM,
      byAccountId: me.id,
    });

    expect(await nextOf()).toEqual({
      kind: "clean",
      cents: await restOf(job.id),
      startsAt: WEDNESDAY_9AM,
    });
  });

  test("a weekly Client's clean done this week: on next Monday's Bill, though no Job is still booked", async () => {
    const me = await officeAccount();
    const { jobId } = await billedWeek({ byAccountId: me.id, unbilled: true });

    expect(await nextOf()).toEqual({
      kind: "bill",
      cents: await restOf(jobId),
      billOn: "2026-01-12",
    });
  });

  test("a weekly Client's booked clean: the Bill it goes on, never a Monday gone", async () => {
    const me = await officeAccount();
    const cory = await staffMember("Cory Cleaner");
    const job = await acceptedJob({
      startsAt: WEDNESDAY_9AM,
      byAccountId: me.id,
    });
    await billWeekly();
    const offered = await offerAssignment(job.id, cory.id, me.id);
    await confirmAssignment(cory.id, offered.assignments[0]!.id);

    expect(await nextOf()).toEqual({
      kind: "billedClean",
      startsAt: WEDNESDAY_9AM,
      billOn: "2026-01-12",
    });

    // Monday the 12th, not yet marked done: its week's Bill is made without
    // it, so it goes on the next one
    testClock().set(new Date("2026-01-12T15:00:00Z"));
    expect(await nextOf()).toMatchObject({ billOn: "2026-01-19" });

    testClock().set(new Date("2026-01-14T17:00:00Z"));
    await completeJob(cory.id, job.id, { condition: "moderate", reports: [] });
    expect(await nextOf()).toMatchObject({
      kind: "bill",
      billOn: "2026-01-19",
    });
  });

  test("nothing to come once a clean is done and paid", async () => {
    const me = await officeAccount();
    await completedFirstClean({ byAccountId: me.id });

    expect(await nextOf()).toBeNull();
  });
});
