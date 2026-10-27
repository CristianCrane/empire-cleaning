import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  BillPaymentForm,
  BillSummary,
  BillView,
  OfficeClientView,
  CompletionInput,
  NeedsAttentionItem,
  OfficeServicePlan,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import { chaseBills, makeDueBills } from "#features/bills";
import { cancelJob } from "#features/cancellation";
import { findClientByEmail } from "#features/clients";
import {
  adjustments,
  answerAdjustment,
  completeJob,
  paymentOf,
  proposeAdjustment,
  undoCompletion,
} from "#features/completion";
import { jobs } from "#features/jobs";
import { servicePlans } from "#features/service-plans";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  api,
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import { FAKE_SIGNATURE } from "../../../tests/fakes/payment-gateway.ts";
import {
  acceptedJob,
  addPremises,
  casey,
  signInAsOffice,
  startedServicePlan,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// The test clock starts at 4am on Monday 5 January 2026 in New York. Casey's
// Deep Clean is at 9am on Wednesday the 7th, done at noon; that week's Bill
// is made on Monday the 12th.
const WEDNESDAY_9AM = "2026-01-07T14:00:00Z";
const WEDNESDAY_NOON = new Date("2026-01-07T17:00:00Z");
const NEXT_MONDAY = new Date("2026-01-12T15:00:00Z");
const BILLING_EMAIL = "accounts@acme.example.com";

// Cory, who works weekdays, so the Schedule has room
const cory = async () => {
  const member = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
  return member;
};

const setBilling = (
  office: Agent,
  clientId: string,
  changes: Partial<{
    weekly: boolean;
    payment: "automatic" | "on_page";
    termsDays: number;
    billingEmail: string | null;
  }> = {},
) =>
  office.put(`/api/clients/${clientId}/billing`).send({
    weekly: true,
    payment: "automatic",
    termsDays: 14,
    billingEmail: BILLING_EMAIL,
    ...changes,
  });

/**
 * Casey's Deep Clean on Wednesday, booked with a 25% Deposit, done by Cory
 * at noon; Casey has business premises and is billed weekly, as `billing`
 * sets, from this week. The clock is left at noon on Wednesday.
 */
const billedJob = async (
  billing: Parameters<typeof setBilling>[2] = {},
  reports: CompletionInput["reports"] = [],
) => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const cleaner = await cory();
  const job = await acceptedJob({
    startsAt: WEDNESDAY_9AM,
    byAccountId: me.id,
  });
  const client = (await findClientByEmail(casey.email))!;
  await addPremises(client.id);
  await setBilling(office, client.id, billing).expect(200);

  const offered = await offerAssignment(job.id, cleaner.id, me.id);
  await confirmAssignment(cleaner.id, offered.assignments[0]!.id);
  testClock().set(WEDNESDAY_NOON);
  await completeJob(cleaner.id, job.id, { condition: "moderate", reports });

  const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
  const payment = await paymentOf(row!);
  const depositCents = payment.charges[0]!.amountCents;
  return {
    office,
    me,
    clientId: client.id,
    jobId: job.id,
    priceCents: payment.totalCents,
    depositCents,
  };
};

const billsOf = async (office: Agent, clientId: string) =>
  (await office.get(`/api/bills?clientId=${clientId}`).expect(200))
    .body as BillSummary[];

const billOf = async (office: Agent, id: string) =>
  (await office.get(`/api/bills/${id}`).expect(200)).body as BillView;

const webhook = (event: object) =>
  api()
    .post("/api/payments/webhook")
    .set("content-type", "application/json")
    .set("x-fake-signature", FAKE_SIGNATURE)
    .send(JSON.stringify(event));

