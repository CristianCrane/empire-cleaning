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
  Wordmark,
} from "@empire-cleaning/ui";
import type { AppHref } from "../links.ts";
import { formatDate, formatDay, formatMoney } from "./format.ts";
import { Fact } from "./Fact.tsx";

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

// where it stands now, in a line under its total
const nowLine = (bill: BillView, forClient: boolean) => {
  const your = forClient ? "your" : "their";
  if (bill.status === "void") return "Nothing to pay: it was voided";
  if (bill.status === "processing") return "A bank payment is on its way";
  if (bill.unpaid) return `Its Charge failed ${formatDate(bill.unpaid.since)}`;
  if (bill.status === "due")
    return bill.payment === "on_page"
      ? `To pay by ${formatDay(bill.dueOn)}`
      : `To be charged to ${your} saved Payment Method`;
  if (bill.totalCents < 0) return `Comes off ${your} next Bill`;
  return bill.paidAt ? `Paid ${formatDate(bill.paidAt)}` : "Nothing to pay";
};

// the last fact: due by, why its Charge failed, how it was paid, or why it
// was voided
const standingFact = (bill: BillView, forClient: boolean) => {
  if (bill.status === "void")
    return {
      icon: Ban,
      label: "Voided",
      value: `Voided ${formatDate(bill.voidedAt!)}`,
      line: bill.voidReason ?? "Voided",
    };
  if (bill.unpaid)
    return {
      icon: CreditCard,
      label: "Charge failed",
      value: `Charge failed ${formatDate(bill.unpaid.since)}`,
      line: bill.unpaid.reason,
    };
  if (bill.status === "due" || bill.status === "processing")
    return bill.payment === "on_page" && bill.totalCents > 0
      ? {
          icon: CalendarClock,
          label: "Due by",
          value: formatDay(bill.dueOn),
        }
      : null;
  const paid = paidHow(bill, forClient);
  return paid ? { icon: Receipt, label: "Paid", value: paid } : null;
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
  const credit = bill.totalCents < 0;
  const standing = standingFact(bill, forClient);
  const row = "flex items-start justify-between gap-6";

  return (
    <Section title="Bill details">
      <Card>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <IconTile icon={FileText} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm text-fg-muted">
                {credit ? "Credit" : "Total"}, tax included
              </p>
              <p
                className={`text-3xl font-semibold tabular-nums ${bill.status === "void" ? "text-fg-muted line-through" : "text-fg"}`}
              >
                {formatMoney(Math.abs(bill.totalCents))}
              </p>
              <p className="text-fg-muted">{nowLine(bill, forClient)}</p>
            </div>
          </div>
          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
              <Fact
                icon={CalendarRange}
                label="Week"
                value={`${formatDay(bill.weekStart)} to ${formatDay(bill.weekEnd)}`}
                line="The week it covers"
              />
              <Fact
                icon={CalendarDays}
                label="Made"
                value={formatDate(bill.madeAt)}
              />
              <Fact
                icon={CreditCard}
                label="How it's paid"
                value={
                  bill.payment === "automatic"
                    ? "Charged automatically"
                    : "On its page"
                }
                line={
                  bill.payment === "automatic"
                    ? `How it's paid: to ${forClient ? "your" : "their"} saved Payment Method`
                    : "How it's paid: by card or bank debit"
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
              What it's for{" "}
              <span className="text-sm font-normal text-fg-muted">
                · prices include tax
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
                <span>Tax included</span>
                <span className="tabular-nums">
                  {formatMoney(bill.taxCents)}
                </span>
              </div>
              <div className={`${row} pt-1 font-semibold`}>
                <span>{credit ? "Credit" : "Total"}</span>
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
      <Wordmark />
    </div>
  );
}

// prints the page: the Bill alone, without the app around it
export function PrintBill() {
  return (
    <Button variant="text" size="sm" onPress={() => window.print()}>
      <Printer aria-hidden size={16} />
      Print
    </Button>
  );
}
