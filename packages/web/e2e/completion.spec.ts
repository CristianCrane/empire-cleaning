import type { Browser } from "@playwright/test";
import {
  acceptedJob,
  completeJob,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  failCharges,
  offerJob,
  setClock,
  signedInAs,
  signUp,
  test,
  addCleaner,
  linkIn,
  expectNextStep,
  expectNothingNext,
  pageAction,
  openTile,
  saveACard,
} from "./harness.ts";

// the API's clock is at 4am on Monday 5 January 2026 in New York. The Jobs
// here are Casey's Deep Clean at 9am on Monday the 12th, with "Inside the
// oven", and tests move the clock to 11am that day, after it has started.
const MONDAY_9AM = "2026-01-12T14:00:00Z";
const MONDAY_11AM = "2026-01-12T16:00:00Z";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// Casey's Job, Quoted by Olive, with Cory Confirmed on it, and the clock
// moved to after it starts
const jobUnderway = async ({ wantsRegularService = true } = {}) => {
  await createStaff(olive);
  await signUp(olive.email);
  const cory = await addCleaner("Cory Cleaner");
  const job = await acceptedJob({
    startsAt: MONDAY_9AM,
    officeEmail: olive.email,
    addOns: ["Inside the oven"],
    wantsRegularService,
  });
  await offerJob(job.id, cory.id, { confirmed: true });
  await setClock(MONDAY_11AM);
  return { job, cory };
};

const asCasey = async (browser: Browser) => {
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  return client;
};

test(
  "a Cleaner completes a Job on their phone, reporting what was different, and never sees a price",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await jobUnderway();
    await signedInAs(page, "cory@example.com");
    await expect(page).toHaveURL("/cleaner");

    // the Job under way leads Your Jobs; Mark done is its next step
    await page
      .getByRole("region", { name: "Now" })
      .getByRole("button", { name: "Open job" })
      .click();
    await pageAction(page, "Mark done");
    const form = page.getByRole("dialog", { name: "Mark this job done" });
    await expect(form).toBeVisible();
    await expectAccessible(page);

    await form.getByText("Heavy", { exact: true }).click();
    await form.getByText("Inside the oven", { exact: true }).click();
    await form
      .getByRole("textbox", { name: /Why not\? \(Inside the oven\)/ })
      .fill("The oven was in use");
    await form.getByText("Inside the fridge", { exact: true }).click();
    await form
      .getByRole("textbox", { name: /Why\? .* \(Inside the fridge\)/ })
      .fill("Casey asked on the day");
    await form
      .getByRole("textbox", { name: "More hours", exact: true })
      .fill("1");
    await form.getByRole("textbox", { name: "More hours", exact: true }).blur();
    await form
      .getByRole("textbox", { name: "What took longer?" })
      .fill("Heavy grease in the kitchen");
    await expect(page.getByText(/\$/)).toHaveCount(0);
    await form.getByRole("button", { name: "Mark done" }).click();

    await expect(page.getByText("Job marked done")).toBeVisible();
    const completed = page.getByRole("region", { name: "Done" });
    await expect(completed).toContainText("Heavy");
    await expect(completed).toContainText(
      "Inside the oven, not done: The oven was in use",
    );
    await expect(completed).toContainText(
      "Inside the fridge, done on the day: Casey asked on the day",
    );
    await expect(completed).toContainText(
      "1 more hour: Heavy grease in the kitchen",
    );
    await expect(page.getByText(/\$/)).toHaveCount(0);

    // the Client's receipt goes at once, with the oven taken off at what it
    // added to the quoted price
    const receipt = (await emailsTo(casey.email)).at(-1)!;
    expect(receipt.subject).toBe("Your clean is done: your receipt");
    expect(receipt.text).toContain("Inside the oven, not done: -$30.49");
  },
);

test("on a short phone, Mark done's sheet opens with its buttons in view, its last question running past them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 667 });
  // the sheet lists every extra: the Job's, to say one wasn't done, and the
  // rest, to say one was done on the day
  await jobUnderway();
  await signedInAs(page, "cory@example.com");
  await page
    .getByRole("region", { name: "Now" })
    .getByRole("button", { name: "Open job" })
    .click();
  await pageAction(page, "Mark done");
  const form = page.getByRole("dialog", { name: "Mark this job done" });
  await expect(form).toBeVisible();

  // the sheet runs past the screen: its last question isn't all in view
  await expect(
    form.getByRole("textbox", { name: "More hours", exact: true }),
  ).not.toBeInViewport({ ratio: 1 });
  await expect(form.getByRole("button", { name: "Go back" })).toBeInViewport({
    ratio: 1,
  });
  await expect(form.getByRole("button", { name: "Mark done" })).toBeInViewport({
    ratio: 1,
  });
});

