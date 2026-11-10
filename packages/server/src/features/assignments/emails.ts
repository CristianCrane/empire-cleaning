import {
  catalog,
  type CleanerNeeded,
  formats,
  type Language,
} from "@empire-cleaning/models";
import {
  officeJobButton,
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

// What emails to a Cleaner say, in their Preferred Language (ADR-0025),
// tú in Spanish. `crewWords` are the words several of them share, here and
// in the move and cancellation emails; the Spanish is a draft the owner
// checks (#206)
export const crewWords = catalog({
  en: {
    SEE_JOB: "See the job",
    SEE_JOBS: "See your jobs",
    OFF_A_JOB: "You're no longer on a job",
    NO_NEED_TO_GO: "You don't need to go.",
  },
  es: {
    SEE_JOB: "Ver el trabajo",
    SEE_JOBS: "Ver tus trabajos",
    OFF_A_JOB: "Ya no estás en un trabajo",
    NO_NEED_TO_GO: "No necesitas ir.",
  },
});

const words = catalog({
  en: {
    offer: {
      subject: "You've been offered a job",
      offered: "You've been offered this job:",
      answer: "Please confirm it, or drop out if you can't make it.",
    },
    TAKEN_OFF: "The office has taken you off this job.",
    needed: {
      subject: (soon: boolean) =>
        soon ? "An open job, soon" : "Open jobs for you",
      intro: (soon: boolean) =>
        soon
          ? "These jobs in the next two days need a cleaner, and you're free:"
          : "These jobs need a cleaner, and you're free. Newest first:",
      onSite: (hours: string, n: number) =>
        `about ${hours} ${n === 1 ? "hour" : "hours"} on site`,
      crew: (n: number) => (n === 1 ? "on your own" : `with ${n} cleaners`),
      FIRST_TO_CONFIRM: "Each goes to the first cleaner to confirm.",
      SEE_THE_JOBS: "See the jobs",
    },
  },
  es: {
    offer: {
      subject: "Te ofrecieron un trabajo",
      offered: "Te ofrecieron este trabajo:",
      answer: "Por favor, confírmalo, o déjalo si no puedes ir.",
    },
    TAKEN_OFF: "La oficina te quitó de este trabajo.",
    needed: {
      subject: (soon: boolean) =>
        soon ? "Un trabajo disponible, pronto" : "Trabajos disponibles para ti",
      intro: (soon: boolean) =>
        soon
          ? "Estos trabajos de los próximos dos días necesitan un limpiador, y estás libre:"
          : "Estos trabajos necesitan un limpiador, y estás libre. Los más nuevos primero:",
      onSite: (hours: string, n: number) =>
        n === 1 ? "una hora en el lugar" : `unas ${hours} horas en el lugar`,
      crew: (n: number) => (n === 1 ? "tú solo" : `con ${n} limpiadores`),
      FIRST_TO_CONFIRM: "Cada uno es para el primer limpiador que lo confirme.",
      SEE_THE_JOBS: "Ver los trabajos",
    },
  },
});

// a Cleaner's own Job page; their list is /cleaner
export const jobButton = (lang: Language, jobId: string) =>
  button(crewWords[lang].SEE_JOB, `/cleaner/jobs/${jobId}`);
export const jobsButton = (lang: Language) =>
  button(crewWords[lang].SEE_JOBS, "/cleaner");

export const offerEmail = (
  lang: Language,
  { name, jobId, clean }: { name: string; jobId: string; clean: Clean },
): Email => {
  const w = words[lang].offer;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.offered),
      cleanDetails(lang, clean),
      paragraph(w.answer),
      jobButton(lang, jobId),
    ],
  };
};

export const takenOffEmail = (
  lang: Language,
  { name, clean }: { name: string; clean: Clean },
): Email => ({
  lang,
  subject: crewWords[lang].OFF_A_JOB,
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(`${words[lang].TAKEN_OFF} ${crewWords[lang].NO_NEED_TO_GO}`),
    cleanDetails(lang, clean),
    jobsButton(lang),
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
  lang: "en",
  subject: `${cleaner} dropped out of a job`,
  blocks: [
    paragraph(`${cleaner} can't make this job, so it needs a cleaner:`),
    cleanDetails("en", clean),
    paragraph("Free cleaners can take it now, or you can offer it to someone."),
    officeJobButton(jobId),
  ],
});

// "Deep Clean, Thursday, January 8 at 9:00 AM, 11375, about 3 hours on site,
// with 2 cleaners"
const lineFor = (lang: Language, job: CleanerNeeded) => {
  const w = words[lang].needed;
  const { formatNumber, formatWhen } = formats[lang];
  return [
    job.serviceName,
    formatWhen(new Date(job.startsAt)),
    job.postcode,
    w.onSite(formatNumber(job.hoursOnSite), job.hoursOnSite),
    w.crew(job.crewSize),
  ].join(", ");
};

// the morning's list of every Job open to a Cleaner, new ones first, or
// (`soon`) the Jobs within 48 hours that have just opened
export const cleanersNeededEmail = (
  lang: Language,
  {
    name,
    soon,
    jobs,
  }: {
    name: string;
    soon: boolean;
    jobs: CleanerNeeded[];
  },
): Email => {
  const w = words[lang].needed;
  return {
    lang,
    subject: w.subject(soon),
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.intro(soon)),
      ...jobs.map((job) => paragraph(lineFor(lang, job))),
      paragraph(w.FIRST_TO_CONFIRM),
      jobs.length === 1
        ? button(crewWords[lang].SEE_JOB, `/cleaner/open/${jobs[0]!.jobId}`)
        : button(w.SEE_THE_JOBS, "/cleaner/offers"),
    ],
  };
};
