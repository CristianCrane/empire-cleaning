import type { Page } from "@playwright/test";
import { bookJob, createStaff, expect, signedInAs, test } from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};

// the Table's Jobs, without its header
const rows = (page: Page) =>
  page
    .getByRole("grid", { name: "Jobs" })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader") });

test(
  "Office Staff find a Job on the Jobs page, and Back keeps the Tab",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    // the API's clock is at 4am on Monday 5 January 2026 in New York
    await bookJob({ startsAt: "2026-01-12T14:00:00Z", labourHours: 2 });
    await bookJob({ startsAt: "2026-01-08T14:00:00Z", labourHours: 2 });
    await createStaff(olive);
    await signedInAs(page, olive.email);

    const nav = page.getByRole("navigation", { name: "Office" });
    await nav.getByRole("link", { name: "Jobs" }).click();
    await expect(page).toHaveURL("/office/jobs");

    // Upcoming, soonest first
    await expect(page.getByRole("tab", { name: /Upcoming/ })).toContainText(
      "2",
    );
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toContainText("Thu, Jan 8, 9:00 AM");

    await page.getByRole("tab", { name: /Past/ }).click();
    await expect(page.getByText("No Jobs done yet.")).toBeVisible();
    await page.getByRole("tab", { name: /Upcoming/ }).click();

    await rows(page).first().click();
    await expect(page).toHaveURL(/\/office\/jobs\/[0-9a-f-]{36}$/);
    // a Job belongs to Jobs, whichever way it's reached
    const crumbs = page.getByLabel("Breadcrumbs");
    await expect(crumbs.getByText("Job", { exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "aria-current",
      "page",
    );

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
  await page.getByRole("searchbox", { name: "Search Jobs" }).fill(street);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Mon, Jan 12, 9:00 AM");
  await expect(page.getByRole("tab", { name: /All/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
