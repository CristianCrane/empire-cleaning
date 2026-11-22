import type { Browser, Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  expect,
  expectNextStep,
  expectNothingNext,
  linkIn,
  pageAction,
  payAndBook,
  quoteSent,
  requestQuoteAsGuest,
  signedInAs,
  test,
} from "./harness.ts";

// A Client's quote (#493): what's waiting on them is its badge, a way on
// from a no is the page's primary, and each alert says only why. Each test
// ends on the quote, for its picture (pr:shots). The API's clock is at 4am
// on Monday 5 January 2026 in New York; Quotes here are for 9am on Monday
// 12 January.
const olive = { email: "olive@example.com", name: "Olive Owner" };
const casey = { name: "Casey Client", email: "casey@example.com" };

// the Office's side in a browser of its own, so the test's page is Casey's
const office = async (browser: Browser) =>
  (await browser.newContext()).newPage();

const quote = async (page: Page, subject: string) => {
  await signedInAs(page, casey.email);
  await page.goto(await linkIn(casey.email, subject));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
};

test("a quote ready to answer says Ready, each option's badge under its title", async ({
  page,
  browser,
}) => {
  await quoteSent(await office(browser), olive, casey);
  await quote(page, "Your quote from Empire Cleaning");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const deep = page
    .getByRole("region", { name: "Quote details" })
    .getByRole("radio", { name: "Deep Clean" });
  await expect(deep).toBeChecked();
  await expect(
    page.getByRole("region", { name: "Quote details" }),
  ).toContainText("Recommended");
  // paying is its own part, under the quote
  await expect(payAndBook(page).form).toBeVisible();
});

test("a quote whose day filled up has nothing next, declining its one action", async ({
  page,
  browser,
}) => {
  await quoteSent(await office(browser), olive, casey);
  // another booking takes all of Monday's 16 hours, from 2pm
  await bookJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 16 });
  await quote(page, "Your quote from Empire Cleaning");
  const bookedUp = page
    .getByRole("status")
    .filter({ hasText: "has been fully booked" });
  // we are the team: it says what we'll do
  await expect(bookedUp).toHaveText(
    "Sorry, Mon, Jan 12, 9:00 AM has been fully booked since we sent this quote, so it can't be accepted. We'll send you a new quote for another time.",
  );
  // nothing to pay for and nothing waits on them, but they can still say
  // no: the page's one action, not the alert's
  await expect(payAndBook(page).form).toHaveCount(0);
  await expectNothingNext(page);
  await expect(bookedUp.getByRole("button")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Decline this quote" }),
  ).toBeVisible();
});

test("a turned-down quote leads with Request a quote, its alert saying why", async ({
  page,
  browser,
}) => {
  await requestQuoteAsGuest(casey);
  await createStaff({ ...olive, roles: ["office_staff"] });
  const staff = await office(browser);
  await signedInAs(staff, olive.email);
  await staff.goto("/office/quotes");
  await staff.getByText(casey.name).click();
  await pageAction(staff, "Turn down");
  const dialog = staff.getByRole("alertdialog", {
    name: "Turn down this quote?",
  });
  await dialog.getByText("Outside the area we clean").click();
  await dialog.getByRole("button", { name: "Turn down" }).click();
  await expect(staff.getByText("Quote turned down")).toBeVisible();

  await quote(page, "About your quote from Empire Cleaning");
  const why = page
    .getByRole("main")
    .getByRole("status")
    .filter({ hasText: "Sorry, we can't take this one on." });
  await expect(why).toContainText("It's outside the area we clean.");
  await expect(why.getByRole("link")).toHaveCount(0);
  // asking again is their way on
  await expectNextStep(page, "Request a quote");
});
