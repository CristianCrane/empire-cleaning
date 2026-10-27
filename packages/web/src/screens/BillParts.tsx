import type { ReactNode } from "react";
import type { BillSummary, BillView } from "@empire-cleaning/models";
import { Button, Card, Link, StatusBadge, Wordmark } from "@empire-cleaning/ui";
import type { AppHref } from "../links.ts";
import { clientName, formatDate, formatDay, formatMoney } from "./format.ts";

// Weekly Bills (ADR-0016), as the Office and the Client both see them

// where a Bill stands: what's left to do about it, or how it ended
export function BillStatusBadge({ bill }: { bill: BillSummary }) {
  if (bill.status === "void") return <StatusBadge>Voided</StatusBadge>;
  if (bill.status === "processing")
    return <StatusBadge tone="info">Processing</StatusBadge>;
  if (bill.unpaid) return <StatusBadge tone="danger">Unpaid</StatusBadge>;
  if (bill.status === "due")
    return <StatusBadge tone="warning">Due</StatusBadge>;
  if (bill.totalCents < 0) return <StatusBadge>Credit</StatusBadge>;
  return (
    <StatusBadge tone="success">
      {bill.totalCents === 0 ? "Nothing to pay" : "Paid"}
    </StatusBadge>
  );
}

// "Week of Mon, Jan 5"
export const billWeek = (bill: Pick<BillSummary, "weekStart">) =>
  `Week of ${formatDay(bill.weekStart)}`;

// how a Bill reads in a list: its total, and when it's due or how it was paid
export const billLine = (bill: BillSummary) =>
  [
    billWeek(bill),
    bill.totalCents < 0
      ? `${formatMoney(-bill.totalCents)} credit`
      : formatMoney(bill.totalCents),
    bill.status === "due" &&
      bill.payment === "on_page" &&
      bill.totalCents > 0 &&
      `due by ${formatDay(bill.dueOn)}`,
  ]
    .filter(Boolean)
    .join(" · ");

// how it was paid, for whoever is looking
const paidHow = (bill: BillView, forClient: boolean) => {
  const on = bill.paidAt ? `, ${formatDate(bill.paidAt)}` : "";
  switch (bill.paidVia) {
    case "charge":
      return `Charged to ${forClient ? "your" : "their"} saved Payment Method${on}`;
    case "page":
      return `Paid on this page${on}`;
    case "outside":
      return `${bill.paymentNote ?? "Paid another way"}${on}`;
    case "nothing_due":
      return bill.totalCents < 0
        ? `Nothing to pay: the credit comes off ${forClient ? "your" : "their"} next Bill`
        : "Nothing to pay";
    default:
      return null;
  }
};

/**
 * A Bill in full: who it's for, its week, when it was made and is due, each
 * line with its tax and the total, and how it was paid or why it was voided.
 * A line for a Job links to it. Prints as it reads, under BillLetterhead.
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
  const paid = paidHow(bill, forClient);
  const row = (term: string, detail: ReactNode) => (
    <>
      <dt className="font-semibold">{term}</dt>
      <dd className="[overflow-wrap:anywhere]">{detail}</dd>
    </>
  );

  return (
    <>
      <Card title="Details">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          {row("Bill", bill.number)}
          {row("For", clientName(bill.client))}
          {row(
            "Week",
            `${formatDay(bill.weekStart)} to ${formatDay(bill.weekEnd)}`,
          )}
          {row("Made", formatDate(bill.madeAt))}
          {bill.payment === "on_page" &&
            bill.totalCents > 0 &&
            row("Due by", formatDay(bill.dueOn))}
          {paid && row("Paid", paid)}
          {bill.voidedAt &&
            row(
              "Voided",
              `${formatDate(bill.voidedAt)}${bill.voidReason ? `: ${bill.voidReason}` : ""}`,
            )}
        </dl>
      </Card>
      <Card title="What it's for" description="Prices include tax.">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
          {bill.lines.map((line, i) => (
            <div key={i} className="contents">
              <dt>
                {line.jobId ? (
                  <Link
                    href={jobHref(line.jobId)}
                    className="print:font-normal print:text-fg print:no-underline"
                  >
                    {line.label}
                  </Link>
                ) : (
                  line.label
                )}
              </dt>
              <dd className="text-end">{formatMoney(line.amountCents)}</dd>
            </div>
          ))}
          <dt className="text-fg-muted">Tax included</dt>
          <dd className="text-end text-fg-muted">
            {formatMoney(bill.taxCents)}
          </dd>
          <dt className="font-semibold">
            {bill.totalCents < 0 ? "Credit" : "Total"}
          </dt>
          <dd className="text-end font-semibold">
            {formatMoney(Math.abs(bill.totalCents))}
          </dd>
        </dl>
      </Card>
    </>
  );
}

// the Empire Cleaning name heading a Bill on paper, where the app's own is
// left off; nothing on screen
export function BillLetterhead() {
  return (
    <div className="hidden print:block">
      <Wordmark />
    </div>
  );
}

// prints the page: the Bill alone, without the app around it
export function PrintBill() {
  return (
    <Button variant="secondary" onPress={() => window.print()}>
      Print
    </Button>
  );
}
