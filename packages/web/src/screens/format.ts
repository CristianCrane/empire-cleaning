import type {
  AssignmentState,
  AssignmentStatus,
  ClientName,
  Condition,
  HomeRooms,
  JobStatus,
  PlanDaySummary,
  PropertyView,
  QuoteKind,
  QuoteSummary,
  QuoteStatus,
  Recurrence,
  ServicePlanStatus,
  Weekday,
} from "@empire-cleaning/models";
import type { Time } from "@internationalized/date";
import {
  addDays,
  clockTime,
  dayOf,
  formats,
  messages,
  timeOf,
} from "@empire-cleaning/models";
import type { StatusTone } from "@empire-cleaning/ui";

// the screens' own words for things are English until each screen has its
// reader's language (#303–#305)
const {
  formatClock,
  formatList,
  formatMoney,
  formatNumber,
  plural,
  weekdayName,
} = formats.en;
const { planDaysWhen, recurrence } = messages.en;

export const addressOf = (
  p: Pick<PropertyView, "street" | "unit" | "postcode">,
) => [p.street, p.unit, p.postcode].filter(Boolean).join(", ");

export const conditionLabel: Record<Condition, string> = {
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy",
};

// business premises have none until a Site Visit records it
export const conditionText = (condition: Condition | null) =>
  condition ? conditionLabel[condition] : "Not known yet";

// "2 bedrooms", "1 bathroom"
const count = (n: number, one: string) =>
  `${n} ${plural(n, { one, other: `${one}s` })}`;

// so many cleaners, e.g. "1 cleaner", "2 more cleaners", "3 free cleaners"
export const cleaners = (n: number, which?: "more" | "free") =>
  count(n, which ? `${which} cleaner` : "cleaner");

// a Job's crew, or that it has none yet
export const crewOf = (crew: { name: string }[]) =>
  crew.map((c) => c.name).join(", ") || "No cleaners yet";

// 4500 -> "4,500 sq ft"
export const formatFloorArea = (area: number) => `${formatNumber(area)} sq ft`;

// what a Property is: "Apartment · 2 bedrooms · 1.5 bathrooms" ("Apartment ·
// rooms not known yet" before they're given), or "Office · 4,500 sq ft" for
// business premises
export const propertySummary = (p: PropertyView) =>
  p.kind === "commercial"
    ? [
        p.premisesType.name,
        p.floorArea === null
          ? "floor area not known yet"
          : formatFloorArea(p.floorArea),
      ].join(" · ")
    : [
        p.type[0]!.toUpperCase() + p.type.slice(1),
        ...(p.bedrooms === null
          ? ["rooms not known yet"]
          : [
              p.bedrooms === 0 ? "Studio" : count(p.bedrooms, "bedroom"),
              count(p.bathrooms!, "bathroom"),
            ]),
      ].join(" · ");

// a home's rooms in full, as a Client gives them: "2 bedrooms, 1.5
// bathrooms, 1 storey, pets"
export const roomsText = (r: HomeRooms) =>
  [
    r.bedrooms === 0 ? "a studio" : count(r.bedrooms, "bedroom"),
    count(r.bathrooms, "bathroom"),
    count(r.storeys, "storey"),
    r.pets ? "pets" : "no pets",
  ].join(", ");

// a Client as the Office names them: "Acme Dental (Casey Client)" for a
// business, else just the person
export const clientName = (c: Pick<ClientName, "name" | "businessName">) =>
  c.businessName ? `${c.businessName} (${c.name})` : c.name;

// where there's room for only one name, such as the Schedule's blocks: a
// business's own
export const shortClientName = (c: Pick<ClientName, "name" | "businessName">) =>
  c.businessName ?? c.name;

// when a business wants cleaning: "Monday, Wednesday and Friday at 6:00 PM",
// or a one-off
export const wantedCleaning = (request: {
  weekdays: Weekday[];
  preferredTime: string | null;
}) =>
  request.weekdays.length > 0
    ? `${weekdaysText(request.weekdays)}${request.preferredTime ? ` at ${formatClock(request.preferredTime)}` : ""}`
    : "A one-off clean";

