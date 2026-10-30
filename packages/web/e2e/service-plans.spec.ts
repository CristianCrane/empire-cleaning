import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  bookJob,
  completedFirstClean,
  createStaff,
  emailsTo,
  expect,
  generatePlanJobs,
  sentServicePlanQuote,
  setClock,
  signedInAs,
  test,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// Casey's First Clean is done at 11am on Monday 12 January 2026, New York
// time, with their card saved, and the API's clock is left there. Their plan
// is a Standard Clean every week from 9am on Monday the 19th: $201.85 a
// clean with tax, and a $50.46 Deposit. Its Jobs go on the Schedule up to
// Monday 9 February.
const FIRST = "2026-01-19T14:00:00Z";

// signed in as the Office, with a plan Quote Sent for Casey's home
const planQuoteSent = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  const { propertyId } = await completedFirstClean(olive.email);
  const quote = await sentServicePlanQuote({
    officeEmail: olive.email,
    propertyId,
    startsAt: FIRST,
  });
  return { propertyId, quote };
};

const quoteLink = async () => {
  const sent = (await emailsTo(casey.email)).find(
    (e) => e.subject === "Your Service Plan Quote from Empire Cleaning",
  );
  return new URL(sent!.text.match(/https?:\/\/\S+/)![0]).pathname;
};

// checked on a fresh load: announcements left over from the page before
// aren't this page's
const noViolations = async (page: Page) => {
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

test(
  "the Client starts a Service Plan from its Quote, and both sides see its Jobs",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    const { propertyId } = await planQuoteSent(page);

    const client = await (await browser.newContext()).newPage();
    await signedInAs(client, casey.email);
    await client.goto(await quoteLink());
    const accept = client.getByRole("region", {
      name: "Accept and start your plan",
    });
    await expect(accept).toContainText(
      "Paying with your Test card ending 4242",
    );
    await expect(accept).toContainText("hold it for as long as your plan runs");
    // one Service, so nothing to choose
    await expect(accept.getByRole("radio")).toHaveCount(0);
    await accept.getByRole("button", { name: "Accept and pay $50.46" }).click();
    await expect(client.getByText("Your Service Plan has started")).toHaveCount(
      2,
    );

    await client.getByRole("link", { name: "See your Service Plan" }).click();
    await expect(client.getByRole("heading", { level: 1 })).toHaveText(
      "Your Service Plan",
    );
    const details = client.getByRole("region", { name: "Plan details" });
    await expect(details).toContainText("Every week");
    await expect(details).toContainText("Mondays at 9:00 AM");
    await expect(details).toContainText(
      "$201.85Each clean, tax included, 10% off",
    );
    await expect(details).toContainText(
      "$50.46Deposit, comes off your last clean",
    );
    await expect(
      client.getByText(
        /^Each clean is charged to your saved card when it's done\./,
      ),
    ).toBeVisible();
    const upcoming = client
      .getByRole("grid", { name: "Your upcoming cleans" })
      .getByRole("row");
    await expect(upcoming).toHaveText([
      /Mon, Jan 19, 9:00 AM/,
      /Mon, Jan 26, 9:00 AM/,
      /Mon, Feb 2, 9:00 AM/,
      /Mon, Feb 9, 9:00 AM/,
    ]);
    await noViolations(client);

    // Home leads with its first clean
    await client.goto("/portal");
    await expect(client.getByText("Your next clean")).toBeVisible();
    await expect(client.getByText("Mon, Jan 19, 9:00 AM")).toBeVisible();
    await expect(
      client.getByText("Part of your Service Plan, every week"),
    ).toBeVisible();

    // the Office finds it in full on the home's Service Plan Tab
    await page.goto(`/office/properties/${propertyId}?tab=plan`);
    await expect(
      page.getByRole("heading", { name: "Standard Clean, every week" }),
    ).toBeVisible();
    await noViolations(page);

    // and its Jobs in the home's History, newest first
    await page.getByRole("tab", { name: /History/ }).click();
    const jobs = page
      .getByRole("grid", { name: /^History/ })
      .getByRole("row")
      .filter({ hasText: "Job · Standard Clean" });
    await expect(jobs).toHaveCount(4);

    // a week on, the next Job comes within reach
    await setClock("2026-01-19T16:00:00Z");
    await generatePlanJobs();
    await page.reload();
    await expect(jobs).toHaveCount(5);
    await expect(jobs.first()).toContainText("Feb 16, 2026");
  },
);

test("the Office records a plan's acceptance, then books a visit its day had no room for", async ({
  page,
}) => {
  const { quote } = await planQuoteSent(page);
  // Monday 2 February is full
  await bookJob({ startsAt: "2026-02-02T14:00:00Z", labourHours: 8 });

  await page.goto(`/office/quotes/${quote.id}`);
  await page.getByRole("button", { name: "Record acceptance" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "held for the life of the plan",
  );
  await page.getByRole("button", { name: "Charge and book" }).click();
  await expect(
    page.getByText("Accepted: the Service Plan has started"),
  ).toBeVisible();

  await page.goto("/office");
  await page
    .getByRole("grid", { name: "Needs attention" })
    .getByRole("row")
    .filter({ hasText: "Service Plan visit on Mon, Feb 2" })
    .click();
  // the plan is on its home's Service Plan Tab
  await expect(page).toHaveURL(
    /\/office\/properties\/[0-9a-f-]{36}\?tab=plan$/,
  );
  const waiting = page.getByRole("grid", {
    name: "Visits waiting to be booked",
  });
  await waiting.getByRole("button", { name: "Book" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("group", { name: "Day" })
    .getByRole("spinbutton", { name: /^day/ })
    .click();
  await page.keyboard.type("03");
  await dialog.getByRole("button", { name: "Book visit" }).click();
  await expect(page.getByText("Visit booked")).toBeVisible();

  await expect(waiting).toHaveCount(0);
  // booked on Tuesday the 3rd, not the full Monday: in the home's History
  await page.getByRole("tab", { name: /History/ }).click();
  const jobs = page
    .getByRole("grid", { name: /^History/ })
    .getByRole("row")
    .filter({ hasText: "Job ·" });
  await expect(jobs.filter({ hasText: "Feb 3, 2026" })).toHaveCount(1);
  await expect(jobs.filter({ hasText: "Feb 2, 2026" })).toHaveCount(0);
});
