import type { PropertyKind, TurnDownReason } from "../index.ts";
import { catalog } from "../language.ts";

// What the server and the screens both say about a Quote
// (docs/ux.md, Words)

const startOf = (kind: PropertyKind) =>
  kind === "commercial" ? "This business" : "This home";
const startOfEs = (kind: PropertyKind) =>
  kind === "commercial" ? "Este negocio" : "Esta casa";

// when a Quote asked for comes, as the one asking is told it: before they
// ask, once they have, and while it's worked on
const WITHIN_A_DAY = "usually within a working day";
const WITHIN_A_DAY_ES = "normalmente en un día hábil";

const turnDownReasonEn: Record<TurnDownReason, string> = {
  out_of_area: "It's outside the area we clean",
  out_of_scope: "It's not work we take on",
  no_capacity: "We're fully booked right now",
};
const turnDownReasonEs: Record<TurnDownReason, string> = {
  out_of_area: "Está fuera de la zona donde limpiamos",
  out_of_scope: "No es un trabajo que hacemos",
  no_capacity: "Ahora mismo no tenemos lugar",
};

export const quotes = catalog({
  en: {
    // a Property, as a sentence says it: "this home", "this business"
    thisPlace: (kind: PropertyKind) =>
      kind === "commercial" ? "this business" : "this home",
    // another Quote, `what`, open at the Property already: the server adds
    // what to do, and the Quote form shows it beside a place it can't choose
    openAlready: (kind: PropertyKind, what = "a quote") =>
      `${startOf(kind)} already has ${what} open.`,
    // why the Office couldn't quote, as the Client is told it: alone, as a
    // headline, or after turnedDown's apology
    turnDownReason: turnDownReasonEn,
    turnedDown: (reason: TurnDownReason) =>
      `Sorry, we can't take this one on. ${turnDownReasonEn[reason]}.`,
    ASK_AGAIN: "If anything changes, you're welcome to ask us again.",
    WITHIN_A_DAY,
    // the button, link or step that leads to asking for a quote, wherever
    // it is
    REQUEST_A_QUOTE: "Request a quote",
    ASK_US: `Tell us what you'd like cleaned, and we'll email you a quote, ${WITHIN_A_DAY}.`,
    quoteEmailedTo: (email: string) =>
      `We'll email your quote to ${email}, ${WITHIN_A_DAY}.`,
    WORKING_ON_IT: `We're working on your quote. We'll email it to you, ${WITHIN_A_DAY}.`,
  },
  es: {
    thisPlace: (kind: PropertyKind) =>
      kind === "commercial" ? "este negocio" : "esta casa",
    openAlready: (kind: PropertyKind, what = "una cotización") =>
      `${startOfEs(kind)} ya tiene ${what} abierta.`,
    turnDownReason: turnDownReasonEs,
    turnedDown: (reason: TurnDownReason) =>
      `Lo sentimos, no podemos encargarnos de este trabajo. ${turnDownReasonEs[reason]}.`,
    ASK_AGAIN: "Si algo cambia, puede volver a pedirnos una cotización.",
    WITHIN_A_DAY: WITHIN_A_DAY_ES,
    REQUEST_A_QUOTE: "Pedir una cotización",
    ASK_US: `Cuéntenos qué quiere que limpiemos y le enviaremos una cotización por correo, ${WITHIN_A_DAY_ES}.`,
    quoteEmailedTo: (email: string) =>
      `Le enviaremos su cotización a ${email}, ${WITHIN_A_DAY_ES}.`,
    WORKING_ON_IT: `Estamos preparando su cotización. Se la enviaremos por correo, ${WITHIN_A_DAY_ES}.`,
  },
});

// the Office's, in English (ADR-0025)

// a Property not seen yet, for a Service that's seen before it's quoted
// (ADR-0018), for a home too; the Office adds how to see it
export const needsVisit = (kind: PropertyKind) =>
  `${startOf(kind)} needs a site visit before it's quoted.`;

// why a Quote can't be sent yet; each side adds where to fix it
export const noEmailYet = (name: string) =>
  `${name} has no email yet, so this quote can't be sent.`;
export const notSeenYet = (kind: PropertyKind) =>
  `${startOf(kind)} hasn't had a site visit yet, so this quote can't be sent.`;
