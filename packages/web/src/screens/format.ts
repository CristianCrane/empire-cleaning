import type {
  AdjustmentKind,
  Condition,
  PropertyView,
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

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

// "Apartment · 2 bedrooms · 1.5 bathrooms"
export const homeSummary = (
  p: Pick<PropertyView, "type" | "bedrooms" | "bathrooms">,
) =>
  [
    p.type[0]!.toUpperCase() + p.type.slice(1),
    p.bedrooms === 0 ? "Studio" : plural(p.bedrooms, "bedroom"),
    plural(p.bathrooms, "bathroom"),
  ].join(" · ");

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
