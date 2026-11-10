import { describe, expect, test } from "vitest";
import type { Language } from "@empire-cleaning/models";
import { signInEmail } from "../../features/auth/emails.ts";
import {
  billEmail,
  chargedPerCleanEmail,
  creditRefundedEmail,
  type BillToSend,
  type SettledJob,
} from "../../features/bills/emails.ts";
import {
  cleanersNeededEmail,
  offerEmail,
  takenOffEmail,
} from "../../features/assignments/emails.ts";
import {
  cancelledEmail,
  crewCancelledEmail,
  noAccessEmail,
} from "../../features/cancellation/emails.ts";
import { emailChangeEmail } from "../../features/clients/emails.ts";
import type { Settled } from "../../features/completion/balance.ts";
import {
  approvedEmail,
  completionUndoneEmail,
  correctedEmail,
  feeTakenEmail,
  paymentWentThroughEmail,
  proposalEmail,
  receiptEmail,
  reviewRequestEmail,
  unpaidEmail,
} from "../../features/completion/emails.ts";
import { reminderEmail } from "../../features/jobs/emails.ts";
import { paymentMethodLinkEmail } from "../../features/payments/emails.ts";
import {
  askClashEmail,
  bookingConfirmationEmail,
  planChangeEmail,
  planConfirmationEmail,
  quoteEmail,
  quoteReceivedEmail,
  turnDownEmail,
  type QuoteOffer,
} from "../../features/quotes/emails.ts";
import {
  crewLostEmail,
  crewMovedEmail,
  jobMovedEmail,
  rescheduleConfirmedEmail,
  rescheduleTurnedDownEmail,
} from "../../features/reschedule/emails.ts";
import {
  planCleanBookedEmail,
  planEndedEmail,
} from "../../features/service-plans/emails.ts";
import {
  siteVisitBookedEmail,
  siteVisitCancelledEmail,
  siteVisitChangedEmail,
} from "../../features/site-visits/emails.ts";
import { staffInviteEmail } from "../../features/staff/emails.ts";
import type { Clean, Email } from "./blocks.ts";
import { renderEmail } from "./render.tsx";
import { createClient } from "#features/clients";
import { createStaff, setUsualWeek } from "#features/staff";
import { emailedLinkFor, signIn, testEmail } from "../../../tests/harness.ts";
import {
  bookedJob,
  casey,
  completedFirstClean,
  signInAsOffice,
} from "../../../tests/fixtures.ts";

// Every email to a Client (#304) or a Cleaner (#305), each way it can
// read, in their Preferred Language (ADR-0025). The data is what a Spanish reader's would be,
// with nothing English in it but the names the Office gives in both
// languages, which each email names in its own (#395), so any English left
// in the words is ours

const name = "Casey Cliente";
const email = "casey@example.com";
const address = "41-12 Austin St, 4B, 11375";
const jobId = "8b175f41-4cb2-481c-af0c-260413da69da";
const monday = new Date("2026-01-12T14:00:00Z");
const wednesday = new Date("2026-01-14T18:30:00Z");
// a Service, an extra: the Office's names in both languages
const deep = { name: "Deep Clean", nameEs: "Limpieza profunda" };
const standard = { name: "Standard Clean", nameEs: "Limpieza estándar" };
const oven = { name: "Inside the oven", nameEs: "Dentro del horno" };
const clean: Clean = {
  service: deep,
  address,
  startsAt: monday,
};
const card = "Visa 4242";
// what the Office or a Cleaner typed, shown as written
const typed = {
  cancelled: "El equipo está enfermo.",
  voided: "Se facturó dos veces.",
  noAccess: "Nadie abrió la puerta",
  extra: "Mucha grasa",
};
const nothing: Settled = {
  chargedCents: 0,
  refundedCents: 0,
  failure: null,
  becameUnpaid: false,
  paymentMethod: card,
  plan: null,
  billed: false,
};
// every way settling a Job can go, as its emails say it
const settlings: Settled[] = [
  nothing,
  { ...nothing, chargedCents: 12000, refundedCents: 3000, plan: "resumed" },
  { ...nothing, failure: "card_declined", plan: "held", paymentMethod: null },
  { ...nothing, failure: "processing" },
  { ...nothing, billed: true },
];
// each kind of price change
const changes = [
  { kind: "extra_time" as const, addOn: null, hours: 1 },
  { kind: "add_on_done" as const, addOn: oven, hours: null },
  { kind: "add_on_not_done" as const, addOn: oven, hours: null },
];
const [changed] = changes;

