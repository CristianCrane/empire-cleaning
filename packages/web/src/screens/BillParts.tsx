import { asksTheClient, catalog, type Language } from "@empire-cleaning/models";
import {
  Ban,
  CalendarDays,
  CalendarRange,
  CreditCard,
  FileText,
  Printer,
} from "lucide-react";
import type { BillSummary, BillView } from "@empire-cleaning/models";
import {
  IconTile,
  Link,
  StatusBadge,
  Logo,
  Fact,
  DetailsCard,
  Facts,
  type PageAction,
} from "@empire-cleaning/ui";
import type { AppHref } from "../links.ts";
import { lineOf } from "./format.ts";
import { type Said, saidWith, useSaid } from "./words.ts";

// in the screen's language: the Office's English, the portal's its
// Client's (ADR-0025). Where the Office and the Client read it differently,
// the Office's is English beside it
const words = catalog({
  en: {
    cancelled: "Cancelled",
    due: "Due",
    credit: "Credit",
    nothingToPay: "Nothing to pay",
    paid: "Paid",
    weekOf: (day: string) => `Week of ${day}`,
    creditOf: (amount: string) => `${amount} credit`,
    dueBy: (day: string) => `due by ${day}`,
    chargedToYour: "Charged to your card",
    fromYourCard: "From your card, automatically",
    paidOnPage: "Paid on this page",
    paidAnother: "Paid another way",
    creditOffYour: "Nothing to pay: the credit comes off your next bill",
    wasCancelled: "Nothing to pay: it was cancelled",
    notPaidBy: (day: string) => `Not paid by ${day}`,
    didntGo: (day: string) => `Payment didn't go through ${day}`,
    // one the payment service is trying again, which we see to, or a bank
    // debit on its way: the badge says it's pending; "started", as "tried"
    // reads as failed
    notYet: (day: string) => `Payment started ${day}`,
    toPayBy: (day: string) => `To pay by ${day}`,
    toBeCharged: "To be charged to your card",
    offYourNext: "Comes off your next bill",
    cancelledOn: (day: string) => `Cancelled ${day}`,
    details: "Bill details",
    week: "Week",
    weekRange: (from: string, to: string) => `${from} to ${to}`,
    covers: "The week it covers",
    made: "Made",
    howPaid: "How it's paid",
    onItsPage: "On its page, by card or bank",
    whatFor: "What it's for",
    taxIncluded: "Tax included",
    print: "Print",
  },
  es: {
    cancelled: "Cancelada",
    due: "Pendiente",
    credit: "Crédito",
    nothingToPay: "Nada que pagar",
    paid: "Pagada",
    weekOf: (day: string) => `Semana del ${day}`,
    creditOf: (amount: string) => `${amount} de crédito`,
    dueBy: (day: string) => `vence el ${day}`,
    chargedToYour: "Cobrada a su tarjeta",
    fromYourCard: "De su tarjeta, automáticamente",
    paidOnPage: "Pagada en esta página",
    paidAnother: "Pagada de otra forma",
    creditOffYour:
      "Nada que pagar: el crédito se descuenta de su próxima factura",
    wasCancelled: "Nada que pagar: se canceló",
    notPaidBy: (day: string) => `No se pagó antes del ${day}`,
    didntGo: (day: string) => `El pago no pasó el ${day}`,
    notYet: (day: string) => `Pago iniciado el ${day}`,
    toPayBy: (day: string) => `A pagar antes del ${day}`,
    toBeCharged: "Se cobrará a su tarjeta",
    offYourNext: "Se descuenta de su próxima factura",
    cancelledOn: (day: string) => `Cancelada el ${day}`,
    details: "Detalles de la factura",
    week: "Semana",
    weekRange: (from: string, to: string) => `Del ${from} al ${to}`,
    covers: "La semana que cubre",
    made: "Emitida",
    howPaid: "Cómo se paga",
    onItsPage: "En su página, con tarjeta o banco",
    whatFor: "Para qué es",
    taxIncluded: "Impuestos incluidos",
    print: "Imprimir",
  },
});
type T = Said & { w: (typeof words)["en"] };

// Weekly Bills (ADR-0016), as the Office and the Client both see them

