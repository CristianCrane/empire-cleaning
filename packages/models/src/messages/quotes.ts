import type { PropertyKind, TurnDownReason } from "../index.js";

// What the server and the screens both say about a Quote
// (docs/ux.md, Words)

// a Property, as a sentence says it: "this home", "this business"
export const thisPlace = (kind: PropertyKind) =>
  kind === "commercial" ? "this business" : "this home";

const startOf = (kind: PropertyKind) =>
  kind === "commercial" ? "This business" : "This home";

// another Quote, `what`, open at the Property already: the server adds what
// to do, and the Quote form shows it beside a place it can't choose
export const openAlready = (kind: PropertyKind, what = "a quote") =>
  `${startOf(kind)} already has ${what} open.`;

// why the Office couldn't quote, as the Client is told it: alone, as a
// headline, or after turnedDown's apology
export const turnDownReason: Record<TurnDownReason, string> = {
  out_of_area: "It's outside the area we clean",
  out_of_scope: "It's not work we take on",
  no_capacity: "We're fully booked right now",
};
export const turnedDown = (reason: TurnDownReason) =>
  `Sorry, we can't take this one on. ${turnDownReason[reason]}.`;
export const ASK_AGAIN = "If anything changes, you're welcome to ask us again.";

// a Property not seen yet, for a Service that's seen before it's quoted
// (ADR-0018), for a home too; the Office adds how to see it
export const needsVisit = (kind: PropertyKind) =>
  `${startOf(kind)} needs a site visit before it's quoted.`;

// when a Quote asked for comes, as the one asking is told it: before they
// ask, once they have, and while it's worked on
export const WITHIN_A_DAY = "usually within a working day";
// the button, link or step that leads to asking for a quote, wherever it is
export const REQUEST_A_QUOTE = "Request a quote";

export const ASK_US = `Tell us what you'd like cleaned, and we'll email you a quote, ${WITHIN_A_DAY}.`;
export const quoteEmailedTo = (email: string) =>
  `We'll email your quote to ${email}, ${WITHIN_A_DAY}.`;
export const WORKING_ON_IT = `We're working on your quote. We'll email it to you, ${WITHIN_A_DAY}.`;

// why a Quote can't be sent yet; each side adds where to fix it
export const noEmailYet = (name: string) =>
  `${name} has no email yet, so this quote can't be sent.`;
export const notSeenYet = (kind: PropertyKind) =>
  `${startOf(kind)} hasn't had a site visit yet, so this quote can't be sent.`;
