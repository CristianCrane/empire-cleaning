import type { Page } from "@playwright/test";
import { MINUTE_MS } from "@empire-cleaning/models";
import {
  addCleaner,
  bookJob,
  createClient,
  createStaff,
  eachTheme,
  expect,
  expectAccessible,
  expectCurrentSection,
  goTo,
  holdApi,
  openTile,
  recordLanguages,
  searchList,
  setLanguage,
  offerJob,
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

// a laptop window under 1024 keeps a laptop's ways, its room for the page
// made by the sidebar folding to icons, not by the phone's frame (#493)
test(
  "from 768 to 1024 the sidebar folds to a rail of icons, each named, the account behind one press",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone has no rail");
    await createStaff(olive);
    await page.setViewportSize({ width: 900, height: 900 });
    await signedInAs(page, olive.email);
    await expect(page).toHaveURL("/office");

    const rail = page.getByRole("navigation", { name: "Office" });
    await expect(rail.getByRole("link")).toHaveText([
      "Today",
      "Schedule",
      "Jobs",
      "Quotes",
      "Clients",
      "Staff",
      "Services",
      "Prices",
    ]);
    await expect(
      rail.getByRole("group", { name: "People" }).getByRole("link"),
    ).toHaveText(["Clients", "Staff"]);
    await expect(rail.getByRole("link", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // icons alone: the page has the rest of the window
    expect((await rail.boundingBox())!.width).toBeLessThanOrEqual(64);
    expect((await page.getByRole("main").boundingBox())!.x).toBe(64);
    // each name beside its icon on hover, from a pointer that has moved
    // over the page, as a person's has: a hover as the first pointer move
    // since the page loaded opened no tooltip (docs/testing-log.md,
    // 2026-11-22)
    await page.mouse.move(400, 400);
    await rail.getByRole("link", { name: "Quotes" }).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Quotes");
    // no phone's frame, and no logo squeezed into the rail
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await expect(page.getByRole("img", logo)).toBeHidden();

    // the account's parts behind the rail's Account, headed by the logo and
    // the area, as the ☰ menu is
    await page.getByRole("button", { name: "Account" }).click();
    const account = page.getByRole("dialog", { name: "Account" });
    await expect(account.getByRole("img", logo)).toBeVisible();
    await expect(account.getByText("Office", { exact: true })).toBeVisible();
    await expect(account.getByText(olive.name)).toBeVisible();
    await expect(
      account.getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
    await expect(
      account.getByRole("button", { name: "Dark theme" }),
    ).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(account).toBeHidden();
  },
);

// the other language stays one press away on the rail, named in its own
// words, so someone who can't read the screen's language still finds it
// (#305); only the rest of the account's parts are behind Account
test(
  "from 768 to 1024 a Client's other language is on the rail itself",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone has no rail");
    await createClient(casey);
    await page.setViewportSize({ width: 900, height: 900 });
    await signedInAs(page, casey.email);
    await expect(page).toHaveURL("/portal");

    const rail = page.getByRole("complementary");
    await expect(rail.getByRole("button", { name: "Español" })).toBeVisible();
    await page.getByRole("button", { name: "Account" }).click();
    const account = page.getByRole("dialog", { name: "Account" });
    await expect(account.getByText(casey.name)).toBeVisible();
    await expect(
      account.getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
    await expect(account.getByRole("button", { name: "Español" })).toHaveCount(
      0,
    );
  },
);

// the Cleaner's Offers says how many wait on their answer, in the
// sidebar's name and as a mark on the rail's icon
test(
  "a Cleaner's Offers counts what waits on them, in the sidebar and on the rail",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "the phone's tab bar: assignments.spec's smoke test");
    const cory = await addCleaner("Cory Cleaner");
    const job = (await bookJob({
      startsAt: "2026-01-08T14:00:00Z",
      labourHours: 3,
    })) as { id: string };
    await offerJob(job.id, cory.id);
    await signedInAs(page, "cory@example.com");
    const sidebar = page.getByRole("complementary");
    await expect(
      sidebar.getByRole("link", { name: "Offers (1)" }),
    ).toBeVisible();

    await page.setViewportSize({ width: 900, height: 900 });
    const rail = page.getByRole("complementary");
    const offers = rail.getByRole("link", { name: "Offers (1)" });
    await expect(offers).toBeVisible();
    await expect(offers.getByText("1", { exact: true })).toBeVisible();
  },
);

const casey = { name: "Casey Client", email: "casey@example.com" };

const aJob = /\/api\/jobs\/[0-9a-f-]{36}$/;

// what the frame shows while the next page loads (AppLayout's `loading`):
// the bar across the top, the page on show faded and out of reach, and
// "Loading…" for a screen reader. The page on show is out of reach from
// the press on, before any of the rest shows
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
// checked while nothing it waits on can come. `leaving`: the next page is
// on its way, so the page on show is out of reach already, else a press
// meant for the next page lands on it
const expectNothingShown = async (page: Page, { leaving = false } = {}) => {
  const { said, onShow } = loadingShown(page);
  await expect(page.locator("[data-loading-bar]")).toHaveCount(0);
  await expect(said).toHaveCount(0);
  if (leaving) await expect(onShow).toHaveAttribute("inert");
  else await expect(onShow).not.toHaveAttribute("inert");
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
// ready within 200ms shows nothing, so a quick move doesn't flash (#454),
// though the page on show takes no press from the press that leaves it.
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
    await expectNothingShown(page, { leaving: true });
    await page.clock.runFor(1);
    await expectLoadingShown(page);
    // the page on show stays, and so does its section in the navigation:
    // never two current at once
    await expect(
      page.getByRole("heading", { name: "Hi, Olive" }),
    ).toBeVisible();
    await expectCurrentSection(page, "Today");
    await expectCurrentSection(page, "Jobs", false);

    letGo();
    await page.clock.resume();
    await expectCurrentSection(page, "Jobs");
    await expectCurrentSection(page, "Today", false);
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
  await createClient(casey);
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

// the same on a home, whose route is the area's index ("/office/" to the
// router, "/office" in the address bar): Today's own refresh, once a
// minute, never puts it out of reach, even for a moment, as it reloads
// (PR #503 review F7)
test("Today's own refresh never puts it out of reach", async ({ page }) => {
  await page.clock.install();
  await signInWithAJob(page);
  await expect(page.getByRole("heading", { name: "Hi, Olive" })).toBeVisible();
  // each time the page on show goes out of reach or back
  await page.evaluate(() => {
    const onShow = document.querySelector("main > div")!;
    const seen: (string | null)[] = [];
    (window as unknown as { inert: typeof seen }).inert = seen;
    new MutationObserver(() => seen.push(onShow.getAttribute("inert"))).observe(
      onShow,
      { attributeFilter: ["inert"] },
    );
  });

  const needs = /\/api\/dashboard\/needs-attention$/;
  const letGo = await holdApi(page, needs);
  const asked = page.waitForRequest(needs);
  await stopTheClock(page);
  await page.clock.runFor(MINUTE_MS);
  // under way, and held past the 200ms a move shows itself after
  await asked;
  await page.clock.runFor(1_000);
  await expectNothingShown(page);
  letGo();
  await page.clock.resume();
  await expect(page.getByRole("heading", { name: "Hi, Olive" })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { inert: (string | null)[] }).inert,
    ),
  ).toEqual([]);
});

