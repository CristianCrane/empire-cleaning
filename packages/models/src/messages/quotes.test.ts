import { expect, test } from "vitest";
import {
  acceptedWith,
  clientPaying,
  filledDaysOf,
  payingFor,
  quotes,
  type PayingFor,
} from "./quotes.ts";

// a cleaning plan's quote over two days, and a one-off's single time
const twoDays = { days: [{}, {}] };
const oneDay = { days: [{}] };

test("a quote whose time filled names what filled: a clean's time, a plan's days, a change's new days (#534)", () => {
  expect(filledDaysOf({ plan: null, changes: false })).toBe("clean");
  // one day is its time, plan or not
  expect(filledDaysOf({ plan: oneDay, changes: true })).toBe("clean");
  expect(filledDaysOf({ plan: twoDays, changes: false })).toBe("plan");
  expect(filledDaysOf({ plan: twoDays, changes: true })).toBe("change");

  const when = "Mon, Jan 12, 9:00 AM";
  expect(quotes.en.bookedUp("clean", when)).toBe(
    "Sorry, Mon, Jan 12, 9:00 AM has filled up since we sent this quote, so it can't be accepted.",
  );
  expect(quotes.en.bookedUp("plan", when)).toBe(
    "Sorry, one of the days your plan starts on has filled up since we sent this quote, so it can't be accepted.",
  );
  // the plan they have stays: "starts on" isn't what happened
  expect(quotes.en.bookedUp("change", when)).toBe(
    "Sorry, one of the new days for your plan has filled up since we sent this quote, so it can't be accepted.",
  );
  expect(quotes.es.bookedUp("change", when)).toBe(
    "Lo sentimos, uno de los nuevos días de su plan se llenó después de que le enviamos esta cotización, así que no se puede aceptar.",
  );
});

// #534's UX design, Screen 5: Robin's bank finishing the Deposit, past the
// wait, as the Office's Quote says it: the wait the Office's Bill names for
// the same, under half an hour (the Clock asks again 15 minutes on, on its
// next 10-minute tick), and what Jen can do once it's done
const finishing = (over: Partial<PayingFor> = {}): PayingFor => ({
  ...payingFor("Robin Diaz", {
    until: "2026-11-25T19:29:00Z",
    since: "2026-11-25T19:04:00Z",
    finishing: true,
    serviceName: "Standard Clean",
    changing: false,
    depositCents: 4872,
  }),
  ...over,
});
const page = (p: PayingFor, card: boolean, drafting = false) =>
  clientPaying.page(p, { card, drafting });

test("a Deposit the Client's bank is finishing says how long it usually takes, and what's next once it's done (#534)", () => {
  expect(page(finishing(), true)).toBe(
    "Robin Diaz's online payment of the $48.72 deposit, for the Standard Clean, started Wed, Nov 25, 2:04\u00a0PM and is still going through with their bank, which usually takes under half an hour. If it doesn't go through, you can record acceptance then.",
  );
  // no card saved: Record acceptance isn't offered, so nothing more
  expect(page(finishing({ service: null }), false)).toBe(
    "Robin Diaz's online payment of the $48.72 deposit, to start the cleaning plan, started Wed, Nov 25, 2:04\u00a0PM and is still going through with their bank, which usually takes under half an hour.",
  );
  expect(page(finishing(), true, true)).toBe(
    "Robin Diaz's online payment of the $48.72 deposit, for the Standard Clean, started Wed, Nov 25, 2:04\u00a0PM and is still going through with their bank, which usually takes under half an hour. If it books the quote you sent, your draft is deleted. If not, you can send your changes or record acceptance then.",
  );
  expect(page(finishing(), false, true)).toBe(
    "Robin Diaz's online payment of the $48.72 deposit, for the Standard Clean, started Wed, Nov 25, 2:04\u00a0PM and is still going through with their bank, which usually takes under half an hour. If it books the quote you sent, your draft is deleted. If not, you can send your changes then.",
  );
  // a card entered with nothing to charge (a 0% Deposit)
  expect(page(finishing({ deposit: null }), true)).toBe(
    "Robin Diaz is accepting online, for the Standard Clean, started Wed, Nov 25, 2:04\u00a0PM: their bank is finishing approving their card. It books on its own, usually within half an hour. If it isn't approved, you can record acceptance then.",
  );
  expect(clientPaying.draft(finishing())).toBe(
    "Robin Diaz's online payment, started Wed, Nov 25, 2:04\u00a0PM, is still going through with their bank, which usually takes under half an hour. If it books the quote you sent, your draft is deleted. If not, you can send your changes then.",
  );
  // when it started, so Office Staff can tell one stuck (#534's UX review
  // U3), and the greyed Record acceptance's reason, waiting on their bank,
  // not on them (U4)
  expect(clientPaying.item("Robin", false, true)).toBe(
    "Not while Robin's deposit payment goes through",
  );
  expect(clientPaying.item("Robin", true, true)).toBe(
    "Not while Robin's card approval goes through",
  );
  expect(clientPaying.item("Robin", false)).toBe(
    "Not while Robin is paying the deposit",
  );
  expect(clientPaying.finishing("Robin Diaz", false)).toBe(
    "Robin Diaz's online payment is still going through with their bank, which usually takes under half an hour, so you can't record acceptance yet. Nothing more was charged.",
  );
});

