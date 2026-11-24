import type { PlanDayView, ServicePlanView } from "@empire-cleaning/models";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { cleansSayLength, PlanCard } from "./PlanParts.tsx";

// Mondays, Wednesdays and Fridays from 19 January 2026, New York time
const day = (date: string, hoursOnSite: number, crewSize: number) =>
  ({
    startsAt: `${date}T14:00:00.000Z`,
    serviceName: "Standard Clean",
    crewSize,
    labourHours: hoursOnSite * crewSize,
    hoursOnSite,
    priceCents: 10000,
    taxCents: 888,
    totalCents: 10888,
  }) satisfies PlanDayView;

const plan = (days: PlanDayView[]) =>
  ({
    id: "plan",
    status: "active",
    recurrence: "weekly",
    days,
    property: {
      id: "home",
      street: "41-12 Austin St",
      unit: "4B",
      postcode: "11375",
    },
    nextStartsAt: null,
    serviceKey: "standard",
    startedAt: "2026-01-12T16:00:00.000Z",
    discountPercent: 0,
    roundTotalCents: 10888 * days.length,
    addOns: [],
    depositCents: 0,
    quoteId: "quote",
    unpaid: [],
    unpaidBills: [],
  }) as unknown as Omit<ServicePlanView, "upcoming">;

// how long each kind of clean runs, as the card's facts say it
const howLong = async (days: PlanDayView[], forClient: boolean) => {
  const card = await render(
    <PlanCard plan={plan(days)} forClient={forClient} label="Cleaning plan" />,
  );
  return [...card.container.querySelectorAll("dd")]
    .map((dd) => dd.textContent)
    .filter((text) => /^(On site|How long)/.test(text ?? ""));
};

test("a plan's weekdays that read alike are one fact, named only beside another kind", async () => {
  const monday = day("2026-01-19", 1.625, 2);
  const wednesday = day("2026-01-21", 3.75, 1);
  const friday = day("2026-01-23", 1.625, 2);
  expect(await howLong([monday, wednesday, friday], false)).toEqual([
    "On site Mondays and Fridays, with 2 cleaners",
    "On site Wednesdays, with 1 cleaner",
  ]);
  expect(await howLong([monday, wednesday, friday], true)).toEqual([
    "How long on Mondays and Fridays",
    "How long on Wednesdays",
  ]);
  // every clean alike: one fact, no days, as a one-weekday plan's
  expect(await howLong([monday, friday], false)).toEqual([
    "On site, with 2 cleaners",
  ]);
  expect(await howLong([monday, friday], true)).toEqual(["How long"]);
});

test("a Client's cleans say their lengths once one isn't its weekday's on the card", () => {
  const t = { about: (hours: string) => `About ${hours}` };
  const days = [day("2026-01-19", 1.625, 2), day("2026-01-21", 3.75, 1)];
  // the next Monday and Wednesday, each as its weekday runs
  const asUsual = [day("2026-01-26", 1.625, 2), day("2026-01-28", 3.75, 1)];
  expect(cleansSayLength(t, days, asUsual)).toBe(false);
  // a Monday booked as long as a Wednesday, and a clean moved to a Thursday
  expect(
    cleansSayLength(t, days, [...asUsual, day("2026-02-02", 3.75, 1)]),
  ).toBe(true);
  expect(
    cleansSayLength(t, days, [...asUsual, day("2026-01-29", 1.625, 2)]),
  ).toBe(true);
});

test("a Client reads weekdays alike that the Office tells apart to the minute", async () => {
  // 1 h 57 min and 2 h 3 min are both about 2 h to the quarter hour
  const days = [day("2026-01-19", 1.95, 2), day("2026-01-21", 2.05, 2)];
  expect(await howLong(days, true)).toEqual(["How long"]);
  expect(await howLong(days, false)).toHaveLength(2);
});
