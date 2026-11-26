import type { PlanDayTerms, QuoteOption } from "@empire-cleaning/models";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { QuoteStatusBadge, planCards, planDayTitle } from "./QuoteParts.tsx";

// a plan weekday from 19 January 2026, New York time, and its clean
const clean = (date: string | null, totalCents: number, crewSize = 2) => ({
  day: {
    startsAt: date && `${date}T14:00:00.000Z`,
    serviceKey: "standard",
    serviceName: "Standard Clean",
    crewSize,
    oneOffPriceCents: 20000,
    oneOffTaxCents: 1775,
    oneOffTotalCents: 21775,
    discountCents: 2000,
    savingCents: 21775 - totalCents,
  } satisfies PlanDayTerms,
  option: {
    totalCents,
    taxCents: 1598,
    hoursOnSite: 2,
  } as QuoteOption,
});

const titles = (cleans: ReturnType<typeof clean>[]) =>
  planCards(
    cleans.map((c) => c.day),
    cleans.map((c) => c.option),
  ).map((card) =>
    planDayTitle(
      "en",
      card.map((c) => c.day),
    ),
  );

test("a plan's weekdays that cost the same share one card, naming each", () => {
  // the crew differs, but no figure on the card does
  expect(
    titles([clean("2026-01-19", 19775, 2), clean("2026-01-21", 19775, 1)]),
  ).toEqual([
    "Mondays at 9:00\u00a0AM and Wednesdays at 9:00\u00a0AM\u00a0·\u00a0Standard Clean",
  ]);
  // a price that differs is a card of its own
  expect(
    titles([
      clean("2026-01-19", 19775),
      clean("2026-01-21", 24000),
      clean("2026-01-23", 19775),
    ]),
  ).toEqual([
    "Mondays at 9:00\u00a0AM and Fridays at 9:00\u00a0AM\u00a0·\u00a0Standard Clean",
    "Wednesdays at 9:00\u00a0AM\u00a0·\u00a0Standard Clean",
  ]);
  // a Draft's weekday not yet timed: its Service alone
  expect(titles([clean(null, 19775)])).toEqual(["Standard Clean"]);
});

test("a Spanish card's weekdays start its title with a capital", () => {
  const [card] = planCards(
    [clean("2026-01-19", 19775).day],
    [clean("2026-01-19", 19775).option],
  );
  expect(
    planDayTitle(
      "es",
      card!.map((c) => c.day),
    ),
  ).toMatch(/^Los lunes a las 9:00/);
});

// the Office's badge says what the Client's does while their Deposit goes
// through (#534 Q7): a day filled stays Sent, as Today asks her to move it
test("a Sent Quote's badge is Payment pending while its Deposit goes through", async () => {
  const badge = async (wait: Parameters<typeof QuoteStatusBadge>[0]["wait"]) =>
    (await render(<QuoteStatusBadge status="sent" wait={wait} />)).container
      .textContent;
  expect(await badge("payment")).toBe("Payment pending");
  expect(await badge("booking")).toBe("Booking pending");
  expect(await badge("filled")).toBe("Sent");
  expect(await badge(null)).toBe("Sent");
});
