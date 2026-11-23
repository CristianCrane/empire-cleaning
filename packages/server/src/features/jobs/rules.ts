import {
  atTime,
  catalog,
  fromHundredths,
  hundredths,
  messages,
  PICK_TIMES,
  type DayTimes,
  type JobStatus,
  type ScheduleDay,
} from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";

// The Schedule's rules the server alone keeps: the starts its pickers mark,
// a day as a plan's new terms would leave it, and what the API says of a
// clean's time and state. Room (roomOn), which a screen asks too, and
// the rules sharing its spans of time (isFree, busyWith, …) are in
// @empire-cleaning/models (schedule-rules.ts).

// the starts a picker offers on a day of the Schedule
export const startsOn = (day: ScheduleDay) =>
  PICK_TIMES.map((time) => atTime(day.date, time));

/**
 * The starts on each of these days of the Schedule (startsOn) where a clean
 * would find no crew free, as `hasCrew` says of it there (roomOn's, or a
 * Quote's cleanRooms'): the times the Office's pickers mark. Only the
 * headcount: a day's hours show in its header.
 */
export const startsWithoutCrew = (
  days: ScheduleDay[],
  hasCrew: (day: ScheduleDay, startsAt: Date) => boolean,
): DayTimes[] =>
  days.map((day) => {
    const starts = startsOn(day);
    return {
      date: day.date,
      times: PICK_TIMES.filter((_, i) => !hasCrew(day, starts[i]!)),
    };
  });

// A day as it is once some of its booked Jobs are replaced, as a plan's new
// terms replace them (#15): they're gone, and so are the times held for
// moving them (#242). Their hours are free again, and so are a held time's
// moving one here from another day.
export const withoutReplaced = (
  day: ScheduleDay,
  replacing: string[],
): ScheduleDay => {
  const gone = day.jobs.filter((job) => replacing.includes(job.id));
  // a time held for moving one from another day holds its hours here too
  const goneHeld = day.held.filter((h) => replacing.includes(h.jobId));
  const heldHere = goneHeld.filter((h) => !gone.some((j) => j.id === h.jobId));
  return {
    ...day,
    jobs: day.jobs.filter((job) => !gone.includes(job)),
    held: day.held.filter((h) => !goneHeld.includes(h)),
    freeHours: fromHundredths(
      [...gone, ...heldHere].reduce(
        (free, job) => free + hundredths(job.labourHours),
        hundredths(day.freeHours),
      ),
    ),
  };
};

// What the API says of a clean's time and state, in the request's language
// (ADR-0025). Spanish is impersonal ("no se puede"), so it reads right to a
// Client (usted) and a Cleaner (tú) alike
type Ended = Exclude<JobStatus, "booked">;
type Doing = Ended | "moved" | "offered" | "confirmed" | "takenOff";
const words = catalog({
  en: {
    // what happened to a Job that isn't booked any more
    ended: {
      completed: "This clean is done",
      cancelled: "This clean was cancelled",
      no_access: "The cleaner couldn't get in for this clean",
    } satisfies Record<Ended, string>,
    already: {
      completed: "This clean is already done.",
      cancelled: "This clean is already cancelled.",
      no_access: "We already know the cleaner couldn't get in.",
    } satisfies Record<Ended, string>,
    // what someone can't do to a clean that has ended or started
    canDo: {
      completed: "mark it done",
      cancelled: "cancel it",
      no_access: "say the cleaner couldn't get in",
      moved: "move it",
      offered: "offer it to anyone",
      confirmed: "confirm it",
      takenOff: "take anyone off it",
    } satisfies Record<Doing, string>,
    cantBecause: (why: string, doing: string) =>
      `${why}, so you can't ${doing}.`,
    started: "This clean has already started",
    // what a Client does about a clean that has started
    CALL_US: "Please call us.",
  },
  es: {
    ended: {
      completed: "Esta limpieza ya terminó",
      cancelled: "Esta limpieza se canceló",
      no_access: "El limpiador no pudo entrar para esta limpieza",
    },
    already: {
      completed: "Esta limpieza ya está terminada.",
      cancelled: "Esta limpieza ya está cancelada.",
      no_access: "Ya sabemos que el limpiador no pudo entrar.",
    },
    canDo: {
      completed: "marcar como terminada",
      cancelled: "cancelar",
      no_access: "indicar que el limpiador no pudo entrar",
      moved: "reprogramar",
      offered: "ofrecer a nadie",
      confirmed: "confirmar",
      takenOff: "quitar a nadie",
    },
    cantBecause: (why: string, doing: string) =>
      `${why}, así que no se puede ${doing}.`,
    started: "Esta limpieza ya empezó",
    CALL_US: "Por favor, llámenos.",
  },
});

// a time asked for that has already passed (models' words, as a screen
// says it too)
export const passed = () => messages[currentLanguage()].PASSED;

// a Client is asked to call about a clean that has started
export const callUs = () => words[currentLanguage()].CALL_US;

// Why a Job that isn't booked can't be `doing`: what happened to it, or
// that it already was
export const whyNotBooked = (status: Ended, doing: Ended | "moved") => {
  const w = words[currentLanguage()];
  return status === doing
    ? w.already[status]
    : w.cantBecause(w.ended[status], w.canDo[doing]);
};

// why a Job that has started can't be `doing`
export const whyStarted = (doing: Doing) => {
  const w = words[currentLanguage()];
  return w.cantBecause(w.started, w.canDo[doing]);
};
