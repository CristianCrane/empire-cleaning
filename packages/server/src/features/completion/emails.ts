import {
  cleanButton,
  cleansButton,
  amounts,
  button,
  cleanDetails,
  details,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";
import {
  catalog,
  type Language,
  formats,
  inLanguage,
  messages,
  type Named,
  oneStop,
} from "@empire-cleaning/models";
import { cardOf } from "../payments/emails.ts";
import { unpaidKind } from "../payments/unpaid.ts";
import type { Settled } from "./balance.ts";

// a price change, as an email names it ("1 more hour"): its Add-on in both
// languages, for the email to name in its own (ADR-0025)
export type Changed = Omit<
  Parameters<(typeof messages.en)["adjustmentLabel"]>[0],
  "addOnName"
> & { addOn: Named | null };

// what the price change was, in `lang`: "Inside the oven, not done"
const changeLabel = (lang: Language, a: Changed) =>
  messages[lang].adjustmentLabel({
    ...a,
    addOnName: a.addOn && inLanguage(lang, a.addOn).name,
  });

const words = catalog({
  en: {
    SEE_RECEIPT: "See your receipt",
    ON_WEEKLY_BILL: "It goes on your weekly bill.",
    charged: (amount: string, card: string) =>
      `We've charged ${amount} to your ${card}.`,
    // what's owed, as "We couldn't take …" says it
    stillToPay: (amount: string) => `the ${amount} still to pay`,
    forClean: (amount: string) => `${amount} for your clean`,
    unpaid: {
      subject: "We couldn't take your payment",
      // what to do, as UPDATE_AND_RETRY says it, before the button
      please: (what: string) => `Please ${what}:`,
    },
    receipt: {
      subject: "Your clean is done: your receipt",
      DONE: "Your clean is done. Thank you for choosing Empire Cleaning.",
      QUOTED: "Quoted price",
      TOTAL: "Total",
      DEPOSIT_KEPT: " (your deposit, kept)",
      DEPOSIT_PAID: "Deposit paid",
    },
    proposal: {
      subject: "Please approve a price change on your clean",
      reminderSubject: "Reminder: please approve a price change on your clean",
      // the Cleaner's reason as they wrote it
      did: (label: string, reason: string) =>
        `At your clean, our team did more than was quoted: ${label} (${reason}).`,
      approveBy: (amount: string, by: string) =>
        `It comes to ${amount}, tax included, and you only pay it if you approve it. Please approve or decline it by ${by}. If we don't hear from you by then, you won't pay it.`,
      ANSWER: "Approve or decline",
    },
    approved: {
      subject: "Your receipt for a price change",
      thanks: (label: string, amount: string, total: string) =>
        `Thanks for approving ${label}: ${amount}, tax included. The clean now comes to ${total}.`,
    },
    feeTaken: {
      subject: "We've taken the fee for your clean",
      what: (fee: string) => `This is the ${fee} fee for your clean.`,
    },
    corrected: {
      subject: "We've corrected the price of your clean",
      now: (total: string) =>
        `We've corrected the price of your clean. It's now ${total}, tax included.`,
    },
    wentThrough: {
      payment: {
        subject: "Your payment went through",
        what: "Your payment for your clean went through.",
      },
      refund: {
        subject: "Your refund went through",
        what: "Your refund for your clean went through.",
      },
    },
    undone: {
      subject: "A correction to your clean",
      MISTAKE:
        "Your clean was marked done by mistake, so we've put it back as booked.",
    },
    review: {
      subject: "How was your clean?",
      ASK: "Thank you for choosing Empire Cleaning. If you have a minute, we'd love to hear how your clean went in a Google review. It helps your neighbors find us, and tells us what we can do better.",
      LEAVE: "Leave a Google review",
    },
  },
  es: {
    SEE_RECEIPT: "Ver su recibo",
    ON_WEEKLY_BILL: "Va en su factura semanal.",
    charged: (amount: string, card: string) =>
      `Cobramos ${amount} a su ${card}.`,
    stillToPay: (amount: string) => `los ${amount} que faltan por pagar`,
    forClean: (amount: string) => `${amount} por su limpieza`,
    unpaid: {
      subject: "No pudimos cobrar su pago",
      please: (what: string) => `Por favor, ${what}:`,
    },
    receipt: {
      subject: "Su limpieza está terminada: su recibo",
      DONE: "Su limpieza está terminada. Gracias por elegir Empire Cleaning.",
      QUOTED: "Precio cotizado",
      TOTAL: "Total",
      DEPOSIT_KEPT: " (su depósito, conservado)",
      DEPOSIT_PAID: "Depósito pagado",
    },
    proposal: {
      subject: "Por favor, apruebe un cambio de precio en su limpieza",
      reminderSubject:
        "Recordatorio: por favor, apruebe un cambio de precio en su limpieza",
      did: (label: string, reason: string) =>
        `En su limpieza, nuestro equipo hizo más de lo cotizado: ${label} (${reason}).`,
      approveBy: (amount: string, by: string) =>
        oneStop(
          `Son ${amount}, impuestos incluidos, y solo lo paga si lo aprueba. Por favor, apruébelo o recházelo antes del ${by}. Si no sabemos de usted para entonces, no lo pagará.`,
        ),
      ANSWER: "Aprobar o rechazar",
    },
    approved: {
      subject: "Su recibo por un cambio de precio",
      thanks: (label: string, amount: string, total: string) =>
        `Gracias por aprobar ${label}: ${amount}, impuestos incluidos. La limpieza ahora cuesta ${total}.`,
    },
    feeTaken: {
      subject: "Cobramos el cargo de su limpieza",
      what: (fee: string) => `Este es el cargo de ${fee} de su limpieza.`,
    },
    corrected: {
      subject: "Corregimos el precio de su limpieza",
      now: (total: string) =>
        `Corregimos el precio de su limpieza. Ahora es de ${total}, impuestos incluidos.`,
    },
    wentThrough: {
      payment: {
        subject: "Su pago se realizó",
        what: "El pago de su limpieza se realizó.",
      },
      refund: {
        subject: "Su reembolso se realizó",
        what: "El reembolso de su limpieza se realizó.",
      },
    },
    undone: {
      subject: "Una corrección en su limpieza",
      MISTAKE:
        "Su limpieza se marcó como terminada por error, así que la dejamos reservada otra vez.",
    },
    review: {
      subject: "¿Cómo estuvo su limpieza?",
      ASK: "Gracias por elegir Empire Cleaning. Si tiene un minuto, nos encantaría saber cómo le fue con su limpieza en una reseña de Google. Ayuda a sus vecinos a encontrarnos, y nos dice qué podemos hacer mejor.",
      LEAVE: "Dejar una reseña en Google",
    },
  },
});

// what settling moved, as paragraphs for the Client
const moneyLines = (lang: Language, settled: Settled, owedCents: number) => {
  const w = words[lang];
  const { clientFix, notTaken, PLAN_BACK_ON, refundedTo } = messages[lang];
  const { formatMoney } = formats[lang];
  const lines: string[] = [];
  if (settled.billed) {
    lines.push(w.ON_WEEKLY_BILL);
  }
  const card = cardOf(lang, settled.paymentMethod);
  if (settled.chargedCents > 0) {
    lines.push(w.charged(formatMoney(settled.chargedCents), card));
  }
  if (settled.refundedCents > 0) {
    lines.push(refundedTo(formatMoney(settled.refundedCents), card));
  }
  if (settled.failure) {
    lines.push(
      `${notTaken(w.stillToPay(formatMoney(owedCents)), card)} ${clientFix[unpaidKind(settled.failure)]}`,
    );
  }
  // putting it On Hold is told in the Unpaid notice
  if (settled.plan === "resumed") {
    lines.push(PLAN_BACK_ON);
  }
  return lines.map(paragraph);
};

// a Job the Client owes on couldn't be charged, the first time it becomes
// Unpaid
export const unpaidEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    owedCents,
    paymentMethod,
    held,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    owedCents: number;
    paymentMethod: string | null;
    // it put their Service Plan On Hold
    held: boolean;
  },
): Email => {
  const w = words[lang];
  const { notTaken, PLAN_PAUSED, UPDATE_AND_RETRY, UPDATE_CARD } =
    messages[lang];
  return {
    lang,
    subject: w.unpaid.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(
        notTaken(
          w.forClean(formats[lang].formatMoney(owedCents)),
          paymentMethod,
        ),
      ),
      cleanDetails(lang, clean),
      paragraph(w.unpaid.please(UPDATE_AND_RETRY)),
      ...(held ? [paragraph(PLAN_PAUSED)] : []),
      cleanButton(lang, jobId, UPDATE_CARD),
    ],
  };
};

