import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import type {
  BillPayOutcome,
  BillSummary,
  BillView,
  ClientBillingSaved,
  ClientPayment,
  OfficeClientView,
  CompletionInput,
  NeedsAttentionItem,
  OfficeServicePlan,
  SignedInAccount,
} from "@empire-cleaning/models";
import {
  HOUR_MS,
  MINUTE_MS,
  clientPayingBill,
  formats,
  paymentNotDone,
} from "@empire-cleaning/models";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import {
  bills,
  chaseBills,
  makeDueBills,
  retryUnpaidBillsFor,
} from "#features/bills";
import { cancelJob } from "#features/cancellation";
import { clients, findClientByEmail } from "#features/clients";
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
import { properties } from "#features/properties";
import { servicePlans } from "#features/service-plans";
import { settleOpenPayments } from "#features/payments";
import {
  type Agent,
  api,
  signIn,
  testClock,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import { FAKE_SIGNATURE } from "../../../tests/fakes/payment-gateway.ts";
import { lineLabel } from "./emails.ts";
import {
  acceptedJob,
  addPremises,
  billedWeek,
  casey,
  signInAsOffice,
  startedServicePlan,
  staffMember,
} from "../../../tests/fixtures.ts";

const { formatMoney } = formats.en;

// The test clock starts at 4am on Monday 5 January 2026 in New York. Casey's
// Deep Clean is at 9am on Wednesday the 7th, done at noon; that week's Bill
// is made on Monday the 12th.
const WEDNESDAY_9AM = "2026-01-07T14:00:00Z";
const WEDNESDAY_NOON = new Date("2026-01-07T17:00:00Z");
const NEXT_MONDAY = new Date("2026-01-12T15:00:00Z");
const BILLING_EMAIL = "accounts@acme.example.com";

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
  const cleaner = await staffMember("Cory Cleaner");
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
    await staffMember("Cory Cleaner");
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
    // on its page the Office reads where once, its cleans all at one home,
    // and each line with the short time, one about the clean above saying
    // only what it is (#534's UX review U8, F16); its email has each in
    // full, below
    expect(bill.home).toBe("41-12 Austin St, 4B, 11375");
    expect(bill.lines.map((l) => l.label)).toEqual([
      "Deep Clean, Wed, Jan 7, 9:00\u00a0AM",
      "Deposit paid",
    ]);
    expect(bill.taxCents).toBeGreaterThan(0);
    expect(testPayments().charges.at(-1)!.amount).toBe(
      priceCents - depositCents,
    );

    const receipt = testEmail().lastTo(BILLING_EMAIL);
    expect(receipt.subject).toBe("Your receipt for bill EC-000001");
    expect(receipt.text).toContain(
      "Week: Monday, January 5 to Sunday, January 11",
    );
    expect(receipt.text).toMatch(
      /Deposit paid: Deep Clean at 41-12 Austin St, .*Wednesday, January 7 at 9:00\u00a0AM/,
    );
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

  test("a Job's payment names the Bills that billed it, and where each stands", async () => {
    const { office, clientId, jobId, priceCents, depositCents } =
      await billedJob();
    const payment = async () => {
      const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      return paymentOf(row!);
    };
    expect((await payment()).bills).toEqual([]);

    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [summary] = await billsOf(office, clientId);
    expect((await payment()).bills).toEqual([
      {
        id: summary!.id,
        number: "EC-000001",
        status: "paid",
        unpaid: null,
        paying: null,
        totalCents: priceCents - depositCents,
        cents: priceCents - depositCents,
        refundedCents: 0,
      },
    ]);
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
    await staffMember("Cory Cleaner");
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
    const paid = (
      await client
        .post(`/api/bills/mine/${summary!.id}/payment`)
        .send({ token: testPayments().paymentToken() })
        .expect(200)
    ).body as BillPayOutcome;
    expect(paid).toMatchObject({
      status: "done",
      bill: {
        status: "paid",
        paidVia: "page",
        payable: false,
        paying: null,
        // a one-off clean's: no cleaning plan of theirs is on it
        plans: [],
      },
    });
    const taken = testPayments().charges.at(-1)!;
    expect(taken.amount).toBe(priceCents - depositCents);
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Your receipt for bill EC-000001",
    );

    // the webhook saying so too changes nothing
    await webhook({
      kind: "bill_payment_succeeded",
      ref: taken.chargeId,
      reference: summary!.id,
    }).expect(200);
    expect(testPayments().charges).toHaveLength(2);
    expect(testPayments().refunds).toEqual([]);
  });

  test("a bank debit on its way is in the Client's history from when they paid, by the server's Clock", async () => {
    const { clientId, office } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    const client = await signIn(casey.email);
    const paid = (
      await client
        .post(`/api/bills/mine/${id}/payment`)
        .send({ token: testPayments().bankToken() })
        .expect(200)
    ).body as BillPayOutcome;
    expect(paid).toMatchObject({
      status: "done",
      bill: { status: "processing", payable: false },
    });
    testClock().advance({ hours: 2 });

    const history = (await client.get("/api/payments/mine").expect(200))
      .body as ClientPayment[];

    expect(history.find((p) => p.bill?.id === id)).toMatchObject({
      clearing: true,
      at: NEXT_MONDAY.toISOString(),
    });
  });

  test("a bank debit is processing until it clears, or due again if it fails, which the Client is told", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    const client = await signIn(casey.email);
    const pay = (token: string) =>
      client.post(`/api/bills/mine/${id}/payment`).send({ token });

    await pay(testPayments().bankToken()).expect(200);
    expect((await billOf(office, id)).status).toBe("processing");
    // it can't be voided, or paid again, meanwhile, in the words its
    // page's greyed Cancel bill gives (#534's UX review U14)
    expect(await billOf(office, id)).toMatchObject({
      canCancelOrRecord: false,
    });
    expect(
      (
        await office
          .post(`/api/bills/${id}/void`)
          .send({ reason: "x" })
          .expect(409)
      ).body.message,
    ).toBe(
      "You can't cancel this bill while the client's bank payment is on its way.",
    );
    expect(
      (await pay(testPayments().paymentToken()).expect(409)).body.message,
    ).toBe("Your bank payment for this bill is on its way.");

    // days later, there wasn't enough in the account
    testClock().advance({ days: 3 });
    const first = testPayments().lastBankDebit();
    testPayments().clearBankDebit(first, false);
    await webhook({
      kind: "bill_payment_failed",
      ref: first,
      reference: id,
    }).expect(200);
    expect(await billOf(office, id)).toMatchObject({
      status: "due",
      payable: true,
      canCancelOrRecord: true,
      paying: {
        status: "failed",
        at: testClock().now().toISOString(),
        why: "there wasn't enough money in the account",
      },
    });
    const told = testEmail().lastTo(BILLING_EMAIL);
    expect(told.subject).toBe(
      "Your payment for bill EC-000001 didn't go through",
    );
    expect(told.text).toContain(
      "didn't go through (there wasn't enough money in the account). Please try again on its page, or use another card or bank account.",
    );

    await pay(testPayments().bankToken()).expect(200);
    const second = testPayments().lastBankDebit();
    testPayments().clearBankDebit(second);
    await webhook({
      kind: "bill_payment_succeeded",
      ref: second,
      reference: id,
    }).expect(200);
    expect(await billOf(office, id)).toMatchObject({
      status: "paid",
      paidVia: "page",
      paying: null,
    });
  });

  // #241, finding 2: a webhook names the Bill, but only the payments the
  // Client made on it count
  test("a webhook naming a Bill settles only the payments made on it", async () => {
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

    for (const kind of ["bill_payment_succeeded", "bill_payment_failed"]) {
      await webhook({ kind, ref: "pi_another", reference: billId }).expect(200);
      expect((await billOf(office, billId!)).status).toBe("due");
      expect(await planStatus()).toBe("on_hold");
    }
  });

  test("a card declined on the page says why in plain words, never its code, and the Bill's pages say so", async () => {
    const { office, clientId, jobId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    const client = await signIn(casey.email);
    const emails = testEmail().sent.length;
    testPayments().failCharges("expired_card");
    const refused = await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ token: testPayments().paymentToken() })
      .expect(409);
    expect(refused.body.message).toBe(
      "Your payment didn't go through (the card has expired), so nothing was taken. Please try again, or use another card or bank account.",
    );
    expect(await billOf(office, id)).toMatchObject({
      status: "due",
      payable: true,
      canCancelOrRecord: true,
      paying: {
        status: "failed",
        at: NEXT_MONDAY.toISOString(),
        why: "the card has expired",
      },
    });
    // the dialog said so: no email
    expect(testEmail().sent).toHaveLength(emails);
    // and the clean it billed says where the Bill stands as its pages do
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    expect((await paymentOf(row!)).bills).toEqual([
      expect.objectContaining({
        id,
        unpaid: null,
        paying: {
          status: "failed",
          at: NEXT_MONDAY.toISOString(),
          why: "the card has expired",
        },
      }),
    ]);
  });

  test("two payments pressed at once take the Bill once", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id, totalCents }] = (await billsOf(office, clientId)) as [
      BillSummary,
    ];
    const client = await signIn(casey.email);

    const replies = await Promise.all(
      [1, 2].map(() =>
        client
          .post(`/api/bills/mine/${id}/payment`)
          .send({ token: testPayments().paymentToken() }),
      ),
    );

    expect(replies.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    expect(replies.find((r) => r.status === 409)!.body.message).toBe(
      "There's nothing to pay on this bill.",
    );
    expect(
      testPayments().charges.filter((c) => c.amount === totalCents),
    ).toHaveLength(1);
    expect((await billOf(office, id)).status).toBe("paid");
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

// #534: a card whose bank asks the Client to approve it (3D Secure) holds
// the Bill until they do, or until it's called off (ADR-0022's one rule)
describe("a Bill payment the Client's bank asks them to approve", () => {
  const onPageBill = async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id, totalCents }] = (await billsOf(office, clientId)) as [
      BillSummary,
    ];
    const client = await signIn(casey.email);
    return {
      office,
      id,
      totalCents,
      pay: () =>
        client
          .post(`/api/bills/mine/${id}/payment`)
          .send({ token: testPayments().paymentToken() }),
      finish: (approved: boolean) =>
        client.post(`/api/bills/mine/${id}/payment/finish`).send({ approved }),
    };
  };

  test("holds the Bill until they approve it, then is taken once", async () => {
    const { office, id, totalCents, pay, finish } = await onPageBill();
    testPayments().requireApproval("pending");

    expect((await pay().expect(200)).body).toEqual({
      status: "needs_approval",
      secret: expect.any(String),
    });
    const until = new Date(NEXT_MONDAY.getTime() + 15 * MINUTE_MS);
    expect(await billOf(office, id)).toMatchObject({
      status: "due",
      payable: true,
      canCancelOrRecord: false,
      paying: { status: "approving", until: until.toISOString() },
    });
    // Office Staff can't cancel it or record a payment meanwhile
    const refused = await office
      .post(`/api/bills/${id}/void`)
      .send({ reason: "x" })
      .expect(409);
    expect(refused.body.message).toBe(
      clientPayingBill.cancel("Casey", formats.en.formatTime(until)),
    );

    // approved in their bank's app
    testPayments().requireApproval("approved");
    const paid = (await finish(true).expect(200)).body as BillView;

    expect(paid).toMatchObject({
      status: "paid",
      paidVia: "page",
      paying: null,
    });
    expect(
      testPayments().charges.filter((c) => c.amount === totalCents),
    ).toHaveLength(1);
  });

  // ux design review U23 and U25: one never approved, however it ends,
  // took nothing and failed nothing, so the pages read as before it
  // its pages say what became of the latest, not an older failure (#534's
  // UX review U12)
  test("one never approved takes nothing, started over or left, and the pages say it wasn't approved", async () => {
    const { office, id, pay, finish } = await onPageBill();
    // an earlier payment, declined
    testPayments().failCharges("insufficient_funds");
    await pay().expect(409);
    testPayments().failCharges(null);
    expect((await billOf(office, id)).paying).toMatchObject({
      status: "failed",
    });
    const taken = testPayments().charges.length;

    testPayments().requireApproval("pending");
    await pay().expect(200);
    // pressed Pay again: the first is called off, and a new one asked
    await pay().expect(200);
    // they closed their bank's box
    // of kind "approve", for the page to offer it again
    expect((await finish(false).expect(409)).body).toEqual({
      message:
        "Your payment wasn't approved, so nothing was taken. Please try again, or use another card or bank account.",
      kind: "approve",
    });
    const notApproved = { status: "notApproved" };
    expect(await billOf(office, id)).toMatchObject({
      status: "due",
      payable: true,
      canCancelOrRecord: true,
      paying: notApproved,
    });

    // one more, left open past the 15 minutes: the Clock calls it off
    await pay().expect(200);
    testClock().advance({ minutes: 20 });
    await settleOpenPayments();
    expect(await billOf(office, id)).toMatchObject({
      status: "due",
      canCancelOrRecord: true,
      paying: notApproved,
    });

    // approved too late, nothing is taken
    testPayments().requireApproval("approved");
    await settleOpenPayments();
    expect(testPayments().charges).toHaveLength(taken);
  });

  test("one left past its 15 minutes is called off when Office Staff cancel the Bill, so nothing is taken", async () => {
    const { office, id, pay } = await onPageBill();
    testPayments().requireApproval("pending");
    await pay().expect(200);
    testClock().advance({ minutes: 16 });
    // before the Clock's sweep, its page frees them, as its alert promised
    // (#534 review F11)
    expect(await billOf(office, id)).toMatchObject({
      canCancelOrRecord: true,
      unpaid: null,
      paying: null,
    });

    await office
      .post(`/api/bills/${id}/void`)
      .send({ reason: "Billed twice" })
      .expect(200);
    // their bank approving it now takes nothing
    testPayments().requireApproval("approved");
    await settleOpenPayments();

    expect((await billOf(office, id)).status).toBe("void");
    expect(testPayments().refunds).toEqual([]);
    expect(testPayments().charges).toHaveLength(1);
  });

  // critical review C1, and #534 F5: an automatic Bill the Client pays on
  // its page meanwhile isn't charged to the card they save
  test("isn't charged to a card saved meanwhile, so it's taken once", async () => {
    const { office, clientId } = await billedJob();
    testPayments().failCharges("expired_card");
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    testPayments().failCharges(null);
    const [{ id, totalCents }] = (await billsOf(office, clientId)) as [
      BillSummary,
    ];
    const client = await signIn(casey.email);
    testPayments().requireApproval("pending");
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ token: testPayments().paymentToken() })
      .expect(200);
    const asked = testPayments().paymentAttempts.length;

    // they save a new card, which tries their Unpaid Bills again
    await retryUnpaidBillsFor(clientId);
    expect(testPayments().paymentAttempts).toHaveLength(asked);
    // still Unpaid for the card that expired, as nothing more was tried
    expect((await billOf(office, id)).unpaid).toMatchObject({
      kind: "declined",
      why: "the card has expired",
    });

    // then approve the payment on its page
    testPayments().requireApproval("approved");
    await client
      .post(`/api/bills/mine/${id}/payment/finish`)
      .send({ approved: true })
      .expect(200);
    expect(
      testPayments().charges.filter((c) => c.amount === totalCents),
    ).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
  });
});

