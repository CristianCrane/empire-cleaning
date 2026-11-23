import type { Page } from "@playwright/test";
import {
  bookedClean,
  completeJob,
  expect,
  expectNextStep,
  expectNothingNext,
  failCharges,
  priceChangeWaiting,
  recordNoAccess,
  requestReschedule,
  setClock,
  signedInAs,
  test,
} from "./harness.ts";

// A Client's clean leads with its next step (#493): the first thing that
// asks something of them is the page's primary, and each alert says only
// why. Each test ends on the clean, for its picture (pr:shots). The API's
// clock is at 4am on Monday 5 January 2026 in New York; Casey's Deep Clean
// is at 9am on Monday the 12th.
const olive = { email: "olive@example.com", name: "Olive Owner" };
const casey = { email: "casey@example.com" };

const clean = async (page: Page, jobId: string) => {
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${jobId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
};

const alerts = (page: Page) =>
  page.getByRole("main").getByRole("status").or(page.getByRole("alert"));

test("a booked clean leads with Pick a new time, what it is in its details", async ({
  page,
}) => {
  const { job } = await bookedClean(olive);
  await clean(page, job.id);
  await expectNextStep(page, "Pick a new time");
  const details = page.getByRole("region", { name: "Details" });
  await expect(details).toContainText("Price");
  // how long, asked as they'd ask it, as their quote said it, without the
  // crew count
  await expect(details).toContainText("6 hHow long");
  await expect(details).not.toContainText("cleaner");
  // paid when they booked, so it says so
  await expect(details).toContainText("Deposit paid, comes off the price");
  await expect(details).toContainText("Free to move or cancel");
  // nothing booked on it but the clean: no row saying None
  await expect(details).not.toContainText("None");
});

test("a price change leads the clean, its alert saying what the crew did, a second keeping its own Review", async ({
  page,
}) => {
  const job = await priceChangeWaiting(olive, { hours: [1, 0.5] });
  await clean(page, job.id);
  await expectNextStep(page, "Review the price change");
  const changes = page
    .getByRole("main")
    .getByRole("status")
    .filter({ hasText: "The crew did more than was quoted" });
  await expect(changes).toHaveCount(2);
  // the first is the page's to answer; the other keeps its own
  await expect(changes.nth(0).getByRole("button")).toHaveCount(0);
  await expect(
    changes.nth(1).getByRole("button", { name: "Review" }),
  ).toBeVisible();
});

test("a payment that didn't go through leads the clean with Update your card, a price change keeping its Review", async ({
  page,
}) => {
  const job = await priceChangeWaiting(olive, { failing: true });
  await clean(page, job.id);
  await expectNextStep(page, "Update your card");
  await expect(page.getByRole("alert")).toContainText("Payment needed.");
  // the receipt says what's still to come, in the badge's word
  await expect(
    page.getByRole("region", { name: "Your receipt" }),
  ).toContainText(/Unpaid\$[\d.,]+/);
  await expect(
    page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: "The crew did more than was quoted" })
      .getByRole("button", { name: "Review" }),
  ).toBeVisible();
});

test("a payment we try again ourselves asks nothing of the clean's reader", async ({
  page,
}) => {
  const { job, cory } = await bookedClean(olive);
  await setClock("2026-01-12T16:00:00Z");
  // the bank payment still clearing: we try again ourselves
  await failCharges("processing");
  await completeJob(job.id, cory.id, { condition: "moderate", reports: [] });
  await clean(page, job.id);
  // waiting on us, not failed
  // its badge, beside the title
  await expect(
    page
      .getByRole("heading", { level: 1 })
      .locator("..")
      .getByText("Not paid yet", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByRole("status").filter({
      hasText: "hasn't gone through yet",
    }),
  ).toContainText(
    "We'll try again by ourselves, so there's nothing you need to do.",
  );
  await expect(page.getByText("Payment needed.")).toHaveCount(0);
  await expectNothingNext(page);
  // nothing changed the price: the total alone, and the rest by its name
  const receipt = page.getByRole("region", { name: "Your receipt" });
  await expect(receipt).not.toContainText("Quoted price");
  await expect(receipt).toContainText("Deposit");
  await expect(receipt.getByText("Paid", { exact: true })).toHaveCount(1);
  // and what's still to come, in the badge's words, not "Charged to your
  // card" as if the whole clean were paid (the merge's UX review U4, U11)
  await expect(receipt).toContainText("Not paid yet$269.47");
  await expect(receipt).not.toContainText("Charged to your");
});

test("a move asked for waits on us: nothing next, Withdraw in its alert", async ({
  page,
}) => {
  const { job } = await bookedClean(olive);
  await requestReschedule(job.id, { date: "2026-01-14", time: "10:00" });
  await clean(page, job.id);
  await expectNothingNext(page);
  await expect(
    alerts(page).getByRole("button", { name: "Withdraw request" }),
  ).toBeVisible();
  // cancelling, the one thing left to do, its own Button
  await expect(
    page.getByRole("button", { name: "Cancel clean", exact: true }),
  ).toBeVisible();
});

test("after the crew couldn't get in, the clean leads with Check how we get in", async ({
  page,
}) => {
  const { job, cory } = await bookedClean(olive);
  await setClock("2026-01-12T14:30:00Z");
  await recordNoAccess(job.id, cory.id, "The code didn't open the door");
  await clean(page, job.id);
  await expectNextStep(page, "Check how we get in");
  // why, in an alert as red as its badge, with what it cost
  const why = page.getByRole("main").getByRole("alert");
  await expect(why).toContainText("The code didn't open the door");
  await expect(why).toContainText("$89.82 deposit is kept");
  await expect(
    page.getByRole("region", { name: "We couldn't get in" }),
  ).toHaveCount(0);
});