describe("weekly billing settings", () => {
  test("only a commercial Client can be billed weekly", async () => {
    const office = await signInAsOffice();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    await cory();
    await acceptedJob({ startsAt: WEDNESDAY_9AM, byAccountId: me.id });
    const client = (await findClientByEmail(casey.email))!;

    const before = (await office.get(`/api/clients/${client.id}`).expect(200))
      .body as OfficeClientView;
    expect(before.billing).toMatchObject({
      weeklyFrom: null,
      canBillWeekly: false,
      payment: "automatic",
      termsDays: 14,
    });
    await setBilling(office, client.id).expect(409);

    await addPremises(client.id);
    testClock().set(new Date("2026-01-08T15:00:00Z"));
    const on = (
      await setBilling(office, client.id, {
        payment: "on_page",
        termsDays: 30,
        billingEmail: "Accounts@Acme.example.com",
      }).expect(200)
    ).body as OfficeClientView;
    // from the Monday of this week
    expect(on.billing).toEqual({
      weeklyFrom: "2026-01-05",
      canBillWeekly: true,
      payment: "on_page",
      termsDays: 30,
      billingEmail: BILLING_EMAIL,
    });

    const off = (
      await setBilling(office, client.id, { weekly: false }).expect(200)
    ).body as OfficeClientView;
    expect(off.billing.weeklyFrom).toBeNull();
  });
});

