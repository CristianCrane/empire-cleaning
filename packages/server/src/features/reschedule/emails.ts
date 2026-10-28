import type { RescheduleCost } from "@empire-cleaning/models";
import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import {
  firstNameOf,
  formatMoney,
  formatWhen,
} from "../../services/email/format.ts";
import { jobsButton } from "../assignments/emails.ts";

const portalButton = (jobId: string) =>
  button("See your clean", `/portal/jobs/${jobId}`);
const officeButton = (jobId: string) =>
  button("See the Job", `/office/jobs/${jobId}`);

// how the Office hears what moving it costs
export const costLabel: Record<RescheduleCost, string> = {
  free: "free",
  free_late: "a Late Reschedule, free as the Job's first",
  late_cancellation: "a Late Cancellation, with the Deposit amount as the fee",
};

// to the Office: a Client asked to move a Job, to `clean`'s time
export const rescheduleAskedEmail = ({
  client,
  jobId,
  clean,
  from,
  cost,
}: {
  client: string;
  jobId: string;
  clean: Clean;
  from: Date;
  cost: RescheduleCost;
}): Email => ({
  subject: `${client} asked to move a Job`,
  blocks: [
    paragraph(`${client} has asked to move this Job:`),
    cleanDetails(clean, from),
    paragraph(
      `It's ${costLabel[cost]}. The new time is held for them until you confirm it or turn it down.`,
    ),
    officeButton(jobId),
  ],
});

// the Job keeps its time, `clean`'s
export const rescheduleTurnedDownEmail = ({
  name,
  jobId,
  clean,
  asked,
  reason,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  asked: Date;
  reason: string | null;
}): Email => ({
  subject: "We couldn't move your clean",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `We're sorry: we can't move your clean to ${formatWhen(asked)}.${reason ? ` ${reason}` : ""}`,
    ),
    paragraph(
      "It stays booked as it was, and there's no charge. You can ask for another time from your account.",
    ),
    cleanDetails(clean),
    portalButton(jobId),
  ],
});

// what moving it costs, from what the request was
const costLine = ({
  cost,
  feeCents,
  onPlan,
  lateHours,
}: {
  cost: RescheduleCost;
  feeCents: number;
  onPlan: boolean;
  lateHours: number;
}) =>
  cost === "free"
    ? "There's no charge for moving it."
    : cost === "free_late"
      ? `As it was less than ${lateHours} hours before the clean, it's a Late Reschedule. Your first one is free${onPlan ? "" : ", and your Deposit still counts towards the price"}.`
      : feeCents > 0
        ? onPlan
          ? `As it's a second Late Reschedule, it's a Late Cancellation, with a ${formatMoney(feeCents)} fee (the same as your plan's Deposit), charged with the price when the clean is done.`
          : `As it's a second Late Reschedule, it's a Late Cancellation: your ${formatMoney(feeCents)} Deposit is kept as the fee, and the full price is charged when the clean is done.`
        : onPlan
          ? "An earlier Late Reschedule already made the fee due, so there's nothing more to pay for moving it."
          : "Your Deposit was already kept as the fee for an earlier Late Reschedule, so there's nothing more to pay for moving it.";

// the Office confirmed the Client's request
export const rescheduleConfirmedEmail = ({
  name,
  jobId,
  clean,
  from,
  ...cost
}: {
  name: string;
  jobId: string;
  clean: Clean;
  from: Date;
  cost: RescheduleCost;
  feeCents: number;
  onPlan: boolean;
  lateHours: number;
}): Email => ({
  subject: "Your clean has moved",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("We've moved your clean, as you asked."),
    cleanDetails(clean, from),
    paragraph(costLine(cost)),
    portalButton(jobId),
  ],
});

// the Office moved it themselves, from the Schedule
export const jobMovedEmail = ({
  name,
  jobId,
  clean,
  from,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  from: Date;
}): Email => ({
  subject: "Your clean has moved",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("We've moved your clean."),
    cleanDetails(clean, from),
    paragraph(
      "There's no charge for this. If the new time doesn't suit you, you can ask for another from your account, or call us.",
    ),
    portalButton(jobId),
  ],
});

// to each of the crew still on it, Offered the new time afresh
export const crewMovedEmail = ({
  name,
  jobId,
  clean,
  from,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  from: Date;
}): Email => ({
  subject: "A Job you're on has moved",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("A Job you're on has moved:"),
    cleanDetails(clean, from),
    paragraph(
      "Please confirm your place at the new time, or release it if you can't make it.",
    ),
    button("See the Job", `/cleaner/jobs/${jobId}`),
  ],
});

// to each of the crew who isn't free at the new time
export const crewLostEmail = ({
  name,
  clean,
  from,
}: {
  name: string;
  clean: Clean;
  from: Date;
}): Email => ({
  subject: "You're no longer on a Job",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `A Job you were on has moved to ${formatWhen(clean.startsAt)}, when you aren't free, so you're no longer on it. You don't need to go.`,
    ),
    cleanDetails(clean, from),
    jobsButton,
  ],
});
