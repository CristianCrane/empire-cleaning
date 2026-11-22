import type { Locator, Page } from "@playwright/test";
import { weekdayOf } from "@empire-cleaning/models";
import {
  acceptedJob,
  bookJob,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  offerJob,
  requestReschedule,
  setClock,
  signedInAs,
  recordNoAccess,
  signUp,
  test,
  addCleaner,
  bookSiteVisit,
  expectNoPageAction,
  pageAction,
  requestQuoteForPremises,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

const signInAsOffice = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");
};

// a week far from today: Monday 1 March 2027 to Sunday 7 March. The API's
// clock is in January 2026, so every Job in it is still to come. A test
// whose screen judges a time passed (a Site Visit's drag) sets the
// browser's clock too, so it doesn't depend on the date it runs.
const week = "/office/schedule?from=2027-03-01&to=2027-03-07";
const TUESDAY_9AM = "2027-03-02T14:00:00Z";

// the time axis starts at 7am, an hour to 48px
const HOUR_PX = 48;

const day = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });
const jobsOn = (page: Page, name: string) =>
  page.getByRole("group", { name: `Jobs on ${name}` });

test(
  "Office Staff see the week as days over a time axis, each Job sized by its time on site",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const cory = await addCleaner("Cory Cleaner");
    await addCleaner("Dee Cleaner", [0, 4, 0, 0, 0, 0, 0]);
    const job = (await bookJob({
      startsAt: TUESDAY_9AM,
      labourHours: 5,
      crewSize: 2,
      service: "standard",
    })) as { id: string };
    await offerJob(job.id, cory.id, { confirmed: true });
    // another Client's Job asks to move onto Wednesday, holding its hours
    // (asked the week before: a request is for the next few weeks)
    const moving = (await bookJob({
      startsAt: "2027-03-04T14:00:00Z",
      labourHours: 3,
      // Wednesday has one Cleaner
      crewSize: 1,
    })) as { id: string };
    await setClock("2027-02-25T14:00:00Z");
    await requestReschedule(moving.id, { date: "2027-03-03", time: "13:00" });
    await signInAsOffice(page);

    await page.goto(week);

    await expect(day(page, "Tue, Mar 2")).toContainText(
      "5 h booked · 7 h free",
    );
    await expect(day(page, "Wed, Mar 3")).toContainText(
      "0 h booked · 3 h held · 5 h free",
    );
    await expect(day(page, "Sat, Mar 6")).toContainText("Nobody working");

    const block = jobsOn(page, "Tue, Mar 2").getByRole("link");
    await expect(block).toContainText(/9:00 AM Robin \d+/);
    await expect(block).toContainText("Needs cleaners");
    await expect(block).toContainText("Cory Cleaner");
    // placed at 9am, two hours down the axis, and 2.5 hours on site tall
    const column = (await jobsOn(page, "Tue, Mar 2").boundingBox())!;
    const box = (await block.boundingBox())!;
    expect(box.y - column.y).toBeCloseTo(2 * HOUR_PX, -1);
    expect(box.height).toBeCloseTo(2.5 * HOUR_PX, -1);

    await expect(
      page
        .getByRole("navigation", { name: "Office" })
        .getByRole("link", { name: "Schedule" }),
    ).toHaveAttribute("aria-current", "page");
  },
);

test("clicking a Job opens it", async ({ page }) => {
  await bookJob({ startsAt: TUESDAY_9AM, labourHours: 4 });
  await signInAsOffice(page);
  await page.goto(week);

  await jobsOn(page, "Tue, Mar 2").getByRole("link").click();

  await expect(page).toHaveURL(/\/office\/jobs\/[0-9a-f-]{36}$/);
  await expect(
    page.locator("#main").getByText("Tue, Mar 2, 9:00 AM", { exact: true }),
  ).toBeVisible();
});

test("an overbooked day says how far over it is", async ({ page }) => {
  await addCleaner("Cory Cleaner", [8, 8, 0, 0, 0, 0, 0]);
  await bookJob({ startsAt: "2027-03-01T14:00:00Z", labourHours: 9 });
  await signInAsOffice(page);

  await page.goto(week);

  await expect(day(page, "Mon, Mar 1")).toContainText("9 h booked · 1 h over");
});

