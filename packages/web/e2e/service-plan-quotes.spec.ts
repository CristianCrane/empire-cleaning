import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  completedFirstClean,
  createStaff,
  emailsTo,
  expect,
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
// time, and the API's clock is left there. Their home (2 bedrooms, 1.5
// bathrooms, pets) as a Standard Clean at moderate Condition is $206 before
// tax on the placeholder Price List.

// signed in as the Office, with Casey's First Clean Completed
const firstCleanDone = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  return completedFirstClean(olive.email);
};

// the Draft opened, from wherever it was started
const atPlanDraft = async (page: Page) => {
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Service Plan Quote for ${casey.name}`,
  );
};

// a price card on a plan Draft: the choice of Clean Type, with its prices
const planCard = (page: Page, name: string) =>
  page.locator("label").filter({ has: page.getByRole("radio", { name }) });

const saved = (page: Page) =>
  expect(
    page.getByRole("status").filter({ hasText: /saved|prices/ }),
  ).toHaveText("All changes saved");

// offered from the First Clean Job's screen
const startPlan = async (page: Page) => {
  const { job } = await firstCleanDone(page);
  await page.goto(`/office/jobs/${job.id}`);
  await page.getByRole("button", { name: "Offer a Service Plan" }).click();
  await atPlanDraft(page);
};

// the first Job of the plan: Monday 19 January 2026 at 9:00 AM
const startOn19th = async (page: Page) => {
  await page
    .getByRole("group", { name: "Date" })
    .getByRole("spinbutton", { name: /month/i })
    .click();
  await page.keyboard.type("01192026");
  await page
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type("0900AM");
};

const quoteLink = async () => {
  const sent = (await emailsTo(casey.email)).find(
    (e) => e.subject === "Your Service Plan Quote from Empire Cleaning",
  );
  return new URL(sent!.text.match(/https?:\/\/\S+/)![0]).pathname;
};

// Casey asks about the same home again, wanting regular visits
const askAgain = async () => {
  const res = await fetch("http://localhost:3100/api/quote-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contact: { ...casey, phone: "(646) 555-0100" },
      property: {
        new: {
          kind: "residential",
          type: "apartment",
          street: "41-12 Austin St",
          unit: "4B",
          postcode: "11375",
          bedrooms: 2,
          bathrooms: 1.5,
          storeys: 1,
          pets: true,
          floorArea: null,
          accessInstructions: "Ring 4B; the doorman has a key.",
        },
      },
      condition: "moderate",
      wantsRegularService: true,
      notes: null,
    }),
  });
  if (!res.ok) throw new Error(`asking again: ${res.status}`);
  return ((await res.json()) as { id: string }).id;
};

test(
  "Office Staff offer a Service Plan once the First Clean is done, and the Client sees the saving",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    await firstCleanDone(page);
    // the dashboard nudges: Casey wanted regular visits
    await page.goto("/office");
    await page
      .getByRole("grid", { name: "Needs attention" })
      .getByRole("row")
      .filter({ hasText: "Offer a Service Plan" })
      .click();
    // the home's page, with its history
    await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Offer a Service Plan" }).click();
    await atPlanDraft(page);

    // beside it, what the First Clean found
    const firstClean = page.getByRole("region", { name: "First Clean" });
    await expect(firstClean).toContainText(
      "Its Cleaner found the home moderate",
    );
    await expect(firstClean).toContainText("No Adjustments");

    // a Standard Clean every 2 weeks at moderate Condition and 10% off, to
    // start with: $206 with tax is $224.28 as a one-off, and $185.40 with
    // tax is $201.85
    const standard = planCard(page, "Standard Clean, every 2 weeks");
    await expect(standard).toContainText("$201.85");
    await expect(standard).toContainText("$224.28");
    await expect(standard).toContainText("Save $22.43 a clean");
    await expect(
      page.getByRole("radio", { name: "Standard Clean, every 2 weeks" }),
    ).toBeChecked();
    // the Deep Clean beside it, to compare
    await expect(planCard(page, "Deep Clean, every 2 weeks")).toContainText(
      "a clean",
    );
    const terms = page.getByRole("region", { name: "Plan" });
    await expect(
      terms.getByRole("button", { name: /Priced for Condition/ }),
    ).toContainText("Moderate");

    // the prices follow each change, without saving by hand
    await terms.getByText("Every week").click();
    await terms.getByRole("textbox", { name: "Plan Discount (%)" }).fill("15");
    const price = page.getByRole("region", { name: "Standard Clean price" });
    await price.getByText("Override the one-off price").click();
    await price
      .getByRole("textbox", { name: "One-off price before tax" })
      .fill("250");
    await price
      .getByRole("textbox", { name: "Reason for the override" })
      .fill("Big garden room");
    await price
      .getByRole("textbox", { name: "Reason for the override" })
      .blur();
    // 15% off the $250 override: $212.50, with tax $231.36, against $272.19
    await expect(planCard(page, "Standard Clean, every week")).toContainText(
      "$231.36",
    );
    await saved(page);
    await expect(
      page.getByText(/^Standard Clean every week: \$231\.36 a clean$/),
    ).toBeVisible();
    await startOn19th(page);
    await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
    await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();

    const offer = page.getByRole("region", {
      name: "Standard Clean, every week",
    });
    await expect(offer).toContainText("$231.36");
    await expect(offer).toContainText("$272.19");
    await expect(offer).toContainText("Overridden to $250.00 before tax");
    await expect(page.getByRole("region", { name: "Offer" })).toContainText(
      "Mon, Jan 19, 9:00 AM",
    );
    // Casey hasn't been asked to accept by phone, but could be
    await expect(
      page.getByRole("region", { name: "Record acceptance" }),
    ).toBeVisible();
    // offered unprompted: it belongs to the home, not a request
    await page
      .getByLabel("Breadcrumbs")
      .getByRole("link", { name: "41-12 Austin St, 4B, 11375" })
      .click();
    await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);

    const client = await (await browser.newContext()).newPage();
    await signedInAs(client, casey.email);
    await client.goto(await quoteLink());
    await expect(client.getByRole("heading", { level: 1 })).toHaveText(
      "Your Service Plan Quote",
    );
    const plan = client.getByRole("region", {
      name: "Standard Clean, every week",
    });
    await expect(plan).toContainText("$231.36 a clean");
    await expect(plan).toContainText("As a one-off clean$272.19");
    await expect(plan).toContainText("Plan Discount (15%)−$40.83");
    await expect(plan).toContainText("Save $40.83 a clean");
    await expect(
      client.getByText(/^Starting Mon, Jan 19, 9:00 AM/),
    ).toBeVisible();
    await expect(
      client.getByRole("region", { name: "Accept and start your plan" }),
    ).toBeVisible();
    await expect(
      client.getByRole("button", { name: "Decline this Quote" }),
    ).toBeVisible();

    await client.goto("/portal");
    await expect(
      client
        .getByRole("grid", { name: "Your Quotes" })
        .getByRole("row")
        .filter({ hasText: "Service Plan, Standard Clean every week" }),
    ).toContainText(
      "Starting Mon, Jan 19, 9:00 AM · Service Plan, Standard Clean every week: $231.36 a clean",
    );
  },
);

test("a Service Plan of Deep Cleans", async ({ page, browser }) => {
  await startPlan(page);
  await planCard(page, "Deep Clean, every 2 weeks").click();
  await saved(page);
  await expect(
    page.getByRole("radio", { name: "Deep Clean, every 2 weeks" }),
  ).toBeChecked();
  await expect(
    page.getByRole("region", { name: "Deep Clean price" }),
  ).toBeVisible();

  await startOn19th(page);
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();
  await expect(page.getByRole("region", { name: "Offer" })).toContainText(
    "Deep Cleans every 2 weeks",
  );

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await quoteLink());
  await expect(
    client.getByRole("region", { name: "Deep Clean, every 2 weeks" }),
  ).toBeVisible();
  await expect(client.getByText(/^A Deep Clean every 2 weeks/)).toBeVisible();
});

test("the Client screen lists each home, whose own page holds its history and offers a plan", async ({
  page,
}) => {
  const { job } = await firstCleanDone(page);
  await page.goto(`/office/jobs/${job.id}`);
  await page
    .getByRole("region", { name: "Job" })
    .getByRole("link", { name: casey.name })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(casey.name);

  const homes = page.getByRole("grid", { name: /Properties/ });
  await expect(homes.getByRole("row")).toHaveCount(1);
  await expect(homes.getByRole("row")).toContainText("First Clean done");
  // no history here: that's on the home's page
  await expect(page.getByRole("grid", { name: /^Jobs/ })).toHaveCount(0);
  await homes.getByRole("row", { name: /41-12 Austin St/ }).click();

  await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "41-12 Austin St, 4B, 11375",
  );
  await expect(
    page.getByRole("grid", { name: /Quote Requests/ }).getByRole("row"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("grid", { name: /^Quotes/ }).getByRole("row"),
  ).toContainText(["Deep Clean"]);
  await expect(
    page.getByRole("grid", { name: /^Jobs/ }).getByRole("row"),
  ).toContainText(["Completed"]);

  await page.getByRole("button", { name: "Offer a Service Plan" }).click();
  await atPlanDraft(page);
  await page.goBack();
  await expect(
    page
      .getByRole("grid", { name: /^Quotes/ })
      .getByRole("row")
      .filter({ hasText: "Service Plan" }),
  ).toContainText("Draft");
});

test("a request for a home whose First Clean is done can be answered with either kind of Quote", async ({
  page,
}) => {
  await firstCleanDone(page);
  const asked = await askAgain();

  await page.goto(`/office/requests/${asked}`);

  await expect(
    page.getByRole("button", { name: "Draft a one-off Quote" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Draft a Service Plan Quote" })
    .click();
  await atPlanDraft(page);
  // it answers the request, so leads back there
  await page
    .getByLabel("Breadcrumbs")
    .getByRole("link", { name: "Quote Request" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/office/requests/${asked}$`));
  await expect(
    page.getByRole("button", { name: "Continue the Draft" }),
  ).toBeVisible();
});