// a payment on a Bill's page whose end isn't known yet: going through,
// with nothing to do but wait, then settled by the Clock
describe("a Bill payment going through", () => {
  // #534's critical review C6: a card isn't a bank debit, which takes days
  test("by a card its bank finishes is pending, not a bank payment on its way", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id, totalCents }] = (await billsOf(office, clientId)) as [
      BillSummary,
    ];
    const client = await signIn(casey.email);

    testPayments().finishCards();
    const going = (
      await client
        .post(`/api/bills/mine/${id}/payment`)
        .send({ token: testPayments().paymentToken() })
        .expect(200)
    ).body as BillPayOutcome;

    expect(going).toMatchObject({
      status: "done",
      bill: {
        status: "due",
        clearingSince: null,
        payable: false,
        unpaid: { kind: "waiting", since: NEXT_MONDAY.toISOString() },
        paying: null,
      },
    });

    // its bank's done, and the Clock finds it taken, once
    testPayments().finishCards(false);
    testClock().advance({ minutes: 20 });
    await settleOpenPayments();
    expect(await billOf(office, id)).toMatchObject({
      status: "paid",
      paidVia: "page",
    });
    expect(
      testPayments().charges.filter((c) => c.amount === totalCents),
    ).toHaveLength(1);
  });

  // #534 Q13: neither the browser nor the webhook came back
  test("whose reply never came is pending, then settled by the Clock", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    const client = await signIn(casey.email);

    testPayments().loseNextReply();
    const going = (
      await client
        .post(`/api/bills/mine/${id}/payment`)
        .send({ token: testPayments().paymentToken() })
        .expect(200)
    ).body as BillPayOutcome;

    // pending, not paid
    expect(going).toMatchObject({
      status: "done",
      bill: {
        status: "due",
        payable: false,
        unpaid: { kind: "waiting", since: NEXT_MONDAY.toISOString() },
        paying: null,
      },
    });
    expect(await billOf(office, id)).toMatchObject({
      canCancelOrRecord: false,
    });
    // Office Staff can't cancel it while it's still not known: cancelling
    // looks it up first
    testPayments().goDown();
    expect(
      (
        await office
          .post(`/api/bills/${id}/void`)
          .send({ reason: "x" })
          .expect(409)
      ).body.message,
    ).toBe(paymentNotDone.cancel);
    testPayments().goDown(false);

    testClock().advance({ minutes: 20 });
    await settleOpenPayments();
    expect(await billOf(office, id)).toMatchObject({
      status: "paid",
      paidVia: "page",
      unpaid: null,
    });
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Your receipt for bill EC-000001",
    );
  });

  // critical review C2: its card isn't the saved one, so it's only looked
  // up, never sent again
  test("whose reply never came is never sent again, only looked up", async () => {
    const { office, clientId } = await billedJob();
    testPayments().failCharges();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    testPayments().failCharges(null);
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    const client = await signIn(casey.email);
    testPayments().loseNextReply();
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ token: testPayments().paymentToken() })
      .expect(200);
    const asked = testPayments().paymentAttempts.length;

    await retryUnpaidBillsFor(clientId);

    expect(testPayments().paymentAttempts).toHaveLength(asked);
    expect(await billOf(office, id)).toMatchObject({
      status: "paid",
      paidVia: "page",
    });
  });

  // critical review C3: they were told it was going through, so they're
  // told when it didn't
  test("that never reached the provider is emailed to the Client once found", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    const client = await signIn(casey.email);

    testPayments().goDown();
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ token: testPayments().paymentToken() })
      .expect(200);
    testPayments().goDown(false);
    testClock().advance({ minutes: 20 });
    await settleOpenPayments();

    expect(await billOf(office, id)).toMatchObject({
      status: "due",
      payable: true,
      paying: { status: "failed" },
    });
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Your payment for bill EC-000001 didn't go through",
    );
  });

  // critical review C4: a bank debit on an automatic Bill whose card was
  // declined fails; the Clock doesn't try the declined card again
  test("a failed bank debit on a Bill whose card was declined doesn't charge that card again", async () => {
    const { office, clientId } = await billedJob();
    testPayments().failCharges();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    testPayments().failCharges(null);
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    const client = await signIn(casey.email);
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ token: testPayments().bankToken() })
      .expect(200);
    expect((await billOf(office, id)).status).toBe("processing");

    testPayments().clearBankDebit(testPayments().lastBankDebit(), false);
    const asked = testPayments().paymentAttempts.length;
    testClock().advance({ hours: 1 });
    await settleOpenPayments();
    await settleOpenPayments();

    expect(testPayments().paymentAttempts).toHaveLength(asked);
    expect(await billOf(office, id)).toMatchObject({
      status: "due",
      // Unpaid again, for the card declined
      unpaid: { kind: "declined" },
      paying: { status: "failed" },
    });
  });

  // #534's critical review C7: the attempt's end is written apart from the
  // Bill's, so a run that fails between them leaves the Bill processing
  // with its debit ended, for the next run to settle
  test("a failed bank debit is told the Client though the run that found it failed", async () => {
    const { office, clientId } = await billedJob({ payment: "on_page" });
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [{ id }] = (await billsOf(office, clientId)) as [BillSummary];
    const client = await signIn(casey.email);
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ token: testPayments().bankToken() })
      .expect(200);
    testPayments().clearBankDebit(testPayments().lastBankDebit(), false);
    testClock().advance({ days: 3 });

    // the first run's write of the Bill fails, once (a sequence, as it
    // isn't rolled back with it)
    await db.execute(sql`create sequence c7_runs`);
    await db.execute(sql`
      create function c7_fail_once() returns trigger language plpgsql as $$
      begin
        if nextval('c7_runs') = 1 then raise exception 'the run failed'; end if;
        return new;
      end $$`);
    await db.execute(sql`
      create trigger c7_fail_once before update on bills for each row
      when (old.status = 'processing' and new.status = 'due')
      execute function c7_fail_once()`);
    try {
      await settleOpenPayments().catch(() => undefined);
      expect((await billOf(office, id)).status).toBe("processing");
      await settleOpenPayments();
    } finally {
      await db.execute(sql`drop trigger c7_fail_once on bills`);
      await db.execute(sql`drop function c7_fail_once`);
      await db.execute(sql`drop sequence c7_runs`);
    }

    expect(await billOf(office, id)).toMatchObject({
      status: "due",
      paying: { status: "failed" },
    });
    expect(testEmail().lastTo(BILLING_EMAIL).subject).toBe(
      "Your payment for bill EC-000001 didn't go through",
    );
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
    const { id: coryId } = await staffMember("Cory Cleaner");
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
    const { id: coryId } = await staffMember("Cory Cleaner");
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
    // the Bill says which plan it holds, at which home, and that it's paused
    expect((await billOf(office, summary!.id)).plans).toEqual([
      {
        id: planId,
        status: "on_hold",
        property: {
          id: expect.any(String),
          street: "41-12 Austin St",
          unit: "4B",
          postcode: "11375",
        },
      },
    ]);
    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.subject).toBe("We couldn't take payment for bill EC-000001");
    expect(notice.text).toContain(
      "Until it's paid, we won't book more cleans on your plan.",
    );
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
        kind: "declined",
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
    expect((await billOf(office, summary!.id)).plans).toMatchObject([
      { id: planId, status: "active" },
    ]);
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "Your cleaning plan is back on",
    );
  });

  // #534 Q7: charged without them there, their bank wants them to approve
  // it, which they do on the Bill's page with their saved card
  test("one their bank wants them to approve asks them to, and is paid once they do on its page", async () => {
    const { office, client } = await planOnBill();
    const agent = await signIn(casey.email);
    const form = (
      await agent.post("/api/payment-methods/mine/card-form").expect(200)
    ).body as { secret: string };
    testPayments().fillCardForm(form.secret, "alwaysApproval");
    await agent
      .put("/api/payment-methods/mine")
      .send({ token: form.secret })
      .expect(200);

    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [summary] = await billsOf(office, client.id);
    expect(summary).toMatchObject({
      status: "due",
      unpaid: { kind: "approve", why: null },
    });
    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.subject).toBe(
      "Please approve your payment for bill EC-000001",
    );
    expect(notice.html).toContain(">Approve payment<");
    const asked = testPayments().paymentAttempts.length;

    const outcome = (
      await agent
        .post(`/api/bills/mine/${summary!.id}/payment`)
        .send({})
        .expect(200)
    ).body as BillPayOutcome;
    expect(outcome).toEqual({
      status: "needs_approval",
      secret: expect.any(String),
    });
    // the payment their bank stopped, confirmed again with them there
    expect(testPayments().paymentAttempts).toHaveLength(asked);
    await agent
      .post(`/api/bills/mine/${summary!.id}/payment/finish`)
      .send({ approved: true })
      .expect(200);
    expect(await billOf(office, summary!.id)).toMatchObject({
      status: "paid",
      unpaid: null,
    });
    expect(
      testPayments().charges.filter((c) => c.amount === summary!.totalCents),
    ).toHaveLength(1);
  });

  // critical-review-payment-truth.md C12: one the Client started approving
  // and walked away from (tab closed, phone died) is called off by the
  // Clock. Nobody turned it down: it still waits on their approval, as a
  // Job's does, not "turned down at their bank" (REFUSED)
  test("one their bank wants them to approve, started on its page and left, still reads as theirs to approve once the Clock calls it off", async () => {
    const { office, client } = await planOnBill();
    const agent = await signIn(casey.email);
    const form = (
      await agent.post("/api/payment-methods/mine/card-form").expect(200)
    ).body as { secret: string };
    testPayments().fillCardForm(form.secret, "alwaysApproval");
    await agent
      .put("/api/payment-methods/mine")
      .send({ token: form.secret })
      .expect(200);
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [summary] = await billsOf(office, client.id);
    expect(summary).toMatchObject({ unpaid: { kind: "approve" } });

    // they press Approve payment, their bank's box opens, and they leave
    testPayments().requireApproval("pending");
    await agent
      .post(`/api/bills/mine/${summary!.id}/payment`)
      .send({})
      .expect(200);
    testClock().advance({ minutes: 20 });
    await settleOpenPayments();

    const [after] = await billsOf(office, client.id);
    expect(after).toMatchObject({ status: "due" });
    expect(after!.unpaid!.kind).toBe("approve");
  });

  // #534's review F18 and UX review U18: turned down at their bank on its
  // page, it's theirs to try again, and Unpaid from then, not from when
  // their bank first asked, as the Office reads when they said no. The
  // provider's webhook can tell us it failed before their browser does,
  // and it reads the same, their browser told it took nothing (#534's
  // review F25)
  test.each([
    ["their browser tells us first", false],
    ["the provider's webhook tells us first", true],
  ])(
    "one their bank wants them to approve, turned down on its page, reads refused, Unpaid from then, %s",
    async (_, webhookFirst) => {
      const { office, client } = await planOnBill();
      const agent = await signIn(casey.email);
      const form = (
        await agent.post("/api/payment-methods/mine/card-form").expect(200)
      ).body as { secret: string };
      testPayments().fillCardForm(form.secret, "alwaysApproval");
      await agent
        .put("/api/payment-methods/mine")
        .send({ token: form.secret })
        .expect(200);
      testClock().set(NEXT_MONDAY);
      await makeDueBills();
      const [summary] = await billsOf(office, client.id);
      expect(summary).toMatchObject({ unpaid: { kind: "approve" } });

      testClock().advance({ hours: 3 });
      await agent
        .post(`/api/bills/mine/${summary!.id}/payment`)
        .send({})
        .expect(200);
      testPayments().requireApproval("refused");
      if (webhookFirst) {
        await webhook({
          kind: "bill_payment_failed",
          ref: "its payment",
          reference: summary!.id,
        }).expect(200);
      }
      await agent
        .post(`/api/bills/mine/${summary!.id}/payment/finish`)
        .send({ approved: false })
        .expect(409);

      expect(await billOf(office, summary!.id)).toMatchObject({
        status: "due",
        unpaid: { kind: "refused", since: testClock().now().toISOString() },
      });
    },
  );

  // #241: nobody has to try again
  test("one declined once the provider is back says its plan is paused", async () => {
    await planOnBill();
    testPayments().goDown();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    // while it's ours to try again, nothing's theirs to pay (#536)
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "Until it goes through, we won't book more cleans on your plan.",
    );
    testPayments().goDown(false);
    testPayments().failCharges();

    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.subject).toBe("We couldn't take payment for bill EC-000001");
    expect(notice.text).toContain(
      "Until it's paid, we won't book more cleans on your plan.",
    );
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

  // #533: paid on its page too, it would be taken twice until a refund
  test("one whose Charge is still processing can't be paid on its page, and is charged once when it goes through", async () => {
    const { office, clientId } = await billedJob();
    testPayments().failCharges("processing");
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    testPayments().failCharges(null);
    const [{ id, totalCents }] = (await billsOf(office, clientId)) as [
      BillSummary,
    ];
    const client = await signIn(casey.email);

    const pay = () =>
      client
        .post(`/api/bills/mine/${id}/payment`)
        .send({ token: testPayments().paymentToken() });
    const refused = await pay().expect(409);
    expect(refused.body.message).toBe(
      "This bill's payment is pending. Nothing you need to do.",
    );
    const enEspañol = await pay().set("Accept-Language", "es").expect(409);
    expect(enEspañol.body.message).toBe(
      "El pago de esta factura está pendiente. No tiene que hacer nada.",
    );
    // so its page offers no Pay
    expect(
      (await client.get(`/api/bills/mine/${id}`).expect(200)).body,
    ).toMatchObject({ status: "due", payable: false });

    testPayments().clearCharges();
    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    expect(await billOf(office, id)).toMatchObject({
      status: "paid",
      paidVia: "charge",
    });
    expect(
      testPayments().paymentAttempts.filter((a) => a.amount === totalCents),
    ).toHaveLength(1);
  });

  // #534, F10: and a cheque recorded meanwhile left the lost Charge to give
  // back, or to make, if it never reached the provider; the one rule
  // refuses it
  test("one whose Charge reply was lost can't be paid on its page or by cheque meanwhile, and is found paid once looked up", async () => {
    const { office, clientId } = await billedJob();
    testPayments().loseNextReply();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const lost = testPayments().charges.at(-1)!;
    const [summary] = await billsOf(office, clientId);
    const client = await signIn(casey.email);
    // the lost Charge took it already (#533)
    await client
      .post(`/api/bills/mine/${summary!.id}/payment`)
      .send({ token: testPayments().paymentToken() })
      .expect(409);
    // recording one looks it up first: while it's still not known, no
    testPayments().goDown();
    const refused = await office
      .post(`/api/bills/${summary!.id}/outside-payment`)
      .send({ note: "Cheque 1042" })
      .expect(409);
    expect(refused.body.message).toBe(
      "You can't record a payment on this bill while its payment is going through, which usually takes under half an hour.",
    );
    testPayments().goDown(false);

    // once it can be: it took it
    expect(
      (
        await office
          .post(`/api/bills/${summary!.id}/outside-payment`)
          .send({ note: "Cheque 1042" })
          .expect(409)
      ).body.message,
    ).toBe("This bill is already paid.");
    expect(testPayments().refunds).toEqual([]);
    // no Charge after the lost one
    expect(testPayments().charges.at(-1)).toBe(lost);
    expect(await billOf(office, summary!.id)).toMatchObject({
      status: "paid",
      paidVia: "charge",
    });
  });

  // #534, F4: voided, its Jobs were charged per clean at once, while the
  // Bill's own Charge could still go through; the one rule refuses it
  test("one whose Charge is still going through can't be cancelled until it has", async () => {
    const { office, clientId } = await billedJob();
    testPayments().failCharges("processing");
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    testPayments().failCharges(null);
    const [{ id, totalCents }] = (await billsOf(office, clientId)) as [
      BillSummary,
    ];
    await setBilling(office, clientId, { weekly: false }).expect(200);
    // its page says so beforehand
    expect(await billOf(office, id)).toMatchObject({
      status: "due",
      canCancelOrRecord: false,
    });

    // and a page opened before is refused
    const refused = await office
      .post(`/api/bills/${id}/void`)
      .send({ reason: "Sent in error" })
      .expect(409);
    expect(refused.body.message).toBe(
      "You can't cancel this bill while its payment is going through, which usually takes under half an hour.",
    );

    // the Bill's Charge goes through, and the Clock records it
    testPayments().clearCharges();
    testClock().advance({ minutes: 15 });
    await settleOpenPayments();
    expect(await billOf(office, id)).toMatchObject({ status: "paid" });
    expect(
      testPayments().charges.filter((c) => c.amount === totalCents),
    ).toHaveLength(1);
    expect(testPayments().refunds).toEqual([]);
  });

  // #534, F9: a lost Balance never looked up was billed again for good, so
  // it's looked up as weekly billing starts; and the 06:55 comment's #1: one
  // still processing was billed too, so the Client was asked for it twice at
  // once, and now waits for the next Bill
  test.each([
    ["whose reply was lost", () => testPayments().loseNextReply(), () => {}],
    [
      "still processing",
      () => testPayments().failCharges("processing"),
      () => testPayments().clearCharges(),
    ],
  ])(
    "a Job whose Balance is going through (%s) as weekly billing starts is asked for once, and on no Bill once taken",
    async (_, leave, goThrough) => {
      const office = await signInAsOffice();
      const me = (await office.get("/api/me").expect(200))
        .body as SignedInAccount;
      const cleaner = await staffMember("Cory Cleaner");
      const job = await acceptedJob({
        startsAt: WEDNESDAY_9AM,
        byAccountId: me.id,
      });
      const client = (await findClientByEmail(casey.email))!;
      await addPremises(client.id);
      const offered = await offerAssignment(job.id, cleaner.id, me.id);
      await confirmAssignment(cleaner.id, offered.assignments[0]!.id);
      testClock().set(WEDNESDAY_NOON);
      leave();
      await completeJob(cleaner.id, job.id, {
        condition: "moderate",
        reports: [],
      });
      testPayments().failCharges(null);
      const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
      const { totalCents } = await paymentOf(row!);

      await setBilling(office, client.id).expect(200);
      testClock().set(NEXT_MONDAY);
      await makeDueBills();
      // left off this week's Bill while its Balance may still be taken
      expect(await billsOf(office, client.id)).toEqual([]);
      const asked = [...testPayments().paymentAttempts];
      expect(asked.reduce((s, a) => s + a.amount, 0)).toBe(totalCents);

      goThrough();
      await settleOpenPayments();
      testClock().set(new Date("2026-01-19T15:00:00Z"));
      await makeDueBills();
      // taken by its Balance, it's on no Bill
      expect(await billsOf(office, client.id)).toEqual([]);
      expect(testPayments().paymentAttempts).toEqual(asked);
      expect(testPayments().charges.reduce((s, c) => s + c.amount, 0)).toBe(
        totalCents,
      );
      expect(testPayments().refunds).toEqual([]);
    },
  );

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
  // the Office's own copies, in English
  const officeCopies = () =>
    testEmail()
      .to("office@example.com")
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
    expect(officeCopies()).toEqual([]);

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
    expect(officeCopies()).toEqual(["Bill EC-000001 is overdue"]);
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
    expect(officeCopies()).toEqual([
      "Bill EC-000001 is overdue",
      "Bill EC-000001 is overdue",
      "Bill EC-000001 is overdue",
    ]);

    // none once it's paid
    const client = await signIn(casey.email);
    await client
      .post(`/api/bills/mine/${id}/payment`)
      .send({ token: testPayments().paymentToken() })
      .expect(200);
    expect((await billOf(office, id)).unpaid).toBeNull();
    testClock().set(at("2026-02-16"));
    expect(await chaseBills()).toBe(0);
    expect(reminders()).toHaveLength(5);
  });

  test("a late Bill reaches a Spanish-reading Client in Spanish, and the Office's copy in English (ADR-0025)", async () => {
    const { clientId } = await billedJob({ payment: "on_page" });
    await db
      .update(clients)
      .set({ preferredLanguage: "es" })
      .where(eq(clients.id, clientId));
    testClock().set(NEXT_MONDAY);
    await makeDueBills();

    testClock().set(at("2026-01-27", "06:00"));
    await chaseBills();
    testClock().set(at("2026-01-27"));
    expect(await chaseBills()).toBe(1);

    const theirs = testEmail().lastTo(BILLING_EMAIL);
    expect(theirs.subject).toBe("La factura EC-000001 está vencida");
    expect(theirs.html).toMatch(/<html[^>]* lang="es"/);
    expect(theirs.text).toContain("vencía el lunes, 26 de enero");
    const ours = testEmail().lastTo("office@example.com");
    expect(ours.subject).toBe("Bill EC-000001 is overdue");
    expect(ours.html).toMatch(/<html[^>]* lang="en"/);
    expect(ours.text).toContain("was due by Monday, January 26");
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
    const { id: coryId } = await staffMember("Cory Cleaner");
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
      "Until it's paid, we won't book more cleans on your plan.",
    );

    // a bank debit on its way lifts On Hold; failing, it holds again
    const agent = await signIn(casey.email);
    await agent
      .post(`/api/bills/mine/${id}/payment`)
      .send({ token: testPayments().bankToken() })
      .expect(200);
    const debit = testPayments().lastBankDebit();
    expect(await planStatus()).toBe("active");
    testClock().set(at("2026-02-02"));
    expect(await chaseBills()).toBe(0);
    testPayments().clearBankDebit(debit, false);
    await webhook({
      kind: "bill_payment_failed",
      ref: debit,
      reference: id,
    }).expect(200);
    expect(await planStatus()).toBe("on_hold");
    expect(testEmail().lastTo(BILLING_EMAIL).text).toContain(
      "Until it's paid, we won't book more cleans on your plan.",
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
    // worded as it's read: the Client's in Spanish (#395)
    const client = await signIn(casey.email);
    const theirs = (
      await client
        .get(`/api/bills/mine/${next!.id}`)
        .set("Accept-Language", "es")
        .expect(200)
    ).body as BillView;
    expect(theirs.lines[0]!.label).toMatch(/^1 hora más: Limpieza profunda/);
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
    expect(await billOf(office, id)).toMatchObject({ canCancelOrRecord: true });

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
    // and the Client's, in Spanish: the correction and the Deposit it took
    const client = await signIn(casey.email);
    const theirs = (
      await client
        .get(`/api/bills/mine/${credit!.id}`)
        .set("Accept-Language", "es")
        .expect(200)
    ).body as BillView;
    // which say where once, as Casey has her home and her premises, and
    // the Deposit only what it is, under its clean
    expect(theirs.home).toBe("41-12 Austin St, 4B, 11375");
    expect(theirs.lines.map((l) => l.label).sort()).toEqual([
      "Corrección: Depósito pagado",
      expect.stringMatching(/^Corrección: Limpieza profunda, /),
    ]);
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
      const payment = await paymentOf(row!);
      expect(payment.owedCents).toBe(0);
      // the Bill it went on says what it gave back
      expect(payment.bills).toEqual([
        expect.objectContaining({
          number: "EC-000001",
          refundedCents: extra!.totalCents,
        }),
      ]);
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

  // a plan's clean, billed weekly, done and not yet billed, as Casey is
  // switched to being charged per clean and `fail` makes its Charge fail
  const switchedOffUnpaid = async (fail: () => void) => {
    const office = await signInAsOffice();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    const { id: coryId } = await staffMember("Cory Cleaner");
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

    fail();
    const { settled } = await switchOff(office, client.id);
    return { settled, firstJob, planId };
  };

  test("a Charge that fails leaves the Job Unpaid and the plan On Hold, and says so", async () => {
    const { settled, firstJob, planId } = await switchedOffUnpaid(() =>
      testPayments().failCharges(),
    );
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
    expect(notice.text).toContain(
      "Until it's paid, we won't book more cleans on your plan.",
    );
    expect(notice.html).toContain("/portal/payment-method");
  });

  // the card page leaves out a payment their bank wants them to approve,
  // so its button opens the clean, to approve it there (#534 review F17)
  test("a Charge their bank wants them to approve emails a button to approve it on its clean", async () => {
    const { firstJob } = await switchedOffUnpaid(() =>
      testPayments().savedCardsAsk(),
    );

    const notice = testEmail().lastTo(BILLING_EMAIL);
    expect(notice.text).toContain(
      "Your bank wants you to approve it first. Please approve it on its page.",
    );
    expect(notice.html).toContain(`/portal/jobs/${firstJob.id}`);
    expect(notice.html).toContain("Approve payment");
    expect(notice.html).not.toContain("/portal/payment-method");
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

// a Bill's page names each clean's time short, and its home on its row only
// when its cleans were at more than one home, as billView says (for the
// Office, or a Client with more than one; #534's UX review U8, F16); a row
// about the clean above says only what it is; its email in full
describe("a Bill's lines", () => {
  const line = {
    key: "price",
    corrected: false,
    fee: null,
    change: null,
    clean: {
      service: { name: "Deep Clean", nameEs: "Limpieza profunda" },
      address: "41-12 Austin St, 4B, 11375",
      startsAt: new Date(WEDNESDAY_9AM),
    },
    creditFrom: null,
    amountCents: 26947,
  };

  test("a line about the clean the row above names says only what it is, and in full in an email", () => {
    const deposit = { ...line, key: "deposit", amountCents: -5000 };
    expect(lineLabel("en", deposit, { home: false, named: true })).toBe(
      "Deposit paid",
    );
    expect(lineLabel("es", deposit, { home: false, named: true })).toBe(
      "Depósito pagado",
    );
    expect(lineLabel("en", deposit, { home: false })).toBe(
      "Deposit paid: Deep Clean, Wed, Jan 7, 9:00\u00a0AM",
    );
    expect(lineLabel("en", deposit)).toMatch(
      /^Deposit paid: Deep Clean at 41-12 Austin St, 4B, 11375, Wednesday/,
    );
  });

  test("name a clean's home on its page only when asked, and in full in an email", () => {
    expect(lineLabel("en", line, { home: false })).toBe(
      "Deep Clean, Wed, Jan 7, 9:00\u00a0AM",
    );
    expect(lineLabel("en", line, { home: true })).toBe(
      "Deep Clean at 41-12 Austin St, 4B, 11375, Wed, Jan 7, 9:00\u00a0AM",
    );
    expect(lineLabel("en", line)).toBe(
      "Deep Clean at 41-12 Austin St, 4B, 11375, Wednesday, January 7 at 9:00\u00a0AM",
    );
  });

  test("a Client with one property reads no where, and with two, and the Office, read it once", async () => {
    const { office, clientId } = await billedJob();
    testClock().set(NEXT_MONDAY);
    await makeDueBills();
    const [bill] = await billsOf(office, clientId);
    const client = await signIn(casey.email);
    const mine = async () =>
      (await client.get(`/api/bills/mine/${bill!.id}`).expect(200))
        .body as BillView;
    // a home and premises: the Bill's cleans, all at the home, name it once
    const both = await mine();
    expect(both.home).toBe("41-12 Austin St, 4B, 11375");
    expect(both.lines.map((l) => l.label).sort()).toEqual([
      "Deep Clean, Wed, Jan 7, 9:00\u00a0AM",
      "Deposit paid",
    ]);
    // one property, as a business with only its premises has: the
    // fixture's clean is at a home, so its premises go
    await db.delete(properties).where(eq(properties.kind, "commercial"));

    const theirs = await mine();
    expect(theirs.home).toBeNull();
    expect(theirs.lines.map((l) => l.label).sort()).toEqual([
      "Deep Clean, Wed, Jan 7, 9:00\u00a0AM",
      "Deposit paid",
    ]);
    const ours = await billOf(office, bill!.id);
    expect(ours.home).toBe("41-12 Austin St, 4B, 11375");
  });
});

// Critical review C5 (bill-pay-once, diff): a payment the Client made on a
// Bill's page before its due date, still going through when the date
// passes (its reply lost, and the provider not reached since: an outage, or
// a key it refuses, which now waits, N8), was told them as "going through,
// nothing to do". The Clock's late sweep doesn't know of it: it makes the
// Bill late, pauses their plan, and emails them, and the Office, that it's
// unpaid, while its page says Payment pending and offers no Pay.
describe("a Bill paid on its page before its due date, still going through after it (critical review C5)", () => {
  test("isn't made late, nor its plan paused, nor its Client chased", async () => {
    const office = await signInAsOffice();
    const me = (await office.get("/api/me").expect(200))
      .body as SignedInAccount;
    const { billId, planId } = await billedWeek({
      byAccountId: me.id,
      payment: "on_page",
      billingEmail: BILLING_EMAIL,
      plan: true,
    });
    const { dueOn } = await billOf(office, billId!);
    const planStatus = async () =>
      (
        await db
          .select({ status: servicePlans.status })
          .from(servicePlans)
          .where(eq(servicePlans.id, planId!))
      )[0]!.status;

    // the afternoon it's due, the Client pays it on its page; the reply is
    // lost, and the provider isn't reached again for a while
    testClock().set(new Date(`${dueOn}T20:00:00Z`));
    const client = await signIn(casey.email);
    testPayments().loseNextReply();
    await client
      .post(`/api/bills/mine/${billId}/payment`)
      .send({ token: testPayments().paymentToken() })
      .expect(200);
    testPayments().goDown();
    const emails = testEmail().sent.length;

    // the next morning, the Clock's sweeps run
    const [y, m, d] = dueOn.split("-").map(Number);
    const next = new Date(Date.UTC(y!, m! - 1, d! + 1, 15));
    testClock().set(next);
    await settleOpenPayments();
    await chaseBills();

    const view = await billOf(office, billId!);
    // its page says it's pending, nothing to do
    expect(view.unpaid).toMatchObject({ kind: "waiting" });
    // so it isn't made late, its plan isn't paused, and nobody is chased
    const [row] = await db.select().from(bills).where(eq(bills.id, billId!));
    expect.soft(row!.unpaidReason).toBeNull();
    expect.soft(await planStatus()).toBe("active");
    expect
      .soft(
        testEmail()
          .sent.slice(emails)
          .map((e) => e.subject),
      )
      .toEqual([]);
  });
});
