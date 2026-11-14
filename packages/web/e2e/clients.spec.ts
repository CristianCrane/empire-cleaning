import type { Page } from "@playwright/test";
import {
  createClient,
  createStaff,
  expect,
  requestQuoteAsGuest,
  signedInAs,
  test,
  expectCurrentSection,
  goTo,
  listRows,
  searchList,
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
  await goTo(page, "Clients");
  await expect(page).toHaveURL("/office/clients");
};

const rows = (page: Page) => listRows(page, "Clients");

test(
  "Office Staff find a Client by searching, and Back keeps the search",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await twoClients();
    await openClients(page);

    // a search looks through every Client, whatever their standing, and
    // says each one's
    const search = page.getByRole("searchbox", { name: "Search clients" });
    await searchList(page, "Search clients", "austin");
    await expect(page).toHaveURL("/office/clients?q=austin");
    await expect(page.getByText("1 found in every tab")).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Quoting");
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
  const search = page.getByRole("searchbox", { name: "Search clients" });

  await searchList(page, "Search clients", "718555");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Sam Seed");

  await search.fill("(646) 555");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Casey Client");

  await search.fill("nobody");
  await expect(page.getByText("Nothing matches “nobody”")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("tab", { name: /Active/ })).toBeVisible();

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
    const crumbs = page.getByLabel("Breadcrumbs");

    await page.getByRole("tab", { name: /Quoting/ }).click();
    await rows(page).first().click();
    await page.getByRole("row", { name: /41-12 Austin St/ }).click();
    await expect(page).toHaveURL(/\/office\/properties\//);
    await expectCurrentSection(page, "Clients");

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
  await expect(page.getByText("No active clients.")).toBeVisible();
  await expect(tab(/Quoting/)).toContainText("1");
  await expect(tab(/Past/)).toContainText("1");
  // no All: a search looks through every Tab
  await expect(page.getByRole("tab")).toHaveCount(3);

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
  await page.getByRole("button", { name: "Show more (3 left)" }).click();

  await expect(rows(page)).toHaveCount(53);
  await expect(page.getByRole("button", { name: /Show more/ })).toHaveCount(0);
});