export const receiptEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    quotedCents,
    adjustments,
    totalCents,
    rescheduleFeeCents,
    depositCents,
    owedCents,
    settled,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    quotedCents: number;
    // the Adjustments that count
    adjustments: (Changed & { totalCents: number })[];
    totalCents: number;
    rescheduleFeeCents: number;
    // the Deposit charged when it was booked
    depositCents: number;
    owedCents: number;
    settled: Settled;
  },
): Email => {
  const w = words[lang].receipt;
  const { LATE_MOVE_FEE, PRICES_INCLUDE_TAX } = messages[lang];
  const { formatMoney } = formats[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.DONE),
      cleanDetails(lang, clean),
      amounts(
        lang,
        [
          [w.QUOTED, quotedCents],
          ...adjustments.map((a): [string, number] => [
            changeLabel(lang, a),
            a.totalCents,
          ]),
        ],
        [w.TOTAL, totalCents],
      ),
      ...(rescheduleFeeCents > 0 || depositCents > 0
        ? [
            details([
              ...(rescheduleFeeCents > 0
                ? [
                    {
                      label: `${LATE_MOVE_FEE}${depositCents > 0 ? w.DEPOSIT_KEPT : ""}`,
                      value: formatMoney(rescheduleFeeCents),
                    },
                  ]
                : []),
              ...(depositCents > 0
                ? [{ label: w.DEPOSIT_PAID, value: formatMoney(depositCents) }]
                : []),
            ]),
          ]
        : []),
      ...moneyLines(lang, settled, owedCents),
      paragraph(PRICES_INCLUDE_TAX),
      cleanButton(lang, jobId, words[lang].SEE_RECEIPT),
    ],
  };
};

