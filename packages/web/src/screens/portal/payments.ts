import {
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
import type { Hero, Why } from "./HeroCard.tsx";
import { said, saidWith } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    toPay: "To pay",
    billDue: (n: string, day: string) => `Bill ${n} is due by ${day}`,
    andMore: (first: string, n: number) => `${first}, and ${n} more`,
    // one the payment service is trying again, which we see to (ADR-0022)
    billNotYet: (n: string) =>
      `Your payment for bill ${n} hasn't gone through yet`,
    cleanNotYet: (day: string) =>
      `Your payment for your ${day} clean hasn't gone through yet`,
    onPage: "You pay each bill on its page",
    carriesOn: "Once it's paid, your plan carries on from its next date.",
    noCard: "No card saved yet",
    refundOnBill: (n: string) => `Refund on bill ${n}`,
    range: (from: string, to: string) => `${from} – ${to}`,
    planRefund: "Refund of your cleaning plan deposit",
    planDeposit: "Deposit for your cleaning plan",
    towardsLast: "Goes towards your plan's last clean",
    depositFor: (service: string) => `Deposit for ${service}`,
    bookedFor: (day: string) => `Booked for ${day}`,
    priceChange: (item: string) => `Price change: ${item}`,
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
    billNotYet: (n: string) => `El pago de la factura ${n} aún no ha pasado`,
    cleanNotYet: (day: string) =>
      `El pago de su limpieza del ${day} aún no ha pasado`,
    onPage: "Paga cada factura en su página",
    carriesOn: "Cuando esté pagado, su plan continúa desde su próxima fecha.",
    noCard: "Aún no hay tarjeta guardada",
    refundOnBill: (n: string) => `Devolución de la factura ${n}`,
    range: (from: string, to: string) => `${from} – ${to}`,
    planRefund: "Devolución del depósito de su plan de limpieza",
    planDeposit: "Depósito de su plan de limpieza",
    towardsLast: "Se aplica a la última limpieza de su plan",
    depositFor: (service: string) => `Depósito de ${service}`,
    bookedFor: (day: string) => `Reservada para el ${day}`,
    priceChange: (item: string) => `Cambio de precio: ${item}`,
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
  // whether it asks anything of them: not only a clean the payment service
  // is trying again, which we see to ourselves
  asks: boolean;
  // why, the most pressing first
  text: string;
  action: { label: string; href: AppHref };
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
  const { w, billNotPaid, cleanNotPaid, formatShortDay, payBill, shortDayOf } =
    t;
  const owing: Owed[] = [
    // a Bill that couldn't be taken, or is past its due date
    ...data.bills
      .filter((b) => b.unpaid && b.status === "due")
      .map((b) => ({
        cents: b.totalCents,
        // one the payment service is trying again asks nothing yet, and
        // isn't late: it waits on us
        late: asksTheClient(b.unpaid!.kind),
        asks: asksTheClient(b.unpaid!.kind),
        text: asksTheClient(b.unpaid!.kind)
          ? billNotPaid(b.number)
          : w.billNotYet(b.number),
        action: { label: payBill(b.number), href: billLink(b.id) },
      })),
    // a clean, or its fee, that couldn't be charged
    ...data.pastJobs
      .filter((j) => j.unpaid)
      .map((j) => ({
        cents: j.owedCents,
        late: asksTheClient(j.unpaid!),
        asks: asksTheClient(j.unpaid!),
        text: asksTheClient(j.unpaid!)
          ? cleanNotPaid(shortDayOf(j.startsAt))
          : w.cleanNotYet(shortDayOf(j.startsAt)),
        // we try one waiting on the payment service again ourselves
        action: !asksTheClient(j.unpaid!)
          ? {
              label: t.p.seeTheClean,
              href: linkTo({
                to: "/portal/jobs/$jobId",
                params: { jobId: j.id },
              }),
            }
          : { label: t.UPDATE_CARD, href: cardLink },
      })),
    // a Bill to pay on its page, not yet late
    ...data.bills
      .filter(
        (b) =>
          !b.unpaid &&
          b.status === "due" &&
          b.payment === "on_page" &&
          b.totalCents > 0,
      )
      .map((b) => ({
        cents: b.totalCents,
        late: false,
        asks: true,
        text: w.billDue(b.number, formatShortDay(b.dueOn)),
        action: { label: payBill(b.number), href: billLink(b.id) },
      })),
  ];
  // what asks something of them leads (the sort keeps the order otherwise)
  owing.sort((a, b) => Number(b.asks) - Number(a.asks));
  const [first] = owing;
  const owed: Owed | null = first
    ? {
        cents: owing.reduce((sum, o) => sum + o.cents, 0),
        late: owing.some((o) => o.late),
        asks: owing.some((o) => o.asks),
        text:
          owing.length === 1
            ? first.text
            : w.andMore(first.text, owing.length - 1),
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

// what's owed as a Home's answer (AnswerCard): Payments' card, and the
// Client's Home's when it asks something of them. One that's late says
// why above the card (whyAlert); one simply due, in its line. While it
// pauses a cleaning plan, a line says what that means: cleans booked go
// ahead, or, with none booked, it carries on once it's paid
export function owedAnswer(
  owed: Owed,
  lang: Language,
  paused?: { booked: boolean } | false,
): { hero: Hero; why?: Why } {
  const t = saidWith(lang, words);
  const pausedLine = paused
    ? [paused.booked ? t.BOOKED_GO_AHEAD : t.w.carriesOn]
    : [];
  return {
    hero: {
      label: t.w.toPay,
      // money, not a warning: the warning's triangle is a Notice's
      icon: Wallet,
      tone: owed.late ? "danger" : "warning",
      headline: t.formatMoney(owed.cents),
      lines: [...(owed.late ? [] : [owed.text]), ...pausedLine],
      action: owed.action,
    },
    ...(owed.late && { why: { tone: "danger", lead: `${owed.text}.` } }),
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
            title: w.priceChange(p.item),
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