test(
  "the Schedule moves a week at a time, keeping the range in the URL",
  { tag: "@desktop" },
  async ({ page }) => {
    await signInAsOffice(page);
    await page.goto(week);

    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page).toHaveURL(/from=2027-03-08&to=2027-03-14/);
    await expect(day(page, "Mon, Mar 8")).toBeVisible();
    await page.getByRole("button", { name: "Previous week" }).click();
    await page.getByRole("button", { name: "Previous week" }).click();
    await expect(page).toHaveURL(/from=2027-02-22&to=2027-02-28/);

    await page.getByRole("button", { name: "This week" }).click();
    await expect(page).not.toHaveURL(/from=2027-02-22/);
    const from = new URL(page.url()).searchParams.get("from")!;
    expect(weekdayOf(from)).toBe(0);
    await expect(page.getByRole("region")).toHaveCount(7);
  },
);

// a day on a phone, so its blocks have room to name their client, three days
// on anything wider; a span chosen is kept for the next visit
test(
  "the Schedule opens on a day from today on a phone and three days wider, then on the span last chosen",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    await signInAsOffice(page);
    const nav = page.getByRole("navigation", { name: "Office" });

    await nav.getByRole("link", { name: "Schedule" }).click();
    await expect(page.getByRole("region")).toHaveCount(isMobile ? 1 : 3);
    await expect(page.getByRole("button", { name: "Today" })).toBeVisible();

    // the other span from the one it opened on
    const [chosen, count] = isMobile ? ["Week", 7] : ["Day", 1];
    await page.getByRole("button", { name: /Show$/ }).click();
    await page.getByRole("option", { name: chosen, exact: true }).click();
    await expect(page.getByRole("region")).toHaveCount(count);

    // away and back, or a reload: still that span
    await nav.getByRole("link", { name: "Today" }).click();
    await expect(page).toHaveURL("/office");
    await nav.getByRole("link", { name: "Schedule" }).click();
    await expect(page.getByRole("region")).toHaveCount(count);
    await page.goto("/office/schedule");
    await expect(page.getByRole("region")).toHaveCount(count);

    // it pages by the span shown
    await page.goto("/office/schedule?from=2027-03-01&to=2027-03-01");
    await page.getByRole("button", { name: /Show$/ }).click();
    await page.getByRole("option", { name: "3 days" }).click();
    await expect(page).toHaveURL(/from=2027-03-01&to=2027-03-03/);
    await expect(page.getByRole("region")).toHaveCount(3);
    await page.getByRole("button", { name: "Next 3 days" }).click();
    await expect(page).toHaveURL(/from=2027-03-04&to=2027-03-06/);
    await expect(day(page, "Thu, Mar 4")).toBeVisible();

    await page.getByRole("button", { name: /Show$/ }).click();
    await page.getByRole("option", { name: "Day", exact: true }).click();
    await expect(page).toHaveURL(/from=2027-03-04&to=2027-03-04/);
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page).toHaveURL(/from=2027-03-03&to=2027-03-03/);
  },
);

// where a dragged block would land, drawn while it's dragged, by its
// Client's name: a box of its own, not the words on a block (a short Site
// Visit's)
const outlineOf = (page: Page, client = "Casey Client") =>
  page
    .getByRole("main")
    .getByText(new RegExp(`^\\d+:\\d+ [AP]M ${client}$`))
    .and(page.locator("div"));
const boxOf = async (of: Locator) => (await of.boundingBox())!;
// an edge's colour and line: the outline's top, a block's own left bar
const edgeOf = (of: Locator, side: "Top" | "Left") =>
  of.evaluate((element, side) => {
    const style = getComputedStyle(element);
    return [
      style.getPropertyValue(`border-${side.toLowerCase()}-color`),
      style.getPropertyValue(`border-${side.toLowerCase()}-style`),
    ];
  }, side);
// a block held mid-drag over a place: two moves, as the first only starts
// the drag (Playwright's mouse.down)
const holdOver = async (place: Locator, y?: number) => {
  const position = y === undefined ? undefined : { x: 10, y };
  await place.hover({ position });
  await place.hover({ position });
};

// Casey's Deep Clean at 9am on Tuesday 2 March 2027, accepted with a Deposit,
// with Cory Confirmed on it
const caseysJob = async () => {
  await createStaff(olive);
  await signUp(olive.email);
  const cory = await addCleaner("Cory Cleaner");
  const job = await acceptedJob({
    startsAt: TUESDAY_9AM,
    officeEmail: olive.email,
  });
  await offerJob(job.id, cory.id, { confirmed: true });
  return job;
};

