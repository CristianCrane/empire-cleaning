import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  emailsTo,
  expect,
  offerPlace,
  setClock,
  setUsualWeek,
  signedInAs,
  test,
} from "./harness.ts";

// the API's fake clock is at 4am on Monday 5 January 2026 in New York. The
// Jobs here are at 9am on Thursday the 8th, more than 48 hours away, unless a
// test says otherwise.
const THURSDAY_9AM = "2026-01-08T14:00:00Z";
const JOB_SCREEN = /\/office\/jobs\/[0-9a-f-]{36}$/;

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};

const signInAsOffice = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");
};

const cleaner = async (name: string) => {
  const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
  const member = (await createStaff({ name, email, roles: ["cleaner"] })) as {
    id: string;
  };
  await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
  return { id: member.id, email };
};

const signInAsCleaner = async (page: Page, email: string) => {
  await signedInAs(page, email);
  await expect(page).toHaveURL("/cleaner");
};

const thursdayJob = (crewSize = 2) =>
  bookJob({ startsAt: THURSDAY_9AM, labourHours: 6, crewSize }) as Promise<{
    id: string;
  }>;

const offerTo = async (page: Page, name: RegExp) => {
  await page.getByRole("button", { name: /Offer to$/ }).click();
  await page.getByRole("option", { name }).click();
  await page.getByRole("button", { name: "Offer place" }).click();
};

test(
  "Office Staff offer a Job's places from the Schedule",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const cory = await cleaner("Cory Cleaner");
    await cleaner("Dee Cleaner");
    await thursdayJob();
    await signInAsOffice(page);

    await page.goto("/office/schedule?from=2026-01-05&to=2026-01-11");
    const thursday = page.getByRole("group", { name: "Jobs on Thu, Jan 8" });
    await expect(thursday).toContainText("Unassigned");
    await thursday.getByRole("link").click();
    await expect(page).toHaveURL(JOB_SCREEN);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Thu, Jan 8, 9:00 AM",
    );

    const assignments = page.getByRole("region", { name: "Assignments" });
    await expect(assignments).toContainText("0 of 2 places Confirmed");
    await offerTo(page, /^Cory Cleaner \(8 h\)/);
    await expect(page.getByText("Place offered to Cory Cleaner")).toBeVisible();
    const list = assignments.getByRole("grid", { name: "Assignments" });
    await expect(list.getByRole("row", { name: /Cory Cleaner/ })).toContainText(
      "Offered",
    );
    expect((await emailsTo(cory.email)).at(-1)!.subject).toBe(
      "You've been offered a Job",
    );

    await offerTo(page, /^Dee Cleaner/);
    await expect(list.getByRole("row")).toHaveCount(2);
    await expect(assignments).toContainText(
      "Every place is held. Remove someone",
    );
  },
);

