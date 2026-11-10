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
  cancelledEmail,
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
import type { Clean, Email } from "./blocks.ts";
import { renderEmail } from "./render.tsx";
import { createClient } from "#features/clients";
import { testEmail } from "../../../tests/harness.ts";
import {
  casey,
  completedFirstClean,
  signInAsOffice,
} from "../../../tests/fixtures.ts";

// Every email to a Client, each way it can read, in their Preferred
// Language (ADR-0025, #304). The data is what a Spanish reader's would be,
// with nothing English in it, so any English left in the words is ours.
// Names of Services and a Bill's lines stay as stored until #395

const name = "Casey Cliente";
const email = "casey@example.com";
const address = "41-12 Austin St, 4B, 11375";
const jobId = "8b175f41-4cb2-481c-af0c-260413da69da";
const monday = new Date("2026-01-12T14:00:00Z");
const wednesday = new Date("2026-01-14T18:30:00Z");
const clean: Clean = {
  service: "Limpieza profunda",
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
  lines: [{ label: "Limpieza profunda", amountCents: 64800 }],
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
    { serviceName: "Limpieza profunda", recommended: true, totalCents: 29940 },
    { serviceName: "Limpieza estándar", recommended: false, totalCents: 19940 },
  ],
  plan: null,
};
const planDay = {
  serviceName: "Limpieza estándar",
  startsAt: monday.toISOString(),
  savingCents: 2000,
  oneOffTotalCents: 19940,
};
const plan = {
  recurrence: "fortnightly" as const,
  cleans: [
    { startsAt: monday, serviceName: "Limpieza estándar", totalCents: 17940 },
    {
      startsAt: wednesday,
      serviceName: "Limpieza estándar",
      totalCents: 17940,
    },
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
const changed = { kind: "extra_time" as const, addOnName: null, hours: 1 };

// each Client email, every way it reads, in `lang`
const emailsIn = (lang: Language): Email[] => [
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
      adjustments: [
        { ...changed, totalCents: 5988 },
        {
          kind: "add_on_done",
          addOnName: "Dentro del horno",
          hours: null,
          totalCents: 2994,
        },
        {
          kind: "add_on_not_done",
          addOnName: "Dentro del horno",
          hours: null,
          totalCents: -2994,
        },
      ],
      totalCents: 35928,
      rescheduleFeeCents: 4000,
      depositCents: 5988,
      owedCents: 12000,
      settled,
    }),
  ),
  ...[false, true].map((reminder) =>
    proposalEmail(lang, {
      name,
      jobId,
      clean,
      adjustment: changed,
      reason: typed.extra,
      totalCents: 5988,
      answerBy: wednesday,
      reminder,
    }),
  ),
  ...settlings.flatMap((settled) => [
    approvedEmail(lang, {
      name,
      jobId,
      clean,
      adjustment: changed,
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

describe("every email to a Client, in their Preferred Language", () => {
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
    // Olive in the Office, and Cory, a Cleaner, until #305
    const ours = [
      ...testEmail().to("olive@example.com"),
      ...testEmail().to("cory@example.com"),
    ];
    expect(ours.map((m) => m.subject)).toEqual(
      expect.arrayContaining([
        "New quote request from Casey Client",
        "You've been offered a job",
      ]),
    );
    for (const sent of ours) {
      expect(sent.html, sent.subject).toMatch(/<html[^>]* lang="en"/);
    }
  });
});
