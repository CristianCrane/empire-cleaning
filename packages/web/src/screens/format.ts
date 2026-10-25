import type { Condition, PropertyView } from "@empire-cleaning/models";

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
