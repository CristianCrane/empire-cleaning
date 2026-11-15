import type { Page } from "@playwright/test";
import {
  bookJob,
  createClient,
  createStaff,
  eachTheme,
  expect,
  expectAccessible,
  expectCurrentSection,
  goTo,
  openTile,
  searchList,
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

// what the frame shows while the next page loads (AppLayout's `loading`):
// the bar across the top, the page on show faded and out of reach, and
// "Loading…" for a screen reader
const loadingShown = (page: Page) => ({
  bar: page.locator("[data-loading-bar=loading]"),
  said: page.getByRole("status").filter({ hasText: /^Loading…$/ }),
  onShow: page.getByRole("main").locator("> div"),
});

const expectLoadingShown = async (page: Page) => {
  const { bar, said, onShow } = loadingShown(page);
  await expect(bar).toBeVisible();
  await expect(said).toHaveCount(1);
  await expect(onShow).toHaveAttribute("inert");
  await expect(onShow).toHaveAttribute("aria-busy", "true");
  await expect(onShow).toHaveCSS("opacity", "0.5");
};

// none of it, the bar's fade included; with the clock standing still,
// checked while nothing it waits on can come
const expectNothingShown = async (page: Page) => {
  const { said, onShow } = loadingShown(page);
  await expect(page.locator("[data-loading-bar]")).toHaveCount(0);
  await expect(said).toHaveCount(0);
  await expect(onShow).not.toHaveAttribute("inert");
  await expect(onShow).toHaveCSS("opacity", "1");
};

// the clock stopped where it is, to be moved on by hand
const stopTheClock = async (page: Page) =>
  page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);

const signInWithAJob = async (page: Page) => {
  // the API's fake clock is on Monday 5 January 2026: a Job today
  await bookJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 5 });
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");
};

// picked on prototype-nav-loading (C): a page that takes a moment shows a
// bar and fades the one on show, which stays until the next is ready; one
// ready within 200ms shows nothing, so a quick move doesn't flash (#454).
// The clock stands still only while a load is timed: a phone's ☰ menu
// slides on the running clock
test(
  "a page that takes a moment fades the one on show under a bar, and a quick one shows nothing",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.clock.install();
    await signInWithAJob(page);

    let letGo = await holdApi(page, aJob);
    await stopTheClock(page);
    await (await openTile(page, "Jobs")).getByRole("row").click();
    await expect(page).toHaveURL(/\/office\/jobs\//);
    await page.clock.runFor(199);
    await expectNothingShown(page);
    await page.clock.runFor(1);
    await expectLoadingShown(page);
    // the page on show stays, and so does its section
    await expect(
      page.getByRole("heading", { name: "Hi, Olive" }),
    ).toBeVisible();
    await expectCurrentSection(page, "Today");

    letGo();
    await page.clock.resume();
    await expectCurrentSection(page, "Jobs");
    await expectNothingShown(page);

    // a first visit ready within 200ms
    letGo = await holdApi(page, /\/api\/schedule\?/);
    await stopTheClock(page);
    await goTo(page, "Schedule");
    await expect(page).toHaveURL(/\/office\/schedule/);
    await page.clock.runFor(150);
    letGo();
    await expectCurrentSection(page, "Schedule");
    await page.clock.runFor(1_000);
    await expectNothingShown(page);
  },
);

// a change within the page reloads it as the person goes on using it: a
// search box keeps its focus as it's typed in (#454, plan review F1)
test("a search that takes a moment leaves the list as it is, still typed in", async ({
  page,
}) => {
  // a list with no one in it has no search
  await createClient({ email: "casey@example.com", name: "Casey Client" });
  await page.clock.install();
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await goTo(page, "Clients");
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

  const letGo = await holdApi(page, /\/api\/clients\?.*q=/);
  await stopTheClock(page);
  await searchList(page, "Search clients", "nobody");
  // the search runs once typing pauses
  await page.clock.runFor(1_000);
  await expect(page).toHaveURL(/q=nobody/);
  await expectNothingShown(page);
  await expect(
    page.getByRole("searchbox", { name: "Search clients" }),
  ).toBeFocused();

  letGo();
  await expect(page.getByText("Nothing matches “nobody”")).toBeVisible();
});

eachTheme(() => {
  test("a page loading next passes the accessibility check", async ({
    page,
  }) => {
    // still, so the check needn't wait out the bar's creep
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInWithAJob(page);

    const letGo = await holdApi(page, aJob);
    await (await openTile(page, "Jobs")).getByRole("row").click();
    await expectLoadingShown(page);
    // the app, not the page: a page's check asks for the main heading,
    // which the faded page holds back with the rest of it while it's inert
    await expectAccessible(page, "#root");
    letGo();
    await expectCurrentSection(page, "Jobs");
  });
});
