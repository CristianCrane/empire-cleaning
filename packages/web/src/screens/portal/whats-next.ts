import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  ClipboardCheck,
  Hourglass,
  KeyRound,
  PauseCircle,
  Receipt,
  Phone,
  Repeat,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  business,
  type BillSummary,
  type DepositNamed,
  type ClientPastJob,
  type ClientSiteVisit,
  type ClientUpcomingJob,
  type ClientView,
  type PaymentMethodView,
  type QuoteSummary,
  type ServicePlanSummary,
  catalog,
  filledDaysOf,
  howLong,
  oneStop,
  sameDay,
  theTimeEs,
  type Language,
} from "@empire-cleaning/models";
import type { HomeTile } from "@empire-cleaning/ui";
import { linkTo, sameHref } from "../../links.ts";
import { QuoteIcon, SiteVisitIcon } from "../icons.ts";
import { addressOf, formatMinutes, lineOf, pausedPlans } from "../format.ts";
import { saidWith } from "../words.ts";
import type { Hero, Why } from "./HeroCard.tsx";
import { depositOf, moneyNow, owedAnswer, yourCardTile } from "./payments.ts";

// Home's words, in the Client's language (ADR-0025)
const words = catalog({
  en: {
    reviewPrices: (n: number) =>
      n === 1 ? "Review a price change" : `Review ${n} price changes`,
    // a price change waiting on them, as the card
    toAnswer: (n: number) =>
      n === 1 ? "A price change to answer" : `${n} price changes to answer`,
    more: (amount: string) => `${amount} more`,
    // and why, above it: what happened on which clean
    neededMore: (more: string, day: string) =>
      `The crew needed ${more} on your ${day} clean.`,
    alsoDid: (addOn: string, day: string) =>
      `The crew also did ${addOn} on your ${day} clean.`,
    needAnswer: (n: number) =>
      `${n} price changes on your cleans need your answer.`,
    answerFirstBy: (day: string) => `Please answer the first by ${day}.`,
    // the tile, while what's owed is the card
    answerByHint: (amount: string, day: string) =>
      `${amount}, answer by ${day}`,
    // only on that day, so its time and "today", where the clean's page
    // (PortalJob's teamCame) says the day, as it keeps it after
    cameToday: (time: string, reason: string) =>
      `The crew came at ${time} today, but couldn't get in: "${reason}".`,
    // a waiting tile's hint, when there are several
    andMore: (first: string, more: number) => lineOf([first, `${more} more`]),
    seeQuotes: (n: number) => `See your ${n} quotes`,
    quoteReadyLabel: "Your quote is ready",
    askedToMove: (day: string, to: string) =>
      `You asked to move your ${day} clean to ${to}. We'll confirm, usually within a working day.`,
    firstClean: "Your first clean",
    nextClean: "Your next clean",
    serviceAt: (service: string, address: string) => `${service} at ${address}`,
    partOfPlan: (often: string) => `Part of your cleaning plan, ${often}`,
    siteVisit: "Your site visit",
    comesToSee: (visitor: string, address: string, length: string) =>
      `${visitor} comes to see ${address} for about ${length}`,
    visitFree: (phone: string) =>
      `Free: we look before we quote. To change the time, call ${phone}.`,
    // then that there's nothing to do (NOTHING_TO_DO)
    planPending: "A payment on it is pending.",
    untilPaid:
      "Nothing's booked until it goes through. Then your plan carries on from its next date.",
    forWhen: (when: string) => `For ${when}`,
    at: " at ",
    // a quote whose time filled since it was sent (#534's UX design,
    // Screen 2), on its card, then that a new quote comes (NEW_QUOTE): a
    // plan's names its home, as its first clean's time may not be the day
    // that filled; a change to a plan, its new days
    atHome: (address: string) => `At ${address}`,
    planFilled: "One of the days your plan starts on is fully booked.",
    changeFilled: "One of the new days for your plan is fully booked.",
    // and as News, under another card, naming the quote
    filledNews: (when: string, service: string, address: string) =>
      `${when} is fully booked, so your quote for ${service} at ${address} can't be booked.`,
    planFilledNews: (address: string) =>
      `One of the days your cleaning plan at ${address} starts on is fully booked, so its quote can't be booked.`,
    changeFilledNews: (address: string) =>
      `One of the new days for your cleaning plan at ${address} is fully booked, so the change can't be booked. Your plan stays as it is, and we'll send you a new quote for another time.`,
    seeAsked: "See what you asked for",
    beforeWeQuote: "Before we quote",
    callToArrange: "We'll call to arrange a visit",
    weSee: (address: string) =>
      `We see ${address} before we price it. It's free.`,
    callWithinDay: "We'll call you within a working day.",
    workingOnIt: "We're working on it",
    askedOn: (service: string, address: string, day: string) =>
      `${service} at ${address}, asked ${day}`,
    emailIt: (withinADay: string) =>
      `We'll email it to you, ${withinADay}, and it shows here.`,
    expired: "Your quote expired",
    wasOpenUntil: (day: string) =>
      `It was open until ${day}. Ask again and we'll price it afresh.`,
    askAgain: "Ask again and we'll price it afresh.",
    couldntTake: "We couldn't take this one on",
    sorry: "Sorry, we can't take this one on",
    changedMind: "Changed your mind?",
    declined: (service: string) =>
      `You declined our quote for ${service}. Ask for a new one any time.`,
    wantUsBack: "Want us back?",
    lastClean: (day: string) => `Your last clean was ${day}.`,
    welcome: "Welcome to Empire Cleaning",
    getAQuote: "Let's get you a quote",
    callUs: "Call us",
    pastCleans: "Past cleans",
    receipts: "And their receipts",
    nameEmailPhone: "Name, email, phone",
  },
  es: {
    reviewPrices: (n: number) =>
      n === 1
        ? "Revisar un cambio de precio"
        : `Revisar ${n} cambios de precio`,
    toAnswer: (n: number) =>
      n === 1
        ? "Un cambio de precio por responder"
        : `${n} cambios de precio por responder`,
    more: (amount: string) => `${amount} más`,
    neededMore: (more: string, day: string) =>
      `El equipo necesitó ${more} en su limpieza del ${day}.`,
    alsoDid: (addOn: string, day: string) =>
      `El equipo también hizo ${addOn} en su limpieza del ${day}.`,
    needAnswer: (n: number) =>
      `${n} cambios de precio en sus limpiezas necesitan su respuesta.`,
    answerFirstBy: (day: string) => `Responda al primero antes del ${day}.`,
    answerByHint: (amount: string, day: string) =>
      `${amount}, responda antes del ${day}`,
    cameToday: (time: string, reason: string) =>
      `El equipo llegó hoy a ${theTimeEs(time)}, pero no pudo entrar: "${reason}".`,
    andMore: (first: string, more: number) => lineOf([first, `${more} más`]),
    seeQuotes: (n: number) => `Ver sus ${n} cotizaciones`,
    quoteReadyLabel: "Su cotización está lista",
    askedToMove: (day: string, to: string) =>
      oneStop(
        `Pidió reprogramar su limpieza del ${day} para el ${to}. Se la confirmaremos, normalmente en un día hábil.`,
      ),
    firstClean: "Su primera limpieza",
    nextClean: "Su próxima limpieza",
    serviceAt: (service: string, address: string) => `${service} en ${address}`,
    partOfPlan: (often: string) => `Parte de su plan de limpieza, ${often}`,
    siteVisit: "Su visita previa",
    comesToSee: (visitor: string, address: string, length: string) =>
      `${visitor} va a ver ${address} durante cerca de ${length}`,
    visitFree: (phone: string) =>
      `Gratis: vemos el lugar antes de cotizar. Para cambiar la hora, llame al ${phone}.`,
    planPending: "Un pago del plan está pendiente.",
    untilPaid:
      "No hay nada reservado hasta que el pago pase. Después, su plan continúa desde su próxima fecha.",
    forWhen: (when: string) => `Para el ${when}`,
    at: " en ",
    atHome: (address: string) => `En ${address}`,
    planFilled: "Uno de los días en que empieza su plan se llenó.",
    changeFilled: "Uno de los nuevos días de su plan se llenó.",
    filledNews: (when: string, service: string, address: string) =>
      `El ${when} ya está lleno, así que su cotización de ${service} en ${address} no se puede reservar.`,
    planFilledNews: (address: string) =>
      `Uno de los días en que empieza su plan de limpieza en ${address} se llenó, así que su cotización no se puede reservar.`,
    changeFilledNews: (address: string) =>
      `Uno de los nuevos días de su plan de limpieza en ${address} se llenó, así que el cambio no se puede reservar. Su plan sigue como está, y le enviaremos una nueva cotización para otra hora.`,
    seeAsked: "Ver lo que pidió",
    beforeWeQuote: "Antes de cotizar",
    callToArrange: "Le llamaremos para programar una visita",
    weSee: (address: string) =>
      `Vemos ${address} antes de ponerle precio. Es gratis.`,
    callWithinDay: "Le llamaremos en un día hábil.",
    workingOnIt: "Estamos trabajando en ella",
    askedOn: (service: string, address: string, day: string) =>
      `${service} en ${address}, pedida el ${day}`,
    emailIt: (withinADay: string) =>
      `Se la enviaremos por correo, ${withinADay}, y aparecerá aquí.`,
    expired: "Su cotización venció",
    wasOpenUntil: (day: string) =>
      `Estuvo abierta hasta el ${day}. Pídala de nuevo y le daremos un precio nuevo.`,
    askAgain: "Pídala de nuevo y le daremos un precio nuevo.",
    couldntTake: "No pudimos aceptar este trabajo",
    sorry: "Lo sentimos, no podemos aceptar este trabajo",
    changedMind: "¿Cambió de opinión?",
    declined: (service: string) =>
      `Rechazó nuestra cotización de ${service}. Pida una nueva cuando quiera.`,
    wantUsBack: "¿Quiere que volvamos?",
    lastClean: (day: string) => `Su última limpieza fue el ${day}.`,
    welcome: "Bienvenido a Empire Cleaning",
    getAQuote: "Le preparamos una cotización",
    callUs: "Llámenos",
    pastCleans: "Limpiezas pasadas",
    receipts: "Y sus recibos",
    nameEmailPhone: "Nombre, correo, teléfono",
  },
});

