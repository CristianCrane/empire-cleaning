import { catalog, type Language } from "@empire-cleaning/models";
import type {
  ClientUpcomingJob,
  PropertyView,
  QuoteSummary,
  ServicePlanSummary,
} from "@empire-cleaning/models";
import type { StatusTone } from "@empire-cleaning/ui";
import { said, saidWith } from "../words.ts";

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

// a Quote as a row's title: what it's for
export const quoteTitle = (lang: Language, q: QuoteSummary) =>
  q.kind === "service_plan"
    ? `${said[lang].quoteKindName(q.kind)}, ${q.service.name}`
    : saidWith(lang, words).w.quoteFor(q.service.name);

// the most pressing thing about a home: its plan, a Quote to answer, the
// next clean, a Quote we're preparing, or nothing
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
  const sent = ours.find((q) => q.status === "sent");
  if (sent) {
    return {
      tone: "warning",
      label: w.quote(clientQuoteStatus.sent.label),
      line: w.sent(sent.service.name, shortDayOf(sent.sentAt!)),
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
