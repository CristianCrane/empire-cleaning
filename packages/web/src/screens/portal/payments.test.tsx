import { describe, expect, test } from "vitest";
import type {
  BillSummary,
  ClientPastJob,
  ClientPayment,
} from "@empire-cleaning/models";
import {
  moneyNow as moneyNowIn,
  owedAnswer as owedAnswerIn,
  pausedLine as pausedLineIn,
  paymentRow as paymentRowIn,
  type PaymentsData,
} from "./payments.ts";

// in English, as these tests read them; the Spanish follows the same rules
const moneyNow = (data: PaymentsData) => moneyNowIn(data, "en");
const paymentRow = (p: Parameters<typeof paymentRowIn>[0]) =>
  paymentRowIn(p, "en");
const pausedLine = (plans: Parameters<typeof pausedLineIn>[0], asks = true) =>
  pausedLineIn(plans, "en", asks);
const owedAnswer = (data: PaymentsData) =>
  owedAnswerIn(moneyNow(data).owed!, "en", data.plans);

// Tuesday 20 October 2026, 9am in New York
const CLEAN = "2026-10-20T13:00:00.000Z";
// that afternoon, and a week later
const SAME_DAY = "2026-10-20T20:00:00.000Z";
const WEEK_LATER = "2026-10-27T20:00:00.000Z";

const card = { label: "Visa ending 4242", savedAt: "", consentedAt: "" };

const unpaidClean = {
  id: "job",
  startsAt: CLEAN,
  unpaid: "declined",
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
  plans: [],
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
      paying: "Visa ending 4242",
      clearing: [],
    });
  });

  test("a clean their card was declined for: update the card", () => {
    const { owed } = moneyNow(data({ pastJobs: [unpaidClean] }));

    expect(owed).toMatchObject({
      cents: 18450,
      late: true,
      text: "We couldn't take payment for your Oct 20 clean",
      action: { label: "Update your card" },
    });
  });

  test("a clean waiting on the payment service: nothing to do but see it", () => {
    const { owed } = moneyNow(
      data({ pastJobs: [{ ...unpaidClean, unpaid: "waiting" }] }),
    );

    expect(owed).toMatchObject({
      text: "Your Oct 20 clean",
      // so their Home leads with what's next, not this, and Payments
      // says it calmly
      asks: false,
      late: false,
      action: {
        label: "See the clean",
        href: { to: "/portal/jobs/$jobId", params: { jobId: "job" } },
      },
    });
  });

  test("a Bill the payment service is trying again asks nothing of them", () => {
    const waiting = bill({
      unpaid: { since: "", kind: "waiting", why: null },
    });
    expect(moneyNow(data({ bills: [waiting] })).owed).toMatchObject({
      asks: false,
      late: false,
      text: "Bill EC-000041",
      action: {
        label: "See the bill",
        href: href("/portal/bills/$billId", { billId: "bill" }),
      },
    });
    // the declined one leads, though the waiting one came first, and is
    // the card alone: the waiting one can't be paid
    expect(
      moneyNow(
        data({
          bills: [
            waiting,
            bill({
              id: "declined",
              number: "EC-000042",
              unpaid: { since: "", kind: "declined", why: null },
            }),
          ],
        }),
      ).owed,
    ).toMatchObject({
      cents: 125350,
      asks: true,
      late: true,
      text: "We couldn't take payment for bill EC-000042",
    });
  });

  test("a Bill due on its page: pay it there", () => {
    const { owed } = moneyNow(data({ bills: [bill()] }));
    expect(owed?.asks).toBe(true);

    expect(owed).toMatchObject({
      cents: 125350,
      late: false,
      text: "Bill EC-000041 is due by Nov 3",
      action: {
        label: "Pay bill EC-000041",
        href: href("/portal/bills/$billId", { billId: "bill" }),
      },
    });
  });

  test("an Unpaid Bill comes before one due, and both add up", () => {
    const late = bill({
      id: "late",
      number: "EC-000040",
      payment: "automatic",
      unpaid: { since: "", kind: "declined", why: null },
      totalCents: 100000,
    });

    const { owed } = moneyNow(data({ bills: [bill(), late] }));

    expect(owed).toMatchObject({
      cents: 225350,
      late: true,
      text: "We couldn't take payment for bill EC-000040, and 1 more",
      action: { label: "Pay bill EC-000040" },
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
    ).toBe("You pay each bill on its page");
    expect(moneyNow(data({ paymentMethod: null })).paying).toBe(
      "No card saved yet",
    );
  });
});

