import type {
  AdjustmentKind,
  ClientName,
  Condition,
  PropertyView,
  QuoteSummary,
  Recurrence,
  Weekday,
} from "@empire-cleaning/models";

export const addressOf = (
  p: Pick<PropertyView, "street" | "unit" | "postcode">,
) => [p.street, p.unit, p.postcode].filter(Boolean).join(", ");

const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
export const formatDate = (iso: string) => date.format(new Date(iso));

export const conditionLabel: Record<Condition, string> = {
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy",
};

// business premises have none until a Site Visit records it
export const conditionText = (condition: Condition | null) =>
  condition ? conditionLabel[condition] : "Not recorded yet";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

const sqFt = new Intl.NumberFormat("en-US");
// 4500 -> "4,500 sq ft"
export const formatFloorArea = (area: number) => `${sqFt.format(area)} sq ft`;

// what a Property is: "Apartment · 2 bedrooms · 1.5 bathrooms", or
// "Office · 4,500 sq ft" for business premises
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
        p.bedrooms === 0 ? "Studio" : plural(p.bedrooms, "bedroom"),
        plural(p.bathrooms, "bathroom"),
      ].join(" · ");

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

export const weekdayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// [0, 2, 4] -> "Monday, Wednesday and Friday"
export const weekdaysText = (days: Weekday[]) => {
  const names = days.map((d) => weekdayNames[d]);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
    : (names[0] ?? "");
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
// cents to "$391.04"
export const formatMoney = (cents: number) => money.format(cents / 100);

// 3.75 -> "3.75 h", 4 -> "4 h"
export const formatHours = (hours: number) => `${hours} h`;

export const cleanTypeLabel = {
  standard: "Standard Clean",
  deep: "Deep Clean",
};

export const roleLabel = {
  cleaner: "Cleaner",
  office_staff: "Office Staff",
};

// Empire Cleaning's days and times are New York's, wherever the viewer is
const BUSINESS_TIME_ZONE = "America/New_York";

const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
// "2026-01-05" -> "Mon, Jan 5"
export const formatDay = (day: string) =>
  dayFormat.format(new Date(`${day}T00:00:00Z`));

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: BUSINESS_TIME_ZONE,
});
// an instant -> "9:00 AM" in New York
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

const dayParts = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BUSINESS_TIME_ZONE,
});
// today in New York: "2026-01-05"
export const today = () => dayParts.format(new Date());

export const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

// the Monday of the week a day is in
export const mondayOf = (day: string) =>
  addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: BUSINESS_TIME_ZONE,
});
// an instant -> "Mon, Jan 12, 9:00 AM" in New York
export const formatDateTime = (iso: string) =>
  dateTimeFormat.format(new Date(iso));

export const quoteStatusLabel = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  superseded: "Superseded",
};

export const quoteStatusTone = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  declined: "neutral",
  expired: "warning",
  superseded: "neutral",
} as const;

// for NumberField's formatOptions on prices
export const dollars = { style: "currency", currency: "USD" } as const;

// what was reported: "Inside the oven, not done", "1.5 extra hours"
export const adjustmentLabel = (a: {
  kind: AdjustmentKind;
  addOnName: string | null;
  hours: number | null;
}) =>
  a.kind === "extra_time"
    ? `${a.hours} extra ${a.hours === 1 ? "hour" : "hours"}`
    : `${a.addOnName}, ${a.kind === "add_on_done" ? "done on the day" : "not done"}`;

const clockParts = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: BUSINESS_TIME_ZONE,
});
// an instant -> its New York wall-clock time, "09:00"
export const timeOfDay = (iso: string) => clockParts.format(new Date(iso));

// an instant -> the New York day it falls on, "2026-01-12"
export const dayOfInstant = (iso: string) => dayParts.format(new Date(iso));

// "09:00" -> "9:00 AM"
export const formatClock = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours! % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours! < 12 ? "AM" : "PM"}`;
};

export const recurrenceLabel: Record<Recurrence, string> = {
  weekly: "Every week",
  fortnightly: "Every 2 weeks",
  four_weekly: "Every 4 weeks",
};

// how many weeks apart a Service Plan's cleans are
export const recurrenceWeeks: Record<Recurrence, number> = {
  weekly: 1,
  fortnightly: 2,
  four_weekly: 4,
};

const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "UTC",
});
// "2026-01-05" -> "Monday"
export const weekdayOf = (day: string) =>
  weekdayFormat.format(new Date(`${day}T00:00:00Z`));

// how a Quote reads in a list: "Deep Clean $391.04", or "Service Plan,
// Standard Clean every 2 weeks: $201.85 a clean"
export const quoteHeadline = (
  quote: Pick<QuoteSummary, "headlineTotalCents" | "plan">,
) =>
  quote.plan
    ? `Service Plan, ${cleanTypeLabel[quote.plan.cleanType]} ${recurrenceLabel[quote.plan.recurrence].toLowerCase()}: ${formatMoney(quote.headlineTotalCents)} a clean`
    : `Deep Clean ${formatMoney(quote.headlineTotalCents)}`;

// when a Service Plan's cleans come round, from its first: "Every week, on
// Mondays at 9:00 AM"
export const planRhythm = (plan: {
  recurrence: Recurrence;
  firstStartsAt: string;
}) =>
  `${recurrenceLabel[plan.recurrence]}, on ${weekdayOf(dayOfInstant(plan.firstStartsAt))}s at ${formatClock(timeOfDay(plan.firstStartsAt))}`;