// [0, 2, 4] -> "Monday, Wednesday and Friday"; 2026-01-05 is a Monday
const weekdaysText = (days: Weekday[]) =>
  formatList(days.map((d) => weekdayName(addDays("2026-01-05", d))));

// 3.75 -> "3.75 h", 4 -> "4 h"
export const formatHours = (hours: number) => `${hours} h`;

export const roleLabel = {
  cleaner: "Cleaner",
  office_staff: "Office staff",
};

// Empire Cleaning's days and times are New York's, wherever the viewer is
// (BUSINESS_TIME_ZONE); the API sends instants as ISO strings

// today in New York: "2026-01-05"
export const today = () => dayOf(new Date());

// what kind of Quote it is, as a title says it
export const quoteKindName = (kind: QuoteKind | null) =>
  kind === "service_plan" ? "Cleaning plan quote" : "Quote";

export const quoteStatusLabel = {
  requested: "Requested",
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  turned_down: "Turned down",
};

// a Quote's state as its Client sees it: one being drafted is still asked for
export const clientQuoteStatus: Record<
  QuoteStatus,
  { tone: StatusTone; label: string }
> = {
  requested: { tone: "info", label: "Asked for" },
  draft: { tone: "info", label: "Asked for" },
  sent: { tone: "warning", label: "To answer" },
  accepted: { tone: "success", label: "Accepted" },
  declined: { tone: "neutral", label: "Declined" },
  expired: { tone: "neutral", label: "Expired" },
  turned_down: { tone: "neutral", label: "Turned down" },
};

// a Service Plan's state, as both sides see it; Ended is red, stopped for
// good
export const planStatus: Record<
  ServicePlanStatus,
  { tone: StatusTone; label: string }
> = {
  active: { tone: "success", label: "Active" },
  on_hold: { tone: "warning", label: "Paused" },
  ended: { tone: "danger", label: "Ended" },
};

export const quoteStatusTone = {
  requested: "warning",
  draft: "neutral",
  sent: "info",
  accepted: "info",
  declined: "neutral",
  expired: "warning",
  turned_down: "neutral",
} as const;

// for NumberField's formatOptions on prices
export const dollars = { style: "currency", currency: "USD" } as const;

// an instant -> its New York wall-clock time, "09:00"
export const timeOfDay = (iso: string) => timeOf(new Date(iso));

// a time field's value -> its start time, "09:30"; none while it's empty
export function timeOfField(time: Time): string;
export function timeOfField(time: Time | null | undefined): string | undefined;
export function timeOfField(time: Time | null | undefined) {
  return time ? clockTime(time.hour * 60 + time.minute) : undefined;
}

// an instant -> the New York day it falls on, "2026-01-12"
export const dayOfInstant = (iso: string) => dayOf(new Date(iso));

// words that start a sentence or a label: "the Deep Clean" -> "The Deep
// Clean"
export const upperFirst = (words: string) =>
  words.charAt(0).toUpperCase() + words.slice(1);

// how often a plan's cleans come round, as a label: "Every 2 weeks"
export const recurrenceLabel = Object.fromEntries(
  (Object.entries(recurrence) as [Recurrence, string][]).map(([r, words]) => [
    r,
    upperFirst(words),
  ]),
) as Record<Recurrence, string>;

// a Service Plan, or a Service Plan Quote, with its weekdays
type PlanDays = { recurrence: Recurrence; days: PlanDaySummary[] };

// "Monday", or a Draft's weekday that has no time yet
const weekdayOfStart = (startsAt: string | null) =>
  startsAt ? weekdayName(dayOfInstant(startsAt)) : null;

// what a Service Plan is, in a line: "Standard Clean, every 2 weeks", or
// "Standard Clean and Deep Clean, every week on Mon, Wed and Fri"
export const planName = ({ recurrence: plan, days }: PlanDays) => {
  const what = formatList([...new Set(days.map((d) => d.serviceName))]);
  const on = days.flatMap((d) => weekdayOfStart(d.startsAt)?.slice(0, 3) ?? []);
  return days.length === 1
    ? `${what}, ${recurrence[plan]}`
    : `${what}, every week${on.length > 0 ? ` on ${formatList(on)}` : ""}`;
};

