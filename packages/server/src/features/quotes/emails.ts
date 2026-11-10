import type { BillPayment, Recurrence } from "@empire-cleaning/models";
import {
  button,
  cleanDetails,
  details,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";
import {
  type PropertyKind,
  type Language,
  type TurnDownReason,
  catalog,
  formats,
  dayOf,
  messages,
  oneStop,
} from "@empire-cleaning/models";
import { accessButton } from "../jobs/emails.ts";
import { cardOf } from "../payments/emails.ts";
import { describePlan } from "./plan-days.ts";

// the Office's
const { formatWhen } = formats.en;

// Every Quote email links to the Quote's page, with no sign-in power
// (ADR-0006): the same page shows the offer once it's Sent

// how a Client books again once their cleans are cancelled or their plan
// has ended
export const bookAnother = catalog({
  en: "To book another clean, ask us for a quote in your account.",
  es: "Para reservar otra limpieza, pídanos una cotización en su cuenta.",
});

// what the emails to a Client about their Quotes say, in each language
const words = catalog({
  en: {
    SEE_QUOTE: "See your quote",
    thanks: (address: string) =>
      `Thanks for asking us for a quote for ${address}.`,
    NOT_YOU:
      "If you didn't ask for a quote, you can ignore this email, or reply and let us know.",
    RECEIVED: "We got your request for a quote",
    askClash: {
      subject: "About your request for a quote",
      signInToPick: "Sign in and pick it from the list to ask about it.",
      ASK: "Ask for a quote",
      SEE_QUOTES: "See your quotes",
    },
    turnDown: {
      subject: "About your quote from Empire Cleaning",
    },
    quote: {
      subject: (plan: boolean, revised: boolean) =>
        `Your ${plan ? "cleaning plan quote" : "quote"} from Empire Cleaning${revised ? " has been updated" : ""}`,
      // the quote is ready, or has been updated
      ready: (revised: boolean) => (revised ? "has been updated" : "is ready"),
      oneOff: (address: string, ready: string, when: string) =>
        `Your quote for ${address} ${ready}, for ${when}:`,
      RECOMMENDED: " (recommended)",
      // a plan on one weekday: "a Standard Clean every week"
      oneDay: (service: string, often: string) => `a ${service} ${often}`,
      planOne: (
        address: string,
        ready: string,
        plan: string,
        starting: string,
      ) =>
        `Your cleaning plan quote for ${address} ${ready}: ${plan}, starting ${starting}.`,
      saves: (each: string, saving: string, oneOff: string) =>
        `${each} a clean, which saves you ${saving} on the one-off price of ${oneOff}.`,
      weekly: (week: string, percent: number) =>
        `${week} a week, ${percent}% off the one-off prices.`,
      openUntil: (until: string, email: string) =>
        `It's open until ${until}. To see all of it, sign in with this email address (${email}):`,
    },
    // how a card is named when it's charged: "your Visa ending 4242"
    yourCard: (card: string) => `your ${card}`,
    // a plan's prices: `now` for a change of plan
    eachIs: (now: boolean, each: string) =>
      `Each clean is ${now ? "now " : ""}${each}.`,
    eachOn: (price: string, weekday: string) => `${price} on ${weekday}s`,
    eachChargedOne: (now: boolean, each: string, card: string) =>
      `Each clean is ${now ? "now " : ""}${each}, charged to ${card} when it's done.`,
    eachCharged: (card: string, each: string) =>
      `Each clean is charged to ${card} when it's done: ${each}.`,
    started: {
      subject: "Your cleaning plan with Empire Cleaning has started",
      at: (address: string) => ` at ${address}`,
      started: (plan: string, first: string) =>
        `Your cleaning plan has started: ${plan}. The first is on ${first}.`,
      deposit: (deposit: string) =>
        `We've taken your deposit of ${deposit}. We keep it while the plan runs, and it comes off your last clean when the plan ends.`,
      REMIND:
        "We'll remind you the day before each clean. Please check we know how to get in:",
    },
    changed: {
      subject: "Your cleaning plan with Empire Cleaning has changed",
      changed: (address: string, from: string, plan: string) =>
        `Your cleaning plan at ${address} has changed: from ${from}, it's ${plan}.`,
      BEFORE: "Cleans before then go ahead as they were.",
      replaced: (count: number, when: string) =>
        count === 1
          ? `The clean you had booked from then on (${when}) is cancelled, at no charge.`
          : `The cleans you had booked from then on (${when}) are cancelled, at no charge.`,
      DEPOSIT:
        "Your deposit stays as it is: we keep it while the plan runs, and it comes off your last clean when the plan ends.",
      SEE_PLAN: "See your cleaning plan",
    },
    booked: {
      subject: "You're booked with Empire Cleaning",
      BOOKED: "You're booked.",
      depositTaken: (
        deposit: string,
        card: string,
        rest: string,
        then: string,
      ) =>
        `We've taken your deposit of ${deposit} from ${card}. The rest, ${rest}, ${then}.`,
      CHARGED_WHEN_DONE: "is charged to it when the clean is done",
      total: (total: string, then: string) => `The ${total} ${then}.`,
      chargedTo: (card: string) =>
        `is charged to ${card} when the clean is done`,
      REMIND:
        "We'll remind you the day before. Please check we know how to get in:",
    },
  },
  es: {
    SEE_QUOTE: "Ver su cotización",
    thanks: (address: string) =>
      `Gracias por pedirnos una cotización para ${address}.`,
    NOT_YOU:
      "Si usted no pidió una cotización, puede ignorar este correo, o respondernos para avisarnos.",
    RECEIVED: "Recibimos su solicitud de cotización",
    askClash: {
      subject: "Sobre su solicitud de cotización",
      signInToPick:
        "Inicie sesión y elíjala de la lista para pedir una cotización.",
      ASK: "Pedir una cotización",
      SEE_QUOTES: "Ver sus cotizaciones",
    },
    turnDown: {
      subject: "Sobre su cotización de Empire Cleaning",
    },
    quote: {
      subject: (plan: boolean, revised: boolean) =>
        `Su ${plan ? "cotización de plan de limpieza" : "cotización"} de Empire Cleaning${revised ? " cambió" : ""}`,
      ready: (revised: boolean) => (revised ? "cambió" : "está lista"),
      oneOff: (address: string, ready: string, when: string) =>
        `Su cotización para ${address} ${ready}, para el ${when}:`,
      RECOMMENDED: " (recomendado)",
      oneDay: (service: string, often: string) => `${service} ${often}`,
      planOne: (
        address: string,
        ready: string,
        plan: string,
        starting: string,
      ) =>
        oneStop(
          `Su cotización de plan de limpieza para ${address} ${ready}: ${plan}, a partir del ${starting}.`,
        ),
      saves: (each: string, saving: string, oneOff: string) =>
        `${each} por limpieza, que le ahorra ${saving} sobre el precio de una sola limpieza, ${oneOff}.`,
      weekly: (week: string, percent: number) =>
        `${week} por semana, un ${percent}% menos que los precios de una sola limpieza.`,
      openUntil: (until: string, email: string) =>
        oneStop(
          `Está abierta hasta el ${until}. Para verla completa, inicie sesión con este correo (${email}):`,
        ),
    },
    yourCard: (card: string) => `su ${card}`,
    eachIs: (now: boolean, each: string) =>
      `Cada limpieza ${now ? "ahora " : ""}cuesta ${each}.`,
    eachOn: (price: string, weekday: string) => `${price} los ${weekday}`,
    eachChargedOne: (now: boolean, each: string, card: string) =>
      `Cada limpieza ${now ? "ahora " : ""}cuesta ${each}, y se cobra a ${card} cuando está terminada.`,
    eachCharged: (card: string, each: string) =>
      `Cada limpieza se cobra a ${card} cuando está terminada: ${each}.`,
    started: {
      subject: "Su plan de limpieza con Empire Cleaning comenzó",
      at: (address: string) => ` en ${address}`,
      started: (plan: string, first: string) =>
        oneStop(
          `Su plan de limpieza comenzó: ${plan}. La primera es el ${first}.`,
        ),
      deposit: (deposit: string) =>
        `Cobramos su depósito de ${deposit}. Lo guardamos mientras dure el plan, y se descuenta de su última limpieza cuando el plan termine.`,
      REMIND:
        "Le recordaremos el día antes de cada limpieza. Por favor, revise que sepamos cómo entrar:",
    },
    changed: {
      subject: "Su plan de limpieza con Empire Cleaning cambió",
      changed: (address: string, from: string, plan: string) =>
        oneStop(
          `Su plan de limpieza en ${address} cambió: a partir del ${from}, es ${plan}.`,
        ),
      BEFORE: "Las limpiezas antes de esa fecha siguen como estaban.",
      replaced: (count: number, when: string) =>
        count === 1
          ? `La limpieza que tenía reservada desde entonces (${when}) está cancelada, sin ningún cargo.`
          : `Las limpiezas que tenía reservadas desde entonces (${when}) están canceladas, sin ningún cargo.`,
      DEPOSIT:
        "Su depósito sigue igual: lo guardamos mientras dure el plan, y se descuenta de su última limpieza cuando el plan termine.",
      SEE_PLAN: "Ver su plan de limpieza",
    },
    booked: {
      subject: "Su limpieza con Empire Cleaning está reservada",
      BOOKED: "Su limpieza está reservada.",
      depositTaken: (
        deposit: string,
        card: string,
        rest: string,
        then: string,
      ) =>
        `Cobramos su depósito de ${deposit} a ${card}. El resto, ${rest}, ${then}.`,
      CHARGED_WHEN_DONE: "se le cobra cuando la limpieza está terminada",
      total: (total: string, then: string) => `El total de ${total} ${then}.`,
      chargedTo: (card: string) =>
        `se cobra a ${card} cuando la limpieza está terminada`,
      REMIND:
        "Le recordaremos el día antes. Por favor, revise que sepamos cómo entrar:",
    },
  },
});

// always to the Client's own address, so an existing Client hears about any
// Quote asked for with their email; in their Preferred Language (ADR-0025)
export const quoteReceivedEmail = (
  lang: Language,
  {
    name,
    email,
    address,
    quoteId,
  }: {
    name: string;
    email: string;
    address: string;
    quoteId: string;
  },
): Email => {
  const w = words[lang];
  return {
    lang,
    subject: w.RECEIVED,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(`${w.thanks(address)} ${messages[lang].quoteEmailedTo(email)}`),
      button(w.SEE_QUOTE, `/portal/quotes/${quoteId}`),
      paragraph(w.NOT_YOU),
    ],
  };
};

