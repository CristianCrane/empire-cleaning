import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  acceptedJob,
  createStaff,
  emailsTo,
  expect,
  offerPlace,
  requestReschedule,
  setClock,
  setUsualWeek,
  signedInAs,
  signUp,
  test,
} from "./harness.ts";

// the API's clock is at 4am on Monday 5 January 2026 in New York. The Job
// here is Casey's Deep Clean at 9am on Monday the 12th, free to move until
// 9am on Sunday the 11th.
const MONDAY_9AM = "2026-01-12T14:00:00Z";
const SUNDAY_9AM = "2026-01-11T14:00:00Z";

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

const choose = async (page: Page, field: string, option: string) => {
  await page.getByRole("button", { name: new RegExp(`${field}$`) }).click();
  await page.getByRole("option", { name: option }).click();
};

test(
  "a Client asks to move a clean in the portal, seeing what it costs, then withdraws it",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const job = await bookedJob();
    await signedInAs(page, casey.email);
    await page.goto(`/portal/jobs/${job.id}`);

    const card = page.getByRole("region", { name: "Need another time?" });
    await expect(card).toContainText(
      "You can move it for free until Sun, Jan 11, 9:00 AM.",
    );
    await card.getByRole("button", { name: "Choose a new time" }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a new time" });
    await expect(dialog).toContainText("There's no charge for moving it.");
    await choose(page, "Day", "Wed, Jan 14");
    await choose(page, "Start time", "10:00 AM");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Send request" }).click();

    await expect(page.getByText("Request sent")).toBeVisible();
    const pending = page.getByRole("region", { name: "Moving your clean" });
    await expect(pending).toContainText(
      "You've asked to move it to Wed, Jan 14, 10:00 AM. That time is held for you while the Office confirms it. Until then, your clean stays booked for Mon, Jan 12, 9:00 AM.",
    );
    expect((await emailsTo(olive.email)).at(-1)!.subject).toBe(
      "Casey Client asked to move a Job",
    );

    await pending.getByRole("button", { name: "Withdraw request" }).click();
    await expect(page.getByText("Request withdrawn")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Need another time?" }),
    ).toBeVisible();
  },
);

test("the portal shows a Late Reschedule's cost before it's sent", async ({
  page,
}) => {
  const job = await bookedJob();
  await setClock(SUNDAY_9AM);
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${job.id}`);

  const card = page.getByRole("region", { name: "Need another time?" });
  await expect(card).toContainText(
    "It's less than 24 hours until your clean, so this is a Late Reschedule. Your first one is free, and your Deposit still counts towards the price.",
  );
});

test(
  "Office Staff confirm a Reschedule Request from Needs attention",
  { tag: "@smoke" },
  async ({ page }) => {
    const job = await bookedJob();
    await requestReschedule(job.id, { date: "2026-01-14", time: "10:00" });
    await signedInAs(page, olive.email);

    await page
      .getByRole("grid", { name: "Needs attention" })
      .getByRole("row", { name: /Casey Client/ })
      .click();
    const card = page.getByRole("region", { name: "Reschedule Request" });
    await expect(card).toContainText("Mon, Jan 12, 9:00 AM");
    await expect(card).toContainText("Wed, Jan 14, 10:00 AM");
    await expectAccessible(page);
    await card.getByRole("button", { name: "Confirm move" }).click();

    await expect(page.getByText("Job moved")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Wed, Jan 14, 10:00 AM" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Assignments" }),
    ).toContainText("Offered");
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your clean has moved",
    );
    expect((await emailsTo("cory@example.com")).at(-1)!.subject).toBe(
      "A Job you're on has moved",
    );
  },
);

test("Office Staff turn down a Reschedule Request, and the Client sees why", async ({
  page,
  browser,
}) => {
  const job = await bookedJob();
  await requestReschedule(job.id, { date: "2026-01-14", time: "10:00" });
  await signedInAs(page, olive.email);
  await page.goto(`/office/jobs/${job.id}`);

  await page
    .getByRole("region", { name: "Reschedule Request" })
    .getByRole("button", { name: "Turn down" })
    .click();
  const dialog = page.getByRole("alertdialog", {
    name: "Turn down this request?",
  });
  await dialog
    .getByRole("textbox", { name: /Why\?/ })
    .fill("We're fully booked that morning.");
  await dialog.getByRole("button", { name: "Turn down" }).click();
  await expect(page.getByText("Request turned down")).toBeVisible();
  await expect(page.getByRole("region", { name: "Moving" })).toContainText(
    "Turned down",
  );

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(`/portal/jobs/${job.id}`);
  await expect(
    client.getByRole("region", { name: "Need another time?" }),
  ).toContainText(
    "We couldn't move it to Wed, Jan 14, 10:00 AM. We're fully booked that morning.",
  );
});
