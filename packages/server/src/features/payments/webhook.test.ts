import { describe, expect, test } from "vitest";
import type { ClientPayment, SignedInAccount } from "@empire-cleaning/models";
import { cancelJob, cancelTermsOf } from "#features/cancellation";
import { settleJob } from "#features/completion";
import { createStaff, setUsualWeek } from "#features/staff";
import { FAKE_SIGNATURE } from "../../../tests/fakes/payment-gateway.ts";
import {
  api,
  signIn,
  testMonitoring,
  testPayments,
} from "../../../tests/harness.ts";
import {
  acceptedJob,
  casey,
  completedFirstClean,
  signInAsOffice,
} from "../../../tests/fixtures.ts";

const webhook = (event: unknown) =>
  api()
    .post("/api/payments/webhook")
    .set("content-type", "application/json")
    .set("x-fake-signature", FAKE_SIGNATURE)
    .send(JSON.stringify(event));

const officeAccount = async () => {
  const office = await signInAsOffice();
  return (await office.get("/api/me").expect(200)).body as SignedInAccount;
};

const historyOf = async (address: string) => {
  const client = await signIn(address);
  return (await client.get("/api/payments/mine").expect(200))
    .body as ClientPayment[];
};

// Casey's Deep Clean at 9am on Monday 12 January, with its Deposit taken,
// and a Cleaner free that day
const bookedJob = async (byAccountId: string) => {
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  return acceptedJob({ startsAt: "2026-01-12T14:00:00Z", byAccountId });
};

// someone refunds `amount` of a Charge in the provider's dashboard, and the
// provider tells us
const refundAtProvider = async (chargeId: string, amount: number) => {
  testPayments().refundAtProvider(chargeId, amount);
  await webhook({ kind: "charge_refunded", chargeId }).expect(200);
};

describe("what the provider tells us of Charges (ADR-0007)", () => {
  test("a dispute is the urgent dispute_opened signal", async () => {
    await webhook({ kind: "dispute_opened", chargeId: "pi_1" }).expect(200);

    expect(testMonitoring().signals).toEqual([
      { name: "dispute_opened", urgency: "urgent", context: { ref: "pi_1" } },
    ]);
  });

  test("a refund of a payment we have no Charge for is only counted", async () => {
    await webhook({ kind: "charge_refunded", chargeId: "pi_1" }).expect(200);

    expect(testMonitoring().signals).toEqual([
      {
        name: "refunded_at_provider",
        urgency: "counted",
        context: { ref: "pi_1" },
      },
    ]);
  });
});

// the Office giving money back by hand, as a goodwill gesture (ADR-0021)
describe("a refund made in the provider's dashboard", () => {
  test("is recorded against its Charge once, however often we're told, and counted", async () => {
    const me = await officeAccount();
    const { job } = await completedFirstClean({ byAccountId: me.id });
    const balance = testPayments().charges[1]!;

    await refundAtProvider(balance.chargeId, 2000);
    await webhook({ kind: "charge_refunded", chargeId: balance.chargeId });

    const history = await historyOf(casey.email);
    expect(history.filter((p) => p.kind === "refund")).toEqual([
      expect.objectContaining({
        amountCents: -2000,
        job: expect.objectContaining({ id: job.id }),
      }),
    ]);
    expect(testMonitoring().signals).toEqual([
      {
        name: "refunded_at_provider",
        urgency: "counted",
        context: { chargeId: expect.any(String), cents: 2000 },
      },
    ]);
  });

  test("is a discount: settling the Job again charges nothing back", async () => {
    const me = await officeAccount();
    const { job } = await completedFirstClean({ byAccountId: me.id });
    const balance = testPayments().charges[1]!;
    await refundAtProvider(balance.chargeId, 2000);

    const settled = await settleJob(job.id);

    expect(settled).toMatchObject({ chargedCents: 0, refundedCents: 0 });
    expect(testPayments().charges).toHaveLength(2);
  });

  test("of part of a Deposit, leaves only the rest to give back when cancelling free", async () => {
    const me = await officeAccount();
    const job = await bookedJob(me.id);
    const deposit = testPayments().charges[0]!;
    await refundAtProvider(deposit.chargeId, 1000);

    expect((await cancelTermsOf(job))!.client).toMatchObject({
      feeCents: 0,
      refundCents: deposit.amount - 1000,
    });
    await cancelJob(job.id, {
      by: "client",
      feeCents: 0,
      reason: null,
      byAccountId: me.id,
      byClient: false,
    });

    expect(testPayments().refunds.map((r) => r.amount)).toEqual([
      deposit.amount - 1000,
    ]);
  });

  test("isn't recorded again when it's one of ours", async () => {
    const me = await officeAccount();
    const job = await bookedJob(me.id);
    const deposit = testPayments().charges[0]!;
    await cancelJob(job.id, {
      by: "client",
      feeCents: 0,
      reason: null,
      byAccountId: me.id,
      byClient: false,
    });

    await webhook({ kind: "charge_refunded", chargeId: deposit.chargeId });

    const history = await historyOf(casey.email);
    expect(history.filter((p) => p.kind === "refund")).toHaveLength(1);
    expect(testMonitoring().signalled("refunded_at_provider")).toEqual([]);
  });
});