describe("making Bills", () => {
  test("a completed Job charges nothing, and goes on Monday's Bill less its Deposit, charged then", async () => {
    const { office, clientId, priceCents, depositCents } = await billedJob();
    // only the Deposit has been taken
    expect(testPayments().charges).toHaveLength(1);
    expect(testEmail().lastTo(casey.email).text).toContain(
      "It goes on your weekly bill.",
    );

    // nothing before the week is over
    testClock().set(new Date("2026-01-11T15:00:00Z"));
    await makeDueBills();
    expect(await billsOf(office, clientId)).toEqual([]);

    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [summary] = await billsOf(office, clientId);
    const bill = await billOf(office, summary!.id);
    expect(bill).toMatchObject({
      number: "EC-000001",
      weekStart: "2026-01-05",
      weekEnd: "2026-01-11",
      dueOn: "2026-01-12",
      payment: "automatic",
      status: "paid",
      paidVia: "charge",
      totalCents: priceCents - depositCents,
      unpaid: null,
    });
    expect(bill.lines.map((l) => l.amountCents)).toEqual([
      priceCents,
      -depositCents,
    ]);
    expect(bill.lines[0]!.label).toContain("Deep Clean at 41-12 Austin St");
    expect(bill.taxCents).toBeGreaterThan(0);
    expect(testPayments().charges.at(-1)!.amount).toBe(
      priceCents - depositCents,
    );

    const receipt = testEmail().lastTo(BILLING_EMAIL);
    expect(receipt.subject).toBe("Your receipt for bill EC-000001");
    expect(receipt.text).toContain(
      "Week: Monday, January 5 to Sunday, January 11",
    );
    expect(receipt.text).toContain("Deposit paid:");
    expect(receipt.text).toContain("Tax included:");
    expect(receipt.text).toContain("/portal/bills/");

    // making them again makes and charges nothing twice
    await makeDueBills();
    testClock().advance({ hours: 3 });
    await makeDueBills();
    expect(await billsOf(office, clientId)).toHaveLength(1);
    expect(testPayments().charges).toHaveLength(2);
  });

  test("goes to the Client's own email with no billing email", async () => {
    await billedJob({ billingEmail: null });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    expect(testEmail().lastTo(casey.email).subject).toBe(
      "Your receipt for bill EC-000001",
    );
  });

  test("a Late Cancellation's fee goes on the Bill as a line, its Deposit kept", async () => {
    const office = await signInAsOffice();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    await cory();
    const job = await acceptedJob({
      startsAt: WEDNESDAY_9AM,
      byAccountId: me.id,
    });
    const client = (await findClientByEmail(casey.email))!;
    await addPremises(client.id);
    await setBilling(office, client.id).expect(200);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    const deposit = (await paymentOf(row!)).paidCents;
    testClock().set(new Date("2026-01-07T12:00:00Z"));
    await cancelJob(job.id, {
      by: "client",
      feeCents: deposit,
      reason: null,
      byAccountId: me.id,
      byClient: false,
    });

    // a one-off Job's fee is its Deposit, already taken: nothing to bill
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    expect(await billsOf(office, client.id)).toEqual([]);
  });

  test("a Bill paid on its page is due after the Client's terms, and can be paid by card", async () => {
    const { office, clientId, priceCents, depositCents } = await billedJob({
      payment: "on_page",
      termsDays: 30,
    });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [summary] = await billsOf(office, clientId);
    expect(summary).toMatchObject({ status: "due", dueOn: "2026-02-11" });
    // nothing charged
    expect(testPayments().charges).toHaveLength(1);
    const sent = testEmail().lastTo(BILLING_EMAIL);
    expect(sent.subject).toBe("Your bill EC-000001 from Empire Cleaning");
    expect(sent.text).toContain("Due by: Wednesday, February 11");

    const client = await signIn(casey.email);
    const form = (
      await client
        .post(`/api/bills/mine/${summary!.id}/payment-form`)
        .expect(200)
    ).body as BillPaymentForm;
    expect(testPayments().lastBillPayment().amount).toBe(
      priceCents - depositCents,
    );
    testPayments().payBill(form.ref, "card");
    const paid = (
      await client
        .post(`/api/bills/mine/${summary!.id}/payment`)
        .send({ ref: form.ref })
        .expect(200)
    ).body as BillView;
    expect(paid).toMatchObject({
      status: "paid",
      paidVia: "page",
      payable: false,
    });
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Your receipt for bill EC-000001",
    );

    // the webhook saying so too changes nothing
    await webhook({
      kind: "bill_payment_succeeded",
      ref: form.ref,
      reference: summary!.id,
    }).expect(200);
    expect(testPayments().charges).toHaveLength(2);
    expect(testPayments().refunds).toEqual([]);
  });

  test("a bank debit is processing until it clears, or due again if it fails", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    const client = await signIn(casey.email);

    const first = (
      await client.post(`/api/bills/mine/${id}/payment-form`).expect(200)
    ).body as BillPaymentForm;
    testPayments().payBill(first.ref, "bank");
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ ref: first.ref })
      .expect(200);
    expect((await billOf(office, id)).status).toBe("processing");
    // it can't be voided, or paid again, meanwhile
    await office
      .post(`/api/bills/${id}/void`)
      .send({ reason: "x" })
      .expect(409);
    await client.post(`/api/bills/mine/${id}/payment-form`).expect(409);

    testPayments().clearBankDebit(first.ref, false);
    await webhook({
      kind: "bill_payment_failed",
      ref: first.ref,
      reference: id,
    }).expect(200);
    expect((await billOf(office, id)).status).toBe("due");
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Your bank payment for bill EC-000001 didn't go through",
    );

    const second = (
      await client.post(`/api/bills/mine/${id}/payment-form`).expect(200)
    ).body as BillPaymentForm;
    testPayments().payBill(second.ref, "bank");
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ ref: second.ref })
      .expect(200);
    testPayments().clearBankDebit(second.ref);
    await webhook({
      kind: "bill_payment_succeeded",
      ref: second.ref,
      reference: id,
    }).expect(200);
    expect(await billOf(office, id)).toMatchObject({
      status: "paid",
      paidVia: "page",
    });
  });

  test("a payment for something else pays nothing", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];

    const other = await testPayments().startBillPayment({
      payerId: "cus_other",
      amount: 100,
      description: "Someone else's bill",
      reference: randomUUID(),
      idempotencyKey: "other",
    });
    testPayments().payBill(other.ref);
    const client = await signIn(casey.email);
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ ref: other.ref })
      .expect(409);
    expect((await billOf(office, id)).status).toBe("due");
  });

  test("a Client sees only their own Bills", async () => {
    const { office, clientId } = await billedJob();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];

    const client = await signIn(casey.email);
    const mine = (await client.get("/api/bills/mine").expect(200))
      .body as BillSummary[];
    expect(mine.map((b) => b.id)).toEqual([id]);
    await client.get(`/api/bills/mine/${id}`).expect(200);
    await client.get(`/api/bills/mine/${randomUUID()}`).expect(404);
    await client.get(`/api/bills/${id}`).expect(403);
  });
});

