import type { OpenPlace } from "@empire-cleaning/models";
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
    paragraph("You've been offered a place on this Job:"),
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
  subject: `${cleaner} released a place on a Job`,
  blocks: [
    paragraph(`${cleaner} has released their place on this Job:`),
    cleanDetails(clean),
    paragraph(
      "It's open to every free Cleaner now, or you can offer it to someone.",
    ),
    button("See the Job", `/office/jobs/${jobId}`),
  ],
});

// "Deep Clean, Thursday, January 8 at 9:00 AM, 11375, about 3 hours on site,
// crew of 2"
const lineFor = (place: OpenPlace) =>
  [
    place.serviceName,
    formatWhen(new Date(place.startsAt)),
    place.postcode,
    `about ${place.hoursOnSite} ${place.hoursOnSite === 1 ? "hour" : "hours"} on site`,
    place.crewSize === 1 ? "on your own" : `crew of ${place.crewSize}`,
  ].join(", ");

// the morning's list of every place open to a Cleaner, new ones first, or
// (`soon`) the places within 48 hours that have just opened
export const openPlacesEmail = ({
  name,
  soon,
  places,
}: {
  name: string;
  soon: boolean;
  places: OpenPlace[];
}): Email => ({
  subject: soon ? "A Job soon is open to you" : "Jobs open to you",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      soon
        ? "These Jobs in the next two days have places open, and you're free for them:"
        : "These Jobs have places open, and you're free for them. New ones first:",
    ),
    ...places.map((place) => paragraph(lineFor(place))),
    paragraph("The first to confirm takes each place."),
    places.length === 1
      ? button("See the Job", `/cleaner/open/${places[0]!.jobId}`)
      : button("See the Jobs", "/cleaner"),
  ],
});
