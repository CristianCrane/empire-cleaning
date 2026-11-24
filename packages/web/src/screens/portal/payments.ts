import {
  because,
  asksTheClient,
  type BillSummary,
  type ClientPastJob,
  type ClientPayment,
  type PaymentMethodView,
  type ServicePlanSummary,
  catalog,
  type Language,
} from "@empire-cleaning/models";
import { CreditCard, Wallet } from "lucide-react";
import { linkTo, type AppHref } from "../../links.ts";
import { pausedPlans } from "../format.ts";
import type { Hero, Why } from "./HeroCard.tsx";
import { said, saidWith } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    toPay: "To pay",
    billDue: (n: string, day: string) => `Bill ${n} is due by ${day}`,
    andMore: (first: string, n: number) => `${first}, and ${n} more`,
    // their last payment on a Bill's page, for a sentence to end (#534)
    failedFor: (n: string, why: string | null) =>
      `Your payment for bill ${n} didn't go through${because(why)}`,
    failedMany: (n: number) => `Payments for ${n} bills didn't go through`,
    billsUnpaid: (n: number) =>
      `${n} bills aren't paid yet. Each one's page says why`,
    onPage: "You pay each bill on its page",
    noCard: "No card saved yet",
    refundOnBill: (n: string) => `Refund on bill ${n}`,
    range: (from: string, to: string) => `${from} – ${to}`,
    planRefund: "Refund of your cleaning plan deposit",
    planDeposit: "Deposit for your cleaning plan",
    towardsLast: "Goes towards your plan's last clean",
    depositFor: (service: string) => `Deposit for ${service}`,
    bookedFor: (day: string) => `Booked for ${day}`,
    approvedAfter: (day: string, service: string) =>
      `Approved after your ${day} ${service}`,
    priceChangeOn: (service: string) => `Price change on ${service}`,
    approvedAfterClean: (day: string) => `Approved after your ${day} clean`,
    serviceDay: (service: string, day: string) => `${service}, ${day}`,
    refund: (item: string) => `Refund: ${item}`,
    fromYour: (day: string, service: string) => `From your ${day} ${service}`,
    refundOn: (service: string) => `Refund on ${service}`,
    fromYourClean: (day: string) => `From your ${day} clean`,
  },
  es: {
    toPay: "Por pagar",
    billDue: (n: string, day: string) => `La factura ${n} vence el ${day}`,
    andMore: (first: string, n: number) => `${first}, y ${n} más`,
    failedFor: (n: string, why: string | null) =>
      `Su pago de la factura ${n} no pasó${because(why)}`,
    failedMany: (n: number) => `No pasaron los pagos de ${n} facturas`,
    billsUnpaid: (n: number) =>
      `${n} facturas aún no están pagadas. La página de cada una dice por qué`,
    onPage: "Paga cada factura en su página",
    noCard: "Aún no hay tarjeta guardada",
    refundOnBill: (n: string) => `Devolución de la factura ${n}`,
    range: (from: string, to: string) => `${from} – ${to}`,
    planRefund: "Devolución del depósito de su plan de limpieza",
    planDeposit: "Depósito de su plan de limpieza",
    towardsLast: "Se aplica a la última limpieza de su plan",
    depositFor: (service: string) => `Depósito de ${service}`,
    bookedFor: (day: string) => `Reservada para el ${day}`,
    approvedAfter: (day: string, service: string) =>
      `Aprobado después de su ${service} del ${day}`,
    priceChangeOn: (service: string) => `Cambio de precio en ${service}`,
    approvedAfterClean: (day: string) =>
      `Aprobado después de su limpieza del ${day}`,
    serviceDay: (service: string, day: string) => `${service}, ${day}`,
    refund: (item: string) => `Devolución: ${item}`,
    fromYour: (day: string, service: string) => `De su ${service} del ${day}`,
    refundOn: (service: string) => `Devolución de ${service}`,
    fromYourClean: (day: string) => `De su limpieza del ${day}`,
  },
});

// The Client's Payments page: one card saying what they owe now, or that
// it's nothing, and every payment between us behind a tile. Their Home
// leads with the same card when it asks something of them. (UX pass, #96;
// #435)

