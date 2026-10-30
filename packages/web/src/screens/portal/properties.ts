import type {
  ClientUpcomingJob,
  PropertyView,
  QuoteSummary,
  ServicePlanSummary,
} from "@empire-cleaning/models";
import type { StatusTone } from "@empire-cleaning/ui";
import {
  dayOfInstant,
  formatDateTime,
  formatShortDay,
  planDayWhen,
} from "../format.ts";

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

const shortDayOf = (iso: string) => formatShortDay(dayOfInstant(iso));

// "Mondays at 9:00 AM", or "Mondays at 9:00 AM and Thursdays at 1:00 PM"
export const planWhen = (plan: Pick<ServicePlanSummary, "days">) =>
  plan.days
    .flatMap((d) => (d.startsAt ? [planDayWhen(d.startsAt)] : []))
    .join(" and ");

// a Quote as a row's title: what it's for
export const quoteTitle = (q: QuoteSummary) =>
  q.kind === "service_plan"
    ? `Service Plan Quote, ${q.service.name}`
    : `Quote for a ${q.service.name}`;

// the most pressing thing about a home: its plan, a Quote to answer, the
// next clean, a Quote we're preparing, or nothing
export function standingOf(
  property: Pick<PropertyView, "id">,
  data: PropertiesData,
): Standing {
  const plan = data.plans.find(
    (p) => p.property.id === property.id && p.status !== "ended",
  );
  if (plan) {
    return plan.status === "on_hold"
      ? { tone: "warning", label: "On Hold", line: planWhen(plan) }
      : { tone: "success", label: "Service Plan", line: planWhen(plan) };
  }
  const ours = data.quotes.filter((q) => q.property.id === property.id);
  const sent = ours.find((q) => q.status === "sent");
  if (sent) {
    return {
      tone: "warning",
      label: "Quote to answer",
      line: `${sent.service.name}, sent ${shortDayOf(sent.sentAt!)}`,
    };
  }
  const next = data.jobs
    .filter((j) => j.property.id === property.id)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (next) {
    return {
      tone: "info",
      label: "Booked",
      line: formatDateTime(next.startsAt),
    };
  }
  const asked = ours.find(
    (q) => q.status === "requested" || q.status === "draft",
  );
  if (asked) {
    return {
      tone: "info",
      label: "Quote asked for",
      line: `${asked.service.name}, asked ${shortDayOf(asked.createdAt)}`,
    };
  }
  return { tone: "neutral", label: "Nothing booked", line: null };
}
