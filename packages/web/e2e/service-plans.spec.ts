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
    // one Clean Type, so nothing to choose
    await expect(accept.getByRole("radio")).toHaveCount(0);
    await accept.getByRole("button", { name: "Accept and pay $50.46" }).click();
    await expect(client.getByText("Your Service Plan has started")).toHaveCount(
      2,
    );

    await client.getByRole("link", { name: "See your Service Plan" }).click();
    await expect(client.getByRole("heading", { level: 1 })).toHaveText(
      "Your Service Plan",
    );
    await expect(
      client.getByText("Every week, on Mondays at 9:00 AM"),
    ).toBeVisible();
    await expect(
      client.getByText("$201.85 including tax, 10% off a one-off clean"),
    ).toBeVisible();
    await expect(
      client.getByText(/^\$50\.46, which comes off the last clean/),
    ).toBeVisible();
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

    await client.goto("/portal");
    await expect(
      client.getByRole("grid", { name: "Your Service Plans" }).getByRole("row"),
    ).toContainText("Standard Clean, every week");
    await expect(
      client.getByRole("grid", { name: "Your Service Plans" }).getByRole("row"),
    ).toContainText("Next: Mon, Jan 19, 9:00 AM");

    // the Office finds it on the home's page
    await page.goto(`/office/properties/${propertyId}?tab=plan`);
    await page.getByRole("link", { name: "Open the plan" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Service Plan",
    );
    const jobs = page.getByRole("grid", { name: "The plan's Jobs" });
    await expect(jobs.getByRole("row")).toHaveCount(4);
    await noViolations(page);

    // a week on, the next Job comes within reach
    await setClock("2026-01-19T16:00:00Z");
    await generatePlanJobs();
    await page.reload();
    await expect(jobs.getByRole("row")).toHaveCount(5);
    await expect(jobs.getByRole("row").last()).toContainText(
      "Mon, Feb 16, 9:00 AM",
    );
  },
);

test("the Office records a plan's acceptance, then books a visit its day had no room for", async ({
  page,
}) => {
  const { quote } = await planQuoteSent(page);
  // Monday 2 February is full
  await bookJob({ startsAt: "2026-02-02T14:00:00Z", labourHours: 8 });

  await page.goto(`/office/quotes/${quote.id}`);
  const record = page.getByRole("region", { name: "Record acceptance" });
  await record.getByRole("button", { name: "Record acceptance" }).click();
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Service Plan",
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
  await expect(
    page.getByRole("grid", { name: "The plan's Jobs" }).getByRole("row"),
  ).toHaveText([
    /Mon, Jan 19/,
    /Mon, Jan 26/,
    /Tue, Feb 3, 9:00 AM/,
    /Mon, Feb 9/,
  ]);
});