export type PaymentsData = {
  // a paused one is said under what's owed (owedAnswer)
  plans: ServicePlanSummary[];
  pastJobs: ClientPastJob[];
  bills: BillSummary[];
  paymentMethod: PaymentMethodView | null;
};

type Owed = {
  cents: number;
  // something failed or is past its due date, not just waiting on them
  late: boolean;
  // whether it asks anything of them: false for a payment we try again
  // ourselves (a Bill's or a clean's), which waits on us, and the card
  // says so calmly (owedAnswer)
  asks: boolean;
  // the card's line: what's owed and by when, or, for one pending, what
  // it's for (the card's label says it's pending); null when its alert says
  // why instead, as one is past its due date or couldn't be taken
  line: string | null;
  // the alert above the card: what went wrong, as a sentence; null when
  // nothing did
  why: string | null;
  action: { label: string; href: AppHref };
};

// one thing owed, as the card is made of it: its line, or its news (what
// went wrong, for a sentence to end), or both, while a Bill their last
// payment on didn't go through is still before its due date (`failed`)
type Owing = {
  cents: number;
  late: boolean;
  asks: boolean;
  line?: string;
  news?: string;
  failed?: boolean;
  // its news when its line already names the Bill, as the card's alone
  // (#534's UX review U6)
  alone?: string;
  bill?: boolean;
  action: Owed["action"];
};

export type MoneyNow = {
  // null when nothing is owed
  owed: Owed | null;
  // how they pay: the card on file, or why there's none (Your card's hint)
  paying: string;
  // a Bill's bank debit on its way, to say so
  clearing: BillSummary[];
};

const cardLink = linkTo({ to: "/portal/payment-method" });
const billLink = (billId: string) =>
  linkTo({ to: "/portal/bills/$billId", params: { billId } });

// "Oct 22", New York's day

export function moneyNow(data: PaymentsData, lang: Language): MoneyNow {
  const t = saidWith(lang, words);
  const {
    w,
    billNotPaid,
    cleanNotPaid,
    formatShortDay,
    payBill,
    payingFailed,
    shortDayOf,
  } = t;
  const failedFor = (b: BillSummary) =>
    b.paying?.status === "failed" ? w.failedFor(b.number, b.paying.why) : null;
  const owing: Owing[] = [
    // a Bill that couldn't be taken, or is past its due date: its alert
    // says which, its last payment on its page first when that didn't go
    // through
    ...data.bills
      .filter((b) => b.unpaid && b.status === "due")
      .map((b): Owing => {
        const asks = asksTheClient(b.unpaid!.kind);
        return {
          cents: b.totalCents,
          // one the payment service is trying again asks nothing yet, and
          // isn't late: it waits on us
          late: asks,
          asks,
          bill: true,
          ...(asks
            ? {
                news: failedFor(b) ?? billNotPaid(b.number),
                failed: !!failedFor(b),
              }
            : { line: t.p.bill(b.number) }),
          // nothing to pay on its page while it's ours (#533)
          action: {
            label: asks ? payBill(b.number) : t.p.seeTheBill,
            href: billLink(b.id),
          },
        };
      }),
    // a clean, or its fee, that couldn't be charged
    ...data.pastJobs
      .filter((j) => j.unpaid)
      .map((j): Owing => {
        const asks = asksTheClient(j.unpaid!);
        return {
          cents: j.owedCents,
          late: asks,
          asks,
          ...(asks
            ? { news: cleanNotPaid(shortDayOf(j.startsAt)) }
            : { line: t.p.yourClean(shortDayOf(j.startsAt)) }),
          // we try one waiting on the payment service again ourselves
          action: !asks
            ? {
                label: t.p.seeTheClean,
                href: linkTo({
                  to: "/portal/jobs/$jobId",
                  params: { jobId: j.id },
                }),
              }
            : { label: t.UPDATE_CARD, href: cardLink },
        };
      }),
    // a Bill to pay on its page, not yet late: when by in its line, and,
    // when their last payment on it didn't go through, that in the alert
    ...data.bills
      .filter(
        (b) =>
          !b.unpaid &&
          b.status === "due" &&
          b.payment === "on_page" &&
          b.totalCents > 0,
      )
      // the one that didn't go through first, as it's what's news
      .sort((a, b) => Number(!!failedFor(b)) - Number(!!failedFor(a)))
      .map((b): Owing => ({
        cents: b.totalCents,
        late: !!failedFor(b),
        asks: true,
        bill: true,
        line: w.billDue(b.number, formatShortDay(b.dueOn)),
        ...(b.paying?.status === "failed" && {
          news: failedFor(b)!,
          alone: payingFailed(b.paying.why),
          failed: true,
        }),
        action: { label: payBill(b.number), href: billLink(b.id) },
      })),
  ];
  // what asks something of them leads (the sort keeps the order otherwise)
  owing.sort((a, b) => Number(b.asks) - Number(a.asks));
  const [first] = owing;
  // the card is the one that leads, and what's like it: one we try again
  // ourselves isn't added to what asks to be paid, as it can't be (#533)
  const alike = owing.filter((o) => o.asks === first?.asks);
  const line =
    first?.line && alike.every((o) => o.line)
      ? alike.length === 1
        ? first.line
        : w.andMore(first.line, alike.length - 1)
      : null;
  const owed: Owed | null = first
    ? {
        cents: alike.reduce((sum, o) => sum + o.cents, 0),
        late: alike.some((o) => o.late),
        asks: first.asks,
        line,
        why: whyOf(alike, line !== null, w),
        action: first.action,
      }
    : null;

  // weekly Bills paid on their page need no card
  const onPage = data.bills[0]?.payment === "on_page";
  const paying = data.paymentMethod
    ? data.paymentMethod.label
    : onPage
      ? w.onPage
      : w.noCard;

  return {
    owed,
    paying,
    clearing: data.bills.filter((b) => b.status === "processing"),
  };
}

