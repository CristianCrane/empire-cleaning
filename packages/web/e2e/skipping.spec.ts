import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  completedFirstClean,
  createStaff,
  emailsTo,
  expect,
  failCharges,
  setClock,
  signedInAs,
  signUp,
  startedServicePlan,
  test,
} from "./harness.ts";

// Casey's First Clean is done at 11am on Monday 12 January 2026, New York
// time, with their card saved, and the API's clock is left there. Their plan
// is a Standard Clean every week from 9am on Monday the 19th, with a $50.46
// Deposit: its first Job can be skipped free until 9am on Sunday the 18th.
const FIRST = "2026-01-19T14:00:00Z";
const SUNDAY_10AM = "2026-01-18T15:00:00Z";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// Casey's plan, its acceptance recorded by Olive; returns its first Job
const planStarted = async () => {
  await createStaff(olive);
  await signUp(olive.email);
  const { propertyId } = await completedFirstClean(olive.email);
  const { firstJob } = await startedServicePlan({
    officeEmail: olive.email,
    propertyId,
    startsAt: FIRST,
  });
  return firstJob;
};

// once a dialog has finished opening: mid-animation, its colours are still
// fading in
const expectAccessible = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
};

test(
  "a Client skips one clean of their plan for free in the portal",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const job = await planStarted();
    await signedInAs(page, casey.email);
    await page.goto(`/portal/jobs/${job.id}`);

    const skip = page.getByRole("region", { name: "Need to skip this clean?" });
    await expect(skip).toContainText(
      "You can skip it for free until Sun, Jan 18, 9:00 AM. After that, it's a Late Cancellation, with a fee the same as your plan's Deposit.",
    );
    await expect(skip).toContainText("your Service Plan carries on");
    await expectAccessible(page);

    await skip.getByRole("button", { name: "Skip this clean" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Skip this clean?" });
    await expect(dialog).toContainText("There's no charge.");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Skip this clean" }).click();

    await expect(page.getByText("Your clean is skipped")).toBeVisible();
    const skipped = page.getByRole("region", { name: "Skipped" });
    await expect(skipped).toContainText("There was no charge for skipping it.");
    await expect(skipped).toContainText(
      "Your Service Plan carries on as usual.",
    );
    await skipped.getByRole("link", { name: "See your Service Plan" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your Service Plan",
    );
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your clean is skipped",
    );
  },
);

test("a Client skipping late is charged the fee, and pays it once their card works", async ({
  page,
}) => {
  const job = await planStarted();
  await setClock(SUNDAY_10AM);
  await failCharges();
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${job.id}`);

  const skip = page.getByRole("region", { name: "Need to skip this clean?" });
  await expect(skip).toContainText(
    "It's less than 24 hours until your clean, so skipping it now is a Late Cancellation. A $50.46 Late Cancellation fee, the same as your plan's Deposit, is charged to your card. Your Deposit stays held.",
  );
  await skip.getByRole("button", { name: "Skip this clean" }).click();
  await page
    .getByRole("alertdialog", { name: "Skip this clean?" })
    .getByRole("button", { name: "Skip this clean" })
    .click();

  await expect(page.getByText("Your clean is skipped")).toBeVisible();
  await expect(page.getByRole("region", { name: "Skipped" })).toContainText(
    "it's a Late Cancellation, with a $50.46 fee: the same as your plan's Deposit, which stays held.",
  );
  const payment = page.getByRole("region", { name: "Payment needed" });
  await expect(payment).toContainText("We couldn't charge $50.46");

  await failCharges(null);
  await payment
    .getByRole("button", { name: "Try the same card again" })
    .click();
  await expect(page.getByText("Payment taken")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Payment needed" }),
  ).toHaveCount(0);
});

test(
  "Office Staff skip a plan Job late for the Client, charging the fee",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const job = await planStarted();
    await setClock(SUNDAY_10AM);
    await signedInAs(page, olive.email);
    await page.goto(`/office/jobs/${job.id}`);

    await page
      .getByRole("region", { name: "Cancelling" })
      .getByRole("button", { name: "Cancel Job" })
      .click();
    const dialog = page.getByRole("alertdialog", { name: "Cancel this Job?" });
    await expect(dialog).toContainText(
      "It's a Late Cancellation: a $50.46 fee, the plan's Deposit amount, is charged. The plan's Deposit stays held.",
    );
    await expect(dialog).toContainText("The Service Plan carries on.");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Cancel Job" }).click();

    await expect(page.getByText("Job cancelled")).toBeVisible();
    const skipped = page.getByRole("region", { name: "Skipped" });
    await expect(skipped).toContainText(
      "By the Client, a Late Cancellation; the plan carries on",
    );
    await expect(skipped).toContainText(/Fee \$50\.46, Jan 18/);
  },
);
