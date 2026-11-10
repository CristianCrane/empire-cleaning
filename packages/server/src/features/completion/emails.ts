import {
  amounts,
  button,
  cleanDetails,
  details,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";
import { formats, messages } from "@empire-cleaning/models";
import { whyNotPaid } from "../payments/unpaid.ts";
import type { Settled } from "./balance.ts";

const {
  clientFix,
  notTaken,
  PRICES_INCLUDE_TAX,
  refundedTo,
  LATE_MOVE_FEE,
  PLAN_BACK_ON,
  PLAN_PAUSED,
  UPDATE_AND_RETRY,
  UPDATE_CARD,
} = messages.en;

const { formatMoney, formatWhen } = formats.en;

const portalButton = (jobId: string, label = "See your clean") =>
  button(label, `/portal/jobs/${jobId}`);

// what settling moved, as paragraphs for the Client
const moneyLines = (settled: Settled, owedCents: number) => {
  const lines: string[] = [];
  if (settled.billed) {
    lines.push("It goes on your weekly bill.");
  }
  const card = settled.paymentMethod ?? "card";
  if (settled.chargedCents > 0) {
    lines.push(
      `We've charged ${formatMoney(settled.chargedCents)} to your ${card}.`,
    );
  }
  if (settled.refundedCents > 0) {
    lines.push(refundedTo(formatMoney(settled.refundedCents), card));
  }
  if (settled.failure) {
    lines.push(
      `${notTaken(`the ${formatMoney(owedCents)} still to pay`, card)} ${clientFix[whyNotPaid(settled.failure).kind]}`,
    );
  }
  // putting it On Hold is told in the Unpaid notice
  if (settled.plan === "resumed") {
    lines.push(PLAN_BACK_ON);
  }
  return lines.map(paragraph);
};

// a Job the Client owes on couldn't be charged, the first time it becomes
// Unpaid
export const unpaidEmail = ({
  name,
  jobId,
  clean,
  owedCents,
  paymentMethod,
  held,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  owedCents: number;
  paymentMethod: string | null;
  // it put their Service Plan On Hold
  held: boolean;
}): Email => ({
  subject: "We couldn't take your payment",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      notTaken(`${formatMoney(owedCents)} for your clean`, paymentMethod),
    ),
    cleanDetails(clean),
    paragraph(`Please ${UPDATE_AND_RETRY}:`),
    ...(held ? [paragraph(PLAN_PAUSED)] : []),
    portalButton(jobId, UPDATE_CARD),
  ],
});

export const receiptEmail = ({
  name,
  jobId,
  clean,
  quotedCents,
  adjustments,
  totalCents,
  rescheduleFeeCents,
  depositCents,
  owedCents,
  settled,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  quotedCents: number;
  // the Adjustments that count, each with its label
  adjustments: { label: string; totalCents: number }[];
  totalCents: number;
  rescheduleFeeCents: number;
  // the Deposit charged when it was booked
  depositCents: number;
  owedCents: number;
  settled: Settled;
}): Email => ({
  subject: "Your clean is done: your receipt",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("Your clean is done. Thank you for choosing Empire Cleaning."),
    cleanDetails(clean),
    amounts(
      [
        ["Quoted price", quotedCents],
        ...adjustments.map((a): [string, number] => [a.label, a.totalCents]),
      ],
      ["Total", totalCents],
    ),
    ...(rescheduleFeeCents > 0 || depositCents > 0
      ? [
          details([
            ...(rescheduleFeeCents > 0
              ? [
                  {
                    label: `${LATE_MOVE_FEE}${depositCents > 0 ? " (your deposit, kept)" : ""}`,
                    value: formatMoney(rescheduleFeeCents),
                  },
                ]
              : []),
            ...(depositCents > 0
              ? [{ label: "Deposit paid", value: formatMoney(depositCents) }]
              : []),
          ]),
        ]
      : []),
    ...moneyLines(settled, owedCents),
    paragraph(PRICES_INCLUDE_TAX),
    portalButton(jobId, "See your receipt"),
  ],
});

