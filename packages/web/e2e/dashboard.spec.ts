import type { Page } from "@playwright/test";
import { MINUTE_MS } from "@empire-cleaning/models";
import {
  bookJob,
  createStaff,
  expect,
  expectAccessible,
  openTile,
  requestQuoteAsGuest,
  signedInAs,
  test,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};

const signInAsOffice = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");
};

// the API's fake clock is at 4am on Monday 5 January 2026 in New York

test(
  "Office Staff see Quotes asked for and open one",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await requestQuoteAsGuest({
      name: "Casey Client",
      email: "casey@example.com",
    });
    await signInAsOffice(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Hi, Olive" }),
    ).toBeVisible();
    // the one to-do is the card's, and Quotes counts it
    const first = page.getByRole("region", { name: "First up" });
    await expect(first).toContainText("Casey Client");
    await expect(first).toContainText("41-12 Austin St, 4B, 11375");
    await expect(page.getByRole("button", { name: /^Quotes/ })).toHaveText(
      /Quotes\s*1\s*1 asked for/,
    );

    await first.getByRole("button", { name: "Send a quote" }).click();
    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  },
);

test("a Quote asked for while the Dashboard is open shows within a minute", async ({
  page,
}) => {
  await signInAsOffice(page);
  await expect(page.getByText("Nothing needs you")).toBeVisible();

  await requestQuoteAsGuest({
    name: "Casey Client",
    email: "casey@example.com",
  });
  await page.clock.runFor(MINUTE_MS - 1_000);
  await expect(page.getByText("Nothing needs you")).toBeVisible();
  await page.clock.runFor(1_000);

  await expect(page.getByRole("region", { name: "First up" })).toContainText(
    "Send a quote",
  );
});

// a long list reads as a few numbers first: a tile per part of the work,
// each opening its rows in place, and the day's Jobs beside them
test("Office Staff see what's waiting counted by kind, and open one to see those", async ({
  page,
}) => {
  await requestQuoteAsGuest({
    name: "Casey Client",
    email: "casey@example.com",
  });
  // today, with nobody on it yet
  await bookJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 5 });
  await signInAsOffice(page);

  const today = page.getByRole("button", { name: /^On today/ });
  const jobs = page.getByRole("button", { name: /^Jobs/ });
  await expect(today).toHaveText(/On today\s*1\s*1 needs cleaners/);
  await expect(jobs).toHaveText(/Jobs\s*1\s*1 needs cleaners/);
  await expect(page.getByRole("button", { name: /^Quotes/ })).toHaveText(
    /Quotes\s*1\s*1 asked for/,
  );
  // nothing owed: nothing to open
  await expect(page.getByRole("button", { name: /^Money/ })).toBeDisabled();

  // no rows until a tile is pressed
  await expect(jobs).toHaveAttribute("aria-pressed", "false");
  const jobRows = await openTile(page, "Jobs");
  await expect(jobRows.getByRole("row")).toHaveCount(1);
  await expect(jobRows).toContainText("Find cleaners");
  await expect(page).toHaveURL("/office?open=jobs");

  // one open at a time: the day's Jobs, the Schedule's day under them
  const dayRows = await openTile(page, "On today");
  await expect(jobs).toHaveAttribute("aria-pressed", "false");
  await expect(dayRows.getByRole("row")).toHaveCount(1);
  await expect(dayRows).toContainText("Needs cleaners");
  await expect(
    page.getByRole("link", { name: "Open the Schedule" }),
  ).toHaveAttribute("href", "/office/schedule?from=2026-01-05&to=2026-01-05");

  // pressed again, closed
  await today.click();
  await expect(today).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL("/office");

  // Back from a row comes back to its tile, open
  await (await openTile(page, "Jobs")).getByRole("row").click();
  await expect(page).toHaveURL(/\/office\/jobs\//);
  await page.goBack();
  await expect(jobs).toHaveAttribute("aria-pressed", "true");
});

test("pressing a tile keeps the page where it was", async ({ page }) => {
  await requestQuoteAsGuest({
    name: "Casey Client",
    email: "casey@example.com",
  });
  await bookJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 5 });
  // a short screen, so the tiles sit below the top with the page scrolled
  await page.setViewportSize({ width: 390, height: 400 });
  await signInAsOffice(page);

  const quotes = page.getByRole("button", { name: /^Quotes/ });
  await quotes.evaluate((tile) => tile.scrollIntoView({ block: "start" }));
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);
  await quotes.click();
  await expect(quotes).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
});

test("a quiet day says so", async ({ page }) => {
  await signInAsOffice(page);

  await expect(page.getByText("Nothing needs you")).toBeVisible();
  await expect(page.getByRole("button", { name: /^On today/ })).toBeDisabled();
});

test("the dashboard passes automated accessibility checks", async ({
  page,
}) => {
  await requestQuoteAsGuest({
    name: "Casey Client",
    email: "casey@example.com",
  });
  await bookJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 5 });
  await signInAsOffice(page);
  await expect((await openTile(page, "Jobs")).getByRole("row")).toHaveCount(1);

  await expectAccessible(page);
});
