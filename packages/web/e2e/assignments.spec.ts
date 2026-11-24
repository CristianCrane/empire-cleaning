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
  listRows,
  openTile,
  pageAction,
  expectNoPageAction,
  expectNextStep,
  expectNothingNext,
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

// the Job's next step while it needs a cleaner and one is free (#493)
const offerTo = async (page: Page, name: RegExp) => {
  await pageAction(page, "Offer to a cleaner");
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
    // what it is is the title; when, the crumb's and the card's
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Deep Clean",
    );

    const crew = page.getByRole("region", { name: "Crew" });
    await expect(crew).toContainText("2 needed");
    await offerTo(page, /^Cory Cleaner \(8 h\)/);
    await expect(page.getByRole("region", { name: "History" })).toContainText(
      "Offered to Cory Cleaner",
    );
    // a face each, ticked once confirmed, a ghost for the one still needed
    const faces = crew.getByRole("listitem");
    await expect(faces).toHaveText([
      "Cory Cleaner, not confirmed yet",
      "Needed, a cleaner still needed",
    ]);
    expect((await emailsTo(cory.email)).at(-1)!.subject).toBe(
      "You've been offered a job",
    );

    await offerTo(page, /^Dee Cleaner/);
    await expect(faces).toHaveText([
      "Cory Cleaner, not confirmed yet",
      "Dee Cleaner, not confirmed yet",
    ]);
    // the crew is whole: nothing left to offer
    await expectNoPageAction(page, "Offer to a cleaner");
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
  const crew = page.getByRole("region", { name: "Crew" });
  // all confirmed, the tick says it: no line
  await expect(
    crew.getByRole("listitem").filter({ hasText: "Cory Cleaner, confirmed" }),
  ).toBeVisible();
  await expect(crew).not.toContainText("1 of 1 confirmed");

  await pageAction(page, "Take Cory Cleaner off");
  await page
    .getByRole("alertdialog", { name: "Take Cory Cleaner off this job?" })
    .getByRole("button", { name: "Take off" })
    .click();

  await expect(page.getByText("Cory Cleaner taken off the Job")).toBeVisible();
  await expect(crew).toContainText("1 needed");
  // off the Crew, which shows who's on it; History says who was (WEB-3)
  await expect(crew.getByRole("listitem")).toHaveText([
    "Needed, a cleaner still needed",
  ]);
  await expect(page.getByRole("region", { name: "History" })).toContainText(
    "Cory Cleaner taken off",
  );
  // offering it is the next step again
  await expectNextStep(page, "Offer to a cleaner");
  expect((await emailsTo(cory.email)).at(-1)!.subject).toBe(
    "You're no longer on a job",
  );
});

// #493: once it's started, a crew short is under way: nobody can be offered
// it (the server refuses), so it isn't the next step, nor asked for
test("a started Job a cleaner short is in progress, with no one to offer it to", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  await addCleaner("Dee Cleaner");
  const job = await thursdayJob(2);
  await offerJob(job.id, cory.id, { confirmed: true });
  await setClock("2026-01-08T15:00:00Z");
  await signInAsOffice(page);
  await page.goto(`/office/jobs/${job.id}`);

  await expect(page.getByText("In progress", { exact: true })).toBeVisible();
  await expectNothingNext(page);
  await expectNoPageAction(page, "Offer to a cleaner");
});

