import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import {
  bookSiteVisit,
  createStaff,
  emailsTo,
  expect,
  requestQuoteForPremises,
  setUsualWeek,
  signedInAs,
  test,
  draftTheQuote,
  recordFindingsWithoutVisit,
} from "./harness.ts";

// The API's clock starts at 4am on Monday 5 January 2026 in New York.

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

const signInAsOffice = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
};

// a design-system Select in a dialog: its button is named by its value and
// its label, and its options pop up over the page
const choose = async (dialog: Locator, label: RegExp, option: string) => {
  await dialog.getByRole("button", { name: label }).click();
  await dialog
    .page()
    .getByRole("option", { name: option, exact: true })
    .click();
};

const expectNoViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

test(
  "Office Staff book a Site Visit for business premises, and record what it found",
  { tag: "@smoke" },
  async ({ page }) => {
    await requestQuoteForPremises(casey, "Acme Dental");
    await signInAsOffice(page);

    await page.goto("/office/quotes");
    await expect(page.getByText("Needs Site Visit")).toBeVisible();
    await page.getByText("Acme Dental").click();
    await expect(
      page.getByText("Business premises are seen before they're quoted"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Book a Site Visit" }).click();
    const dialog = page.getByRole("dialog", { name: "Book a Site Visit" });
    await choose(dialog, /Who visits/, "Olive Owner");
    await dialog
      .getByRole("group", { name: "Day" })
      .getByRole("spinbutton", { name: /month/i })
      .click();
    await page.keyboard.type("01062026");
    await dialog
      .getByRole("group", { name: "Start time" })
      .getByRole("spinbutton", { name: /hour/i })
      .click();
    await page.keyboard.type("1000AM");
    await expect(dialog.getByRole("textbox", { name: /Duration/ })).toHaveValue(
      "30",
    );
    await dialog.getByRole("button", { name: "Book Site Visit" }).click();

    await expect(page).toHaveURL(/\/office\/site-visits\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Booked", { exact: true })).toBeVisible();
    await expect(page.getByText("Tue, Jan 6, 10:00 AM")).toBeVisible();
    await expect(page.locator("#main").getByText("Olive Owner")).toBeVisible();
    const [email] = (await emailsTo(casey.email)).filter(
      (e) => e.subject === "Your Site Visit is booked",
    );
    expect(email!.text).toContain("Tuesday, January 6 at 10:00 AM");
    const visit = page.url();

    await page.goto("/office/quotes");
    await expect(page.getByText("Site Visit booked")).toBeVisible();

    await page.goto(visit);
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Record findings" }).click();
    const findings = page.getByRole("dialog", {
      name: "What the Site Visit found",
    });
    await expect(
      findings.getByRole("textbox", { name: "Floor area in sq ft" }),
    ).toHaveValue("4,500");
    await findings.getByText("Heavy", { exact: true }).click();
    await findings
      .getByRole("textbox", { name: /Office notes/ })
      .fill("Two treatment rooms need extra care");
    await findings.getByRole("button", { name: "Save findings" }).click();

    await expect(page.getByText("Findings recorded").first()).toBeVisible();
    await expect(page.getByText("Done", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Two treatment rooms need extra care"),
    ).toBeVisible();
  },
);

test("a Quote for business premises can't be drafted until their findings are recorded", async ({
  page,
}) => {
  await requestQuoteForPremises(casey, "Acme Dental");
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText("Acme Dental").click();

  // not seen yet: seeing them is the only thing to do
  await expect(
    page.getByText("Business premises are seen before they're quoted."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Draft the Quote" }),
  ).toHaveCount(0);

  // premises the Office knows already
  await recordFindingsWithoutVisit(page);
  await draftTheQuote(page, "one-off");
  await expect(
    page.getByText("These premises haven't had a Site Visit"),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Send to/ })).toBeEnabled();
});

test("a Site Visit shows on the Schedule, in the Client's portal and in the visiting Cleaner's day", async ({
  page,
}) => {
  await requestQuoteForPremises(casey, "Acme Dental");
  const cory = (await createStaff({
    email: "cory@example.com",
    name: "Cory Cleaner",
    roles: ["cleaner"],
  })) as { id: string };
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  await bookSiteVisit({
    street: "200 Park Ave S",
    staffEmail: "cory@example.com",
    date: "2026-01-05",
    time: "15:00",
  });

  await signInAsOffice(page);
  await page.goto("/office/schedule?from=2026-01-05&to=2026-01-05");
  // a Cleaner's visit takes half an hour of their hours that day
  await expect(page.getByText("0.5 h booked")).toBeVisible();
  await page.getByRole("link", { name: /3:00 PM Acme Dental/ }).click();
  await expect(page).toHaveURL(/\/office\/site-visits\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Cory Cleaner")).toBeVisible();

  await page.context().clearCookies();
  await signedInAs(page, "cory@example.com");
  await expect(page).toHaveURL("/cleaner");
  const today = page.getByRole("grid", { name: "Today's Site Visits" });
  await expect(today).toContainText("3:00 PM");
  await expect(today).toContainText("200 Park Ave S");

  await page.context().clearCookies();
  await signedInAs(page, casey.email);
  await expect(page).toHaveURL("/portal");
  await expect(
    page.getByText("Your Site Visit", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/^Cory comes to see 200 Park Ave S.* for about 30 min$/),
  ).toBeVisible();
});
