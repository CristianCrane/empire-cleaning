import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  moveJob,
  offerJob,
  setClock,
  serveGooglePictures,
  setGooglePicture,
  signUp,
  signedInAs,
  test,
  addCleaner,
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

const signInAsCleaner = async (page: Page, email: string) => {
  await signedInAs(page, email);
  await expect(page).toHaveURL("/cleaner");
};

const thursdayJob = (crewSize = 2) =>
  bookJob({ startsAt: THURSDAY_9AM, labourHours: 6, crewSize }) as Promise<{
    id: string;
  }>;

// from the Crew Section's action: the Cleaners Needed Notice has one too
const offerTo = async (page: Page, name: RegExp) => {
  await page
    .getByRole("region", { name: "Crew" })
    .getByRole("button", { name: "Offer to a cleaner" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Offer to a cleaner" });
  await dialog.getByRole("button", { name: /Offer to$/ }).click();
  await page.getByRole("option", { name }).click();
  await dialog.getByRole("button", { name: "Offer", exact: true }).click();
};

test(
  "Office Staff offer a Job to Cleaners from the Schedule",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const cory = await addCleaner("Cory Cleaner");
    await addCleaner("Dee Cleaner");
    await thursdayJob();
    await signInAsOffice(page);

    await page.goto("/office/schedule?from=2026-01-05&to=2026-01-11");
    const thursday = page.getByRole("group", { name: "Jobs on Thu, Jan 8" });
    await expect(thursday).toContainText("Needs cleaners");
    await thursday.getByRole("link").click();
    await expect(page).toHaveURL(JOB_SCREEN);
    await expect(
      page.locator("#main").getByText("Thu, Jan 8, 9:00 AM", { exact: true }),
    ).toBeVisible();
    // what and where is the title
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/ at /);

    const crew = page.getByRole("region", { name: "Crew" });
    await expect(crew).toContainText("0 of 2 cleaners confirmed");
    await offerTo(page, /^Cory Cleaner \(8 h\)/);
    await expect(page.getByRole("region", { name: "History" })).toContainText(
      "Offered to Cory Cleaner",
    );
    const list = crew.getByRole("grid", { name: "Crew" });
    await expect(list.getByRole("row", { name: /Cory Cleaner/ })).toContainText(
      "Offered",
    );
    expect((await emailsTo(cory.email)).at(-1)!.subject).toBe(
      "You've been offered a job",
    );

    await offerTo(page, /^Dee Cleaner/);
    await expect(list.getByRole("row")).toHaveCount(2);
    // the crew is whole: nothing left to offer
    await expect(
      page.getByRole("button", { name: "Offer to a cleaner" }),
    ).toHaveCount(0);
  },
);

test("Office Staff take someone off a Job, leaving a Cleaner Needed", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob(1);
  await offerJob(job.id, cory.id, { confirmed: true });
  await signInAsOffice(page);
  await page.goto(`/office/jobs/${job.id}`);
  await expect(page.getByText("1 of 1 Cleaner Confirmed")).toBeVisible();

  await page.getByRole("button", { name: "Remove Cory Cleaner" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove" })
    .click();

  await expect(page.getByText("Cory Cleaner taken off the Job")).toBeVisible();
  await expect(page.getByText("0 of 1 Cleaner Confirmed")).toBeVisible();
  // kept, so the Office sees who was on it
  const row = page
    .getByRole("grid", { name: "Crew" })
    .getByRole("row", { name: /Cory Cleaner/ });
  // its badge, not only the line under the name ("Taken off Jan 5")
  await expect(row.getByText("Taken off", { exact: true })).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Remove Cory Cleaner" }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "History" })).toContainText(
    "Cory Cleaner taken off",
  );
  await expect(
    page.getByRole("button", { name: "Offer to a cleaner" }).first(),
  ).toBeVisible();
  expect((await emailsTo(cory.email)).at(-1)!.subject).toBe(
    "You're no longer on a job",
  );
});

// #406: what can be done to the Job in an Actions menu, Cancel last after a
// rule; each fact with its label; the Crew drawn as the Staff list, the
// picture the Staff list shows, a badge only when it isn't Confirmed
test(
  "the Office's Job page names its actions, its details and its crew",
  { tag: "@desktop" },
  async ({ page }) => {
    const cory = await addCleaner("Cory Cleaner");
    const dee = await addCleaner("Dee Cleaner");
    const job = await thursdayJob();
    await offerJob(job.id, cory.id, { confirmed: true });
    await offerJob(job.id, dee.id);
    await signUp(cory.email);
    await setGooglePicture(
      cory.email,
      "https://lh3.googleusercontent.com/a/cory-photo",
    );
    await serveGooglePictures(page);
    await signInAsOffice(page);
    await page.goto(`/office/jobs/${job.id}`);

    await page.getByRole("button", { name: "Actions", exact: true }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Move job",
      "Ask for a new time",
      "Cancel job",
    ]);
    await expect(menu.getByRole("separator")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    // focus is back on Actions; let go of it, so the page ends as it opens
    await page.getByRole("button", { name: "Actions", exact: true }).blur();

    const details = page.getByRole("region", { name: "Job details" });
    await expect(details.getByRole("term")).toHaveText([
      "Client",
      "Home",
      "Extras",
      "Cleaning hours",
      "Cleaners",
      "Moving",
      "Cancelling",
    ]);

    const crew = page.getByRole("grid", { name: "Crew" });
    const coryRow = crew.getByRole("row", { name: /Cory Cleaner/ });
    const deeRow = crew.getByRole("row", { name: /Dee Cleaner/ });
    await expect(coryRow.locator("img")).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/cory-photo",
    );
    await expect(coryRow.getByText("Confirmed", { exact: true })).toHaveCount(
      0,
    );
    await expect(deeRow.getByText("Offered", { exact: true })).toBeVisible();
    await expect(
      deeRow.getByRole("button", { name: "Remove Dee Cleaner" }),
    ).toBeVisible();
    await expectAccessible(page);
  },
);

