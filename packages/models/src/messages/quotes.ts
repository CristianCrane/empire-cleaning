import type { PropertyKind, TurnDownReason } from "../index.ts";
import { formats } from "../format.ts";
import { depositOnAccepting } from "../deposit.ts";
import { catalog } from "../language.ts";
import { because } from "./payments.ts";

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

// once a Quote's time filled, the Office sends one for another time
// (Today's "Pick another time for the quote"): the promise, wherever the
// Client is told it filled, and the Deposit's words (deposits.ts) end with
// it too
export const NEW_QUOTE_EN = "We'll send you a new quote for another time.";
export const NEW_QUOTE_ES =
  "Le enviaremos una nueva cotización para otra hora.";

// what filled on a quote since it was sent, as its Client is told it on
// the quote's page and on Home: a clean's time; one of the days a plan
// starts on, as its first clean's time may not be the day that filled; or
// one of a change's new days, as the plan they have stays (#534)
export type FilledDays = "clean" | "plan" | "change";
export const filledDaysOf = (quote: {
  plan: { days: unknown[] } | null;
  // it changes the plan its home has
  changes: boolean;
}): FilledDays =>
  quote.plan && quote.plan.days.length > 1
    ? quote.changes
      ? "change"
      : "plan"
    : "clean";

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
    NEW_QUOTE: NEW_QUOTE_EN,
    // the quote's page, once what it books filled (its badge: fullyBooked),
    // `when` the clean's time; then that a new quote comes (NEW_QUOTE)
    bookedUp: (filled: FilledDays, when: string) =>
      `Sorry, ${
        {
          clean: `${when} has`,
          plan: "one of the days your plan starts on has",
          change: "one of the new days for your plan has",
        }[filled]
      } been fully booked since we sent this quote, so it can't be accepted.`,
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
    NEW_QUOTE: NEW_QUOTE_ES,
    bookedUp: (filled: FilledDays, when: string) =>
      `Lo sentimos, ${
        {
          clean: `el ${when} se llenó`,
          plan: "uno de los días en que empieza su plan se llenó",
          change: "uno de los nuevos días de su plan se llenó",
        }[filled]
      } después de que le enviamos esta cotización, así que no se puede aceptar.`,
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
// a payment their bank is finishing, past `until`: too far on to call off.
// "Under half an hour", as the Office's Bill says the same wait
// (paymentNotDone): the Clock asks again once the attempt is
// SETTLED_AFTER_MS old, on its next tick (#534's UX design, Screen 5)
const goingThrough =
  "is still going through with their bank, which usually takes under half an hour";
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
// what the Client's own payment online took, once it booked the quote just
// before the Office pressed (`recorded`, `sent`): the Service they paid
// for (null on a plan), whether it changed their plan rather than started
// it, and `card`, their card approved with nothing charged, as a 0% Deposit
// or a plan change takes none (depositOnAccepting, the server's rule; #534
// review F10)
export type AcceptedWith = {
  paid: string | null;
  changedPlan: boolean;
  card: boolean;
};
export const acceptedWith = (quote: {
  offer: {
    plan: { depositCents: number } | null;
    options: {
      serviceKey: string;
      serviceName: string;
      depositCents: number;
    }[];
  } | null;
  acceptedServiceKey: string | null;
  changedPlan: boolean;
}): AcceptedWith => {
  const option = quote.offer?.options.find(
    (o) => o.serviceKey === quote.acceptedServiceKey,
  );
  return {
    paid: quote.offer?.plan ? null : (option?.serviceName ?? null),
    changedPlan: quote.changedPlan,
    card:
      depositOnAccepting(
        quote.offer?.plan?.depositCents ?? option?.depositCents ?? 0,
        quote.changedPlan,
      ) === 0,
  };
};
// the Office's acceptance of a quote, which `service` names when it's not
// what the Client paid for (`paid`); `card`, approving a card with nothing
// charged
const wentThrough = (name: string, card: boolean) =>
  card
    ? `${name}'s card was approved just before you pressed, so the quote is accepted`
    : `${name}'s payment went through just before you pressed, so the quote is accepted`;
// what it booked: the Service they paid for, or their plan, started or
// changed
const tookWhat = ({ paid, changedPlan, card }: AcceptedWith) =>
  paid
    ? ` with the ${paid} they ${card ? "picked" : "paid for"}`
    : ` and their cleaning plan is ${changedPlan ? "changed" : "started"} as they chose it`;
// once their bank is finishing it, what the Office can do if it doesn't go
// through: said as what's next, not what's barred, as the greyed action
// beside it says that, and nothing waits on anyone (#534's UX design,
// Screen 5)
const ifNot = (p: PayingFor, card: boolean, drafting: boolean) => {
  const then = `you can ${drafting ? `send your changes${card ? " or record acceptance" : ""}` : "record acceptance"} then.`;
  if (drafting) return ` ${booksDraft} If not, ${then}`;
  if (!card) return "";
  return p.deposit === null
    ? ` If it isn't approved, ${then}`
    : ` If it doesn't go through, ${then}`;
};
export const clientPaying = {
  // the Quote's alert: with Record acceptance greyed beside it (`card`, a
  // card saved to charge), or with a new version being drafted
  page: (
    p: PayingFor,
    { card, drafting }: { card: boolean; drafting: boolean },
  ) =>
    p.finishing
      ? `${payingWhat(p)}${ifNot(p, card, drafting)}`
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
  recorded: (name: string, accepted: AcceptedWith, picked: string | null) =>
    `${wentThrough(name, accepted.card)}${accepted.paid === null ? tookWhat(accepted) : accepted.paid === picked ? "" : `${tookWhat(accepted)}, not the ${picked}`}.${accepted.card ? "" : " Nothing more was charged."}`,
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
  sent: (name: string, accepted: AcceptedWith) =>
    `${wentThrough(name, accepted.card)}${tookWhat(accepted)}, and your changes weren't sent.`,
  // the draft's page, once the Client's payment accepted the quote
  draftGone: (name: string) =>
    `${name} accepted the quote you sent, so your draft was deleted.`,
  // the Quote's alert once their latest payment online took nothing, while
  // the offer's open (OfficeQuote's paymentEnded), in the Office's Bill's
  // words for the same endings: when (`on`, formatted), and why it didn't
  // go through, if the payment service said; `card`, a card entered with
  // nothing to charge (a 0% Deposit), in the Client's words for it. Then
  // what's next: they can try again while it can be accepted (`open`), and
  // the Office can record acceptance with a card saved (`record`) (#534's
  // UX design, Screen 5)
  ended: (
    e: { name: string; on: string; card: boolean } & (
      { status: "notApproved" } | { status: "failed"; why: string | null }
    ),
    { open, record }: { open: boolean; record: boolean },
  ) => {
    const what = e.card
      ? `${e.name}'s card, entered to accept online on ${e.on},`
      : `${e.name}'s online payment of the deposit on ${e.on}`;
    const how =
      e.status === "notApproved"
        ? `wasn't approved, so nothing was ${e.card ? "booked" : "taken"}`
        : e.card
          ? `was declined${because(e.why)}, so nothing was booked`
          : `didn't go through${because(e.why)}`;
    const next = open
      ? ` They can try again on their quote${record ? ", or you can record acceptance" : ""}.`
      : "";
    return `${what} ${how}.${next}`;
  },
};
