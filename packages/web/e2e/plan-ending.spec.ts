import type { Page } from "@playwright/test";
import {
  completedFirstClean,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  expectCurrentSection,
  failCharges,
  setClock,
  signedInAs,
  signUp,
  startedServicePlan,
  test,
  expectNextStep,
  expectNoPageAction,
  expectNothingNext,
  pageAction,
  openTile,
  saveACard,
  requestReschedule,
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

// a Client's plan and home sit under Your details, as their crumbs say
test("a Client's plan and home light Your details in the nav", async ({
  page,
}) => {
  const { planId } = await planStarted();
  await signedInAs(page, casey.email);
  await page.goto(`/portal/plans/${planId}`);
  await expectCurrentSection(page, "Your details");
  await page
    .getByRole("link", { name: "41-12 Austin St", exact: true })
    .click();
  await expect(page).toHaveURL(/\/portal\/properties\//);
  await expectCurrentSection(page, "Your details");
});

test("a plan's clean with a move asked is badged so, as the Cleans list badges it", async ({
  page,
}) => {
  const { planId, firstJob } = await planStarted();
  await requestReschedule(firstJob.id, { date: "2026-01-21", time: "10:00" });
  await signedInAs(page, casey.email);
  await page.goto(`/portal/plans/${planId}`);

  const cleans = page.getByRole("grid", { name: "Your upcoming cleans" });
  await expect(
    cleans.getByRole("row").filter({ hasText: "Mon, Jan 19" }),
  ).toContainText("Move asked");
  // one simply booked says nothing more
  await expect(cleans.getByRole("row").nth(1)).not.toContainText(
    /Booked|Move asked/,
  );
});

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
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Your cleaning plan is paused" }),
  ).toContainText(
    "Your cleaning plan is paused. We couldn't take payment for the clean on Mon, Jan 19, 9:00 AM ($50.46). Cleans already booked still go ahead, but we won't book any more.",
  );
  await expectAccessible(page);

  // putting it right is the page's next step: saving a card tries the
  // charge again
  await failCharges(null);
  await expectNextStep(page, "Update your card");
  await pageAction(page, "Update your card");
  await saveACard(page).save.click();
  await expect(page.getByText("Card saved")).toBeVisible();

  await page.goto(`/portal/plans/${planId}`);
  await expect(page.getByText("Your cleaning plan is paused")).toHaveCount(0);
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
});

// skips a clean of Casey's plan late, for a fee that can't be charged
const skipLate = async (page: Page, jobId: string) => {
  await page.goto(`/portal/jobs/${jobId}`);
  await pageAction(page, "Skip this clean");
  await page
    .getByRole("alertdialog", { name: "Skip this clean?" })
    .getByRole("button", { name: "Skip this clean" })
    .click();
  await expect(page.getByText("Your clean is skipped")).toBeVisible();
};

test(
  "a plan On Hold for two payments leads with putting the first right, and the Office reaches each",
  { tag: "@desktop" },
  async ({ page, browser }) => {
    const { planId, firstJob } = await planStarted();
    await failCharges();
    await signedInAs(page, casey.email);
    await setClock(SUNDAY_10AM);
    await skipLate(page, firstJob.id);
    // the next week's clean, skipped late too
    await page.goto(`/portal/plans/${planId}`);
    await page
      .getByRole("grid", { name: "Your upcoming cleans" })
      .getByRole("row")
      .filter({ hasText: "Mon, Jan 26" })
      .click();
    await expect(page).toHaveURL(/\/portal\/jobs\//);
    const secondJob = page.url().split("/").pop()!;
    await setClock("2026-01-25T15:00:00Z");
    await skipLate(page, secondJob);

    // one next step for both: a card that works tries each again
    await page.goto(`/portal/plans/${planId}`);
    const held = page.getByRole("status").filter({ hasText: "the clean on" });
    await expect(held).toHaveCount(2);
    await expectNextStep(page, "Update your card");
    await expect(held.getByRole("link")).toHaveCount(0);

    // the Office: the first job its next step, the second its alert's link
    const office = await (await browser.newContext()).newPage();
    await signedInAs(office, olive.email);
    await office.goto(`/office/service-plans/${planId}`);
    await expectNextStep(office, "See the job");
    await office
      .getByRole("status")
      .filter({ hasText: "Mon, Jan 26" })
      .getByRole("link", { name: "See the job" })
      .click();
    await expect(office).toHaveURL(`/office/jobs/${secondJob}`);
  },
);

test("a plan On Hold for a payment we try again ourselves asks nothing of the Client", async ({
  page,
}) => {
  const { planId, firstJob } = await planStarted();
  await setClock(SUNDAY_10AM);
  // the bank payment for the fee is still clearing (ADR-0022)
  await failCharges("processing");
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${firstJob.id}`);
  await pageAction(page, "Skip this clean");
  await page
    .getByRole("alertdialog", { name: "Skip this clean?" })
    .getByRole("button", { name: "Skip this clean" })
    .click();
  await expect(page.getByText("Your clean is skipped")).toBeVisible();

  await page.goto(`/portal/plans/${planId}`);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Your cleaning plan is paused" }),
  ).toContainText(
    "We'll try again by ourselves, so there's nothing you need to do.",
  );
  await expectNothingNext(page);
  await expectNoPageAction(page, "Update your card");
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
    const held = (await openTile(page, "Money"))
      .getByRole("row")
      .filter({ hasText: "Collect what's owed to resume the plan" });
    await expect(held).toContainText("Cleaning plan paused: $50.46 unpaid");
    await held.click();
    // the plan is on its home's page
    await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("status").filter({ hasText: "Paused." }),
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
    await expectNoPageAction(page, "Change terms");
    await expectNoPageAction(page, "End plan");
    await expectAccessible(page);
  },
);
