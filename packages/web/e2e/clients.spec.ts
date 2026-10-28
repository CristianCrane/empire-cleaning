import type { Page } from "@playwright/test";
import {
  createClient,
  createStaff,
  expect,
  requestQuoteAsGuest,
  signedInAs,
  test,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};

// Casey asked about 41-12 Austin St; Sam is a Client without a home yet
const twoClients = async () => {
  await requestQuoteAsGuest({
    name: "Casey Client",
    email: "casey@example.com",
  });
  await createClient({
    name: "Sam Seed",
    email: "sam@example.com",
    phone: "(718) 555-0199",
  });
};

const openClients = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page
    .getByRole("navigation", { name: "Office" })
    .getByRole("link", { name: "Clients" })
    .click();
  await expect(page).toHaveURL("/office/clients");
};

// the Table's Clients, without its header
const rows = (page: Page) =>
  page
    .getByRole("grid", { name: "Clients" })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader") });

test(
  "Office Staff find a Client by searching, and Back keeps the search",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await twoClients();
    await openClients(page);

    // ready to type straight away
    const search = page.getByRole("searchbox", { name: "Search Clients" });
    await expect(search).toBeFocused();

    // a search looks through every Client, whatever their standing
    await page.keyboard.type("austin");
    await expect(page).toHaveURL("/office/clients?q=austin");
    await expect(page.getByRole("tab", { name: /All/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(rows(page)).toHaveCount(1);
    // how to reach them, without opening them
    await expect(rows(page).first()).toContainText("casey@example.com");

    await rows(page).first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Casey Client" }),
    ).toBeVisible();

    await page.goBack();
    await expect(search).toHaveValue("austin");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Casey Client");
  },
);

test("a phone number is found however it's written", async ({ page }) => {
  await twoClients();
  await openClients(page);
  const search = page.getByRole("searchbox", { name: "Search Clients" });

  await search.fill("718555");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Sam Seed");

  await search.fill("(646) 555");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Casey Client");

  await search.fill("nobody");
  await expect(page.getByText("No Clients match “nobody”.")).toBeVisible();

  // a link straight to a search, e.g. one typed in the address bar
  await page.goto("/office/clients?q=718555");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Sam Seed");
});

test(
  "Client and Property pages sit under Clients",
  { tag: "@desktop" },
  async ({ page }) => {
    await twoClients();
    await openClients(page);
    const officeNav = page.getByRole("navigation", { name: "Office" });
    const crumbs = page.getByLabel("Breadcrumbs");

    await page.getByRole("tab", { name: /All/ }).click();
    await rows(page).first().click();
    await page.getByRole("row", { name: /41-12 Austin St/ }).click();
    await expect(page).toHaveURL(/\/office\/properties\//);
    await expect(
      officeNav.getByRole("link", { name: "Clients" }),
    ).toHaveAttribute("aria-current", "page");

    await crumbs.getByRole("link", { name: "Casey Client" }).click();
    await expect(page).toHaveURL(/\/office\/clients\/[0-9a-f-]{36}$/);
    await crumbs.getByRole("link", { name: "Clients" }).click();
    await expect(page).toHaveURL("/office/clients");
  },
);

test("Clients are listed by standing, Active first, with how many in each", async ({
  page,
}) => {
  // Casey is waiting on a Quote; Sam has nothing on
  await twoClients();
  await openClients(page);

  const tab = (name: RegExp) => page.getByRole("tab", { name });
  await expect(tab(/Active/)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("No Active Clients.")).toBeVisible();
  await expect(tab(/Quoting/)).toContainText("1");
  await expect(tab(/Past/)).toContainText("1");
  await expect(tab(/All/)).toContainText("2");

  await tab(/Quoting/).click();
  await expect(page).toHaveURL("/office/clients?tab=quoting");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Casey Client");

  await tab(/Past/).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Sam Seed");
});

test("a long list shows 50 at a time, with Show more", async ({ page }) => {
  for (let i = 0; i < 53; i += 1) {
    await createClient({
      name: `Client ${String(i).padStart(2, "0")}`,
      email: `client${i}@example.com`,
      phone: "(718) 555-0100",
    });
  }
  await openClients(page);
  await page.getByRole("tab", { name: /Past/ }).click();

  await expect(rows(page)).toHaveCount(50);
  await expect(page.getByText("Showing 50 of 53")).toBeVisible();
  await page.getByRole("button", { name: "Show more" }).click();

  await expect(rows(page)).toHaveCount(53);
  await expect(page.getByRole("button", { name: "Show more" })).toHaveCount(0);
});