test(
  "the Office proposes a price change the Cleaner reported, and the Client approves it in the portal",
  { tag: ["@desktop"] },
  async ({ page, browser }) => {
    const { job, cory } = await jobUnderway();
    await completeJob(job.id, cory.id, {
      condition: "moderate",
      reports: [{ kind: "extra_time", hours: 1, reason: "Heavy grease" }],
    });
    await signedInAs(page, olive.email);

    const attention = await openTile(page, "Jobs");
    await attention
      .getByRole("row")
      .filter({ hasText: "1 price change to review" })
      .click();
    const adjustments = page.getByRole("region", { name: "Price changes" });
    const extraTime = adjustments.getByRole("row", { name: /More time/ });
    await expect(extraTime).toContainText("+1 h");
    await expect(extraTime).toContainText("+$59.88");
    await expect(extraTime).toContainText("To review");
    // the review is the step: a plan to offer waits, unsaid, behind it
    await expectNextStep(page, "Review");
    await expect(page.getByText("Casey wants regular visits.")).toHaveCount(0);
    // paid in full, but not the last word while the change is open (#493)
    await expect(
      page.getByRole("region", { name: "Money" }).getByRole("definition"),
    ).toContainText([/Total without the price change still open, paid by/]);
    await extraTime.click();
    const review = page.getByRole("dialog", { name: "More time" });
    await expect(review).toContainText('"Heavy grease"');
    await expect(review).toContainText("$55.00 before tax");
    await review.getByRole("button", { name: "Send to the client" }).click();
    await expect(page.getByText("Sent to the client")).toBeVisible();
    await expect(review).toBeHidden();
    await expect(extraTime).toContainText("Waiting on the client");

    const client = await asCasey(browser);
    await client.goto(
      await linkIn(casey.email, "Please approve a price change on your clean"),
    );
    // an alert above the clean, answered in a dialog
    const proposal = client
      .getByRole("status")
      .filter({ hasText: "Please approve a price change" });
    await expect(proposal).toContainText("1 more hour, $59.88");
    // the badge says what waits on them, in the Cleans list's words, not Done
    const titleLine = client
      .getByRole("heading", { level: 1 })
      .locator("xpath=..");
    await expect(titleLine).toHaveText(/Needs your OK$/);
    await expectAccessible(client);
    await proposal.getByRole("button", { name: "Review" }).click();
    const dialog = client.getByRole("dialog", {
      name: "Please approve a price change",
    });
    await expect(dialog).toContainText('"Heavy grease"');
    await expectAccessible(client);
    await dialog.getByRole("button", { name: "Approve $59.88" }).click();

    await expect(client.getByText("Approved")).toBeVisible();
    await expect(proposal).toBeHidden();
    await expect(titleLine).toHaveText(/Done$/);
    const receipt = client.getByRole("region", { name: "Your receipt" });
    await expect(receipt).toContainText("1 more hour");
    await expect(receipt).toContainText("$59.88");

    await page.reload();
    await expect(adjustments).toContainText("Approved");
  },
);

test("Today's Money tile shows what's owed as its number", async ({ page }) => {
  const { job, cory } = await jobUnderway();
  await failCharges("card_declined");
  await completeJob(job.id, cory.id, { condition: "moderate", reports: [] });
  await failCharges(null);

  await signedInAs(page, olive.email);
  // what's owed as its number, how many to do under it
  await expect(page.getByRole("button", { name: /^Money/ })).toHaveText(
    /^Money\s*\$[\d,]+\.\d\d\s*1 to do$/,
  );
});

