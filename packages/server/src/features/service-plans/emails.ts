import type { EndPlanTerms } from "@empire-cleaning/models";
import {
  button,
  greeting,
  paragraph,
  type Email,
} from "../../services/email/blocks.ts";
import {
  firstNameOf,
  formatMoney,
  formatWhen,
} from "../../services/email/format.ts";
import type { Settled } from "../completion/balance.ts";

const whenList = (times: string[]) =>
  times.map((t) => formatWhen(new Date(t))).join("; ");

export const planEndedEmail = ({
  name,
  address,
  planId,
  terms,
  settled,
  cutoffHours,
}: {
  name: string;
  address: string;
  planId: string;
  terms: EndPlanTerms;
  settled: Settled;
  cutoffHours: number;
}): Email => {
  const card = settled.paymentMethod ?? "card";
  const final = formatWhen(new Date(terms.finalJob.startsAt));
  return {
    subject: "Your Service Plan has Ended",
    blocks: [
      greeting(firstNameOf(name)),
      ...[
        `We've Ended your Service Plan at ${address}, as you asked.`,
        ...(terms.cancelled.length > 0
          ? [
              `We've cancelled the cleans it had booked, free: ${whenList(terms.cancelled)}.`,
            ]
          : []),
        ...(terms.goingAhead.length > 0
          ? [
              `Your clean on ${whenList(terms.goingAhead)} is less than ${cutoffHours} hours away, so it goes ahead.`,
            ]
          : []),
        // refunded, it's said below
        ...(terms.depositCents > 0 && terms.deposit !== "refunded"
          ? terms.deposit === "comes_off"
            ? [
                `Your ${formatMoney(terms.depositCents)} Deposit comes off the price of your clean on ${final}.`,
              ]
            : [
                `Your ${formatMoney(terms.depositCents)} Deposit goes towards your clean on ${final}.`,
              ]
          : []),
        ...(settled.refundedCents > 0
          ? [
              `We've refunded ${formatMoney(settled.refundedCents)} to your ${card}. It can take a few days to reach you.`,
            ]
          : []),
        ...(settled.chargedCents > 0
          ? [
              `We've charged the ${formatMoney(settled.chargedCents)} still to pay to your ${card}.`,
            ]
          : []),
        ...(settled.billed
          ? [
              "Whatever your final clean still owes, or is owed, goes on your next weekly bill.",
            ]
          : []),
        "To book another clean, request a Quote from your account.",
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
  subject: `${client} Ended their Service Plan`,
  blocks: [
    paragraph(`${client} has Ended their Service Plan at ${address}.`),
    paragraph(
      terms.cancelled.length > 0
        ? `Its ${terms.cancelled.length} booked ${terms.cancelled.length === 1 ? "Job is" : "Jobs are"} cancelled, free.`
        : "It had no Jobs booked more than 24 hours out.",
    ),
    ...(terms.goingAhead.length > 0
      ? [paragraph(`Going ahead: ${whenList(terms.goingAhead)}.`)]
      : []),
    button("See the plan", `/office/service-plans/${planId}`),
  ],
});
