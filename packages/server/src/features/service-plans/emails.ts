import {
  CANCELLATION_CUTOFF_HOURS,
  type EndPlanTerms,
  formats,
  messages,
} from "@empire-cleaning/models";
import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";
import type { Settled } from "../completion/balance.ts";
import { CAN_GET_IN } from "../jobs/emails.ts";
import { BOOK_ANOTHER } from "../quotes/emails.ts";

const { refundedTo } = messages.en;

const { formatMoney, formatWhen } = formats.en;

const whenList = (times: string[]) =>
  times.map((t) => formatWhen(new Date(t))).join("; ");

// to the Client, when one of their plan's cleans is booked too late for the
// day-before reminder (#242)
export const planCleanBookedEmail = ({
  name,
  jobId,
  clean,
  freeToSkip,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  // booked less than 24 hours before it
  freeToSkip: boolean;
}): Email => ({
  subject: "Your next clean is booked",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("The next clean on your cleaning plan is booked."),
    cleanDetails(clean),
    ...(freeToSkip
      ? [
          paragraph(
            `It was booked less than ${CANCELLATION_CUTOFF_HOURS} hours ahead, so you can skip it for free.`,
          ),
        ]
      : []),
    paragraph(`${CAN_GET_IN}.`),
    button("See your clean", `/portal/jobs/${jobId}`),
  ],
});

export const planEndedEmail = ({
  name,
  address,
  planId,
  terms,
  settled,
}: {
  name: string;
  address: string;
  planId: string;
  terms: EndPlanTerms;
  settled: Settled;
}): Email => {
  const card = settled.paymentMethod ?? "card";
  const final = formatWhen(new Date(terms.finalJob.startsAt));
  return {
    subject: "Your cleaning plan has ended",
    blocks: [
      greeting(firstNameOf(name)),
      ...[
        `We've ended your cleaning plan at ${address}, as you asked.`,
        ...(terms.cancelled.length > 0
          ? [
              `We've cancelled the cleans it had booked, free: ${whenList(terms.cancelled)}.`,
            ]
          : []),
        ...(terms.goingAhead.length > 0
          ? [
              `Your clean on ${whenList(terms.goingAhead)} is less than ${CANCELLATION_CUTOFF_HOURS} hours away, so it goes ahead.`,
            ]
          : []),
        // refunded, it's said below
        ...(terms.depositCents > 0 && terms.deposit !== "refunded"
          ? terms.deposit === "comes_off"
            ? [
                `Your ${formatMoney(terms.depositCents)} deposit comes off the price of your clean on ${final}.`,
              ]
            : [
                `Your ${formatMoney(terms.depositCents)} deposit goes towards your clean on ${final}.`,
              ]
          : []),
        ...(settled.refundedCents > 0
          ? [refundedTo(formatMoney(settled.refundedCents), card)]
          : []),
        ...(settled.chargedCents > 0
          ? [
              `We've taken the ${formatMoney(settled.chargedCents)} still to pay from your ${card}.`,
            ]
          : []),
        ...(settled.billed
          ? [
              "Whatever your final clean still owes, or is owed, goes on your next weekly bill.",
            ]
          : []),
        BOOK_ANOTHER,
      ].map(paragraph),
      button("See your plan", `/portal/plans/${planId}`),
    ],
  };
};

// the Office hears when a Client Ends their plan themselves
export const officePlanEndedEmail = ({
  client,
  address,
  planId,
  terms,
}: {
  client: string;
  address: string;
  planId: string;
  terms: Pick<EndPlanTerms, "cancelled" | "goingAhead">;
}): Email => ({
  subject: `${client} ended their cleaning plan`,
  blocks: [
    paragraph(`${client} has ended their cleaning plan at ${address}.`),
    paragraph(
      terms.cancelled.length > 0
        ? `Its ${terms.cancelled.length} booked ${terms.cancelled.length === 1 ? "job is" : "jobs are"} cancelled, free.`
        : `It had no jobs booked more than ${CANCELLATION_CUTOFF_HOURS} hours out.`,
    ),
    ...(terms.goingAhead.length > 0
      ? [paragraph(`Going ahead: ${whenList(terms.goingAhead)}.`)]
      : []),
    button("See the plan", `/office/service-plans/${planId}`),
  ],
});
