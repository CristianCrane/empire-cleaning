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
  pageAction,
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

test(
  "a Client Ends their Service Plan in the portal, seeing what it does first",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const { planId } = await planStarted();
    await setClock(SUNDAY_10AM);
    await signedInAs(page, casey.email);
    await page.goto(`/portal/plans/${planId}`);

    // what Ending does is shown in the dialog that confirms it
    await expectAccessible(page);
    await pageAction(page, "End plan");
    const dialog = page.getByRole("alertdialog", {
      name: "End your cleaning plan?",
    });
    await expect(dialog).toContainText(
      "It cancels your 3 cleans booked more than 24 hours away, free: Mon, Jan 26, 9:00 AM; Mon, Feb 2, 9:00 AM; Mon, Feb 9, 9:00 AM.",
    );
    await expect(dialog).toContainText(
      "Your clean on Mon, Jan 19, 9:00 AM is less than 24 hours away, so it goes ahead.",
    );
    await expect(dialog).toContainText(
      "Your $50.46 deposit comes off the price of the clean on Mon, Jan 19, 9:00 AM.",
    );
    await expect(dialog).toContainText("An ended plan can't be started again.");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "End plan" }).click();

    await expect(page.getByText("Your cleaning plan has ended")).toBeVisible();
    await expect(page.getByText(/Ended Jan 18/)).toBeVisible();
    await expect(
      page.getByRole("grid", { name: "Your upcoming cleans" }).getByRole("row"),
    ).toHaveCount(1);
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your cleaning plan has ended",
    );

    // a clean the plan took with it reads as cancelled with the plan, not
    // skipped, and the plan doesn't carry on
    await page.goto("/portal/cleans");
    await page.getByRole("tab", { name: /Past/ }).click();
    const last = page.getByRole("row").first();
    await expect(last).toContainText("Cancelled");
    await last.click();
    const cancelled = page.getByRole("region", { name: "Cancelled" });
    await expect(cancelled).toContainText(
      "The cleaning plan ended, so this clean was cancelled. There's no charge for it.",
    );
    await expect(cancelled).not.toContainText("carries on");
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
  await pageAction(page, "Skip this clean");
  await page
    .getByRole("alertdialog", { name: "Skip this clean?" })
    .getByRole("button", { name: "Skip this clean" })
    .click();
  await expect(page.getByText("Your clean is skipped")).toBeVisible();

  await page.goto(`/portal/plans/${planId}`);
  const onHold = page
    .getByRole("alert")
    .filter({ hasText: "Your plan is paused" });
  await expect(onHold).toContainText(
    "Your plan is paused. We couldn't take payment for the clean on Mon, Jan 19, 9:00 AM ($50.46). Cleans already booked still go ahead, but we won't book any more.",
  );
  await expectAccessible(page);

  await failCharges(null);
  await onHold.getByRole("link", { name: "Pay for that clean" }).click();
  // saving a card tries the charge again
  await page
    .getByRole("alert")
    .filter({ hasText: "Payment needed" })
    .getByRole("link", { name: "Update your card" })
    .click();
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page.getByText("Card saved")).toBeVisible();

  await page.goto(`/portal/plans/${planId}`);
  await expect(page.getByText("Your plan is paused")).toHaveCount(0);
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
});

test(
  "Office Staff see an On Hold plan under Needs attention, and can End it for the Client",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const { firstJob } = await planStarted();
    await setClock(SUNDAY_10AM);
    await failCharges();
    await signedInAs(page, olive.email);
    await page.goto(`/office/jobs/${firstJob.id}`);
    await pageAction(page, "Cancel job");
    await page
      .getByRole("alertdialog", { name: "Cancel this job?" })
      .getByRole("button", { name: "Cancel job" })
      .click();
    await expect(page.getByText("Job cancelled")).toBeVisible();

    await page.goto("/office");
    const held = page
      .getByRole("grid", { name: "Needs attention" })
      .getByRole("row")
      .filter({ hasText: "Collect what's owed to resume the plan" });
    await expect(held).toContainText("Cleaning plan paused: $50.46 unpaid");
    await held.click();
    // the plan is on its home's page
    await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("alert").filter({ hasText: "Paused." }),
    ).toContainText(
      "Paused. The client's payment didn't go through for the clean on Mon, Jan 19, 9:00 AM ($50.46).",
    );

    // on the plan, its own action (WEB-J)
    await page
      .getByRole("region", { name: "Cleaning plan" })
      .getByRole("button", { name: "End plan" })
      .click();
    const dialog = page.getByRole("alertdialog", {
      name: "End this cleaning plan?",
    });
    await expect(dialog).toContainText(
      "It cancels the client's 3 cleans booked more than 24 hours away, free",
    );
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "End plan" }).click();

    // the toast; the home has no plan now, so its page offers a new one
    await expect(
      page.getByText("Cleaning plan ended", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Quote a cleaning plan" }),
    ).toBeVisible();
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your cleaning plan has ended",
    );
  },
);

// an Ended plan's page, a Record of what it was: nothing left to do to it
test(
  "an Ended plan has a page of its own, with nothing left to do to it",
  { tag: "@desktop" },
  async ({ page }) => {
    const { planId } = await planStarted();
    await signedInAs(page, olive.email);
    // nothing within a day of now goes ahead
    const ended = await page.request.post(`/api/service-plans/${planId}/end`, {
      data: { goingAhead: [] },
    });
    expect(ended.ok()).toBe(true);

    await page.goto(`/office/service-plans/${planId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Cleaning plan",
    );
    await expect(
      page.getByText("Ended", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Actions", exact: true }),
    ).toHaveCount(0);
    await expectAccessible(page);
  },
);