// where a Bill stands: what's left to do about it, or how it ended
export function BillStatusBadge({
  bill,
}: {
  bill: Pick<BillSummary, "status" | "unpaid" | "paying" | "totalCents">;
}) {
  const { w, unpaid, paymentPending } = useSaid(words);
  if (bill.status === "void") return <StatusBadge>{w.cancelled}</StatusBadge>;
  // a bank debit on its way, and one we try again ourselves, wait on us
  // (ADR-0022), as a clean's does: one word for one wait, however long it
  // takes, as the Client does nothing in either (#534's UX review U1)
  if (
    bill.status === "processing" ||
    (bill.unpaid && !asksTheClient(bill.unpaid.kind))
  )
    return <StatusBadge tone="info">{paymentPending}</StatusBadge>;
  // the Client's last payment on its page didn't go through, as a card we
  // charged that was declined: one event, one badge, however it's paid.
  // One their bank asks them to approve is still Due, theirs to finish
  if (bill.unpaid || bill.paying?.status === "failed")
    return <StatusBadge tone="danger">{unpaid}</StatusBadge>;
  if (bill.status === "due")
    return <StatusBadge tone="warning">{w.due}</StatusBadge>;
  if (bill.totalCents < 0) return <StatusBadge>{w.credit}</StatusBadge>;
  return (
    <StatusBadge tone="success">
      {bill.totalCents === 0 ? w.nothingToPay : w.paid}
    </StatusBadge>
  );
}

// "Week of Mon, Jan 5"
export const billWeek = (
  lang: Language,
  bill: Pick<BillSummary, "weekStart">,
) => {
  const { w, formatDay } = saidWith(lang, words);
  return w.weekOf(formatDay(bill.weekStart));
};

// how a Bill reads in a list: its total, and when it's due or how it was paid
export const billLine = (lang: Language, bill: BillSummary) => {
  const { w, formatDay, formatMoney } = saidWith(lang, words);
  return lineOf([
    billWeek(lang, bill),
    bill.totalCents < 0
      ? w.creditOf(formatMoney(-bill.totalCents))
      : formatMoney(bill.totalCents),
    bill.status === "due" &&
      bill.payment === "on_page" &&
      bill.totalCents > 0 &&
      w.dueBy(formatDay(bill.dueOn)),
  ]);
};

// how it was paid, for whoever is looking
const paidHow = (t: T, bill: BillView, forClient: boolean) => {
  const { w } = t;
  const on = bill.paidAt ? `, ${t.formatDate(bill.paidAt)}` : "";
  switch (bill.paidVia) {
    case "charge":
      return `${forClient ? w.chargedToYour : "Charged to their card"}${on}`;
    case "page":
      return `${w.paidOnPage}${on}`;
    case "outside":
      return `${bill.paymentNote ?? w.paidAnother}${on}`;
    case "nothing_due":
      return bill.totalCents < 0
        ? forClient
          ? w.creditOffYour
          : "Nothing to pay: the credit comes off their next bill"
        : w.nothingToPay;
    default:
      return null;
  }
};

// where it stands now, in a line under its total
const nowLine = (t: T, bill: BillView, forClient: boolean) => {
  const { w } = t;
  if (bill.status === "void") return w.wasCancelled;
  // since when, as its alert says how long it usually takes (U2)
  if (bill.status === "processing")
    return w.notYet(t.formatDate(bill.clearingSince!));
  if (bill.unpaid)
    return bill.unpaid.kind === "late"
      ? w.notPaidBy(t.formatDay(bill.dueOn))
      : asksTheClient(bill.unpaid.kind)
        ? w.didntGo(t.formatDate(bill.unpaid.since))
        : // to the minute for the Office, whose alert says it usually
          // takes under half an hour, so Olive can tell when it's stuck
          // (#534's UX review U9)
          w.notYet(
            forClient
              ? t.formatDate(bill.unpaid.since)
              : t.formatDateTime(bill.unpaid.since),
          );
  if (bill.status === "due")
    return bill.payment === "on_page"
      ? w.toPayBy(t.formatDay(bill.dueOn))
      : forClient
        ? w.toBeCharged
        : "To be charged to their card";
  if (bill.totalCents < 0)
    return forClient ? w.offYourNext : "Comes off their next bill";
  return paidHow(t, bill, forClient) ?? w.nothingToPay;
};

