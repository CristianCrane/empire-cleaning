import type { Browser } from "@playwright/test";
import {
  acceptedJob,
  completeJob,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  expectNextStep,
  failCharges,
  offerJob,
  setClock,
  signedInAs,
  signUp,
  test,
  addCleaner,
  linkIn,
  expectNothingNext,
  pageAction,
  openTile,
  requireApproval,
  saveACard,
  savedCardsAsk,
  titleBadge,
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
    ).toContainText([/^Price so far, paid by/]);
    await extraTime.click();
    const review = page.getByRole("dialog", { name: "More time" });
    await expect(review).toContainText('"Heavy grease"');
    await expect(review).toContainText("$55.00 before tax");
    await review.getByRole("button", { name: "Send to the client" }).click();
    await expect(
      page.getByText("Sent to the client", { exact: true }),
    ).toBeVisible();
    await expect(review).toBeHidden();
    await expect(extraTime).toContainText("Waiting on the client");

    const client = await asCasey(browser);
    await client.goto(
      await linkIn(casey.email, "Please approve a price change on your clean"),
    );
    // an alert above the clean says why; answering it is the page's next
    // step, in a dialog titled by what it's for
    const proposal = client
      .getByRole("status")
      .filter({ hasText: "The crew did more than was quoted" });
    await expect(proposal).toHaveText(
      "The crew did more than was quoted: 1 more hour, $59.88. Please answer by Jan 19, 2026.",
    );
    // the badge says what waits on them, in the Cleans list's words, not Done
    await expect(titleBadge(client, "Needs your OK")).toBeVisible();
    await expectAccessible(client);
    await expectNextStep(client, "Review the price change");
    await expect(proposal.getByRole("button")).toHaveCount(0);
    await pageAction(client, "Review the price change");
    const dialog = client.getByRole("dialog", {
      name: "Price change: 1 more hour",
    });
    await expect(dialog).toContainText('"Heavy grease"');
    await expectAccessible(client);
    await dialog.getByRole("button", { name: "Approve $59.88" }).click();

    await expect(client.getByText("Approved")).toBeVisible();
    await expect(proposal).toBeHidden();
    await expect(titleBadge(client, "Done")).toBeVisible();
    const receipt = client.getByRole("region", { name: "Your receipt" });
    await expect(receipt).toContainText("1 more hour");
    await expect(receipt).toContainText("$59.88");

    await page.reload();
    await expect(adjustments).toContainText("Approved");
    // each step of it in History, who reported it first (#493)
    const history = page.getByRole("region", { name: "History" });
    await expect(history).toContainText(
      "Cory Cleaner reported a price change: More time",
    );
    await expect(history).toContainText(
      "Price change sent to the client: More time",
    );
    await expect(history).toContainText(
      "The client approved the price change: More time",
    );
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
      /^Its payment didn't go through.*\. We've emailed the client to update their card\. Once they do, we try the payment again\.$/,
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "History" })).toContainText(
    /Balance of \$[\d.,]+ didn't go through/,
  );
  await expectNextStep(page, "Try the payment again");

  const client = await asCasey(browser);
  await client.goto(await linkIn(casey.email, "We couldn't take your payment"));
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Deep Clean",
  );
  // the alert says why; putting it right is the page's next step
  const needed = client
    .getByRole("alert")
    .filter({ hasText: "Payment needed" });
  await expect(needed).toBeVisible();
  await expect(needed.getByRole("link")).toHaveCount(0);
  await expectNextStep(client, "Update your card");
  await pageAction(client, "Update your card");
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

// #534 Q7: Casey's card is one whose bank asks them to approve each
// payment, so the balance taken as the clean's done is stopped, for them
// to approve on its page
const doneOnACardThatAsks = async () => {
  const { job, cory } = await jobUnderway();
  await savedCardsAsk();
  await completeJob(job.id, cory.id, { condition: "moderate", reports: [] });
  return job;
};
const approvalAsked =
  /^Your bank wants you to approve this payment\. None of it has been taken from your Test card ending 4242 yet\.$/;