// Why an ask can't go ahead at a Property the Client has, as the reply
// says it, in the language of the screen that asked, and the email to their
// own address, in their Preferred Language
export const askClash = catalog({
  en: {
    // a Quote the Client has open already for `where`
    alreadyAsked: (
      why: "asked" | "sent",
      where: string,
      email: string | null,
    ) =>
      why === "sent"
        ? `We've already sent you a quote for ${where}. You'll find it in your account.`
        : `You've already asked us for a quote for ${where}. We'll email it to ${email} soon.`,
    // a Property the Client has already, as the other kind
    alreadyYours: (
      address: string,
      kind: PropertyKind,
      whose: "your" | "their",
    ) =>
      `${address} is already ${whose} ${kind === "commercial" ? "business" : "home"} with us.`,
    PICK_IT: "Pick it from the list to ask about it.",
  },
  es: {
    alreadyAsked: (
      why: "asked" | "sent",
      where: string,
      email: string | null,
    ) =>
      why === "sent"
        ? `Ya le enviamos una cotización para ${where}. La encontrará en su cuenta.`
        : `Ya nos pidió una cotización para ${where}. Se la enviaremos a ${email} pronto.`,
    // "your" and "their" are both "su"
    alreadyYours: (address: string, kind: PropertyKind) =>
      `${address} ya está con nosotros como su ${kind === "commercial" ? "negocio" : "casa"}.`,
    PICK_IT: "Elija esa dirección de la lista para pedir una cotización.",
  },
});
// to the Client's own address, when an ask with their email can't go ahead
// at a Property they already have: the Guest who asked is told only what
// anyone would be, so the reply can't show what the Client has where (#243)
export const askClashEmail = (
  lang: Language,
  {
    name,
    email,
    address,
    kind,
    why,
  }: {
    name: string;
    email: string;
    address: string;
    kind: "residential" | "commercial";
    why: "otherKind" | "asked" | "sent";
  },
): Email => {
  const w = words[lang].askClash;
  const { alreadyAsked, alreadyYours } = askClash[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      ...(why === "otherKind"
        ? [
            paragraph(
              `${alreadyYours(address, kind, "your")} ${w.signInToPick}`,
            ),
            button(w.ASK, "/portal/request"),
          ]
        : [
            paragraph(alreadyAsked(why, address, email)),
            button(w.SEE_QUOTES, "/portal"),
          ]),
      paragraph(words[lang].NOT_YOU),
    ],
  };
};