test(
  "Office Staff drag a Job to another day and time, confirming first",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "dragging needs a mouse");
    await caseysJob();
    // Thursday is full
    await bookJob({ startsAt: "2027-03-04T14:00:00Z", labourHours: 8 });
    await signedInAs(page, olive.email);
    await page.goto(week);
    const block = jobsOn(page, "Tue, Mar 2").getByRole("link");
    const wednesday = jobsOn(page, "Wed, Mar 3");
    const thursday = jobsOn(page, "Thu, Mar 4");
    const outline = outlineOf(page);

    // held over a day with room, a dashed outline the Job's size and
    // colour shows where it would land: 10:30am on Wednesday
    await block.hover({ position: { x: 10, y: 5 } });
    await page.mouse.down();
    await holdOver(wednesday, 3.5 * HOUR_PX + 5);
    await expect(wednesday.getByText("10:30 AM Casey Client")).toBeVisible();
    await expect(outline).toHaveCount(1);
    const [held, day, job] = await Promise.all([
      boxOf(outline),
      boxOf(wednesday),
      boxOf(block),
    ]);
    expect(held.y - day.y).toBeCloseTo(3.5 * HOUR_PX + 1, 0);
    expect(held.height).toBeCloseTo(job.height, 0);
    const [jobColour] = await edgeOf(block.locator(".."), "Left");
    expect(await edgeOf(outline, "Top")).toEqual([jobColour, "dashed"]);
    // never past the day's last hour
    await holdOver(wednesday, day.height - 2);
    await expect(wednesday.getByText("6:45 PM Casey Client")).toBeVisible();
    const late = await boxOf(outline);
    expect(late.y + late.height).toBeLessThanOrEqual(day.y + day.height);
    // over a full day, which won't take it, the outline is red
    await holdOver(thursday, 3 * HOUR_PX + 5);
    await expect(thursday.getByText("10:00 AM Casey Client")).toBeVisible();
    const [fullColour] = await edgeOf(outline, "Top");
    expect(fullColour).not.toBe(jobColour);
    await holdOver(wednesday, 3.5 * HOUR_PX + 5);
    await expect(wednesday.getByText("10:30 AM Casey Client")).toBeVisible();
    // off the days, none; let go there, it stays put
    await holdOver(page.getByRole("heading", { name: "Schedule" }));
    await expect(outline).toHaveCount(0);
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // let go over the full day, it stays put
    await block.dragTo(thursday, {
      sourcePosition: { x: 10, y: 5 },
      targetPosition: { x: 10, y: 3 * HOUR_PX + 5 },
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // let go with its top at 10:30am on Wednesday
    await block.dragTo(jobsOn(page, "Wed, Mar 3"), {
      sourcePosition: { x: 10, y: 5 },
      targetPosition: { x: 10, y: 3.5 * HOUR_PX + 5 },
    });
    const dialog = page.getByRole("dialog", { name: "Move this job?" });
    // let go, the outline goes
    await expect(outline).toHaveCount(0);
    await expect(dialog).toContainText("FromTue, Mar 2, 9:00 AM");
    await expect(dialog).toContainText("ToWed, Mar 3, 10:30 AM");
    await expect(dialog).toContainText("There's room on Wed, Mar 3 then.");
    await expect(dialog).toContainText("we'll email them and the client");

    // nothing happens until it's confirmed
    await dialog.getByRole("button", { name: "Keep it" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(jobsOn(page, "Tue, Mar 2").getByRole("link")).toHaveCount(1);
    expect((await emailsTo(casey.email)).map((e) => e.subject)).not.toContain(
      "Your clean has moved",
    );

    await block.dragTo(jobsOn(page, "Wed, Mar 3"), {
      sourcePosition: { x: 10, y: 5 },
      targetPosition: { x: 10, y: 3.5 * HOUR_PX + 5 },
    });
    await dialog.getByRole("button", { name: "Move job" }).click();

    await expect(page.getByText("Job moved")).toBeVisible();
    const moved = jobsOn(page, "Wed, Mar 3").getByRole("link");
    await expect(moved).toContainText("10:30 AM Casey Client");
    // the whole crew is Offered it afresh
    await expect(moved).toContainText("Needs cleaners");
    await expect(jobsOn(page, "Tue, Mar 2").getByRole("link")).toHaveCount(0);
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your clean has moved",
    );
    expect((await emailsTo("cory@example.com")).at(-1)!.subject).toBe(
      "A job you're on has moved",
    );
  },
);

test(
  "a dragged Job's outline is red at a time without a crew free, and it isn't taken there",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "dragging needs a mouse");
    await caseysJob();
    // Wednesday's two Cleaners are both on a Job from 10 to 11: the day has
    // hours free, but no crew then
    await addCleaner("Dee Cleaner", [0, 0, 8, 0, 0, 0, 0]);
    await bookJob({
      startsAt: "2027-03-03T15:00:00Z",
      labourHours: 2,
      crewSize: 2,
    });
    await signedInAs(page, olive.email);
    await page.goto(week);
    const block = jobsOn(page, "Tue, Mar 2").getByRole("link");
    const wednesday = jobsOn(page, "Wed, Mar 3");
    const outline = outlineOf(page);
    const [jobColour] = await edgeOf(block.locator(".."), "Left");

    await block.hover({ position: { x: 10, y: 5 } });
    await page.mouse.down();
    // at 10:30 its crew would meet theirs: red
    await holdOver(wednesday, 3.5 * HOUR_PX + 5);
    await expect(wednesday.getByText("10:30 AM Casey Client")).toBeVisible();
    await expect
      .poll(async () => (await edgeOf(outline, "Top"))[0])
      .not.toBe(jobColour);
    // at 11, once they're done, its own colours
    await holdOver(wednesday, 4 * HOUR_PX + 5);
    await expect(wednesday.getByText("11:00 AM Casey Client")).toBeVisible();
    expect(await edgeOf(outline, "Top")).toEqual([jobColour, "dashed"]);
    // let go at 10:30, it stays put
    await holdOver(wednesday, 3.5 * HOUR_PX + 5);
    await expect(wednesday.getByText("10:30 AM Casey Client")).toBeVisible();
    await page.mouse.up();
    await expect(outline).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // let go at 11, the move is asked: at 11, not the 10:30 refused
    await block.dragTo(wednesday, {
      sourcePosition: { x: 10, y: 5 },
      targetPosition: { x: 10, y: 4 * HOUR_PX + 5 },
    });
    const dialog = page.getByRole("dialog", { name: "Move this job?" });
    await expect(dialog).toContainText("ToWed, Mar 3, 11:00 AM");
    await expect(dialog).toContainText("There's room on Wed, Mar 3 then.");
  },
);

