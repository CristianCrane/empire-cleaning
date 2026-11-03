import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type { SignedInAccount } from "@empire-cleaning/models";
import { db } from "#db";
import { findClientByEmail } from "#features/clients";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  testClock,
  testMonitoring,
  testPayments,
} from "../../../tests/harness.ts";
import { acceptedJob, casey, signInAsOffice } from "../../../tests/fixtures.ts";
import { chargeSaved, refundFrom } from "./money.ts";
import { paymentMethodOf } from "./payments.ts";
import { charges, payers, refunds } from "./payments.schema.ts";

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

  // #241, finding 5
  test("for a Client the provider doesn't know yet, while it can't be reached, says so rather than throwing", async () => {
    const { job, client, method } = await booked();
    await db.delete(payers).where(eq(payers.clientId, client.id));
    testPayments().goDown();

    const result = await db.transaction((tx) =>
      chargeSaved(tx, {
        client,
        method,
        amount: 4200,
        description: "Balance",
        for: { jobId: job.id, kind: "balance" },
      }),
    );

    expect(result).toEqual({
      ok: false,
      reason: "the payment provider couldn't be reached",
    });
  });

  test("an unreachable provider is the urgent payment_gateway_error signal (ADR-0007)", async () => {
    const { job, client, method } = await booked();
    testPayments().goDown();

    await db.transaction((tx) =>
      chargeSaved(tx, {
        client,
        method,
        amount: 4200,
        description: "Balance",
        for: { jobId: job.id, kind: "balance" },
      }),
    );

    expect(testMonitoring().signalled("payment_gateway_error")).toEqual([
      expect.objectContaining({
        urgency: "urgent",
        context: expect.objectContaining({
          what: `a Charge for balance ${job.id}`,
        }),
      }),
    ]);
  });
});

// #241, finding 1: whatever happens after the provider takes the money, a
// retry never takes it twice
describe("charging again after the provider took the money", () => {
  const balance = (
    { job, client, method }: Awaited<ReturnType<typeof booked>>,
    amount = 4200,
  ) =>
    db.transaction((tx) =>
      chargeSaved(tx, {
        client,
        method,
        amount,
        description: "Balance",
        for: { jobId: job.id, kind: "balance" },
      }),
    );
  const takenAtProvider = () =>
    testPayments().charges.filter((c) => c.description === "Balance");
  const balancesOf = async (jobId: string) =>
    (await chargesOf(jobId)).filter((c) => c.kind === "balance");

  test("when the transaction it was taken in rolls back, it's recorded, not taken again", async () => {
    const was = await booked();

    await expect(
      db.transaction(async (tx) => {
        await chargeSaved(tx, {
          client: was.client,
          method: was.method,
          amount: 4200,
          description: "Balance",
          for: { jobId: was.job.id, kind: "balance" },
        });
        throw new Error("the commit failed");
      }),
    ).rejects.toThrow("the commit failed");
    expect(await balancesOf(was.job.id)).toEqual([]);

    expect(await balance(was)).toMatchObject({ ok: true });
    expect(takenAtProvider()).toHaveLength(1);
    expect(await balancesOf(was.job.id)).toMatchObject([{ amountCents: 4200 }]);
  });

  test("when its reply is lost, it's not charged, and a retry finds what was taken", async () => {
    const was = await booked();
    testPayments().loseNextReply();

    expect(await balance(was)).toEqual({
      ok: false,
      reason: "the payment provider couldn't be reached",
    });
    expect(await balancesOf(was.job.id)).toEqual([]);

    expect(await balance(was)).toMatchObject({ ok: true });
    expect(takenAtProvider()).toHaveLength(1);
    expect(await balancesOf(was.job.id)).toMatchObject([{ amountCents: 4200 }]);
  });

  test("a retry a day later, once the provider has forgotten the key, finds it too", async () => {
    const was = await booked();
    testPayments().loseNextReply();
    await balance(was);

    testClock().advance({ hours: 25 });
    testPayments().forgetKeys();
    expect(await balance(was)).toMatchObject({ ok: true });

    expect(takenAtProvider()).toHaveLength(1);
    expect(await balancesOf(was.job.id)).toMatchObject([{ amountCents: 4200 }]);
  });

  test("what was taken counts towards what's charged now, and only the rest is taken", async () => {
    const was = await booked();
    testPayments().loseNextReply();
    await balance(was, 4200);

    // the Balance went up meanwhile
    expect(await balance(was, 5000)).toMatchObject({ ok: true });

    expect(takenAtProvider().map((c) => c.amount)).toEqual([4200, 800]);
    expect((await balancesOf(was.job.id)).map((c) => c.amountCents)).toEqual(
      expect.arrayContaining([4200, 800]),
    );
  });

  test("a declined attempt is over: the next try asks the card again", async () => {
    const was = await booked();
    testPayments().failCharges();
    expect((await balance(was)).ok).toBe(false);
    testPayments().failCharges(null);

    expect(await balance(was)).toMatchObject({ ok: true });

    expect(takenAtProvider()).toHaveLength(1);
    expect(testPayments().paymentAttempts.slice(-2)).toHaveLength(2);
  });
});