// a Bill's line, of a key
const line = {
  corrected: false,
  fee: null,
  change: null,
  clean,
  creditFrom: null,
  amountCents: 32400,
};
const bill: BillToSend = {
  id: jobId,
  number: "EC-000012",
  weekStart: "2026-01-05",
  dueOn: "2026-01-26",
  payment: "on_page",
  status: "due",
  unpaid: null,
  paidVia: null,
  voidReason: null,
  totalCents: 64800,
  taxCents: 5351,
  // every kind of line a Bill words
  lines: [
    ...["price", "floor", "reschedule_fee", "deposit", "paid"].flatMap((key) =>
      [false, true].map((corrected) => ({ ...line, key, corrected })),
    ),
    ...changes.map((change) => ({ ...line, key: "adjustment:1", change })),
    { ...line, key: "fee", fee: "cancelled" as const },
    { ...line, key: "fee", fee: "no_access" as const },
    { ...line, key: "credit", clean: null, creditFrom: "EC-000011" },
  ],
};
const settledJob = (settled: Settled): SettledJob => ({
  jobId,
  clean,
  fee: null,
  settled,
  unpaidCents: settled.failure ? 12000 : null,
});
const offer: QuoteOffer = {
  number: 1,
  proposedStartsAt: monday.toISOString(),
  expiresAt: wednesday.toISOString(),
  options: [
    { service: deep, recommended: true, totalCents: 29940 },
    { service: standard, recommended: false, totalCents: 19940 },
  ],
  plan: null,
};
const planDay = {
  service: standard,
  startsAt: monday.toISOString(),
  savingCents: 2000,
  oneOffTotalCents: 19940,
};
const plan = {
  recurrence: "fortnightly" as const,
  cleans: [
    { startsAt: monday, service: standard, totalCents: 17940 },
    { startsAt: wednesday, service: standard, totalCents: 17940 },
  ],
};
const visit = {
  name,
  address,
  startsAt: monday,
  visitor: "Jen Oficina",
  minutes: 30,
  place: "home" as const,
};

// a Job open to a Cleaner, as the Cleaners Needed email lists it
const needed = (crewSize: number, hoursOnSite: number) => ({
  jobId,
  startsAt: monday.toISOString(),
  service: clean.service,
  hoursOnSite,
  crewSize,
  postcode: "11375",
});

