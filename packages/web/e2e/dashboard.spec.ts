import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  expect,
  expectAccessible,
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

    const needsAttention = page.getByRole("grid", { name: "Needs attention" });
    const request = needsAttention.getByRole("row", { name: /Casey Client/ });
    await expect(request).toContainText("41-12 Austin St, 4B, 11375");
    await expect(request).toContainText("Send a Quote");

    await request.click();
    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  },
);

test("a Quote asked for while the Dashboard is open shows within a minute", async ({
  page,
}) => {
  await page.clock.install();
  await signInAsOffice(page);
  const needsAttention = page.getByRole("grid", { name: "Needs attention" });
  const request = needsAttention.getByRole("row", { name: /Casey Client/ });
  await expect(
    page.getByRole("heading", { level: 1, name: "Today" }),
  ).toBeVisible();

  await requestQuoteAsGuest({
    name: "Casey Client",
    email: "casey@example.com",
  });
  await page.clock.runFor(59_000);
  await expect(request).toHaveCount(0);
  await page.clock.runFor(1_000);

  await expect(request).toContainText("Send a Quote");
});

// a long list reads as a few numbers first: a tile per part of the work,
// pressed to show only that part
test("Office Staff see what's waiting counted by kind, and pick one to see only those", async ({
  page,
}) => {
  await requestQuoteAsGuest({
    name: "Casey Client",
    email: "casey@example.com",
  });
  // today, with nobody on it yet
  await bookJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 5 });
  await signInAsOffice(page);

  const kinds = page.getByRole("radiogroup", {
    name: "Needs attention by kind",
  });
  const jobs = kinds.getByRole("radio", { name: /Jobs/ });
  await expect(jobs).toHaveText(/Jobs\s*1\s*1 need cleaners/);
  await expect(kinds.getByRole("radio", { name: /Quotes/ })).toHaveText(
    /Quotes\s*1\s*1 asked for/,
  );
  // nothing owed: nothing to pick
  await expect(kinds.getByRole("radio", { name: /Money/ })).toBeDisabled();

  const needsAttention = page.getByRole("grid", { name: "Needs attention" });
  await expect(needsAttention.getByRole("row")).toHaveCount(2);
  await jobs.click();
  await expect(jobs).toBeChecked();
  await expect(needsAttention.getByRole("row")).toHaveCount(1);
  await expect(needsAttention).toContainText("Find cleaners");

  await page.getByRole("button", { name: "Show all 2" }).click();
  await expect(jobs).not.toBeChecked();
  await expect(needsAttention.getByRole("row")).toHaveCount(2);
});

test("a quiet day says so", async ({ page }) => {
  await signInAsOffice(page);

  await expect(
    page.getByText(
      "Nothing needs you right now. When a Client asks for a Quote or a new time, or a Job needs a Cleaner, it shows up here.",
    ),
  ).toBeVisible();
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
  await expect(
    page.getByRole("grid", { name: "Needs attention" }).getByRole("row"),
  ).toHaveCount(2);

  await expectAccessible(page);
});
