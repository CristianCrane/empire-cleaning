import { describe, expect, test } from "vitest";
import type {
  BillSummary,
  ClientPastJob,
  ClientPayment,
} from "@empire-cleaning/models";
import { moneyNow, paymentRow, type PaymentsData } from "./payments.ts";

// Tuesday 20 October 2026, 9am in New York
const CLEAN = "2026-10-20T13:00:00.000Z";
// that afternoon, and a week later
const SAME_DAY = "2026-10-20T20:00:00.000Z";
const WEEK_LATER = "2026-10-27T20:00:00.000Z";

const card = { label: "Visa ending 4242", savedAt: "", consentedAt: "" };

const unpaidClean = {
  id: "job",
  startsAt: CLEAN,
  unpaid: true,
  owedCents: 18450,
} as ClientPastJob;

const bill = (over: Partial<BillSummary> = {}): BillSummary =>
  ({
    id: "bill",
    number: "EC-000041",
    payment: "on_page",
    weekStart: "2026-10-12",
    dueOn: "2026-11-03",
    status: "due",
    totalCents: 125350,
    unpaid: null,
    ...over,
  }) as BillSummary;

const data = (over: Partial<PaymentsData> = {}): PaymentsData => ({
  pastJobs: [],
  bills: [],
  paymentMethod: card,
  ...over,
});

const href = (to: string, params: object) => ({ to, params });

describe("what a Client owes now", () => {
  test("nothing, with the card they pay with", () => {
    expect(moneyNow(data())).toEqual({
      owed: null,
      paying: "Paying with Visa ending 4242",
      clearing: [],
    });
  });

  test("a clean their card was declined for: update the card", () => {
    const { owed } = moneyNow(data({ pastJobs: [unpaidClean] }));

    expect(owed).toMatchObject({
      cents: 18450,
      late: true,
      text: "Your card was declined for your Oct 20 clean",
      action: { label: "Update your card" },
    });
  });

  test("a Bill due on its page: pay it there", () => {
    const { owed } = moneyNow(data({ bills: [bill()] }));

    expect(owed).toMatchObject({
      cents: 125350,
      late: false,
      text: "Bill EC-000041 is due by Nov 3",
      action: {
        label: "Pay Bill EC-000041",
        href: href("/portal/bills/$billId", { billId: "bill" }),
      },
    });
  });

  test("an Unpaid Bill comes before one due, and both add up", () => {
    const late = bill({
      id: "late",
      number: "EC-000040",
      payment: "automatic",
      unpaid: { since: "", reason: "declined" },
      totalCents: 100000,
    });

    const { owed } = moneyNow(data({ bills: [bill(), late] }));

    expect(owed).toMatchObject({
      cents: 225350,
      late: true,
      text: "We couldn't take payment for Bill EC-000040, and 1 more",
      action: { label: "Pay Bill EC-000040" },
    });
  });

  test("a Bill charged automatically isn't owed until its Charge fails", () => {
    expect(
      moneyNow(data({ bills: [bill({ payment: "automatic" })] })).owed,
    ).toBeNull();
  });

  test("a bank debit on its way isn't owed, but is said", () => {
    const debit = bill({ status: "processing" });

    expect(moneyNow(data({ bills: [debit] }))).toMatchObject({
      owed: null,
      clearing: [debit],
    });
  });

  test("with no card: Bills on their page need none", () => {
    expect(
      moneyNow(data({ paymentMethod: null, bills: [bill({ status: "paid" })] }))
        .paying,
    ).toBe("You pay each Bill on its page");
    expect(moneyNow(data({ paymentMethod: null })).paying).toBe(
      "No card saved yet",
    );
  });
});

const job = {
  id: "job",
  serviceName: "Standard Clean",
  startsAt: CLEAN,
  status: "completed" as const,
};
const payment = (over: Partial<ClientPayment> = {}): ClientPayment => ({
  id: "p",
  at: SAME_DAY,
  kind: "balance",
  amountCents: 18450,
  job,
  servicePlanId: null,
  bill: null,
  clearing: false,
  ...over,
});
const jobHref = href("/portal/jobs/$jobId", { jobId: "job" });

describe("how a payment reads", () => {
  test("a clean's charge is just the clean, on its day", () => {
    expect(paymentRow(payment())).toEqual({
      title: "Standard Clean",
      line: undefined,
      href: jobHref,
    });
  });

  test("a charge on another day says which clean", () => {
    expect(paymentRow(payment({ at: WEEK_LATER })).line).toBe(
      "Your Oct 20 clean",
    );
  });

  test("a Deposit says when the clean is booked for", () => {
    expect(paymentRow(payment({ kind: "deposit", at: WEEK_LATER }))).toEqual({
      title: "Deposit for Standard Clean",
      line: "Booked for Oct 20",
      href: jobHref,
    });
  });

  test("an extra says which clean it was approved after", () => {
    expect(paymentRow(payment({ kind: "extra", at: WEEK_LATER }))).toEqual({
      title: "Extra on Standard Clean",
      line: "Approved after your Oct 20 clean",
      href: jobHref,
    });
  });

  test("a refund is from its clean", () => {
    expect(
      paymentRow(
        payment({ kind: "refund", amountCents: -2250, at: WEEK_LATER }),
      ),
    ).toEqual({
      title: "Refund on Standard Clean",
      line: "From your Oct 20 clean",
      href: jobHref,
    });
  });

  test("a fee is named for why", () => {
    expect(
      paymentRow(
        payment({ kind: "fee", job: { ...job, status: "no_access" } }),
      ),
    ).toMatchObject({ title: "No Access fee", line: "Standard Clean, Oct 20" });
    expect(
      paymentRow(payment({ kind: "fee", job: { ...job, status: "cancelled" } }))
        .title,
    ).toBe("Late cancellation fee");
  });

  test("a plan's Deposit opens the plan", () => {
    expect(
      paymentRow(
        payment({ kind: "deposit", job: null, servicePlanId: "plan" }),
      ),
    ).toEqual({
      title: "Deposit for your Service Plan",
      line: "Goes towards your plan's last clean",
      href: href("/portal/plans/$planId", { planId: "plan" }),
    });
  });

  test("a Bill says its week", () => {
    expect(
      paymentRow(
        payment({
          kind: "bill",
          job: null,
          bill: {
            id: "bill",
            number: "EC-000041",
            weekStart: "2026-10-12",
            weekEnd: "2026-10-18",
          },
        }),
      ),
    ).toEqual({
      title: "Bill EC-000041",
      line: "Oct 12 – Oct 18",
      href: href("/portal/bills/$billId", { billId: "bill" }),
    });
  });
});