describe("Unpaid Bills", () => {
  test("a failed automatic Charge makes the Bill Unpaid and the Client's plan On Hold, until a new card pays it", async () => {
    const office = await signInAsOffice();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    const { id: coryId } = await cory();
    const first = await acceptedJob({
      startsAt: WEDNESDAY_9AM,
      byAccountId: me.id,
    });
    const offered = await offerAssignment(first.id, coryId, me.id);
    await confirmAssignment(coryId, offered.assignments[0]!.id);
    testClock().set(WEDNESDAY_NOON);
    await completeJob(coryId, first.id, {
      condition: "moderate",
      reports: [],
    });
    // a weekly plan from Thursday the 8th
    const { planId, firstJob } = await startedServicePlan({
      propertyId: first.propertyId,
      byAccountId: me.id,
      startsAt: "2026-01-08T14:00:00Z",
    });
    const client = (await findClientByEmail(casey.email))!;
    await addPremises(client.id);
    await setBilling(office, client.id).expect(200);
    const placed = await offerAssignment(firstJob.id, coryId, me.id);
    await confirmAssignment(coryId, placed.assignments[0]!.id);
    testClock().set(new Date("2026-01-08T17:00:00Z"));
    await completeJob(coryId, firstJob.id, {
      condition: "moderate",
      reports: [],
    });

    testPayments().failCharges();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [summary] = await billsOf(office, client.id);
    expect(summary).toMatchObject({
      status: "due",
      unpaid: { reason: "card_declined" },
    });
    const [plan] = await db
      .select()
      .from(servicePlans)
      .where(eq(servicePlans.id, planId));
    expect(plan!.status).toBe("on_hold");
    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.subject).toBe("We couldn't take payment for bill EC-000001");
    expect(notice.text).toContain("Service Plan is On Hold");
    expect(
      (await office.get("/api/bills?unpaid=true").expect(200)).body,
    ).toHaveLength(1);
    // the plan says which Bill holds it, and the Office is to chase both
    expect(
      (
        (await office.get(`/api/service-plans/${planId}`).expect(200))
          .body as OfficeServicePlan
      ).unpaidBills,
    ).toEqual([
      {
        billId: summary!.id,
        number: "EC-000001",
        totalCents: summary!.totalCents,
      },
    ]);
    const attention = (
      await office.get("/api/dashboard/needs-attention").expect(200)
    ).body as NeedsAttentionItem[];
    expect(attention).toContainEqual(
      expect.objectContaining({
        kind: "bill_unpaid",
        bill: expect.objectContaining({ id: summary!.id }),
      }),
    );
    expect(attention).toContainEqual(
      expect.objectContaining({
        kind: "plan_on_hold",
        owedCents: 0,
        bills: ["EC-000001"],
      }),
    );

    testPayments().failCharges(null);
    const agent = await signIn(casey.email);
    const form = (
      await agent.post("/api/payment-methods/mine/card-form").expect(200)
    ).body as { secret: string };
    await agent
      .put("/api/payment-methods/mine")
      .send({ token: form.secret })
      .expect(200);
    expect(await billOf(office, summary!.id)).toMatchObject({
      status: "paid",
      paidVia: "charge",
      unpaid: null,
    });
    const [resumed] = await db
      .select()
      .from(servicePlans)
      .where(eq(servicePlans.id, planId));
    expect(resumed!.status).toBe("active");
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "Your Service Plan is back on",
    );
  });

  test("Office Staff can record a payment made another way, which settles it", async () => {
    const { office, clientId } = await billedJob();
    testPayments().failCharges();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];

    await office
      .post(`/api/bills/${id}/outside-payment`)
      .send({ note: "" })
      .expect(400);
    const paid = (
      await office
        .post(`/api/bills/${id}/outside-payment`)
        .send({ note: "Cheque 1042" })
        .expect(200)
    ).body as BillView;
    expect(paid).toMatchObject({
      status: "paid",
      paidVia: "outside",
      paymentNote: "Cheque 1042",
      unpaid: null,
    });
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "We've received your payment",
    );
    await office
      .post(`/api/bills/${id}/outside-payment`)
      .send({ note: "again" })
      .expect(409);
  });
});

