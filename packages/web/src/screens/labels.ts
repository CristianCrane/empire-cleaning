import { catalog, type JobStatus } from "@empire-cleaning/models";

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
    onSiteWith: (cleaners: string) => `On site, ${cleaners}`,
    extras: "Extras",
    none: "None",
    deposit: "Deposit",
    total: "Total",
    taxIncludedOf: (what: string) => `${what}, tax included`,
    payBill: (n: string) => `Pay bill ${n}`,
    // a bank payment, or a Bill paid by one, on its way
    clearing: "Clearing",
    howWeGetIn: "How we get in",
    jobStatus: {
      booked: "Booked",
      completed: "Done",
      cancelled: "Cancelled",
      no_access: "Couldn't get in",
    } satisfies Record<JobStatus, string>,
    welcome: "Welcome",
    today: "Today",
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
    dayAt: (when: string, time: string) =>
      `${when} ${time.startsWith("1:") ? "a la" : "a las"} ${time}`,
    condition: "Estado",
    notAdded: "Aún no se agregó",
    onSite: "En el lugar",
    about: (hours: string) => `Unas ${hours}`,
    onSiteWith: (cleaners: string) => `En el lugar, ${cleaners}`,
    extras: "Adicionales",
    none: "Ninguno",
    deposit: "Depósito",
    total: "Total",
    taxIncludedOf: (what: string) => `${what}, impuestos incluidos`,
    payBill: (n: string) => `Pagar la factura ${n}`,
    clearing: "En proceso",
    howWeGetIn: "Cómo entramos",
    jobStatus: {
      booked: "Reservada",
      completed: "Terminada",
      cancelled: "Cancelada",
      no_access: "No se pudo entrar",
    },
    welcome: "Bienvenido",
    today: "Hoy",
    send: "Enviar",
    siteVisit: "Visita previa",
  },
});
