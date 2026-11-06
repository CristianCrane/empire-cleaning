import type { Page } from "@playwright/test";
import { clientTours } from "../src/screens/portal/tours.ts";
import { toursFor } from "../src/screens/tours.ts";
import {
  eachTheme,
  expect,
  expectAccessible,
  quoteSent,
  returnToTab,
  signedInAs,
  test,
} from "./harness.ts";

const olive = { email: "olive@example.com", name: "Olive Owner" };
const casey = { name: "Casey Client", email: "casey@example.com" };

// first-time help's tours, which every other spec is spared (harness.ts)
test.use({ showTours: true });

// the tour's step on the screen, by its title
const step = (page: Page, title: string) =>
  page.getByRole("dialog", { name: title });

// what the step points at: lit up, the rest of the page dimmed
const expectPointedAt = (page: Page, name: string) =>
  expect(page.locator(".driver-active-element")).toHaveAccessibleName(
    new RegExp(`^${name}`),
  );

// each area with tours is walked through here; a new area's fails this
// until it is
test("every area's tours are walked through", () => {
  expect(Object.keys(toursFor)).toEqual(["portal"]);
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

    // each seen, on the Account: a tour whose step can't be found on its
    // screen never runs, and fails here
    await expect
      .poll(async () => {
        const me = await (await page.request.get("/api/me")).json();
        return [...me.seenTours].sort((a, b) => a.localeCompare(b));
      })
      .toEqual(
        clientTours.tours
          .map((tour) => tour.id)
          .sort((a, b) => a.localeCompare(b)),
      );
  });
});