// the alert above the card, one for all that's owed (the app shows two
// alerts at most): what went wrong with each, as few words as say it, the
// late first, as the card's action is for it; each Bill's page says the
// rest. While the card's line says what's owed and by when, only what
// didn't go through is news. Null when nothing went wrong
function whyOf(
  alike: Owing[],
  lineShown: boolean,
  w: (typeof words)["en"],
): string | null {
  const failed = alike.filter((o) => o.failed);
  const news = alike.filter((o) => o.news);
  const sentence = (() => {
    if (news.length === 0) return null;
    if (lineShown || failed.length === alike.length) {
      if (failed.length > 1) return w.failedMany(failed.length);
      // the card's line names the one Bill, so its alert needn't
      return (
        (lineShown && alike.length === 1 && failed[0]!.alone) ||
        failed[0]!.news!
      );
    }
    if (alike.length === 1) return alike[0]!.news!;
    if (alike.length === 2 && news.length === 2 && failed.length === 1) {
      const other = news.find((o) => !o.failed)!;
      return `${other.news}. ${failed[0]!.news}`;
    }
    if (alike.length >= 3 && alike.every((o) => o.bill)) {
      return w.billsUnpaid(alike.length);
    }
    const [lead] = alike;
    return w.andMore(lead!.news ?? lead!.line!, alike.length - 1);
  })();
  return sentence && `${sentence}.`;
}

// a Client's plan as the owed card reads it: paused or not
type PlanNow = Pick<ServicePlanSummary, "status">;

// what a paused cleaning plan means, under what's owed: no more cleans
// booked until it's paid (or, asking nothing, until it goes through);
// nothing while no plan is paused. The Bill's alert and the plan's say it
// in the same words (noMoreCleans)
export function pausedLine(
  plans: PlanNow[],
  lang: Language,
  asks: boolean,
): string[] {
  const t = saidWith(lang, words);
  return pausedPlans(plans).length > 0 ? [t.noMoreCleans(asks)] : [];
}