test("Office Staff move a Job from the Job screen, at any width", async ({
  page,
}) => {
  const job = await caseysJob();
  // Thursday is full, and on Friday Cory is at another home from 9 to 10
  await bookJob({ startsAt: "2027-03-04T14:00:00Z", labourHours: 8 });
  await bookJob({
    startsAt: "2027-03-05T14:00:00Z",
    labourHours: 1,
    crewSize: 1,
  });
  await signedInAs(page, olive.email);
  await page.goto(`/office/jobs/${job.id}`);

  await pageAction(page, "Move job");
  const dialog = page.getByRole("dialog", { name: "Move this job" });
  await expect(dialog).toContainText(
    "That's when it's booked now. Pick a different time.",
  );
  const moveButton = dialog.getByRole("button", { name: "Move job" });
  await expect(moveButton).toBeDisabled();

  const dayField = dialog.getByRole("group", { name: "Day" });
  await dayField.getByRole("spinbutton", { name: /^day/ }).click();
  await page.keyboard.type("04");
  await expect(dialog).toContainText(
    "That day is too full for this job. Pick another time, or give a cleaner more working hours that day.",
  );
  await expect(moveButton).toBeDisabled();

  await dayField.getByRole("spinbutton", { name: /^day/ }).click();
  await page.keyboard.type("05");
  await expect(dialog).toContainText(
    "Not enough cleaners are free then. Pick another time, or give a cleaner more working hours that day.",
  );
  await expect(moveButton).toBeDisabled();
  await dialog
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type("0115PM");
  await expect(dialog).toContainText("ToFri, Mar 5, 1:15 PM");
  await moveButton.click();

  await expect(page.getByText("Job moved")).toBeVisible();
  await expect(
    page.locator("#main").getByText("Fri, Mar 5, 1:15 PM", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0 of 1 Cleaner Confirmed")).toBeVisible();
});

test("a Job that has started, or isn't booked, can't be moved", async ({
  page,
}) => {
  const job = (await bookJob({
    startsAt: "2026-01-06T14:00:00Z",
    labourHours: 4,
  })) as { id: string };
  await signInAsOffice(page);
  await page.goto("/office/schedule?from=2026-01-05&to=2026-01-11");
  const block = page
    .getByRole("group", { name: "Jobs on Tue, Jan 6" })
    .locator("[draggable]");
  await expect(block).toHaveAttribute("draggable", "true");

  await setClock("2026-01-06T14:30:00Z");
  await page.reload();
  await expect(block).toHaveAttribute("draggable", "false");
  await page.goto(`/office/jobs/${job.id}`);
  await expectNoPageAction(page, "Move job");
});

test(
  "Office Staff drag a Site Visit to a new time, its outline red where its visitor is busy",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "dragging needs a mouse");
    await requestQuoteForPremises(casey, "Acme Dental");
    const cory = await addCleaner("Cory Cleaner");
    // a second Cleaner, so a crew is free while Cory is on a Job
    await addCleaner("Dee Cleaner");
    await bookSiteVisit({
      street: "200 Park Ave S",
      staffEmail: cory.email,
      date: "2027-03-02",
      time: "09:00",
    });
    // Cory is on a Job from 10 to 12 on Wednesday
    const job = (await bookJob({
      startsAt: "2027-03-03T15:00:00Z",
      labourHours: 2,
      crewSize: 1,
    })) as { id: string };
    await offerJob(job.id, cory.id, { confirmed: true });
    // the API's clock, for the browser too: these times are still to come
    await page.clock.setFixedTime("2026-01-05T09:00:00Z");
    await signInAsOffice(page);
    await page.goto(week);
    const block = jobsOn(page, "Tue, Mar 2").getByRole("link", {
      name: /Acme Dental/,
    });
    const wednesday = jobsOn(page, "Wed, Mar 3");
    const outline = outlineOf(page, "Acme Dental");
    const [visitColour] = await edgeOf(block.locator(".."), "Left");

    await block.hover({ position: { x: 10, y: 5 } });
    await page.mouse.down();
    // at 10:30 Cory is on the Job: red
    await holdOver(wednesday, 3.5 * HOUR_PX + 5);
    await expect(wednesday.getByText("10:30 AM Acme Dental")).toBeVisible();
    await expect
      .poll(async () => (await edgeOf(outline, "Top"))[0])
      .not.toBe(visitColour);
    // at 1pm, free again: its own colours
    await holdOver(wednesday, 6 * HOUR_PX + 5);
    await expect(wednesday.getByText("1:00 PM Acme Dental")).toBeVisible();
    expect(await edgeOf(outline, "Top")).toEqual([visitColour, "dashed"]);
    // let go at 10:30, it stays put
    await holdOver(wednesday, 3.5 * HOUR_PX + 5);
    await expect(wednesday.getByText("10:30 AM Acme Dental")).toBeVisible();
    await page.mouse.up();
    await expect(outline).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // let go at 1pm, the move is asked first
    await block.dragTo(wednesday, {
      sourcePosition: { x: 10, y: 5 },
      targetPosition: { x: 10, y: 6 * HOUR_PX + 5 },
    });
    const dialog = page.getByRole("dialog", { name: "Move this site visit?" });
    await expect(dialog).toContainText("FromTue, Mar 2, 9:00 AM");
    await expect(dialog).toContainText("ToWed, Mar 3, 1:00 PM");
    await expect(dialog).toContainText("Cory Cleaner still makes it");
    await dialog.getByRole("button", { name: "Move site visit" }).click();

    await expect(page.getByText("Site visit moved")).toBeVisible();
    await expect(
      wednesday.getByRole("link", { name: /1:00 PM Acme Dental/ }),
    ).toBeVisible();
    await expect(
      jobsOn(page, "Tue, Mar 2").getByRole("link", { name: /Acme Dental/ }),
    ).toHaveCount(0);
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your site visit has moved",
    );
  },
);