type Said = ReturnType<typeof saidWith<(typeof words)["en"]>>;

// The Client's Home answers one question: what's next (UX pass, #96;
// the Home layout, #435). What waits on them leads (#493): what's owed,
// when that asks anything of them, then a price change to answer, then the
// morning a crew couldn't get in, then a Quote ready; else the soonest thing
// booked, or, with nothing booked, where they stand with us. When the
// card needs a reason (money late, a price change, a crew who couldn't get
// in, a plan paused), an alert above it says why; while it asks something
// of them out of the usual (money owed that asks, a price change, a crew
// who couldn't get in), Request a quote stands aside. What they're waiting on us for
// is news under it; what else waits on them, and what they can do from
// there, tiles.

export type HomeData = {
  client: ClientView;
  plans: ServicePlanSummary[];
  quotes: QuoteSummary[];
  jobs: ClientUpcomingJob[];
  pastJobs: ClientPastJob[];
  siteVisits: ClientSiteVisit[];
  bills: BillSummary[];
  paymentMethod: PaymentMethodView | null;
};

export type WhatsNext = {
  // what they're waiting on us for
  news: string[];
  // what waits on them first; else what's next
  hero: Hero;
  why?: Why;
  // the card asks something of them out of the usual (money owed that
  // asks, a price change, a crew who couldn't get in): the usual step
  // (Request a quote) stands aside
  asks: boolean;
  // what's waiting on them, a tile a kind, never cut; then what they can
  // do from there, as many as fit four in all
  tiles: HomeTile[];
};

