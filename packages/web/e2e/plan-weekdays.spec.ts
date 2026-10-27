import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import {
  completedFirstClean,
  createStaff,
  emailsTo,
  expect,
  requestQuoteForPremises,
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
// time, with their card saved, and the API's clock is left there. Cory and
// Bea work 8 hours each weekday. Their plan here is a Standard Clean for the
// usual crew of 2 on Mondays at 9am from the 19th, and a Deep Clean for one
// Cleaner on Wednesdays at 1pm from the 21st.

const saved = (page: Page) =>
  expect(
    page.getByRole("status").filter({ hasText: /saved|prices/ }),
  ).toHaveText("All changes saved");

// types a time and a day into a weekday's pickers: the day last, as its
// section is named after it
const startOn = async (
  page: Page,
  weekday: Locator,
  date: string,
  time: string,
) => {
  await weekday
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type(time);
  await weekday
    .getByRole("group", { name: "Date" })
    .getByRole("spinbutton", { name: /month/i })
    .click();
  await page.keyboard.type(date);
};

const quoteLink = async () => {
  const sent = (await emailsTo(casey.email)).find(
    (e) => e.subject === "Your Service Plan Quote from Empire Cleaning",
  );
  return new URL(sent!.text.match(/https?:\/\/\S+/)![0]).pathname;
};

const noViolations = async (page: Page) => {
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

test(
  "Office Staff offer a plan on several weekdays, each its own visit, and the Client accepts it whole",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    await createStaff(olive);
    await signedInAs(page, olive.email);
    const { job } = await completedFirstClean(olive.email);
    await page.goto(`/office/jobs/${job.id}`);
    await page.getByRole("button", { name: "Offer a Service Plan" }).click();
    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);

    // Mondays at 9am
    await startOn(
      page,
      page.getByRole("region", { name: "Weekday 1" }),
      "01192026",
      "0900AM",
    );
    await expect(page.getByRole("region", { name: "Mondays" })).toBeVisible();

    // another weekday: the day after, to start with; Wednesdays instead
    await page.getByRole("button", { name: "Add a weekday" }).click();
    const tuesday = page.getByRole("region", { name: "Tuesdays" });
    await startOn(page, tuesday, "01212026", "0100PM");
    const wednesday = page.getByRole("region", { name: "Wednesdays" });
    // the price card, as the radio inside it is hidden
    await wednesday
      .locator("label")
      .filter({ has: page.getByRole("radio", { name: "Deep Clean" }) })
      .click();
    await wednesday.getByRole("textbox", { name: "Crew Size" }).fill("1");
    await wednesday.getByRole("textbox", { name: "Crew Size" }).blur();
    await saved(page);

    // several weekdays come round every week
    const terms = page.getByRole("region", { name: "Plan" });
    await expect(
      terms.getByRole("radio", { name: "Every week" }),
    ).toBeChecked();
    await expect(
      terms.getByRole("radio", { name: "Every 2 weeks" }),
    ).toBeDisabled();
    await expect(
      page.getByText(/^2 cleans a week: \$[\d,.]+ a week$/),
    ).toBeVisible();
    await expect(
      wednesday.getByRole("radio", { name: "Deep Clean" }),
    ).toBeChecked();
    await expect(page.getByRole("region", { name: "Each week" })).toContainText(
      "A week, with a clean on each day",
    );

    await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
    await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();
    await expect(page.getByRole("region", { name: "Offer" })).toContainText(
      "Every week, on Mondays at 9:00 AM and Wednesdays at 1:00 PM",
    );
    await expect(
      page.getByRole("region", { name: "Mondays at 9:00 AM: Standard Clean" }),
    ).toContainText("Time on site, with a crew of 2");
    await expect(
      page.getByRole("region", { name: "Wednesdays at 1:00 PM: Deep Clean" }),
    ).toContainText("Time on site, with a crew of 1");
    const deposit = (await page
      .getByRole("region", { name: "Each week" })
      .getByRole("definition")
      .last()
      .textContent())!;

    // Casey sees each weekday, the week's total and the Deposit
    const client = await (await browser.newContext()).newPage();
    await signedInAs(client, casey.email);
    await client.goto(await quoteLink());
    await expect(
      client.getByText(
        "Every week, on Mondays at 9:00 AM and Wednesdays at 1:00 PM, one clean a day.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      client.getByRole("region", {
        name: "Mondays at 9:00 AM: Standard Clean",
      }),
    ).toBeVisible();
    await expect(
      client.getByRole("region", { name: "Wednesdays at 1:00 PM: Deep Clean" }),
    ).toBeVisible();
    await expect(
      client.getByRole("region", { name: "Each week" }),
    ).toContainText(`Deposit (25% of a clean on each day)`);
    await noViolations(client);

    // and accepts it whole, with nothing to choose
    const accept = client.getByRole("region", {
      name: "Accept and start your plan",
    });
    await expect(accept.getByRole("radio")).toHaveCount(0);
    await accept
      .getByRole("button", { name: `Accept and pay ${deposit}` })
      .click();
    await expect(client.getByText("Your Service Plan has started")).toHaveCount(
      2,
    );
    await client.getByRole("link", { name: "See your Service Plan" }).click();
    await expect(
      client.getByRole("heading", {
        name: "Standard and Deep Cleans, every week on Mon and Wed",
      }),
    ).toBeVisible();
    await expect(
      client
        .getByRole("grid", { name: "Your upcoming cleans" })
        .getByRole("row"),
    ).toHaveText([
      /Mon, Jan 19, 9:00 AM/,
      /Wed, Jan 21, 1:00 PM/,
      /Mon, Jan 26, 9:00 AM/,
      /Wed, Jan 28, 1:00 PM/,
      /Mon, Feb 2, 9:00 AM/,
      /Wed, Feb 4, 1:00 PM/,
      /Mon, Feb 9, 9:00 AM/,
    ]);
    await noViolations(client);
  },
);

test("business premises can be offered a Service Plan with no First Clean, Sent once a Site Visit has recorded its findings", async ({
  page,
}) => {
  await requestQuoteForPremises(casey, "Acme Dental");
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/quotes");
  await page.getByText("Acme Dental").click();

  await page
    .getByRole("button", { name: "Draft a Service Plan Quote" })
    .click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Service Plan Quote for Acme Dental (Casey Client)",
  );
  await expect(
    page.getByText("These premises haven't had a Site Visit"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Send to/ })).toBeDisabled();
});