test("a Job that couldn't be charged is Unpaid until the Client saves a new card", async ({
  page,
  browser,
}) => {
  const { job, cory } = await jobUnderway();
  await failCharges("card_declined");
  await completeJob(job.id, cory.id, { condition: "moderate", reports: [] });
  await failCharges(null);

  await signedInAs(page, olive.email);
  const attention = await openTile(page, "Money");
  await expect(
    attention.getByRole("row").filter({ hasText: "Collect the balance" }),
  ).toBeVisible();
  // the Job says what puts it right, when it failed, and leads with the retry
  await page.goto(`/office/jobs/${job.id}`);
  await expect(
    page.getByText(
      /^Its payment didn't go through.*\. We've emailed the client to update their card\. Saving it tries the payment again\.$/,
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "History" })).toContainText(
    /Payment of \$[\d.,]+ didn't go through/,
  );
  await expectNextStep(page, "Try the payment again");

  const client = await asCasey(browser);
  await client.goto(await linkIn(casey.email, "We couldn't take your payment"));
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Deep Clean",
  );
  await expect(
    client.getByRole("alert").filter({ hasText: "Payment needed" }),
  ).toBeVisible();
  await client.getByRole("link", { name: "Update your card" }).click();
  await saveACard(client).save.click();
  await expect(client.getByText("Card saved")).toBeVisible();

  await client.goto(`/portal/jobs/${job.id}`);
  // loaded, so the alert's absence counts (the testing skill, "Every check can fail")
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Deep Clean",
  );
  await expect(
    client.getByRole("alert").filter({ hasText: "Payment needed" }),
  ).toBeHidden();
  // nothing left to pay on their Home
  await client.goto("/portal");
  await expect(client.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(client.getByText(/^We couldn't take payment/)).toHaveCount(0);

  // nothing owed is left for the Office: Money counts none
  await page.goto("/office");
  await expect(page.getByRole("button", { name: /^Money/ })).toBeDisabled();
});

test("Office Staff remove an Adjustment from its own dialog, confirming in the same dialog", async ({
  page,
}) => {
  const { job, cory } = await jobUnderway();
  await completeJob(job.id, cory.id, {
    condition: "moderate",
    reports: [{ kind: "extra_time", hours: 1, reason: "Heavy grease" }],
  });
  await signedInAs(page, olive.email);
  await page.goto(`/office/jobs/${job.id}`);

  const adjustments = page.getByRole("region", { name: "Price changes" });
  await adjustments.getByRole("row", { name: /More time/ }).click();
  const dialog = page.getByRole("dialog", { name: "More time" });
  await dialog.getByRole("button", { name: "Dismiss" }).click();
  await expect(
    adjustments.getByRole("row", { name: /More time/ }),
  ).toContainText("Dismissed");

  await adjustments.getByRole("row", { name: /More time/ }).click();
  await page
    .getByRole("dialog", { name: "More time" })
    .getByRole("button", { name: "Remove" })
    .click();
  // the same dialog asks again: never a dialog on a dialog
  const confirm = page.getByRole("alertdialog", {
    name: "Remove More time?",
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await confirm.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Price change removed")).toBeVisible();
  // with none left, Money has no price changes to show
  await expect(adjustments).toHaveCount(0);
});

test("Office Staff correct the Condition and undo a completion made by mistake", async ({
  page,
}) => {
  // no regular visits asked for, so no plan to offer once it's done
  const { job, cory } = await jobUnderway({ wantsRegularService: false });
  await completeJob(job.id, cory.id, { condition: "heavy", reports: [] });
  await signedInAs(page, olive.email);
  await page.goto(`/office/jobs/${job.id}`);

  // the condition the cleaner found, a fact; corrected from the header
  const completed = page.getByRole("region", { name: "How it went" });
  await expect(completed).toContainText("HeavyHow dirty the home was");
  await pageAction(page, "Correct the condition");
  const correct = page.getByRole("dialog", { name: "Correct the condition" });
  await correct.getByText("Light", { exact: true }).click();
  await correct.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Condition corrected")).toBeVisible();
  await expect(completed).toContainText("LightHow dirty the home was");
  await expect(page.getByText("Done", { exact: true })).toBeVisible();
  // done, paid, nothing waiting: correcting it is no next step
  await expectNothingNext(page);

  await pageAction(page, "Mark not done");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Mark not done" })
    .click();

  await expect(page.getByText("Marked not done")).toBeVisible();
  await expect(completed).toHaveCount(0);
  // booked again, staffed, before its day: the usual case, no badge
  await expect(page.getByRole("region", { name: "Crew" })).toBeVisible();
  await expect(page.getByText("Done", { exact: true })).toHaveCount(0);
  expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
    "A correction to your clean",
  );
});
