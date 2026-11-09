import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import type {
  BillPaymentForm,
  BillSummary,
  BillView,
  ClientBillingSaved,
  OfficeClientView,
  CompletionInput,
  NeedsAttentionItem,
  OfficeServicePlan,
  SignedInAccount,
} from "@empire-cleaning/models";
import { HOUR_MS, formats } from "@empire-cleaning/models";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import { bills, chaseBills, makeDueBills } from "#features/bills";
import { cancelJob } from "#features/cancellation";
import { findClientByEmail } from "#features/clients";
import {
  adjustments,
  answerAdjustment,
  completeJob,
  paymentOf,
  proposeAdjustment,
  removeAdjustment,
  settleJob,
  undoCompletion,
} from "#features/completion";
import { jobs } from "#features/jobs";
import { currentPriceList } from "#features/price-list";
import { servicePlans } from "#features/service-plans";
import { settleOpenPayments } from "#features/payments";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  type Agent,
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
  billedWeek,
  casey,
  signInAsOffice,
  startedServicePlan,
} from "../../../tests/fixtures.ts";

const { formatMoney } = formats.en;

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
 * Casey's Deep Clean on Wednesday, booked with a 25% Deposit and no Add-ons
 * unless `booked` says otherwise, done by Cory at noon; Casey has business
 * premises and is billed weekly, as `billing` sets, from this week. The
 * clock is left at noon on Wednesday.
 */
const billedJob = async (
  billing: Parameters<typeof setBilling>[2] = {},
  reports: CompletionInput["reports"] = [],
  booked: { depositPercent?: number; addOns?: string[] } = {},
) => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const cleaner = await cory();
  const job = await acceptedJob({
    startsAt: WEDNESDAY_9AM,
    byAccountId: me.id,
    ...booked,
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
    ).body as ClientBillingSaved;
    // from the Monday of this week
    expect(on.client.billing).toEqual({
      weeklyFrom: "2026-01-05",
      canBillWeekly: true,
      payment: "on_page",
      termsDays: 30,
      billingEmail: BILLING_EMAIL,
    });

    const off = (
      await setBilling(office, client.id, { weekly: false }).expect(200)
    ).body as ClientBillingSaved;
    expect(off.client.billing.weeklyFrom).toBeNull();
    // nothing was done, so nothing owed is settled
    expect(off.settled).toEqual([]);
    expect(testEmail().to(BILLING_EMAIL)).toEqual([]);
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
    expect(receipt.text).toMatch(
      /Prices include tax: \$[\d,.]+ of the total\./,
    );
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

  // #241, finding 2: a processing payment says what it's for too
  test("a bank debit on its way for something else doesn't take a Bill off hold", async () => {
    const office = await signInAsOffice();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    const { billId, planId } = await billedWeek({
      byAccountId: me.id,
      plan: true,
      failing: true,
    });
    const planStatus = async () =>
      (
        await db
          .select({ status: servicePlans.status })
          .from(servicePlans)
          .where(eq(servicePlans.id, planId!))
      )[0]!.status;
    expect(await planStatus()).toBe("on_hold");

    const client = await signIn(casey.email);
    // another Bill's, and another Client's
    for (const payerId of ["cus_casey", "cus_other"]) {
      const other = await testPayments().startBillPayment({
        payerId,
        amount: 100,
        description: "Another bill",
        reference: randomUUID(),
        idempotencyKey: `other:${payerId}`,
      });
      testPayments().payBill(other.ref, "bank");
      await client
        .post(`/api/bills/mine/${billId}/payment`)
        .send({ ref: other.ref })
        .expect(409);
      expect((await billOf(office, billId!)).status).toBe("due");
      expect(await planStatus()).toBe("on_hold");
    }
  });

  test("a payment the provider doesn't know is refused, not an error", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];

    const client = await signIn(casey.email);
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ ref: "pi_made_up" })
      .expect(409);
    expect((await billOf(office, id)).status).toBe("due");
  });

  test("a card declined on the page says why in plain words, never its code", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];

    const client = await signIn(casey.email);
    const form = (
      await client.post(`/api/bills/mine/${id}/payment-form`).expect(200)
    ).body as BillPaymentForm;
    testPayments().failCharges("expired_card");
    testPayments().payBill(form.ref, "card");
    const refused = await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ ref: form.ref })
      .expect(409);
    expect(refused.body.message).toBe(
      "Your payment didn't go through (the card has expired). Please try again, or use another card or bank account.",
    );
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

