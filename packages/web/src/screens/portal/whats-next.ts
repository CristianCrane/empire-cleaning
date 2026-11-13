import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CreditCard,
  Hourglass,
  KeyRound,
  MapPin,
  PauseCircle,
  Receipt,
  Phone,
  Repeat,
  Sparkles,
  UserRound,
  type LucideIcon,
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
import type { StatusTone } from "@empire-cleaning/ui";
import { linkTo, type AppHref } from "../../links.ts";
import { QuoteIcon } from "../icons.ts";
import {
  addressOf,
  dayOfInstant,
  formatHours,
  formatMinutes,
} from "../format.ts";
import { saidWith } from "../words.ts";

// Home's words, in the Client's language (ADR-0025)
const words = catalog({
  en: {
    needsOk: (day: string, n: number) =>
      `Your ${day} clean needs your OK on ${n === 1 ? "a price change" : `${n} price changes`}.`,
    reviewIt: "Review it",
    quoteReady: (headline: string) => `Your quote is ready: ${headline}.`,
    quoteReadyLabel: "Your quote is ready",
    billNotPaid: (bill: string, amount: string) => `${bill}, ${amount}.`,
    seeBill: "See the bill",
    billDue: (n: string, amount: string, day: string) =>
      `Bill ${n}, ${amount}, is due by ${day}.`,
    payBill: "Pay the bill",
    askedToMove: (day: string, to: string) =>
      `You asked to move your ${day} clean to ${to}. We'll confirm, usually within a working day.`,
    afterThat: (what: string, when: string) => `After that: ${what}, ${when}`,
    yourSiteVisit: "your site visit",
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
    updateToCarryOn: "Update your card to carry on",
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
    lastDidntGo: "The last payment didn't go through",
    noneSaved: "None saved yet",
    moveRequest: "Your move request",
    to: (when: string) => `To ${when}`,
  },
  es: {
    needsOk: (day: string, n: number) =>
      `Su limpieza del ${day} necesita su aprobación de ${n === 1 ? "un cambio de precio" : `${n} cambios de precio`}.`,
    reviewIt: "Revisar",
    quoteReady: (headline: string) => `Su cotización está lista: ${headline}.`,
    quoteReadyLabel: "Su cotización está lista",
    billNotPaid: (bill: string, amount: string) => `${bill}, ${amount}.`,
    seeBill: "Ver la factura",
    billDue: (n: string, amount: string, day: string) =>
      `La factura ${n}, de ${amount}, vence el ${day}.`,
    payBill: "Pagar la factura",
    askedToMove: (day: string, to: string) =>
      oneStop(
        `Pidió reprogramar su limpieza del ${day} para el ${to}. Se la confirmaremos, normalmente en un día hábil.`,
      ),
    afterThat: (what: string, when: string) => `Después: ${what}, ${when}`,
    yourSiteVisit: "su visita previa",
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
    updateToCarryOn: "Actualice su tarjeta para continuar",
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
    lastDidntGo: "El último pago no pasó",
    noneSaved: "Ninguna guardada todavía",
    moveRequest: "Su solicitud para reprogramar",
    to: (when: string) => `Para el ${when}`,
  },
});

type Said = ReturnType<typeof saidWith<(typeof words)["en"]>>;

// The Client's Home answers one question: what's next. Its hero is the
// soonest thing booked, or, with nothing booked, where they stand with us;
// what's waiting on them is a warning Notice above it, and what they're
// waiting on us for an info one. Shortcuts under it are what they can do
// from there. (UX pass, #96)

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

type HomeLink = AppHref | `tel:${string}`;

export type Hero = {
  label: string;
  icon: LucideIcon;
  tone: StatusTone;
  // when it is, for its calendar tile; none with nothing booked
  startsAt?: string;
  // the answer, large
  headline: string;
  lines: string[];
  action?: { label: string; href: HomeLink };
};

// something waiting on the Client, with the one thing to do about it
type HomeNotice = { text: string; action: string; href: HomeLink };

type Shortcut = {
  icon: LucideIcon;
  label: string;
  hint: string;
  href: HomeLink;
};

