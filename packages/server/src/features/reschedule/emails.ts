import {
  catalog,
  moveCostForOffice,
  type Language,
  type MoveCost,
  formats,
  messages,
  oneStop,
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

// the Office's and Cleaners' (#305)
const { formatWhen } = formats.en;

const words = catalog({
  en: {
    SEE_CLEAN: "See your clean",
    turnedDown: {
      subject: "We couldn't move your clean",
      sorry: (asked: string) =>
        `We're sorry: we can't move your clean to ${asked}.`,
      stays:
        "It stays booked as it was, and there's no charge. You can ask for another time from your account.",
    },
    MOVED_SUBJECT: "Your clean has moved",
    AS_ASKED: "We've moved your clean, as you asked.",
    WE_MOVED: "We've moved your clean.",
    NO_CHARGE:
      "There's no charge for this. If the new time doesn't suit you, you can ask for another from your account, or call us.",
  },
  es: {
    SEE_CLEAN: "Ver su limpieza",
    turnedDown: {
      subject: "No pudimos reprogramar su limpieza",
      sorry: (asked: string) =>
        oneStop(
          `Lo sentimos: no podemos reprogramar su limpieza para el ${asked}.`,
        ),
      stays:
        "Sigue reservada como estaba, y no tiene ningún cargo. Puede pedir otra hora desde su cuenta.",
    },
    MOVED_SUBJECT: "Su limpieza cambió de hora",
    AS_ASKED: "Reprogramamos su limpieza, como nos pidió.",
    WE_MOVED: "Reprogramamos su limpieza.",
    NO_CHARGE:
      "Esto no tiene ningún cargo. Si la nueva hora no le conviene, puede pedir otra desde su cuenta, o llamarnos.",
  },
});

const portalButton = (lang: Language, jobId: string) =>
  button(words[lang].SEE_CLEAN, `/portal/jobs/${jobId}`);
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
  lang: "en",
  subject: `${client} asked to move a job`,
  blocks: [
    paragraph(`${client} asked to move this job:`),
    cleanDetails("en", clean, from),
    paragraph(
      `${moveCostForOffice(cost)} The new time is held for them until you confirm it or turn it down.`,
    ),
    officeButton(jobId),
  ],
});

// the Job keeps its time, `clean`'s; the Office's reason as they wrote it
export const rescheduleTurnedDownEmail = (
  lang: Language,
  {
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
  },
): Email => {
  const w = words[lang].turnedDown;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(
        `${w.sorry(formats[lang].formatWhen(asked))}${reason ? ` ${reason}` : ""}`,
      ),
      paragraph(w.stays),
      cleanDetails(lang, clean),
      portalButton(lang, jobId),
    ],
  };
};

// the Office confirmed the Client's request; what it costs, its fee in
// the Client's money
export const rescheduleConfirmedEmail = (
  lang: Language,
  {
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
    cost: Omit<MoveCost, "fee">;
  },
): Email => ({
  lang,
  subject: words[lang].MOVED_SUBJECT,
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(words[lang].AS_ASKED),
    cleanDetails(lang, clean, from),
    paragraph(
      messages[lang].moveCostForClient({
        ...cost,
        fee: formats[lang].formatMoney(cost.feeCents),
      }),
    ),
    portalButton(lang, jobId),
  ],
});

// the Office moved it themselves, from the Schedule
export const jobMovedEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    from,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    from: Date;
  },
): Email => ({
  lang,
  subject: words[lang].MOVED_SUBJECT,
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(words[lang].WE_MOVED),
    cleanDetails(lang, clean, from),
    paragraph(words[lang].NO_CHARGE),
    portalButton(lang, jobId),
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
  lang: "en",
  subject: "A job you're on has moved",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("A job you're on has moved:"),
    cleanDetails("en", clean, from),
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
  lang: "en",
  subject: "You're no longer on a job",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `A job you were on moved to ${formatWhen(clean.startsAt)}, when you're not free, so you're off it. You don't need to go.`,
    ),
    cleanDetails("en", clean, from),
    jobsButton,
  ],
});
