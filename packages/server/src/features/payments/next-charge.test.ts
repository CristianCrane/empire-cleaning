import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type { NextCharge, SignedInAccount } from "@empire-cleaning/models";
import { db } from "#db";
import { paymentOf } from "#features/completion";
import { jobs } from "#features/jobs";
import { signIn } from "../../../tests/harness.ts";
import {
  acceptedJob,
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

  test("nothing to come once a clean is done and paid", async () => {
    const me = await officeAccount();
    await completedFirstClean({ byAccountId: me.id });

    expect(await nextOf()).toBeNull();
  });
});
