import type { Page } from "@playwright/test";
import {
  bookJob,
  bookSiteVisit,
  createClient,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  offerJob,
  requestQuoteForPremises,
  setGooglePicture,
  signInWithLink,
  signedInAs,
  test,
  goTo,
  addCleaner,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const cory = {
  email: "cory@example.com",
  name: "Cory Cleaner",
  roles: ["cleaner" as const],
};

const signInAsOffice = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");
};

const openStaffMember = async (page: Page, name: string) => {
  await goTo(page, "Staff");
  await page.getByRole("row", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

test(
  "Office Staff invite a Cleaner, who signs up with that email and lands in the Cleaner area",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    await signInAsOffice(page);
    await goTo(page, "Staff");
    await expect(page).toHaveURL("/office/staff");

    await page.getByRole("button", { name: "Invite Staff" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite Staff" });
    await dialog.getByRole("textbox", { name: "Name" }).fill(cory.name);
    await dialog.getByRole("textbox", { name: "Email" }).fill(cory.email);
    await expect(
      dialog.getByRole("checkbox", { name: /Cleaner/ }),
    ).toBeChecked();
    await dialog.getByRole("button", { name: "Send invitation" }).click();

    await expect(
      page.getByText("Invitation sent to cory@example.com"),
    ).toBeVisible();
    const row = page.getByRole("row", { name: /Cory Cleaner/ });
    await expect(row).toContainText("Invited");

    // Cory, in their own browser
    const corysBrowser = await browser.newContext();
    const corysPage = await corysBrowser.newPage();
    await corysPage.goto("/sign-in");
    await signInWithLink(corysPage, cory.email);
    await expect(corysPage).toHaveURL("/cleaner");
    await corysBrowser.close();

    await page.reload();
    await expect(row).not.toContainText("Invited");
  },
);

test("each Staff member shows their Google picture, or a plain icon without one", async ({
  page,
}) => {
  await createStaff(cory);
  await createStaff({
    name: "Ivy Invited",
    email: "ivy@example.com",
    roles: ["cleaner"],
  });
  await signedInAs(page, cory.email);
  await setGooglePicture(
    cory.email,
    "https://lh3.googleusercontent.com/a/cory-photo",
  );
  // Google's servers, stood in for: a 1 x 1 picture
  await page.route("https://lh3.googleusercontent.com/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );
  await page.context().clearCookies();
  await signInAsOffice(page);

  await goTo(page, "Staff");

  const corysPicture = page
    .getByRole("row", { name: /Cory Cleaner/ })
    .locator("img");
  await expect(corysPicture).toHaveAttribute(
    "src",
    "https://lh3.googleusercontent.com/a/cory-photo",
  );
  await expect
    .poll(() =>
      corysPicture.evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(1);
  // never signed up, so no picture: the icon instead
  const ivy = page.getByRole("row", { name: /Ivy Invited/ });
  await expect(ivy.locator("img")).toHaveCount(0);
  await expect(ivy.locator("svg").first()).toBeVisible();

  // and larger on their own page
  await page.getByRole("row", { name: /Cory Cleaner/ }).click();
  await expect(page.getByRole("main").locator("img")).toHaveAttribute(
    "src",
    "https://lh3.googleusercontent.com/a/cory-photo",
  );
});

test("an invitation needs a role, and can't repeat someone on Staff", async ({
  page,
}) => {
  await createStaff(cory);
  await signInAsOffice(page);
  await page.goto("/office/staff");
  await page.getByRole("button", { name: "Invite Staff" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite Staff" });
  await dialog.getByRole("textbox", { name: "Name" }).fill(cory.name);
  await dialog.getByRole("textbox", { name: "Email" }).fill(cory.email);

  await dialog.getByText(/^Cleaner/).click();
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(dialog.getByText("Choose at least one role")).toBeVisible();

  await dialog.getByText(/^Office Staff/).click();
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(
    dialog.getByText("Cory Cleaner is already on Staff"),
  ).toBeVisible();
});

test(
  "Office Staff deactivate a Cleaner, who loses Staff access but stays a Client",
  { tag: "@desktop" },
  async ({ page, browser }) => {
    await createStaff(cory);
    await createClient({ email: cory.email, name: cory.name });
    const corysBrowser = await browser.newContext();
    const corysPage = await corysBrowser.newPage();
    await signedInAs(corysPage, cory.email);
    await expect(corysPage).toHaveURL("/cleaner");

    await signInAsOffice(page);
    await openStaffMember(page, "Cory Cleaner");
    await page.getByRole("button", { name: "Deactivate" }).click();
    const confirm = page.getByRole("alertdialog", {
      name: "Deactivate Cory Cleaner?",
    });
    await confirm.getByRole("button", { name: "Deactivate" }).click();

    await expect(page.getByText("Cory Cleaner deactivated")).toBeVisible();
    await expect(page.getByText("Deactivated", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deactivate" })).toHaveCount(
      0,
    );

    // the Cleaner area is closed to them; the portal still opens
    await corysPage.goto("/cleaner");
    await expect(corysPage).toHaveURL("/portal");
    await corysBrowser.close();
  },
);

test("the last Office Staff member can't deactivate themselves", async ({
  page,
}) => {
  await signInAsOffice(page);
  await openStaffMember(page, "Olive Owner");
  await page.getByRole("button", { name: "Deactivate" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Deactivate" })
    .click();

  await expect(
    page.getByText(
      "Empire Cleaning needs at least one active Office Staff member",
    ),
  ).toBeVisible();
});

test(
  "Office Staff set a Cleaner's usual week, and a day off",
  { tag: "@smoke" },
  async ({ page }) => {
    await createStaff(cory);
    await signInAsOffice(page);
    await openStaffMember(page, "Cory Cleaner");

    const editWeek = async () => {
      await page.getByRole("button", { name: "Edit usual week" }).click();
      return page.getByRole("dialog", { name: "Usual week" });
    };
    let week = await editWeek();
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday"]) {
      await week.getByRole("textbox", { name: day }).fill("8");
    }
    await week.getByRole("textbox", { name: "Friday" }).fill("6.5");
    await week.getByRole("button", { name: "Save usual week" }).click();
    await expect(page.getByText("Usual week saved")).toBeVisible();

    // the 15th of next month, on the calendar
    const fifteenth = () =>
      page.getByRole("button", { name: /^\w{3}, \w{3} 15 / });
    await page.getByRole("button", { name: "Next month" }).click();
    await fifteenth().click();
    const day = page.getByRole("dialog");
    await day.getByRole("textbox", { name: "Hours that day" }).fill("0");
    await day.getByRole("textbox", { name: "Note (optional)" }).fill("Holiday");
    await day.getByRole("button", { name: "Save day" }).click();
    await expect(page.getByText(/ 15 saved$/)).toBeVisible();

    await page.reload();
    week = await editWeek();
    await expect(week.getByRole("textbox", { name: "Friday" })).toHaveValue(
      "6.5",
    );
    await expect(week.getByRole("textbox", { name: "Saturday" })).toHaveValue(
      "0",
    );
    await week.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Next month" }).click();
    await expect(fifteenth()).toHaveAccessibleName(
      / 15 Off \(differs from the usual week\)$/,
    );
    await fifteenth().click();
    await expect(page.getByRole("dialog")).toContainText("Usually");
    await expect(
      page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Note (optional)" }),
    ).toHaveValue("Holiday");
    await page.getByRole("button", { name: "Back to the usual week" }).click();
    await expect(
      page.getByText(/ 15 is back to the usual week$/),
    ).toBeVisible();
    await expect(fifteenth()).not.toHaveAccessibleName(/differs/);
  },
);

// the API's fake clock is at 4am on Monday 5 January 2026 in New York;
// the calendar starts on the browser's today, so it's set to that day too
const API_NOW = new Date("2026-01-05T09:00:00Z");

const dayOnCalendar = (page: Page, day: string) =>
  page.getByRole("button", { name: new RegExp(`^${day} `) });

test("a day off frees a Cleaner's Jobs, and so does deactivating them, each said first", async ({
  page,
}) => {
  const member = await addCleaner(cory.name);
  for (const startsAt of ["2026-01-08T14:00:00Z", "2026-01-09T14:00:00Z"]) {
    const job = (await bookJob({ startsAt, labourHours: 3, crewSize: 1 })) as {
      id: string;
    };
    await offerJob(job.id, member.id, { confirmed: true });
  }
  await page.clock.setFixedTime(API_NOW);
  await signInAsOffice(page);
  await openStaffMember(page, "Cory Cleaner");

  await dayOnCalendar(page, "Thu, Jan 8").click();
  const day = page.getByRole("dialog");
  await expect(day).not.toContainText("for other free Cleaners");
  await day.getByRole("textbox", { name: "Hours that day" }).fill("0");
  // saving straight from the field first shows what it frees
  await day.getByRole("button", { name: "Save day" }).click();
  await expect(day).toContainText(
    /Cory is on Deep Clean at .+, Thu, Jan 8, 9:00 AM\. Saving frees it for other free Cleaners\./,
  );
  await day.getByRole("button", { name: "Free the Job and save" }).click();
  await expect(page.getByText("Thu, Jan 8 saved")).toBeVisible();
  expect((await emailsTo(cory.email)).at(-1)!.subject).toBe(
    "You're no longer on a Job",
  );

  // Friday's is what's left to free
  await page.getByRole("button", { name: "Deactivate" }).click();
  const deactivate = page.getByRole("alertdialog", {
    name: "Deactivate Cory Cleaner?",
  });
  await expect(deactivate).toContainText(
    /Cory is on Deep Clean at .+, Fri, Jan 9, 9:00 AM\. Deactivating them frees it/,
  );
  await expect(deactivate).not.toContainText("Thu, Jan 8");
  await deactivate.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText("Cory Cleaner deactivated")).toBeVisible();
});

test("a Cleaner's Site Visit has to go to someone else before their day off, or deactivating them", async ({
  page,
}) => {
  await requestQuoteForPremises(
    { name: "Casey Client", email: "casey@example.com" },
    "Acme Dental",
  );
  await addCleaner(cory.name);
  await bookSiteVisit({
    street: "200 Park Ave S",
    staffEmail: cory.email,
    date: "2026-01-07",
    time: "15:00",
  });
  await page.clock.setFixedTime(API_NOW);
  await signInAsOffice(page);
  await openStaffMember(page, "Cory Cleaner");
  const why =
    /Cory has a site visit at 200 Park Ave S.* on Wed, Jan 7, 3:00 PM\. Give it to someone else first\./;

  await dayOnCalendar(page, "Wed, Jan 7").click();
  const day = page.getByRole("dialog");
  const hours = day.getByRole("textbox", { name: "Hours that day" });
  await hours.fill("0");
  await hours.press("Tab");
  await expect(day).toContainText(why);
  await expect(day.getByRole("button", { name: "Save day" })).toBeDisabled();
  // fewer hours, not none, keep it
  await hours.fill("4");
  await hours.press("Tab");
  await expect(day).not.toContainText(why);
  await day.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Deactivate" }).click();
  const deactivate = page.getByRole("alertdialog", {
    name: "Deactivate Cory Cleaner?",
  });
  await expect(deactivate).toContainText(why);
  await expect(
    deactivate.getByRole("button", { name: "Deactivate" }),
  ).toBeDisabled();
  await deactivate.getByRole("link", { name: "Open Site Visit" }).click();
  await expect(page).toHaveURL(/\/office\/site-visits\/[0-9a-f-]{36}$/);
});

test("Office Staff change someone's name and roles", async ({ page }) => {
  await createStaff(cory);
  await signInAsOffice(page);
  await openStaffMember(page, "Cory Cleaner");

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Cory Cleaner" });
  await dialog.getByRole("textbox", { name: "Name" }).fill("Cory Clean");
  await dialog.getByText("Office Staff: runs the Office workspace").click();
  await dialog.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Changes saved")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cory Clean",
  );
  await expect(page.getByRole("region", { name: "Details" })).toContainText(
    "Cleaner and Office Staff",
  );
});

test("Office Staff who don't clean have no availability to set", async ({
  page,
}) => {
  await signInAsOffice(page);
  await openStaffMember(page, "Olive Owner");

  await expect(
    page.getByText("Only Cleaners' hours count towards the Schedule"),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Monday" })).toHaveCount(0);
});

test("the Staff screens pass automated accessibility checks", async ({
  page,
}) => {
  await createStaff(cory);
  await signInAsOffice(page);
  await page.goto("/office/staff");
  await expect(page.getByRole("row", { name: /Cory Cleaner/ })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("button", { name: "Invite Staff" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectAccessible(page, "[role=dialog]");
  await page.keyboard.press("Escape");

  await openStaffMember(page, "Cory Cleaner");
  await expectAccessible(page);
});
