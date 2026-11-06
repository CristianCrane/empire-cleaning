import type { CleanerNeeded } from "@empire-cleaning/models";
import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf, formatWhen } from "../../services/email/format.ts";

// a Cleaner's own Job page; their list is /cleaner
const jobButton = (jobId: string) =>
  button("See the Job", `/cleaner/jobs/${jobId}`);
export const jobsButton = button("See your Jobs", "/cleaner");

export const offerEmail = ({
  name,
  jobId,
  clean,
}: {
  name: string;
  jobId: string;
  clean: Clean;
}): Email => ({
  subject: "You've been offered a Job",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("You've been offered this Job:"),
    cleanDetails(clean),
    paragraph("Please confirm it, or release it if you can't make it."),
    jobButton(jobId),
  ],
});

export const takenOffEmail = ({
  name,
  clean,
}: {
  name: string;
  clean: Clean;
}): Email => ({
  subject: "You're no longer on a Job",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("The Office has taken you off this Job. You don't need to go."),
    cleanDetails(clean),
    jobsButton,
  ],
});

// to the Office
export const releasedEmail = ({
  cleaner,
  jobId,
  clean,
}: {
  cleaner: string;
  jobId: string;
  clean: Clean;
}): Email => ({
  subject: `${cleaner} released a Job`,
  blocks: [
    paragraph(`${cleaner} has released this Job, so it needs a Cleaner:`),
    cleanDetails(clean),
    paragraph(
      "It's open to every free Cleaner now, or you can offer it to someone.",
    ),
    button("See the Job", `/office/jobs/${jobId}`),
  ],
});

// "Deep Clean, Thursday, January 8 at 9:00 AM, 11375, about 3 hours on site,
// crew of 2"
const lineFor = (job: CleanerNeeded) =>
  [
    job.serviceName,
    formatWhen(new Date(job.startsAt)),
    job.postcode,
    `about ${job.hoursOnSite} ${job.hoursOnSite === 1 ? "hour" : "hours"} on site`,
    job.crewSize === 1 ? "on your own" : `crew of ${job.crewSize}`,
  ].join(", ");

// the morning's list of every Job open to a Cleaner, new ones first, or
// (`soon`) the Jobs within 48 hours that have just opened
export const cleanersNeededEmail = ({
  name,
  soon,
  jobs,
}: {
  name: string;
  soon: boolean;
  jobs: CleanerNeeded[];
}): Email => ({
  subject: soon ? "A Job soon is open to you" : "Jobs open to you",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      soon
        ? "These Jobs in the next two days need a Cleaner, and you're free for them:"
        : "These Jobs need a Cleaner, and you're free for them. New ones first:",
    ),
    ...jobs.map((job) => paragraph(lineFor(job))),
    paragraph("Each one goes to the first Cleaner to confirm."),
    jobs.length === 1
      ? button("See the Job", `/cleaner/open/${jobs[0]!.jobId}`)
      : button("See the Jobs", "/cleaner"),
  ],
});
