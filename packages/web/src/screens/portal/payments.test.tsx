import { describe, expect, test } from "vitest";
import type {
  BillSummary,
  ClientPastJob,
  ClientPayment,
  DepositPaying,
  QuoteSummary,
} from "@empire-cleaning/models";
import {
  moneyNow as moneyNowIn,
  owedAnswer as owedAnswerIn,
  pausedLine as pausedLineIn,
  paymentRow as paymentRowIn,
  waitLabelOf,
  waitOf,
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
    paying: null,
    ...over,
  }) as BillSummary;

// a Sent Quote for a Deep Clean, its Deposit for the Standard Clean they
// chose going through, as their bank finishes it
const going = (over: Partial<QuoteSummary> = {}): QuoteSummary =>
  ({
    id: "quote",
    kind: "one_off",
    status: "sent",
    service: { key: "deep", name: "Deep Clean", method: "rooms" },
    property: { id: "home", street: "12 Elm St", unit: null, postcode: "" },
    proposedStartsAt: "2026-11-09T14:00:00.000Z",
    paying: {
      status: "goingThrough",
      serviceKey: "standard",
      depositCents: 4872,
    },
    payingServiceName: "Standard Clean",
    bookable: null,
    ...over,
  }) as QuoteSummary;
const goingAt = (depositCents: number) =>
  going({ paying: { ...going().paying!, depositCents } as DepositPaying });

const data = (over: Partial<PaymentsData> = {}): PaymentsData => ({
  plans: [],
  pastJobs: [],
  bills: [],
  quotes: [],
  paymentMethod: card,
  ...over,
});

const href = (to: string, params: object) => ({ to, params });
const quoteHref = href("/portal/quotes/$quoteId", { quoteId: "quote" });