export type WhatsNext = {
  notices: HomeNotice[];
  // what they're waiting on us for
  news: string[];
  hero: Hero;
  // the thing booked after the hero's, which leads on to all their cleans
  after: string | null;
  shortcuts: Shortcut[];
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
const billLink = (billId: string) =>
  linkTo({ to: "/portal/bills/$billId", params: { billId } });
const cardLink = linkTo({ to: "/portal/payment-method" });
const detailsLink = linkTo({ to: "/portal/details" });

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
  const { w, dayOf, formatDateTime, formatDay, formatMoney } = t;
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
  const [next, then] = booked;

  // a clean they can put right with a card; one waiting on the payment
  // service we try again ourselves
  const unpaidJob = data.pastJobs.find(
    (j) => j.unpaid && j.unpaid !== "waiting",
  );
  const paused = data.plans.find((p) => p.status === "on_hold");
  const sent = data.quotes.filter((q) => q.status === "sent");
  // a Sent Quote leads only when nothing is booked
  const leadingQuote = next || paused ? undefined : sent[0];

  const notices: HomeNotice[] = [];
  // a plan paused with nothing booked says so in the hero instead
  if (unpaidJob && (next || !paused)) {
    notices.push({
      text:
        `${t.cleanNotPaid(dayOf(unpaidJob.startsAt))}.` +
        (paused ? ` ${t.BOOKED_GO_AHEAD}` : ""),
      action: t.UPDATE_CARD,
      href: cardLink,
    });
  }
  for (const job of data.pastJobs.filter((j) => j.awaitingAnswer > 0)) {
    notices.push({
      text: w.needsOk(dayOf(job.startsAt), job.awaitingAnswer),
      action: w.reviewIt,
      href: jobLink(job.id),
    });
  }
  for (const quote of sent.filter((q) => q !== leadingQuote)) {
    notices.push({
      text: w.quoteReady(t.quoteHeadline(quote)),
      action: seeQuote(t, quote.id).label,
      href: seeQuote(t, quote.id).href,
    });
  }
  for (const bill of data.bills) {
    if (bill.unpaid) {
      notices.push({
        text: w.billNotPaid(
          t.billNotPaid(bill.number),
          formatMoney(bill.totalCents),
        ),
        action: w.seeBill,
        href: billLink(bill.id),
      });
    } else if (
      bill.status === "due" &&
      bill.payment === "on_page" &&
      bill.totalCents > 0
    ) {
      notices.push({
        text: w.billDue(
          bill.number,
          formatMoney(bill.totalCents),
          formatDay(bill.dueOn),
        ),
        action: w.payBill,
        href: billLink(bill.id),
      });
    }
  }

  const news = data.jobs.flatMap((job) =>
    job.movingTo
      ? [w.askedToMove(dayOf(job.startsAt), formatDateTime(job.movingTo))]
      : [],
  );

  const hero = heroOf(data, t, { next, paused, unpaidJob, leadingQuote, now });

  const after =
    next && then
      ? then.kind === "job"
        ? w.afterThat(then.job.serviceName, formatDateTime(then.startsAt))
        : w.afterThat(w.yourSiteVisit, formatDateTime(then.startsAt))
      : null;

  return {
    notices,
    news,
    hero,
    after,
    shortcuts: shortcutsOf(data, t, { next, paused, unpaidJob, now }),
  };
}

type Context = {
  next: Booked | undefined;
  paused: ServicePlanSummary | undefined;
  unpaidJob: ClientPastJob | undefined;
  leadingQuote?: QuoteSummary;
  now: Date;
};

const isToday = (iso: string, now: Date) =>
  dayOfInstant(iso) === dayOfInstant(now.toISOString());

function heroOf(data: HomeData, t: Said, ctx: Context): Hero {
  const { next, paused, unpaidJob, leadingQuote, now } = ctx;
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

  if (paused) {
    return {
      label: w.planPaused,
      icon: PauseCircle,
      tone: "warning",
      headline: unpaidJob ? w.updateToCarryOn : w.paymentDue,
      lines: [
        unpaidJob
          ? `${t.cleanNotPaid(dayOf(unpaidJob.startsAt))}.`
          : w.notThroughYet,
        w.carriesOn,
      ],
      action: unpaidJob
        ? { label: t.UPDATE_CARD, href: cardLink }
        : { label: t.p.seeYourPlan, href: planLink(paused.id) },
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

function shortcutsOf(data: HomeData, t: Said, ctx: Context): Shortcut[] {
  const { next, paused, unpaidJob, now } = ctx;
  const { w, p, dayOf, formatDateTime } = t;
  const callUs: Shortcut = {
    icon: Phone,
    label: w.callUs,
    hint: business.phone.display,
    href: business.phone.href,
  };
  const pastCleans: Shortcut = {
    icon: Receipt,
    label: w.pastCleans,
    hint: w.receipts,
    href: linkTo({ to: "/portal/cleans", search: { tab: "past" } }),
  };
  const details: Shortcut = {
    icon: UserRound,
    label: p.yourDetails,
    hint: w.nameEmailPhone,
    href: detailsLink,
  };
  const card: Shortcut = unpaidJob
    ? {
        icon: CreditCard,
        label: t.UPDATE_CARD,
        hint: w.lastDidntGo,
        href: cardLink,
      }
    : {
        icon: CreditCard,
        label: p.yourCard,
        hint: data.paymentMethod?.label ?? w.noneSaved,
        href: cardLink,
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
  const getIn: Shortcut[] = home
    ? [
        {
          icon: KeyRound,
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
    const move: Shortcut = job.movingTo
      ? {
          icon: CalendarClock,
          label: w.moveRequest,
          hint: w.to(formatDateTime(job.movingTo)),
          href: jobLink(job.id),
        }
      : {
          icon: CalendarClock,
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