test(
  "a missed Site Visit drags to a time to come, not to a time passed; a Done one doesn't drag",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "dragging needs a mouse");
    await requestQuoteForPremises(casey, "Acme Dental");
    await createStaff(olive);
    const visit = await bookSiteVisit({
      street: "200 Park Ave S",
      staffEmail: olive.email,
      date: "2027-03-02",
      time: "09:00",
    });
    // noon on Wednesday: Tuesday's visit was missed, for the server and the
    // browser alike
    const NOON = "2027-03-03T17:00:00Z";
    await setClock(NOON);
    await page.clock.setFixedTime(NOON);
    await signedInAs(page, olive.email);
    await page.goto(week);
    const block = jobsOn(page, "Tue, Mar 2").getByRole("link", {
      name: /Acme Dental/,
    });
    const wednesday = jobsOn(page, "Wed, Mar 3");
    const outline = outlineOf(page, "Acme Dental");
    const [visitColour] = await edgeOf(block.locator(".."), "Left");
    await expect(block.locator("..")).toHaveAttribute("draggable", "true");

    // 10:30 on Wednesday has passed: red, and not taken there
    await block.hover({ position: { x: 10, y: 5 } });
    await page.mouse.down();
    await holdOver(wednesday, 3.5 * HOUR_PX + 5);
    await expect(wednesday.getByText("10:30 AM Acme Dental")).toBeVisible();
    await expect
      .poll(async () => (await edgeOf(outline, "Top"))[0])
      .not.toBe(visitColour);
    await page.mouse.up();
    await expect(outline).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 1pm is to come: it moves there
    await block.dragTo(wednesday, {
      sourcePosition: { x: 10, y: 5 },
      targetPosition: { x: 10, y: 6 * HOUR_PX + 5 },
    });
    const dialog = page.getByRole("dialog", { name: "Move this site visit?" });
    await expect(dialog).toContainText("ToWed, Mar 3, 1:00 PM");
    await dialog.getByRole("button", { name: "Move site visit" }).click();
    await expect(page.getByText("Site visit moved")).toBeVisible();
    const moved = wednesday.getByRole("link", { name: /1:00 PM Acme Dental/ });
    await expect(moved).toBeVisible();

    // once its findings are recorded, it's Done and doesn't drag
    await page.goto(`/office/site-visits/${visit.id}`);
    await page.getByRole("button", { name: "Record findings" }).click();
    const findings = page.getByRole("dialog", {
      name: "What the site visit found",
    });
    await findings.getByText("Moderate", { exact: true }).click();
    await findings.getByRole("button", { name: "Save findings" }).click();
    await expect(page.getByText("Findings recorded").first()).toBeVisible();
    await page.goto(week);
    await expect(moved.locator("..")).toHaveAttribute("draggable", "false");
  },
);