// each Client and Cleaner email, every way it reads, in `lang`
const emailsIn = (lang: Language): Email[] => [
  offerEmail(lang, { name, jobId, clean }),
  takenOffEmail(lang, { name, clean }),
  ...[true, false].flatMap((soon) => [
    cleanersNeededEmail(lang, { name, soon, jobs: [needed(1, 1)] }),
    cleanersNeededEmail(lang, {
      name,
      soon,
      jobs: [needed(2, 3.5), needed(1, 2)],
    }),
  ]),
  crewMovedEmail(lang, { name, jobId, clean, from: wednesday }),
  crewLostEmail(lang, { name, clean, from: wednesday }),
  crewCancelledEmail(lang, { name, clean }),
  staffInviteEmail(lang, { name, email }),
  signInEmail(lang, { path: "/sign-in/link?token=t" }),
  emailChangeEmail(lang, { token: "t" }),
  reminderEmail(lang, { name, clean }),
  ...([null, "automatic", "on_page"] as const).map((weeklyBill) =>
    paymentMethodLinkEmail(lang, { name, email, weeklyBill }),
  ),
  siteVisitBookedEmail(lang, visit),
  siteVisitBookedEmail(lang, { ...visit, place: "premises" }),
  siteVisitChangedEmail(lang, visit),
  siteVisitChangedEmail(lang, { ...visit, was: wednesday }),
  siteVisitCancelledEmail(lang, visit),
  rescheduleTurnedDownEmail(lang, {
    name,
    jobId,
    clean,
    asked: wednesday,
    reason: null,
  }),
  ...(["free", "free_late", "late_cancellation"] as const).flatMap((cost) =>
    [0, 4000].flatMap((feeCents) =>
      [false, true].map((onPlan) =>
        rescheduleConfirmedEmail(lang, {
          name,
          jobId,
          clean,
          from: wednesday,
          cost: { cost, feeCents, onPlan, weeklyBill: onPlan },
        }),
      ),
    ),
  ),
  jobMovedEmail(lang, { name, jobId, clean, from: wednesday }),
  // a Bill, for each reason it's sent
  ...(
    [
      [{}, "made"],
      [{ unpaid: "waiting" }, "made"],
      [{ unpaid: "declined" }, "unpaid"],
      [{ totalCents: -2000 }, "made"],
      [{ totalCents: 0 }, "made"],
      [{ status: "paid", payment: "automatic" }, "made"],
      [{}, "reminder", "2026-01-20"],
      [{}, "reminder", "2026-01-26"],
      [{}, "reminder", "2026-01-28"],
      [{ paidVia: "outside" }, "paid"],
      [{ paidVia: "card" }, "paid"],
      [{}, "voided"],
      [{}, "debit_failed"],
    ] as const
  ).flatMap(([change, occasion, today = "2026-01-12"]) =>
    [false, true].map((billedWeekly) =>
      billEmail(lang, {
        name,
        bill: { ...bill, ...change },
        occasion,
        card: billedWeekly ? card : null,
        today,
        billedWeekly,
        creditRefundDays: 30,
      }),
    ),
  ),
  ...(["paused", "back_on", "pauses_if_late"] as const).map((note) =>
    billEmail(lang, {
      name,
      bill,
      occasion: "reminder",
      plan: note,
      card,
      today: "2026-01-20",
      billedWeekly: true,
      creditRefundDays: 30,
    }),
  ),
  billEmail(lang, {
    name,
    bill: { ...bill, voidReason: typed.voided },
    occasion: "voided",
    settled: settlings.map(settledJob),
    card,
    today: "2026-01-20",
    billedWeekly: false,
    creditRefundDays: 30,
  }),
  ...settlings.map((settled) =>
    chargedPerCleanEmail(lang, {
      name,
      settled: [
        settledJob(settled),
        { ...settledJob(settled), fee: "cancelled" },
        { ...settledJob(settled), fee: "no_access" },
      ],
    }),
  ),
  creditRefundedEmail(lang, {
    name,
    billId: jobId,
    number: "EC-000012",
    cents: 2000,
    creditRefundDays: 30,
  }),
  // cancelled by us or them, on a plan or not, late or not, each settling
  ...settlings.flatMap((settled) =>
    [false, true].flatMap((onPlan) =>
      [false, true].flatMap((late) =>
        (["client", "empire"] as const).map((by) =>
          cancelledEmail(lang, {
            name,
            jobId,
            clean,
            by,
            reason: by === "empire" ? typed.cancelled : null,
            onPlan,
            late,
            feeCents: late ? 4000 : 0,
            settled,
          }),
        ),
      ),
    ),
  ),
  ...settlings.flatMap((settled) =>
    [false, true].flatMap((onPlan) =>
      [0, 4000].map((feeCents) =>
        noAccessEmail(lang, {
          name,
          jobId,
          clean,
          reason: typed.noAccess,
          feeCents,
          onPlan,
          settled,
        }),
      ),
    ),
  ),
  ...[false, true].map((held) =>
    unpaidEmail(lang, {
      name,
      jobId,
      clean,
      owedCents: 12000,
      paymentMethod: held ? card : null,
      held,
    }),
  ),
  ...settlings.map((settled) =>
    receiptEmail(lang, {
      name,
      jobId,
      clean,
      quotedCents: 29940,
      adjustments: changes.map((c) => ({ ...c, totalCents: 2994 })),
      totalCents: 35928,
      rescheduleFeeCents: 4000,
      depositCents: 5988,
      owedCents: 12000,
      settled,
    }),
  ),
  ...changes.flatMap((adjustment) =>
    [false, true].map((reminder) =>
      proposalEmail(lang, {
        name,
        jobId,
        clean,
        adjustment,
        reason: typed.extra,
        totalCents: 5988,
        answerBy: wednesday,
        reminder,
      }),
    ),
  ),
  ...settlings.flatMap((settled) => [
    ...changes.map((adjustment) =>
      approvedEmail(lang, {
        name,
        jobId,
        clean,
        adjustment,
        amountCents: 5988,
        totalCents: 35928,
        owedCents: 5988,
        settled,
      }),
    ),
    approvedEmail(lang, {
      name,
      jobId,
      clean,
      adjustment: changed!,
      amountCents: 5988,
      totalCents: 35928,
      owedCents: 5988,
      settled,
    }),
    feeTakenEmail(lang, {
      name,
      jobId,
      clean,
      feeCents: 4000,
      owedCents: 4000,
      settled,
    }),
    correctedEmail(lang, {
      name,
      jobId,
      clean,
      totalCents: 25000,
      owedCents: 0,
      settled,
    }),
    paymentWentThroughEmail(lang, {
      name,
      jobId,
      clean,
      owedCents: 0,
      settled,
    }),
    completionUndoneEmail(lang, { name, clean, settled }),
  ]),
  reviewRequestEmail(lang, {
    name,
    reviewUrl: "https://g.page/r/review",
  }),
  ...[false, true].map((freeToSkip) =>
    planCleanBookedEmail(lang, { name, jobId, clean, freeToSkip }),
  ),
  ...(["comes_off", "goes_towards", "refunded"] as const).flatMap((deposit) =>
    settlings.map((settled) =>
      planEndedEmail(lang, {
        name,
        address,
        planId: jobId,
        terms: {
          cancelled: [wednesday.toISOString(), wednesday.toISOString()],
          goingAhead: [monday.toISOString()],
          depositCents: 4000,
          deposit,
          finalJob: {
            id: jobId,
            startsAt: monday.toISOString(),
            status: "booked",
          },
        },
        settled,
      }),
    ),
  ),
  quoteReceivedEmail(lang, { name, email, address, quoteId: jobId }),
  ...(["otherKind", "asked", "sent"] as const).map((why) =>
    askClashEmail(lang, { name, email, address, kind: "residential", why }),
  ),
  turnDownEmail(lang, { name, address, quoteId: jobId, reason: "no_capacity" }),
  ...[1, 2].flatMap((number) => [
    quoteEmail(lang, {
      name,
      email,
      quoteId: jobId,
      address,
      offer: { ...offer, number },
    }),
    quoteEmail(lang, {
      name,
      email,
      quoteId: jobId,
      address,
      offer: {
        ...offer,
        number,
        options: [offer.options[1]!],
        plan: {
          recurrence: "weekly",
          discountPercent: 10,
          roundTotalCents: 17940,
          days: [planDay],
        },
      },
    }),
    quoteEmail(lang, {
      name,
      email,
      quoteId: jobId,
      address,
      offer: {
        ...offer,
        number,
        plan: {
          recurrence: "fortnightly",
          discountPercent: 10,
          roundTotalCents: 35880,
          days: [planDay, { ...planDay, startsAt: wednesday.toISOString() }],
        },
      },
    }),
  ]),
  ...([null, "automatic", "on_page"] as const).flatMap((weeklyBill) =>
    [0, 4000].flatMap((depositCents) =>
      [plan, { ...plan, cleans: plan.cleans.slice(0, 1) }].flatMap((p) => [
        planConfirmationEmail(lang, {
          name,
          address,
          plan: p,
          paid: { paymentMethod: card, weeklyBill, depositCents },
        }),
        planChangeEmail(lang, {
          name,
          address,
          planId: jobId,
          plan: p,
          replaced: depositCents ? [monday] : [monday, wednesday],
          paid: { paymentMethod: null, weeklyBill },
        }),
        bookingConfirmationEmail(lang, {
          name,
          clean,
          paid: {
            paymentMethod: card,
            weeklyBill,
            depositCents,
            totalCents: 29940,
          },
        }),
      ]),
    ),
  ),
];

