import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type { SignedInAccount } from "@empire-cleaning/models";
import { db } from "#db";
import { findClientByEmail } from "#features/clients";
import { createStaff, setUsualWeek } from "#features/staff";
import { testClock, testPayments } from "../../../tests/harness.ts";
import { acceptedJob, casey, signInAsOffice } from "../../../tests/fixtures.ts";
import { chargeSaved, refundFrom } from "./money.ts";
import { paymentMethodOf } from "./payments.ts";
import { charges, refunds } from "./payments.schema.ts";

// Casey's Deep Clean, accepted by the Office with a 25% Deposit taken from
// Casey's saved card, with a cleaner free to do it
const booked = async () => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  const job = await acceptedJob({
    startsAt: "2026-01-07T14:00:00Z",
    byAccountId: me.id,
  });
  const client = (await findClientByEmail(casey.email))!;
  const method = (await paymentMethodOf(client.id))!;
  return { job, client, method };
};

const chargesOf = (jobId: string) =>
  db.select().from(charges).where(eq(charges.jobId, jobId));

const refundsOf = (chargeId: string) =>
  db.select().from(refunds).where(eq(refunds.chargeId, chargeId));

describe("charging a saved Payment Method", () => {
  test("takes the money and records the Charge", async () => {
    const { job, client, method } = await booked();

    const result = await db.transaction((tx) =>
      chargeSaved(tx, {
        client,
        method,
        amount: 4200,
        description: "Balance",
        for: { jobId: job.id, kind: "balance" },
      }),
    );

    expect(result.ok).toBe(true);
    const balance = (await chargesOf(job.id)).find((c) => c.kind === "balance");
    expect(balance).toMatchObject({ amountCents: 4200 });
    expect(testPayments().charges.at(-1)).toMatchObject({
      amount: 4200,
      paymentMethodId: method.gatewayRef,
      description: "Balance",
    });
  });

  test.each([
    ["no Payment Method is saved", "no Payment Method is saved"],
    ["declined", "card_declined"],
    ["the provider unreachable", "the payment provider couldn't be reached"],
  ])("records nothing, and says why, with %s", async (scenario, reason) => {
    const { job, client, method } = await booked();
    const before = (await chargesOf(job.id)).length;
    if (scenario === "declined") testPayments().failCharges();
    if (scenario === "the provider unreachable") testPayments().goDown();

    const result = await db.transaction((tx) =>
      chargeSaved(tx, {
        client,
        method: scenario === "no Payment Method is saved" ? null : method,
        amount: 4200,
        description: "Balance",
        for: { jobId: job.id, kind: "balance" },
      }),
    );

    expect(result).toEqual({ ok: false, reason });
    expect(await chargesOf(job.id)).toHaveLength(before);
  });
});

describe("refunding from Charges", () => {
  // the Deposit, then a $100 Balance an hour later
  const twoCharges = async () => {
    const { job, client, method } = await booked();
    testClock().advance({ hours: 1 });
    await db.transaction((tx) =>
      chargeSaved(tx, {
        client,
        method,
        amount: 10000,
        description: "Balance",
        for: { jobId: job.id, kind: "balance" },
      }),
    );
    const taken = await chargesOf(job.id);
    const deposit = taken.find((c) => c.kind === "deposit")!;
    const balance = taken.find((c) => c.kind === "balance")!;
    return { taken, deposit, balance };
  };

  test("gives back from the latest Charge first, then the one before", async () => {
    const { taken, deposit, balance } = await twoCharges();

    const given = await refundFrom(db, taken, 10000 + 100);

    expect(given).toBe(10100);
    expect(await refundsOf(balance.id)).toMatchObject([{ amountCents: 10000 }]);
    expect(await refundsOf(deposit.id)).toMatchObject([{ amountCents: 100 }]);
  });

  test("gives back only what hasn't been refunded already", async () => {
    const { taken, deposit, balance } = await twoCharges();
    await refundFrom(db, taken, 6000);

    const given = await refundFrom(db, taken, 5000);

    expect(given).toBe(5000);
    expect(await refundsOf(balance.id)).toMatchObject([
      { amountCents: 6000 },
      { amountCents: 4000 },
    ]);
    expect(await refundsOf(deposit.id)).toMatchObject([{ amountCents: 1000 }]);
  });

  test("never gives back more than was charged", async () => {
    const { taken, deposit, balance } = await twoCharges();

    const given = await refundFrom(db, taken, 1_000_000);

    expect(given).toBe(balance.amountCents + deposit.amountCents);
  });

  test("stops at a refund that fails, and a later try takes up from there", async () => {
    const { taken, balance } = await twoCharges();
    testPayments().goDown();

    expect(await refundFrom(db, taken, 3000)).toBe(0);
    expect(await refundsOf(balance.id)).toEqual([]);

    testPayments().goDown(false);
    expect(await refundFrom(db, taken, 3000)).toBe(3000);
    expect(await refundsOf(balance.id)).toMatchObject([{ amountCents: 3000 }]);
  });
});