test("a payment the Client's bank wants them to approve is next on their Home", async ({
  page,
}) => {
  const job = await doneOnACardThatAsks();
  await signedInAs(page, casey.email);
  await page.goto("/portal/payments");
  const owed = page.getByRole("region", { name: "To approve" });
  await expect(owed).toContainText("Your Jan 12 clean");
  // why, amber, as it's theirs to do and no failure
  await expect(
    page.getByText(
      "Your bank wants you to approve your clean's payment. None of it has been taken yet.",
    ),
  ).toBeVisible();
  await expect(
    owed.getByRole("link", { name: "Approve payment" }),
  ).toHaveAttribute("href", `/portal/jobs/${job.id}`);

  await page.goto("/portal");
  await expect(
    page.getByText(/^Your bank wants you to approve your clean's payment/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Approve payment" }),
  ).toHaveAttribute("href", `/portal/jobs/${job.id}`);
});

// #534 Q7 made the Client's retry of a Job's payment one made with them
// there, which their bank may ask them to approve: the server answers 200
// with the approval's secret, nothing taken yet. The card page's "Try this
// card again" read no body and said "Payment taken" with nothing taken
// (critical-review-payment-truth.md C10): it runs the approval there
test("a Client trying their card again, whose bank now asks them to approve it, approves it there, or is told it wasn't taken", async ({
  page,
}) => {
  const { job, cory } = await jobUnderway();
  await failCharges();
  await completeJob(job.id, cory.id, { condition: "moderate", reports: [] });
  // the money's there now, but their bank asks them to approve each payment
  await failCharges(null);
  await savedCardsAsk();

  await signedInAs(page, casey.email);
  await page.goto("/portal/payment-method");
  const needed = page.getByRole("alert").filter({ hasText: "Payment needed" });
  const tryAgain = needed.getByRole("button", { name: "Try this card again" });

  // turned down at their bank: nothing taken, and the page says so
  await requireApproval("refused");
  await tryAgain.click();
  await expect(
    page.getByText(
      "Your payment wasn't approved, so nothing was taken. Please try again, or use another card.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Payment taken")).toHaveCount(0);
  await expect(needed).toBeVisible();

  // approved there: taken, and the clean is paid
  await requireApproval(null);
  await tryAgain.click();
  await expect(page.getByText("Payment taken")).toBeVisible();
  await expect(needed).toHaveCount(0);
  await page.goto(`/portal/jobs/${job.id}`);
  await expect(titleBadge(page, "Done")).toBeVisible();
});

// critical-review-payment-truth.md C11: "Try this card again" tried each
// Unpaid clean in turn, so one approved and taken, then the next turned
// down at their bank, read as nothing taken. It tries the first, named with
// its amount, and the page then asks about the next
test("a Client with two cleans to pay tries their card for the first, then the second alone, and turned down it takes nothing more", async ({
  page,
}) => {
  const FRIDAY_9AM = "2026-01-09T14:00:00Z";
  await createStaff(olive);
  await signUp(olive.email);
  const cory = await addCleaner("Cory Cleaner");
  const monday = await acceptedJob({
    startsAt: MONDAY_9AM,
    officeEmail: olive.email,
    addOns: ["Inside the oven"],
  });
  const friday = await acceptedJob({
    startsAt: FRIDAY_9AM,
    officeEmail: olive.email,
  });
  await offerJob(monday.id, cory.id, { confirmed: true });
  await offerJob(friday.id, cory.id, { confirmed: true });
  await setClock(MONDAY_11AM);
  await failCharges();
  await completeJob(friday.id, cory.id, { condition: "moderate", reports: [] });
  await completeJob(monday.id, cory.id, { condition: "moderate", reports: [] });
  // the money's there now, but their bank asks them to approve each payment
  await failCharges(null);
  await savedCardsAsk();

  await signedInAs(page, casey.email);
  await page.goto("/portal/payment-method");
  const needed = page.getByRole("alert").filter({ hasText: "Payment needed" });
  await expect(needed).toContainText("1 more clean comes after it.");

  let finishes = 0;
  await page.route("**/balance/finish", async (route) => {
    finishes += 1;
    if (finishes === 2) await requireApproval("refused");
    await route.continue();
  });
  const paid = async () => {
    const done: string[] = [];
    for (const id of [monday.id, friday.id]) {
      const job = await page.context().newPage();
      await job.goto(`/portal/jobs/${id}`);
      await expect(job.getByRole("heading", { level: 1 })).toBeVisible();
      if ((await titleBadge(job, "Done").count()) > 0) done.push(id);
      await job.close();
    }
    return done;
  };

  // the first, approved: taken, and the page asks about the other alone
  await needed.getByRole("button", { name: "Try this card again" }).click();
  await expect(page.getByText("Payment taken")).toBeVisible();
  expect(finishes).toBe(1);
  expect(await paid()).toHaveLength(1);
  await expect(needed).not.toContainText("more clean");

  // the second, turned down at their bank: nothing more taken, and it says so
  await needed.getByRole("button", { name: "Try this card again" }).click();
  await expect(
    page.getByText(
      "Your payment wasn't approved, so nothing was taken. Please try again, or use another card.",
    ),
  ).toBeVisible();
  expect(finishes).toBe(2);
  expect(await paid()).toHaveLength(1);
});

test("the email about a payment the Client's bank wants them to approve opens their clean, to approve it there", async ({
  page,
}) => {
  await doneOnACardThatAsks();
  await signedInAs(page, casey.email);
  await page.goto(await linkIn(casey.email, "Please approve your payment"));

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Deep Clean",
  );
  await expect(titleBadge(page, "Needs approval")).toBeVisible();
  // theirs to do and no failure: amber, and the page's next step
  await expect(page.getByText(approvalAsked)).toBeVisible();
  await expectNextStep(page, "Approve payment");
  await expectAccessible(page);
});

