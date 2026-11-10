import {
  type BillSummary,
  type ClientPastJob,
  type ClientPayment,
  type PaymentMethodView,
  catalog,
  type Language,
} from "@empire-cleaning/models";
import { linkTo, type AppHref } from "../../links.ts";
import { said, saidWith } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    billDue: (n: string, day: string) => `Bill ${n} is due by ${day}`,
    andMore: (first: string, n: number) => `${first}, and ${n} more`,
    payingWith: (card: string) => `Paying with ${card}`,
    onPage: "You pay each bill on its page",
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
    billDue: (n: string, day: string) => `La factura ${n} vence el ${day}`,
    andMore: (first: string, n: number) => `${first}, y ${n} más`,
    payingWith: (card: string) => `Paga con ${card}`,
    onPage: "Paga cada factura en su página",
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
// it's nothing, and every payment between us after it. (UX pass, #96)

export type PaymentsData = {
  pastJobs: ClientPastJob[];
  bills: BillSummary[];
  paymentMethod: PaymentMethodView | null;
};

type Owed = {
  cents: number;
  // something failed or is past its due date, not just waiting on them
  late: boolean;
  // why, the most pressing first
  text: string;
  action: { label: string; href: AppHref };
};

export type MoneyNow = {
  // null when nothing is owed
  owed: Owed | null;
  // how they pay, as a line under it
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
        late: true,
        text: billNotPaid(b.number),
        action: { label: payBill(b.number), href: billLink(b.id) },
      })),
    // a clean, or its fee, that couldn't be charged
    ...data.pastJobs
      .filter((j) => j.unpaid)
      .map((j) => ({
        cents: j.owedCents,
        late: true,
        text: cleanNotPaid(shortDayOf(j.startsAt)),
        // we try one waiting on the payment service again ourselves
        action:
          j.unpaid === "waiting"
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
        text: w.billDue(b.number, formatShortDay(b.dueOn)),
        action: { label: payBill(b.number), href: billLink(b.id) },
      })),
  ];
  const [first] = owing;
  const owed: Owed | null = first
    ? {
        cents: owing.reduce((sum, o) => sum + o.cents, 0),
        late: owing.some((o) => o.late),
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
    ? w.payingWith(data.paymentMethod.label)
    : onPage
      ? w.onPage
      : w.noCard;

  return {
    owed,
    paying,
    clearing: data.bills.filter((b) => b.status === "processing"),
  };
}

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