// #241, finding 8
describe("two servers making the week's Bills at once", () => {
  test("try a declined card once", async () => {
    await billedJob();
    testPayments().failCharges();
    testClock().set(NEXT_MONDAY);
    const before = testPayments().paymentAttempts.length;
    const held = testPayments().holdNextCharge();

    // the first is asking the provider, holding the Bill; the second waits
    // for it
    const first = makeDueBills();
    await held.reached;
    const second = makeDueBills();
    for (let tries = 0; ; tries += 1) {
      const { rows } = await db.execute<{ waiting: number }>(sql`
        select count(*)::int as waiting from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock'`);
      if (rows[0]!.waiting > 0) break;
      if (tries > 200) throw new Error("the second never waited for the Bill");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    held.release();
    await Promise.all([first, second]);

    expect(testPayments().paymentAttempts).toHaveLength(before + 1);
  });
});

// #241, finding 5: one Bill that fails part-way stops no other
describe("a Bill that can't be charged for want of the database", () => {
  test("doesn't stop the week's other Bills, and is charged once on the next run", async () => {
    const office = await signInAsOffice();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    const { id: coryId } = await cory();
    const dana = {
      name: "Dana Client",
      email: "dana@example.com",
      phone: casey.phone,
    };
    for (const [who, startsAt] of [
      [casey, WEDNESDAY_9AM],
      [dana, "2026-01-09T14:00:00Z"],
    ] as const) {
      const job = await acceptedJob({
        startsAt,
        byAccountId: me.id,
        client: who,
      });
      const client = (await findClientByEmail(who.email))!;
      await addPremises(client.id);
      await setBilling(office, client.id, { billingEmail: null }).expect(200);
      const offered = await offerAssignment(job.id, coryId, me.id);
      await confirmAssignment(coryId, offered.assignments[0]!.id);
      testClock().set(new Date(new Date(startsAt).getTime() + 3 * HOUR_MS));
      await completeJob(coryId, job.id, { condition: "moderate", reports: [] });
    }
    // Casey's Bill's Charge can't be recorded
    await db.execute(sql`
      create function refuse_caseys() returns trigger language plpgsql as
      $$ begin
        if exists (select 1 from bills b join clients c on c.id = b.client_id
                   where b.id = new.bill_id and c.email = 'casey@example.com')
        then raise exception 'the database is unwell'; end if;
        return new;
      end $$`);
    await db.execute(sql`
      create trigger refuse_caseys before insert on charges
      for each row execute function refuse_caseys()`);

    testClock().set(NEXT_MONDAY);
    try {
      await makeDueBills();
    } finally {
      await db.execute(sql`drop trigger refuse_caseys on charges`);
      await db.execute(sql`drop function refuse_caseys`);
    }
    const danaId = (await findClientByEmail(dana.email))!.id;
    expect(await billsOf(office, danaId)).toEqual([
      expect.objectContaining({ status: "paid" }),
    ]);
    expect(testEmail().lastTo(dana.email).subject).toMatch(/bill EC-/);

    await makeDueBills();
    const caseyId = (await findClientByEmail(casey.email))!.id;
    const [caseys] = await billsOf(office, caseyId);
    expect(caseys).toMatchObject({ status: "paid" });
    expect(
      testPayments().charges.filter((c) =>
        c.description.endsWith(caseys!.number),
      ),
    ).toHaveLength(1);
  });
});

describe("Unpaid Bills", () => {
  // a weekly plan from Friday the 9th, its first Job done, for a business
  // charged automatically each week
  const planOnBill = async () => {
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
      startsAt: "2026-01-09T14:00:00Z",
    });
    const client = (await findClientByEmail(casey.email))!;
    await addPremises(client.id);
    await setBilling(office, client.id).expect(200);
    const placed = await offerAssignment(firstJob.id, coryId, me.id);
    await confirmAssignment(coryId, placed.assignments[0]!.id);
    testClock().set(new Date("2026-01-09T17:00:00Z"));
    await completeJob(coryId, firstJob.id, {
      condition: "moderate",
      reports: [],
    });
    return { office, client, planId };
  };

  test("a failed automatic Charge makes the Bill Unpaid and the Client's plan On Hold, until a new card pays it", async () => {
    const { office, client, planId } = await planOnBill();

    testPayments().failCharges();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [summary] = await billsOf(office, client.id);
    expect(summary).toMatchObject({
      status: "due",
      unpaid: { kind: "declined", why: null },
    });
    const [plan] = await db
      .select()
      .from(servicePlans)
      .where(eq(servicePlans.id, planId));
    expect(plan!.status).toBe("on_hold");
    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.subject).toBe("We couldn't take payment for bill EC-000001");
    expect(notice.text).toContain("cleaning plan is paused");
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
      "Your cleaning plan is back on",
    );
  });

  // #241: nobody has to try again
  test("one declined once the provider is back says its plan is paused", async () => {
    await planOnBill();
    testPayments().goDown();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    testPayments().goDown(false);
    testPayments().failCharges();

    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.subject).toBe("We couldn't take payment for bill EC-000001");
    expect(notice.text).toContain("your cleaning plan is paused");
  });

  test("one declined once the provider is back tells the Client then", async () => {
    const { clientId, office } = await billedJob();
    testPayments().goDown();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    testPayments().goDown(false);
    testPayments().failCharges();

    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    const [summary] = await billsOf(office, clientId);
    expect(summary).toMatchObject({ unpaid: { kind: "declined" } });
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "We couldn't take payment for bill EC-000001",
    );
  });

  test("one Unpaid while the provider was down is charged once it's back", async () => {
    const { office, clientId } = await billedJob();
    testPayments().goDown();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    testPayments().goDown(false);
    const [summary] = await billsOf(office, clientId);
    expect(summary).toMatchObject({
      unpaid: {
        kind: "waiting",
        why: "we couldn't reach the payment service",
      },
    });
    // nothing for the Client to do: we try again ourselves
    const made = testEmail().lastTo(BILLING_EMAIL);
    expect(made.subject).toBe("Your bill EC-000001 from Empire Cleaning");
    expect(made.text).not.toContain("update your card");

    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    expect(await billOf(office, summary!.id)).toMatchObject({
      status: "paid",
      paidVia: "charge",
      unpaid: null,
    });
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Your receipt for bill EC-000001",
    );
  });

  test("one whose Charge reply was lost, then paid on its page, gives back what the lost Charge took", async () => {
    const { office, clientId } = await billedJob();
    testPayments().loseNextReply();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const lost = testPayments().charges.at(-1)!;
    const [summary] = await billsOf(office, clientId);
    const client = await signIn(casey.email);
    const form = (
      await client
        .post(`/api/bills/mine/${summary!.id}/payment-form`)
        .expect(200)
    ).body as BillPaymentForm;
    testPayments().payBill(form.ref, "card");
    await client
      .post(`/api/bills/mine/${summary!.id}/payment`)
      .send({ ref: form.ref })
      .expect(200);

    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    await settleOpenPayments();
    expect(testPayments().refunds).toEqual([
      expect.objectContaining({ chargeId: lost.chargeId, amount: lost.amount }),
    ]);
    expect(await billOf(office, summary!.id)).toMatchObject({
      status: "paid",
      paidVia: "page",
    });
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
      kind: "late",
      why: "it wasn't paid by its due date",
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
      startsAt: "2026-01-09T14:00:00Z",
    });
    const client = (await findClientByEmail(casey.email))!;
    await addPremises(client.id);
    await setBilling(office, client.id, { payment: "on_page" }).expect(200);
    const placed = await offerAssignment(firstJob.id, coryId, me.id);
    await confirmAssignment(coryId, placed.assignments[0]!.id);
    testClock().set(new Date("2026-01-09T17:00:00Z"));
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
      "If it isn't paid by then, your cleaning plan is paused",
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
      "your cleaning plan is paused",
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
      "your cleaning plan is paused",
    );

    await office
      .post(`/api/bills/${id}/outside-payment`)
      .send({ note: "Cheque 1042" })
      .expect(200);
    expect(await planStatus()).toBe("active");
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "Your cleaning plan is back on",
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
    expect(view.lines[0]!.label).toMatch(/^1 more hour: Deep Clean/);
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
    expect(view.lines.every((l) => l.label.startsWith("Corrected:"))).toBe(
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

  // #241, finding 6
  test("a lapsed credit's refund that fails after it's made counts as not refunded, and isn't tried again from that Charge", async () => {
    const { office, clientId, jobId } = await billedJob();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    await undoCompletion(jobId);
    testClock().advance({ days: 7 });
    await makeDueBills();
    testClock().advance({ days: 30 });
    await makeDueBills();
    const [refund] = testPayments().refunds;

    await api()
      .post("/api/payments/webhook")
      .set("content-type", "application/json")
      .set("x-fake-signature", FAKE_SIGNATURE)
      .send(JSON.stringify(testPayments().failRefund(refund!.refundId)))
      .expect(200);

    const [credit] = await billsOf(office, clientId);
    const [row] = await db.select().from(bills).where(eq(bills.id, credit!.id));
    expect(row).toMatchObject({
      creditRefundedCents: 0,
      creditRefundedAt: null,
    });
    testClock().advance({ days: 7 });
    await makeDueBills();
    expect(testPayments().refunds).toHaveLength(1);
  });

  // #241, finding 7: one rule for what a Job owes, billed or not
  test("Reductions bigger than the price bill what the Job's own ledger says it owes, never less than nothing", async () => {
    const list = await currentPriceList();
    const [oven, fridge] = ["Inside the oven", "Inside the fridge"].map(
      (name) => list.addOns.find((a) => a.name === name)!,
    );
    const { office, clientId, jobId, priceCents } = await billedJob(
      {},
      [
        { kind: "add_on_not_done", addOnKey: oven!.key, reason: "In use" },
        { kind: "add_on_not_done", addOnKey: fridge!.key, reason: "Full" },
      ],
      { addOns: [oven!.name, fridge!.name] },
    );
    const job = (await office.get(`/api/jobs/${jobId}`).expect(200)).body as {
      completion: { adjustments: { id: string }[] };
    };
    await office
      .patch(
        `/api/jobs/${jobId}/adjustments/${job.completion.adjustments[0]!.id}`,
      )
      .send({ priceCents: priceCents * 2, reason: "Goodwill" })
      .expect(200);
    const ledger = async () => {
      const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      return paymentOf(row!);
    };
    const owed = (await ledger()).owedCents;
    expect((await ledger()).totalCents).toBe(0);

    testClock().set(NEXT_MONDAY);
    await makeDueBills();

    const [summary] = await billsOf(office, clientId);
    const { lines } = await billOf(office, summary!.id);
    expect(lines.reduce((sum, l) => sum + l.amountCents, 0)).toBe(owed);
    expect((await ledger()).owedCents).toBe(0);
  });

  // #241, finding 4
  test("a lapsed credit is refunded from what Bills took, never from a Job's Deposit taken since", async () => {
    const { office, jobId, priceCents, depositCents } = await billedJob();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const billed = priceCents - depositCents;
    await undoCompletion(jobId);
    testClock().advance({ days: 7 });
    await makeDueBills();

    // another clean booked meanwhile: its Deposit is the latest Charge
    const later = await acceptedJob({
      startsAt: "2026-03-04T15:00:00Z",
      byAccountId: me.id,
    });
    const laterDeposit = testPayments().charges.at(-1)!;
    testClock().advance({ days: 30 });
    await makeDueBills();

    const billCharge = testPayments().charges.find((c) =>
      c.description.endsWith("EC-000001"),
    )!;
    expect(testPayments().refunds).toEqual([
      expect.objectContaining({
        chargeId: billCharge.chargeId,
        amount: billed,
      }),
    ]);
    const charged = testPayments().charges.length;
    await settleJob(later.id);
    expect(testPayments().charges).toHaveLength(charged);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, later.id));
    expect((await paymentOf(row!)).charges).toEqual([
      expect.objectContaining({
        kind: "deposit",
        amountCents: laterDeposit.amount,
        refundedCents: 0,
      }),
    ]);
  });
});