describe("reminders and late Bills", () => {
  // 3pm in New York, or 7am, before reminders go out
  const at = (day: string, time = "20:00") => new Date(`${day}T${time}:00Z`);
  const reminders = () =>
    testEmail()
      .to(BILLING_EMAIL)
      .map((m) => m.subject)
      .filter((s) => s.startsWith("Bill EC-000001 is"));

  test("a Bill paid on its page is reminded 3 days before it's due, on the day, and weekly while late, each once", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    expect((await billOf(office, id)).dueOn).toBe("2026-01-26");

    // none until 3 days before, from 8am
    testClock().set(at("2026-01-22"));
    expect(await chaseBills()).toBe(0);
    testClock().set(at("2026-01-23", "12:00"));
    expect(await chaseBills()).toBe(0);

    // an email that fails goes on the next run
    testClock().set(at("2026-01-23"));
    testEmail().failSending();
    expect(await chaseBills()).toBe(0);
    testEmail().sendNormally();
    expect(await chaseBills()).toBe(1);
    expect(await chaseBills()).toBe(0);
    const before = testEmail().lastTo(BILLING_EMAIL);
    expect(before.subject).toBe("Bill EC-000001 is due Monday, January 26");
    expect(before.text).toContain("Due by: Monday, January 26");
    expect(before.html).toContain(`/portal/bills/${id}`);
    // the Office is copied only once it's late
    expect(before.bcc).toBeUndefined();

    testClock().set(at("2026-01-26"));
    await Promise.all([chaseBills(), chaseBills()]);
    expect(reminders()).toEqual([
      "Bill EC-000001 is due Monday, January 26",
      "Bill EC-000001 is due today",
    ]);
    expect((await billOf(office, id)).unpaid).toBeNull();

    // Unpaid from the next day, told so, and under Needs attention
    testClock().set(at("2026-01-27", "06:00"));
    expect(await chaseBills()).toBe(0);
    expect((await billOf(office, id)).unpaid).not.toBeNull();
    testClock().set(at("2026-01-27"));
    expect(await chaseBills()).toBe(1);
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Bill EC-000001 is overdue",
    );
    expect(testEmail().lastTo(BILLING_EMAIL).bcc).toBe("office@example.com");
    expect((await billOf(office, id)).unpaid).toEqual({
      since: "2026-01-27T05:00:00.000Z",
      reason: "not paid by its due date",
    });
    expect(
      (await office.get("/api/dashboard/needs-attention").expect(200))
        .body as NeedsAttentionItem[],
    ).toContainEqual(
      expect.objectContaining({
        kind: "bill_unpaid",
        bill: expect.objectContaining({ id }),
      }),
    );

    // weekly while late
    testClock().set(at("2026-02-01"));
    expect(await chaseBills()).toBe(0);
    testClock().set(at("2026-02-02"));
    expect(await chaseBills()).toBe(1);
    testClock().set(at("2026-02-08"));
    expect(await chaseBills()).toBe(0);
    testClock().set(at("2026-02-09"));
    expect(await chaseBills()).toBe(1);
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Bill EC-000001 is overdue",
    );
    expect(testEmail().lastTo(BILLING_EMAIL).bcc).toBe("office@example.com");

    // none once it's paid
    const client = await signIn(casey.email);
    const form = (
      await client.post(`/api/bills/mine/${id}/payment-form`).expect(200)
    ).body as BillPaymentForm;
    testPayments().payBill(form.ref, "card");
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ ref: form.ref })
      .expect(200);
    expect((await billOf(office, id)).unpaid).toBeNull();
    testClock().set(at("2026-02-16"));
    expect(await chaseBills()).toBe(0);
    expect(reminders()).toHaveLength(5);
  });

  test("a voided Bill, or one charged automatically, is never reminded", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    await office
      .post(`/api/bills/${id}/void`)
      .send({ reason: "Sent to the wrong address" })
      .expect(200);
    for (const day of ["2026-01-23", "2026-01-26", "2026-01-27"]) {
      testClock().set(at(day));
      expect(await chaseBills()).toBe(0);
    }
    expect((await billOf(office, id)).unpaid).toBeNull();

    // the next week's, charged automatically and declined, is Unpaid but
    // not reminded
    await setBilling(office, clientId).expect(200);
    testPayments().failCharges();
    testClock().set(at("2026-01-19"));
    await makeDueBills();
    testClock().set(at("2026-01-26"));
    expect(await chaseBills()).toBe(0);
  });

  test("a late Bill puts the Client's plan On Hold, until a payment Office Staff record lifts it", async () => {
    const office = await signInAsOffice();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    const { id: coryId } = await cory();
    const first = await acceptedJob({
      startsAt: WEDNESDAY_9AM,
      byAccountId: me.id,
    });
    const offered = await offerAssignment(first.id, coryId, me.id);
    await confirmAssignment(coryId, offered.assignments[0]!.id);
    testClock().set(WEDNESDAY_NOON);
    await completeJob(coryId, first.id, {
      condition: "moderate",
      reports: [],
    });
    const { planId, firstJob } = await startedServicePlan({
      propertyId: first.propertyId,
      byAccountId: me.id,
      startsAt: "2026-01-08T14:00:00Z",
    });
    const client = (await findClientByEmail(casey.email))!;
    await addPremises(client.id);
    await setBilling(office, client.id, { payment: "on_page" }).expect(200);
    const placed = await offerAssignment(firstJob.id, coryId, me.id);
    await confirmAssignment(coryId, placed.assignments[0]!.id);
    testClock().set(new Date("2026-01-08T17:00:00Z"));
    await completeJob(coryId, firstJob.id, {
      condition: "moderate",
      reports: [],
    });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, client.id)) as [BillSummary];
    const planStatus = async () =>
      (
        await db
          .select({ status: servicePlans.status })
          .from(servicePlans)
          .where(eq(servicePlans.id, planId))
      )[0]!.status;

    testClock().set(at("2026-01-26"));
    await chaseBills();
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "If it isn't paid by then, your Service Plan goes On Hold",
    );
    expect(await planStatus()).toBe("active");

    testClock().set(at("2026-01-27"));
    await chaseBills();
    expect(await planStatus()).toBe("on_hold");
    expect(
      (
        (await office.get(`/api/service-plans/${planId}`).expect(200))
          .body as OfficeServicePlan
      ).unpaidBills,
    ).toHaveLength(1);
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "your Service Plan is On Hold",
    );

    // a bank debit on its way lifts On Hold; failing, it holds again
    const agent = await signIn(casey.email);
    const form = (
      await agent.post(`/api/bills/mine/${id}/payment-form`).expect(200)
    ).body as BillPaymentForm;
    testPayments().payBill(form.ref, "bank");
    await agent
      .post(`/api/bills/mine/${id}/payment`)
      .send({ ref: form.ref })
      .expect(200);
    expect(await planStatus()).toBe("active");
    testClock().set(at("2026-02-02"));
    expect(await chaseBills()).toBe(0);
    testPayments().clearBankDebit(form.ref, false);
    await webhook({
      kind: "bill_payment_failed",
      ref: form.ref,
      reference: id,
    }).expect(200);
    expect(await planStatus()).toBe("on_hold");
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "your Service Plan is On Hold",
    );

    await office
      .post(`/api/bills/${id}/outside-payment`)
      .send({ note: "Cheque 1042" })
      .expect(200);
    expect(await planStatus()).toBe("active");
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "Your Service Plan is back on",
    );
  });
});

