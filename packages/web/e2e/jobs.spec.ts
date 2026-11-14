import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  expect,
  expectCurrentSection,
  goTo,
  listRows,
  searchList,
  signedInAs,
  test,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};

const rows = (page: Page) => listRows(page, "Jobs");

test(
  "Office Staff find a Job on the Jobs page, and Back keeps the Tab",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    // the API's clock is at 4am on Monday 5 January 2026 in New York
    await bookJob({ startsAt: "2026-01-12T14:00:00Z", labourHours: 2 });
    await bookJob({ startsAt: "2026-01-08T14:00:00Z", labourHours: 2 });
    await createStaff(olive);
    await signedInAs(page, olive.email);

    await goTo(page, "Jobs");
    await expect(page).toHaveURL("/office/jobs");

    // Upcoming, soonest first, by month; no All Tab
    await expect(page.getByRole("tab", { name: /Upcoming/ })).toContainText(
      "2",
    );
    await expect(page.getByRole("tab")).toHaveCount(3);
    await expect(
      page.getByRole("heading", { level: 2, name: "January 2026" }),
    ).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toContainText("Jan 8");
    await expect(rows(page).first()).toContainText("9:00 AM");

    await page.getByRole("tab", { name: /Past/ }).click();
    await expect(page.getByText("No jobs done yet.")).toBeVisible();
    await page.getByRole("tab", { name: /Upcoming/ }).click();

    await rows(page).first().click();
    await expect(page).toHaveURL(/\/office\/jobs\/[0-9a-f-]{36}$/);
    // a Job belongs to Jobs, whichever way it's reached
    const crumbs = page.getByLabel("Breadcrumbs");
    // the trail ends at the Job, by its title
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /^Deep Clean at /,
    );
    await expect(crumbs.locator("[aria-current=page]")).toHaveText(
      /^Deep Clean at /,
    );
    await expectCurrentSection(page, "Jobs");

    await crumbs.getByRole("link", { name: "Jobs" }).click();
    await expect(page).toHaveURL("/office/jobs");
    await expect(rows(page)).toHaveCount(2);
  },
);

test("Office Staff search Jobs by the address", async ({ page }) => {
  const job = (await bookJob({
    startsAt: "2026-01-12T14:00:00Z",
    labourHours: 2,
  })) as { id: string };
  await bookJob({ startsAt: "2026-01-08T14:00:00Z", labourHours: 2 });
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto(`/office/jobs/${job.id}`);
  // the street is the Job's title
  // (as written: the heading is shown in capitals)
  const street = (await page.getByRole("heading", { level: 1 }).textContent())!
    .split(" at ")[1]!
    .split(",")[0]!;

  await page.goto("/office/jobs");
  await searchList(page, "Search jobs", street);
  // the Tabs step aside: a search looks through every one
  await expect(page.getByText("1 found in every tab")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Jan 12");

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("tab", { name: /Upcoming/ })).toBeVisible();
  await expect(rows(page)).toHaveCount(2);
});
