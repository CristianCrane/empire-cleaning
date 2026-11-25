import { catalog, type Language } from "@empire-cleaning/models";
import type {
  ClientUpcomingJob,
  PropertyView,
  QuoteSummary,
  ServicePlanSummary,
} from "@empire-cleaning/models";
import type { StatusTone } from "@empire-cleaning/ui";
import { said, saidWith } from "../words.ts";
import { depositOf } from "./payments.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    quoteFor: (service: string) => `Quote for a ${service}`,
    quote: (status: string) => `Quote ${status.toLowerCase()}`,
    sent: (service: string, day: string) => `${service}, sent ${day}`,
    asked: (service: string, day: string) => `${service}, asked ${day}`,
  },
  es: {
    quoteFor: (service: string) => `Cotización de ${service}`,
    quote: (status: string) => `Cotización ${status.toLowerCase()}`,
    sent: (service: string, day: string) => `${service}, enviada el ${day}`,
    asked: (service: string, day: string) => `${service}, pedida el ${day}`,
  },
});

// The Client's homes on Your details, and a page each: where each stands,
// from their plans, Quotes and cleans. (UX pass, #96)

export type PropertiesData = {
  plans: ServicePlanSummary[];
  quotes: QuoteSummary[];
  jobs: ClientUpcomingJob[];
};

export type Standing = {
  tone: StatusTone;
  label: string;
  // what it's about, after the home's size
  line: string | null;
};

// "Mondays at 9:00 AM", or "Mondays at 9:00 AM and Thursdays at 1:00 PM"
export const planWhen = (
  lang: Language,
  plan: Pick<ServicePlanSummary, "days">,
) => said[lang].planDaysWhen(plan.days.flatMap((d) => d.startsAt ?? []));

// what a Sent Quote waits on when it's nothing of theirs (#534's UX design,
// Screens 2 and 3): its Deposit going through, a card saved with it (a 0%
// Deposit) finishing, or its time filled since it was sent. Home, a home's
// page and the quote's own page name it alike, and none asks them anything
export type QuoteWait = "payment" | "booking" | "filled";
export function waitOf(
  q: Pick<QuoteSummary, "status" | "paying" | "bookable">,
): QuoteWait | null {
  if (q.status !== "sent") return null;
  if (q.paying?.status === "goingThrough") {
    return q.paying.depositCents === 0 ? "booking" : "payment";
  }
  return q.bookable?.length === 0 ? "filled" : null;
}
export const waitLabelOf = (lang: Language, wait: QuoteWait) => {
  const { paymentPending, bookingPending, fullyBooked } = said[lang];
  return {
    payment: paymentPending,
    booking: bookingPending,
    filled: fullyBooked,
  }[wait];
};

// a Quote as a row's title: what it's for, a one-off's the clean they paid
// for when they did, as Home names it
export const quoteTitle = (lang: Language, q: QuoteSummary) =>
  q.kind === "service_plan"
    ? `${said[lang].quoteKindName(q.kind)}, ${q.service.name}`
    : saidWith(lang, words).w.quoteFor(q.payingServiceName ?? q.service.name);

// the most pressing thing about a home: its plan, a Quote ready, the
// next clean, a Quote waiting on nothing of theirs, a Quote we're
// preparing, or nothing
export function standingOf(
  lang: Language,
  property: Pick<PropertyView, "id">,
  data: PropertiesData,
): Standing {
  const t = saidWith(lang, words);
  const { w, p, clientQuoteStatus, formatDateTime, planStatus, shortDayOf } = t;
  const plan = data.plans.find(
    (p) => p.property.id === property.id && p.status !== "ended",
  );
  if (plan) {
    return plan.status === "on_hold"
      ? {
          tone: "warning",
          label: planStatus.on_hold.label,
          line: planWhen(lang, plan),
        }
      : { tone: "success", label: p.cleaningPlan, line: planWhen(lang, plan) };
  }
  const ours = data.quotes.filter((q) => q.property.id === property.id);
  const sent = ours.filter((q) => q.status === "sent");
  const ready = sent.find((q) => !waitOf(q));
  if (ready) {
    return {
      tone: "warning",
      label: w.quote(clientQuoteStatus.sent.label),
      line: w.sent(ready.service.name, shortDayOf(ready.sentAt)),
    };
  }
  const next = data.jobs
    .filter((j) => j.property.id === property.id)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (next) {
    return {
      tone: "info",
      label: t.jobStatusLabel.booked,
      line: formatDateTime(next.startsAt),
    };
  }
  // one waiting on nothing of theirs asks nothing, so after a clean booked,
  // and as Home's card ranks it: money on its way first, the newest's
  const waiting =
    sent.find((q) => waitOf(q) !== "filled") ??
    sent.find((q) => waitOf(q) === "filled");
  const wait = waiting && waitOf(waiting);
  if (waiting && wait) {
    const plan = waiting.kind === "service_plan";
    const service = waiting.payingServiceName ?? waiting.service.name;
    return {
      tone: "info",
      label: waitLabelOf(lang, wait),
      line:
        wait === "payment"
          ? depositOf(lang, plan ? null : service)
          : wait === "booking"
            ? plan
              ? p.yourPlan
              : service
            : w.sent(waiting.service.name, shortDayOf(waiting.sentAt)),
    };
  }
  const asked = ours.find(
    (q) => q.status === "requested" || q.status === "draft",
  );
  if (asked) {
    return {
      tone: "info",
      label: w.quote(clientQuoteStatus.requested.label),
      line: w.asked(asked.service.name, shortDayOf(asked.createdAt)),
    };
  }
  return { tone: "neutral", label: t.p.nothingBooked, line: null };
}