test("the Schedule passes automated accessibility checks", async ({ page }) => {
  await addCleaner("Cory Cleaner");
  await bookJob({ startsAt: TUESDAY_9AM, labourHours: 5 });
  await signInAsOffice(page);
  await page.goto(week);
  await expect(jobsOn(page, "Tue, Mar 2").getByRole("link")).toBeVisible();

  await expectAccessible(page);
});

// two boxes on screen share no area
const apart = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) =>
  a.x + a.width <= b.x ||
  b.x + b.width <= a.x ||
  a.y + a.height <= b.y ||
  b.y + b.height <= a.y;

test(
  "Jobs at the same time sit side by side, short ones too",
  { tag: ["@desktop"] },
  async ({ page }) => {
    await addCleaner("Cory Cleaner");
    await addCleaner("Dee Cleaner");
    // two crews on Tuesday morning
    await bookJob({ startsAt: TUESDAY_9AM, labourHours: 4, crewSize: 1 });
    await bookJob({
      startsAt: "2027-03-02T15:00:00Z",
      labourHours: 2,
      crewSize: 1,
    });
    // on Wednesday, half an hour on site at 9:00 and again at 9:30: drawn
    // taller than that, they'd cover each other if they shared a lane
    await bookJob({
      startsAt: "2027-03-03T14:00:00Z",
      labourHours: 1,
      crewSize: 2,
    });
    await bookJob({
      startsAt: "2027-03-03T14:30:00Z",
      labourHours: 0.5,
      crewSize: 2,
    });
    await signInAsOffice(page);
    // three days, which always show every lane, even at phone width
    await page.goto("/office/schedule?from=2027-03-02&to=2027-03-04");

    for (const name of ["Tue, Mar 2", "Wed, Mar 3"]) {
      const blocks = jobsOn(page, name).getByRole("link");
      await expect(blocks).toHaveCount(2);
      const [a, b] = await blocks.all();
      expect(apart((await a!.boundingBox())!, (await b!.boundingBox())!)).toBe(
        true,
      );
    }
    // too short for more than its Client and its mark, a block still says
    // its time and state to a screen reader, which can't see its place
    const short = jobsOn(page, "Wed, Mar 3")
      .getByRole("link")
      .filter({ hasText: "9:30 AM" });
    await expect(short).toHaveAccessibleName(
      /^9:30 AM Robin \d+ ?, Needs cleaners$/,
    );
  },
);