describe("what a Client owes now", () => {
  test("nothing, with the card they pay with", () => {
    expect(moneyNow(data())).toEqual({
      owed: null,
      paying: "Visa ending 4242",
      clearing: [],
      news: [],
      cardsBill: null,
    });
  });

  test("a clean their card was declined for: update the card", () => {
    const { owed } = moneyNow(data({ pastJobs: [unpaidClean] }));

    expect(owed).toMatchObject({
      cents: 18450,
      late: true,
      line: null,
      why: "We couldn't take payment for your Oct 20 clean.",
      action: { label: "Update your card" },
    });
  });

  test("a clean waiting on the payment service: nothing to do but see it", () => {
    const { owed } = moneyNow(
      data({ pastJobs: [{ ...unpaidClean, unpaid: "waiting" }] }),
    );

    expect(owed).toMatchObject({
      line: "Your Oct 20 clean",
      why: null,
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
      line: "Bill EC-000041",
      why: null,
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
      line: null,
      why: "We couldn't take payment for bill EC-000042.",
    });
  });

  test("a Bill due on its page: pay it there", () => {
    const { owed } = moneyNow(data({ bills: [bill()] }));
    expect(owed?.asks).toBe(true);

    expect(owed).toMatchObject({
      cents: 125350,
      late: false,
      line: "Bill EC-000041 is due by Tue, Nov 3",
      why: null,
      action: {
        label: "Pay the bill",
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
      line: null,
      why: "We couldn't take payment for bill EC-000040, and 1 more.",
      action: { label: "Pay bill EC-000040" },
    });
  });

  test("a Bill charged automatically isn't owed until its Charge fails", () => {
    expect(
      moneyNow(data({ bills: [bill({ payment: "automatic" })] })).owed,
    ).toBeNull();
  });

  // #534's UX review U10
  test("a bank debit on its way is pending, asking nothing, and said", () => {
    const debit = bill({ status: "processing" });

    expect(moneyNow(data({ bills: [debit] }))).toMatchObject({
      owed: {
        cents: 125350,
        asks: false,
        late: false,
        line: "Bill EC-000041",
        why: null,
        action: { label: "See the bill" },
      },
      clearing: [debit],
      // the card names it, so what's said under it needn't (U16)
      cardsBill: "bill",
    });
  });

  // #534's change review F25
  test("a bank debit on its way under a card about two Bills: the card names neither alone", () => {
    const debit = bill({ status: "processing" });
    const waiting = bill({
      id: "waiting",
      number: "EC-000040",
      payment: "automatic",
      unpaid: { since: "", kind: "waiting", why: null },
    });

    expect(moneyNow(data({ bills: [waiting, debit] }))).toMatchObject({
      owed: { asks: false, line: "Bill EC-000040, and 1 more" },
      clearing: [debit],
      cardsBill: null,
    });
    // and a Bill due under it, asking to be paid, is the card's alone
    expect(
      moneyNow(
        data({ bills: [bill({ id: "due", number: "EC-000042" }), debit] }),
      ).cardsBill,
    ).toBe("due");
  });

  // #534's UX review U11
  test("one their bank asks them to approve says so under when it's due", () => {
    const approving = bill({
      paying: { status: "approving", until: "2026-10-20T13:15:00.000Z" },
    });
    expect(owedAnswer(data({ bills: [approving] })).hero.lines).toEqual([
      "Bill EC-000041 is due by Tue, Nov 3",
      "Your bank hasn't approved your payment yet",
    ]);
    // beside another Bill due, it names its own
    expect(
      moneyNow(
        data({
          bills: [bill({ id: "other", number: "EC-000040" }), approving],
        }),
      ).owed?.waiting,
    ).toBe("Your bank hasn't approved your payment for bill EC-000041 yet");
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

// the Client's last payment on a Bill's page that didn't go through (#534):
// news in the alert above the card, with why, while the card's line keeps
// when it's due by, as that's still ahead; one alert for all that's owed,
// naming the Bill only when the card's line doesn't (#534's UX review U6)
describe("a payment on a Bill's page that didn't go through", () => {
  const WHY = "there wasn't enough money in the account";
  const failed = (over: Partial<BillSummary> = {}) =>
    bill({ paying: { status: "failed", at: CLEAN, why: WHY }, ...over });
  const late = bill({
    id: "late",
    number: "EC-000040",
    unpaid: { since: "", kind: "late", why: null },
    totalCents: 100000,
  });

  test("before its due date: red, its line kept and naming it, the alert says why", () => {
    const answer = owedAnswer(data({ bills: [failed()] }));
    expect(answer.hero).toMatchObject({
      label: "To pay",
      tone: "danger",
      headline: "$1,253.50",
      lines: ["Bill EC-000041 is due by Tue, Nov 3"],
      action: { label: "Pay the bill" },
    });
    expect(answer.why).toEqual({
      tone: "danger",
      lead: `Your payment didn't go through (${WHY}).`,
    });
    // with no reason known, the sentence ends without one
    expect(
      owedAnswer(
        data({
          bills: [
            failed({ paying: { status: "failed", at: CLEAN, why: null } }),
          ],
        }),
      ).why?.lead,
    ).toBe("Your payment didn't go through.");
  });

  test("with another Bill due, it leads, and the alert names only it", () => {
    const due = bill({ id: "due", number: "EC-000042" });
    expect(moneyNow(data({ bills: [due, failed()] })).owed).toMatchObject({
      cents: 250700,
      late: true,
      line: "Bill EC-000041 is due by Tue, Nov 3, and 1 more",
      why: `Your payment for bill EC-000041 didn't go through (${WHY}).`,
      action: { label: "Pay the bill" },
    });
  });

  test("two that didn't go through are counted", () => {
    const other = failed({ id: "other", number: "EC-000042" });
    expect(moneyNow(data({ bills: [failed(), other] })).owed?.why).toBe(
      "Payments for 2 bills didn't go through.",
    );
  });

  test("past its due date, the alert says it in place of the late words", () => {
    const lateFailed = failed({
      unpaid: { since: "", kind: "late", why: null },
    });
    expect(moneyNow(data({ bills: [lateFailed] })).owed).toMatchObject({
      line: null,
      why: `Your payment for bill EC-000041 didn't go through (${WHY}).`,
    });
  });

  test("beside a late Bill: each one's news, the late first, which the card pays", () => {
    expect(moneyNow(data({ bills: [failed(), late] })).owed).toMatchObject({
      cents: 225350,
      line: null,
      why: `We couldn't take payment for bill EC-000040. Your payment for bill EC-000041 didn't go through (${WHY}).`,
      action: { label: "Pay bill EC-000040" },
    });
  });

  test("three or more Bills that ask: how many, and where to read why", () => {
    const due = bill({ id: "due", number: "EC-000042" });
    expect(moneyNow(data({ bills: [failed(), late, due] })).owed).toMatchObject(
      {
        line: null,
        why: "3 bills aren't paid yet. Each one's page says why.",
      },
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
        // the shared line's dot, held to its words (lineOf)
        lines: ["Bill EC-000041 · Nothing you need to do."],
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

// #534's UX design, Screen 4: the money's left their bank, so it's said
// where they look for it, calmly, as a Bill's payment pending is
describe("a quote's Deposit going through", () => {
  test("is pending, asking nothing: what it's for, and a way to its quote", () => {
    expect(moneyNow(data({ quotes: [going()] }))).toMatchObject({
      owed: {
        cents: 4872,
        asks: false,
        late: false,
        line: "Deposit for Standard Clean",
        why: null,
        action: { label: "See your quote", href: quoteHref },
      },
      news: [],
      cardsBill: null,
    });
    expect(owedAnswer(data({ quotes: [going()] })).hero).toMatchObject({
      label: "Payment pending",
      tone: "info",
      headline: "$48.72",
      lines: ["Deposit for Standard Clean · Nothing you need to do."],
      action: { label: "See your quote", secondary: true },
    });
  });

  test("a plan's is the plan's", () => {
    expect(
      moneyNow(data({ quotes: [going({ kind: "service_plan" })] })).owed?.line,
    ).toBe("Deposit for your cleaning plan");
    expect(
      moneyNowIn(data({ quotes: [going({ kind: "service_plan" })] }), "es").owed
        ?.line,
    ).toBe("Depósito de su plan de limpieza");
  });

  // a 0% Deposit's card saved, or a time filled, moves no money
  test("is all that's owed of a quote: nothing for a card being saved or a day filled", () => {
    expect(
      moneyNow(
        data({
          quotes: [
            goingAt(0),
            going({ paying: null, bookable: [] }),
            going({ paying: null }),
          ],
        }),
      ),
    ).toMatchObject({ owed: null, news: [] });
  });

  test("two, or one beside a Bill's payment pending, are one calm card, the Deposit, newest, leading", () => {
    const other = going({ id: "other", payingServiceName: "Deep Clean" });
    expect(moneyNow(data({ quotes: [going(), other] })).owed).toMatchObject({
      cents: 9744,
      line: "Deposit for Standard Clean, and 1 more",
      action: { href: quoteHref },
    });

    const debit = bill({ status: "processing" });
    expect(moneyNow(data({ bills: [debit], quotes: [going()] }))).toMatchObject(
      {
        owed: {
          cents: 4872 + 125350,
          asks: false,
          line: "Deposit for Standard Clean, and 1 more",
          action: { label: "See your quote", href: quoteHref },
        },
        clearing: [debit],
        // so the bank debit's notice names its Bill
        cardsBill: null,
      },
    );
  });

  test("under a card that asks, it's News, in Home's words", () => {
    const money = moneyNow(data({ bills: [bill()], quotes: [going()] }));
    expect(money.owed).toMatchObject({ cents: 125350, asks: true });
    expect(money.news).toEqual([
      "Your deposit for the Standard Clean on Mon, Nov 9, 9:00 AM at 12 Elm St is pending. We'll email you as soon as it's booked, usually within half an hour.",
    ]);
    expect(
      moneyNow(
        data({ bills: [bill()], quotes: [going({ kind: "service_plan" })] }),
      ).news,
    ).toEqual([
      "Your deposit for your cleaning plan at 12 Elm St is pending. We'll email you as soon as it's booked, usually within half an hour.",
    ]);
  });
});

// one rule for each page that names it (#534's UX design, Screens 2 to 4)
describe("what a Sent Quote waits on that's nothing of theirs", () => {
  test("its Deposit, a card saved for a 0% one, or its time filled", () => {
    expect(waitOf(going())).toBe("payment");
    expect(waitOf(goingAt(0))).toBe("booking");
    expect(waitOf(going({ paying: null, bookable: [] }))).toBe("filled");
    expect(waitOf(going({ paying: null }))).toBeNull();
    // their bank waiting on them is theirs to answer
    expect(
      waitOf(
        going({
          paying: { ...going().paying!, status: "approving", until: "" },
        }),
      ),
    ).toBeNull();
    // a quote answered or gone waits on nothing
    expect(waitOf(going({ status: "declined" }))).toBeNull();
    expect(waitLabelOf("en", "payment")).toBe("Payment pending");
    expect(waitLabelOf("es", "filled")).toBe("Día lleno");
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
  quote: null,
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
    expect(pausedLine([{ status: "active" }])).toEqual([]);
  });

  // what the pause does, true whether or not its cleans are booked, so
  // it never says booked cleans go ahead when none are (#532's U5)
  test("a paused plan books no more cleans until it's paid", () => {
    expect(pausedLine([{ status: "active" }, { status: "on_hold" }])).toEqual([
      "Until it's paid, we won't book more cleans on your plan.",
    ]);
  });

  test("asking nothing of them, until it goes through", () => {
    expect(pausedLine([{ status: "on_hold" }], false)).toEqual([
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

  // nothing was booked, so there's no clean or plan to open: its quote
  // says why (#534's UX design, Screen 4)
  test("a Deposit given back as it couldn't book, and its refund, open the quote", () => {
    const unbooked = (over: Partial<ClientPayment>) =>
      payment({
        kind: "deposit",
        amountCents: 4872,
        job: null,
        quote: { id: "quote", serviceName: "Standard Clean" },
        ...over,
      });
    expect(paymentRow(unbooked({}))).toEqual({
      title: "Deposit for Standard Clean",
      line: "Not booked",
      href: quoteHref,
    });
    expect(
      paymentRow(unbooked({ kind: "refund", amountCents: -4872 })),
    ).toEqual({
      title: "Refund on Standard Clean",
      line: undefined,
      href: quoteHref,
    });

    const plan = { id: "quote", serviceName: null };
    expect(paymentRow(unbooked({ quote: plan }))).toEqual({
      title: "Deposit for your cleaning plan",
      line: "Not booked",
      href: quoteHref,
    });
    expect(
      paymentRow(unbooked({ kind: "refund", amountCents: -4872, quote: plan })),
    ).toEqual({
      title: "Refund of your cleaning plan deposit",
      line: undefined,
      href: quoteHref,
    });
    expect(paymentRowIn(unbooked({}), "es").line).toBe("No se reservó");
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
