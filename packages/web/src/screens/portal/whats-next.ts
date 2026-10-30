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
  type TurnDownReason,
} from "@empire-cleaning/models";
import type { StatusTone } from "@empire-cleaning/ui";
import { linkTo, type AppHref } from "../../links.ts";
import { QuoteIcon } from "../icons.ts";
import {
  addressOf,
  dayOfInstant,
  formatDateTime,
  formatDay,
  formatHours,
  formatMinutes,
  formatMoney,
  formatTime,
  planName,
  quoteHeadline,
  recurrenceLabel,
} from "../format.ts";

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

export type HomeLink = AppHref | `tel:${string}`;

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
export type HomeNotice = { text: string; action: string; href: HomeLink };

export type Shortcut = {
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

const requestQuote = {
  label: "Request a Quote",
  href: linkTo({ to: "/portal/request" }),
};
const jobLink = (jobId: string) =>
  linkTo({ to: "/portal/jobs/$jobId", params: { jobId } });
const quoteLink = (quoteId: string) =>
  linkTo({ to: "/portal/quotes/$quoteId", params: { quoteId } });
const billLink = (billId: string) =>
  linkTo({ to: "/portal/bills/$billId", params: { billId } });
const cardLink = linkTo({ to: "/portal/payment-method" });
const detailsLink = linkTo({ to: "/portal/details" });

// "Tue, Oct 20" for an instant, New York's day
const dayOf = (iso: string) => formatDay(dayOfInstant(iso));

const turnedDownBecause: Record<TurnDownReason, string> = {
  out_of_area: "It's outside the area we clean",
  out_of_scope: "It's not work we take on",
  no_capacity: "We're fully booked just now",
};

const open = (q: QuoteSummary) =>
  q.status === "requested" || q.status === "draft";

// the soonest thing booked: a Job, or a Site Visit
type Booked =
  | { kind: "job"; startsAt: string; job: ClientUpcomingJob }
  | { kind: "visit"; startsAt: string; visit: ClientSiteVisit };

export function whatsNext(data: HomeData, now = new Date()): WhatsNext {
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

  const unpaidJob = data.pastJobs.find((j) => j.unpaid);
  const paused = data.plans.find((p) => p.status === "on_hold");
  const sent = data.quotes.filter((q) => q.status === "sent");
  // a Sent Quote leads only when nothing is booked
  const leadingQuote = next || paused ? undefined : sent[0];

  const notices: HomeNotice[] = [];
  // a plan paused with nothing booked says so in the hero instead
  if (unpaidJob && (next || !paused)) {
    notices.push({
      text:
        `We couldn't charge for your ${dayOf(unpaidJob.startsAt)} clean.` +
        (paused
          ? " Your Service Plan books no new cleans until it's paid."
          : ""),
      action: "Update your card",
      href: cardLink,
    });
  }
  for (const job of data.pastJobs.filter((j) => j.awaitingAnswer > 0)) {
    notices.push({
      text: `Your ${dayOf(job.startsAt)} clean needs your OK on ${job.awaitingAnswer === 1 ? "an extra" : `${job.awaitingAnswer} extras`}.`,
      action: "Review it",
      href: jobLink(job.id),
    });
  }
  for (const quote of sent.filter((q) => q !== leadingQuote)) {
    notices.push({
      text: `Your Quote is ready: ${quoteHeadline(quote)}.`,
      action: "See your Quote",
      href: quoteLink(quote.id),
    });
  }
  for (const bill of data.bills) {
    if (bill.unpaid) {
      notices.push({
        text: `We couldn't take payment for Bill ${bill.number}, ${formatMoney(bill.totalCents)}.`,
        action: "See the Bill",
        href: billLink(bill.id),
      });
    } else if (
      bill.status === "due" &&
      bill.payment === "on_page" &&
      bill.totalCents > 0
    ) {
      notices.push({
        text: `Bill ${bill.number}, ${formatMoney(bill.totalCents)}, is due by ${formatDay(bill.dueOn)}.`,
        action: "Pay the Bill",
        href: billLink(bill.id),
      });
    }
  }

  const news = data.jobs.flatMap((job) =>
    job.movingTo
      ? [
          `You asked to move your ${dayOf(job.startsAt)} clean to ${formatDateTime(job.movingTo)}. We'll confirm, usually within a working day.`,
        ]
      : [],
  );

  const hero = heroOf(data, { next, paused, unpaidJob, leadingQuote, now });

  const after =
    next && then
      ? then.kind === "job"
        ? `After that: ${then.job.serviceName}, ${formatDateTime(then.startsAt)}`
        : `After that: your Site Visit, ${formatDateTime(then.startsAt)}`
      : null;

  return {
    notices,
    news,
    hero,
    after,
    shortcuts: shortcutsOf(data, { next, paused, unpaidJob, now }),
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

function heroOf(data: HomeData, ctx: Context): Hero {
  const { next, paused, unpaidJob, leadingQuote, now } = ctx;

  if (next?.kind === "job") {
    const { job } = next;
    const plan = data.plans.find((p) => p.id === job.servicePlanId);
    const first =
      !plan &&
      !data.pastJobs.some(
        (p) => p.status === "completed" && p.property.id === job.property.id,
      );
    const today = isToday(job.startsAt, now);
    const cleaners =
      job.crewSize === 1 ? "1 Cleaner" : `${job.crewSize} Cleaners`;
    return {
      label: today ? "Today" : first ? "Your first clean" : "Your next clean",
      icon: CalendarCheck,
      tone: "info",
      startsAt: job.startsAt,
      headline: today ? formatTime(job.startsAt) : formatDateTime(job.startsAt),
      lines: [
        `${job.serviceName} at ${addressOf(job.property)}`,
        ...(plan
          ? [
              `Part of your Service Plan, ${recurrenceLabel[plan.recurrence].toLowerCase()}`,
            ]
          : []),
        `${cleaners}, about ${formatHours(job.hoursOnSite)} on site`,
      ],
      action: { label: "See the clean", href: jobLink(job.id) },
    };
  }

  if (next?.kind === "visit") {
    const { visit } = next;
    return {
      label: "Your Site Visit",
      icon: MapPin,
      tone: "info",
      startsAt: visit.startsAt,
      headline: formatDateTime(visit.startsAt),
      lines: [
        `${visit.visitorName} comes to see ${addressOf(visit.property)} for about ${formatMinutes(visit.minutes)}`,
        `Free: we look before we quote. To change the time, call ${business.phone.display}.`,
      ],
    };
  }

  if (paused) {
    return {
      label: "Your Service Plan is paused",
      icon: PauseCircle,
      tone: "warning",
      headline: unpaidJob ? "Update your card to carry on" : "A payment is due",
      lines: [
        unpaidJob
          ? `We couldn't charge for your ${dayOf(unpaidJob.startsAt)} clean.`
          : "A Bill on it hasn't been paid.",
        "Once it's paid, your plan carries on from its next date.",
      ],
      action: unpaidJob
        ? { label: "Update your card", href: cardLink }
        : { label: "See your plan", href: planLink(paused.id) },
    };
  }

  if (leadingQuote) {
    return {
      label: "Your Quote is ready",
      icon: QuoteIcon,
      tone: "info",
      headline: quoteHeadline(leadingQuote),
      lines: [
        [
          leadingQuote.proposedStartsAt &&
            `For ${formatDateTime(leadingQuote.proposedStartsAt)}`,
          addressOf(leadingQuote.property),
        ]
          .filter(Boolean)
          .join(" at "),
        ...(leadingQuote.expiresAt
          ? [`Open until ${dayOf(leadingQuote.expiresAt)}`]
          : []),
      ],
      action: { label: "See your Quote", href: quoteLink(leadingQuote.id) },
    };
  }

  const asked = data.quotes.find(open);
  if (asked) {
    const seeIt = {
      label: "See what you asked for",
      href: quoteLink(asked.id),
    };
    if (asked.siteVisit === "needed") {
      return {
        label: "Before we quote",
        icon: MapPin,
        tone: "info",
        headline: "We'll call to arrange a visit",
        lines: [
          `We see ${addressOf(asked.property)} before we price it. It's free.`,
          "We'll call you within a working day.",
        ],
        action: seeIt,
      };
    }
    return {
      label: "We're preparing your Quote",
      icon: Hourglass,
      tone: "info",
      headline: "Usually within a working day",
      lines: [
        `${asked.service.name} at ${addressOf(asked.property)}, asked ${dayOf(asked.createdAt)}`,
        "We email it to you, and it shows here.",
      ],
      action: seeIt,
    };
  }

  const plan = data.plans.find((p) => p.status === "active");
  if (plan) {
    return {
      label: "Your Service Plan",
      icon: Repeat,
      tone: "info",
      headline: planName(plan),
      lines: ["Your next clean shows here once it's booked."],
      action: { label: "See your plan", href: planLink(plan.id) },
    };
  }

  // the latest Quote, now closed, says how things ended
  const last = data.quotes[0];
  if (last?.status === "expired") {
    return {
      label: "Your Quote expired",
      icon: CalendarClock,
      tone: "neutral",
      headline: quoteHeadline(last),
      lines: [
        last.expiresAt
          ? `It was open until ${dayOf(last.expiresAt)}. Ask again and we'll price it afresh.`
          : "Ask again and we'll price it afresh.",
      ],
      action: requestQuote,
    };
  }
  if (last?.status === "turned_down") {
    return {
      label: "We couldn't take this one on",
      icon: Ban,
      tone: "neutral",
      headline: last.turnDownReason
        ? turnedDownBecause[last.turnDownReason]
        : "Sorry, we can't quote for it",
      lines: [`${addressOf(last.property)}. If anything changes, ask again.`],
      action: requestQuote,
    };
  }
  if (last?.status === "declined") {
    return {
      label: "Nothing booked",
      icon: CalendarDays,
      tone: "info",
      headline: "Changed your mind?",
      lines: [
        `You turned down our Quote for ${last.service.name}. Ask for a new one any time.`,
      ],
      action: requestQuote,
    };
  }
  const latest = data.pastJobs.find((j) => j.status === "completed");
  if (last || latest) {
    return {
      label: "Nothing booked",
      icon: CalendarDays,
      tone: "info",
      headline: "Want us back?",
      lines: latest ? [`Your last clean was ${dayOf(latest.startsAt)}.`] : [],
      action: requestQuote,
    };
  }
  return {
    label: "Welcome to Empire Cleaning",
    icon: Sparkles,
    tone: "info",
    headline: "Let's get you a Quote",
    lines: [
      "Tell us about your home and what you'd like cleaned. We email a price, usually within a working day.",
    ],
    action: requestQuote,
  };
}

const planLink = (planId: string) =>
  linkTo({ to: "/portal/plans/$planId", params: { planId } });

function shortcutsOf(data: HomeData, ctx: Context): Shortcut[] {
  const { next, paused, unpaidJob, now } = ctx;
  const callUs: Shortcut = {
    icon: Phone,
    label: "Call us",
    hint: business.phone.display,
    href: business.phone.href,
  };
  const pastCleans: Shortcut = {
    icon: Receipt,
    label: "Past cleans",
    hint: "And their receipts",
    href: linkTo({ to: "/portal/cleans", search: { tab: "past" } }),
  };
  const details: Shortcut = {
    icon: UserRound,
    label: "Your details",
    hint: "Name, email, phone",
    href: detailsLink,
  };
  const card: Shortcut = unpaidJob
    ? {
        icon: CreditCard,
        label: "Update your card",
        hint: "The last charge didn't go through",
        href: cardLink,
      }
    : {
        icon: CreditCard,
        label: "Your card",
        hint: data.paymentMethod?.label ?? "None saved yet",
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
          label: "How we get in",
          hint: home.accessInstructions || "Not added yet",
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
          label: "Your move request",
          hint: `To ${formatDateTime(job.movingTo)}`,
          href: jobLink(job.id),
        }
      : {
          icon: CalendarClock,
          label: job.servicePlanId ? "Move or skip" : "Move or cancel",
          hint: `Your ${dayOf(job.startsAt)} clean`,
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