// to the Office: someone asked for a Quote on the landing page or in the
// portal, and was told to expect it within a working day
export const quoteRequestedEmail = ({
  client,
  businessName,
  serviceName,
  regular,
  address,
  quoteId,
}: {
  client: string;
  businessName: string | null;
  serviceName: string;
  regular: boolean;
  address: string;
  quoteId: string;
}): Email => ({
  lang: "en",
  subject: `New quote request from ${client}`,
  blocks: [
    paragraph(
      `${client} asked for a quote. We told them to expect it within a working day.`,
    ),
    details([
      {
        label: "Client",
        value: businessName ? `${client}, ${businessName}` : client,
      },
      {
        label: "Service",
        value: regular ? `${serviceName}, with regular visits` : serviceName,
      },
      { label: "Where", value: address },
    ]),
    button("Open the quote", `/office/quotes/${quoteId}`),
  ],
});

// to the Office: open Quotes a booking has left no room for
export const quotesWithoutRoomEmail = ({
  quotes,
}: {
  quotes: { client: string; address: string; startsAt: Date }[];
}): Email => ({
  lang: "en",
  subject:
    quotes.length === 1
      ? "A quote needs another time"
      : `${quotes.length} quotes need another time`,
  blocks: [
    paragraph(
      quotes.length === 1
        ? "Its time is now booked up, so the client can't accept it:"
        : "Their times are now booked up, so the clients can't accept them:",
    ),
    details(
      quotes.map((q) => ({
        label: q.client,
        value: `${q.address}, ${formatWhen(q.startsAt)}`,
      })),
    ),
    paragraph(
      "Send each one a new quote for another time. They're under Needs attention until you do.",
    ),
    button("Open Needs attention", "/office"),
  ],
});