// an increase the Office proposes, for the Client to approve or decline
export const proposalEmail = ({
  name,
  jobId,
  clean,
  label,
  reason,
  totalCents,
  answerBy,
  reminder,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  // "1 more hour"
  label: string;
  // the Cleaner's, e.g. "Heavy grease"
  reason: string;
  totalCents: number;
  answerBy: Date;
  reminder: boolean;
}): Email => ({
  subject: reminder
    ? "Reminder: please approve a price change on your clean"
    : "Please approve a price change on your clean",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `At your clean, our team did more than was quoted: ${label} (${reason}).`,
    ),
    cleanDetails(clean),
    paragraph(
      `It comes to ${formatMoney(totalCents)}, tax included, and you only pay it if you approve it. Please approve or decline it by ${formatWhen(answerBy)}. If we don't hear from you by then, you won't pay it.`,
    ),
    portalButton(jobId, "Approve or decline"),
  ],
});

// the Client approved an increase, and it's charged
export const approvedEmail = ({
  name,
  jobId,
  clean,
  label,
  amountCents,
  totalCents,
  owedCents,
  settled,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  label: string;
  // the increase, tax included
  amountCents: number;
  // the clean's new total
  totalCents: number;
  owedCents: number;
  settled: Settled;
}): Email => ({
  subject: "Your receipt for a price change",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Thanks for approving ${label}: ${formatMoney(amountCents)}, tax included. The clean now comes to ${formatMoney(totalCents)}.`,
    ),
    cleanDetails(clean),
    ...moneyLines(settled, owedCents),
    portalButton(jobId, "See your receipt"),
  ],
});

// the fee for a Job that didn't happen, taken after a correction
export const feeTakenEmail = ({
  name,
  jobId,
  clean,
  feeCents,
  owedCents,
  settled,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  feeCents: number;
  owedCents: number;
  settled: Settled;
}): Email => ({
  subject: "We've taken the fee for your clean",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(`This is the ${formatMoney(feeCents)} fee for your clean.`),
    cleanDetails(clean),
    ...moneyLines(settled, owedCents),
    portalButton(jobId),
  ],
});

export const correctedEmail = ({
  name,
  jobId,
  clean,
  totalCents,
  owedCents,
  settled,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  totalCents: number;
  owedCents: number;
  settled: Settled;
}): Email => ({
  subject: "We've corrected the price of your clean",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `We've corrected the price of your clean. It's now ${formatMoney(totalCents)}, tax included.`,
    ),
    cleanDetails(clean),
    ...moneyLines(settled, owedCents),
    portalButton(jobId, "See your receipt"),
  ],
});

// a payment tried again went through: after a new card, or once the payment
// provider could be reached (ADR-0022). Its price didn't change
export const paymentWentThroughEmail = ({
  name,
  jobId,
  clean,
  owedCents,
  settled,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  owedCents: number;
  settled: Settled;
}): Email => {
  const what = settled.chargedCents > 0 ? "payment" : "refund";
  return {
    subject: `Your ${what} went through`,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(`Your ${what} for your clean went through.`),
      cleanDetails(clean),
      ...moneyLines(settled, owedCents),
      portalButton(jobId, "See your receipt"),
    ],
  };
};

// it was marked done by mistake, and is booked again
export const completionUndoneEmail = ({
  name,
  clean,
  settled,
}: {
  name: string;
  clean: Clean;
  settled: Settled;
}): Email => ({
  subject: "A correction to your clean",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      "Your clean was marked done by mistake, so we've put it back as booked.",
    ),
    cleanDetails(clean),
    ...moneyLines(settled, 0),
    button("See your cleans", "/portal"),
  ],
});

// the day after a Client's first Completed Job, once (#175): one link straight
// to Google's write-a-review box. Every Client gets the same email, however
// the clean went: asking only the happy ones, or offering anything for a
// review, is against Google's policy
export const reviewRequestEmail = ({
  name,
  reviewUrl,
}: {
  name: string;
  reviewUrl: string;
}): Email => ({
  subject: "How was your clean?",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      "Thank you for choosing Empire Cleaning. If you have a minute, we'd love to hear how your clean went in a Google review. It helps your neighbors find us, and tells us what we can do better.",
    ),
    button("Leave a Google review", reviewUrl),
  ],
});
