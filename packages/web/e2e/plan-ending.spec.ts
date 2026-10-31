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
// Deposit, its Jobs booked up to 9 February.
const FIRST = "2026-01-19T14:00:00Z";
const SUNDAY_10AM = "2026-01-18T15:00:00Z";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// Casey's plan, its acceptance recorded by Olive
const planStarted = async () => {
  await createStaff(olive);
  await signUp(olive.email);
  const { propertyId } = await completedFirstClean(olive.email);
  return startedServicePlan({
    officeEmail: olive.email,
    propertyId,
    startsAt: FIRST,
  });
};

// once a dialog has finished opening: mid-animation, its colours are still
// fading in
const expectAccessible = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
};

test(
  "a Client Ends their Service Plan in the portal, seeing what it does first",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const { planId } = await planStarted();
    await setClock(SUNDAY_10AM);
    await signedInAs(page, casey.email);
    await page.goto(`/portal/plans/${planId}`);

    // what Ending does is shown in the dialog that confirms it
    const ending = page.getByRole("region", { name: "Ending your plan" });
    await expectAccessible(page);
    await ending.getByRole("button", { name: "End plan" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "End your Service Plan?",
    });
    await expect(dialog).toContainText(
      "It cancels your 3 cleans booked more than 24 hours away, free: Mon, Jan 26, 9:00 AM; Mon, Feb 2, 9:00 AM; Mon, Feb 9, 9:00 AM.",
    );
    await expect(dialog).toContainText(
      "Your clean on Mon, Jan 19, 9:00 AM is less than 24 hours away, so it goes ahead.",
    );
    await expect(dialog).toContainText(
      "Your $50.46 Deposit comes off the price of the clean on Mon, Jan 19, 9:00 AM.",
    );
    await expect(dialog).toContainText("An Ended plan can't be started again.");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "End plan" }).click();

    await expect(page.getByText("Your Service Plan has Ended")).toBeVisible();
    await expect(page.getByRole("region", { name: "Ended" })).toContainText(
      "Your Service Plan Ended on Jan 18",
    );
    await expect(
      page.getByRole("grid", { name: "Your upcoming cleans" }).getByRole("row"),
    ).toHaveCount(1);
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your Service Plan has Ended",
    );
  },
);

test("a Client's plan is On Hold while a fee is Unpaid, and back on once they pay it", async ({
  page,
}) => {
  const { planId, firstJob } = await planStarted();
  await setClock(SUNDAY_10AM);
  await failCharges();
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${firstJob.id}`);
  await page.getByRole("button", { name: "Skip this clean" }).click();
  await page
    .getByRole("alertdialog", { name: "Skip this clean?" })
    .getByRole("button", { name: "Skip this clean" })
    .click();
  await expect(page.getByText("Your clean is skipped")).toBeVisible();

  await page.goto(`/portal/plans/${planId}`);
  const onHold = page.getByRole("region", { name: "On Hold" });
  await expect(onHold).toContainText(
    "We couldn't take payment for the clean on Mon, Jan 19, 9:00 AM ($50.46). Cleans already booked go ahead, but we won't book any more until it's paid.",
  );
  await expectAccessible(page);

  await failCharges(null);
  await onHold.getByRole("link", { name: "Pay for that clean" }).click();
  // saving a card tries the charge again
  await page
    .getByRole("alert")
    .filter({ hasText: "Payment needed" })
    .getByRole("link", { name: "Update Payment Method" })
    .click();
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page.getByText("Card saved")).toBeVisible();

  await page.goto(`/portal/plans/${planId}`);
  await expect(page.getByRole("region", { name: "On Hold" })).toHaveCount(0);
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
});

test(
  "Office Staff see an On Hold plan under Needs attention, and can End it for the Client",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const { planId, firstJob } = await planStarted();
    await setClock(SUNDAY_10AM);
    await failCharges();
    await signedInAs(page, olive.email);
    await page.goto(`/office/jobs/${firstJob.id}`);
    await page.getByRole("button", { name: "Cancel Job" }).click();
    await page
      .getByRole("alertdialog", { name: "Cancel this Job?" })
      .getByRole("button", { name: "Cancel Job" })
      .click();
    await expect(page.getByText("Job cancelled")).toBeVisible();

    await page.goto("/office");
    const held = page
      .getByRole("grid", { name: "Needs attention" })
      .getByRole("row")
      .filter({ hasText: "Collect what's owed to resume the plan" });
    await expect(held).toContainText(
      "Service Plan: $50.46 Unpaid, no new Jobs booked",
    );
    await held.click();
    // the plan is on its home's page
    await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("region", { name: "On Hold" })).toContainText(
      "The Client's payment couldn't be taken for the clean on Mon, Jan 19, 9:00 AM ($50.46).",
    );

    const ending = page.getByRole("region", { name: "Ending the plan" });
    await ending.getByRole("button", { name: "End plan" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "End this Service Plan?",
    });
    await expect(dialog).toContainText(
      "It cancels the Client's 3 cleans booked more than 24 hours away, free",
    );
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "End plan" }).click();

    // the toast; the home has no plan now, so its page offers a new one
    await expect(
      page.getByText("Service Plan Ended", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Quote a Service Plan" }),
    ).toBeVisible();
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your Service Plan has Ended",
    );
  },
);