describe("the owed card", () => {
  const waiting = bill({ unpaid: { since: "", kind: "waiting", why: null } });

  test("one we try again ourselves is calm: pending, one short line, a way to see it", () => {
    expect(owedAnswer(data({ bills: [waiting] }))).toEqual({
      hero: expect.objectContaining({
        label: "Payment pending",
        tone: "info",
        headline: "$1,253.50",
        lines: ["Bill EC-000041 · Nothing you need to do."],
        action: expect.objectContaining({
          label: "See the bill",
          secondary: true,
        }),
      }),
    });
  });

  test("one that asks is to pay, its Button the page's primary", () => {
    const { hero } = owedAnswer(data({ bills: [bill()] }));
    expect(hero).toMatchObject({ label: "To pay", tone: "warning" });
    expect(hero.action?.secondary).toBeUndefined();
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
  item: null,
  ...over,
});
const jobHref = href("/portal/jobs/$jobId", { jobId: "job" });

// the owed card's line, on Home and Payments alike, while money owed
// pauses a plan
describe("what a paused plan means, under what's owed", () => {
  test("nothing while no plan is paused", () => {
    expect(pausedLine([])).toEqual([]);
    expect(
      pausedLine([{ status: "active", nextStartsAt: WEEK_LATER }]),
    ).toEqual([]);
  });

  // what the pause does, true whether or not its cleans are booked, so
  // it never says booked cleans go ahead when none are (#532's U5)
  test("a paused plan books no more cleans until it's paid, booked or not", () => {
    for (const nextStartsAt of [WEEK_LATER, null])
      expect(
        pausedLine([
          { status: "active", nextStartsAt: null },
          { status: "on_hold", nextStartsAt },
        ]),
      ).toEqual(["Until it's paid, we won't book more cleans on your plan."]);
  });

  test("asking nothing of them, until it goes through", () => {
    expect(
      pausedLine([{ status: "on_hold", nextStartsAt: WEEK_LATER }], false),
    ).toEqual([
      "Until it goes through, we won't book more cleans on your plan.",
    ]);
  });
});

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

  test("a price change says which clean it was approved after", () => {
    expect(paymentRow(payment({ kind: "adjustment", at: WEEK_LATER }))).toEqual(
      {
        title: "Price change on Standard Clean",
        line: "Approved after your Oct 20 clean",
        href: jobHref,
      },
    );
  });

  test("a price change for one change names it", () => {
    expect(
      paymentRow(
        payment({
          kind: "adjustment",
          at: WEEK_LATER,
          item: "Inside the fridge",
        }),
      ),
    ).toEqual({
      title: "Price change: Inside the fridge",
      line: "Approved after your Oct 20 Standard Clean",
      href: jobHref,
    });
  });

  test("a refund for one change names it", () => {
    expect(
      paymentRow(
        payment({
          kind: "refund",
          amountCents: -2250,
          at: WEEK_LATER,
          item: "1 more hour, taken off",
        }),
      ),
    ).toEqual({
      title: "Refund: 1 more hour, taken off",
      line: "From your Oct 20 Standard Clean",
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
    ).toMatchObject({
      title: "Couldn't-get-in fee",
      line: "Standard Clean, Oct 20",
    });
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
      title: "Deposit for your cleaning plan",
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
