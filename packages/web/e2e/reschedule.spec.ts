import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import {
  acceptedJob,
  bookJob,
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
    // the keyboard path: the same choice from a list
    await dialog.getByText("Or choose from a list").click();
    await choose(page, "Day", "Wed, Jan 14");
    await choose(page, "Start time", "10:00 AM");
    await expect(dialog).toContainText("Move it to Wed, Jan 14 at 10:00 AM");
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
    await expect(
      page.getByText("The Client asked to move it to Wed, Jan 14, 10:00 AM."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Answer" }).click();
    const dialog = page.getByRole("dialog", { name: "Move this Job?" });
    await expect(dialog).toContainText("Mon, Jan 12, 9:00 AM");
    await expect(dialog).toContainText("Wed, Jan 14, 10:00 AM");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Confirm move" }).click();

    await expect(page.getByText("Job moved")).toBeVisible();
    await expect(
      page.locator("#main").getByText("Wed, Jan 14, 10:00 AM", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Crew" })).toContainText(
      "Offered",
    );
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

  await page.getByRole("button", { name: "Answer" }).click();
  await page
    .getByRole("dialog", { name: "Move this Job?" })
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
  await expect(page.getByRole("region", { name: "History" })).toContainText(
    "Move turned down",
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

// on a phone a picker shows a day at a time: step on to the day wanted
const stepDays = async (dialog: Locator, page: Page, days: number) => {
  if (page.viewportSize()!.width >= 768) return;
  for (let i = 0; i < days; i += 1) {
    await dialog.getByRole("button", { name: "Next day" }).click();
  }
};

test(
  "a Client picks a new time on a calendar of open times, seeing no one else's Jobs",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const job = await bookedJob();
    // another Client's clean on the Wednesday, from 10 to 11 with a crew of
    // 2: Dee and whoever else is free, so nobody is left for Casey's then
    const dee = await createStaff({
      name: "Dee Cleaner",
      email: "dee@example.com",
      roles: ["cleaner"],
    });
    await setUsualWeek(dee.id, [8, 8, 8, 8, 8, 0, 0]);
    await bookJob({
      startsAt: "2026-01-14T15:00:00Z",
      labourHours: 2,
      crewSize: 2,
    });
    await signedInAs(page, casey.email);
    await page.goto(`/portal/jobs/${job.id}`);

    await page
      .getByRole("region", { name: "Need another time?" })
      .getByRole("button", { name: "Choose a new time" })
      .click();
    // a month in the dialog itself: only days with room can be picked,
    // then that day's open times
    const dialog = page.getByRole("dialog", { name: "Choose a new time" });
    const month = dialog.getByRole("application", { name: /^Day/ });
    await month.getByRole("button", { name: /January 12, 2026/ }).click();
    const monday = dialog.getByRole("group", {
      name: "Open times on Mon, Jan 12",
    });
    await expect(
      monday.getByRole("button", {
        name: "Mon, Jan 12, 9:00 AM (your clean now)",
      }),
    ).toBeDisabled();
    await expectAccessible(page);

    await month.getByRole("button", { name: /January 14, 2026/ }).click();
    const wednesday = dialog.getByRole("group", {
      name: "Open times on Wed, Jan 14",
    });
    // no crew is free at 10, so it isn't offered; 11 is
    await expect(
      wednesday.getByRole("button", { name: "Wed, Jan 14, 11:00 AM" }),
    ).toBeVisible();
    await expect(
      wednesday.getByRole("button", { name: "Wed, Jan 14, 10:00 AM" }),
    ).toHaveCount(0);
    await expect(dialog).not.toContainText(/Client \d/);
    await wednesday
      .getByRole("button", { name: "Wed, Jan 14, 11:00 AM" })
      .click();
    await expect(dialog).toContainText("Move it to Wed, Jan 14 at 11:00 AM");
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(
      page.getByRole("region", { name: "Moving your clean" }),
    ).toContainText("You've asked to move it to Wed, Jan 14, 11:00 AM.");
  },
);

test(
  "Office Staff ask for a new time from the Schedule, only where it's on offer",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const job = await bookedJob();
    await signedInAs(page, olive.email);
    await page.goto(`/office/jobs/${job.id}`);

    await page.getByRole("button", { name: "Ask for a new time" }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a new time" });
    await dialog
      .getByRole("button", { name: "Pick from the Schedule" })
      .click();
    const schedule = page.getByRole("dialog", {
      name: "Pick from the Schedule",
    });
    await expect(schedule).toContainText(
      "Choose one of the start times on offer",
    );
    await expect(
      schedule
        .getByRole("group", { name: "Jobs on Mon, Jan 12" })
        .getByText(/^9:00 AM Casey Client/),
    ).toBeVisible();

    // nobody works Saturdays, so it has no times to pick
    await stepDays(schedule, page, 5);
    await expect(
      schedule
        .getByRole("region", { name: "Sat, Jan 17", exact: true })
        .getByRole("button"),
    ).toHaveCount(0);
    if (page.viewportSize()!.width < 768) {
      for (let i = 0; i < 3; i += 1) {
        await schedule.getByRole("button", { name: "Previous day" }).click();
      }
    }
    await schedule
      .getByRole("button", { name: "Wed, Jan 14, 10:00 AM" })
      .click();

    await expect(schedule).toBeHidden();
    await expect(dialog.getByRole("button", { name: /Day$/ })).toContainText(
      "Wed, Jan 14",
    );
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Reschedule Request made")).toBeVisible();
  },
);
