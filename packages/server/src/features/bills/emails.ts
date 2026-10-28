import { addDays } from "../../services/clock/days.ts";
import {
  amounts,
  button,
  details,
  greeting,
  paragraph,
  type Email,
} from "../../services/email/blocks.ts";
import {
  firstNameOf,
  formatDay,
  formatMoney,
} from "../../services/email/format.ts";
import { ON_HOLD_LINE } from "../cancellation/emails.ts";
import type { Settled } from "../completion/balance.ts";

export type Occasion = "made" | "reminder" | "paid" | "voided" | "debit_failed";

// a Bill, as much of it as its email shows
export type BillToSend = {
  id: string;
  // "EC-000012"
  number: string;
  weekStart: string;
  dueOn: string;
  payment: "automatic" | "on_page";
  status: string;
  unpaid: boolean;
  paidVia: string | null;
  voidReason: string | null;
  totalCents: number;
  taxCents: number;
  lines: { label: string; amountCents: number }[];
};

// why the Bill is sent, as its subject and what it says first
const aboutBill = (
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
  const { number } = bill;
  const total = formatMoney(bill.totalCents);
  switch (occasion) {
    case "made":
      if (bill.unpaid) {
        return [
          `We couldn't take payment for bill ${number}`,
          `We couldn't charge ${total} for bill ${number} to your ${card}. Please update your Payment Method and we'll try again straight away, or pay it on its page.`,
        ];
      }
      if (bill.totalCents < 0) {
        return [
          `Your bill ${number}: a credit`,
          `This week's bill comes to a credit of ${formatMoney(-bill.totalCents)}, which comes off your next one. If none follows within ${creditRefundDays} days, we'll refund it.`,
        ];
      }
      if (bill.totalCents === 0) {
        return [`Your bill ${number}`, "There's nothing to pay this week."];
      }
      return bill.status === "paid"
        ? [
            `Your receipt for bill ${number}`,
            `Here's your bill for the week. We've charged ${total} to your ${card}.`,
          ]
        : [
            `Your bill ${number} from Empire Cleaning`,
            `Here's your bill for the week: ${total}, due by ${formatDay(bill.dueOn)}. You can pay it by card or bank transfer on its page.`,
          ];
    case "reminder":
      if (today < bill.dueOn) {
        return [
          `Bill ${number} is due ${formatDay(bill.dueOn)}`,
          `A reminder that bill ${number}, ${total}, is due by ${formatDay(bill.dueOn)}. You can pay it by card or bank transfer on its page.`,
        ];
      }
      if (today === bill.dueOn) {
        return [
          `Bill ${number} is due today`,
          `A reminder that bill ${number}, ${total}, is due today. You can pay it by card or bank transfer on its page.`,
        ];
      }
      return [
        `Bill ${number} is overdue`,
        `Bill ${number}, ${total}, was due by ${formatDay(bill.dueOn)} and hasn't been paid yet. Please pay it on its page, by card or bank transfer.`,
      ];
    case "paid":
      return [
        `Your receipt for bill ${number}`,
        bill.paidVia === "outside"
          ? `We've received your payment of ${total} for bill ${number}. Thank you.`
          : `Thank you: bill ${number} is paid, ${total}.`,
      ];
    case "voided":
      return [
        `Bill ${number} is cancelled`,
        `We've voided bill ${number}, so there's nothing to pay on it.${bill.voidReason ? ` ${bill.voidReason}` : ""}`,
        billedWeekly
          ? "Anything on it that's still owed will be on your next bill."
          : "Anything on it that's still owed is charged to your card per clean, as before.",
      ];
    case "debit_failed":
      return [
        `Your bank payment for bill ${number} didn't go through`,
        `Your bank payment of ${total} for bill ${number} didn't go through. Please pay it again on its page, by card or from another account.`,
      ];
  }
};