describe("switching weekly billing off", () => {
  const switchOff = async (office: Agent, clientId: string) =>
    (await setBilling(office, clientId, { weekly: false }).expect(200))
      .body as ClientBillingSaved;

  test("charges what isn't billed yet per Job, and tells the Client and the Office what it charged", async () => {
    const { office, clientId, jobId, priceCents, depositCents } =
      await billedJob();
    expect(testPayments().charges).toHaveLength(1);

    const { settled } = await switchOff(office, clientId);
    const owed = priceCents - depositCents;
    expect(testPayments().charges.at(-1)!.amount).toBe(owed);
    expect(settled).toEqual([
      {
        jobId,
        label: expect.stringMatching(/^Deep Clean at .*, Wednesday, January 7/),
        chargedCents: owed,
        refundedCents: 0,
        unpaidCents: null,
      },
    ]);
    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.subject).toBe("You're now charged per clean");
    expect(notice.text).toContain(
      `${settled[0]!.label}: charged ${formatMoney(owed)}`,
    );
    expect(notice.text).toContain("Bills already sent still need paying");

    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    expect(await billsOf(office, clientId)).toEqual([]);
  });

  // #241, finding 10: what a Bill took for a Job is given back from the
  // Bill's Charge, never from the Job's Deposit
  describe("then correcting a Job a paid Bill charged", () => {
    const deposit = () => testPayments().charges[0]!;
    const billCharge = () =>
      testPayments().charges.find((c) => c.description.endsWith("EC-000001"))!;

    test("taking an Adjustment off refunds it from the Bill's Charge", async () => {
      const { office, me, clientId, jobId } = await billedJob({}, [
        { kind: "extra_time", hours: 1, reason: "Very dusty" },
      ]);
      const [extra] = await db
        .select()
        .from(adjustments)
        .where(eq(adjustments.jobId, jobId));
      await proposeAdjustment(jobId, extra!.id, {}, me.id);
      await answerAdjustment(clientId, jobId, extra!.id, true);
      testClock().set(NEXT_MONDAY);
      await makeDueBills();
      await switchOff(office, clientId);

      await removeAdjustment(jobId, extra!.id);

      expect(testPayments().refunds).toEqual([
        expect.objectContaining({
          chargeId: billCharge().chargeId,
          amount: extra!.totalCents,
        }),
      ]);
      const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      expect((await paymentOf(row!)).owedCents).toBe(0);
      // settling again gives nothing more back
      await settleJob(jobId);
      expect(testPayments().refunds).toHaveLength(1);
    });

    test("undoing its completion refunds the Bill, and keeps the Deposit", async () => {
      const { office, clientId, jobId, priceCents, depositCents } =
        await billedJob();
      testClock().set(NEXT_MONDAY);
      await makeDueBills();
      await switchOff(office, clientId);

      await undoCompletion(jobId);

      expect(testPayments().refunds).toEqual([
        expect.objectContaining({
          chargeId: billCharge().chargeId,
          amount: priceCents - depositCents,
        }),
      ]);
      expect(
        testPayments().refunds.some((r) => r.chargeId === deposit().chargeId),
      ).toBe(false);
    });

    test("undoing a plan Job's completion refunds the Bill", async () => {
      const office = await signInAsOffice();
      const me = (await office.get("/api/me").expect(200))
        .body as SignedInAccount;
      const { clientId, billId } = await billedWeek({
        byAccountId: me.id,
        plan: true,
      });
      const view = await billOf(office, billId!);
      const planLines = view.lines.filter((l) =>
        l.label.startsWith("Standard Clean"),
      );
      const planJobId = planLines[0]!.jobId!;
      await switchOff(office, clientId);

      await undoCompletion(planJobId);

      expect(testPayments().refunds).toEqual([
        expect.objectContaining({
          chargeId: billCharge().chargeId,
          amount: planLines.reduce((sum, l) => sum + l.amountCents, 0),
        }),
      ]);
      const [row] = await db.select().from(jobs).where(eq(jobs.id, planJobId));
      expect((await paymentOf(row!)).owedCents).toBe(0);
    });
  });

  test("refunds what a Job no longer owes", async () => {
    const oven = (await currentPriceList()).addOns.find(
      (a) => a.name === "Inside the oven",
    )!;
    const { office, clientId } = await billedJob(
      {},
      [{ kind: "add_on_not_done", addOnKey: oven.key, reason: "In use" }],
      { depositPercent: 100, addOns: [oven.name] },
    );
    // its Deposit covered more than it now owes, but that's for the Bill
    expect(testPayments().refunds).toEqual([]);

    const { settled } = await switchOff(office, clientId);
    const [refund] = testPayments().refunds;
    expect(refund!.amount).toBeGreaterThan(0);
    expect(settled).toMatchObject([
      { chargedCents: 0, refundedCents: refund!.amount, unpaidCents: null },
    ]);
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      `refunded ${formatMoney(refund!.amount)}`,
    );
  });

  test("a Charge that fails leaves the Job Unpaid and the plan On Hold, and says so", async () => {
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
    // a weekly plan from Friday the 9th, its first clean billed weekly
    const { planId, firstJob } = await startedServicePlan({
      propertyId: first.propertyId,
      byAccountId: me.id,
      startsAt: "2026-01-09T14:00:00Z",
    });
    const client = (await findClientByEmail(casey.email))!;
    await addPremises(client.id);
    await setBilling(office, client.id).expect(200);
    const placed = await offerAssignment(firstJob.id, coryId, me.id);
    await confirmAssignment(coryId, placed.assignments[0]!.id);
    testClock().set(new Date("2026-01-09T17:00:00Z"));
    await completeJob(coryId, firstJob.id, {
      condition: "moderate",
      reports: [],
    });

    testPayments().failCharges();
    const { settled } = await switchOff(office, client.id);
    // the first Job was paid in full when it was done, so only the plan's
    // is settled
    expect(settled).toEqual([
      expect.objectContaining({
        jobId: firstJob.id,
        chargedCents: 0,
        unpaidCents: expect.any(Number),
      }),
    ]);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, firstJob.id));
    expect(job!.unpaidSince).not.toBeNull();
    const [plan] = await db
      .select()
      .from(servicePlans)
      .where(eq(servicePlans.id, planId));
    expect(plan!.status).toBe("on_hold");

    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.subject).toBe("We couldn't take payment for your cleans");
    expect(notice.text).toContain(
      `couldn't take ${formatMoney(settled[0]!.unpaidCents!)}`,
    );
    expect(notice.text).toContain("update your card");
    expect(notice.text).toContain("cleaning plan is paused");
    expect(notice.html).toContain("/portal/payment-method");
  });

  test("with nothing owed, sends nothing about money", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const sent = testEmail().to(BILLING_EMAIL).length;
    const charged = testPayments().charges.length;

    // the Job is on Monday's Bill, which stays due
    const { settled } = await switchOff(office, clientId);
    expect(settled).toEqual([]);
    expect(testPayments().charges).toHaveLength(charged);
    expect(testEmail().to(BILLING_EMAIL)).toHaveLength(sent);
  });

  test("voiding a Bill afterwards charges its Jobs per Job, and says what it charged", async () => {
    const { office, clientId, priceCents, depositCents } = await billedJob({
      payment: "on_page",
    });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    await switchOff(office, clientId);

    await office
      .post(`/api/bills/${id}/void`)
      .send({ reason: "Sent to the wrong address" })
      .expect(200);
    const owed = priceCents - depositCents;
    expect(testPayments().charges.at(-1)!.amount).toBe(owed);
    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.subject).toBe("Bill EC-000001 is cancelled");
    expect(notice.text).toContain(
      "Here's what we've done about each clean on it instead",
    );
    expect(notice.text).toContain(`charged ${formatMoney(owed)}`);
  });
});
