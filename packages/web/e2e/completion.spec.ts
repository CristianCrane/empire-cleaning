import AxeBuilder from "@axe-core/playwright";
import type { Browser, Page } from "@playwright/test";
import {
  acceptedJob,
  completeJob,
  createStaff,
  emailsTo,
  expect,
  failCharges,
  offerPlace,
  setClock,
  setUsualWeek,
  signedInAs,
  signUp,
  test,
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
const jobUnderway = async () => {
  await createStaff(olive);
  await signUp(olive.email);
  const cory = (await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  })) as { id: string };
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  const job = await acceptedJob({
    startsAt: MONDAY_9AM,
    officeEmail: olive.email,
    addOns: ["Inside the oven"],
  });
  await offerPlace(job.id, cory.id, { confirmed: true });
  await setClock(MONDAY_11AM);
  return { job, cory };
};

const pathOfLatestEmail = async (to: string, subject: string) => {
  const sent = (await emailsTo(to)).findLast((e) => e.subject === subject);
  return new URL(sent!.text.match(/https?:\/\/\S+/)![0]).pathname;
};

const asCasey = async (browser: Browser) => {
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  return client;
};

const expectAccessible = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
};

test(
  "a Cleaner completes a Job on their phone, reporting what was different, and never sees a price",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await jobUnderway();
    await signedInAs(page, "cory@example.com");
    await expect(page).toHaveURL("/cleaner");

    const today = page.getByRole("grid", { name: "Today's Jobs" });
    await today.getByRole("row").click();
    const form = page.getByRole("region", { name: "Complete this Job" });
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
      .getByRole("textbox", { name: "Extra hours, all of you together" })
      .fill("1");
    await form
      .getByRole("textbox", { name: "Extra hours, all of you together" })
      .blur();
    await form
      .getByRole("textbox", { name: "What took longer?" })
      .fill("Heavy grease in the kitchen");
    await expect(page.getByText(/\$/)).toHaveCount(0);
    await form.getByRole("button", { name: "Mark Completed" }).click();

    await expect(page.getByText("Job Completed")).toBeVisible();
    const completed = page.getByRole("region", { name: "Completed" });
    await expect(completed).toContainText("Heavy");
    await expect(completed).toContainText(
      "Inside the oven, not done: The oven was in use",
    );
    await expect(completed).toContainText(
      "Inside the fridge, done on the day: Casey asked on the day",
    );
    await expect(completed).toContainText(
      "1 extra hour: Heavy grease in the kitchen",
    );
    await expect(page.getByText(/\$/)).toHaveCount(0);

    // the Client's receipt goes at once, with the oven taken off
    const receipt = (await emailsTo(casey.email)).at(-1)!;
    expect(receipt.subject).toBe("Your clean is done: your receipt");
    expect(receipt.text).toContain("Inside the oven, not done: -$29.94");
  },
);

test(
  "the Office proposes an extra the Cleaner reported, and the Client approves it in the portal",
  { tag: ["@desktop"] },
  async ({ page, browser }) => {
    const { job, cory } = await jobUnderway();
    await completeJob(job.id, cory.id, {
      condition: "moderate",
      reports: [{ kind: "extra_time", hours: 1, reason: "Heavy grease" }],
    });
    await signedInAs(page, olive.email);

    const attention = page.getByRole("grid", { name: "Needs attention" });
    await attention
      .getByRole("row")
      .filter({ hasText: "1 extra to review" })
      .click();
    const adjustments = page.getByRole("region", { name: "Adjustments" });
    await expect(adjustments).toContainText("1 extra hour: $59.88");
    await expect(adjustments).toContainText("To review");
    await adjustments
      .getByRole("button", { name: "Review 1 extra hour" })
      .click();
    const review = page.getByRole("dialog");
    await expect(review).toContainText("$55.00 before tax");
    await review.getByRole("button", { name: "Propose to the Client" }).click();
    await expect(page.getByText("Proposed to the Client")).toBeVisible();
    await expect(adjustments).toContainText("Waiting on the Client");

    const client = await asCasey(browser);
    await client.goto(
      await pathOfLatestEmail(
        casey.email,
        "Please approve extra work on your clean",
      ),
    );
    const proposal = client.getByRole("region", {
      name: "Please approve extra work",
    });
    await expect(proposal).toContainText("1 extra hour");
    await expect(proposal).toContainText("$59.88");
    await expectAccessible(client);
    await proposal.getByRole("button", { name: "Approve $59.88" }).click();

    await expect(client.getByText("Approved")).toBeVisible();
    await expect(proposal).toBeHidden();
    const receipt = client.getByRole("region", { name: "Your receipt" });
    await expect(receipt).toContainText("1 extra hour");
    await expect(receipt).toContainText("$59.88");

    await page.reload();
    await expect(adjustments).toContainText("Approved");
  },
);

test("a Job that couldn't be charged is Unpaid until the Client saves a new card", async ({
  page,
  browser,
}) => {
  const { job, cory } = await jobUnderway();
  await failCharges("card_declined");
  await completeJob(job.id, cory.id, { condition: "moderate", reports: [] });
  await failCharges(null);

  await signedInAs(page, olive.email);
  const attention = page.getByRole("grid", { name: "Needs attention" });
  await expect(
    attention.getByRole("row").filter({ hasText: "Collect the Balance" }),
  ).toBeVisible();

  const client = await asCasey(browser);
  await client.goto(
    await pathOfLatestEmail(casey.email, "We couldn't take your payment"),
  );
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Deep Clean",
  );
  await expect(
    client.getByRole("region", { name: "Payment needed" }),
  ).toBeVisible();
  await client.getByRole("link", { name: "Update Payment Method" }).click();
  await client.getByRole("button", { name: "Save card" }).click();
  await expect(client.getByText("Card saved")).toBeVisible();

  await client.goto(`/portal/jobs/${job.id}`);
  await expect(
    client.getByRole("region", { name: "Payment needed" }),
  ).toBeHidden();
  await client.goto("/portal");
  await expect(
    client.getByRole("grid", { name: "Your past Jobs" }).getByRole("row"),
  ).toContainText("Done");

  await page.reload();
  await expect(
    attention.getByRole("row").filter({ hasText: "Unpaid" }),
  ).toBeHidden();
});

test("Office Staff correct the Condition and undo a completion made by mistake", async ({
  page,
}) => {
  const { job, cory } = await jobUnderway();
  await completeJob(job.id, cory.id, { condition: "heavy", reports: [] });
  await signedInAs(page, olive.email);
  await page.goto(`/office/jobs/${job.id}`);

  const completed = page.getByRole("region", { name: "Job" });
  await completed.getByRole("button", { name: /Condition reported/ }).click();
  await page.getByRole("option", { name: "Light" }).click();
  await expect(page.getByText("Condition corrected")).toBeVisible();

  await completed.getByRole("button", { name: "Undo completion" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Undo completion" })
    .click();

  await expect(page.getByText("Completion undone")).toBeVisible();
  await expect(
    completed.getByRole("heading", { name: "How it went" }),
  ).toBeHidden();
  await expect(page.getByText("Assigned", { exact: true })).toBeVisible();
  expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
    "A correction to your clean",
  );
});
