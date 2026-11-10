import { catalog } from "../language.ts";

// What the server and the screens both say about a Cleaner's jobs
// (docs/ux.md, Words). Cleaners are tú in Spanish (ADR-0025)

// a Confirmed Assignment can't be Released this close to the Job: the
// Office needs time to find someone else
export const RELEASE_CUTOFF_HOURS = 48;

export const assignments = catalog({
  en: {
    RELEASE_CLOSED: `It's less than ${RELEASE_CUTOFF_HOURS} hours until this job, so you can't drop out here. Please call the office.`,
    // a started Job its crew can't mark done till each of them has confirmed
    // it
    NOT_ALL_CONFIRMED:
      "Not everyone on this job has confirmed it yet, so it can't be marked done. Please call the office.",
  },
  es: {
    RELEASE_CLOSED: `Faltan menos de ${RELEASE_CUTOFF_HOURS} horas para este trabajo, así que no puedes dejarlo desde aquí. Llama a la oficina, por favor.`,
    NOT_ALL_CONFIRMED:
      "Todavía no todos en este trabajo lo han confirmado, así que no se puede marcar como terminado. Llama a la oficina, por favor.",
  },
});