eachTheme(() => {
  test("a page loading next passes the accessibility check", async ({
    page,
  }) => {
    // still, so the check needn't wait out the bar's creep
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInWithAJob(page);

    // never let go: the test ends mid-load, the picture pr:shots takes
    await holdApi(page, aJob);
    await (await openTile(page, "Jobs")).getByRole("row").click();
    await expectLoadingShown(page);
    // the app, not the page: a page's check asks for the main heading,
    // which the faded page holds back with the rest of it while it's inert
    await expectAccessible(page, "#root");
  });
});

// a link's page starts loading as the person shows they'll press it
// (preload.ts): the pointer resting on it, focus, or pressing down (#454)
test(
  "a link the pointer rests on loads its page ahead, so pressing it shows the page at once",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone has no pointer to rest on a link");
    await createStaff(olive);
    await signedInAs(page, olive.email);
    await expect(page).toHaveURL("/office");

    const jobs = /\/api\/jobs\?/;
    const loadedAhead = page.waitForResponse(jobs);
    const link = page
      .getByRole("navigation", { name: "Office" })
      .getByRole("link", { name: "Jobs" });
    await link.hover();
    await loadedAhead;

    // asked again as it opens, held: what shows is what was loaded ahead
    const letGo = await holdApi(page, jobs);
    await link.click();
    await expectCurrentSection(page, "Jobs");
    await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
    letGo();
  },
);

// a page loaded ahead isn't on screen: going there sets the language, not
// loading it. The test site's banner links outside the portal, to its demo
// people, whose page is in the signed-out language
test("a page loaded ahead leaves the language as it is", async ({ page }) => {
  await page.route("**/api/site", (route) =>
    route.fulfill({ json: { mode: "test" } }),
  );
  await createClient(casey);
  await signedInAs(page, casey.email);
  await setLanguage(page, "es");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  const languages = await recordLanguages(page);

  await page.getByRole("link", { name: /^You're / }).focus();
  // a page loaded ahead after it, so the first has gone through
  const loadedAhead = page.waitForResponse(/\/api\/bills\/mine/);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Pagos" })
    .first()
    .focus();
  await loadedAhead;
  expect(await languages()).toEqual([]);
});