// the Client's ways to a Quote: asking for one, and seeing one
export const requestQuoteHref = linkTo({ to: "/portal/request" });
const requestQuote = (t: Said) => ({
  label: t.REQUEST_A_QUOTE,
  href: requestQuoteHref,
});
const jobLink = (jobId: string) =>
  linkTo({ to: "/portal/jobs/$jobId", params: { jobId } });
const quoteLink = (quoteId: string) =>
  linkTo({ to: "/portal/quotes/$quoteId", params: { quoteId } });
const seeQuote = (t: Said, quoteId: string) => ({
  label: t.p.seeYourQuote,
  href: quoteLink(quoteId),
});
const detailsLink = linkTo({ to: "/portal/details" });
const pastCleansLink = linkTo({
  to: "/portal/cleans",
  search: { tab: "past" },
});

const open = (q: QuoteSummary) =>
  q.status === "requested" || q.status === "draft";

// the soonest thing booked: a Job, or a Site Visit
type Booked =
  | { kind: "job"; startsAt: string; job: ClientUpcomingJob }
  | { kind: "visit"; startsAt: string; visit: ClientSiteVisit };

export function whatsNext(
  data: HomeData,
  lang: Language,
  now = new Date(),
): WhatsNext {
  const t = saidWith(lang, words);
  const { w, dayOf, formatDateTime } = t;
  const booked: Booked[] = [
    ...data.jobs.map((job) => ({
      kind: "job" as const,
      startsAt: job.startsAt,
      job,
    })),
    ...data.siteVisits.map((visit) => ({
      kind: "visit" as const,
      startsAt: visit.startsAt,
      visit,
    })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const [next] = booked;

  const money = moneyNow(data, lang);
  const [paused] = pausedPlans(data.plans);
  const sent = data.quotes.filter((q) => q.status === "sent");
  const reviews = data.pastJobs.filter((j) => j.waiting.length > 0);
  const changes = reviews.flatMap((job) =>
    job.waiting.map((change) => ({ job, change })),
  );
  // the earliest answer wanted first
  changes.sort((a, b) =>
    (a.change.lapsesAt ?? "").localeCompare(b.change.lapsesAt ?? ""),
  );
  const changedCents = changes.reduce((sum, c) => sum + c.change.totalCents, 0);
  const firstBy = changes[0]?.change.lapsesAt;
  // one to review leads to its clean; several to where they all are
  const reviewHref =
    reviews.length === 1 ? jobLink(reviews[0]!.id) : pastCleansLink;
  // the morning a crew couldn't get in, New York's day: they're emailed it,
  // and the clean's page keeps it after
  const lockedOut = data.pastJobs.find(
    (j) => j.noAccess && sameDay(new Date(j.noAccess.recordedAt), now),
  );

  // what waits on them, most pressing first: what's owed, when it asks
  // anything of them (a paused plan's line under it); a price change to
  // answer; how we get in, the morning we couldn't
  const lead = ((): Answer | undefined => {
    if (money.owed?.asks) {
      return owedAnswer(money.owed, lang, data.plans);
    }
    if (changes.length > 0) {
      const [{ job, change }] = changes as [(typeof changes)[number]];
      const day = dayOf(job.startsAt);
      return {
        hero: {
          label: w.toAnswer(changes.length),
          icon: ClipboardCheck,
          tone: "warning",
          headline: w.more(t.formatMoney(changedCents)),
          lines: [],
          action: {
            label: t.p.reviewThe(changes.length),
            href: reviewHref,
          },
        },
        // the card says the price changes
        aside: "review",
        why: {
          tone: "warning",
          ...(changes.length === 1
            ? {
                lead:
                  change.kind === "extra_time"
                    ? w.neededMore(t.adjustmentLabel(change), day)
                    : w.alsoDid(change.addOnName!, day),
                more: firstBy ? t.p.answerBy(dayOf(firstBy)) : undefined,
              }
            : {
                lead: w.needAnswer(changes.length),
                more: firstBy ? w.answerFirstBy(dayOf(firstBy)) : undefined,
              }),
        },
      };
    }
    const home = data.client.properties.find(
      (p) => p.id === lockedOut?.property.id,
    );
    if (lockedOut && home) {
      const noAccess = lockedOut.noAccess!;
      return {
        hero: {
          label: t.howWeGetIn,
          icon: KeyRound,
          tone: "warning",
          headline: home.accessInstructions || t.notAdded,
          lines: [],
          action: { label: t.p.checkGetIn, href: homeLink(home.id) },
        },
        why: {
          tone: "warning",
          lead: w.cameToday(t.formatTime(noAccess.recordedAt), noAccess.reason),
          more:
            noAccess.feeCents > 0
              ? t.noAccessFee({
                  onPlan: lockedOut.servicePlanId !== null,
                  fee: t.formatMoney(noAccess.feeCents),
                })
              : undefined,
        },
        // the card says how we get in
        aside: "getIn",
      };
    }
    return undefined;
  })();
  // a Sent Quote whose Deposit is going through, or whose time filled since
  // it was sent, waits on nothing of theirs, so it's no quote to answer: a
  // state card, as a paused plan's, or News (#534's UX design, Screen 2)
  const going = sent.filter((q) => q.paying?.status === "goingThrough");
  const filled = sent.filter(
    (q) => !going.includes(q) && q.bookable?.length === 0,
  );
  // among the rest, ready, one whose payment waits on their bank or ended
  // unbooked leads, so its alert and its card are of the same quote
  const ready = sent
    .filter((q) => !going.includes(q) && !filled.includes(q))
    .sort((a, b) => Number(Boolean(b.paying)) - Number(Boolean(a.paying)));
  // a Sent Quote leads when nothing else waits on them, a clean booked or
  // not: it waits on their answer
  const leadingQuote = lead ? undefined : ready[0];
  // the state card, the newest's, when nothing booked or paused is ahead
  // of it; money on its way first, as it's what they came to check
  const state =
    lead || leadingQuote || next || paused
      ? undefined
      : (going[0] ?? filled[0]);

  // what's waiting on them besides the card: a tile a kind, so never more
  // than two and the shortcuts keep two places. One leads to it; several
  // to where they all are: a home's page lists its quotes (Your details its
  // homes), Cleans' Past tab the cleans with prices to review
  const quotes = ready.filter((q) => q !== leadingQuote);
  const hintFor = (first: string, all: unknown[]) =>
    all.length > 1 ? w.andMore(first, all.length - 1) : first;
  const waiting: HomeTile[] = [
    ...quotes.slice(0, 1).map((quote) => ({
      id: "quote",
      icon: QuoteIcon,
      label: quotes.length > 1 ? w.seeQuotes(quotes.length) : t.p.seeYourQuote,
      hint: hintFor(t.quoteHeadline(quote), quotes),
      href:
        quotes.length === 1
          ? quoteLink(quote.id)
          : quotes.every((q) => q.property.id === quote.property.id)
            ? linkTo({
                to: "/portal/properties/$propertyId",
                params: { propertyId: quote.property.id },
              })
            : detailsLink,
    })),
    ...reviews.slice(0, 1).map(() => ({
      id: "review",
      icon: ClipboardCheck,
      label: w.reviewPrices(changes.length),
      // what they add, and by when the first wants an answer
      hint: firstBy
        ? w.answerByHint(w.more(t.formatMoney(changedCents)), dayOf(firstBy))
        : w.more(t.formatMoney(changedCents)),
      href: reviewHref,
    })),
  ];

  const news = [
    ...data.jobs.flatMap((job) =>
      job.movingTo
        ? [w.askedToMove(dayOf(job.startsAt), formatDateTime(job.movingTo))]
        : [],
    ),
    // each quote that isn't the card says where it stands, newest first:
    // a deposit going through, a time filled (or the refund it brought),
    // a payment that ended unbooked
    ...sent.flatMap((q) => {
      if (q === state || q === leadingQuote) return [];
      if (going.includes(q)) {
        return [
          q.paying!.depositCents === 0
            ? t.cardPendingNews(namedFor(t, q, true))
            : t.depositPendingNews(namedFor(t, q, true)),
        ];
      }
      const ended = endingOf(t, q, true);
      if (filled.includes(q)) {
        // a refund as it filled says both, in place of the filled one's
        return [
          q.paying?.status === "refunded" && ended
            ? ended.lead
            : filledNews(t, q),
        ];
      }
      return ended ? [ended.lead] : [];
    }),
  ];

  const { hero, why, aside } =
    lead ?? heroOf(data, t, { next, paused, leadingQuote, state, now });
  const shortcuts = shortcutsOf(data, t, {
    next,
    paused,
    now,
    card: yourCardTile(money, lang),
  });
  // a tile is a repeat when it's the one the card names (Your card, or the
  // lead's) and leads where the card's Button does: the card holds it
  const repeats = (tile: HomeTile) =>
    (tile.id === "card" || tile.id === aside) &&
    "href" in tile &&
    sameHref(tile.href, hero.action?.href);
  const waitingLeft = waiting.filter((tile) => !repeats(tile));
  const shortcutsLeft = shortcuts.filter((tile) => !repeats(tile));

  return {
    news,
    hero,
    why,
    asks: lead !== undefined,
    tiles: [
      ...waitingLeft,
      ...shortcutsLeft.slice(0, Math.max(0, 4 - waitingLeft.length)),
    ],
  };
}

// the card, why it says what it does when it needs a reason, and
// the tile it makes a repeat
type Answer = { hero: Hero; why?: Why; aside?: string };

type Context = {
  next: Booked | undefined;
  paused: ServicePlanSummary | undefined;
  leadingQuote?: QuoteSummary;
  // a quote waiting on nothing of theirs, as the card (#534)
  state?: QuoteSummary;
  now: Date;
};

// a sent quote's line on its card: when, and at which home
const forLine = (t: Said, quote: QuoteSummary) =>
  [
    quote.proposedStartsAt &&
      t.w.forWhen(t.formatDateTime(quote.proposedStartsAt)),
    addressOf(quote.property),
  ]
    .filter(Boolean)
    .join(t.w.at);

// the Service a sent quote leads with: the server's, what's still bookable
const serviceOf = (q: QuoteSummary) => q.headlineServiceName ?? q.service.name;

// a quote's payment as Home names it: a plan by its home; a clean by the
// Service paid for and, in News, under another card, by its time and home
const namedFor = (t: Said, q: QuoteSummary, news: boolean): DepositNamed =>
  q.kind === "service_plan"
    ? { plan: true, at: addressOf(q.property) }
    : {
        plan: false,
        service: q.payingServiceName ?? serviceOf(q),
        news:
          news && q.proposedStartsAt
            ? {
                when: t.formatDateTime(q.proposedStartsAt),
                at: addressOf(q.property),
              }
            : null,
      };

// how a quote's latest payment ended without booking it, as the alert
// over its card, or as News, in one sentence; none while it's on its way
function endingOf(t: Said, q: QuoteSummary, news: boolean): Why | undefined {
  const { paying } = q;
  if (!paying) return undefined;
  const n = namedFor(t, q, news);
  // a card saved with nothing charged (a 0% Deposit) says what wasn't
  // booked, as nothing was taken
  const card = paying.depositCents === 0;
  switch (paying.status) {
    case "goingThrough":
    case "approving":
      return undefined;
    case "failed":
      return { tone: "danger", lead: t.depositFailedOn(n, card, paying.why) };
    case "notApproved":
      return { tone: "info", lead: t.depositNotApprovedOn(n, card) };
    case "refunded":
      break;
  }
  const unbooked = {
    why: paying.why,
    card,
    plan: q.kind === "service_plan",
    expired: q.status === "expired",
    // what's still bookable then, when its own Service's time filled
    other:
      paying.why === "no_room" && q.kind === "one_off" && q.bookable?.length
        ? serviceOf(q)
        : null,
  };
  const lead = t.depositRefundedOn(n, card);
  if (news) {
    return {
      tone: "info",
      lead: t.depositUnbookedNews(n, unbooked) ?? lead,
    };
  }
  const more = t.depositUnbooked(unbooked);
  return { tone: "info", lead, ...(more ? { more } : {}) };
}

// a quote whose time filled since it was sent, named as its page names it
// (models' bookedUp): one sent to a home with a plan changes that plan
const filledOf = (q: QuoteSummary) =>
  filledDaysOf({ plan: q.plan, changes: Boolean(q.homePlanId) });
const filledNews = (t: Said, q: QuoteSummary) => {
  const at = addressOf(q.property);
  switch (filledOf(q)) {
    case "change":
      return t.w.changeFilledNews(at);
    case "plan":
      return `${t.w.planFilledNews(at)} ${t.NEW_QUOTE}`;
    case "clean":
      return `${t.w.filledNews(
        t.formatDateTime(q.proposedStartsAt!),
        serviceOf(q),
        at,
      )} ${t.NEW_QUOTE}`;
  }
};

// the state card of a quote waiting on nothing of theirs (#534's UX
// design, Screen 2): its Deposit going through, or a card saved with
// nothing charged (a 0% Deposit) finishing; or its time filled, with a
// refund's alert when one came of it. Nothing to do: an outlined button
function stateOf(t: Said, q: QuoteSummary): Answer {
  const action = { ...seeQuote(t, q.id), secondary: true };
  const plan = q.kind === "service_plan";
  if (q.paying?.status === "goingThrough") {
    return q.paying.depositCents === 0
      ? {
          hero: {
            label: t.bookingPending,
            icon: Hourglass,
            tone: "info",
            headline: t.quoteHeadline(q),
            lines: [forLine(t, q), t.cardPendingLine(plan)],
            action,
          },
        }
      : {
          hero: {
            label: t.paymentPending,
            icon: Wallet,
            tone: "info",
            headline: t.formatMoney(q.paying.depositCents),
            lines: [
              lineOf([
                depositOf(
                  t.lang,
                  plan ? null : (q.payingServiceName ?? serviceOf(q)),
                ),
                t.NOTHING_TO_DO,
              ]),
              forLine(t, q),
            ],
            action,
          },
        };
  }
  const how = filledOf(q);
  return {
    hero: {
      label: t.fullyBooked,
      icon: CalendarX,
      tone: "info",
      headline: t.quoteHeadline(q),
      lines:
        how === "clean"
          ? [forLine(t, q), t.NEW_QUOTE]
          : [
              t.w.atHome(addressOf(q.property)),
              `${how === "change" ? t.w.changeFilled : t.w.planFilled} ${t.NEW_QUOTE}`,
            ],
      action,
    },
    why: q.paying?.status === "refunded" ? endingOf(t, q, false) : undefined,
  };
}

function heroOf(data: HomeData, t: Said, ctx: Context): Answer {
  const { next, paused, leadingQuote, state, now } = ctx;
  const { w, dayOf, formatDateTime } = t;

  if (leadingQuote) {
    const { paying } = leadingQuote;
    return {
      hero: {
        label: w.quoteReadyLabel,
        icon: QuoteIcon,
        tone: "info",
        headline: t.quoteHeadline(leadingQuote),
        lines: [
          forLine(t, leadingQuote),
          ...(leadingQuote.expiresAt
            ? [t.p.openUntil(dayOf(leadingQuote.expiresAt))]
            : []),
          // their bank waiting on them to approve it: still theirs to do
          ...(paying?.status === "approving"
            ? [
                paying.depositCents === 0
                  ? t.CARD_WAITING_LINE
                  : t.DEPOSIT_WAITING_LINE,
              ]
            : []),
        ],
        action: seeQuote(t, leadingQuote.id),
      },
      why: endingOf(t, leadingQuote, false),
    };
  }

  if (next?.kind === "job") {
    const { job } = next;
    const plan = data.plans.find((p) => p.id === job.servicePlanId);
    const first =
      !plan &&
      !data.pastJobs.some(
        (p) => p.status === "completed" && p.property.id === job.property.id,
      );
    const today = sameDay(new Date(job.startsAt), now);
    return {
      hero: {
        label: today ? t.today : first ? w.firstClean : w.nextClean,
        icon: CalendarCheck,
        tone: "info",
        startsAt: job.startsAt,
        headline: today
          ? t.formatTime(job.startsAt)
          : formatDateTime(job.startsAt),
        lines: [
          w.serviceAt(job.serviceName, addressOf(job.property)),
          ...(plan ? [w.partOfPlan(t.recurrence[plan.recurrence])] : []),
          // how long, as the clean's page says it (#493's body)
          howLong(t, job.hoursOnSite),
        ],
        action: { label: t.p.seeTheClean, href: jobLink(job.id) },
      },
    };
  }

  if (next?.kind === "visit") {
    const { visit } = next;
    return {
      hero: {
        label: w.siteVisit,
        icon: SiteVisitIcon,
        tone: "info",
        startsAt: visit.startsAt,
        headline: formatDateTime(visit.startsAt),
        lines: [
          w.comesToSee(
            visit.visitorName,
            addressOf(visit.property),
            formatMinutes(visit.minutes),
          ),
          w.visitFree(business.phone.display),
        ],
      },
    };
  }

  // paused, with nothing to do (a payment that asks something of them is
  // the owed card): the plan, and why nothing's booked
  if (paused) {
    return {
      hero: {
        label: t.p.yourPlan,
        icon: PauseCircle,
        tone: "info",
        headline: t.planName(paused),
        lines: [w.untilPaid],
        // nothing to do, so not the page's primary, as the owed card's
        // See the bill (#536)
        action: {
          label: t.p.seeYourPlan,
          href: planLink(paused.id),
          secondary: true,
        },
      },
      why: {
        tone: "info",
        lead: t.p.planPaused,
        more: `${w.planPending} ${t.NOTHING_TO_DO}`,
      },
    };
  }

  // a quote waiting on nothing of theirs: without its card, Home would say
  // nothing's booked, untrue for one who's just paid (#534)
  if (state) return stateOf(t, state);

  const asked = data.quotes.find(open);
  if (asked) {
    const seeIt = {
      label: w.seeAsked,
      href: quoteLink(asked.id),
    };
    if (asked.siteVisit === "needed") {
      return {
        hero: {
          label: w.beforeWeQuote,
          icon: SiteVisitIcon,
          tone: "info",
          headline: w.callToArrange,
          lines: [w.weSee(addressOf(asked.property)), w.callWithinDay],
          action: seeIt,
        },
      };
    }
    return {
      hero: {
        label: t.p.yourQuote,
        icon: Hourglass,
        tone: "info",
        headline: w.workingOnIt,
        lines: [
          w.askedOn(
            asked.service.name,
            addressOf(asked.property),
            dayOf(asked.createdAt),
          ),
          w.emailIt(t.WITHIN_A_DAY),
        ],
        action: seeIt,
      },
    };
  }

  const plan = data.plans.find((p) => p.status === "active");
  if (plan) {
    return {
      hero: {
        label: t.p.yourPlan,
        icon: Repeat,
        tone: "info",
        headline: t.planName(plan),
        lines: [t.p.nextShowsHere],
        action: { label: t.p.seeYourPlan, href: planLink(plan.id) },
      },
    };
  }

  // the latest Quote, now closed, says how things ended, and a deposit
  // refunded as it closed, over it: the money's what its card doesn't say.
  // Only here: Home is about what's ahead, and the quote's page and
  // Payments keep it (#534's UX design, Screen 2)
  const last = data.quotes[0];
  const refund =
    last?.paying?.status === "refunded" ? endingOf(t, last, false) : undefined;
  if (last?.status === "expired") {
    return {
      hero: {
        label: w.expired,
        icon: CalendarClock,
        tone: "neutral",
        headline: t.quoteHeadline(last),
        lines: [
          last.expiresAt ? w.wasOpenUntil(dayOf(last.expiresAt)) : w.askAgain,
        ],
        action: requestQuote(t),
      },
      why: refund,
    };
  }
  if (last?.status === "turned_down") {
    return {
      hero: {
        label: w.couldntTake,
        icon: Ban,
        tone: "neutral",
        headline: last.turnDownReason
          ? t.turnDownReason[last.turnDownReason]
          : w.sorry,
        lines: [`${addressOf(last.property)}. ${t.ASK_AGAIN}`],
        action: requestQuote(t),
      },
      why: refund,
    };
  }
  if (last?.status === "declined") {
    return {
      hero: {
        label: t.p.nothingBooked,
        icon: CalendarDays,
        tone: "info",
        headline: w.changedMind,
        lines: [w.declined(last.service.name)],
        action: requestQuote(t),
      },
    };
  }
  const latest = data.pastJobs.find((j) => j.status === "completed");
  if (last || latest) {
    return {
      hero: {
        label: t.p.nothingBooked,
        icon: CalendarDays,
        tone: "info",
        headline: w.wantUsBack,
        lines: latest ? [w.lastClean(dayOf(latest.startsAt))] : [],
        action: requestQuote(t),
      },
    };
  }
  return {
    hero: {
      label: w.welcome,
      icon: Sparkles,
      tone: "info",
      headline: w.getAQuote,
      lines: [t.ASK_US],
      action: requestQuote(t),
    },
  };
}

const homeLink = (propertyId: string) =>
  linkTo({ to: "/portal/properties/$propertyId", params: { propertyId } });
const planLink = (planId: string) =>
  linkTo({ to: "/portal/plans/$planId", params: { planId } });

function shortcutsOf(
  data: HomeData,
  t: Said,
  ctx: Context & { card: HomeTile },
): HomeTile[] {
  const { next, paused, now, card } = ctx;
  const { w, p, dayOf } = t;
  const callUs: HomeTile = {
    icon: Phone,
    id: "call",
    label: w.callUs,
    hint: business.phone.display,
    externalHref: business.phone.href,
  };
  const pastCleans: HomeTile = {
    icon: Receipt,
    id: "past",
    label: w.pastCleans,
    hint: w.receipts,
    href: pastCleansLink,
  };
  const details: HomeTile = {
    icon: UserRound,
    id: "details",
    label: p.yourDetails,
    hint: w.nameEmailPhone,
    href: detailsLink,
  };
  // the home the next thing is at, else their only one
  const homeId =
    next?.kind === "job"
      ? next.job.property.id
      : next?.kind === "visit"
        ? next.visit.property.id
        : data.client.properties.length === 1
          ? data.client.properties[0]!.id
          : undefined;
  const home = data.client.properties.find((p) => p.id === homeId);
  const getIn: HomeTile[] = home
    ? [
        {
          icon: KeyRound,
          id: "getIn",
          label: t.howWeGetIn,
          hint: home.accessInstructions || t.notAdded,
          href: homeLink(home.id),
        },
      ]
    : [];

  if (next?.kind === "job") {
    const { job } = next;
    if (sameDay(new Date(job.startsAt), now)) return [callUs, ...getIn, card];
    // a move already asked is the news's, once, and the card leads to
    // the clean
    const move: HomeTile[] = job.movingTo
      ? []
      : [
          {
            icon: CalendarClock,
            id: "move",
            label: job.servicePlanId ? p.moveOrSkip : p.moveOrCancel,
            hint: p.yourClean(dayOf(job.startsAt)),
            href: jobLink(job.id),
          },
        ];
    return [...move, ...getIn, card, callUs];
  }
  if (paused) return [card, pastCleans, callUs];
  if (next || data.quotes.some(open) || data.quotes[0]?.status === "sent") {
    return [...getIn, details, callUs];
  }
  // nothing booked or asked for: a past Client can look back
  return data.pastJobs.length > 0
    ? [pastCleans, details, callUs]
    : [details, callUs];
}
