import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";
import { jobsButton } from "../assignments/emails.ts";
import type { Settled } from "../completion/balance.ts";
import { BOOK_ANOTHER } from "../quotes/emails.ts";
import {
  clientFix,
  notTaken,
  cancelCostForClient,
  cancelCostForOffice,
  noAccessFee,
  ON_THAT_WEEKS_BILL,
  PLAN_CARRIES_ON,
  PLAN_PAUSED,
  refundedTo,
  formats,
} from "@empire-cleaning/models";
import { whyNotPaid } from "../payments/unpaid.ts";

const { formatMoney } = formats.en;

// a fee that didn't go through, for the Office, and why
const feeNotPaid = (failure: string) => {
  const { why } = whyNotPaid(failure);
  return `The fee didn't go through${why ? ` (${why})` : ""}, so the job is unpaid.`;
};

// what was refunded, as a line for the Client
const refundLine = (settled: Settled) =>
  settled.refundedCents > 0
    ? [
        refundedTo(
          formatMoney(settled.refundedCents),
          settled.paymentMethod ?? "card",
        ),
      ]
    : [];

// how taking a plan Job's fee went, as a line for the Client
const feeChargeLine = (settled: Settled) => {
  if (settled.billed) return ["It goes on your weekly bill."];
  const card = settled.paymentMethod ?? "card";
  if (settled.chargedCents > 0) return [`We've charged it to your ${card}.`];
  if (settled.failure) {
    return [
      `${notTaken("it", card)} ${clientFix[whyNotPaid(settled.failure).kind]}`,
      ...(settled.plan === "held" ? [PLAN_PAUSED] : []),
    ];
  }
  return [];
};

// where a plan Job's fee went, for the Office: charged now, or on the Bill
// for the week the Job was in (ADR-0016), which needn't be the next one made
const feeTaken = (settled: Settled) =>
  settled.billed ? ON_THAT_WEEKS_BILL : "is charged";

const portalButton = (jobId: string) =>
  button("See your clean", `/portal/jobs/${jobId}`);
const officeButton = (jobId: string) =>
  button("See the job", `/office/jobs/${jobId}`);

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
}: Cancelled): Email => {
  const lines =
    by === "empire"
      ? [
          `We're sorry, we've had to cancel your clean.${reason ? ` ${reason}` : ""}`,
          "You won't be charged anything for it.",
        ]
      : [
          onPlan
            ? "We've skipped your clean, as you asked."
            : "We've cancelled your clean, as you asked.",
          cancelCostForClient({
            onPlan,
            late,
            feeCents: fee,
            fee: formatMoney(fee),
          }),
          ...(onPlan ? feeChargeLine(settled) : []),
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
        onPlan ? PLAN_CARRIES_ON : BOOK_ANOTHER,
      ].map(paragraph),
      portalButton(jobId),
    ],
  };
};

// everyone on its crew hears it's off
export const crewCancelledEmail = ({
  name,
  clean,
}: {
  name: string;
  clean: Clean;
}): Email => ({
  subject: "A job you're on is cancelled",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("We've cancelled this job. You don't need to go."),
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
  settled,
}: {
  client: string;
  jobId: string;
  clean: Clean;
  onPlan: boolean;
  late: boolean;
  feeCents: number;
  settled: Settled;
}): Email => ({
  subject: onPlan
    ? `${client} skipped a cleaning plan job`
    : `${client} cancelled a job`,
  blocks: [
    paragraph(
      onPlan
        ? `${client} has skipped this job. Their cleaning plan carries on.`
        : `${client} has cancelled this job.`,
    ),
    cleanDetails(clean),
    paragraph(
      cancelCostForOffice({
        onPlan,
        late,
        feeCents,
        fee: formatMoney(feeCents),
        weeklyBill: settled.billed,
        failed: settled.failure !== null,
        refund:
          settled.refundedCents > 0 ? formatMoney(settled.refundedCents) : null,
      }),
    ),
    ...(settled.failure ? [paragraph(feeNotPaid(settled.failure))] : []),
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
        : noAccessFee({ onPlan, fee: formatMoney(feeCents) }),
      ...(onPlan ? feeChargeLine(settled) : []),
      ...refundLine(settled),
      onPlan
        ? `${PLAN_CARRIES_ON} Before your next clean, please check how we get in.`
        : `${BOOK_ANOTHER} Please check how we get in first.`,
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
  settled,
}: {
  cleaner: string;
  client: string;
  jobId: string;
  clean: Clean;
  reason: string;
  onPlan: boolean;
  settled: Settled;
}): Email => ({
  subject: `Couldn't get in at ${clean.address}`,
  blocks: [
    paragraph(`${cleaner} couldn't get in for this job ("${reason}").`),
    cleanDetails(clean),
    paragraph(
      onPlan
        ? settled.failure
          ? `${client} has been told. ${feeNotPaid(settled.failure)}`
          : `${client} has been told, and the fee ${feeTaken(settled)}.`
        : `${client} has been told, and the deposit is kept as the fee.`,
    ),
    officeButton(jobId),
  ],
});
