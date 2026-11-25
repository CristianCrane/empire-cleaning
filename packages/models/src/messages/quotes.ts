import type { PropertyKind, TurnDownReason } from "../index.ts";
import { formats } from "../format.ts";
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

// what needs a site visit before it's quoted: a Service seen first
// ("Painting", ADR-0018, for a home too); the Office adds how to see it
export const needsVisit = (what: string) =>
  `${what} needs a site visit before it's quoted.`;

// a Property's, as the Office's words name its page or its details ("the
// home's page"), and never "the property page", which no one calls it
export const placeOwner = (kind: PropertyKind) =>
  kind === "commercial" ? "the business's" : "the home's";

// why a Quote can't be sent yet; each side adds where to fix it
export const noEmailYet = (name: string) =>
  `${name} has no email yet, so this quote can't be sent.`;
export const notSeenYet = (kind: PropertyKind) =>
  `${startOf(kind)} hasn't had a site visit yet, so this quote can't be sent.`;

// A Client paying a Quote's Deposit online while their bank asks them to
// approve it, as Office Staff read it (#534's one rule, ADR-0022): nothing
// else that moves money on the Quote starts until it's approved, refused or
// called off, so they can't record acceptance or send changes until `until`
// (already formatted). It says the wait is on the Client's bank, and when it
// ends, as it promises neither ending. Past `until`, one their bank is
// finishing (`finishing`) waits till it's done, said in the words of the
// refusal that found it (`finishing` below, #534 UX review U9). `service`
// is the Service paid for; null on a cleaning plan, which `changing` says
// it starts or changes. `deposit` is null for a card entered to accept
// with nothing to charge (a 0% Deposit, or a plan changed), approved as a
// payment is but in its own words, as no money moves (#534's UX design
// review U40). English, as the Office reads (ADR-0025)
export type PayingFor = {
  name: string;
  deposit: string | null;
  service: string | null;
  changing: boolean;
  until: string;
  finishing: boolean;
};
// where the server says the Client's paying stands (OfficeQuote's
// `paying`), as these words take it: one copy, so the server's refusals
// and the Quote's page name it alike
export const payingFor = (
  name: string,
  paying: {
    until: string | Date;
    finishing: boolean;
    serviceName: string | null;
    changing: boolean;
    depositCents: number;
  },
): PayingFor => ({
  name,
  deposit:
    paying.depositCents === 0
      ? null
      : formats.en.formatMoney(paying.depositCents),
  service: paying.serviceName,
  changing: paying.changing,
  until: formats.en.formatTime(paying.until),
  finishing: paying.finishing,
});
// a payment their bank is finishing, past `until`: too far on to call off
const goingThrough =
  "is still going through with their bank, which usually takes a few minutes";
// a card the same, with nothing charged
const cardFinishing = "their bank is finishing approving their card";
// what's at stake for a new version while the Client pays: said once, as
// its five copies had drifted three ways (#534 review F34)
const booksDraft = "If it books the quote you sent, your draft is deleted.";
const payingWhat = ({
  name,
  deposit,
  service,
  changing,
  finishing,
}: PayingFor) => {
  const what = service
    ? `for the ${service}`
    : `to ${changing ? "change" : "start"} the cleaning plan`;
  if (deposit === null) {
    return finishing
      ? `${name} is accepting online, ${what}: ${cardFinishing}. It books on its own, usually within half an hour.`
      : `${name} is accepting online, ${what}, waiting on their bank to approve their card.`;
  }
  return finishing
    ? `${name}'s online payment of the ${deposit} deposit, ${what}, ${goingThrough}.`
    : `${name} is paying the ${deposit} deposit online, ${what}, waiting on their bank to approve it.`;
};
// the Office's acceptance of a quote, which `service` names when it's not
// what the Client paid for (`paid`); `card`, approving a card with nothing
// charged
const wentThrough = (name: string, card: boolean) =>
  card
    ? `${name}'s card was approved just before you pressed, so the quote is accepted`
    : `${name}'s payment went through just before you pressed, so the quote is accepted`;