// The whole Bill: its number, week, due date, each line, tax and total, with
// why it's sent (and `extra` to say) and a link to it in the portal
export const billEmail = ({
  name,
  bill,
  occasion,
  extra = [],
  ...context
}: {
  name: string;
  bill: BillToSend;
  occasion: Occasion;
  extra?: string[];
  // their Payment Method's label, or "card"
  card: string;
  today: string;
  // they're billed weekly still
  billedWeekly: boolean;
  creditRefundDays: number;
}): Email => {
  const [subject, ...about] = aboutBill(bill, occasion, context);
  return {
    subject: subject!,
    blocks: [
      greeting(firstNameOf(name)),
      ...[...about, ...extra].map(paragraph),
      details([
        { label: "Bill", value: bill.number },
        {
          label: "Week",
          value: `${formatDay(bill.weekStart)} to ${formatDay(addDays(bill.weekStart, 6))}`,
        },
        ...(bill.payment === "on_page" && bill.totalCents > 0
          ? [{ label: "Due by", value: formatDay(bill.dueOn) }]
          : []),
      ]),
      amounts(
        bill.lines.map((l): [string, number] => [l.label, l.amountCents]),
        ["Total", bill.totalCents],
      ),
      paragraph(
        `Prices include tax: ${formatMoney(bill.taxCents)} of the total.`,
      ),
      button("See your bill", `/portal/bills/${bill.id}`),
    ],
  };
};

// a Job a Bill no longer takes, settled on its own
export type SettledJob = {
  // as its lines on a Bill name it
  label: string;
  settled: Settled;
  // what its failed Charge left owing
  unpaidCents: number | null;
};

// What settling per Job moved, as lines for the Client: each Job with what
// was charged, refunded or couldn't be, then what to do about one that
// couldn't, and what that did to their Service Plan
export const settledLines = (settled: SettledJob[]) => {
  const card = settled[0]?.settled.paymentMethod ?? "card";
  const lines = [
    settled
      .map((s) => {
        const moved = [
          ...(s.settled.chargedCents > 0
            ? [`charged ${formatMoney(s.settled.chargedCents)}`]
            : []),
          ...(s.settled.refundedCents > 0
            ? [`refunded ${formatMoney(s.settled.refundedCents)}`]
            : []),
          ...(s.unpaidCents !== null
            ? [`couldn't charge ${formatMoney(s.unpaidCents)}`]
            : []),
        ];
        return `${s.label}: ${moved.join(", ")}`;
      })
      .join("\n"),
  ];
  const charged = settled.some((s) => s.settled.chargedCents > 0);
  const refunded = settled.some((s) => s.settled.refundedCents > 0);
  if (charged || refunded) {
    const what =
      charged && refunded
        ? "Charges and refunds are"
        : charged
          ? "Charges are"
          : "Refunds are";
    lines.push(
      `${what} to your ${card}.${refunded ? " A refund can take a few days to reach you." : ""}`,
    );
  }
  if (settled.some((s) => s.unpaidCents !== null)) {
    lines.push(
      `We couldn't charge your ${card}. Please update your Payment Method and we'll try again straight away.`,
    );
  }
  if (settled.some((s) => s.settled.plan === "held")) {
    lines.push(ON_HOLD_LINE);
  } else if (settled.some((s) => s.settled.plan === "resumed")) {
    lines.push(
      "Your Service Plan is back on, and we'll book your cleans as usual.",
    );
  }
  return lines;
};

// they're charged per clean again, and what that charged for what no Bill had
// taken yet
export const chargedPerCleanEmail = ({
  name,
  settled,
}: {
  name: string;
  settled: SettledJob[];
}): Email => {
  const unpaid = settled.some((s) => s.unpaidCents !== null);
  return {
    subject: unpaid
      ? "We couldn't take payment for your cleans"
      : "You're now charged per clean",
    blocks: [
      greeting(firstNameOf(name)),
      ...[
        "We've stopped billing you weekly, so from now on each clean is charged to your card when it's done. Bills already sent stay due as they are.",
        "Here's what we've settled for cleans no bill has covered yet:",
        ...settledLines(settled),
        "Prices include tax.",
      ].map(paragraph),
      unpaid
        ? button("Update your Payment Method", "/portal/payment-method")
        : button("See your cleans", "/portal"),
    ],
  };
};

export const creditRefundedEmail = ({
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
}): Email => ({
  subject: `We've refunded your credit from bill ${number}`,
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `No bill has followed bill ${number} in ${creditRefundDays} days, so we've refunded its ${formatMoney(cents)} credit to you. It can take a few days to reach you.`,
    ),
    button("See the bill", `/portal/bills/${billId}`),
  ],
});
