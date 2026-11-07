import {
  signedInAs,
  createClient,
  createStaff,
  expect,
  returnToTab,
  test,
  goTo,
  switchArea,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};

// the app asks who you are when you sign in, open the Account menu (where an
// area is chosen) or come back to the tab, not on every click; these are the
// times it can have changed behind its back (another tab, the landing page,
// the Office adding a record)

test("coming back to the tab notices a Client record connected meanwhile", async ({
  page,
}) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");

  // e.g. Olive asks for a Quote from the landing page, in another tab
  await createClient({ email: olive.email, name: "Olive Owner" });
  await returnToTab(page);

  await page.getByRole("button", { name: olive.name }).click();
  await switchArea(page, "Client portal");
  await expect(page).toHaveURL("/portal");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Olive");
});

test("switching areas notices a Client record connected meanwhile", async ({
  page,
}) => {
  await createStaff({ ...olive, roles: ["office_staff", "cleaner"] });
  await signedInAs(page, olive.email);
  // the app has asked who this is, and been told: Staff, nothing more
  await expect(page).toHaveURL("/office");
  await createClient({ email: olive.email, name: "Olive Owner" });

  // the menu still offers only what it knew; opening it looks again, so the
  // area it switches to knows
  await page.getByRole("button", { name: olive.name }).click();
  await switchArea(page, "Cleaner area");
  await expect(page).toHaveURL("/cleaner");

  await page.getByRole("button", { name: olive.name }).click();
  await expect(
    page.getByRole("row", { name: "Switch to Client portal" }),
  ).toBeVisible();
});

test("switching area once the menu has been open a moment shows it at once", async ({
  page,
}) => {
  await createStaff(olive);
  await createClient({ email: olive.email, name: olive.name });
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");

  // opening the menu loads the portal, its Home included
  const homeLoaded = page.waitForResponse("**/api/clients/me");
  await page.getByRole("button", { name: olive.name }).click();
  await homeLoaded;

  // from here the API answers nothing, so whatever shows came before the press
  await page.route("**/api/**", () => {});
  await switchArea(page, "Client portal");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Olive");
});

test("a press before the area is ready waits in the menu, then the area shows", async ({
  page,
}) => {
  await createStaff(olive);
  await createClient({ email: olive.email, name: olive.name });
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");

  // who's signed in answers only when let go
  let letGo = () => {};
  const held = new Promise<void>((resolve) => (letGo = resolve));
  await page.route("**/api/me", async (route) => {
    await held;
    await route.fallback();
  });

  // pressed by hand, not with switchArea, to look at the menu while it waits
  await page.getByRole("button", { name: olive.name }).click();
  const portal = page.getByRole("row", { name: "Switch to Client portal" });
  await portal.click();
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(portal).toHaveAttribute("data-pending", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Close" })).toBeDisabled();
  await expect(menu.getByRole("button", { name: "Sign out" })).toBeDisabled();
  await expect(
    page.getByRole("navigation", { name: "Office" }).first(),
  ).toBeVisible();

  letGo();
  await expect(
    page.getByRole("navigation", { name: "Client portal" }).first(),
  ).toBeVisible();
  await expect(menu).toBeHidden();
});

test("signing out in another tab signs this one out when you return", async ({
  context,
  page,
}) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");

  const other = await context.newPage();
  await other.goto("/office");
  await other.getByRole("button", { name: olive.name }).click();
  await other.getByRole("button", { name: "Sign out" }).click();
  await expect(other).toHaveURL(/\/sign-in/);

  await returnToTab(page);

  await expect(page).toHaveURL(/\/sign-in/);
});

test("moving between pages in an area doesn't ask who you are each time", async ({
  page,
}) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");
  const asked: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/me")
      asked.push(request.url());
  });
  await goTo(page, "Quotes");
  await expect(page).toHaveURL("/office/quotes");
  await goTo(page, "Today");
  await expect(page).toHaveURL("/office");
  await goTo(page, "Quotes");
  await expect(page).toHaveURL("/office/quotes");

  expect(asked).toEqual([]);
});

test("Show tips again is in every area's menu, and brings back every tour", async ({
  page,
}) => {
  await createStaff({ ...olive, roles: ["office_staff", "cleaner"] });
  await createClient({ email: olive.email, name: olive.name });
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");
  // first-time help's tours, seen on another device
  for (const tour of ["office-today", "portal-home"])
    expect((await page.request.put(`/api/me/tours/${tour}`)).status()).toBe(
      204,
    );

  for (const area of ["Cleaner area", "Client portal"]) {
    await page.getByRole("button", { name: olive.name }).click();
    await expect(
      page.getByRole("button", { name: "Show tips again" }),
    ).toBeVisible();
    await switchArea(page, area);
  }
  await expect(page).toHaveURL("/portal");
  await page.getByRole("button", { name: olive.name }).click();
  await page.getByRole("button", { name: "Show tips again" }).click();

  await expect(page.getByText("Tips will show again")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Account" })).toBeHidden();
  const me = await (await page.request.get("/api/me")).json();
  expect(me.seenTours).toEqual([]);
});
