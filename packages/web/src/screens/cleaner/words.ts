import { catalog } from "@empire-cleaning/models";

// The Cleaner area's words that more than one of its files shows (its
// navigation, breadcrumbs, the parts of a Job and its tours), in English
// and Spanish (ADR-0025), tú to Cleaners. A word only one screen shows is in
// that screen's own catalog, and one every area shows in labels.ts. The
// Spanish is a draft the owner checks (#206).
export const cleanerWords = catalog({
  en: {
    yourJobs: "Your jobs",
    offers: "Offers",
    offersCount: (n: number) => `Offers (${n})`,
    offeredToYou: "Offered to you",
    nextUp: "Next up",
    openJob: "Open job",
    canYouTakeIt: "Can you take it?",
    markDone: "Mark done",
    confirm: "Confirm",
    notForMe: "Not for me",
    jobConfirmed: "Job confirmed",
    jobDetails: "Job details",
    directions: "Directions",
    crew: "Crew",
    justYou: "Just you",
    goBack: "Go back",
    couldntGetIn: "Couldn't get in?",
    // a Job they've marked done
    done: "Done",
    // "until about 12:00 PM": when a Job or Site Visit should be over
    untilAbout: (time: string) => `until about ${time}`,
    // " by Cory Cleaner", who marked it done or said they couldn't get in
    by: (name: string | null) => (name ? ` by ${name}` : ""),
    // "3.5 h on site"
    hoursOnSite: (hours: string) => `${hours} on site`,
  },
  es: {
    yourJobs: "Tus trabajos",
    offers: "Ofertas",
    offersCount: (n: number) => `Ofertas (${n})`,
    offeredToYou: "Te lo ofrecieron",
    nextUp: "Lo próximo",
    openJob: "Ver el trabajo",
    canYouTakeIt: "¿Puedes tomarlo?",
    markDone: "Marcar como terminado",
    confirm: "Confirmar",
    notForMe: "No es para mí",
    jobConfirmed: "Trabajo confirmado",
    jobDetails: "Detalles del trabajo",
    directions: "Cómo llegar",
    crew: "Equipo",
    justYou: "Solo tú",
    goBack: "Volver",
    couldntGetIn: "¿No pudiste entrar?",
    done: "Terminado",
    untilAbout: (time: string) =>
      `hasta cerca de ${time.startsWith("1:") ? "la" : "las"} ${time}`,
    by: (name: string | null) => (name ? ` por ${name}` : ""),
    hoursOnSite: (hours: string) => `${hours} en el lugar`,
  },
});