export const turnDownEmail = (
  lang: Language,
  {
    name,
    address,
    quoteId,
    reason,
  }: {
    name: string;
    address: string;
    quoteId: string;
    reason: TurnDownReason;
  },
): Email => {
  const w = words[lang];
  const { ASK_AGAIN, turnedDown } = messages[lang];
  return {
    lang,
    subject: w.turnDown.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(`${w.thanks(address)} ${turnedDown(reason)}`),
      paragraph(ASK_AGAIN),
      button(w.SEE_QUOTE, `/portal/quotes/${quoteId}`),
    ],
  };
};

// a Sent Revision, as much of it as the email shows
export type QuoteOffer = {
  number: number;
  proposedStartsAt: string;
  expiresAt: string;
  options: { serviceName: string; recommended: boolean; totalCents: number }[];
  plan: {
    recurrence: Recurrence;
    discountPercent: number;
    roundTotalCents: number;
    days: {
      serviceName: string;
      startsAt: string | null;
      savingCents: number;
      oneOffTotalCents: number;
    }[];
  } | null;
};

// a Service Plan Quote's offer: on one weekday, what each clean saves; on
// several, each weekday and what a week of them costs
const planOffer = (
  lang: Language,
  address: string,
  offer: QuoteOffer,
  plan: NonNullable<QuoteOffer["plan"]>,
  ready: string,
) => {
  const w = words[lang].quote;
  const { formatMoney, formatWhen, weekdayName } = formats[lang];
  const starting = formatWhen(new Date(offer.proposedStartsAt));
  if (plan.days.length === 1) {
    const [day] = plan.days;
    return [
      paragraph(
        w.planOne(
          address,
          ready,
          w.oneDay(
            day!.serviceName,
            messages[lang].recurrence[plan.recurrence],
          ),
          starting,
        ),
      ),
      paragraph(
        w.saves(
          formatMoney(offer.options[0]!.totalCents),
          formatMoney(day!.savingCents),
          formatMoney(day!.oneOffTotalCents),
        ),
      ),
    ];
  }
  return [
    paragraph(
      w.planOne(
        address,
        ready,
        describePlan(
          lang,
          plan.recurrence,
          plan.days.map((d) => ({ ...d, startsAt: new Date(d.startsAt!) })),
        ),
        starting,
      ),
    ),
    details(
      offer.options.map((option, i) => ({
        label: weekdayName(dayOf(new Date(plan.days[i]!.startsAt!))),
        value: formatMoney(option.totalCents),
      })),
    ),
    paragraph(
      w.weekly(formatMoney(plan.roundTotalCents), plan.discountPercent),
    ),
  ];
};