// #406, #493: the Job's next step its primary, the rest behind its arrow,
// Cancel last after a rule; a fact each, the cleaning hours for a crew of
// two; the crew a face each, the picture the Staff list shows, a tick once
// confirmed; each taken off from the menu
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

    await page.getByRole("button", { name: "More actions" }).click();
    const menu = page.getByRole("menu");
    await expectNextStep(page, "Move job");
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Ask for a new time",
      "Take Cory Cleaner off",
      "Take Dee Cleaner off",
      "Cancel job",
    ]);
    await expect(menu.getByRole("separator")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    const details = page.getByRole("region", { name: "Job details" });
    await expect(details.getByRole("term")).toHaveText([
      "How long",
      "Cleaning hours",
      "Free to move or cancel",
      "How we get in",
    ]);

    const crew = page.getByRole("region", { name: "Crew" });
    await expect(crew.getByRole("listitem")).toHaveText([
      "Cory Cleaner, confirmed",
      "Dee Cleaner, not confirmed yet",
    ]);
    await expect(crew.locator("img")).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/cory-photo",
    );
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

  const item = (await openTile(page, "Jobs")).getByRole("row", {
    name: /Robin/,
  });
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
    // a crew of one in the Offers row's words, as a crew of two is "2 cleaners"
    await expect(next).toContainText(/2 h\s·\sjust you/);
    // nothing else coming up for them
    await expect(
      page.getByRole("button", { name: /^Coming up/ }),
    ).toBeDisabled();

    await page.getByRole("link", { name: "Offers (1)" }).first().click();
    await expect(
      page.getByRole("tab", { name: /Offered to you/ }),
    ).toHaveAttribute("aria-selected", "true");
    const offered = listRows(page, "Offers");
    await expect(offered).toContainText("Jan 8");
    await expect(offered).toContainText("Thu 9:00 AM");
    await offered.click();
    await expect(page).toHaveURL(`/cleaner/jobs/${job.id}`);
    // an offer lights Offers, as its crumbs say
    await expect(
      page.getByRole("link", { name: "Offers (1)" }).first(),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Available", { exact: true })).toBeVisible();
    const details = page.getByRole("region", { name: "Job details" });
    await expect(details).toContainText("9:00 AM – 12:00 PM");
    // the client by name; their number and how we get in aren't drawn at
    // all, not "shows on the day" (#230, D3)
    await expect(details.getByRole("term")).toHaveText(["How long", "Client"]);
    for (const value of [/^3 h$/, /^Robin$/])
      await expect(
        details.getByRole("definition").filter({ hasText: value }),
      ).toBeVisible();
    await expect(details).not.toContainText("Ring 4B");
    // #497: a crew of two, offered to Cory and Dee: Dee's face, not yet
    // confirmed, and the one Cory would be still needed, never "Just you" or
    // Cory named as not confirmed
    const crew = page.getByRole("region", { name: "Crew" });
    await expect(crew.getByRole("listitem")).toHaveText([
      "Dee, not confirmed yet",
      "Needed, a cleaner still needed",
    ]);
    await expect(crew).toContainText("1 needed");
    // never any prices
    await expect(page.locator("main")).not.toContainText("$");

    await pageAction(page, "Confirm");
    await expect(page.getByText("Job confirmed")).toBeVisible();
    // theirs now: they're on the crew, and the next step is getting there
    await expect(crew.getByRole("listitem")).toHaveText([
      "You, confirmed",
      "Dee, not confirmed yet",
    ]);
    await expectNoPageAction(page, "Confirm");
    await expect(
      page.getByRole("link", { name: "Directions" }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Your jobs" }).first().click();
    await expect(await openTile(page, "Coming up")).toContainText(
      "Thu 9:00 AM",
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
  await pageAction(page, "Confirm");
  await expect(
    page.getByText(
      "This job moved to Thursday, January 8 at 11:00 AM. Check the new time, then confirm again.",
    ),
  ).toBeVisible();
  // the page shows the new time, and it can be confirmed
  await expect(page.getByText("Thu, Jan 8, 11:00 AM").first()).toBeVisible();
  await pageAction(page, "Confirm");
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
  await pageAction(page, "Confirm");
  await expect(page.getByText(/^This job moved to/)).toBeVisible();
  await expect(page.getByText("Thu, Jan 8, 11:00 AM").first()).toBeVisible();
  await pageAction(page, "Confirm");
  await expect(page.getByText("Job confirmed")).toBeVisible();
  await expect(page).toHaveURL(`/cleaner/jobs/${job.id}`);
});

// #497: offered alone a Job for two, the reader isn't "Just you", nor
// named as not confirmed: both are still needed until they confirm
test("a Job for two offered to one Cleaner shows both cleaners still needed", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerJob(job.id, cory.id);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Just you")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Cory");
  const crew = page.getByRole("region", { name: "Crew" });
  await expect(crew).toContainText("2 needed");
  await expect(crew.getByRole("listitem")).toHaveText([
    "Needed, a cleaner still needed",
    "Needed, a cleaner still needed",
  ]);
});

test("a Cleaner says an offered Job is not for them", async ({ page }) => {
  const cory = await addCleaner("Cory Cleaner");
  await createStaff(olive);
  const job = await thursdayJob();
  await offerJob(job.id, cory.id);
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  await pageAction(page, "Not for me");
  await page
    .getByRole("alertdialog", { name: "Not for you?" })
    .getByRole("button", { name: "Not for me" })
    .click();

  await expect(page).toHaveURL("/cleaner/offers");
  await expect(page.getByText("Taken off your list")).toBeVisible();
  expect((await emailsTo(olive.email)).at(-1)!.subject).toBe(
    "Cory Cleaner dropped out of a job",
  );
});

