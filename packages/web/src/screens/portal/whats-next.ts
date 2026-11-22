import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Hourglass,
  KeyRound,
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
  sameDay,
  type Language,
} from "@empire-cleaning/models";
import type { HomeTile } from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { QuoteIcon, SiteVisitIcon } from "../icons.ts";
import { addressOf, formatHours, formatMinutes } from "../format.ts";
import { saidWith } from "../words.ts";
import type { Hero } from "./HeroCard.tsx";
import { moneyNow, owedAnswer, yourCardTile } from "./payments.ts";

// Home's words, in the Client's language (ADR-0025)
const words = catalog({
  en: {
    reviewPrices: (n: number) =>
      n === 1 ? "Review a price change" : `Review ${n} price changes`,
    // a price change waiting on them, as the card
    toAnswer: (n: number) =>
      n === 1 ? "A price change to answer" : `${n} price changes to answer`,
    more: (amount: string) => `${amount} more`,
    reviewThe: (n: number) =>
      n === 1 ? "Review the price change" : "Review the price changes",
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
    checkGetIn: "Check how we get in",
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
    planPaused: "Your cleaning plan is paused.",
    weTryAgain:
      "A payment on it hasn't gone through yet. We'll try again by ourselves, so there's nothing you need to do.",
    untilPaid:
      "Nothing's booked until it's paid. Then your plan carries on from its next date.",
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
    toAnswer: (n: number) =>
      n === 1
        ? "Un cambio de precio por responder"
        : `${n} cambios de precio por responder`,
    more: (amount: string) => `${amount} más`,
    reviewThe: (n: number) =>
      n === 1 ? "Revisar el cambio de precio" : "Revisar los cambios de precio",
    neededMore: (more: string, day: string) =>
      `El equipo necesitó ${more} en su limpieza del ${day}.`,
    alsoDid: (addOn: string, day: string) =>
      `El equipo también hizo ${addOn} en su limpieza del ${day}.`,
    needAnswer: (n: number) =>
      `${n} cambios de precio en sus limpiezas necesitan su respuesta.`,
    answerFirstBy: (day: string) => `Responda al primero antes del ${day}.`,
    answerByHint: (amount: string, day: string) =>
      `${amount}, responda antes del ${day}`,
    checkGetIn: "Revisar cómo entramos",
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
    planPaused: "Su plan de limpieza está en pausa.",
    weTryAgain:
      "Un pago del plan aún no ha pasado. Lo volveremos a intentar por nuestra cuenta, así que no tiene que hacer nada.",
    untilPaid:
      "No hay nada reservado hasta que se pague. Después, su plan continúa desde su próxima fecha.",
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
// the Home layout, #435). What waits on them leads (#493): what's owed,
// when that asks anything of them, then a price change to answer, then the
// morning a crew couldn't get in, then a Quote ready; else the soonest thing
// booked, or, with nothing booked, where they stand with us. Out of the
// usual, an alert above the card says why and the card's Button does it,
// Request a quote standing aside meanwhile. What they're waiting on us for
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

// why the card asks what it does, when that's out of the usual: its first
// sentence bold, as a page's alerts read
type Why = {
  tone: "info" | "warning" | "danger";
  lead: string;
  more?: string;
};

export type WhatsNext = {
  // what they're waiting on us for
  news: string[];
  // what waits on them first; else what's next
  hero: Hero;
  why?: Why;
  // the card asks something of them out of the usual: the usual step
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
  const paused = data.plans.find((p) => p.status === "on_hold");
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
  // the morning a crew couldn't get in, New York's day: they're emailed it,
  // and the clean's page keeps it after
  const lockedOut = data.pastJobs.find(
    (j) => j.noAccess && sameDay(new Date(j.noAccess.recordedAt), now),
  );

  // what waits on them, most pressing first: what's owed, when it asks
  // anything of them (a paused plan's line under it); a price change to
  // answer; how we get in, the morning we couldn't
  const lead = ((): Lead | undefined => {
    if (money.owed?.asks) {
      const owed = owedAnswer(money.owed, lang);
      const pausedLine = paused
        ? // booked cleans go ahead; none is booked till it is paid
          [next ? t.BOOKED_GO_AHEAD : w.carriesOn]
        : [];
      // one that's late says why above the card; one simply due, its line
      return money.owed.late
        ? {
            hero: { ...owed, lines: pausedLine },
            why: { tone: "danger", lead: `${money.owed.text}.` },
          }
        : { hero: { ...owed, lines: [...owed.lines, ...pausedLine] } };
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
            label: w.reviewThe(changes.length),
            href: reviews.length === 1 ? jobLink(job.id) : pastCleansLink,
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
          action: { label: w.checkGetIn, href: homeLink(home.id) },
        },
        why: {
          tone: "warning",
          lead: t.p.teamCame(
            formatDateTime(noAccess.recordedAt),
            noAccess.reason,
          ),
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
  // a Sent Quote leads when nothing else waits on them, a clean booked or
  // not: it waits on their answer
  const leadingQuote = lead ? undefined : sent[0];

  // what's waiting on them besides the card: a tile a kind, so never more
  // than two and the shortcuts keep two places. One leads to it; several
  // to where they all are: a home's page lists its quotes (Your details its
  // homes), Cleans' Past tab the cleans with prices to review
  const quotes = sent.filter((q) => q !== leadingQuote);
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
      label: w.reviewPrices(changes.length),
      // what they add, and by when the first wants an answer
      hint: firstBy
        ? w.answerByHint(t.formatMoney(changedCents), dayOf(firstBy))
        : t.formatMoney(changedCents),
      href: reviews.length === 1 ? jobLink(job.id) : pastCleansLink,
    })),
  ].filter((tile) => tile.id !== lead?.aside);

  const news = data.jobs.flatMap((job) =>
    job.movingTo
      ? [w.askedToMove(dayOf(job.startsAt), formatDateTime(job.movingTo))]
      : [],
  );

  const { hero, why, aside } =
    lead ??
    // paused with nothing booked: the plan, and why there's nothing
    (paused && !next && !leadingQuote
      ? {
          hero: {
            label: t.p.yourPlan,
            icon: PauseCircle,
            tone: "info",
            headline: t.planName(paused),
            lines: [w.untilPaid],
            action: { label: t.p.seeYourPlan, href: planLink(paused.id) },
          },
          why: { tone: "info", lead: w.planPaused, more: w.weTryAgain },
        }
      : { hero: heroOf(data, t, { next, leadingQuote, now }) });
  const shortcuts = shortcutsOf(data, t, {
    next,
    paused,
    now,
    card: yourCardTile(money, lang),
    // Your card, unless it's the card's own Button (Update your card); a
    // tile the card says
  }).filter(
    (s) =>
      s.id !== aside &&
      !(s.id === "card" && "href" in s && s.href === hero.action?.href),
  );

  return {
    news,
    hero,
    why,
    asks: lead !== undefined,
    tiles: [...waiting, ...shortcuts.slice(0, Math.max(0, 4 - waiting.length))],
  };
}

// the card, why it asks what it does when that's out of the usual, and a
// tile it makes a repeat
type Lead = { hero: Hero; why?: Why; aside?: string };

type Context = {
  next: Booked | undefined;
  paused: ServicePlanSummary | undefined;
  leadingQuote?: QuoteSummary;
  now: Date;
};

function heroOf(data: HomeData, t: Said, ctx: Omit<Context, "paused">): Hero {
  const { next, leadingQuote, now } = ctx;
  const { w, dayOf, formatDateTime } = t;

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
        icon: SiteVisitIcon,
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
          href: homeLink(home.id),
        },
      ]
    : [];

  if (next?.kind === "job") {
    const { job } = next;
    if (sameDay(new Date(job.startsAt), now)) return [callUs, ...getIn, card];
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
