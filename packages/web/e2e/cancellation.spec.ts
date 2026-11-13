import {
  acceptedJob,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  offerJob,
  setClock,
  signedInAs,
  signUp,
  test,
  addCleaner,
  expectNoPageAction,
  pageAction,
} from "./harness.ts";

// the API's clock is at 4am on Monday 5 January 2026 in New York. The Job
// here is Casey's Deep Clean at 9am on Monday the 12th, free to cancel until
// 9am on Sunday the 11th, exactly 24 hours before, included.
const MONDAY_9AM = "2026-01-12T14:00:00Z";
const SUNDAY_8_59AM = "2026-01-11T13:59:00Z";
const SUNDAY_9_01AM = "2026-01-11T14:01:00Z";
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
  const cory = await addCleaner("Cory Cleaner");
  const job = await acceptedJob({
    startsAt: MONDAY_9AM,
    officeEmail: olive.email,
  });
  await offerJob(job.id, cory.id, { confirmed: true });
  return job;
};

test(
  "a Client sees what cancelling costs, then cancels for free in the portal",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const job = await bookedJob();
    await signedInAs(page, casey.email);
    await page.goto(`/portal/jobs/${job.id}`);

    await expectAccessible(page);

    // what it costs, said in its dialog
    await pageAction(page, "Cancel clean");
    const dialog = page.getByRole("alertdialog", {
      name: "Cancel your clean?",
    });
    await expect(dialog).toContainText(
      /There's no charge for cancelling\. We'll refund your \$[\d.]+ deposit\./,
    );
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Cancel clean" }).click();

    await expect(page.getByText("Your clean is cancelled")).toBeVisible();
    const cancelled = page.getByRole("region", { name: "Cancelled" });
    await expect(cancelled).toContainText("There's no charge for cancelling.");
    await expect(cancelled).toContainText(/We've refunded \$[\d.]+ to your/);
    await expectNoPageAction(page, "Cancel clean");
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your clean is cancelled",
    );

    // and Home no longer leads with it
    await page.goto("/portal");
    await expect(page.getByText("Want us back?")).toBeVisible();

    // and Your cleans lists it as Cancelled, under Past
    await page
      .getByRole("link", { name: "Cleans", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL("/portal/cleans");
    await page.getByRole("tab", { name: /Past/ }).click();
    await expect(page.getByRole("row").first()).toContainText("Cancelled");
  },
);

test("a Client is told, not charged, when cancelling has become late since they looked", async ({
  page,
}) => {
  const job = await bookedJob();
  await setClock(SUNDAY_8_59AM);
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${job.id}`);
  await pageAction(page, "Cancel clean");
  const dialog = page.getByRole("alertdialog", { name: "Cancel your clean?" });
  await expect(dialog).toContainText("There's no charge");

  await setClock(SUNDAY_9_01AM);
  await dialog.getByRole("button", { name: "Cancel clean" }).click();
  await expect(dialog).toContainText(
    /Something changed just then\. Please check it and try again\./,
  );
  // the cost shown is now the late one
  await expect(dialog).toContainText(
    /Cancelling less than 24 hours before is a late cancellation, so your \$[\d.]+ deposit is kept as the fee\./,
  );

  await dialog.getByRole("button", { name: "Cancel clean" }).click();
  await expect(page.getByRole("region", { name: "Cancelled" })).toContainText(
    /Cancelling less than 24 hours before is a late cancellation, so your \$[\d.]+ deposit is kept as the fee/,
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

    await pageAction(page, "Couldn't get in");
    const dialog = page.getByRole("alertdialog", { name: "Couldn't get in?" });
    await expectAccessible(page);
    await dialog
      .getByRole("textbox", { name: "What happened?" })
      .fill("Nobody answered and the doorman had no key");
    await dialog.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Sent", { exact: true })).toBeVisible();
    const recorded = page.getByRole("region", { name: "Couldn't get in" });
    await expect(recorded).toContainText(
      '"Nobody answered and the doorman had no key"',
    );
    await expect(page.getByRole("button", { name: "Mark done" })).toHaveCount(
      0,
    );
    await expect(page.getByText(/\$/)).toHaveCount(0);

    const told = (await emailsTo(casey.email)).at(-1)!;
    expect(told.subject).toBe("We couldn't get in for your clean");
    expect(
      (await emailsTo(olive.email)).some((e) =>
        e.subject.startsWith("Couldn't get in at"),
      ),
    ).toBe(true);
  },
);

test(
  "Office Staff cancel a Job for Empire Cleaning, refunding the Deposit in full",
  { tag: ["@desktop"] },
  async ({ page, browser }) => {
    const job = await bookedJob();
    await setClock(SUNDAY_9_01AM);
    await signedInAs(page, olive.email);
    await page.goto(`/office/jobs/${job.id}`);

    await pageAction(page, "Cancel job");
    const dialog = page.getByRole("alertdialog", { name: "Cancel this job?" });
    await expect(dialog).toContainText(
      /The client asked\s*A late cancellation: the \$[\d.]+ deposit is kept as the fee\./,
    );
    await dialog.getByText("Empire Cleaning can't do it").click();
    await dialog
      .getByRole("textbox", { name: "Why? (the client sees this)" })
      .fill("Our crew is unwell.");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Cancel job" }).click();

    await expect(page.getByText("Job cancelled")).toBeVisible();
    await expect(
      page.getByText(
        "By Empire Cleaning, refunded in full. Our crew is unwell.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "History" })).toContainText(
      /Deposit of \$[\d.]+ charged.*\$[\d.]+ refunded/,
    );
    await expectNoPageAction(page, "Cancel job");

    const client = await (await browser.newContext()).newPage();
    await signedInAs(client, casey.email);
    await client.goto(`/portal/jobs/${job.id}`);
    await expect(
      client.getByRole("region", { name: "Cancelled" }),
    ).toContainText(
      "We're sorry, we had to cancel this clean. Our crew is unwell.",
    );
  },
);