// how a Quote reads in a list: "Deep Clean $391.04", the Service it leads
// with, or "Cleaning plan,
// Standard Clean, every 2 weeks: $201.85 a clean", or for several weekdays
// "...: $650.10 a week"
export const quoteHeadline = (
  quote: Pick<
    QuoteSummary,
    "headlineTotalCents" | "headlineServiceName" | "plan"
  >,
) =>
  quote.headlineTotalCents === null
    ? "Not priced yet"
    : quote.plan
      ? `Cleaning plan, ${planName(quote.plan)}: ${formatMoney(quote.headlineTotalCents)} ${quote.plan.days.length === 1 ? "a clean" : "a week"}`
      : `${quote.headlineServiceName} ${formatMoney(quote.headlineTotalCents)}`;

// when a Service Plan's cleans come round, each weekday from its first:
// "Every week, on Mondays at 9:00 AM", or "Every week, on Mondays at 9:00 AM
// and Wednesdays at 1:00 PM"
export const planRhythm = ({ recurrence: plan, days }: PlanDays) =>
  `${recurrenceLabel[plan]}, on ${planDaysWhen(
    days.flatMap((d) => d.startsAt ?? []),
  )}`;

// a Site Visit's length: 30 -> "30 min", 90 -> "1 h 30 min"
export const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours > 0 && `${hours} h`, rest > 0 && `${rest} min`]
    .filter(Boolean)
    .join(" ");
};

export const siteVisitStatusLabel = {
  booked: "Booked",
  done: "Done",
  cancelled: "Cancelled",
} as const;

// A Job's status in the tones every status takes: booked is just so, done
// went well, cancelled is over, No Access went wrong (JobStatusBadge)
export const jobStatusLabel: Record<JobStatus, string> = {
  booked: "Booked",
  completed: "Done",
  cancelled: "Cancelled",
  no_access: "Couldn't get in",
};

// a plan Job its Client cancelled on its own is skipped: the plan carries
// on. One cancelled as the plan ended or changed isn't
export const wasSkipped = (job: {
  servicePlanId: string | null;
  cancellation: { by: string; withPlan: boolean } | null;
}) =>
  job.servicePlanId !== null &&
  job.cancellation?.by === "client" &&
  !job.cancellation.withPlan;
export const cancelledLabel = (skipped: boolean) =>
  skipped ? "Skipped" : "Cancelled";

export const jobStatusTone = {
  booked: "info",
  completed: "success",
  cancelled: "neutral",
  no_access: "danger",
} as const satisfies Record<JobStatus, string>;

// whether a booked Job's crew is whole, as the Office sees it (JobBadge)
export const crewLabel: Record<AssignmentStatus, string> = {
  assigned: "Staffed",
  unassigned: "Needs cleaners",
};

export const crewTone = {
  assigned: "info",
  unassigned: "warning",
} as const satisfies Record<AssignmentStatus, string>;

// how a Job reads for Office Staff: how it went, or while it's booked,
// whether its crew is whole (JobBadge, the Schedule's blocks)
export const jobLabelOf = (job: {
  status: JobStatus;
  assignment: AssignmentStatus;
}) =>
  job.status === "booked"
    ? { label: crewLabel[job.assignment], tone: crewTone[job.assignment] }
    : { label: jobStatusLabel[job.status], tone: jobStatusTone[job.status] };

// where someone stands on a Job's crew
export const assignmentStateLabel: Record<AssignmentState, string> = {
  offered: "Offered",
  confirmed: "Confirmed",
  released: "Dropped out",
  taken_off: "Taken off",
};

export const assignmentStateTone = {
  offered: "warning",
  confirmed: "success",
  released: "neutral",
  taken_off: "neutral",
} as const satisfies Record<AssignmentState, string>;
