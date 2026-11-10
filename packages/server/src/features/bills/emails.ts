import {
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
  type UnpaidKind,
  formats,
  messages,
} from "@empire-cleaning/models";
import type { Settled } from "../completion/balance.ts";
import { unpaidKind } from "../payments/unpaid.ts";

const {
  BOOKED_GO_AHEAD,
  billNotPaid,
  feeName,
  clientFix,
  notTaken,
  PLAN_BACK_ON,
  PLAN_PAUSED,
  PRICES_INCLUDE_TAX,
  REFUND_TAKES_DAYS,
  UPDATE_AND_RETRY,
  UPDATE_CARD,
} = messages.en;

const { formatLongDay, formatMoney, formatWhen } = formats.en;

// a card, where none is saved to name it by
const CARD = "card";

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
    // declined on a later try, after the provider kept us waiting: said as
    // a Bill just made and declined is
    case "unpaid":
    case "made":
      // we try again ourselves, so they're only told the Bill
      if (bill.unpaid === "waiting") {
        return [
          `Your bill ${number} from Empire Cleaning`,
          `Here's your bill for the week: ${total}. We'll take it from your ${card} shortly.`,
        ];
      }
      if (bill.unpaid) {
        return [
          billNotPaid(number),
          `${notTaken(`${total} for bill ${number}`, card)} Please ${UPDATE_AND_RETRY}, or pay it on its page.`,
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
            `Here's your bill for the week: ${total}, due by ${formatLongDay(bill.dueOn)}. You can pay it by card or bank transfer on its page.`,
          ];
    case "reminder":
      if (today < bill.dueOn) {
        return [
          `Bill ${number} is due ${formatLongDay(bill.dueOn)}`,
          `A reminder that bill ${number}, ${total}, is due by ${formatLongDay(bill.dueOn)}. You can pay it by card or bank transfer on its page.`,
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
        `Bill ${number}, ${total}, was due by ${formatLongDay(bill.dueOn)} and hasn't been paid yet. Please pay it on its page, by card or bank transfer.`,
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
        `We've cancelled bill ${number}, so there's nothing to pay on it.${bill.voidReason ? ` ${bill.voidReason}` : ""}`,
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
}): Email => {
  const [subject, ...about] = aboutBill(bill, occasion, {
    ...context,
    card: card ?? CARD,
  });
  const extra = [
    ...(settled.length > 0
      ? [
          "Here's what we've done about each clean on it instead:",
          ...settledLines(settled),
        ]
      : []),
    ...(plan ? [planNotes[plan]] : []),
  ];
  return {
    subject: subject!,
    blocks: [
      greeting(firstNameOf(name)),
      ...[...about, ...extra].map(paragraph),
      details([
        { label: "Bill", value: bill.number },
        {
          label: "Week",
          value: `${formatLongDay(bill.weekStart)} to ${formatLongDay(addDays(bill.weekStart, 6))}`,
        },
        ...(bill.payment === "on_page" && bill.totalCents > 0
          ? [{ label: "Due by", value: formatLongDay(bill.dueOn) }]
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

const planNotes: Record<PlanNote, string> = {
  paused: PLAN_PAUSED,
  back_on: PLAN_BACK_ON,
  pauses_if_late: `If it isn't paid by then, your cleaning plan is paused until it is. ${BOOKED_GO_AHEAD}`,
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
// 9:00 AM"
export const jobNamed = ({
  clean,
  fee,
}: {
  clean: Clean;
  fee: SettledJob["fee"];
}) => {
  const what = `${clean.service} at ${clean.address}, ${formatWhen(clean.startsAt)}`;
  return fee ? `${feeName[fee]}: ${what}` : what;
};

// What settling per Job moved, as lines for the Client: each Job with what
// was charged, refunded or couldn't be, then what to do about one that
// couldn't, and what that did to their Service Plan
const settledLines = (settled: SettledJob[]) => {
  const card = settled[0]?.settled.paymentMethod ?? CARD;
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
            ? [`couldn't take ${formatMoney(s.unpaidCents)}`]
            : []),
        ];
        return `${jobNamed(s)}: ${moved.join(", ")}`;
      })
      .join("\n"),
  ];
  const charged = settled.some((s) => s.settled.chargedCents > 0);
  const refunded = settled.some((s) => s.settled.refundedCents > 0);
  if (charged || refunded) {
    const what =
      charged && refunded
        ? `Payments are taken from your ${card}, and refunds go back to it.`
        : charged
          ? `Payments are taken from your ${card}.`
          : `Refunds go back to your ${card}.`;
    lines.push(
      `${what}${refunded ? " A refund can take a few days to reach you." : ""}`,
    );
  }
  const failed = settled.find((s) => s.settled.failure);
  if (failed) {
    lines.push(
      `${notTaken("payment", card)} ${clientFix[unpaidKind(failed.settled.failure!)]}`,
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
        "We've stopped billing you weekly, so from now on each clean is charged to your card when it's done. Bills already sent still need paying as before.",
        "Here's what we've settled for cleans no bill has covered yet:",
        ...settledLines(settled),
        PRICES_INCLUDE_TAX,
      ].map(paragraph),
      // a card puts it right, unless we're trying again ourselves
      unpaid &&
      settled.some(
        (s) => s.settled.failure && unpaidKind(s.settled.failure) !== "waiting",
      )
        ? button(UPDATE_CARD, "/portal/payment-method")
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
      `No bill has followed bill ${number} in ${creditRefundDays} days, so we've refunded its ${formatMoney(cents)} credit to you. ${REFUND_TAKES_DAYS}`,
    ),
    button("See the bill", `/portal/bills/${billId}`),
  ],
});