test("a Service Plan Quote and the Client's view of it pass an accessibility check", async ({
  page,
  browser,
}) => {
  await startPlan(page);
  // the screen itself: arriving by a click leaves react-aria announcing
  // something from the page before
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  let { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await startOn19th(page);
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Offer" })).toBeVisible();
  ({ violations } = await new AxeBuilder({ page }).analyze());
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await quoteLink());
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Your Service Plan Quote",
  );
  ({ violations } = await new AxeBuilder({ page: client }).analyze());
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("the Client and Property screens pass an accessibility check", async ({
  page,
}) => {
  const { job } = await firstCleanDone(page);
  await page.goto(`/office/jobs/${job.id}`);
  await page
    .getByRole("region", { name: "Job" })
    .getByRole("link", { name: casey.name })
    .click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(casey.name);
  let { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await page
    .getByRole("grid", { name: /Properties/ })
    .getByRole("row")
    .click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "41-12 Austin St, 4B, 11375",
  );
  ({ violations } = await new AxeBuilder({ page }).analyze());
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("the Client Declines a Service Plan Quote", async ({ page, browser }) => {
  await startPlan(page);
  await startOn19th(page);
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await quoteLink());
  await client.getByRole("button", { name: "Decline this Quote" }).click();
  await client
    .getByRole("alertdialog")
    .getByRole("button", { name: "Decline" })
    .click();

  await expect(client.getByText("Quote declined")).toBeVisible();
  await expect(client.getByText(/You declined this Quote/)).toBeVisible();
});

test("a home whose First Clean isn't Completed is answered with a one-off Quote", async ({
  page,
}) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  const res = await fetch("http://localhost:3100/api/quote-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contact: { ...casey, phone: "(646) 555-0100" },
      property: {
        new: {
          kind: "residential",
          type: "house",
          street: "9 Elm St",
          postcode: "11375",
          bedrooms: 3,
          bathrooms: 2,
          storeys: 2,
          pets: false,
        },
      },
      condition: "moderate",
      wantsRegularService: true,
      addOns: [],
    }),
  });
  const { id } = (await res.json()) as { id: string };

  await page.goto(`/office/requests/${id}`);

  await expect(
    page.getByRole("button", { name: "Draft a Quote" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Draft a Service Plan Quote" }),
  ).toHaveCount(0);
});

test("picking a plan's start from the Schedule marks the days it repeats on", async ({
  page,
}) => {
  await startPlan(page);
  await startOn19th(page);
  await saved(page);

  await page
    .getByRole("region", { name: "Start" })
    .getByRole("button", { name: "Pick from the Schedule" })
    .click();
  const schedule = page.getByRole("dialog", {
    name: "Pick from the Schedule",
  });
  await expect(schedule).toContainText("Then every 2 weeks on Mondays.");
  await expect(
    schedule.getByRole("region", { name: "Mon, Jan 19", exact: true }),
  ).toContainText("Starts");

  // a week at a time, on a phone too
  await schedule.getByRole("button", { name: /Show$/ }).click();
  await page.getByRole("option", { name: "Week" }).click();
  await schedule.getByRole("button", { name: "Next week" }).click();
  await expect(
    schedule.getByRole("region", { name: "Mon, Jan 26", exact: true }),
  ).not.toContainText("Repeats");
  await schedule.getByRole("button", { name: "Next week" }).click();
  await expect(
    schedule.getByRole("region", { name: "Mon, Feb 2", exact: true }),
  ).toContainText("Repeats");
});
