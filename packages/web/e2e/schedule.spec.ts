import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
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

// a week far from today, so the tests don't depend on the date they run:
// Monday 1 March 2027 to Sunday 7 March. The API's clock is in January 2026,
// so every Job in it is still to come.
const week = "/office/schedule?from=2027-03-01&to=2027-03-07";
const TUESDAY_9AM = "2027-03-02T14:00:00Z";

// the time axis starts at 7am, an hour to 48px
const HOUR_PX = 48;

const cleaner = async (name: string, usualWeek: number[]) => {
  const member = (await createStaff({
    name,
    email: `${name.split(" ")[0]!.toLowerCase()}@example.com`,
    roles: ["cleaner"],
  })) as { id: string };
  await setUsualWeek(member.id, usualWeek);
  return member;
};

const day = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });
const jobsOn = (page: Page, name: string) =>
  page.getByRole("group", { name: `Jobs on ${name}` });

test(
  "Office Staff see the week as days over a time axis, each Job sized by its time on site",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    const cory = await cleaner("Cory Cleaner", [8, 8, 8, 8, 8, 0, 0]);
    await cleaner("Dee Cleaner", [0, 4, 0, 0, 0, 0, 0]);
    const job = (await bookJob({
      startsAt: TUESDAY_9AM,
      labourHours: 5,
      crewSize: 2,
      cleanType: "standard",
    })) as { id: string };
    await offerPlace(job.id, cory.id, { confirmed: true });
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
    await expect(day(page, "Sat, Mar 6")).toContainText("Nobody available");

    const block = jobsOn(page, "Tue, Mar 2").getByRole("link");
    await expect(block).toContainText(/9:00 AM Client \d+/);
    await expect(block).toContainText("Unassigned");
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tue, Mar 2, 9:00 AM",
  );
});

test("an overbooked day says how far over it is", async ({ page }) => {
  await cleaner("Cory Cleaner", [8, 8, 0, 0, 0, 0, 0]);
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
    expect(new Date(`${from}T00:00:00Z`).getUTCDay()).toBe(1);
    await expect(page.getByRole("region")).toHaveCount(7);
  },
);

test("a phone shows today, then a day or three days at a time", async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width >= 768, "a phone's view");
  await signInAsOffice(page);

  await page
    .getByRole("navigation", { name: "Office" })
    .getByRole("link", { name: "Schedule" })
    .click();
  await expect(page.getByRole("region")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Today" })).toBeVisible();

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
});