// Screen 5's endings: the Client's latest payment online that took
// nothing, while the quote's open, in the Office's Bill's words for the
// same endings, then who can do what next
test("a Deposit paid online that took nothing says how it ended, what it was for, and what's next (#534, UX review U4)", () => {
  const never = {
    name: "Robin Diaz",
    on: "Nov 25",
    deposit: "$48.72",
    service: "Standard Clean",
    changing: false,
    status: "notApproved",
  } as const;
  const failed = { ...never, status: "failed", why: null } as const;
  const open = { open: true, record: true };
  expect(clientPaying.ended(never, open)).toBe(
    "On Nov 25, Robin Diaz's online payment of the $48.72 deposit, for the Standard Clean, wasn't approved, so nothing was taken. They can try again on their quote, or you can record acceptance.",
  );
  expect(
    clientPaying.ended({ ...failed, why: "the card has expired" }, open),
  ).toBe(
    "On Nov 25, Robin Diaz's online payment of the $48.72 deposit, for the Standard Clean, didn't go through (the card has expired). They can try again on their quote, or you can record acceptance.",
  );
  // no card saved, so no acceptance to record
  expect(clientPaying.ended(never, { open: true, record: false })).toBe(
    "On Nov 25, Robin Diaz's online payment of the $48.72 deposit, for the Standard Clean, wasn't approved, so nothing was taken. They can try again on their quote.",
  );
  // its time filled since: there's nothing to try again on
  expect(clientPaying.ended(failed, { open: false, record: false })).toBe(
    "On Nov 25, Robin Diaz's online payment of the $48.72 deposit, for the Standard Clean, didn't go through.",
  );
  // a plan's, by the plan it starts or changes
  expect(
    clientPaying.ended({ ...never, service: null, changing: true }, open),
  ).toBe(
    "On Nov 25, Robin Diaz's online payment of the $48.72 deposit, to change the cleaning plan, wasn't approved, so nothing was taken. They can try again on their quote, or you can record acceptance.",
  );
  // a card entered with nothing to charge, in the Client's words for it
  expect(clientPaying.ended({ ...never, deposit: null }, open)).toBe(
    "On Nov 25, Robin Diaz's card, entered to accept online for the Standard Clean, wasn't approved, so nothing was booked. They can try again on their quote, or you can record acceptance.",
  );
  expect(clientPaying.ended({ ...failed, deposit: null }, open)).toBe(
    "On Nov 25, Robin Diaz's card, entered to accept online for the Standard Clean, was declined, so nothing was booked. They can try again on their quote, or you can record acceptance.",
  );
});

// #534 review F10: once the Client's own payment online booked the quote
// just before the Office pressed, the Office is told what it took. A plan
// change takes no Deposit (depositOnAccepting): their card was approved, and
// their plan changed, not started
test("a payment online that booked the quote just before the Office pressed says what it took: a plan change's card, a plan's Deposit, a clean's Service", () => {
  const plan = { plan: { depositCents: 4872 }, options: [] };
  const changed = acceptedWith({
    offer: plan,
    acceptedServiceKey: null,
    changedPlan: true,
  });
  expect(clientPaying.recorded("Robin Diaz", changed, null)).toBe(
    "Robin Diaz's card was approved just before you pressed, so the quote is accepted and their cleaning plan is changed as they chose it.",
  );
  expect(clientPaying.sent("Robin Diaz", changed)).toBe(
    "Robin Diaz's card was approved just before you pressed, so the quote is accepted and their cleaning plan is changed as they chose it, and your changes weren't sent.",
  );
  const started = acceptedWith({
    offer: plan,
    acceptedServiceKey: null,
    changedPlan: false,
  });
  expect(clientPaying.recorded("Robin Diaz", started, null)).toBe(
    "Robin Diaz's payment went through just before you pressed, so the quote is accepted and their cleaning plan is started as they chose it. Nothing more was charged.",
  );
  // a clean: the Service they paid for, which may not be the one picked
  const clean = (depositCents: number) => ({
    plan: null,
    options: [
      { serviceKey: "standard", serviceName: "Standard Clean", depositCents },
      { serviceKey: "deep", serviceName: "Deep Clean", depositCents },
    ],
  });
  const deep = acceptedWith({
    offer: clean(1500),
    acceptedServiceKey: "deep",
    changedPlan: false,
  });
  expect(clientPaying.recorded("Robin Diaz", deep, "Standard Clean")).toBe(
    "Robin Diaz's payment went through just before you pressed, so the quote is accepted with the Deep Clean they paid for, not the Standard Clean. Nothing more was charged.",
  );
  // a 0% Deposit: their card approved, with nothing charged
  const card = acceptedWith({
    offer: clean(0),
    acceptedServiceKey: "standard",
    changedPlan: false,
  });
  expect(clientPaying.sent("Robin Diaz", card)).toBe(
    "Robin Diaz's card was approved just before you pressed, so the quote is accepted with the Standard Clean they picked, and your changes weren't sent.",
  );
});
