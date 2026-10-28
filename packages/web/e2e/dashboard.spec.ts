import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  expect,
  requestQuoteAsGuest,
  setUsualWeek,
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

test("Office Staff see today's Jobs and whether they're assigned", async ({
  page,
}) => {
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  await bookJob({
    startsAt: "2026-01-05T14:00:00Z", // 9am in New York
    labourHours: 5,
    crewSize: 2,
    service: "standard",
  });
  // tomorrow's isn't today's
  await bookJob({ startsAt: "2026-01-06T14:00:00Z", labourHours: 3 });
  await signInAsOffice(page);

  const today = page.getByRole("region", { name: "Today's Schedule" });
  // the day's header says how full it is
  await expect(today.getByRole("region", { name: "Mon, Jan 5" })).toContainText(
    "5 h booked · 3 h free",
  );
  // one day of the Schedule's calendar, locked to today
  const jobs = today.getByRole("group", { name: "Jobs on Mon, Jan 5" });
  await expect(jobs.getByRole("link")).toHaveCount(1);
  await expect(jobs).toContainText("9:00 AM Client");
  await expect(jobs).toContainText("Unassigned");
  await expect(today.getByRole("group", { name: /Jobs on/ })).toHaveCount(1);

  await jobs.getByRole("link").click();
  await expect(page).toHaveURL(/\/office\/jobs\/[0-9a-f-]{36}$/);
  await page.goBack();
  await today.getByRole("link", { name: "Week" }).click();
  await expect(page).toHaveURL(/\/office\/schedule/);
});

test("a quiet day says so", async ({ page }) => {
  await signInAsOffice(page);

  await expect(
    page.getByText("Nothing needs attention right now."),
  ).toBeVisible();
  await expect(page.getByText("No Jobs today.")).toBeVisible();
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
    page.getByRole("group", { name: "Jobs on Mon, Jan 5" }),
  ).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