test("an Unassigned Job within 48 hours needs attention", async ({ page }) => {
  await addCleaner("Cory Cleaner");
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
  await expect(item).toContainText("Find cleaners");
  await expect(item).toContainText("Tue, Jan 6, 9:00 AM");
  await item.click();
  await expect(page).toHaveURL(JOB_SCREEN);
});

test(
  "a Cleaner sees their Jobs and confirms one",
  { tag: "@smoke" },
  async ({ page }) => {
    const cory = await addCleaner("Cory Cleaner");
    const dee = await addCleaner("Dee Cleaner");
    const job = await thursdayJob();
    // today's, at 3pm
    const today = (await bookJob({
      startsAt: "2026-01-05T20:00:00Z",
      labourHours: 2,
      crewSize: 1,
    })) as { id: string };
    await offerJob(job.id, cory.id);
    await offerJob(job.id, dee.id);
    await offerJob(today.id, cory.id, { confirmed: true });
    await signInAsCleaner(page, cory.email);

    // only what's theirs: today's, large; the offered Job is under Offers
    const next = page.getByRole("region", { name: "Next up" });
    await expect(next).toContainText("3:00 PM");
    await expect(page.getByRole("grid", { name: "Coming up" })).toHaveCount(0);

    await page
      .getByRole("link", { name: /^Offers/ })
      .first()
      .click();
    const offered = page.getByRole("grid", { name: "Offered to you" });
    await expect(offered).toContainText("Thu, Jan 8, 9:00 AM");
    await offered.getByRole("row").click();
    await expect(page).toHaveURL(`/cleaner/jobs/${job.id}`);
    const details = page.getByRole("region", { name: "Job details" });
    await expect(details).toContainText("Ring 4B; the doorman has a key.");
    await expect(details).toContainText("their number shows on the day");
    await expect(details).toContainText("Dee Cleaner not confirmed yet");
    // never any prices
    await expect(page.locator("main")).not.toContainText("$");

    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText("Job confirmed")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Offered to you" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Your jobs" }).first().click();
    await expect(page.getByRole("grid", { name: "Coming up" })).toContainText(
      "Thu, Jan 8, 9:00 AM",
    );
  },
);

test("a Cleaner can't confirm a Job at a time they weren't shown", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob(1);
  await offerJob(job.id, cory.id);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);
  await expect(page.getByText("Thu, Jan 8, 9:00 AM").first()).toBeVisible();

  // the Office moves it while the page is open
  await moveJob(job.id, { date: "2026-01-08", time: "11:00" });
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByText(
      "This job moved to Thursday, January 8 at 11:00 AM. Check the new time, then confirm again.",
    ),
  ).toBeVisible();
  // the page shows the new time, and it can be confirmed
  await expect(page.getByText("Thu, Jan 8, 11:00 AM").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Job confirmed")).toBeVisible();
});