// a block too small to wrap keeps its Client's name: its time is its place on
// the grid, its state a mark beside the name, both read out (#493 G4.1)
test(
  "a day's blocks lead with their Client, each state a mark",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    await requestQuoteForPremises(casey, "Acme Dental");
    const cory = await addCleaner("Cory Cleaner");
    await addCleaner("Dee Cleaner");
    // Tuesday: one staffed and one short of cleaners at 9, side by side,
    // one Cory couldn't get into at 11:30, a short one at 1, a site visit at 3
    const staffed = (await bookJob({
      startsAt: TUESDAY_9AM,
      labourHours: 2,
      crewSize: 1,
    })) as { id: string };
    await offerJob(staffed.id, cory.id, { confirmed: true });
    await bookJob({ startsAt: TUESDAY_9AM, labourHours: 4 });
    await bookJob({ startsAt: "2027-03-02T18:00:00Z", labourHours: 1 });
    await bookSiteVisit({
      street: "200 Park Ave S",
      staffEmail: cory.email,
      date: "2027-03-02",
      time: "15:00",
    });
    const missed = (await bookJob({
      startsAt: "2027-03-02T16:30:00Z",
      labourHours: 1,
      crewSize: 1,
    })) as { id: string };
    await offerJob(missed.id, cory.id, { confirmed: true });
    await setClock("2027-03-02T17:00:00Z");
    await recordNoAccess(missed.id, cory.id, "Nobody answered");
    await signInAsOffice(page);

    // a phone opens on a day; a wider screen shows the week
    await page.goto(
      isMobile ? "/office/schedule?from=2027-03-02&to=2027-03-02" : week,
    );

    const blocks = jobsOn(page, "Tue, Mar 2").getByRole("link");
    await expect(blocks).toHaveCount(5);
    // the name leads what's seen, the time first in what's read out; a
    // crew line only where someone's on it
    await expect(
      blocks.filter({ hasText: "9:00 AM" }).filter({ hasText: "Cory Cleaner" }),
    ).toHaveAccessibleName(/^9:00 AM Robin \d+ ?, Staffed ?, Cory Cleaner$/);
    await expect(
      blocks
        .filter({ hasText: "9:00 AM" })
        .filter({ hasNotText: "Cory Cleaner" }),
    ).toHaveAccessibleName(/^9:00 AM Robin \d+ ?, Needs cleaners$/);
    await expect(blocks.filter({ hasText: "Site visit" })).toHaveAccessibleName(
      /^3:00 PM Acme Dental ?, Site visit · 30 min ?, Cory Cleaner$/,
    );
    const short = blocks.filter({ hasText: "1:00 PM" });
    await expect(short).toHaveAccessibleName(
      /^1:00 PM Robin \d+ ?, Needs cleaners$/,
    );
    // its state a mark, not words; its time not shown, as it hasn't room
    await expect(short.locator("svg")).toBeVisible();
    // read out only: drawn 1px wide, as a screen reader's words are
    for (const words of ["Needs cleaners", "1:00 PM"]) {
      const box = (await short.getByText(words).boundingBox())!;
      expect(box.width, words).toBeLessThanOrEqual(1);
    }
    await expect(blocks.filter({ hasText: "11:30 AM" })).toHaveAccessibleName(
      /^11:30 AM Robin \d+ ?, Couldn't get in ?, Cory Cleaner$/,
    );
    // a line that doesn't fit isn't drawn cut in half: each line of words
    // keeps its height, and ends above the edge that clips it or starts
    // past it, not drawn
    const cut = await blocks.evaluateAll((links) =>
      links.flatMap((link) =>
        [...link.querySelectorAll("span")]
          .filter((span) => !span.closest(".sr-only"))
          .filter((span) =>
            [...span.childNodes].some(
              (node) => node.nodeType === 3 && node.textContent!.trim(),
            ),
          )
          .filter((span) => {
            // the nearest edge clipping it: a box around it, up to the block
            let edge = Infinity;
            for (
              let box = span.parentElement;
              box && box !== link.parentElement!.parentElement;
              box = box.parentElement
            ) {
              if (getComputedStyle(box).overflow === "hidden") {
                edge = Math.min(edge, box.getBoundingClientRect().bottom);
              }
            }
            const line = span.getBoundingClientRect();
            const squeezed = span.scrollHeight > span.clientHeight + 1;
            return (
              squeezed || (line.top < edge - 0.5 && line.bottom > edge + 0.5)
            );
          })
          .map((span) => span.textContent),
      ),
    );
    expect(cut).toEqual([]);
  },
);