// an increase the Office proposes, for the Client to approve or decline
export const proposalEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    adjustment,
    reason,
    totalCents,
    answerBy,
    reminder,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    adjustment: Changed;
    // the Cleaner's, e.g. "Heavy grease"
    reason: string;
    totalCents: number;
    answerBy: Date;
    reminder: boolean;
  },
): Email => {
  const w = words[lang].proposal;
  const { formatMoney, formatWhen } = formats[lang];
  return {
    lang,
    subject: reminder ? w.reminderSubject : w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.did(changeLabel(lang, adjustment), reason)),
      cleanDetails(lang, clean),
      paragraph(w.approveBy(formatMoney(totalCents), formatWhen(answerBy))),
      cleanButton(lang, jobId, w.ANSWER),
    ],
  };
};

// the Client approved an increase, and it's charged
export const approvedEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    adjustment,
    amountCents,
    totalCents,
    owedCents,
    settled,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    adjustment: Changed;
    // the increase, tax included
    amountCents: number;
    // the clean's new total
    totalCents: number;
    owedCents: number;
    settled: Settled;
  },
): Email => {
  const w = words[lang].approved;
  const { formatMoney } = formats[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(
        w.thanks(
          changeLabel(lang, adjustment),
          formatMoney(amountCents),
          formatMoney(totalCents),
        ),
      ),
      cleanDetails(lang, clean),
      ...moneyLines(lang, settled, owedCents),
      cleanButton(lang, jobId, words[lang].SEE_RECEIPT),
    ],
  };
};

// the fee for a Job that didn't happen, taken after a correction
export const feeTakenEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    feeCents,
    owedCents,
    settled,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    feeCents: number;
    owedCents: number;
    settled: Settled;
  },
): Email => {
  const w = words[lang].feeTaken;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.what(formats[lang].formatMoney(feeCents))),
      cleanDetails(lang, clean),
      ...moneyLines(lang, settled, owedCents),
      cleanButton(lang, jobId),
    ],
  };
};

export const correctedEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    totalCents,
    owedCents,
    settled,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    totalCents: number;
    owedCents: number;
    settled: Settled;
  },
): Email => {
  const w = words[lang].corrected;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.now(formats[lang].formatMoney(totalCents))),
      cleanDetails(lang, clean),
      ...moneyLines(lang, settled, owedCents),
      cleanButton(lang, jobId, words[lang].SEE_RECEIPT),
    ],
  };
};

// a payment tried again went through: after a new card, or once the payment
// provider could be reached (ADR-0022). Its price didn't change
export const paymentWentThroughEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    owedCents,
    settled,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    owedCents: number;
    settled: Settled;
  },
): Email => {
  const w =
    words[lang].wentThrough[settled.chargedCents > 0 ? "payment" : "refund"];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.what),
      cleanDetails(lang, clean),
      ...moneyLines(lang, settled, owedCents),
      cleanButton(lang, jobId, words[lang].SEE_RECEIPT),
    ],
  };
};

// it was marked done by mistake, and is booked again
export const completionUndoneEmail = (
  lang: Language,
  { name, clean, settled }: { name: string; clean: Clean; settled: Settled },
): Email => {
  const w = words[lang].undone;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.MISTAKE),
      cleanDetails(lang, clean),
      ...moneyLines(lang, settled, 0),
      cleansButton(lang),
    ],
  };
};

// the day after a Client's first Completed Job, once (#175): one link straight
// to Google's write-a-review box. Every Client gets the same email, however
// the clean went: asking only the happy ones, or offering anything for a
// review, is against Google's policy
export const reviewRequestEmail = (
  lang: Language,
  { name, reviewUrl }: { name: string; reviewUrl: string },
): Email => {
  const w = words[lang].review;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.ASK),
      button(w.LEAVE, reviewUrl),
    ],
  };
};
