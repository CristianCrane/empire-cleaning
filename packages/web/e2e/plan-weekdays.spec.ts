import type { Page } from "@playwright/test";
import {
  completedFirstClean,
  createStaff,
  expect,
  expectAccessible,
  requestQuoteForPremises,
  signedInAs,
  test,
  draftTheQuote,
  recordFindingsWithoutVisit,
  saved,
  startOn,
  linkIn,
  payAndBook,
  expectNoPageAction,
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
// usual crew of 2 on Mondays at 9am from the 19th, and for one Cleaner on
// Wednesdays at 1pm from the 21st.

const quoteLink = () =>
  linkIn(casey.email, "Your cleaning plan quote from Empire Cleaning");

const noViolations = async (page: Page) => {
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectAccessible(page);
};

test(
  "Office Staff offer a plan on several weekdays, each its own visit, and the Client accepts it whole",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser, isMobile }) => {
    await createStaff(olive);
    await signedInAs(page, olive.email);
    const { job } = await completedFirstClean(olive.email);
    await page.goto(`/office/jobs/${job.id}`);
    await page.getByRole("button", { name: "Quote a cleaning plan" }).click();
    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}\/draft$/);

    // Mondays at 9am
    await startOn(
      page,
      page.getByRole("region", { name: "Weekday 1" }),
      "01192026",
      "0900AM",
    );
    await expect(page.getByRole("region", { name: "Mondays" })).toBeVisible();

    // another weekday, with no time yet for the one the client asked
    // for: Mondays folds out of its way
    await page.getByRole("button", { name: "Add a weekday" }).click();
    await expect(
      page
        .getByRole("region", { name: "Mondays" })
        .getByRole("button", { name: /^Proposed time/, expanded: false }),
    ).toContainText("Mon, Jan 19 · 9:00 AM");
    await startOn(
      page,
      page.getByRole("region", { name: "Weekday 2" }),
      "01212026",
      "0100PM",
    );
    const wednesday = page.getByRole("region", { name: "Wednesdays" });
    await wednesday.getByRole("textbox", { name: "Cleaners" }).fill("1");
    await wednesday.getByRole("textbox", { name: "Cleaners" }).blur();
    await saved(page);

    // several weekdays come round every week
    const terms = page.getByRole("region", { name: "Plan" });
    await expect(
      terms.getByRole("radio", { name: "Every week" }),
    ).toBeChecked();
    await expect(
      terms.getByRole("radio", { name: "Every 2 weeks" }),
    ).toBeDisabled();
    // a phone's bar at the foot sums the week up; a wider screen's prices
    // lead with it (#493 D1)
    if (isMobile) {
      await expect(
        page.getByText(/^2 cleans a week: \$[\d,.]+ a week$/),
      ).toBeVisible();
    }
    await expect(page.getByRole("region", { name: "Each week" })).toContainText(
      "A week's cleans",
    );

    await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
    await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();
    // how often; each weekday's card names its day and time, and its
    // cleaning hours only for a crew of more than one: a crew of one's are
    // its time on site
    await expect(
      page.getByRole("region", { name: "Current quote" }),
    ).toContainText("Every week");
    const mondayCard = page.getByRole("region", {
      name: "Mondays at 9:00 AM: Standard Clean",
    });
    await expect(mondayCard.getByRole("term")).toContainText([
      "Cleaning hours",
      "On site, with 2 cleaners",
    ]);
    const wednesdayCard = page.getByRole("region", {
      name: "Wednesdays at 1:00 PM: Standard Clean",
    });
    await expect(wednesdayCard.getByRole("term")).toContainText([
      "On site, with 1 cleaner",
    ]);
    await expect(
      wednesdayCard.getByRole("term").filter({ hasText: "Cleaning hours" }),
    ).toHaveCount(0);
    // the Current Quote ends with the plan's Deposit
    const deposit = (await page
      .getByRole("region", { name: "Current quote" })
      .getByRole("definition")
      .last()
      .textContent())!;

    // Casey sees each weekday, the week's total and the Deposit
    const client = await (await browser.newContext()).newPage();
    await signedInAs(client, casey.email);
    await client.goto(await quoteLink());
    const quote = client.getByRole("region", { name: "Quote details" });
    await expect(quote).toContainText(
      "Every week, on Mondays at 9:00 AM and Wednesdays at 1:00 PM",
    );
    // a week's money, never "each day", which reads as every day of it
    await expect(quote).toContainText("A week's cleans, tax included");
    await expect(quote).not.toContainText(/each day|a day\b/);
    // how long each weekday's crew is there, in the facts as a clean says
    // it, each length naming its weekdays: not the Office's cleaning hours
    // and crew, on each weekday's card
    await expect(quote).toContainText("About 2 hHow long on Mondays");
    await expect(quote).toContainText("3¾ hHow long on Wednesdays");
    for (const name of [
      "Mondays at 9:00 AM: Standard Clean",
      "Wednesdays at 1:00 PM: Standard Clean",
    ])
      await expect(client.getByRole("region", { name })).not.toContainText(
        /On site|Cleaning hours|cleaner/,
      );
    await expect(
      client.getByRole("region", { name: "Quote details" }),
    ).toContainText(`Deposit (25% of a week's cleans)`);
    await noViolations(client);

    // and accepts it whole, with nothing to choose
    const { form, accept } = payAndBook(client, "Pay and start your plan");
    await expect(form.getByRole("radio")).toHaveCount(0);
    await expect(accept).toHaveAccessibleName(`Accept and pay ${deposit}`);
    await accept.click();
    await expect(
      client.getByText("Your cleaning plan has started"),
    ).toHaveCount(2);
    await client.getByRole("link", { name: "See your cleaning plan" }).click();
    // one answer to when: both weekdays together
    const details = client.getByRole("region", { name: "Plan details" });
    await expect(details).toContainText("Mondays at 9:00 AM · Standard Clean");
    await expect(details).toContainText(
      "Wednesdays at 1:00 PM · Standard Clean",
    );
    await expect(
      client
        .getByRole("region", { name: "Your upcoming cleans" })
        .getByRole("row"),
    ).toHaveText([
      // how long is the card's to say, each weekday named, as no clean
      // runs other than its weekday's
      /Jan 19, 2026, Mon 9:00\sAM$/,
      /Jan 21, 2026, Wed 1:00\sPM$/,
      /Jan 26, 2026, Mon 9:00\sAM$/,
      /Jan 28, 2026, Wed 1:00\sPM$/,
      /Feb 2, 2026, Mon 9:00\sAM$/,
      /Feb 4, 2026, Wed 1:00\sPM$/,
      /Feb 9, 2026, Mon 9:00\sAM$/,
    ]);
    await expect(details).toContainText("About 2 hHow long on Mondays");
    await expect(details).toContainText("3¾ hHow long on Wednesdays");
    await noViolations(client);

    // the Office's plan says each weekday's time there and crew, each
    // named, as they differ
    const planId = new URL(client.url()).pathname.split("/").pop();
    await page.goto(`/office/service-plans/${planId}`);
    await expect(
      page
        .getByRole("region", { name: "Cleaning plan" })
        .getByRole("definition")
        .filter({ hasText: /^On site/ }),
    ).toHaveText([
      "On site Mondays, with 2 cleaners",
      "On site Wednesdays, with 1 cleaner",
    ]);
  },
);

test("business premises can be offered a Service Plan with no First Clean, once their findings are recorded", async ({
  page,
}) => {
  await requestQuoteForPremises(casey, "Acme Dental");
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/quotes");
  await page.getByText("Acme Dental").click();
  // seen first: there's nothing to draft until they are
  await expectNoPageAction(page, "Draft the quote");

  await recordFindingsWithoutVisit(page);
  await draftTheQuote(page, "cleaning plan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Draft quote for Acme Dental (Casey Client)",
  );
  await expect(
    page.getByText("This business hasn't had a site visit yet"),
  ).toHaveCount(0);
});
