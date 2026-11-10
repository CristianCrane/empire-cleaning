import { catalog, type Language } from "@empire-cleaning/models";
import {
  Ban,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CreditCard,
  FileText,
  Printer,
  Receipt,
} from "lucide-react";
import type { BillSummary, BillView } from "@empire-cleaning/models";
import {
  Button,
  Card,
  IconTile,
  Link,
  Section,
  StatusBadge,
  Logo,
} from "@empire-cleaning/ui";
import type { AppHref } from "../links.ts";
import { Fact } from "./Fact.tsx";
import { said, type Said, useSaid } from "./words.ts";

// in the screen's language: the Office's English, the portal's its
// Client's (ADR-0025). Where the Office and the Client read it differently,
// the Office's is English beside it
const words = catalog({
  en: {
    cancelled: "Cancelled",
    clearing: "Clearing",
    unpaid: "Unpaid",
    due: "Due",
    credit: "Credit",
    nothingToPay: "Nothing to pay",
    paid: "Paid",
    weekOf: (day: string) => `Week of ${day}`,
    creditOf: (amount: string) => `${amount} credit`,
    dueBy: (day: string) => `due by ${day}`,
    chargedToYour: "Charged to your card",
    paidOnPage: "Paid on this page",
    paidAnother: "Paid another way",
    creditOffYour: "Nothing to pay: the credit comes off your next bill",
    wasCancelled: "Nothing to pay: it was cancelled",
    bankOnWay: "A bank payment is on its way",
    notPaidBy: (day: string) => `Not paid by ${day}`,
    didntGo: (day: string) => `Payment didn't go through ${day}`,
    toPayBy: (day: string) => `To pay by ${day}`,
    toBeCharged: "To be charged to your card",
    offYourNext: "Comes off your next bill",
    paidOn: (day: string) => `Paid ${day}`,
    cancelledOn: (day: string) => `Cancelled ${day}`,
    notPaid: "Not paid",
    paymentDidnt: (because: string) =>
      `The payment didn't go through${because}.`,
    dueByLabel: "Due by",
    details: "Bill details",
    taxIncludedOf: (what: string) => `${what}, tax included`,
    total: "Total",
    week: "Week",
    weekRange: (from: string, to: string) => `${from} to ${to}`,
    covers: "The week it covers",
    made: "Made",
    howPaid: "How it's paid",
    automatically: "Charged automatically",
    onItsPage: "On its page",
    cardOrBank: "Paid by card or bank",
    whatFor: "What it's for",
    pricesTax: "· prices include tax",
    taxIncluded: "Tax included",
    print: "Print",
  },
  es: {
    cancelled: "Cancelada",
    clearing: "En proceso",
    unpaid: "Sin pagar",
    due: "Pendiente",
    credit: "Crédito",
    nothingToPay: "Nada que pagar",
    paid: "Pagada",
    weekOf: (day: string) => `Semana del ${day}`,
    creditOf: (amount: string) => `${amount} de crédito`,
    dueBy: (day: string) => `vence el ${day}`,
    chargedToYour: "Cobrada a su tarjeta",
    paidOnPage: "Pagada en esta página",
    paidAnother: "Pagada de otra forma",
    creditOffYour:
      "Nada que pagar: el crédito se descuenta de su próxima factura",
    wasCancelled: "Nada que pagar: se canceló",
    bankOnWay: "Hay un pago bancario en camino",
    notPaidBy: (day: string) => `No se pagó antes del ${day}`,
    didntGo: (day: string) => `El pago no pasó el ${day}`,
    toPayBy: (day: string) => `A pagar antes del ${day}`,
    toBeCharged: "Se cobrará a su tarjeta",
    offYourNext: "Se descuenta de su próxima factura",
    paidOn: (day: string) => `Pagada el ${day}`,
    cancelledOn: (day: string) => `Cancelada el ${day}`,
    notPaid: "Sin pagar",
    paymentDidnt: (because: string) => `El pago no pasó${because}.`,
    dueByLabel: "Vence el",
    details: "Detalles de la factura",
    taxIncludedOf: (what: string) => `${what}, impuestos incluidos`,
    total: "Total",
    week: "Semana",
    weekRange: (from: string, to: string) => `Del ${from} al ${to}`,
    covers: "La semana que cubre",
    made: "Emitida",
    howPaid: "Cómo se paga",
    automatically: "Se cobra automáticamente",
    onItsPage: "En su página",
    cardOrBank: "Se paga con tarjeta o banco",
    whatFor: "Por qué es",
    pricesTax: "· los precios incluyen impuestos",
    taxIncluded: "Impuestos incluidos",
    print: "Imprimir",
  },
});
type T = Said & { w: (typeof words)["en"] };

// Weekly Bills (ADR-0016), as the Office and the Client both see them

// where a Bill stands: what's left to do about it, or how it ended
export function BillStatusBadge({ bill }: { bill: BillSummary }) {
  const { w } = useSaid(words);
  if (bill.status === "void") return <StatusBadge>{w.cancelled}</StatusBadge>;
  if (bill.status === "processing")
    return <StatusBadge tone="info">{w.clearing}</StatusBadge>;
  if (bill.unpaid) return <StatusBadge tone="danger">{w.unpaid}</StatusBadge>;
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
) => words[lang].weekOf(said[lang].formatDay(bill.weekStart));

