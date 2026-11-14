import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Hourglass,
  KeyRound,
  MapPin,
  PauseCircle,
  Receipt,
  Phone,
  Repeat,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  business,
  type BillSummary,
  type ClientPastJob,
  type ClientSiteVisit,
  type ClientUpcomingJob,
  type ClientView,
  type PaymentMethodView,
  type QuoteSummary,
  type ServicePlanSummary,
  catalog,
  oneStop,
  type Language,
} from "@empire-cleaning/models";
import type { HomeTile } from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { QuoteIcon } from "../icons.ts";
import {
  addressOf,
  dayOfInstant,
  formatHours,
  formatMinutes,
} from "../format.ts";
import { saidWith } from "../words.ts";
import type { Hero } from "./HeroCard.tsx";
import { moneyNow, owedAnswer, yourCardTile } from "./payments.ts";

// Home's words, in the Client's language (ADR-0025)
const words = catalog({
  en: {
    reviewPrices: (n: number) =>
      n === 1 ? "Review a price change" : `Review ${n} price changes`,
    // a waiting tile's hint, when there are several
    andMore: (first: string, more: number) => `${first} · ${more} more`,
    seeQuotes: (n: number) => `See your ${n} quotes`,
    quoteReadyLabel: "Your quote is ready",
    askedToMove: (day: string, to: string) =>
      `You asked to move your ${day} clean to ${to}. We'll confirm, usually within a working day.`,
    firstClean: "Your first clean",
    nextClean: "Your next clean",
    serviceAt: (service: string, address: string) => `${service} at ${address}`,
    partOfPlan: (often: string) => `Part of your cleaning plan, ${often}`,
    crewOnSite: (cleaners: string, hours: string) =>
      `${cleaners}, about ${hours} on site`,
    siteVisit: "Your site visit",
    comesToSee: (visitor: string, address: string, length: string) =>
      `${visitor} comes to see ${address} for about ${length}`,
    visitFree: (phone: string) =>
      `Free: we look before we quote. To change the time, call ${phone}.`,
    planPaused: "Your cleaning plan is paused",
    paymentDue: "A payment is due",
    notThroughYet: "A payment on it hasn't gone through yet.",
    carriesOn: "Once it's paid, your plan carries on from its next date.",
    forWhen: (when: string) => `For ${when}`,
    at: " at ",
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
    moveRequest: "Your move request",
    to: (when: string) => `To ${when}`,
  },
  es: {
    reviewPrices: (n: number) =>
      n === 1
        ? "Revisar un cambio de precio"
        : `Revisar ${n} cambios de precio`,
    andMore: (first: string, more: number) => `${first} · ${more} más`,
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
    crewOnSite: (cleaners: string, hours: string) =>
      `${cleaners}, cerca de ${hours} en el lugar`,
    siteVisit: "Su visita previa",
    comesToSee: (visitor: string, address: string, length: string) =>
      `${visitor} va a ver ${address} durante cerca de ${length}`,
    visitFree: (phone: string) =>
      `Gratis: vemos el lugar antes de cotizar. Para cambiar la hora, llame al ${phone}.`,
    planPaused: "Su plan de limpieza está en pausa",
    paymentDue: "Hay un pago pendiente",
    notThroughYet: "Un pago del plan aún no ha pasado.",
    carriesOn: "Cuando esté pagado, su plan continúa desde su próxima fecha.",
    forWhen: (when: string) => `Para el ${when}`,
    at: " en ",
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
    moveRequest: "Su solicitud para reprogramar",
    to: (when: string) => `Para el ${when}`,
  },
});

type Said = ReturnType<typeof saidWith<(typeof words)["en"]>>;

