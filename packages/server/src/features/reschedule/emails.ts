import type { BillPayment, RescheduleCost } from "@empire-cleaning/models";
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
import { ON_WEEKS_BILL } from "../bills/billed-weekly.ts";

const portalButton = (jobId: string) =>
  button("See your clean", `/portal/jobs/${jobId}`);
const officeButton = (jobId: string) =>
  button("See the job", `/office/jobs/${jobId}`);

// how the Office hears what moving it costs
export const costLabel: Record<RescheduleCost, string> = {
  free: "free",
  free_late: "free, as its first late move",
  late_cancellation: "charged as a late cancellation, the same as the deposit",
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
  subject: `${client} asked to move a job`,
  blocks: [
    paragraph(`${client} asked to move this job:`),
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

// what moving it costs, from what the request was, and where a fee goes:
// with the price when the clean is done, or on its week's Bill (ADR-0016)
const costLine = ({
  cost,
  feeCents,
  onPlan,
  weeklyBill,
  lateHours,
}: {
  cost: RescheduleCost;
  feeCents: number;
  onPlan: boolean;
  weeklyBill: BillPayment | null;
  lateHours: number;
}) =>
  cost === "free"
    ? "There's no charge for moving it."
    : cost === "free_late"
      ? `As it was less than ${lateHours} hours before the clean, it's a late move. Your first one is free${onPlan ? "" : ", and your deposit still counts toward the price"}.`
      : feeCents > 0
        ? onPlan
          ? `As it's your second late move, there's a ${formatMoney(feeCents)} late cancellation fee, ${weeklyBill ? `which ${ON_WEEKS_BILL} with the price` : "charged with the price when the clean is done"}.`
          : `As it's your second late move, your ${formatMoney(feeCents)} deposit is kept as a late cancellation fee, and the full price ${weeklyBill ? ON_WEEKS_BILL : "is charged when the clean is done"}.`
        : onPlan
          ? "The fee from an earlier late move covers this, so there's nothing more to pay."
          : "Your deposit was already kept for an earlier late move, so there's nothing more to pay.";

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
  weeklyBill: BillPayment | null;
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
  subject: "A job you're on has moved",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("A job you're on has moved:"),
    cleanDetails(clean, from),
    paragraph(
      "Please confirm you can make the new time, or release the job if you can't.",
    ),
    button("See the job", `/cleaner/jobs/${jobId}`),
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
  subject: "You're no longer on a job",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `A job you were on moved to ${formatWhen(clean.startsAt)}, when you're not free, so you're off it. You don't need to go.`,
    ),
    cleanDetails(clean, from),
    jobsButton,
  ],
});
