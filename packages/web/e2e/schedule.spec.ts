import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  expect,
  setUsualWeek,
  signedInAs,
  test,
} from "./harness.ts";

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

// a week far from today, so the tests don't depend on the date they run:
// Monday 1 March 2027 to Sunday 7 March
const week = "/office/schedule?from=2027-03-01&to=2027-03-07";

const cleaner = async (name: string, usualWeek: number[]) => {
  const member = await createStaff({
    name,
    email: `${name.split(" ")[0]!.toLowerCase()}@example.com`,
    roles: ["cleaner"],
  });
  await setUsualWeek(member.id, usualWeek);
};

test(
  "Office Staff see each day's Jobs and free Staff hours",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await cleaner("Cory Cleaner", [8, 8, 8, 8, 8, 0, 0]);
    await cleaner("Dee Cleaner", [0, 4, 0, 0, 0, 0, 0]);
    await bookJob({
      startsAt: "2027-03-02T14:00:00Z", // 9am in New York
      labourHours: 5,
      crewSize: 2,
      cleanType: "standard",
    });
    await signInAsOffice(page);

    await page.goto(week);

    const tuesday = page.getByRole("region", { name: "Tue, Mar 2" });
    await expect(tuesday).toContainText(
      "12 h available · 5 h booked · 7 h free",
    );
    await expect(tuesday).toContainText("9:00 AM · Client");
    await expect(tuesday).toContainText(
      "Standard Clean · 5 h Labour Hours · crew of 2, 2.5 h on site",
    );
    await expect(tuesday).toContainText(
      "Available: Cory Cleaner (8 h), Dee Cleaner (4 h)",
    );
    await expect(
      page.getByRole("region", { name: "Mon, Mar 1" }),
    ).toContainText("No Jobs booked.");
    await expect(
      page.getByRole("region", { name: "Sat, Mar 6" }),
    ).toContainText("Nobody available");
    await expect(
      page
        .getByRole("navigation", { name: "Office" })
        .getByRole("link", { name: "Schedule" }),
    ).toHaveAttribute("aria-current", "page");
  },
);

test("a full or overbooked day says so", async ({ page }) => {
  await cleaner("Cory Cleaner", [8, 8, 0, 0, 0, 0, 0]);
  await bookJob({ startsAt: "2027-03-01T14:00:00Z", labourHours: 9 });
  await bookJob({ startsAt: "2027-03-02T14:00:00Z", labourHours: 8 });
  await signInAsOffice(page);

  await page.goto(week);

  const monday = page.getByRole("region", { name: "Mon, Mar 1" });
  await expect(monday).toContainText("Overbooked");
  await expect(monday).toContainText("8 h available · 9 h booked · 1 h over");
  await expect(page.getByRole("region", { name: "Tue, Mar 2" })).toContainText(
    "Full",
  );
});

test("the Schedule opens on this week, and moves a week at a time", async ({
  page,
}) => {
  await signInAsOffice(page);

  await page
    .getByRole("navigation", { name: "Office" })
    .getByRole("link", { name: "Schedule" })
    .click();
  const days = page.getByRole("list", { name: "Days" }).getByRole("listitem");
  await expect(days).toHaveCount(7);
  await expect(days.first()).toContainText(/^Mon,/);

  await page.goto(week);
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page).toHaveURL(/from=2027-03-08&to=2027-03-14/);
  await expect(page.getByRole("region", { name: "Mon, Mar 8" })).toBeVisible();
  await page.getByRole("button", { name: "Previous week" }).click();
  await page.getByRole("button", { name: "Previous week" }).click();
  await expect(page).toHaveURL(/from=2027-02-22&to=2027-02-28/);
});

test(
  "Office Staff choose the dates to show",
  { tag: "@desktop" },
  async ({ page }) => {
    await signInAsOffice(page);
    await page.goto(week);

    const to = page.getByRole("group", { name: "To" });
    await to.getByRole("spinbutton", { name: /day/i }).click();
    await page.keyboard.type("03");
    await page.getByRole("button", { name: "Show these dates" }).click();

    await expect(page).toHaveURL(/from=2027-03-01&to=2027-03-03/);
    await expect(
      page.getByRole("list", { name: "Days" }).getByRole("listitem"),
    ).toHaveCount(3);
  },
);

test("the Schedule passes automated accessibility checks", async ({ page }) => {
  await cleaner("Cory Cleaner", [8, 8, 8, 8, 8, 0, 0]);
  await bookJob({ startsAt: "2027-03-02T14:00:00Z", labourHours: 5 });
  await signInAsOffice(page);
  await page.goto(week);
  await expect(page.getByRole("region", { name: "Tue, Mar 2" })).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
