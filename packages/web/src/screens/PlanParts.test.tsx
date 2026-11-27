import type { PlanDayView, ServicePlanView } from "@empire-cleaning/models";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { cleansSayingLength, PlanCard } from "./PlanParts.tsx";

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
      city: "Forest Hills",
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
    "On site Mondays and Fridays, with 2\u00a0cleaners",
    "On site Wednesdays, with 1\u00a0cleaner",
  ]);
  expect(await howLong([monday, wednesday, friday], true)).toEqual([
    "How long on Mondays and Fridays",
    "How long on Wednesdays",
  ]);
  // every clean alike: one fact, no days, as a one-weekday plan's
  expect(await howLong([monday, friday], false)).toEqual([
    "On site, with 2\u00a0cleaners",
  ]);
  expect(await howLong([monday, friday], true)).toEqual(["How long"]);
});

test("a Client's list says a clean's length only once one isn't its weekday's on the card", () => {
  const dates = (cleans: Set<PlanDayView>) =>
    [...cleans].map((clean) => clean.startsAt.slice(0, 10));
  // Mondays 1 h 37 min, Wednesdays 3¾ h: the card names each weekday's
  const days = [day("2026-01-19", 1.625, 2), day("2026-01-21", 3.75, 1)];
  const asUsual = [day("2026-01-26", 1.625, 2), day("2026-01-28", 3.75, 1)];
  expect(dates(cleansSayingLength(days, asUsual))).toEqual([]);
  // a few minutes longer reads the same to the quarter hour
  const longer = day("2026-02-04", 3.8, 1);
  expect(dates(cleansSayingLength(days, [...asUsual, longer]))).toEqual([]);
  // a Monday booked as long as a Wednesday, and a clean moved to a
  // Thursday: only those, as rows of other weekdays would hide them
  const monday = day("2026-02-02", 3.75, 1);
  const thursday = day("2026-01-29", 1.625, 2);
  expect(
    dates(cleansSayingLength(days, [...asUsual, monday, thursday])),
  ).toEqual(["2026-02-02", "2026-01-29"]);
  // on a plan of one length, every row, among neighbours alike, and a
  // clean moved to a Thursday runs as the card says
  const mondays = [days[0]!];
  expect(dates(cleansSayingLength(mondays, [asUsual[0]!, thursday]))).toEqual(
    [],
  );
  expect(dates(cleansSayingLength(mondays, [asUsual[0]!, monday]))).toEqual([
    "2026-01-26",
    "2026-02-02",
  ]);
});

test("a Client reads weekdays alike that the Office tells apart to the minute", async () => {
  // 1 h 57 min and 2 h 3 min are both about 2 h to the quarter hour
  const days = [day("2026-01-19", 1.95, 2), day("2026-01-21", 2.05, 2)];
  expect(await howLong(days, true)).toEqual(["How long"]);
  expect(await howLong(days, false)).toHaveLength(2);
  // 3¾ h exactly and 3 h 48 min: one fact, about 3¾ h
  const near = [day("2026-01-19", 3.75, 1), day("2026-01-21", 3.8, 1)];
  const card = await render(
    <PlanCard plan={plan(near)} forClient label="Cleaning plan" />,
  );
  await expect.element(card.getByText("About 3¾ h")).toBeVisible();
  expect(await howLong(near, true)).toEqual(["How long"]);
});