// how a Bill reads in a list: its total, and when it's due or how it was paid
export const billLine = (lang: Language, bill: BillSummary) => {
  const w = words[lang];
  const { formatDay, formatMoney } = said[lang];
  return [
    billWeek(lang, bill),
    bill.totalCents < 0
      ? w.creditOf(formatMoney(-bill.totalCents))
      : formatMoney(bill.totalCents),
    bill.status === "due" &&
      bill.payment === "on_page" &&
      bill.totalCents > 0 &&
      w.dueBy(formatDay(bill.dueOn)),
  ]
    .filter(Boolean)
    .join(" · ");
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
  if (bill.status === "processing") return w.bankOnWay;
  if (bill.unpaid)
    return bill.unpaid.kind === "late"
      ? w.notPaidBy(t.formatDay(bill.dueOn))
      : w.didntGo(t.formatDate(bill.unpaid.since));
  if (bill.status === "due")
    return bill.payment === "on_page"
      ? w.toPayBy(t.formatDay(bill.dueOn))
      : forClient
        ? w.toBeCharged
        : "To be charged to their card";
  if (bill.totalCents < 0)
    return forClient ? w.offYourNext : "Comes off their next bill";
  return bill.paidAt ? w.paidOn(t.formatDate(bill.paidAt)) : w.nothingToPay;
};

// the last fact: due by, why its payment didn't go through, how it was
// paid, or why it was cancelled
const standingFact = (t: T, bill: BillView, forClient: boolean) => {
  const { w } = t;
  if (bill.status === "void")
    return {
      icon: Ban,
      label: w.cancelled,
      value: w.cancelledOn(t.formatDate(bill.voidedAt!)),
      line: bill.voidReason ?? w.cancelled,
    };
  if (bill.unpaid)
    return {
      icon: CreditCard,
      label: w.notPaid,
      value: t.formatDate(bill.unpaid.since),
      line: w.paymentDidnt(bill.unpaid.why ? ` (${bill.unpaid.why})` : ""),
    };
  if (bill.status === "due" || bill.status === "processing")
    return bill.payment === "on_page" && bill.totalCents > 0
      ? {
          icon: CalendarClock,
          label: w.dueByLabel,
          value: t.formatDay(bill.dueOn),
        }
      : null;
  const paid = paidHow(t, bill, forClient);
  return paid ? { icon: Receipt, label: w.paid, value: paid } : null;
};

/**
 * A Bill in full, read like an invoice (UX pass, #96): what it comes to,
 * large, and where that stands; its week, when it was made, how it's paid
 * and how it was paid or why it was voided, across; then each line with its
 * amount, the tax in it and the total, under a divider. A line for a Job
 * links to it. Prints as it reads, under BillLetterhead.
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
  const { w, formatDate, formatDay, formatMoney } = t;
  const credit = bill.totalCents < 0;
  const standing = standingFact(t, bill, forClient);
  const row = "flex items-start justify-between gap-6";

  return (
    <Section title={w.details}>
      <Card>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <IconTile icon={FileText} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm text-fg-muted">
                {w.taxIncludedOf(credit ? w.credit : w.total)}
              </p>
              <p
                className={`text-3xl font-semibold tabular-nums ${bill.status === "void" ? "text-fg-muted line-through" : "text-fg"}`}
              >
                {formatMoney(Math.abs(bill.totalCents))}
              </p>
              <p className="text-fg-muted">{nowLine(t, bill, forClient)}</p>
            </div>
          </div>
          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
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
                  bill.payment === "automatic" ? w.automatically : w.onItsPage
                }
                line={
                  bill.payment === "automatic"
                    ? forClient
                      ? w.chargedToYour
                      : "Charged to their card"
                    : w.cardOrBank
                }
              />
              {standing && (
                <Fact
                  icon={standing.icon}
                  label={standing.label}
                  value={
                    <span className="[overflow-wrap:anywhere]">
                      {standing.value}
                    </span>
                  }
                  line={standing.line}
                />
              )}
            </dl>
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-6">
            <p className="font-semibold text-fg">
              {w.whatFor}{" "}
              <span className="text-sm font-normal text-fg-muted">
                {w.pricesTax}
              </span>
            </p>
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
                        className="font-normal text-fg no-underline hover:underline print:no-underline"
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
                <span className="tabular-nums">
                  {formatMoney(bill.taxCents)}
                </span>
              </div>
              <div className={`${row} pt-1 font-semibold`}>
                <span>{credit ? w.credit : w.total}</span>
                <span className="tabular-nums">
                  {formatMoney(Math.abs(bill.totalCents))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Section>
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

// prints the page: the Bill alone, without the app around it
export function PrintBill() {
  return (
    <Button variant="text" size="sm" onPress={() => window.print()}>
      <Printer aria-hidden size={16} />
      {useSaid(words).w.print}
    </Button>
  );
}