// Casey's Deep Clean at 9am on Tuesday 2 March 2027, accepted with a Deposit,
// with Cory Confirmed on it
const caseysJob = async () => {
  await createStaff(olive);
  await signUp(olive.email);
  const cory = await cleaner("Cory Cleaner", [8, 8, 8, 8, 8, 0, 0]);
  const job = await acceptedJob({
    startsAt: TUESDAY_9AM,
    officeEmail: olive.email,
  });
  await offerPlace(job.id, cory.id, { confirmed: true });
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

    // a full day doesn't take it
    await block.dragTo(jobsOn(page, "Thu, Mar 4"), {
      sourcePosition: { x: 10, y: 5 },
      targetPosition: { x: 10, y: 3 * HOUR_PX + 5 },
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // let go with its top at 10:30am on Wednesday
    await block.dragTo(jobsOn(page, "Wed, Mar 3"), {
      sourcePosition: { x: 10, y: 5 },
      targetPosition: { x: 10, y: 3.5 * HOUR_PX + 5 },
    });
    const dialog = page.getByRole("dialog", { name: "Move this Job?" });
    await expect(dialog).toContainText("FromTue, Mar 2, 9:00 AM");
    await expect(dialog).toContainText("ToWed, Mar 3, 10:30 AM");
    await expect(dialog).toContainText("Wed, Mar 3 has 8 h free");
    await expect(dialog).toContainText("the Client and the crew are emailed");

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
    await dialog.getByRole("button", { name: "Move Job" }).click();

    await expect(page.getByText("Job moved")).toBeVisible();
    const moved = jobsOn(page, "Wed, Mar 3").getByRole("link");
    await expect(moved).toContainText("10:30 AM Casey Client");
    // every place is Offered afresh
    await expect(moved).toContainText("Unassigned");
    await expect(jobsOn(page, "Tue, Mar 2").getByRole("link")).toHaveCount(0);
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your clean has moved",
    );
    expect((await emailsTo("cory@example.com")).at(-1)!.subject).toBe(
      "A Job you're on has moved",
    );
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

  await page.getByRole("button", { name: "Move Job" }).click();
  const dialog = page.getByRole("dialog", { name: "Move this Job" });
  await expect(dialog).toContainText("That's when it's booked");
  const moveButton = dialog.getByRole("button", { name: "Move Job" });
  await expect(moveButton).toBeDisabled();

  const dayField = dialog.getByRole("group", { name: "Day" });
  await dayField.getByRole("spinbutton", { name: /^day/ }).click();
  await page.keyboard.type("04");
  await expect(dialog).toContainText("Thu, Mar 4 doesn't have room");
  await expect(moveButton).toBeDisabled();

  await dayField.getByRole("spinbutton", { name: /^day/ }).click();
  await page.keyboard.type("05");
  await expect(dialog).toContainText(
    "Not enough Cleaners are free at 9:00 AM: this Job needs 1, and 0 of the 1 available that day are.",
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Fri, Mar 5, 1:15 PM",
  );
  await expect(page.getByText("0 of 1 place Confirmed")).toBeVisible();
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
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Move Job" })).toHaveCount(0);
});

test("the Schedule passes automated accessibility checks", async ({ page }) => {
  await cleaner("Cory Cleaner", [8, 8, 8, 8, 8, 0, 0]);
  await bookJob({ startsAt: TUESDAY_9AM, labourHours: 5 });
  await signInAsOffice(page);
  await page.goto(week);
  await expect(jobsOn(page, "Tue, Mar 2").getByRole("link")).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
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
    await cleaner("Cory Cleaner", [8, 8, 8, 8, 8, 0, 0]);
    await cleaner("Dee Cleaner", [8, 8, 8, 8, 8, 0, 0]);
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
    // too short for every line, a block still says them all to a screen
    // reader
    const short = jobsOn(page, "Wed, Mar 3")
      .getByRole("link")
      .filter({ hasText: "9:30 AM" });
    await expect(short).toHaveAccessibleName(
      /9:30 AM Client \d+ ?, Unassigned, No crew yet/,
    );
  },
);

test(
  "a busy day in the week view lists the Jobs that don't fit side by side",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const cory = await cleaner("Cory Cleaner", [8, 8, 8, 8, 8, 0, 0]);
    for (const name of ["Dee", "Eve", "Fay"]) {
      await cleaner(`${name} Cleaner`, [8, 8, 8, 8, 8, 0, 0]);
    }
    // four crews at once on Tuesday morning: the earliest has its crew, the
    // other three don't yet
    const assigned = (await bookJob({
      startsAt: "2027-03-02T13:00:00Z",
      labourHours: 4,
      crewSize: 1,
    })) as { id: string };
    await offerPlace(assigned.id, cory.id, { confirmed: true });
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
      await expect(block).toContainText("Unassigned");
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
    await expect(rows.first()).toContainText("Assigned");
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

    await page.getByRole("button", { name: "Move Job" }).click();
    const dialog = page.getByRole("dialog", { name: "Move this Job" });
    await dialog
      .getByRole("button", { name: "Pick from the Schedule" })
      .click();
    const schedule = page.getByRole("dialog", {
      name: "Pick from the Schedule",
    });
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

    await expect(schedule).toBeHidden();
    await expect(dialog).toContainText("ToFri, Mar 5, 1:00 PM");
    await dialog.getByRole("button", { name: "Move Job" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fri, Mar 5, 1:00 PM",
    );
  },
);