// what's owed as a Home's answer (AnswerCard): Payments' card, and the
// Client's Home's when it asks something of them. What went wrong says
// itself above the card (whyAlert); what's simply due, and by when, in its
// line, kept while a payment on it didn't go through before then. One that
// asks nothing, a payment we try again ourselves, is calm: Payment
// pending, one short line, what it's for and that there's nothing to do,
// and a way to see it rather than a primary (#493, #536). Either says a
// paused plan in a line (pausedLine), as a clean's page doesn't say it
export function owedAnswer(
  owed: Owed,
  lang: Language,
  plans: PlanNow[],
): { hero: Hero; why?: Why } {
  const t = saidWith(lang, words);
  if (!owed.asks) {
    return {
      hero: {
        label: t.paymentPending,
        icon: Wallet,
        tone: "info",
        headline: t.formatMoney(owed.cents),
        lines: [
          owed.line ? `${owed.line} · ${t.NOTHING_TO_DO}` : t.NOTHING_TO_DO,
          ...pausedLine(plans, lang, false),
        ],
        action: { ...owed.action, secondary: true },
      },
    };
  }
  return {
    hero: {
      label: t.w.toPay,
      // money, not a warning: the warning's triangle is a Notice's
      icon: Wallet,
      tone: owed.late ? "danger" : "warning",
      headline: t.formatMoney(owed.cents),
      lines: [
        ...(owed.line ? [owed.line] : []),
        ...pausedLine(plans, lang, true),
      ],
      action: owed.action,
    },
    ...(owed.why && { why: { tone: "danger", lead: owed.why } }),
  };
}

// how they pay, as a Home's tile: the card on file, or why there's none
export const yourCardTile = (money: MoneyNow, lang: Language) => ({
  id: "card",
  icon: CreditCard,
  label: said[lang].p.yourCard,
  hint: money.paying,
  href: cardLink,
});

export type PaymentRow = {
  title: string;
  // which clean or week it was for, when its own date doesn't say
  line?: string;
  href: AppHref | null;
};

// how one payment reads in the history: what it was for first
export function paymentRow(p: ClientPayment, lang: Language): PaymentRow {
  const {
    w,
    p: portal,
    feeName,
    formatShortDay,
    shortDayOf,
  } = saidWith(lang, words);
  const day = shortDayOf(p.at);
  const cleanDay = p.job ? shortDayOf(p.job.startsAt) : null;
  // the clean's day, only when it isn't the payment's own
  const otherDay = cleanDay !== day ? cleanDay : null;

  if (p.bill) {
    return {
      title:
        p.kind === "refund"
          ? w.refundOnBill(p.bill.number)
          : portal.bill(p.bill.number),
      line: w.range(
        formatShortDay(p.bill.weekStart),
        formatShortDay(p.bill.weekEnd),
      ),
      href: billLink(p.bill.id),
    };
  }
  if (p.servicePlanId) {
    const href = linkTo({
      to: "/portal/plans/$planId",
      params: { planId: p.servicePlanId },
    });
    return p.kind === "refund"
      ? { title: w.planRefund, href }
      : {
          title: w.planDeposit,
          line: w.towardsLast,
          href,
        };
  }
  const job = p.job!;
  const href = linkTo({ to: "/portal/jobs/$jobId", params: { jobId: job.id } });
  switch (p.kind) {
    case "deposit":
      return {
        title: w.depositFor(job.serviceName),
        line: w.bookedFor(cleanDay!),
        href,
      };
    case "adjustment":
      return p.item
        ? {
            title: portal.priceChange(p.item),
            line: w.approvedAfter(cleanDay!, job.serviceName),
            href,
          }
        : {
            title: w.priceChangeOn(job.serviceName),
            line: w.approvedAfterClean(cleanDay!),
            href,
          };
    case "fee":
      return {
        title:
          job.status === "no_access" ? feeName.no_access : feeName.cancelled,
        line: w.serviceDay(job.serviceName, cleanDay!),
        href,
      };
    case "refund":
      return p.item
        ? {
            title: w.refund(p.item),
            line: w.fromYour(cleanDay!, job.serviceName),
            href,
          }
        : {
            title: w.refundOn(job.serviceName),
            line: otherDay ? w.fromYourClean(otherDay) : undefined,
            href,
          };
    default:
      return {
        title: job.serviceName,
        line: otherDay ? portal.yourClean(otherDay) : undefined,
        href,
      };
  }
}

// "−$22.50" for money back
export const signedMoney = (lang: Language, cents: number) => {
  const { formatMoney } = said[lang];
  return cents < 0 ? `−${formatMoney(-cents)}` : formatMoney(cents);
};