test(
  "a busy day in the week view lists the Jobs that don't fit side by side",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const cory = await addCleaner("Cory Cleaner");
    for (const name of ["Dee", "Eve", "Fay"]) {
      await addCleaner(`${name} Cleaner`);
    }
    // four crews at once on Tuesday morning: the earliest has its crew, the
    // other three don't yet
    const assigned = (await bookJob({
      startsAt: "2027-03-02T13:00:00Z",
      labourHours: 4,
      crewSize: 1,
    })) as { id: string };
    await offerJob(assigned.id, cory.id, { confirmed: true });
    for (const startsAt of [
      TUESDAY_9AM,
      "2027-03-02T14:30:00Z",
      "2027-03-02T15:00:00Z",
    ]) {
      await bookJob({ startsAt, labourHours: 4, crewSize: 1 });
    }
    await signInAsOffice(page);
    await page.goto(week);

    // too narrow for all four: the Unassigned ones stay in sight, and none
    // is a sliver
    const tuesday = day(page, "Tue, Mar 2");
    const blocks = jobsOn(page, "Tue, Mar 2").getByRole("link");
    await expect(blocks.first()).toBeVisible();
    const shown = await blocks.count();
    expect(shown).toBeLessThan(4);
    for (const block of await blocks.all()) {
      await expect(block).toContainText("Needs cleaners");
      expect((await block.boundingBox())!.width).toBeGreaterThanOrEqual(50);
    }
    await expect(blocks.filter({ hasText: "9:00 AM" })).toHaveCount(1);
    await expect(blocks.filter({ hasText: "8:00 AM" })).toHaveCount(0);

    // the rest are listed, and each opens its Job
    await tuesday.getByRole("button", { name: `+${4 - shown} more` }).click();
    const more = page.getByRole("dialog", { name: "More Jobs on Tue, Mar 2" });
    const rows = more.getByRole("row");
    await expect(rows).toHaveCount(4 - shown);
    await expect(rows.first()).toContainText("8:00 AM");
    await expect(rows.first()).toContainText("Staffed");
    await expect(rows.first()).toContainText("Cory Cleaner");
    await rows.first().click();
    await expect(page).toHaveURL(`/office/jobs/${assigned.id}`);

    // with the room of a single day, every Job shows side by side
    await page.goto("/office/schedule?from=2027-03-02&to=2027-03-02");
    await expect(jobsOn(page, "Tue, Mar 2").getByRole("link")).toHaveCount(4);
    await expect(
      day(page, "Tue, Mar 2").getByRole("button", { name: /more$/ }),
    ).toHaveCount(0);
  },
);

test(
  "Office Staff pick where to move a Job from the Schedule",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const job = await caseysJob();
    await signedInAs(page, olive.email);
    await page.goto(`/office/jobs/${job.id}`);

    await pageAction(page, "Move job");
    // the Schedule in the dialog itself, never a dialog on a dialog
    const dialog = page.getByRole("dialog", { name: "Move this job" });
    const schedule = dialog;
    // the Job where it is now, on Tuesday
    await expect(
      schedule.getByRole("group", { name: "Jobs on Tue, Mar 2" }),
    ).toContainText("9:00 AM");
    if (page.viewportSize()!.width < 768) {
      for (let i = 0; i < 3; i += 1) {
        await schedule.getByRole("button", { name: "Next day" }).click();
      }
    }
    await schedule.getByRole("button", { name: "Fri, Mar 5, 1:00 PM" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(dialog).toContainText("ToFri, Mar 5, 1:00 PM");
    await dialog.getByRole("button", { name: "Move job" }).click();
    await expect(
      page.locator("#main").getByText("Fri, Mar 5, 1:00 PM", { exact: true }),
    ).toBeVisible();
  },
);
