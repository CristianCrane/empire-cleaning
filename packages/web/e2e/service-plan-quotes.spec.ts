import type { Page } from "@playwright/test";
import { apiUrl } from "../playwright.config.ts";
import {
  completedFirstClean,
  createStaff,
  expect,
  expectAccessible,
  signedInAs,
  test,
  serviceKey,
  draftTheQuote,
  saved,
  startOn,
  linkIn,
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
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}\/draft$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^(Draft|Updated) quote for Casey Client$/,
  );
};

// a weekday's price card on a plan Draft, by its Service and how often
const planCard = (page: Page, name: string) =>
  page.getByRole("region", { name });

// offered from the First Clean Job's screen
const startPlan = async (page: Page) => {
  const { job } = await firstCleanDone(page);
  await page.goto(`/office/jobs/${job.id}`);
  await page.getByRole("button", { name: "Quote a cleaning plan" }).click();
  await atPlanDraft(page);
};

// the first Job of the plan: Monday 19 January 2026 at 9:00 AM
const startOn19th = (page: Page) => startOn(page, page, "01192026", "0900AM");

const quoteLink = () =>
  linkIn(casey.email, "Your cleaning plan quote from Empire Cleaning");

// Casey asks about the same home again, wanting regular visits
const askAgain = async () => {
  const res = await fetch(`${apiUrl}/api/quotes/ask`, {
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
      serviceKey: await serviceKey("Standard Clean"),
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
      .filter({ hasText: "Quote a cleaning plan" })
      .click();
    // the home's page
    await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Quote a cleaning plan" }).click();
    await atPlanDraft(page);

    // above it, what the First Clean found, folded away until it's wanted
    await page.getByText("First Clean: the home was moderate").click();
    await expect(
      page.getByText("Its cleaners found the home moderate"),
    ).toBeVisible();
    await expect(page.getByText("No price changes.")).toBeVisible();

    // a Standard Clean every 2 weeks at moderate Condition and 10% off, to
    // start with: $206 with tax is $224.28 as a one-off, and $185.40 with
    // tax is $201.85
    const standard = planCard(page, "Standard Clean, every 2 weeks");
    await expect(standard).toContainText("$201.85");
    await expect(standard).toContainText("$224.28");
    await expect(standard).toContainText("Save $22.43 a clean");
    const terms = page.getByRole("region", { name: "Plan" });
    await expect(
      terms.getByRole("button", { name: "Standard Clean Service" }),
    ).toBeVisible();
    await expect(
      terms.getByRole("button", { name: /Priced for condition/ }),
    ).toContainText("Moderate");

    // the prices follow each change, without saving by hand
    await terms.getByText("Every week").click();
    await terms.getByRole("textbox", { name: "Plan discount (%)" }).fill("15");
    const price = planCard(page, "Standard Clean, every week");
    await price.getByText("Set the one-off price yourself").click();
    await price
      .getByRole("textbox", { name: "One-off price before tax" })
      .fill("250");
    await price
      .getByRole("textbox", { name: "Why this price" })
      .fill("Big garden room");
    await price.getByRole("textbox", { name: "Why this price" }).blur();
    // 15% off the $250 override: $212.50, with tax $231.36, against $272.19
    await expect(planCard(page, "Standard Clean, every week")).toContainText(
      "$231.36",
    );
    await saved(page);
    await expect(
      page.getByText(/^Standard Clean, every week: \$231\.36 a clean$/),
    ).toBeVisible();
    await startOn19th(page);
    await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
    await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();

    const offer = page.getByRole("region", {
      name: "Mondays at 9:00 AM: Standard Clean",
    });
    await expect(offer).toContainText("$231.36");
    await expect(offer).toContainText("$272.19");
    await expect(offer).toContainText("Set to $250.00 before tax");
    await expect(
      page.getByRole("region", { name: "Current quote" }),
    ).toContainText("Mon, Jan 19, 9:00 AM");
    // Casey hasn't been asked to accept by phone, but could be: their card
    // is saved from the First Clean
    await expect(
      page.getByRole("button", { name: "Record acceptance" }),
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
      "Your cleaning plan quote",
    );
    const plan = client.getByRole("region", {
      name: "Mondays at 9:00 AM: Standard Clean",
    });
    await expect(plan).toContainText("$231.36 a clean");
    await expect(plan).toContainText("As a one-off clean$272.19");
    await expect(plan).toContainText("Plan discount (15%)−$40.83");
    await expect(plan).toContainText("Save $40.83 a clean");
    await expect(
      client.getByRole("region", { name: "Quote details" }),
    ).toContainText("From Mon, Jan 19, 9:00 AM");
    await expect(
      client.getByRole("region", { name: "Pay and start your plan" }),
    ).toBeVisible();
    await expect(
      client.getByRole("button", { name: "Decline this quote" }),
    ).toBeVisible();

    await client.goto("/portal");
    await expect(
      client.getByText(
        "Cleaning plan, Standard Clean, every week: $231.36 a clean",
      ),
    ).toBeVisible();
    await expect(
      client.getByText(/^For Mon, Jan 19, 9:00 AM at /),
    ).toBeVisible();
  },
);

test("a Service Plan of Deep Cleans", async ({ page, browser }) => {
  await startPlan(page);
  await page.getByRole("button", { name: "Standard Clean Service" }).click();
  await page.getByRole("option", { name: "Deep Clean" }).click();
  await saved(page);
  await expect(planCard(page, "Deep Clean, every 2 weeks")).toBeVisible();

  await startOn19th(page);
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Current quote" }),
  ).toContainText("Every 2 weeks, on Mondays at 9:00 AM");

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await quoteLink());
  await expect(
    client.getByRole("region", { name: "Mondays at 9:00 AM: Deep Clean" }),
  ).toBeVisible();
  await expect(
    client.getByRole("region", { name: "Quote details" }),
  ).toContainText("Every 2 weeks, on Mondays at 9:00 AM");
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

  const homes = page.getByRole("grid", { name: /properties/ });
  await expect(homes.getByRole("row")).toHaveCount(1);
  await expect(homes.getByRole("row")).toContainText("First clean done");
  // no history here: that's on the home's page
  await expect(page.getByRole("grid", { name: /^Jobs/ })).toHaveCount(0);
  await homes.getByRole("row", { name: /41-12 Austin St/ }).click();

  await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "41-12 Austin St, 4B, 11375",
  );
  // its details, and its Quotes and Jobs in its History beside them
  await expect(
    page.getByRole("region", { name: "Home details" }),
  ).toBeVisible();
  const history = page.getByRole("list", { name: /^History/ });
  await expect(
    history.getByRole("listitem").filter({ hasText: "Quote ·" }),
  ).toContainText(["Deep Clean"]);
  await expect(
    history.getByRole("listitem").filter({ hasText: "Job ·" }),
  ).toContainText(["Done"]);

  await page.getByRole("button", { name: "Quote a cleaning plan" }).click();
  await atPlanDraft(page);
  // Back returns to the home, where the draft is carried on with
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Carry on with the draft" }),
  ).toBeVisible();
  await expect(
    history.getByRole("listitem").filter({ hasText: "Cleaning plan" }),
  ).toContainText("Draft");
});

