import { describe, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "#db";
import type { ClientPayment, SignedInAccount } from "@empire-cleaning/models";
import { undoCompletion } from "#features/completion";
import { signIn } from "../../../tests/harness.ts";
import {
  billedWeek,
  casey,
  completedFirstClean,
  guestAsk,
  signInAsOffice,
  startedServicePlan,
  submit,
} from "../../../tests/fixtures.ts";
import { charges } from "./payments.schema.ts";

const officeAccount = async () => {
  const office = await signInAsOffice();
  return (await office.get("/api/me").expect(200)).body as SignedInAccount;
};

const historyOf = async (address: string) => {
  const client = await signIn(address);
  return (await client.get("/api/payments/mine").expect(200))
    .body as ClientPayment[];
};

describe("a Client's payment history", () => {
  test("holds a clean's Deposit and Balance, newest first, with what they were for", async () => {
    const me = await officeAccount();
    const { job } = await completedFirstClean({ byAccountId: me.id });

    const history = await historyOf(casey.email);

    expect(history.map((p) => p.kind)).toEqual(["balance", "deposit"]);
    for (const payment of history) {
      expect(payment.amountCents).toBeGreaterThan(0);
      expect(payment.job).toMatchObject({
        id: job.id,
        serviceName: "Deep Clean",
        status: "completed",
      });
      expect(payment).toMatchObject({ bill: null, clearing: false });
    }
  });

  test("tells a clean's own Balance from a later one for an increase, both taken at one moment", async () => {
    const me = await officeAccount();
    const { job } = await completedFirstClean({ byAccountId: me.id });
    const [own] = await db
      .select()
      .from(charges)
      .where(and(eq(charges.jobId, job.id), eq(charges.kind, "balance")));
    // a Balance for an increase approved later, at the same moment by the
    // clock (a test's stands still). The clean's own was made first, but is
    // written again after it, so Postgres hands it back second
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...rest
    } = own!;
    await db.insert(charges).values({
      ...rest,
      amountCents: 5988,
      item: "1 extra hour",
      gatewayRef: "fake_extra",
    });
    await db.delete(charges).where(eq(charges.id, own!.id));
    await db.insert(charges).values(own!);

    const history = await historyOf(casey.email);

    expect(history.find((p) => p.kind === "balance")).toMatchObject({
      amountCents: own!.amountCents,
      item: null,
    });
    expect(history.find((p) => p.kind === "extra")).toMatchObject({
      amountCents: 5988,
      item: "1 extra hour",
    });
  });

  test("holds a Service Plan's Deposit, for the plan", async () => {
    const me = await officeAccount();
    const { propertyId } = await completedFirstClean({ byAccountId: me.id });
    const { planId } = await startedServicePlan({
      propertyId,
      byAccountId: me.id,
      startsAt: "2026-01-19T14:00:00.000Z",
    });

    const history = await historyOf(casey.email);

    expect(history.find((p) => p.servicePlanId === planId)).toMatchObject({
      kind: "deposit",
      job: null,
    });
  });

  test("holds a refund as money back, for what its Charge was for", async () => {
    const me = await officeAccount();
    const { job } = await completedFirstClean({ byAccountId: me.id });
    await undoCompletion(job.id);

    const history = await historyOf(casey.email);
    const balance = history.find((p) => p.kind === "balance")!;
    const refund = history.find((p) => p.kind === "refund")!;

    expect(refund.amountCents).toBe(-balance.amountCents);
    expect(refund.job).toMatchObject({ id: job.id, status: "booked" });
  });

  test("holds a weekly Bill, by its number and week", async () => {
    const me = await officeAccount();
    const { billId } = await billedWeek({ byAccountId: me.id });

    const [latest] = await historyOf(casey.email);

    expect(latest).toMatchObject({
      kind: "bill",
      job: null,
      bill: { id: billId, weekStart: "2026-01-05", weekEnd: "2026-01-11" },
      clearing: false,
    });
    expect(latest!.bill!.number).toMatch(/^EC-\d{6}$/);
  });

  test("leaves out a Bill whose Charge failed: nothing moved", async () => {
    const me = await officeAccount();
    await billedWeek({ byAccountId: me.id, failing: true });

    const history = await historyOf(casey.email);

    expect(history.some((p) => p.kind === "bill")).toBe(false);
  });

  test("is empty for a Client who has paid nothing", async () => {
    await submit(guestAsk()).expect(201);

    expect(await historyOf(casey.email)).toEqual([]);
  });
});