test("a Cleaner can't take a Cleaner Needed at a time they weren't shown", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob(1);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/open/${job.id}`);
  await expect(page.getByText("Thu, Jan 8, 9:00 AM").first()).toBeVisible();

  await moveJob(job.id, { date: "2026-01-08", time: "11:00" });
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(/^This job moved to/)).toBeVisible();
  await expect(page.getByText("Thu, Jan 8, 11:00 AM").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Job confirmed")).toBeVisible();
  await expect(page).toHaveURL(`/cleaner/jobs/${job.id}`);
});

test("a Cleaner releases a Job they can't make", async ({ page }) => {
  const cory = await addCleaner("Cory Cleaner");
  await createStaff(olive);
  const job = await thursdayJob();
  await offerJob(job.id, cory.id);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  await page.getByRole("button", { name: "Not for me" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Drop out" })
    .click();

  await expect(page).toHaveURL("/cleaner");
  await expect(page.getByText("You've dropped out")).toBeVisible();
  await expect(page.getByText("Nothing booked for you yet")).toBeVisible();
  expect((await emailsTo(olive.email)).at(-1)!.subject).toBe(
    "Cory Cleaner dropped out of a job",
  );
});

test("a Confirmed Job can't be released within 48 hours of it", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerJob(job.id, cory.id, { confirmed: true });
  // Tuesday afternoon: under 48 hours to go
  await setClock("2026-01-06T20:00:00Z");
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  await expect(page.getByText("you can't drop out here")).toBeVisible();
  await expect(page.getByRole("button", { name: "Drop out" })).toHaveCount(0);
});

test("a Cleaner sees the Client's phone on the day of the Job", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerJob(job.id, cory.id, { confirmed: true });
  await setClock("2026-01-08T11:00:00Z");
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  await expect(
    page.getByRole("region", { name: "Job details" }).getByRole("link", {
      name: /\(646\) 555-0100/,
    }),
  ).toHaveAttribute("href", "tel:(646) 555-0100");
});

test("a Cleaner can't open a Job they aren't on", async ({ page }) => {
  await addCleaner("Cory Cleaner");
  const job = await thursdayJob();
  await signInAsCleaner(page, "cory@example.com");

  await page.goto(`/cleaner/jobs/${job.id}`);

  await expect(page.getByText("Ring 4B")).toHaveCount(0);
});

test("the Job screens pass automated accessibility checks", async ({
  page,
  browser,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerJob(job.id, cory.id);
  await signInAsOffice(page);
  await page.goto(`/office/jobs/${job.id}`);
  await expect(page.getByRole("region", { name: "Crew" })).toBeVisible();
  await expectAccessible(page);

  const asCory = await (await browser.newContext()).newPage();
  await signInAsCleaner(asCory, cory.email);
  await expect(
    asCory.getByRole("heading", { name: "Your jobs" }),
  ).toBeVisible();
  await expectAccessible(asCory);
  await asCory.goto(`/cleaner/jobs/${job.id}`);
  await expect(
    asCory.getByRole("region", { name: "Offered to you" }),
  ).toBeVisible();
  await expectAccessible(asCory);

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
  await expectAccessible(asCory);
});

test(
  "a Cleaner takes a Cleaner Needed, seeing only roughly where it is first",
  { tag: "@smoke" },
  async ({ page }) => {
    const cory = await addCleaner("Cory Cleaner");
    const job = await thursdayJob(1);
    await signInAsCleaner(page, cory.email);

    await page
      .getByRole("link", { name: /^Offers/ })
      .first()
      .click();
    const open = page.getByRole("grid", { name: "Open to you" });
    const row = open.getByRole("row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Thu, Jan 8, 9:00 AM");
    await expect(row).toContainText(
      "11375 · Deep Clean · 6 h on site · Just you",
    );

    await row.click();
    await expect(page).toHaveURL(`/cleaner/open/${job.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Deep Clean",
    );
    await expect(
      page.getByRole("region", { name: "Job details" }),
    ).toContainText("11375");
    // no address, Access Instructions, Client or prices before Confirming
    await expect(page.locator("main")).not.toContainText("Austin St");
    await expect(page.locator("main")).not.toContainText("Ring 4B");
    await expect(page.locator("main")).not.toContainText("$");

    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page).toHaveURL(`/cleaner/jobs/${job.id}`);
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Job details" }),
    ).toContainText("Ring 4B; the doorman has a key.");
  },
);

test("a Cleaner is told when someone else took the Cleaner Needed first", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const dee = await addCleaner("Dee Cleaner");
  const job = await thursdayJob(1);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/open/${job.id}`);
  await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();

  // Dee gets there first
  await offerJob(job.id, dee.id, { confirmed: true });
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(
    page.getByText("Someone else already took this job."),
  ).toBeVisible();
});

test("a Cleaner says a Cleaner Needed is not for them, and the Office sees it", async ({
  page,
  browser,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  await addCleaner("Dee Cleaner");
  const job = await thursdayJob(1);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/open/${job.id}`);

  await page.getByRole("button", { name: "Not for me" }).click();

  await expect(page).toHaveURL("/cleaner/offers");
  await expect(page.getByText("Taken off your list")).toBeVisible();
  await expect(page.getByText("Nothing open to you right now")).toBeVisible();

  const office = await (await browser.newContext()).newPage();
  await signInAsOffice(office);
  await office.goto(`/office/jobs/${job.id}`);
  await expect(
    office.getByText(
      "1 free cleaner can take it: the first to confirm gets it.",
    ),
  ).toBeVisible();
  await expect(office.getByText("Said no: Cory Cleaner.")).toBeVisible();
});

test("the Office sees when a Job's Cleaners Needed open to Cleaners", async ({
  page,
}) => {
  await addCleaner("Cory Cleaner");
  // 9am on Tuesday the 13th: open from 9am on the 6th
  const job = (await bookJob({
    startsAt: "2026-01-13T14:00:00Z",
    labourHours: 4,
    crewSize: 2,
  })) as { id: string };
  await signInAsOffice(page);
  await page.goto(`/office/jobs/${job.id}`);

  await expect(
    page.getByText("Free cleaners can take it from Tue, Jan 6, 9:00 AM."),
  ).toBeVisible();
  await expect(page.getByText("Needs 2 more cleaners.")).toBeVisible();
});
