import type {
  BillSummary,
  ClientPastJob,
  ClientPayment,
  PaymentMethodView,
} from "@empire-cleaning/models";
import { linkTo, type AppHref } from "../../links.ts";
import { dayOfInstant, formatMoney, formatShortDay } from "../format.ts";

// The Client's Payments page: one card saying what they owe now, or that
// it's nothing, and every payment between us after it. (UX pass, #96)

export type PaymentsData = {
  pastJobs: ClientPastJob[];
  bills: BillSummary[];
  paymentMethod: PaymentMethodView | null;
};

export type Owed = {
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
const shortDayOf = (iso: string) => formatShortDay(dayOfInstant(iso));

export function moneyNow(data: PaymentsData): MoneyNow {
  const owing: Owed[] = [
    // a Bill that couldn't be taken, or is past its due date
    ...data.bills
      .filter((b) => b.unpaid && b.status === "due")
      .map((b) => ({
        cents: b.totalCents,
        late: true,
        text: `We couldn't take payment for Bill ${b.number}`,
        action: { label: `Pay Bill ${b.number}`, href: billLink(b.id) },
      })),
    // a clean, or its fee, that couldn't be charged
    ...data.pastJobs
      .filter((j) => j.unpaid)
      .map((j) => ({
        cents: j.owedCents,
        late: true,
        text: `Your card was declined for your ${shortDayOf(j.startsAt)} clean`,
        action: { label: "Update your card", href: cardLink },
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
        text: `Bill ${b.number} is due by ${formatShortDay(b.dueOn)}`,
        action: { label: `Pay Bill ${b.number}`, href: billLink(b.id) },
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
            : `${first.text}, and ${owing.length - 1} more`,
        action: first.action,
      }
    : null;

  // weekly Bills paid on their page need no card
  const onPage = data.bills[0]?.payment === "on_page";
  const paying = data.paymentMethod
    ? `Paying with ${data.paymentMethod.label}`
    : onPage
      ? "You pay each Bill on its page"
      : "No card saved yet";

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

const feeName = (status: string) =>
  status === "no_access" ? "No Access fee" : "Late cancellation fee";

// how one payment reads in the history: what it was for first
export function paymentRow(p: ClientPayment): PaymentRow {
  const day = shortDayOf(p.at);
  const cleanDay = p.job ? shortDayOf(p.job.startsAt) : null;
  // the clean's day, only when it isn't the payment's own
  const otherDay = cleanDay !== day ? cleanDay : null;

  if (p.bill) {
    return {
      title: `${p.kind === "refund" ? "Refund on " : ""}Bill ${p.bill.number}`,
      line: `${formatShortDay(p.bill.weekStart)} – ${formatShortDay(p.bill.weekEnd)}`,
      href: billLink(p.bill.id),
    };
  }
  if (p.servicePlanId) {
    const href = linkTo({
      to: "/portal/plans/$planId",
      params: { planId: p.servicePlanId },
    });
    return p.kind === "refund"
      ? { title: "Refund of your Service Plan Deposit", href }
      : {
          title: "Deposit for your Service Plan",
          line: "Goes towards your plan's last clean",
          href,
        };
  }
  const job = p.job!;
  const href = linkTo({ to: "/portal/jobs/$jobId", params: { jobId: job.id } });
  switch (p.kind) {
    case "deposit":
      return {
        title: `Deposit for ${job.serviceName}`,
        line: `Booked for ${cleanDay}`,
        href,
      };
    case "extra":
      return {
        title: `Extra on ${job.serviceName}`,
        line: `Approved after your ${cleanDay} clean`,
        href,
      };
    case "fee":
      return {
        title: feeName(job.status),
        line: `${job.serviceName}, ${cleanDay}`,
        href,
      };
    case "refund":
      return {
        title: `Refund on ${job.serviceName}`,
        line: otherDay ? `From your ${otherDay} clean` : undefined,
        href,
      };
    default:
      return {
        title: job.serviceName,
        line: otherDay ? `Your ${otherDay} clean` : undefined,
        href,
      };
  }
}

// "−$22.50" for money back
export const signedMoney = (cents: number) =>
  cents < 0 ? `−${formatMoney(-cents)}` : formatMoney(cents);