// The Client's Home answers one question: what's next (UX pass, #96;
// the Home layout, #435). Its hero is what's owed when that asks anything
// of them, else the soonest thing booked, or, with nothing booked, where
// they stand with us. What they're waiting on us for is news under it;
// what's waiting on them, and what they can do from there, tiles.

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
  // what's owed first, when it asks anything of them; else what's next
  hero: Hero;
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
  const paused = data.plans.find((p) => p.status === "on_hold");
  const sent = data.quotes.filter((q) => q.status === "sent");
  // a Sent Quote leads only when nothing is booked
  const leadingQuote = next || paused ? undefined : sent[0];

  // what's waiting on them besides the card: a tile a kind, so never more
  // than two and the shortcuts keep two places. One leads to it; several
  // to where they all are: a home's page lists its quotes (Your details its
  // homes), Cleans' Past tab the cleans with prices to review
  const quotes = sent.filter((q) => q !== leadingQuote);
  const reviews = data.pastJobs.filter((j) => j.awaitingAnswer > 0);
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
    ...reviews.slice(0, 1).map((job) => ({
      id: "review",
      icon: ClipboardCheck,
      label: w.reviewPrices(
        reviews.reduce((sum, j) => sum + j.awaitingAnswer, 0),
      ),
      hint: hintFor(t.p.yourClean(dayOf(job.startsAt)), reviews),
      href: reviews.length === 1 ? jobLink(job.id) : pastCleansLink,
    })),
  ];

  const news = data.jobs.flatMap((job) =>
    job.movingTo
      ? [w.askedToMove(dayOf(job.startsAt), formatDateTime(job.movingTo))]
      : [],
  );

  // money first: what's owed, when it asks anything of them, is the card,
  // a paused plan's line under it
  const hero: Hero = money.owed?.asks
    ? {
        ...owedAnswer(money.owed, lang),
        lines: [
          money.owed.text,
          // booked cleans go ahead; none is booked till it is paid
          ...(paused ? [next ? t.BOOKED_GO_AHEAD : w.carriesOn] : []),
        ],
      }
    : heroOf(data, t, { next, paused, leadingQuote, now });
  const shortcuts = shortcutsOf(data, t, {
    next,
    paused,
    now,
    card: yourCardTile(money, lang),
    // Your card, unless it's the card's own Button (Update your card)
  }).filter(
    (s) => !(s.id === "card" && "href" in s && s.href === hero.action?.href),
  );

  return {
    news,
    hero,
    tiles: [...waiting, ...shortcuts.slice(0, Math.max(0, 4 - waiting.length))],
  };
}

type Context = {
  next: Booked | undefined;
  paused: ServicePlanSummary | undefined;
  leadingQuote?: QuoteSummary;
  now: Date;
};

const isToday = (iso: string, now: Date) =>
  dayOfInstant(iso) === dayOfInstant(now.toISOString());

