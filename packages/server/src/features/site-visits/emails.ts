import {
  catalog,
  formats,
  type Language,
  oneStop,
} from "@empire-cleaning/models";
import {
  button,
  details,
  detailWords,
  greeting,
  paragraph,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

// A Client is emailed when a Site Visit is booked, moved or cancelled; they
// ask for changes by phone
export type SiteVisitNotice = {
  name: string;
  address: string;
  startsAt: Date;
  // the Staff member coming, and for how long
  visitor: string;
  minutes: number;
  // a home, or business premises
  place: "home" | "premises";
};

const words = catalog({
  en: {
    WHO: "Who",
    TAKES: "Takes",
    fromUs: (visitor: string) => `${visitor} from Empire Cleaning`,
    about: (minutes: number) => `about ${minutes} minutes`,
    SEE_IT: "See it in your account",
    booked: {
      subject: "Your site visit is booked",
      // to see the home, or the business's premises
      what: (place: SiteVisitNotice["place"]) =>
        `We've booked a free visit to see the ${place} before we quote.`,
      free: "There's no charge. If the time doesn't suit you, please call us to change it.",
    },
    changed: {
      subjectMoved: "Your site visit has moved",
      subjectChanged: "Your site visit has changed",
      moved: "We've moved your free site visit.",
      changed:
        "We've changed your free site visit. It's still at the same time.",
      callUs: "If the time doesn't suit you, please call us to change it.",
    },
    cancelled: {
      subject: "Your site visit is cancelled",
      what: (address: string, when: string) =>
        `We've cancelled your site visit at ${address} on ${when}.`,
      again:
        "If you'd still like us to come and see it, please call us to book another.",
    },
  },
  es: {
    WHO: "Quién",
    TAKES: "Duración",
    fromUs: (visitor: string) => `${visitor}, de Empire Cleaning`,
    about: (minutes: number) => `unos ${minutes} minutos`,
    SEE_IT: "Verla en su cuenta",
    booked: {
      subject: "Su visita previa está reservada",
      what: (place: SiteVisitNotice["place"]) =>
        `Reservamos una visita gratis para ver ${place === "home" ? "su casa" : "su negocio"} antes de darle la cotización.`,
      free: "No tiene ningún costo. Si la hora no le conviene, llámenos para cambiarla.",
    },
    changed: {
      subjectMoved: "Su visita previa cambió de hora",
      subjectChanged: "Su visita previa cambió",
      moved: "Cambiamos la hora de su visita previa, que es gratis.",
      changed:
        "Hicimos un cambio en su visita previa, que es gratis. Sigue a la misma hora.",
      callUs: "Si la hora no le conviene, llámenos para cambiarla.",
    },
    cancelled: {
      subject: "Su visita previa está cancelada",
      what: (address: string, when: string) =>
        oneStop(`Cancelamos su visita previa en ${address} del ${when}.`),
      again:
        "Si todavía quiere que vayamos a verla, llámenos para reservar otra.",
    },
  },
});

const visitDetails = (
  lang: Language,
  { address, startsAt, visitor, minutes }: SiteVisitNotice,
  was?: Date,
) => {
  const w = words[lang];
  const d = detailWords[lang];
  const { formatWhen } = formats[lang];
  return details([
    { label: d.WHEN, value: formatWhen(startsAt) },
    ...(was ? [{ label: d.WAS, value: formatWhen(was) }] : []),
    { label: d.WHERE, value: address },
    { label: w.WHO, value: w.fromUs(firstNameOf(visitor)) },
    { label: w.TAKES, value: w.about(minutes) },
  ]);
};

const accountButton = (lang: Language) => button(words[lang].SEE_IT, "/portal");

export const siteVisitBookedEmail = (
  lang: Language,
  visit: SiteVisitNotice,
): Email => {
  const w = words[lang].booked;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(visit.name)),
      paragraph(w.what(visit.place)),
      visitDetails(lang, visit),
      paragraph(w.free),
      accountButton(lang),
    ],
  };
};

// `was` is its time before, when it moved; without, only who or how long
// changed
export const siteVisitChangedEmail = (
  lang: Language,
  visit: SiteVisitNotice & { was?: Date },
): Email => {
  const w = words[lang].changed;
  return {
    lang,
    subject: visit.was ? w.subjectMoved : w.subjectChanged,
    blocks: [
      greeting(firstNameOf(visit.name)),
      paragraph(visit.was ? w.moved : w.changed),
      visitDetails(lang, visit, visit.was),
      paragraph(w.callUs),
      accountButton(lang),
    ],
  };
};

export const siteVisitCancelledEmail = (
  lang: Language,
  {
    name,
    address,
    startsAt,
  }: { name: string; address: string; startsAt: Date },
): Email => {
  const w = words[lang].cancelled;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.what(address, formats[lang].formatWhen(startsAt))),
      paragraph(w.again),
      accountButton(lang),
    ],
  };
};