test("a payment the Client's bank wants them to approve, turned down there, takes nothing, and approving it pays", async ({
  page,
}) => {
  const job = await doneOnACardThatAsks();
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${job.id}`);
  await expect(page.getByText(approvalAsked)).toBeVisible();

  await requireApproval("refused");
  await pageAction(page, "Approve payment");
  await expect(
    page.getByText(
      /^The payment wasn't approved\. None of it was taken\. Please try again\.$/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Use a different card" }),
  ).toBeVisible();
  // nothing waits on their bank now: it's Unpaid, and the press is a fresh
  // payment (#534's UX review U1)
  await expect(titleBadge(page, "Unpaid")).toBeVisible();
  await expectNextStep(page, "Try again");

  await requireApproval(null);
  await pageAction(page, "Try again");
  await expect(titleBadge(page, "Done")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your receipt" }),
  ).toContainText("Charged to your Test card ending 4242.");
  await expect(page.getByText(/^The payment wasn't approved/)).toBeHidden();
  await expect(page.getByText(approvalAsked)).toBeHidden();
});

test("Office Staff see a Job's payment is the Client's to approve, emailed so, with nothing to try again", async ({
  page,
}) => {
  const job = await doneOnACardThatAsks();
  await signedInAs(page, olive.email);
  const attention = await openTile(page, "Money");
  const row = attention
    .getByRole("row")
    .filter({ hasText: "Client to approve" });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(`/office/jobs/${job.id}`);

  await expect(titleBadge(page, "Client to approve")).toBeVisible();
  await expect(
    page.getByText(
      /^Casey's bank wants them to approve the payment\. None of it was taken\. We've emailed them to approve it on their clean's page\.$/,
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "History" })).toContainText(
    /Balance of \$[\d.,]+ needs Casey's approval/,
  );
  await expectNothingNext(page);
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
  await expect(page.getByRole("region", { name: "History" })).toContainText(
    "Price change dismissed: More time",
  );

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
  await expect(completed).toContainText("HeavyHow dirty it was");
  await pageAction(page, "Correct the condition");
  const correct = page.getByRole("dialog", { name: "Correct the condition" });
  await correct.getByText("Light", { exact: true }).click();
  await correct.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Condition corrected")).toBeVisible();
  await expect(completed).toContainText("LightHow dirty it was");
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