// the last fact, on a cancelled Bill: when and why. Where any other
// stands, its line under the total says (nowLine), and why a payment
// didn't go through, its page's alert
const cancelledFact = (t: T, bill: BillView) =>
  bill.status === "void" && {
    icon: Ban,
    label: t.w.cancelled,
    value: t.w.cancelledOn(t.formatDate(bill.voidedAt!)),
    line: bill.voidReason ?? t.w.cancelled,
  };

/**
 * A Bill in full, its details card, read like an invoice (UX pass, #96):
 * what it comes to, large, and where that stands (how it was paid, once
 * it is); its week, when it was made, how it's paid, and when and why it
 * was voided; then each line with its amount, the tax in it and the total,
 * under a divider. A line for a Job links to it. Prints as it reads, under
 * BillLetterhead.
 */
export function BillDetail({
  bill,
  forClient,
  jobHref,
}: {
  bill: BillView;
  forClient: boolean;
  jobHref: (jobId: string) => AppHref;
}) {
  const t = useSaid(words);
  const { w, formatDate, formatDay, formatMoney, taxIncludedOf, total } = t;
  const credit = bill.totalCents < 0;
  const standing = cancelledFact(t, bill);
  const row = "flex items-start justify-between gap-6";

  return (
    <DetailsCard
      label={w.details}
      tile={<IconTile icon={FileText} size="lg" />}
      kicker={taxIncludedOf(credit ? w.credit : total)}
      title={
        <span
          className={`tabular-nums ${bill.status === "void" ? "text-fg-muted line-through" : ""}`}
        >
          {formatMoney(Math.abs(bill.totalCents))}
        </span>
      }
      line={nowLine(t, bill, forClient)}
    >
      <Facts>
        <Fact
          icon={CalendarRange}
          label={w.week}
          value={w.weekRange(
            formatDay(bill.weekStart),
            formatDay(bill.weekEnd),
          )}
          line={w.covers}
        />
        <Fact
          icon={CalendarDays}
          label={w.made}
          value={formatDate(bill.madeAt)}
        />
        <Fact
          icon={CreditCard}
          label={w.howPaid}
          value={
            bill.payment === "on_page"
              ? w.onItsPage
              : forClient
                ? w.fromYourCard
                : "From their card, automatically"
          }
        />
        {standing && (
          <Fact
            icon={standing.icon}
            label={standing.label}
            value={
              <span className="[overflow-wrap:anywhere]">{standing.value}</span>
            }
            line={standing.line}
          />
        )}
      </Facts>
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        {/* the tax is said by the total's label and its own line below */}
        <p className="font-semibold text-fg">{w.whatFor}</p>
        <div className="flex flex-col">
          {bill.lines.map((line, i) => (
            <div
              key={i}
              className={`${row} border-b border-border py-3 first:pt-0`}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {line.jobId ? (
                  <Link
                    href={jobHref(line.jobId)}
                    className="print:text-fg print:no-underline"
                  >
                    {line.label}
                  </Link>
                ) : (
                  line.label
                )}
              </span>
              <span className="tabular-nums">
                {formatMoney(line.amountCents)}
              </span>
            </div>
          ))}
          <div className={`${row} pt-3 text-fg-muted`}>
            <span>{w.taxIncluded}</span>
            <span className="tabular-nums">{formatMoney(bill.taxCents)}</span>
          </div>
          <div className={`${row} pt-1 font-semibold`}>
            <span>{credit ? w.credit : total}</span>
            <span className="tabular-nums">
              {formatMoney(Math.abs(bill.totalCents))}
            </span>
          </div>
        </div>
      </div>
    </DetailsCard>
  );
}

// the Empire Cleaning name heading a Bill on paper, where the app's own is
// left off; nothing on screen
export function BillLetterhead() {
  return (
    <div className="hidden print:block">
      <Logo className="w-32" />
    </div>
  );
}

// prints the page, a page action: the Bill alone, without the app around
// it
export function usePrintBill(): PageAction {
  return {
    label: useSaid(words).w.print,
    icon: Printer,
    onAction: () => window.print(),
  };
}
