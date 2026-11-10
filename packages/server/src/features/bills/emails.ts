import {
  cleansButton,
  amounts,
  button,
  details,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";
import {
  addDays,
  catalog,
  type Language,
  type UnpaidKind,
  formats,
  messages,
} from "@empire-cleaning/models";
import type { Settled } from "../completion/balance.ts";
import { cardOf } from "../payments/emails.ts";
import { unpaidKind } from "../payments/unpaid.ts";

// what a Bill's Unpaid did to the Client's Service Plan, or will: paused,
// back on, or paused if it isn't paid by its due date
export type PlanNote = "paused" | "back_on" | "pauses_if_late";

export type Occasion =
  "made" | "unpaid" | "reminder" | "paid" | "voided" | "debit_failed";

// a Bill, as much of it as its email shows
export type BillToSend = {
  id: string;
  // "EC-000012"
  number: string;
  weekStart: string;
  dueOn: string;
  payment: "automatic" | "on_page";
  status: string;
  // why it's Unpaid, if it is
  unpaid: UnpaidKind | null;
  paidVia: string | null;
  // the Office's, as they wrote it
  voidReason: string | null;
  totalCents: number;
  taxCents: number;
  lines: { label: string; amountCents: number }[];
};

// what a Bill email says, each subject first and then its opening
// paragraphs, in each language
const words = catalog({
  en: {
    // a Bill's subject: "Your bill EC-000012 from Empire Cleaning"
    yourBill: (number: string) => `Your bill ${number} from Empire Cleaning`,
    waiting: (total: string, card: string) =>
      `Here's your bill for the week: ${total}. We'll take it from your ${card} shortly.`,
    // what's owed, as "We couldn't take …" says it
    forBill: (total: string, number: string) => `${total} for bill ${number}`,
    payOnPage: (retry: string) => `Please ${retry}, or pay it on its page.`,
    creditSubject: (number: string) => `Your bill ${number}: a credit`,
    credit: (amount: string, days: number) =>
      `This week's bill comes to a credit of ${amount}, which comes off your next one. If none follows within ${days} days, we'll refund it.`,
    nothingSubject: (number: string) => `Your bill ${number}`,
    NOTHING: "There's nothing to pay this week.",
    receiptSubject: (number: string) => `Your receipt for bill ${number}`,
    charged: (total: string, card: string) =>
      `Here's your bill for the week. We've charged ${total} to your ${card}.`,
    due: (total: string, by: string) =>
      `Here's your bill for the week: ${total}, due by ${by}. You can pay it by card or bank transfer on its page.`,
    dueOnSubject: (number: string, by: string) => `Bill ${number} is due ${by}`,
    remindDueOn: (number: string, total: string, by: string) =>
      `A reminder that bill ${number}, ${total}, is due by ${by}. You can pay it by card or bank transfer on its page.`,
    dueTodaySubject: (number: string) => `Bill ${number} is due today`,
    remindDueToday: (number: string, total: string) =>
      `A reminder that bill ${number}, ${total}, is due today. You can pay it by card or bank transfer on its page.`,
    overdueSubject: (number: string) => `Bill ${number} is overdue`,
    overdue: (number: string, total: string, by: string) =>
      `Bill ${number}, ${total}, was due by ${by} and hasn't been paid yet. Please pay it on its page, by card or bank transfer.`,
    received: (total: string, number: string) =>
      `We've received your payment of ${total} for bill ${number}. Thank you.`,
    paid: (number: string, total: string) =>
      `Thank you: bill ${number} is paid, ${total}.`,
    voidedSubject: (number: string) => `Bill ${number} is cancelled`,
    voided: (number: string) =>
      `We've cancelled bill ${number}, so there's nothing to pay on it.`,
    OWED_NEXT_BILL:
      "Anything on it that's still owed will be on your next bill.",
    OWED_PER_CLEAN:
      "Anything on it that's still owed is charged to your card per clean, as before.",
    debitFailedSubject: (number: string) =>
      `Your bank payment for bill ${number} didn't go through`,
    debitFailed: (total: string, number: string) =>
      `Your bank payment of ${total} for bill ${number} didn't go through. Please pay it again on its page, by card or from another account.`,
    INSTEAD: "Here's what we've done about each clean on it instead:",
    PAUSES_IF_LATE:
      "If it isn't paid by then, your cleaning plan is paused until it is.",
    // the Bill's details and amounts
    BILL: "Bill",
    WEEK: "Week",
    week: (from: string, to: string) => `${from} to ${to}`,
    DUE_BY: "Due by",
    TOTAL: "Total",
    taxIn: (tax: string) => `Prices include tax: ${tax} of the total.`,
    SEE_BILL: "See your bill",
    // a Job, as its Bill's lines name it
    jobAt: (service: string, address: string, when: string) =>
      `${service} at ${address}, ${when}`,
    // what settling a Job moved
    chargedCents: (amount: string) => `charged ${amount}`,
    refundedCents: (amount: string) => `refunded ${amount}`,
    couldntTake: (amount: string) => `couldn't take ${amount}`,
    takenAndRefunded: (card: string) =>
      `Payments are taken from your ${card}, and refunds go back to it.`,
    taken: (card: string) => `Payments are taken from your ${card}.`,
    refundsTo: (card: string) => `Refunds go back to your ${card}.`,
    REFUND_DAYS: "A refund can take a few days to reach you.",
    // "We couldn't take payment …"
    PAYMENT: "payment",
    perClean: {
      unpaidSubject: "We couldn't take payment for your cleans",
      subject: "You're now charged per clean",
      STOPPED:
        "We've stopped billing you weekly, so from now on each clean is charged to your card when it's done. Bills already sent still need paying as before.",
      SETTLED: "Here's what we've settled for cleans no bill has covered yet:",
    },
    creditRefunded: {
      subject: (number: string) =>
        `We've refunded your credit from bill ${number}`,
      what: (number: string, days: number, amount: string) =>
        `No bill has followed bill ${number} in ${days} days, so we've refunded its ${amount} credit to you.`,
      SEE: "See the bill",
    },
  },
  es: {
    yourBill: (number: string) => `Su factura ${number} de Empire Cleaning`,
    waiting: (total: string, card: string) =>
      `Esta es su factura de la semana: ${total}. La cobraremos a su ${card} en breve.`,
    forBill: (total: string, number: string) =>
      `${total} de la factura ${number}`,
    payOnPage: (retry: string) =>
      `Por favor, ${retry}, o páguela en su página.`,
    creditSubject: (number: string) => `Su factura ${number}: un crédito`,
    credit: (amount: string, days: number) =>
      `La factura de esta semana queda en un crédito de ${amount}, que se descuenta de la próxima. Si no llega otra en ${days} días, se lo reembolsaremos.`,
    nothingSubject: (number: string) => `Su factura ${number}`,
    NOTHING: "Esta semana no hay nada que pagar.",
    receiptSubject: (number: string) => `Su recibo de la factura ${number}`,
    charged: (total: string, card: string) =>
      `Esta es su factura de la semana. Cobramos ${total} a su ${card}.`,
    due: (total: string, by: string) =>
      `Esta es su factura de la semana: ${total}, a pagar antes del ${by}. Puede pagarla con tarjeta o transferencia bancaria en su página.`,
    dueOnSubject: (number: string, by: string) =>
      `La factura ${number} vence el ${by}`,
    remindDueOn: (number: string, total: string, by: string) =>
      `Le recordamos que la factura ${number}, de ${total}, vence el ${by}. Puede pagarla con tarjeta o transferencia bancaria en su página.`,
    dueTodaySubject: (number: string) => `La factura ${number} vence hoy`,
    remindDueToday: (number: string, total: string) =>
      `Le recordamos que la factura ${number}, de ${total}, vence hoy. Puede pagarla con tarjeta o transferencia bancaria en su página.`,
    overdueSubject: (number: string) => `La factura ${number} está vencida`,
    overdue: (number: string, total: string, by: string) =>
      `La factura ${number}, de ${total}, vencía el ${by} y todavía no se ha pagado. Por favor, páguela en su página, con tarjeta o transferencia bancaria.`,
    received: (total: string, number: string) =>
      `Recibimos su pago de ${total} de la factura ${number}. Gracias.`,
    paid: (number: string, total: string) =>
      `Gracias: la factura ${number} está pagada, ${total}.`,
    voidedSubject: (number: string) => `La factura ${number} está cancelada`,
    voided: (number: string) =>
      `Cancelamos la factura ${number}, así que no hay nada que pagar en ella.`,
    OWED_NEXT_BILL: "Lo que todavía se deba de ella irá en su próxima factura.",
    OWED_PER_CLEAN:
      "Lo que todavía se deba de ella se cobra a su tarjeta por cada limpieza, como antes.",
    debitFailedSubject: (number: string) =>
      `Su pago bancario de la factura ${number} no se realizó`,
    debitFailed: (total: string, number: string) =>
      `Su pago bancario de ${total} de la factura ${number} no se realizó. Por favor, páguela otra vez en su página, con tarjeta o desde otra cuenta.`,
    INSTEAD:
      "Esto es lo que hicimos en cambio con cada limpieza de la factura:",
    PAUSES_IF_LATE:
      "Si no se paga para entonces, su plan de limpieza queda en pausa hasta que se pague.",
    BILL: "Factura",
    WEEK: "Semana",
    week: (from: string, to: string) => `Del ${from} al ${to}`,
    DUE_BY: "Vence",
    TOTAL: "Total",
    taxIn: (tax: string) => `Los precios incluyen impuestos: ${tax} del total.`,
    SEE_BILL: "Ver su factura",
    jobAt: (service: string, address: string, when: string) =>
      `${service} en ${address}, ${when}`,
    chargedCents: (amount: string) => `se cobraron ${amount}`,
    refundedCents: (amount: string) => `se reembolsaron ${amount}`,
    couldntTake: (amount: string) => `no se pudieron cobrar ${amount}`,
    takenAndRefunded: (card: string) =>
      `Los pagos se cobran a su ${card}, y los reembolsos vuelven a ella.`,
    taken: (card: string) => `Los pagos se cobran a su ${card}.`,
    refundsTo: (card: string) => `Los reembolsos vuelven a su ${card}.`,
    REFUND_DAYS: "Un reembolso puede tardar unos días en llegarle.",
    PAYMENT: "el pago",
    perClean: {
      unpaidSubject: "No pudimos cobrar el pago de sus limpiezas",
      subject: "Ahora se le cobra por cada limpieza",
      STOPPED:
        "Dejamos de facturarle cada semana, así que a partir de ahora cada limpieza se cobra a su tarjeta cuando está terminada. Las facturas ya enviadas se siguen pagando como antes.",
      SETTLED:
        "Esto es lo que cobramos o reembolsamos por las limpiezas que ninguna factura incluía todavía:",
    },
    creditRefunded: {
      subject: (number: string) =>
        `Le reembolsamos su crédito de la factura ${number}`,
      what: (number: string, days: number, amount: string) =>
        `No llegó ninguna factura después de la factura ${number} en ${days} días, así que le reembolsamos su crédito de ${amount}.`,
      SEE: "Ver la factura",
    },
  },
});

// why the Bill is sent, as its subject and what it says first
const aboutBill = (
  lang: Language,
  bill: BillToSend,
  occasion: Occasion,
  {
    card,
    today,
    billedWeekly,
    creditRefundDays,
  }: {
    card: string;
    today: string;
    billedWeekly: boolean;
    creditRefundDays: number;
  },
): string[] => {
  const w = words[lang];
  const { billNotPaid, notTaken, UPDATE_AND_RETRY } = messages[lang];
  const { formatLongDay, formatMoney } = formats[lang];
  const { number } = bill;
  const total = formatMoney(bill.totalCents);
  const dueOn = formatLongDay(bill.dueOn);
  switch (occasion) {
    // declined on a later try, after the provider kept us waiting: said as
    // a Bill just made and declined is
    case "unpaid":
    case "made":
      // we try again ourselves, so they're only told the Bill
      if (bill.unpaid === "waiting") {
        return [w.yourBill(number), w.waiting(total, card)];
      }
      if (bill.unpaid) {
        return [
          billNotPaid(number),
          `${notTaken(w.forBill(total, number), card)} ${w.payOnPage(UPDATE_AND_RETRY)}`,
        ];
      }
      if (bill.totalCents < 0) {
        return [
          w.creditSubject(number),
          w.credit(formatMoney(-bill.totalCents), creditRefundDays),
        ];
      }
      if (bill.totalCents === 0) {
        return [w.nothingSubject(number), w.NOTHING];
      }
      return bill.status === "paid"
        ? [w.receiptSubject(number), w.charged(total, card)]
        : [w.yourBill(number), w.due(total, dueOn)];
    case "reminder":
      if (today < bill.dueOn) {
        return [
          w.dueOnSubject(number, dueOn),
          w.remindDueOn(number, total, dueOn),
        ];
      }
      if (today === bill.dueOn) {
        return [w.dueTodaySubject(number), w.remindDueToday(number, total)];
      }
      return [w.overdueSubject(number), w.overdue(number, total, dueOn)];
    case "paid":
      return [
        w.receiptSubject(number),
        bill.paidVia === "outside"
          ? w.received(total, number)
          : w.paid(number, total),
      ];
    case "voided":
      return [
        w.voidedSubject(number),
        `${w.voided(number)}${bill.voidReason ? ` ${bill.voidReason}` : ""}`,
        billedWeekly ? w.OWED_NEXT_BILL : w.OWED_PER_CLEAN,
      ];
    case "debit_failed":
      return [w.debitFailedSubject(number), w.debitFailed(total, number)];
  }
};

// what the Bill did to their Service Plan, or will
const planNoteOf = (lang: Language, note: PlanNote) => {
  const { BOOKED_GO_AHEAD, PLAN_BACK_ON, PLAN_PAUSED } = messages[lang];
  const notes: Record<PlanNote, string> = {
    paused: PLAN_PAUSED,
    back_on: PLAN_BACK_ON,
    pauses_if_late: `${words[lang].PAUSES_IF_LATE} ${BOOKED_GO_AHEAD}`,
  };
  return notes[note];
};

// The whole Bill: its number, week, due date, each line, tax and total, with
// why it's sent (and what it did to their plan, or the Jobs a voided one
// settled) and a link to it in the portal
export const billEmail = (
  lang: Language,
  {
    name,
    bill,
    occasion,
    plan = null,
    settled = [],
    card,
    ...context
  }: {
    name: string;
    bill: BillToSend;
    occasion: Occasion;
    // what it did to their Service Plan
    plan?: PlanNote | null;
    // a voided Bill's Jobs, settled each on its own instead
    settled?: SettledJob[];
    // their Payment Method's label; null when none is saved
    card: string | null;
    today: string;
    // they're billed weekly still
    billedWeekly: boolean;
    creditRefundDays: number;
  },
): Email => {
  const w = words[lang];
  const { formatLongDay, formatMoney } = formats[lang];
  const [subject, ...about] = aboutBill(lang, bill, occasion, {
    ...context,
    card: cardOf(lang, card),
  });
  const extra = [
    ...(settled.length > 0 ? [w.INSTEAD, ...settledLines(lang, settled)] : []),
    ...(plan ? [planNoteOf(lang, plan)] : []),
  ];
  return {
    lang,
    subject: subject!,
    blocks: [
      greeting(firstNameOf(name)),
      ...[...about, ...extra].map(paragraph),
      details([
        { label: w.BILL, value: bill.number },
        {
          label: w.WEEK,
          value: w.week(
            formatLongDay(bill.weekStart),
            formatLongDay(addDays(bill.weekStart, 6)),
          ),
        },
        ...(bill.payment === "on_page" && bill.totalCents > 0
          ? [{ label: w.DUE_BY, value: formatLongDay(bill.dueOn) }]
          : []),
      ]),
      // its lines as the Bill keeps them, English until #395
      amounts(
        lang,
        bill.lines.map((l): [string, number] => [l.label, l.amountCents]),
        [w.TOTAL, bill.totalCents],
      ),
      paragraph(w.taxIn(formatMoney(bill.taxCents))),
      button(w.SEE_BILL, `/portal/bills/${bill.id}`),
    ],
  };
};

// a Job a Bill no longer takes, settled on its own
export type SettledJob = {
  jobId: string;
  clean: Clean;
  // a fee for a clean that didn't happen, named for why
  fee: "cancelled" | "no_access" | null;
  settled: Settled;
  // what its failed Charge left owing
  unpaidCents: number | null;
};

// a Job, as its lines on a Bill name it, and a fee for one that didn't
// happen: "Deep Clean at 41-12 Austin St, 4B, 11375, Monday, January 12 at
// 9:00 AM". The Office's, and a Bill's lines (#395), in English
export const jobNamed = (
  lang: Language,
  { clean, fee }: { clean: Clean; fee: SettledJob["fee"] },
) => {
  const what = words[lang].jobAt(
    clean.service,
    clean.address,
    formats[lang].formatWhen(clean.startsAt),
  );
  return fee ? `${messages[lang].feeName[fee]}: ${what}` : what;
};

// What settling per Job moved, as lines for the Client: each Job with what
// was charged, refunded or couldn't be, then what to do about one that
// couldn't, and what that did to their Service Plan
const settledLines = (lang: Language, settled: SettledJob[]) => {
  const w = words[lang];
  const { clientFix, notTaken, PLAN_BACK_ON, PLAN_PAUSED } = messages[lang];
  const { formatMoney } = formats[lang];
  const card = cardOf(lang, settled[0]?.settled.paymentMethod ?? null);
  const lines = [
    settled
      .map((s) => {
        const moved = [
          ...(s.settled.chargedCents > 0
            ? [w.chargedCents(formatMoney(s.settled.chargedCents))]
            : []),
          ...(s.settled.refundedCents > 0
            ? [w.refundedCents(formatMoney(s.settled.refundedCents))]
            : []),
          ...(s.unpaidCents !== null
            ? [w.couldntTake(formatMoney(s.unpaidCents))]
            : []),
        ];
        return `${jobNamed(lang, s)}: ${moved.join(", ")}`;
      })
      .join("\n"),
  ];
  const charged = settled.some((s) => s.settled.chargedCents > 0);
  const refunded = settled.some((s) => s.settled.refundedCents > 0);
  if (charged || refunded) {
    const what =
      charged && refunded
        ? w.takenAndRefunded(card)
        : charged
          ? w.taken(card)
          : w.refundsTo(card);
    lines.push(`${what}${refunded ? ` ${w.REFUND_DAYS}` : ""}`);
  }
  const failed = settled.find((s) => s.settled.failure);
  if (failed) {
    lines.push(
      `${notTaken(w.PAYMENT, card)} ${clientFix[unpaidKind(failed.settled.failure!)]}`,
    );
  }
  if (settled.some((s) => s.settled.plan === "held")) {
    lines.push(PLAN_PAUSED);
  } else if (settled.some((s) => s.settled.plan === "resumed")) {
    lines.push(PLAN_BACK_ON);
  }
  return lines;
};

// they're charged per clean again, and what that charged for what no Bill had
// taken yet
export const chargedPerCleanEmail = (
  lang: Language,
  { name, settled }: { name: string; settled: SettledJob[] },
): Email => {
  const w = words[lang].perClean;
  const { PRICES_INCLUDE_TAX, UPDATE_CARD } = messages[lang];
  const unpaid = settled.some((s) => s.unpaidCents !== null);
  return {
    lang,
    subject: unpaid ? w.unpaidSubject : w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      ...[
        w.STOPPED,
        w.SETTLED,
        ...settledLines(lang, settled),
        PRICES_INCLUDE_TAX,
      ].map(paragraph),
      // a card puts it right, unless we're trying again ourselves
      unpaid &&
      settled.some(
        (s) => s.settled.failure && unpaidKind(s.settled.failure) !== "waiting",
      )
        ? button(UPDATE_CARD, "/portal/payment-method")
        : cleansButton(lang),
    ],
  };
};

export const creditRefundedEmail = (
  lang: Language,
  {
    name,
    billId,
    number,
    cents,
    creditRefundDays,
  }: {
    name: string;
    billId: string;
    number: string;
    cents: number;
    creditRefundDays: number;
  },
): Email => {
  const w = words[lang].creditRefunded;
  return {
    lang,
    subject: w.subject(number),
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(
        `${w.what(number, creditRefundDays, formats[lang].formatMoney(cents))} ${messages[lang].REFUND_TAKES_DAYS}`,
      ),
      button(w.SEE, `/portal/bills/${billId}`),
    ],
  };
};
