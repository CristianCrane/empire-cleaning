import {
  completedFirstClean,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  failCharges,
  setClock,
  signedInAs,
  signUp,
  startedServicePlan,
  test,
  jobAction,
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

test(
  "a Client skips one clean of their plan for free in the portal",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const job = await planStarted();
    await signedInAs(page, casey.email);
    await page.goto(`/portal/jobs/${job.id}`);

    const skip = page.getByRole("region", { name: "Need to skip this clean?" });
    await expect(skip).toContainText(
      "You can skip it for free until Sun, Jan 18, 9:00 AM. After that, it's a late cancellation, with a fee the same as your plan's deposit.",
    );
    await expect(skip).toContainText("Your cleaning plan carries on");
    await expectAccessible(page);

    await skip.getByRole("button", { name: "Skip this clean" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Skip this clean?" });
    await expect(dialog).toContainText("There's no charge for skipping it.");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Skip this clean" }).click();

    await expect(page.getByText("Your clean is skipped")).toBeVisible();
    const skipped = page.getByRole("region", { name: "Skipped" });
    await expect(skipped).toContainText("There's no charge for skipping it.");
    await expect(skipped).toContainText(
      "Your cleaning plan carries on as usual.",
    );
    await skipped.getByRole("link", { name: "See your cleaning plan" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your cleaning plan",
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
    "Skipping it less than 24 hours before is a late cancellation, with a $50.46 fee, the same as your plan's deposit. Your deposit stays held. The fee is charged to your card.",
  );
  await skip.getByRole("button", { name: "Skip this clean" }).click();
  await page
    .getByRole("alertdialog", { name: "Skip this clean?" })
    .getByRole("button", { name: "Skip this clean" })
    .click();

  await expect(page.getByText("Your clean is skipped")).toBeVisible();
  await expect(page.getByRole("region", { name: "Skipped" })).toContainText(
    "Skipping it less than 24 hours before is a late cancellation, with a $50.46 fee, the same as your plan's deposit. Your deposit stays held.",
  );
  const payment = page.getByRole("alert").filter({ hasText: "Payment needed" });
  await expect(payment).toContainText("We couldn't take $50.46");

  // the same card, tried again once the money is there
  await failCharges(null);
  await payment.getByRole("link", { name: "Update your card" }).click();
  const needed = page.getByRole("alert").filter({ hasText: "Payment needed" });
  await expect(needed).toContainText(
    /We couldn't take \$50\.46 for your .+ clean from your Test card ending 4242\./,
  );
  await needed.getByRole("button", { name: "Try this card again" }).click();
  await expect(page.getByText("Payment taken")).toBeVisible();
  await expect(needed).toHaveCount(0);
  await page.goto(`/portal/jobs/${job.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(payment).toHaveCount(0);
});

test(
  "Office Staff skip a plan Job late for the Client, charging the fee",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const job = await planStarted();
    await setClock(SUNDAY_10AM);
    await signedInAs(page, olive.email);
    await page.goto(`/office/jobs/${job.id}`);

    await jobAction(page, "Cancel job");
    const dialog = page.getByRole("alertdialog", { name: "Cancel this job?" });
    await expect(dialog).toContainText(
      "A late cancellation: a $50.46 fee, the plan's deposit amount. The plan's deposit stays held. The fee is charged.",
    );
    await expect(dialog).toContainText("The cleaning plan carries on.");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Cancel job" }).click();

    await expect(page.getByText("Job cancelled")).toBeVisible();
    await expect(
      page.getByText(
        "By the client, a late cancellation; the plan carries on.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Money" })).toContainText(
      "Fee$50.46",
    );
    await expect(page.getByRole("region", { name: "History" })).toContainText(
      "Fee of $50.46 charged",
    );
  },
);