// an email's words, its links and paths taken out: from its subject to its footer
const wordsOf = async (message: Email) => {
  const { subject, text } = await renderEmail(
    message,
    "https://landing.example/email-logo.png",
  );
  const words = `${subject}\n${text}`
    .replace(/(https?:\/\/|\/)\S+/g, "")
    .toLowerCase()
    .match(/\p{L}[\p{L}']+/gu);
  return new Set(words);
};

// words both languages' emails may have: the data, which is the same in
// either, the business's name and area, and words spelled alike in both
const shared = new Set([
  ...([
    name,
    email,
    address,
    card,
    clean.service,
    "Limpieza estándar",
    "Dentro del horno",
    ...Object.values(typed),
    bill.number,
    "Jen Oficina",
    "Empire Cleaning & Pro Services Inc, Queens, NYC, Long Island",
    "empirecleaningandpro.com",
    "Google",
  ]
    .join(" ")
    .toLowerCase()
    .match(/\p{L}[\p{L}']+/gu) ?? []),
  "plan",
  "total",
  "no",
  // "Use este enlace"
  "use",
]);

describe("every email to a Client or a Cleaner, in their Preferred Language", () => {
  test("in Spanish, has none of the English email's words, and says it's Spanish", async () => {
    const en = emailsIn("en");
    const es = emailsIn("es");
    expect(es.map((e) => e.lang)).toEqual(es.map(() => "es"));
    expect(en.map((e) => e.lang)).toEqual(en.map(() => "en"));
    const left = [];
    for (const [i, spanish] of es.entries()) {
      const english = await wordsOf(en[i]!);
      const words = [...(await wordsOf(spanish))].filter(
        (word) => english.has(word) && !shared.has(word),
      );
      if (words.length > 0) left.push({ email: spanish.subject, words });
    }
    expect(left).toEqual([]);
  });

  test('in Spanish, ends no sentence with a second stop after a time ("9:00 a.m..")', async () => {
    for (const spanish of emailsIn("es")) {
      const { subject, text } = await renderEmail(spanish, "logo.png");
      expect(`${subject}\n${text}`, subject).not.toContain("..");
    }
  });
});

describe("a Client's emails as they're sent", () => {
  test("go in their Preferred Language from the quote to the receipt, and the Office's in English", async () => {
    await createClient({ ...casey, preferredLanguage: "es" });
    const office = await signInAsOffice();
    const me = (await office.get("/api/me").expect(200)).body as {
      id: string;
    };

    await completedFirstClean({ byAccountId: me.id });

    const theirs = testEmail().to(casey.email);
    expect(theirs.map((m) => m.subject)).toEqual([
      "Recibimos su solicitud de cotización",
      "Su cotización de Empire Cleaning",
      "Su limpieza con Empire Cleaning está reservada",
      "Su limpieza está terminada: su recibo",
    ]);
    for (const sent of theirs) {
      expect(sent.html, sent.subject).toMatch(/<html[^>]* lang="es"/);
    }
    // Olive in the Office
    const ours = testEmail().to("olive@example.com");
    expect(ours.map((m) => m.subject)).toEqual(
      expect.arrayContaining(["New quote request from Casey Client"]),
    );
    for (const sent of ours) {
      expect(sent.html, sent.subject).toMatch(/<html[^>]* lang="en"/);
    }
  });
});

describe("a Cleaner's emails as they're sent", () => {
  test("go in the language they chose, their links opening in it (#305)", async () => {
    const office = await signInAsOffice();
    const cory = await createStaff({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
    });
    await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
    await (
      await signIn(cory.email)
    )
      .put("/api/me/language")
      .send({ language: "es" })
      .expect(204);
    const job = await bookedJob({
      startsAt: "2026-01-12T14:00:00Z",
      labourHours: 3,
      crewSize: 1,
    });

    await office
      .post(`/api/jobs/${job.id}/assignments`)
      .send({ staffId: cory.id })
      .expect(201);

    const offer = testEmail().lastTo(cory.email);
    expect(offer.subject).toBe("Te ofrecieron un trabajo");
    expect(offer.html).toMatch(/<html[^>]* lang="es"/);
    const link = emailedLinkFor(cory.email);
    expect(link.pathname).toBe(`/cleaner/jobs/${job.id}`);
    expect(link.searchParams.get("lang")).toBe("es");
  });
});
