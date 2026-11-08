import type { Page } from "@playwright/test";
import { officeTours } from "../src/screens/office/tours.ts";
import { clientTours } from "../src/screens/portal/tours.ts";
import { toursFor, type AreaTours } from "../src/screens/tours.ts";
import {
  addCleaner,
  bookJob,
  createStaff,
  draftTheQuote,
  eachTheme,
  expect,
  expectAccessible,
  quoteSent,
  requestQuoteAsGuest,
  requestReschedule,
  returnToTab,
  signedInAs,
  test,
} from "./harness.ts";

const olive = { email: "olive@example.com", name: "Olive Owner" };
const casey = { name: "Casey Client", email: "casey@example.com" };

// first-time help's tours in the test's own page, which every other spec
// (and every other browser here) is spared (harness.ts)
test.use({ showTours: true });

// the tour's step on the screen, by its title
const step = (page: Page, title: string) =>
  page.getByRole("dialog", { name: title });

// what the step points at: lit up, the rest of the page dimmed
const expectPointedAt = (page: Page, name: string) =>
  expect(page.locator(".driver-active-element")).toHaveAccessibleName(
    new RegExp(`^${name}`),
  );

// each seen, on the Account: a tour whose step can't be found on its
// screen never runs, and fails here
const expectEachSeen = (page: Page, area: AreaTours) =>
  expect
    .poll(async () => {
      const me = await (await page.request.get("/api/me")).json();
      return (me.seenTours as string[])
        .filter((id) => area.tours.some((tour) => tour.id === id))
        .sort((a, b) => a.localeCompare(b));
    })
    .toEqual(
      area.tours.map((tour) => tour.id).sort((a, b) => a.localeCompare(b)),
    );

// each area with tours is walked through here; a new area's fails this
// until it is
test("every area's tours are walked through", () => {
  expect(Object.keys(toursFor)).toEqual(["portal", "office"]);
});

eachTheme(() => {
  test("a new Client meets each of the portal's tours once, as each screen first matters", async ({
    page,
    browser,
  }) => {
    const office = await (await browser.newContext()).newPage();
    await quoteSent(office, olive, casey);

    // Home, a Quote waiting: the first tour they meet leads with the value line
    await signedInAs(page, casey.email);
    await expect(step(page, "Welcome")).toContainText(clientTours.welcome);
    // coming back to the tab asks for the Account again, and leaves the tour
    const lookedAgain = page.waitForResponse("**/api/me");
    await returnToTab(page);
    await lookedAgain;
    await expectAccessible(page);
    await step(page, "Welcome").getByRole("button", { name: "Next" }).click();
    await expect(step(page, "Your Quote")).toBeVisible();
    await expectPointedAt(page, "See your Quote");
    await expectAccessible(page);
    await step(page, "Your Quote")
      .getByRole("button", { name: "Got it" })
      .click();
    await expect(step(page, "Your Quote")).toBeHidden();

    // the Quote page; closed partway, it counts as seen just the same
    await page.getByRole("link", { name: "See your Quote" }).click();
    await expect(step(page, "Pay and book")).toBeVisible();
    await expectPointedAt(page, "Pay and book");
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(step(page, "Pay and book")).toBeHidden();

    await page
      .getByRole("region", { name: "Pay and book" })
      .getByRole("button", { name: /^Accept and pay \$/ })
      .click();
    await expect(page.getByText(/^You're booked: a /)).toBeVisible();

    // Home, once booked
    await page.getByRole("link", { name: "Home" }).first().click();
    await expect(step(page, "How we get in")).toBeVisible();
    await expectPointedAt(page, "How we get in");
    await expectAccessible(page);
    await step(page, "How we get in")
      .getByRole("button", { name: "Next" })
      .click();
    await expect(step(page, "Need another time?")).toBeVisible();
    await expectPointedAt(page, "Move or cancel");
    await step(page, "Need another time?")
      .getByRole("button", { name: "Got it" })
      .click();
    await expect(step(page, "Need another time?")).toBeHidden();

    await expectEachSeen(page, clientTours);
  });

  test("new Office Staff meet each of the Office's tours once, as each screen first matters", async ({
    page,
  }) => {
    for (const name of ["Cory Cleaner", "Dee Cleaner"]) await addCleaner(name);
    await requestQuoteAsGuest(casey);
    // Thursday's, within the week, so it's open to the free Cleaners
    const job = (await bookJob({
      startsAt: "2026-01-08T14:00:00.000Z",
      labourHours: 4,
    })) as { id: string };
    await requestReschedule(job.id, { date: "2026-01-09", time: "10:00" });
    await createStaff({ ...olive, roles: ["office_staff"] });

    // Today. Having seen a Client tour, they're still met by the Office's
    // value line: each area leads its own first tour with its own
    await signedInAs(page, olive.email);
    await page.request.put("/api/me/tours/portal-home-quote");
    await page.reload();
    await expect(step(page, "Welcome")).toContainText(officeTours.welcome);
    await expectAccessible(page);
    await step(page, "Welcome").getByRole("button", { name: "Next" }).click();
    await expect(step(page, "Needs attention")).toBeVisible();
    await expectPointedAt(page, "Needs attention");
    await step(page, "Needs attention")
      .getByRole("button", { name: "Next" })
      .click();
    await expect(step(page, "Jobs, Quotes and Money")).toBeVisible();
    await expectPointedAt(page, "Needs attention by kind");
    await step(page, "Jobs, Quotes and Money")
      .getByRole("button", { name: "Next" })
      .click();
    await expect(step(page, "The Schedule")).toBeVisible();
    await expectPointedAt(page, "Schedule");
    await expectAccessible(page);
    await step(page, "The Schedule")
      .getByRole("button", { name: "Got it" })
      .click();
    await expect(step(page, "The Schedule")).toBeHidden();

    // the Quote asked for, drafted
    await page
      .getByRole("grid", { name: "Needs attention" })
      .getByRole("row", { name: /^Send a Quote/ })
      .click();
    await draftTheQuote(page);
    await expect(step(page, "Price it")).toBeVisible();
    await expectPointedAt(page, "Service and prices");
    await expectAccessible(page);
    await step(page, "Price it").getByRole("button", { name: "Next" }).click();
    await expect(step(page, "Send it")).toBeVisible();
    await expectPointedAt(page, `Send to ${casey.name}`);
    await page.keyboard.press("Escape");
    await expect(step(page, "Send it")).toBeHidden();

    // a Job with a new time asked for, and Cleaners Needed: one tour at a
    // time, the next on the next visit
    await page.goto(`/office/jobs/${job.id}`);
    await expect(step(page, "A new time")).toBeVisible();
    await expectPointedAt(page, "Answer");
    await expectAccessible(page);
    await step(page, "A new time")
      .getByRole("button", { name: "Got it" })
      .click();
    await expect(step(page, "A new time")).toBeHidden();
    await page.reload();
    await expect(step(page, "Needs a cleaner")).toBeVisible();
    await expectPointedAt(page, "Offer to a cleaner");
    await step(page, "Needs a cleaner")
      .getByRole("button", { name: "Got it" })
      .click();
    await expect(step(page, "Needs a cleaner")).toBeHidden();

    await page.getByRole("link", { name: "Schedule", exact: true }).click();
    await expect(step(page, "Your schedule")).toBeVisible();
    await expectPointedAt(page, "Jobs on");
    await expectAccessible(page);
    await step(page, "Your schedule")
      .getByRole("button", { name: "Got it" })
      .click();
    await expect(step(page, "Your schedule")).toBeHidden();

    await expectEachSeen(page, officeTours);
  });
});