// A plain link to the Quote's page, not the Revision's, so a signed-out
// Client signs in (or up) with this email and comes back to it. A later
// Revision says the Quote has changed.
export const quoteEmail = (
  lang: Language,
  {
    name,
    email,
    quoteId,
    address,
    offer,
  }: {
    name: string;
    email: string;
    quoteId: string;
    address: string;
    offer: QuoteOffer;
  },
): Email => {
  const w = words[lang];
  const { formatMoney, formatWhen } = formats[lang];
  const revised = offer.number > 1;
  const ready = w.quote.ready(revised);
  return {
    lang,
    subject: w.quote.subject(offer.plan !== null, revised),
    blocks: [
      greeting(firstNameOf(name)),
      ...(offer.plan
        ? planOffer(lang, address, offer, offer.plan, ready)
        : [
            paragraph(
              w.quote.oneOff(
                address,
                ready,
                formatWhen(new Date(offer.proposedStartsAt)),
              ),
            ),
            details(
              offer.options.map((o) => ({
                label: `${o.serviceName}${o.recommended ? w.quote.RECOMMENDED : ""}`,
                value: formatMoney(o.totalCents),
              })),
            ),
          ]),
      paragraph(
        `${messages[lang].PRICES_INCLUDE_TAX} ${w.quote.openUntil(formatWhen(new Date(offer.expiresAt)), email)}`,
      ),
      button(w.SEE_QUOTE, `/portal/quotes/${quoteId}`),
    ],
  };
};

// ---- accepting ----

// how the Client pays: the Payment Method that paid, by its label, and the
// weekly Bill their cleans go on (ADR-0016), or null when each is charged
// when it's done
export type PaidWith = {
  paymentMethod: string | null;
  weeklyBill: BillPayment | null;
};

// what a one-off Job costs and what accepting took for it
export type Paid = PaidWith & { depositCents: number; totalCents: number };

// a plan's cleans, one on each weekday, from the first
export type PlanCleans = {
  recurrence: Recurrence;
  cleans: { startsAt: Date; serviceName: string; totalCents: number }[];
};

const chargedTo = (lang: Language, paid: PaidWith) =>
  words[lang].yourCard(cardOf(lang, paid.paymentMethod));

