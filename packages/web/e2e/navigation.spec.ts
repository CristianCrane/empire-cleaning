import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  expect,
  expectCurrentSection,
  openTile,
  signedInAs,
  test,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const logo = { name: "Empire Cleaning & Pro Services" };

// the Office has more sections than a phone's tab bar holds: Today and the
// Schedule are its shortcuts, and the ☰ menu, with the logo, lists every
// section (#200, #305)
test("on a phone the Office keeps Today and the Schedule in the tab bar, and every section in the menu", async ({
  page,
}) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");

  const bar = page.getByRole("navigation", { name: "Office" });
  await expect(bar.getByRole("link")).toHaveText(["Today", "Schedule"]);
  await expect(bar.getByRole("link", { name: "Today" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // the logo heads the menu, not Today
  await expect(page.getByRole("img", logo)).toBeHidden();

  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("img", logo)).toBeVisible();
  await expect(menu.getByRole("link")).toHaveText([
    "Today",
    "Schedule",
    "Jobs",
    "Quotes",
    "Clients",
    "Staff",
    "Services",
    "Prices",
  ]);
  // related sections under one heading
  await expect(
    menu.getByRole("group", { name: "Work" }).getByRole("link"),
  ).toHaveText(["Jobs", "Quotes"]);
  await expect(
    menu.getByRole("group", { name: "People" }).getByRole("link"),
  ).toHaveText(["Clients", "Staff"]);
  await expect(
    menu.getByRole("group", { name: "Pricing" }).getByRole("link"),
  ).toHaveText(["Services", "Prices"]);

  // a section goes there and closes the menu; the top bar names it
  await menu.getByRole("link", { name: "Clients" }).click();
  await expect(page).toHaveURL("/office/clients");
  await expect(menu).toBeHidden();
  await expect(page.getByRole("banner")).toContainText("Clients");
  await expect(bar.getByRole("link", { name: "Today" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByRole("button", { name: "Menu" }).click();
  await expect(menu.getByRole("link", { name: "Clients" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test(
  "on a larger screen the sidebar holds every section in groups, with the logo",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone has no sidebar");
    await createStaff(olive);
    await signedInAs(page, olive.email);
    await expect(page).toHaveURL("/office");

    const sidebar = page.getByRole("navigation", { name: "Office" });
    await expect(sidebar.getByRole("link")).toHaveText([
      "Today",
      "Schedule",
      "Jobs",
      "Quotes",
      "Clients",
      "Staff",
      "Services",
      "Prices",
    ]);
    // the busiest two first, then related sections under one heading
    await expect(sidebar.getByRole("group")).toHaveText([
      /^Work.*Jobs.*Quotes$/,
      /^People.*Clients.*Staff$/,
      /^Pricing.*Services.*Prices$/,
    ]);
    await expect(page.getByRole("img", logo)).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  },
);

// the API's answers to requests matching `url`, held until let go: a page
// not loaded before, whose data is on its way
const holdApi = async (page: Page, url: RegExp) => {
  let letGo = () => {};
  const held = new Promise<void>((resolve) => (letGo = resolve));
  await page.route(url, async (route) => {
    await held;
    await route.fallback();
  });
  return letGo;
};

const aJob = /\/api\/jobs\/[0-9a-f-]{36}$/;

// the old page stays until the next one shows, and so does its section in
// the navigation: never two current at once (#454)
test(
  "while the next page loads, the section on show stays the current one",
  { tag: "@desktop" },
  async ({ page }) => {
    // the API's fake clock is on Monday 5 January 2026: a Job today
    await bookJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 5 });
    await createStaff(olive);
    await signedInAs(page, olive.email);
    await expect(page).toHaveURL("/office");

    const letGo = await holdApi(page, aJob);
    await (await openTile(page, "Jobs")).getByRole("row").click();
    await expect(page).toHaveURL(/\/office\/jobs\//);
    await expectCurrentSection(page, "Jobs", false);
    await expectCurrentSection(page, "Today");

    letGo();
    await expectCurrentSection(page, "Jobs");
    await expectCurrentSection(page, "Today", false);
  },
);