// what refunds in these tests give back for: the Job the Charges are for
const forId = (taken: { jobId: string | null }[]) => taken[0]!.jobId!;

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

    const given = await refundFrom(db, taken, 10000 + 100, {
      for: forId(taken),
    });

    expect(given).toBe(10100);
    expect(await refundsOf(balance.id)).toMatchObject([{ amountCents: 10000 }]);
    expect(await refundsOf(deposit.id)).toMatchObject([{ amountCents: 100 }]);
  });

  test("gives back only what hasn't been refunded already", async () => {
    const { taken, deposit, balance } = await twoCharges();
    await refundFrom(db, taken, 6000, { for: forId(taken) });

    const given = await refundFrom(db, taken, 5000, { for: forId(taken) });

    expect(given).toBe(5000);
    expect(await refundsOf(balance.id)).toMatchObject([
      { amountCents: 6000 },
      { amountCents: 4000 },
    ]);
    expect(await refundsOf(deposit.id)).toMatchObject([{ amountCents: 1000 }]);
  });

  test("never gives back more than was charged", async () => {
    const { taken, deposit, balance } = await twoCharges();

    const given = await refundFrom(db, taken, 1_000_000, { for: forId(taken) });

    expect(given).toBe(balance.amountCents + deposit.amountCents);
  });

  test("stops at a refund that fails, and a later try takes up from there", async () => {
    const { taken, balance } = await twoCharges();
    testPayments().goDown();

    expect(await refundFrom(db, taken, 3000, { for: forId(taken) })).toBe(0);
    expect(await refundsOf(balance.id)).toEqual([]);

    testPayments().goDown(false);
    expect(await refundFrom(db, taken, 3000, { for: forId(taken) })).toBe(3000);
    expect(await refundsOf(balance.id)).toMatchObject([{ amountCents: 3000 }]);
  });

  test("a refund that fails is the urgent refund_failed signal (ADR-0007)", async () => {
    const { taken, balance } = await twoCharges();
    testPayments().failRefunds("insufficient_funds");

    await refundFrom(db, taken, 3000, { for: forId(taken) });

    expect(testMonitoring().signalled("refund_failed")).toEqual([
      {
        name: "refund_failed",
        urgency: "urgent",
        context: {
          chargeId: balance.id,
          cents: 3000,
          reason: "insufficient_funds",
        },
      },
    ]);
  });
});

// #241: a refund the provider made, but that we never recorded, is found
// on the next try instead of given again, however much later
describe("refunding again after the provider made the refund", () => {
  const givenAtProvider = () => testPayments().refunds.map((r) => r.amount);

  test("when the transaction it was made in rolled back, a day later", async () => {
    const { job, client, method } = await booked();
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
    await expect(
      db.transaction(async (tx) => {
        await refundFrom(tx, taken, 3000, { for: forId(taken) });
        throw new Error("the commit failed");
      }),
    ).rejects.toThrow("the commit failed");

    testClock().advance({ hours: 25 });
    testPayments().forgetKeys();
    expect(await refundFrom(db, taken, 3000, { for: forId(taken) })).toBe(3000);

    expect(givenAtProvider()).toEqual([3000]);
    const balance = taken.find((c) => c.kind === "balance")!;
    expect(await refundsOf(balance.id)).toMatchObject([{ amountCents: 3000 }]);
  });

  test("when its reply was lost, nothing more is given until it's known", async () => {
    const { job } = await booked();
    const taken = await chargesOf(job.id);
    testPayments().loseNextReply();

    expect(await refundFrom(db, taken, 1000, { for: forId(taken) })).toBe(0);
    testClock().advance({ hours: 25 });
    testPayments().forgetKeys();
    expect(await refundFrom(db, taken, 1000, { for: forId(taken) })).toBe(1000);

    expect(givenAtProvider()).toEqual([1000]);
  });
});
