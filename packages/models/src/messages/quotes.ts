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

// why the Office couldn't quote, as the Client is told it, after
// TURNED_DOWN
export const turnDownReason: Record<TurnDownReason, string> = {
  out_of_area: "It's outside the area we clean",
  out_of_scope: "It's not work we take on",
  no_capacity: "We're fully booked right now",
};
export const TURNED_DOWN = "Sorry, we can't take this one on.";
export const ASK_AGAIN = "If anything changes, you're welcome to ask us again.";

// why a Quote can't be sent yet; each side adds where to fix it
export const noEmailYet = (name: string) =>
  `${name} has no email yet, so this quote can't be sent.`;
export const notSeenYet = (kind: PropertyKind) =>
  `${startOf(kind)} hasn't had a site visit yet, so this quote can't be sent.`;