// a plan's weekdays, what each clean on them costs, and how it's paid;
// `now` for a change of plan
const planPrices = (
  lang: Language,
  { cleans }: PlanCleans,
  paid: PaidWith,
  now = false,
) => {
  const w = words[lang];
  const { formatMoney, weekdayName } = formats[lang];
  const each =
    cleans.length === 1
      ? formatMoney(cleans[0]!.totalCents)
      : cleans
          .map((c) =>
            w.eachOn(formatMoney(c.totalCents), weekdayName(dayOf(c.startsAt))),
          )
          .join(", ");
  if (paid.weeklyBill) {
    return `${w.eachIs(now, each)} ${messages[lang].cleansPaid(paid.weeklyBill)}`;
  }
  return cleans.length === 1
    ? w.eachChargedOne(now, each, chargedTo(lang, paid))
    : w.eachCharged(chargedTo(lang, paid), each);
};

// one email for the whole plan: its Jobs after the first get only the
// day-before reminder
export const planConfirmationEmail = (
  lang: Language,
  {
    name,
    address,
    plan,
    paid,
  }: {
    name: string;
    address: string;
    plan: PlanCleans;
    paid: PaidWith & { depositCents: number };
  },
): Email => {
  const w = words[lang].started;
  const { formatMoney, formatWhen } = formats[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(
        w.started(
          describePlan(lang, plan.recurrence, plan.cleans, w.at(address)),
          formatWhen(plan.cleans[0]!.startsAt),
        ),
      ),
      paragraph(planPrices(lang, plan, paid)),
      ...(paid.depositCents > 0
        ? [paragraph(w.deposit(formatMoney(paid.depositCents)))]
        : []),
      paragraph(w.REMIND),
      accessButton(lang),
    ],
  };
};

// the plan's new terms, from the first Job on them, and the Jobs they
// replaced
export const planChangeEmail = (
  lang: Language,
  {
    name,
    address,
    planId,
    plan,
    replaced,
    paid,
  }: {
    name: string;
    address: string;
    planId: string;
    plan: PlanCleans;
    replaced: Date[];
    paid: PaidWith;
  },
): Email => {
  const w = words[lang].changed;
  const { formatWhen } = formats[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(
        w.changed(
          address,
          formatWhen(plan.cleans[0]!.startsAt),
          describePlan(lang, plan.recurrence, plan.cleans),
        ),
      ),
      paragraph(`${planPrices(lang, plan, paid, true)} ${w.BEFORE}`),
      ...(replaced.length > 0
        ? [
            paragraph(
              w.replaced(replaced.length, replaced.map(formatWhen).join("; ")),
            ),
          ]
        : []),
      paragraph(w.DEPOSIT),
      button(w.SEE_PLAN, `/portal/plans/${planId}`),
    ],
  };
};

// what was taken for a one-off Job, and how the rest is paid
const bookingPrice = (lang: Language, paid: Paid) => {
  const w = words[lang].booked;
  const { billPaid, ON_WEEKS_BILL } = messages[lang];
  const { formatMoney } = formats[lang];
  const billed =
    paid.weeklyBill && `${ON_WEEKS_BILL}, ${billPaid[paid.weeklyBill]}`;
  const card = chargedTo(lang, paid);
  return paid.depositCents > 0
    ? w.depositTaken(
        formatMoney(paid.depositCents),
        card,
        formatMoney(paid.totalCents - paid.depositCents),
        billed || w.CHARGED_WHEN_DONE,
      )
    : w.total(formatMoney(paid.totalCents), billed || w.chargedTo(card));
};

export const bookingConfirmationEmail = (
  lang: Language,
  { name, clean, paid }: { name: string; clean: Clean; paid: Paid },
): Email => {
  const w = words[lang].booked;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.BOOKED),
      cleanDetails(lang, clean),
      paragraph(bookingPrice(lang, paid)),
      paragraph(w.REMIND),
      accessButton(lang),
    ],
  };
};