export const clientPaying = {
  // the Quote's alert: with Record acceptance greyed beside it (`card`, a
  // card saved to charge), or with a new version being drafted
  page: (
    p: PayingFor,
    { card, drafting }: { card: boolean; drafting: boolean },
  ) =>
    p.finishing
      ? `${payingWhat(p)}${drafting ? ` ${booksDraft} Until it's done, you can't send your changes or record acceptance.` : card ? " Until it's done, you can't record acceptance." : ""}`
      : drafting
        ? `${payingWhat(p)} ${booksDraft} Until ${p.until}, you can't send your changes or record acceptance.`
        : `${payingWhat(p)} If it isn't approved by ${p.until}, it's called off${card ? " and you can record acceptance" : ""}.`,
  // the Record acceptance dialog's, and the server's refusal of it from a
  // page opened before the Client started paying
  record: (p: PayingFor) =>
    p.finishing
      ? `${payingWhat(p)} Until it's done, you can't record acceptance.${p.deposit === null ? "" : " Nothing more was charged."}`
      : `${payingWhat(p)} If it isn't approved by ${p.until}, it's called off and you can record acceptance.`,
  // the draft's, and the server's refusal of sending it
  draft: ({ name, until, finishing, deposit }: PayingFor) =>
    deposit === null
      ? finishing
        ? `${name} is accepting online, and ${cardFinishing}. ${booksDraft} If not, you can send your changes then.`
        : `${name} is accepting online. ${booksDraft} If it isn't approved by ${until}, you can send your changes then.`
      : finishing
        ? `${name}'s online payment ${goingThrough}. ${booksDraft} If not, you can send your changes then.`
        : `${name} is paying the deposit online. ${booksDraft} If it isn't approved by ${until}, you can send your changes then.`,
  // under the greyed action, short, as the menu or a phone's foot may hide
  // the alert
  item: (firstName: string, card: boolean) =>
    card
      ? `Not while ${firstName} is accepting online`
      : `Not while ${firstName} is paying the deposit`,
  // the draft's line beside Send, after its save state, so it names what
  // waits: "Not while…" after "Give a reason…" read as the reason waiting
  // (#534 UX review U10)
  send: (firstName: string, card: boolean) =>
    card
      ? `Send waits on ${firstName} accepting online`
      : `Send waits on ${firstName}'s deposit payment`,
  // past `until`, recording acceptance was the first to find the Client's
  // bank approving it still, too far on to be called off: nothing more
  // charged, as their card is being (the PR's UX review U1). Marked so, the
  // payment holds the Quote, and the page loads again into `record`
  finishing: (name: string, card: boolean) =>
    card
      ? `${name} is accepting online, and ${cardFinishing}, so you can't record acceptance yet.`
      : `${name}'s online payment ${goingThrough}, so you can't record acceptance yet. Nothing more was charged.`,
  // or found it approved, and accepted the quote with it: what the Client
  // paid for, `paid`, which may not be what was picked, `picked`
  recorded: (
    name: string,
    paid: string | null,
    picked: string | null,
    card: boolean,
  ) =>
    `${wentThrough(name, card)}${paid ? (paid !== picked ? ` with the ${paid} they ${card ? "picked" : "paid for"}, not the ${picked}` : "") : " and their cleaning plan is started as they chose it"}.${card ? "" : " Nothing more was charged."}`,
  // or found it approved, but then it couldn't be booked: a card approved
  // with nothing charged is refused as the Office's own press is
  // (unbookableMessage), as nothing's refunded
  refunded: (name: string) =>
    `${name}'s online payment went through just before you pressed, but the quote couldn't be booked with it, so their deposit is being refunded.`,
  // or, past `until`, couldn't reach the provider to call it off or read
  // it: it may yet book the quote sent, so the changes wait, as the draft's
  // alert says while it's paid (#534 review F28, UX review U12)
  unsure: (name: string, card: boolean) =>
    `We couldn't reach the payment service to see whether ${card ? `${name}'s card was approved` : `${name}'s deposit payment went through`}, so your changes weren't sent. ${booksDraft} Please try again in a few minutes.`,
  // sending changes found it approved, and accepted the quote with it
  sent: (name: string, paid: string | null, card: boolean) =>
    `${wentThrough(name, card)}${paid ? ` with the ${paid} they ${card ? "picked" : "paid for"}` : " and their cleaning plan is started as they chose it"}, and your changes weren't sent.`,
  // the draft's page, once the Client's payment accepted the quote
  draftGone: (name: string) =>
    `${name} accepted the quote you sent, so your draft was deleted.`,
};