describe("putting Bills right", () => {
  test("an increase approved after the Bill was made goes on the next one, charging nothing itself", async () => {
    const { office, me, clientId, jobId } = await billedJob({}, [
      { kind: "extra_time", hours: 1, reason: "Very dusty" },
    ]);
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [adjustment] = await db
      .select()
      .from(adjustments)
      .where(eq(adjustments.jobId, jobId));
    await proposeAdjustment(jobId, adjustment!.id, {}, me.id);
    await answerAdjustment(clientId, jobId, adjustment!.id, true);
    // the Deposit and the first Bill
    expect(testPayments().charges).toHaveLength(2);

    testClock().advance({ days: 7 });
    await makeDueBills();
    const [next] = await billsOf(office, clientId);
    const view = await billOf(office, next!.id);
    expect(view.weekStart).toBe("2026-01-12");
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]!.label).toMatch(/^1 extra hour: Deep Clean/);
    expect(view.totalCents).toBeGreaterThan(0);
    expect(testPayments().charges.at(-1)!.amount).toBe(view.totalCents);
  });

  test("a voided Bill's lines go on the next one", async () => {
    const { office, clientId, priceCents, depositCents } = await billedJob({
      payment: "on_page",
    });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];

    const voided = (
      await office
        .post(`/api/bills/${id}/void`)
        .send({ reason: "Sent to the wrong address" })
        .expect(200)
    ).body as BillView;
    expect(voided).toMatchObject({
      status: "void",
      voidReason: "Sent to the wrong address",
      payable: false,
    });
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Bill EC-000001 is cancelled",
    );
    await office
      .post(`/api/bills/${id}/void`)
      .send({ reason: "x" })
      .expect(409);

    testClock().advance({ days: 7 });
    await makeDueBills();
    const [next] = await billsOf(office, clientId);
    expect(next).toMatchObject({
      number: "EC-000002",
      weekStart: "2026-01-12",
      totalCents: priceCents - depositCents,
    });
  });

  test("a completion undone after billing is a credit on the next Bill, refunded if none follows in 30 days", async () => {
    const { office, clientId, jobId, priceCents, depositCents } =
      await billedJob();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const billed = priceCents - depositCents;

    await undoCompletion(jobId);
    // nothing given back yet: it's for the next Bill
    expect(testPayments().refunds).toEqual([]);

    testClock().advance({ days: 7 });
    await makeDueBills();
    const [credit] = await billsOf(office, clientId);
    const view = await billOf(office, credit!.id);
    expect(view).toMatchObject({
      number: "EC-000002",
      totalCents: -billed,
      status: "paid",
      paidVia: "nothing_due",
    });
    expect(view.lines.every((l) => l.label.startsWith("Correction,"))).toBe(
      true,
    );
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Your bill EC-000002: a credit",
    );

    // no Bill follows: there's nothing more to bill
    testClock().advance({ days: 29 });
    await makeDueBills();
    expect(testPayments().refunds).toEqual([]);
    testClock().advance({ days: 1 });
    await makeDueBills();
    expect(testPayments().refunds.map((r) => r.amount)).toEqual([billed]);
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "We've refunded your credit from bill EC-000002",
    );
    await makeDueBills();
    expect(testPayments().refunds).toHaveLength(1);
  });

  test("switching weekly billing off charges what isn't billed yet per Job", async () => {
    const { office, clientId, priceCents, depositCents } = await billedJob();
    expect(testPayments().charges).toHaveLength(1);

    await setBilling(office, clientId, { weekly: false }).expect(200);
    expect(testPayments().charges.at(-1)!.amount).toBe(
      priceCents - depositCents,
    );
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    expect(await billsOf(office, clientId)).toEqual([]);
  });
});