test("Office Staff take someone off a Job, freeing their place", async ({
  page,
}) => {
  const cory = await cleaner("Cory Cleaner");
  const job = await thursdayJob(1);
  await offerPlace(job.id, cory.id, { confirmed: true });
  await signInAsOffice(page);
  await page.goto(`/office/jobs/${job.id}`);
  await expect(page.getByText("1 of 1 place Confirmed")).toBeVisible();

  await page.getByRole("button", { name: "Remove Cory Cleaner" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove" })
    .click();

  await expect(page.getByText("Cory Cleaner taken off the Job")).toBeVisible();
  await expect(page.getByText("0 of 1 place Confirmed")).toBeVisible();
  await expect(page.getByRole("button", { name: /Offer to$/ })).toBeVisible();
  expect((await emailsTo(cory.email)).at(-1)!.subject).toBe(
    "You're no longer on a Job",
  );
});

test("an Unassigned Job within 48 hours needs attention", async ({ page }) => {
  await cleaner("Cory Cleaner");
  // tomorrow at 9am
  await bookJob({
    startsAt: "2026-01-06T14:00:00Z",
    labourHours: 4,
    crewSize: 2,
  });
  await signInAsOffice(page);

  const item = page
    .getByRole("grid", { name: "Needs attention" })
    .getByRole("row", { name: /Client/ });
  await expect(item).toContainText("Assign Staff");
  await expect(item).toContainText("Tue, Jan 6, 9:00 AM");
  await item.click();
  await expect(page).toHaveURL(JOB_SCREEN);
});

test(
  "a Cleaner sees their Jobs and confirms a place",
  { tag: "@smoke" },
  async ({ page }) => {
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const job = await thursdayJob();
    // today's, at 3pm
    const today = (await bookJob({
      startsAt: "2026-01-05T20:00:00Z",
      labourHours: 2,
      crewSize: 1,
    })) as { id: string };
    await offerPlace(job.id, cory.id);
    await offerPlace(job.id, dee.id);
    await offerPlace(today.id, cory.id, { confirmed: true });
    await signInAsCleaner(page, cory.email);

    const todays = page.getByRole("grid", { name: "Today's Jobs" });
    await expect(todays.getByRole("row")).toHaveCount(1);
    await expect(todays).toContainText("3:00 PM");
    await expect(todays).toContainText("Confirmed");
    const coming = page.getByRole("grid", { name: "Jobs coming up" });
    await expect(coming).toContainText("Thu, Jan 8, 9:00 AM");
    await expect(coming).toContainText("Offered");

    await coming.getByRole("row").click();
    await expect(page).toHaveURL(`/cleaner/jobs/${job.id}`);
    await expect(page.getByRole("region", { name: "Where" })).toContainText(
      "Ring 4B; the doorman has a key.",
    );
    const who = page.getByRole("region", { name: "Who" });
    await expect(who).toContainText("Client");
    await expect(who).toContainText("Shown here on the day of the Job");
    await expect(who).toContainText("Dee Cleaner (not confirmed yet)");
    // never any prices
    await expect(page.locator("main")).not.toContainText("$");

    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.getByText("You're confirmed for this Job."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Your Jobs" }).first().click();
    await expect(
      page.getByRole("grid", { name: "Jobs coming up" }),
    ).toContainText("Confirmed");
  },
);

test("a Cleaner releases a place they can't make", async ({ page }) => {
  const cory = await cleaner("Cory Cleaner");
  await createStaff(olive);
  const job = await thursdayJob();
  await offerPlace(job.id, cory.id);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  await page.getByRole("button", { name: "Release" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Release" })
    .click();

  await expect(page).toHaveURL("/cleaner");
  await expect(page.getByText("Place released")).toBeVisible();
  await expect(page.getByText("Nothing coming up yet.")).toBeVisible();
  expect((await emailsTo(olive.email)).at(-1)!.subject).toBe(
    "Cory Cleaner released a place on a Job",
  );
});

test("a Confirmed place can't be released within 48 hours of the Job", async ({
  page,
}) => {
  const cory = await cleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerPlace(job.id, cory.id, { confirmed: true });
  // Tuesday afternoon: under 48 hours to go
  await setClock("2026-01-06T20:00:00Z");
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  await expect(
    page.getByText("your place can't be released here"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Release" })).toHaveCount(0);
});

test("a Cleaner sees the Client's phone on the day of the Job", async ({
  page,
}) => {
  const cory = await cleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerPlace(job.id, cory.id, { confirmed: true });
  await setClock("2026-01-08T11:00:00Z");
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  await expect(page.getByRole("region", { name: "Who" })).toContainText(
    "(646) 555-0100",
  );
});

test("a Cleaner can't open a Job they aren't on", async ({ page }) => {
  await cleaner("Cory Cleaner");
  const job = await thursdayJob();
  await signInAsCleaner(page, "cory@example.com");

  await page.goto(`/cleaner/jobs/${job.id}`);

  await expect(page.getByText("Ring 4B")).toHaveCount(0);
});

test("the Job screens pass automated accessibility checks", async ({
  page,
  browser,
}) => {
  const cory = await cleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerPlace(job.id, cory.id);
  await signInAsOffice(page);
  await page.goto(`/office/jobs/${job.id}`);
  await expect(page.getByRole("region", { name: "Assignments" })).toBeVisible();
  const office = await new AxeBuilder({ page }).analyze();
  expect(office.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  const asCory = await (await browser.newContext()).newPage();
  await signInAsCleaner(asCory, cory.email);
  await expect(
    asCory.getByRole("grid", { name: "Jobs coming up" }),
  ).toBeVisible();
  const list = await new AxeBuilder({ page: asCory }).analyze();
  expect(list.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await asCory.goto(`/cleaner/jobs/${job.id}`);
  await expect(
    asCory.getByRole("region", { name: "Your place" }),
  ).toBeVisible();
  const view = await new AxeBuilder({ page: asCory }).analyze();
  expect(view.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Friday, when Cory is free
  const open = (await bookJob({
    startsAt: "2026-01-09T14:00:00Z",
    labourHours: 3,
    crewSize: 1,
  })) as { id: string };
  await asCory.goto(`/cleaner/open/${open.id}`);
  await expect(
    asCory.getByRole("region", { name: "Can you take it?" }),
  ).toBeVisible();
  const openView = await new AxeBuilder({ page: asCory }).analyze();
  expect(openView.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test(
  "a Cleaner takes an Open Place, seeing only roughly where it is first",
  { tag: "@smoke" },
  async ({ page }) => {
    const cory = await cleaner("Cory Cleaner");
    const job = await thursdayJob(1);
    await signInAsCleaner(page, cory.email);

    const open = page.getByRole("grid", { name: "Jobs open to you" });
    const row = open.getByRole("row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Thu, Jan 8, 9:00 AM");
    await expect(row).toContainText(
      "11375 · Deep Clean · 6 h on site · Just you",
    );

    await row.click();
    await expect(page).toHaveURL(`/cleaner/open/${job.id}`);
    const clean = page.getByRole("region", { name: "The clean" });
    await expect(clean).toContainText("Deep Clean");
    await expect(clean).toContainText("11375");
    // no address, Access Instructions, Client or prices before Confirming
    await expect(page.locator("main")).not.toContainText("Austin St");
    await expect(page.locator("main")).not.toContainText("Ring 4B");
    await expect(page.locator("main")).not.toContainText("$");

    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page).toHaveURL(`/cleaner/jobs/${job.id}`);
    await expect(
      page.getByText("You're confirmed for this Job."),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Where" })).toContainText(
      "Ring 4B; the doorman has a key.",
    );
  },
);

test("a Cleaner is told when someone else took the Open Place first", async ({
  page,
}) => {
  const cory = await cleaner("Cory Cleaner");
  const dee = await cleaner("Dee Cleaner");
  const job = await thursdayJob(1);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/open/${job.id}`);
  await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();

  // Dee gets there first
  await offerPlace(job.id, dee.id, { confirmed: true });
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("Someone else took this Job")).toBeVisible();
});

test("a Cleaner says an Open Place is not for them, and the Office sees it", async ({
  page,
  browser,
}) => {
  const cory = await cleaner("Cory Cleaner");
  await cleaner("Dee Cleaner");
  const job = await thursdayJob(1);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/open/${job.id}`);

  await page.getByRole("button", { name: "Not for me" }).click();

  await expect(page).toHaveURL("/cleaner");
  await expect(page.getByText("Taken off your list")).toBeVisible();
  await expect(page.getByText("Nothing open to you right now.")).toBeVisible();

  const office = await (await browser.newContext()).newPage();
  await signInAsOffice(office);
  await office.goto(`/office/jobs/${job.id}`);
  const assignments = office.getByRole("region", { name: "Assignments" });
  await expect(assignments).toContainText(
    "Its open place is open to 1 free Cleaner. The first to confirm takes each.",
  );
  await expect(assignments).toContainText("Not for them: Cory Cleaner.");
});

test("the Office sees when a Job's places open to Cleaners", async ({
  page,
}) => {
  await cleaner("Cory Cleaner");
  // 9am on Tuesday the 13th: open from 9am on the 6th
  const job = (await bookJob({
    startsAt: "2026-01-13T14:00:00Z",
    labourHours: 4,
    crewSize: 2,
  })) as { id: string };
  await signInAsOffice(page);
  await page.goto(`/office/jobs/${job.id}`);

  await expect(page.getByRole("region", { name: "Assignments" })).toContainText(
    "Its 2 open places open to free Cleaners on Tue, Jan 6, 9:00 AM.",
  );
});
