import {
  moveCostForOffice,
  type MoveCost,
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
import { jobsButton } from "../assignments/emails.ts";

const { moveCostForClient } = messages.en;

const { formatWhen } = formats.en;

const portalButton = (jobId: string) =>
  button("See your clean", `/portal/jobs/${jobId}`);
const officeButton = (jobId: string) =>
  button("See the job", `/office/jobs/${jobId}`);

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
  cost: MoveCost;
}): Email => ({
  subject: `${client} asked to move a job`,
  blocks: [
    paragraph(`${client} asked to move this job:`),
    cleanDetails(clean, from),
    paragraph(
      `${moveCostForOffice(cost)} The new time is held for them until you confirm it or turn it down.`,
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

// the Office confirmed the Client's request
export const rescheduleConfirmedEmail = ({
  name,
  jobId,
  clean,
  from,
  cost,
}: {
  name: string;
  jobId: string;
  clean: Clean;
  from: Date;
  cost: MoveCost;
}): Email => ({
  subject: "Your clean has moved",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("We've moved your clean, as you asked."),
    cleanDetails(clean, from),
    paragraph(moveCostForClient(cost)),
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
