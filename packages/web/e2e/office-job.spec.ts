import type { Page } from "@playwright/test";
import {
  acceptedJob,
  addCleaner,
  billedWeek,
  completedFirstClean,
  completeJob,
  createStaff,
  expect,
  expectAccessible,
  failCharges,
  offerJob,
  pageAction,
  recordNoAccess,
  requestReschedule,
  setClock,
  signedInAs,
  signUp,
  test,
} from "./harness.ts";

// The Office's Job at each moment Jen opens it (#493): a test each, ending
// on the page as she'd open it. The API's clock is at 4am on Monday 5
// January 2026 in New York; Casey's Deep Clean is at 9am on Monday the 12th.
const MONDAY_9AM = "2026-01-12T14:00:00Z";
const MONDAY_10AM = "2026-01-12T15:00:00Z";
const MONDAY_11AM = "2026-01-12T16:00:00Z";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};

// Casey's Job, Quoted by Olive with a 25% Deposit, with Cory Confirmed on it
const bookedJob = async (
  job: { crewSize?: number; addOns?: string[] } = {},
) => {
  await createStaff(olive);
  await signUp(olive.email);
  const cory = await addCleaner("Cory Cleaner");
  const { id } = await acceptedJob({
    startsAt: MONDAY_9AM,
    officeEmail: olive.email,
    ...job,
  });
  await offerJob(id, cory.id, { confirmed: true });
  return { id, cory };
};

// the Job's page as Olive opens it, settled
const openJob = async (page: Page, id: string) => {
  await signedInAs(page, olive.email);
  await page.goto(`/office/jobs/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
};

test.describe("the Office's Job", { tag: "@desktop" }, () => {
  test("short of a cleaner, with extras", async ({ page }) => {
    // free that day, so the crew of two fits
    await addCleaner("Dee Cleaner");
    const job = await bookedJob({
      crewSize: 2,
      addOns: ["Inside the oven", "Inside the fridge"],
    });
    await openJob(page, job.id);

    await expectAccessible(page);
  });

  test("staffed, before its day", async ({ page }) => {
    const job = await bookedJob();
    await openJob(page, job.id);

    await expectAccessible(page);
  });

  test("a move the client asked for", async ({ page }) => {
    const job = await bookedJob();
    await requestReschedule(job.id, { date: "2026-01-14", time: "10:00" });
    await openJob(page, job.id);

    await expectAccessible(page);
  });

  test("in progress", async ({ page }) => {
    const job = await bookedJob();
    await setClock(MONDAY_10AM);
    await openJob(page, job.id);

    await expectAccessible(page);
  });

  test("a price change to review", async ({ page }) => {
    const job = await bookedJob({ addOns: ["Inside the oven"] });
    await setClock(MONDAY_11AM);
    await completeJob(job.id, job.cory.id, {
      condition: "heavy",
      reports: [
        { kind: "extra_time", hours: 1, reason: "The oven was very greasy" },
      ],
    });
    await openJob(page, job.id);

    await expectAccessible(page);
  });

  test("done, its first clean, with a plan to offer", async ({ page }) => {
    await createStaff(olive);
    await signUp(olive.email);
    const { job } = await completedFirstClean(olive.email);
    await openJob(page, job.id);

    await expectAccessible(page);
  });

  test("done, its balance unpaid", async ({ page }) => {
    const job = await bookedJob();
    await setClock(MONDAY_11AM);
    await failCharges("card_declined");
    await completeJob(job.id, job.cory.id, {
      condition: "moderate",
      reports: [],
    });
    await failCharges(null);
    await openJob(page, job.id);

    await expectAccessible(page);
  });

  test("done, on a weekly bill", async ({ page }) => {
    await createStaff(olive);
    await signUp(olive.email);
    const { jobId } = await billedWeek({ officeEmail: olive.email });
    await openJob(page, jobId);

    await expectAccessible(page);
  });

  test("the crew couldn't get in", async ({ page }) => {
    const job = await bookedJob();
    await setClock(MONDAY_10AM);
    await recordNoAccess(
      job.id,
      job.cory.id,
      "Nobody answered and the doorman had no key",
    );
    await openJob(page, job.id);

    await expectAccessible(page);
  });

  test("cancelled by us, its deposit refunded", async ({ page }) => {
    const job = await bookedJob();
    await openJob(page, job.id);
    await pageAction(page, "Cancel job");
    const dialog = page.getByRole("alertdialog", { name: "Cancel this job?" });
    await dialog.getByText(/^(Empire Cleaning|We) can't do it$/).click();
    await dialog
      .getByRole("textbox", { name: "Why? (the client sees this)" })
      .fill("Our crew is unwell.");
    await dialog.getByRole("button", { name: "Cancel job" }).click();
    await expect(dialog).toBeHidden();
    await openJob(page, job.id);

    await expectAccessible(page);
  });
});

// the Cleaner's Job once done, the crew it folds under "The job" open: who
// was there (#493 PR 11 gives an ended crew one rule for both readers)
test(
  "the Cleaner's done Job, its crew",
  { tag: "@desktop" },
  async ({ page }) => {
    const dee = await addCleaner("Dee Cleaner");
    const job = await bookedJob({ crewSize: 2 });
    await offerJob(job.id, dee.id, { confirmed: true });
    await setClock(MONDAY_11AM);
    await completeJob(job.id, job.cory.id, {
      condition: "moderate",
      reports: [],
    });
    await signedInAs(page, "cory@example.com");
    await page.goto(`/cleaner/jobs/${job.id}`);
    await page.getByText("The job", { exact: true }).click();
    await expect(page.getByRole("region", { name: "Crew" })).toBeVisible();

    await expectAccessible(page);
  },
);
