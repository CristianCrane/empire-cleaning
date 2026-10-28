import { expect, test } from "./harness.ts";

const banner = "Test site: no real payments or cleans";

test("the test site says so across the top of every page", async ({ page }) => {
  // the e2e server is dev; stand in for the test site's answer
  await page.route("**/api/site", (route) =>
    route.fulfill({ json: { mode: "test" } }),
  );

  await page.goto("/sign-in");
  await expect(page.getByText(banner)).toBeVisible();

  await page.goto("/no-such-page");
  await expect(page.getByText(banner)).toBeVisible();
});

test("no other site shows the banner", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByText(banner)).toHaveCount(0);
});
