import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf, formatMoney } from "../../services/email/format.ts";
import { jobsButton } from "../assignments/emails.ts";
import type { Settled } from "../completion/balance.ts";

// for a Client whose plan an Unpaid Job has put On Hold
export const ON_HOLD_LINE =
  "Until it's paid, your Service Plan is On Hold: cleans already booked go ahead, but we won't book any more.";

// what was refunded, as a line for the Client
const refundLine = (settled: Settled) =>
  settled.refundedCents > 0
    ? [
        `We've refunded ${formatMoney(settled.refundedCents)} to your ${settled.paymentMethod ?? "card"}. It can take a few days to reach you.`,
      ]
    : [];

// how taking a plan Job's fee went, as a line for the Client
const feeChargeLine = (settled: Settled) => {
  if (settled.billed) return ["It goes on your weekly bill."];
  const card = settled.paymentMethod ?? "card";
  if (settled.chargedCents > 0) return [`We've charged it to your ${card}.`];
  if (settled.failure) {
    return [
      `We couldn't charge it to your ${card}. Please update your Payment Method, and we'll try again straight away.`,
      ...(settled.plan === "held" ? [ON_HOLD_LINE] : []),
    ];
  }
  return [];
};

const portalButton = (jobId: string) =>
  button("See your clean", `/portal/jobs/${jobId}`);
const officeButton = (jobId: string) =>
  button("See the Job", `/office/jobs/${jobId}`);

export type Cancelled = {
  name: string;
  jobId: string;
  clean: Clean;
  // the Client cancelled it, or skipped it on a plan, or Empire Cleaning did
  // with a reason
  by: "client" | "empire";
  reason: string | null;
  onPlan: boolean;
  late: boolean;
  feeCents: number;
  settled: Settled;
  // a Late Cancellation is within this many hours of the clean
  cutoffHours: number;
};

export const cancelledEmail = ({
  name,
  jobId,
  clean,
  by,
  reason,
  onPlan,
  late,
  feeCents: fee,
  settled,
  cutoffHours,
}: Cancelled): Email => {
  const lines =
    by === "empire"
      ? [
          `We're sorry: we've had to cancel your clean.${reason ? ` ${reason}` : ""}`,
          "You won't be charged anything for it.",
        ]
      : onPlan
        ? [
            "We've skipped your clean, as you asked.",
            late && fee > 0
              ? `As it was less than ${cutoffHours} hours before the clean, it's a Late Cancellation, with a ${formatMoney(fee)} fee: the same as your plan's Deposit, which stays held.`
              : fee > 0
                ? `The ${formatMoney(fee)} fee for an earlier Late Reschedule is still to pay.`
                : "There's no charge for skipping it.",
            ...feeChargeLine(settled),
          ]
        : [
            "We've cancelled your clean, as you asked.",
            late && fee > 0
              ? `As it was less than ${cutoffHours} hours before the clean, it's a Late Cancellation: your ${formatMoney(fee)} Deposit is kept as the fee.`
              : fee > 0
                ? `Your ${formatMoney(fee)} Deposit was already kept as the fee for a Late Reschedule, so there's nothing more to pay.`
                : "There's no charge for cancelling.",
          ];
  const [first, ...rest] = lines;
  return {
    subject:
      onPlan && by === "client"
        ? "Your clean is skipped"
        : "Your clean is cancelled",
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(first!),
      cleanDetails(clean),
      ...[
        ...rest,
        ...refundLine(settled),
        onPlan
          ? "Your Service Plan carries on as usual."
          : "To book another clean, request a Quote from your account.",
      ].map(paragraph),
      portalButton(jobId),
    ],
  };
};

// everyone holding a place on it hears it's off
export const crewCancelledEmail = ({
  name,
  clean,
}: {
  name: string;
  clean: Clean;
}): Email => ({
  subject: "A Job you're on is cancelled",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("We've cancelled this Job. You don't need to go."),
    cleanDetails(clean),
    jobsButton,
  ],
});

// the Office hears when a Client cancels or skips a Job themselves
export const officeCancelledEmail = ({
  client,
  jobId,
  clean,
  onPlan,
  late,
  feeCents,
  failure,
}: {
  client: string;
  jobId: string;
  clean: Clean;
  onPlan: boolean;
  late: boolean;
  feeCents: number;
  // why the fee couldn't be charged
  failure: string | null;
}): Email => ({
  subject: onPlan
    ? `${client} skipped a plan Job`
    : `${client} cancelled a Job`,
  blocks: [
    paragraph(
      onPlan
        ? `${client} has skipped this Job. Their Service Plan carries on.`
        : `${client} has cancelled this Job.`,
    ),
    cleanDetails(clean),
    paragraph(
      onPlan
        ? late
          ? `It was a Late Cancellation, so the ${formatMoney(feeCents)} fee is charged.`
          : feeCents > 0
            ? `It was more than 24 hours ahead, but the ${formatMoney(feeCents)} fee for a Late Reschedule is charged.`
            : "It was more than 24 hours ahead, so there's no fee."
        : late
          ? "It was a Late Cancellation, so the Deposit is kept as the fee."
          : feeCents > 0
            ? "It was more than 24 hours ahead, but a Late Reschedule had already kept the Deposit as the fee."
            : "It was more than 24 hours ahead, so the Deposit has been refunded.",
    ),
    ...(failure
      ? [
          paragraph(
            `The fee couldn't be charged (${failure}), so the Job is Unpaid.`,
          ),
        ]
      : []),
    officeButton(jobId),
  ],
});

export const noAccessEmail = ({
  name,
  jobId,
  clean,
  reason,
  feeCents,
  onPlan,
  settled,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  // what the Cleaner said happened
  reason: string;
  feeCents: number;
  onPlan: boolean;
  settled: Settled;
}): Email => ({
  subject: "We couldn't get in for your clean",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Our team came for your clean, but couldn't get in ("${reason}").`,
    ),
    cleanDetails(clean),
    ...[
      feeCents === 0
        ? "There's no charge for it."
        : onPlan
          ? `As with a Late Cancellation, there's a ${formatMoney(feeCents)} fee: the same as your plan's Deposit, which stays held.`
          : `As with a Late Cancellation, your ${formatMoney(feeCents)} Deposit is kept as the fee.`,
      ...(onPlan ? feeChargeLine(settled) : []),
      ...refundLine(settled),
      onPlan
        ? "Your Service Plan carries on as usual. Please check your Access Instructions before your next clean."
        : "To book another clean, request a Quote from your account. Please check your Access Instructions first.",
    ].map(paragraph),
    portalButton(jobId),
  ],
});

export const officeNoAccessEmail = ({
  cleaner,
  client,
  jobId,
  clean,
  reason,
  onPlan,
  failure,
}: {
  cleaner: string;
  client: string;
  jobId: string;
  clean: Clean;
  reason: string;
  onPlan: boolean;
  failure: string | null;
}): Email => ({
  subject: `No Access at ${clean.address}`,
  blocks: [
    paragraph(`${cleaner} couldn't get in for this Job ("${reason}").`),
    cleanDetails(clean),
    paragraph(
      onPlan
        ? failure
          ? `${client} has been told. The fee couldn't be charged (${failure}), so the Job is Unpaid.`
          : `${client} has been told, and the fee is charged.`
        : `${client} has been told, and the Deposit is kept as the fee.`,
    ),
    officeButton(jobId),
  ],
});
