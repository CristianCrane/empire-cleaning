import { catalog, theTimeEs } from "@empire-cleaning/models";

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
    markDone: "Mark done",
    confirm: "Confirm",
    notForMe: "Not for me",
    jobConfirmed: "Job confirmed",
    directions: "Directions",
    crew: "Crew",
    justYou: "Just you",
    // roughly where, before they've taken it
    zip: (postcode: string) => `ZIP code ${postcode}`,
    // the reader, on a crew they're in
    you: "You",
    goBack: "Go back",
    callOffice: "Call the office",
    // the toast once they've said an offer's not for them
    takenOff: "Taken off your list",
    // on the Job's day: the client's number, and what's said when no way
    // in is written down
    clientsNumber: "Client's number",
    nothingWritten:
      "Nothing's written down. Call the client when you get there.",
    // a Job offered or open to them: theirs to take, said from their side
    // (the Office calls it offered)
    available: "Available",
    // a Job they've marked done
    done: "Done",
    // "until about 12:00 PM": when a Job or Site Visit should be over
    untilAbout: (time: string) => `until about ${time}`,
  },
  es: {
    yourJobs: "Tus trabajos",
    offers: "Ofertas",
    offersCount: (n: number) => `Ofertas (${n})`,
    offeredToYou: "Te lo ofrecieron",
    nextUp: "Lo próximo",
    openJob: "Ver el trabajo",
    markDone: "Marcar como terminado",
    confirm: "Confirmar",
    notForMe: "No es para mí",
    jobConfirmed: "Trabajo confirmado",
    directions: "Cómo llegar",
    crew: "Equipo",
    justYou: "Solo tú",
    zip: (postcode: string) => `Código postal ${postcode}`,
    you: "Tú",
    goBack: "Volver",
    callOffice: "Llamar a la oficina",
    takenOff: "Quitado de tu lista",
    clientsNumber: "Teléfono del cliente",
    nothingWritten: "No hay nada escrito. Llama al cliente cuando llegues.",
    available: "Disponible",
    done: "Terminado",
    untilAbout: (time: string) => `hasta cerca de ${theTimeEs(time)}`,
  },
});
