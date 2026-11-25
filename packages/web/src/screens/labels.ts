import { catalog, type JobStatus, theTimeEs } from "@empire-cleaning/models";

// Words several screens show as they are, each once (docs/ux.md, Words):
// part of `screenWords` (format.ts). They're apart from format.ts, which
// imports the Quote form and so the design system, so that first-time
// help's tours can say them too (tours.ts). A word only portal screens share
// is portal/words.ts's, and one only the Cleaner area's is
// cleaner/words.ts's. A word here is said to anyone, so it addresses no one,
// neither usted nor tú (docs/ux.md, Language).
export const labels = catalog({
  en: {
    notKnownYet: "Not known yet",
    unpaid: "Unpaid",
    pickNewTime: "Pick a new time",
    signIn: "Sign in",
    signOut: "Sign out",
    email: "Email",
    day: "Day",
    dayAt: (when: string, time: string) => `${when} at ${time}`,
    condition: "Condition",
    notAdded: "Not added yet",
    onSite: "On site",
    about: (hours: string) => `About ${hours}`,
    // how long a Job runs, asked from the reader's side (howLong)
    howLong: "How long",
    onSiteWith: (cleaners: string) => `On site, with ${cleaners}`,
    // a plan's weekdays alike, where others differ: "On site Mondays and
    // Fridays, with 2 cleaners", "How long on Mondays"
    onSiteOnWith: (days: string, cleaners: string) =>
      `On site ${days}, with ${cleaners}`,
    howLongOn: (days: string) => `How long on ${days}`,
    extras: "Extras",
    none: "None",
    deposit: "Deposit",
    total: "Total",
    taxIncludedOf: (what: string) => `${what}, tax included`,
    payBill: (n: string) => `Pay bill ${n}`,
    // a Bill that asks nothing of its reader: the Office's, or one we try
    // again ourselves
    seeBill: (n: string) => `See bill ${n}`,
    // a payment we try again ourselves (Unpaid, waiting), or a bank payment
    // on its way, however long it takes: started and pending, not failed,
    // with nothing for the Client to do (#534's UX review U1). "Payment",
    // so beside a clean it doesn't read as the clean not done
    paymentPending: "Payment pending",
    // a quote their bank is finishing approving a card for, with nothing
    // charged (a 0% Deposit): it books on its own, and no payment is
    // pending (#534's UX design, Screen 1b)
    bookingPending: "Booking pending",
    howWeGetIn: "How we get in",
    // a Job's header card, as a screen reader names it (JobLead)
    jobDetails: "Job details",
    jobStatus: {
      booked: "Booked",
      completed: "Done",
      cancelled: "Cancelled",
      no_access: "Couldn't get in",
    } satisfies Record<JobStatus, string>,
    welcome: "Welcome",
    today: "Today",
    // a Job's badge while a move asked for waits on the Office's answer
    moveAsked: "Move asked",
    send: "Send",
    siteVisit: "Site visit",
  },
  es: {
    notKnownYet: "Aún no se sabe",
    unpaid: "Sin pagar",
    pickNewTime: "Elegir otra hora",
    signIn: "Iniciar sesión",
    signOut: "Cerrar sesión",
    email: "Correo electrónico",
    day: "Día",
    dayAt: (when: string, time: string) => `${when} a ${theTimeEs(time)}`,
    condition: "Estado",
    notAdded: "Aún no se agregó",
    onSite: "En el lugar",
    // "cerca de", not "unas", which would say "unas 1 h"
    about: (hours: string) => `Cerca de ${hours}`,
    howLong: "Cuánto dura",
    onSiteWith: (cleaners: string) => `En el lugar, con ${cleaners}`,
    onSiteOnWith: (days: string, cleaners: string) =>
      `En el lugar ${days}, con ${cleaners}`,
    howLongOn: (days: string) => `Cuánto dura ${days}`,
    extras: "Adicionales",
    none: "Ninguno",
    deposit: "Depósito",
    total: "Total",
    taxIncludedOf: (what: string) => `${what}, impuestos incluidos`,
    payBill: (n: string) => `Pagar la factura ${n}`,
    seeBill: (n: string) => `Ver la factura ${n}`,
    paymentPending: "Pago pendiente",
    bookingPending: "Reserva pendiente",
    howWeGetIn: "Cómo entramos",
    jobDetails: "Detalles del trabajo",
    jobStatus: {
      booked: "Reservada",
      completed: "Terminada",
      cancelled: "Cancelada",
      no_access: "No se pudo entrar",
    },
    // the generic masculine, said to anyone: whether it reads right to
    // everyone is on #206 for Jen
    welcome: "Bienvenido",
    today: "Hoy",
    moveAsked: "Reprogramación pedida",
    send: "Enviar",
    siteVisit: "Visita previa",
  },
});
