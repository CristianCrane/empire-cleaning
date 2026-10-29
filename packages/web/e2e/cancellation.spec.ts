import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  acceptedJob,
  createStaff,
  emailsTo,
  expect,
  offerPlace,
  setClock,
  setUsualWeek,
  signedInAs,
  signUp,
  test,
} from "./harness.ts";

// the API's clock is at 4am on Monday 5 January 2026 in New York. The Job
// here is Casey's Deep Clean at 9am on Monday the 12th, free to cancel until
// 9am on Sunday the 11th.
const MONDAY_9AM = "2026-01-12T14:00:00Z";
const SUNDAY_8_59AM = "2026-01-11T13:59:00Z";
const SUNDAY_9AM = "2026-01-11T14:00:00Z";
const MONDAY_9_30AM = "2026-01-12T14:30:00Z";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// Casey's Job, Quoted by Olive with a 25% Deposit, with Cory Confirmed on it
const bookedJob = async () => {
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
  });
  await offerPlace(job.id, cory.id, { confirmed: true });
  return job;
};

// once a dialog has finished opening: mid-animation, its colours are still
// fading in
const expectAccessible = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
};

test(
  "a Client sees what cancelling costs, then cancels for free in the portal",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const job = await bookedJob();
    await signedInAs(page, casey.email);
    await page.goto(`/portal/jobs/${job.id}`);

    const cancel = page.getByRole("region", { name: "Need to cancel?" });
    await expect(cancel).toContainText(
      /You can cancel for free until Sun, Jan 11, 9:00 AM, and we'll refund your \$[\d.]+ Deposit\./,
    );
    await expectAccessible(page);

    await cancel.getByRole("button", { name: "Cancel clean" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "Cancel your clean?",
    });
    await expect(dialog).toContainText(
      /There's no charge, and we'll refund your \$[\d.]+ Deposit\./,
    );
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Cancel clean" }).click();

    await expect(page.getByText("Your clean is cancelled")).toBeVisible();
    const cancelled = page.getByRole("region", { name: "Cancelled" });
    await expect(cancelled).toContainText(
      "There was no charge for cancelling.",
    );
    await expect(cancelled).toContainText(/We've refunded \$[\d.]+ to your/);
    await expect(
      page.getByRole("region", { name: "Need to cancel?" }),
    ).toHaveCount(0);
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your clean is cancelled",
    );

    // and it's gone from their upcoming Jobs
    await page.goto("/portal");
    await expect(
      page.getByRole("grid", { name: "Your upcoming Jobs" }),
    ).toHaveCount(0);
  },
);

test("a Client is told, not charged, when cancelling has become late since they looked", async ({
  page,
}) => {
  const job = await bookedJob();
  await setClock(SUNDAY_8_59AM);
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${job.id}`);
  await page
    .getByRole("region", { name: "Need to cancel?" })
    .getByRole("button", { name: "Cancel clean" })
    .click();
  const dialog = page.getByRole("alertdialog", { name: "Cancel your clean?" });
  await expect(dialog).toContainText("There's no charge");

  await setClock(SUNDAY_9AM);
  await dialog.getByRole("button", { name: "Cancel clean" }).click();
  await expect(dialog).toContainText(
    /less than 24 hours .* the \$[\d.]+ Deposit is kept as the fee\. Please check and confirm again\./,
  );
  // the cost shown is now the late one
  await expect(dialog).toContainText(
    /Your \$[\d.]+ Deposit is kept as the Late Cancellation fee\./,
  );

  await dialog.getByRole("button", { name: "Cancel clean" }).click();
  await expect(page.getByRole("region", { name: "Cancelled" })).toContainText(
    /cancelled less than 24 hours before it was due, so your \$[\d.]+ Deposit was kept/,
  );
});

test(
  "a Cleaner records No Access on their phone, never seeing a price",
  { tag: ["@smoke"] },
  async ({ page }) => {
    const job = await bookedJob();
    await setClock(MONDAY_9_30AM);
    await signedInAs(page, "cory@example.com");
    await page.goto(`/cleaner/jobs/${job.id}`);

    const cantGetIn = page.getByRole("region", { name: "Can't get in?" });
    await cantGetIn.getByRole("button", { name: "Record No Access" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Record No Access?" });
    await expectAccessible(page);
    await dialog
      .getByRole("textbox", { name: "What happened?" })
      .fill("Nobody answered and the doorman had no key");
    await dialog.getByRole("button", { name: "Record No Access" }).click();

    await expect(page.getByText("No Access recorded")).toBeVisible();
    const recorded = page.getByRole("region", { name: "No Access" });
    await expect(recorded).toContainText(
      '"Nobody answered and the doorman had no key"',
    );
    await expect(
      page.getByRole("region", { name: "Complete this Job" }),
    ).toHaveCount(0);
    await expect(page.getByText(/\$/)).toHaveCount(0);

    const told = (await emailsTo(casey.email)).at(-1)!;
    expect(told.subject).toBe("We couldn't get in for your clean");
    expect(
      (await emailsTo(olive.email)).some((e) =>
        e.subject.startsWith("No Access at"),
      ),
    ).toBe(true);
  },
);

test(
  "Office Staff cancel a Job for Empire Cleaning, refunding the Deposit in full",
  { tag: ["@desktop"] },
  async ({ page, browser }) => {
    const job = await bookedJob();
    await setClock(SUNDAY_9AM);
    await signedInAs(page, olive.email);
    await page.goto(`/office/jobs/${job.id}`);

    // an icon in the Job's action bar, named in a tooltip
    const actions = page.getByRole("toolbar", { name: "Job actions" });
    const cancelJob = actions.getByRole("button", { name: "Cancel Job" });
    // a mouse moves before it rests on anything
    await actions.hover();
    await cancelJob.hover();
    await expect(page.getByRole("tooltip")).toHaveText("Cancel Job");
    await cancelJob.click();
    const dialog = page.getByRole("alertdialog", { name: "Cancel this Job?" });
    await expect(dialog).toContainText(
      /The Client asked\s*It's a Late Cancellation: the \$[\d.]+ Deposit is kept as the fee\./,
    );
    await dialog.getByText("Empire Cleaning can't do it").click();
    await dialog
      .getByRole("textbox", { name: "Why? (told to the Client)" })
      .fill("Our crew is unwell.");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Cancel Job" }).click();

    await expect(page.getByText("Job cancelled")).toBeVisible();
    await expect(
      page.getByText(
        "By Empire Cleaning, refunded in full. Our crew is unwell.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "History" })).toContainText(
      /Deposit of \$[\d.]+ charged.*\$[\d.]+ refunded/,
    );
    await expect(page.getByRole("button", { name: "Cancel Job" })).toHaveCount(
      0,
    );

    const client = await (await browser.newContext()).newPage();
    await signedInAs(client, casey.email);
    await client.goto(`/portal/jobs/${job.id}`);
    await expect(
      client.getByRole("region", { name: "Cancelled" }),
    ).toContainText(
      "We're sorry: we had to cancel this clean. Our crew is unwell.",
    );
  },
);