test("a Cleaner drops out of a Job they'd confirmed", async ({ page }) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerJob(job.id, cory.id, { confirmed: true });
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  await pageAction(page, "Drop out");
  await page
    .getByRole("alertdialog", { name: "Drop out of this job?" })
    .getByRole("button", { name: "Drop out" })
    .click();

  await expect(page).toHaveURL("/cleaner");
  await expect(page.getByText("You've dropped out")).toBeVisible();
  await expect(page.getByText("Nothing booked for you yet")).toBeVisible();
});

test("a Cleaner with nothing booked but an offer waiting is sent to it, with no all-clear", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerJob(job.id, cory.id);
  await signInAsCleaner(page, cory.email);

  const card = page
    .locator("section")
    .filter({ hasText: "Nothing booked for you yet" });
  await expect(
    card.getByRole("link", { name: "See 1 offer", exact: true }),
  ).toBeVisible();
  // Offers' own icon leads it, not the green tick that says all's clear
  await expect(card.locator("svg.lucide-inbox")).toHaveCount(1);
  await expect(card.locator("svg.lucide-circle-check")).toHaveCount(0);
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

  // the office's to sort out then: no Drop out, and the office a press away
  await expectNoPageAction(page, "Drop out");
  await page.keyboard.press("Escape");
  await pageAction(page, "Call the office");
});

test("a Cleaner sees the Client's phone and how we get in on the day of the Job", async ({
  page,
}) => {
  const cory = await addCleaner("Cory Cleaner");
  const job = await thursdayJob();
  await offerJob(job.id, cory.id, { confirmed: true });
  await setClock("2026-01-08T11:00:00Z");
  await signInAsCleaner(page, cory.email);
  await page.goto(`/cleaner/jobs/${job.id}`);

  const details = page.getByRole("region", { name: "Job details" });
  await expect(page.getByText("Today", { exact: true })).toBeVisible();
  // the number on its own, the field named by its line; how we get in
  // last, the card's width
  await expect(details.getByRole("term")).toHaveText([
    "How long",
    "Client",
    "Client's number",
    "How we get in",
  ]);
  await expect(
    details.getByRole("link", { name: "(646) 555-0100", exact: true }),
  ).toHaveAttribute("href", "tel:(646) 555-0100");
  await expect(
    details
      .getByRole("definition")
      .filter({ hasText: /^Ring 4B; the doorman has a key\.$/ }),
  ).toBeVisible();
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
    asCory.getByRole("heading", { level: 1, name: "Hi, Cory" }),
  ).toBeVisible();
  await expectAccessible(asCory);
  await asCory.goto(`/cleaner/jobs/${job.id}`);
  await expect(asCory.getByRole("region", { name: "Crew" })).toBeVisible();
  await expectAccessible(asCory);

  // Friday, when Cory is free
  const open = (await bookJob({
    startsAt: "2026-01-09T14:00:00Z",
    labourHours: 3,
    crewSize: 1,
  })) as { id: string };
  await asCory.goto(`/cleaner/open/${open.id}`);
  await expect(
    asCory.getByRole("region", { name: "Job details" }),
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
    // nothing offered, so what's open to them
    await expect(
      page.getByRole("tab", { name: /Open to you/ }),
    ).toHaveAttribute("aria-selected", "true");
    const row = listRows(page, "Offers");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Jan 8");
    // roughly where, then what
    await expect(row).toContainText("Thu 9:00 AM · ZIP code 11375");
    await expect(row).toContainText("Deep Clean · 6 h · just you");

    await row.click();
    await expect(page).toHaveURL(`/cleaner/open/${job.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Deep Clean",
    );
    await expect(
      page.getByRole("region", { name: "Job details" }),
    ).toContainText("ZIP code 11375");
    // no address, Access Instructions, Client or prices before Confirming
    await expect(page.locator("main")).not.toContainText("Austin St");
    await expect(page.locator("main")).not.toContainText("Ring 4B");
    await expect(page.locator("main")).not.toContainText("$");

    await pageAction(page, "Confirm");
    await expect(page).toHaveURL(`/cleaner/jobs/${job.id}`);
    await expect(page.getByText("Job confirmed")).toBeVisible();
    // the address once theirs; how we get in on the day, not drawn before
    const details = page.getByRole("region", { name: "Job details" });
    await expect(details).toContainText("Austin St");
    await expect(details.getByRole("term")).toHaveText(["How long", "Client"]);
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
  await pageAction(page, "Confirm");

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

  await pageAction(page, "Not for me");

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
    page.getByText(
      "Cleaners free that day can take it from Tue, Jan 6, 9:00 AM.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Crew" })).toContainText(
    "2 needed",
  );
});