test("a request for a home whose First Clean is done can be answered with either kind of Quote", async ({
  page,
}) => {
  await firstCleanDone(page);
  const asked = await askAgain();

  await page.goto(`/office/quotes/${asked}`);

  // asked which kind
  await page.getByRole("button", { name: "Draft the quote" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "A one-off quote" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "A cleaning plan quote" })
    .click();
  await atPlanDraft(page);
  // the same Quote's Draft, with what was asked above it
  await expect(page).toHaveURL(new RegExp(`/office/quotes/${asked}/draft$`));
  await expect(page.getByText("Wanted after the first clean")).toBeVisible();
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
  await expectAccessible(page);

  await startOn19th(page);
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Current quote" }),
  ).toBeVisible();
  await expectAccessible(page);

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await quoteLink());
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Your cleaning plan quote",
  );
  await expectAccessible(client);
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
  await expectAccessible(page);

  await page
    .getByRole("grid", { name: /properties/ })
    .getByRole("row")
    .click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "41-12 Austin St, 4B, 11375",
  );
  await expectAccessible(page);
});

test("the Client Declines a Service Plan Quote", async ({ page, browser }) => {
  await startPlan(page);
  await startOn19th(page);
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await quoteLink());
  await client.getByRole("button", { name: "Decline this quote" }).click();
  await client
    .getByRole("alertdialog")
    .getByRole("button", { name: "Decline" })
    .click();

  await expect(client.getByText("Quote declined")).toBeVisible();
  await expect(client.getByText(/You declined this quote/)).toBeVisible();
});

test("a home whose First Clean isn't Completed is answered with a one-off Quote", async ({
  page,
}) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  const res = await fetch(`${apiUrl}/api/quotes/ask`, {
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
      serviceKey: await serviceKey("Standard Clean"),
      condition: "moderate",
      wantsRegularService: true,
      addOns: [],
    }),
  });
  const { id } = (await res.json()) as { id: string };

  await page.goto(`/office/quotes/${id}`);

  // a one-off, without asking which
  await draftTheQuote(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Draft quote for /,
  );
});

test("picking a plan's start from the Schedule marks the days it repeats on", async ({
  page,
}) => {
  await startPlan(page);
  await startOn19th(page);
  await saved(page);

  await page
    .getByRole("region", { name: "Mondays" })
    .getByRole("button", { name: "Pick from the schedule" })
    .click();
  const schedule = page.getByRole("dialog", {
    name: "Pick from the schedule",
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
