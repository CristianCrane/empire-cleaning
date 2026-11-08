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
  button("See the job", `/cleaner/jobs/${jobId}`);
export const jobsButton = button("See your jobs", "/cleaner");

export const offerEmail = ({
  name,
  jobId,
  clean,
}: {
  name: string;
  jobId: string;
  clean: Clean;
}): Email => ({
  subject: "You've been offered a job",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("You've been offered this job:"),
    cleanDetails(clean),
    paragraph("Please confirm it, or drop out if you can't make it."),
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
  subject: "You're no longer on a job",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("The office has taken you off this job. You don't need to go."),
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
  subject: `${cleaner} dropped out of a job`,
  blocks: [
    paragraph(`${cleaner} can't make this job, so it needs a cleaner:`),
    cleanDetails(clean),
    paragraph("Free cleaners can take it now, or you can offer it to someone."),
    button("See the job", `/office/jobs/${jobId}`),
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
    job.crewSize === 1 ? "on your own" : `with ${job.crewSize} cleaners`,
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
  subject: soon ? "An open job, soon" : "Open jobs for you",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      soon
        ? "These jobs in the next two days need a cleaner, and you're free:"
        : "These jobs need a cleaner, and you're free. Newest first:",
    ),
    ...jobs.map((job) => paragraph(lineFor(job))),
    paragraph("Each goes to the first cleaner to confirm."),
    jobs.length === 1
      ? button("See the job", `/cleaner/open/${jobs[0]!.jobId}`)
      : button("See the jobs", "/cleaner"),
  ],
});