function heroOf(data: HomeData, t: Said, ctx: Context): Hero {
  const { next, paused, leadingQuote, now } = ctx;
  const { w, dayOf, formatDateTime } = t;

  if (next?.kind === "job") {
    const { job } = next;
    const plan = data.plans.find((p) => p.id === job.servicePlanId);
    const first =
      !plan &&
      !data.pastJobs.some(
        (p) => p.status === "completed" && p.property.id === job.property.id,
      );
    const today = isToday(job.startsAt, now);
    return {
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
        w.crewOnSite(t.cleaners(job.crewSize), formatHours(job.hoursOnSite)),
      ],
      action: { label: t.p.seeTheClean, href: jobLink(job.id) },
    };
  }

  if (next?.kind === "visit") {
    const { visit } = next;
    return {
      label: w.siteVisit,
      icon: MapPin,
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
    };
  }

  // paused on a payment that asks nothing of them yet (one that does is
  // the owed card)
  if (paused) {
    return {
      label: w.planPaused,
      icon: PauseCircle,
      tone: "warning",
      headline: w.paymentDue,
      lines: [w.notThroughYet, w.carriesOn],
      action: { label: t.p.seeYourPlan, href: planLink(paused.id) },
    };
  }

  if (leadingQuote) {
    return {
      label: w.quoteReadyLabel,
      icon: QuoteIcon,
      tone: "info",
      headline: t.quoteHeadline(leadingQuote),
      lines: [
        [
          leadingQuote.proposedStartsAt &&
            w.forWhen(formatDateTime(leadingQuote.proposedStartsAt)),
          addressOf(leadingQuote.property),
        ]
          .filter(Boolean)
          .join(w.at),
        ...(leadingQuote.expiresAt
          ? [t.p.openUntil(dayOf(leadingQuote.expiresAt))]
          : []),
      ],
      action: seeQuote(t, leadingQuote.id),
    };
  }

  const asked = data.quotes.find(open);
  if (asked) {
    const seeIt = {
      label: w.seeAsked,
      href: quoteLink(asked.id),
    };
    if (asked.siteVisit === "needed") {
      return {
        label: w.beforeWeQuote,
        icon: MapPin,
        tone: "info",
        headline: w.callToArrange,
        lines: [w.weSee(addressOf(asked.property)), w.callWithinDay],
        action: seeIt,
      };
    }
    return {
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
    };
  }

  const plan = data.plans.find((p) => p.status === "active");
  if (plan) {
    return {
      label: t.p.yourPlan,
      icon: Repeat,
      tone: "info",
      headline: t.planName(plan),
      lines: [t.p.nextShowsHere],
      action: { label: t.p.seeYourPlan, href: planLink(plan.id) },
    };
  }

  // the latest Quote, now closed, says how things ended
  const last = data.quotes[0];
  if (last?.status === "expired") {
    return {
      label: w.expired,
      icon: CalendarClock,
      tone: "neutral",
      headline: t.quoteHeadline(last),
      lines: [
        last.expiresAt ? w.wasOpenUntil(dayOf(last.expiresAt)) : w.askAgain,
      ],
      action: requestQuote(t),
    };
  }
  if (last?.status === "turned_down") {
    return {
      label: w.couldntTake,
      icon: Ban,
      tone: "neutral",
      headline: last.turnDownReason
        ? t.turnDownReason[last.turnDownReason]
        : w.sorry,
      lines: [`${addressOf(last.property)}. ${t.ASK_AGAIN}`],
      action: requestQuote(t),
    };
  }
  if (last?.status === "declined") {
    return {
      label: t.p.nothingBooked,
      icon: CalendarDays,
      tone: "info",
      headline: w.changedMind,
      lines: [w.declined(last.service.name)],
      action: requestQuote(t),
    };
  }
  const latest = data.pastJobs.find((j) => j.status === "completed");
  if (last || latest) {
    return {
      label: t.p.nothingBooked,
      icon: CalendarDays,
      tone: "info",
      headline: w.wantUsBack,
      lines: latest ? [w.lastClean(dayOf(latest.startsAt))] : [],
      action: requestQuote(t),
    };
  }
  return {
    label: w.welcome,
    icon: Sparkles,
    tone: "info",
    headline: w.getAQuote,
    lines: [t.ASK_US],
    action: requestQuote(t),
  };
}

const planLink = (planId: string) =>
  linkTo({ to: "/portal/plans/$planId", params: { planId } });

function shortcutsOf(
  data: HomeData,
  t: Said,
  ctx: Context & { card: HomeTile },
): HomeTile[] {
  const { next, paused, now, card } = ctx;
  const { w, p, dayOf, formatDateTime } = t;
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
          href: linkTo({
            to: "/portal/properties/$propertyId",
            params: { propertyId: home.id },
          }),
        },
      ]
    : [];

  if (next?.kind === "job") {
    const { job } = next;
    if (isToday(job.startsAt, now)) return [callUs, ...getIn, card];
    const move: HomeTile = job.movingTo
      ? {
          icon: CalendarClock,
          id: "move",
          label: w.moveRequest,
          hint: w.to(formatDateTime(job.movingTo)),
          href: jobLink(job.id),
        }
      : {
          icon: CalendarClock,
          id: "move",
          label: job.servicePlanId ? p.moveOrSkip : p.moveOrCancel,
          hint: p.yourClean(dayOf(job.startsAt)),
          href: jobLink(job.id),
        };
    return [move, ...getIn, card, callUs];
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
