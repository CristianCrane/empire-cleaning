import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  createStaff,
  emailsTo,
  expect,
  nextStep,
  chooseService,
  requestQuoteAsGuest,
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

const startNewQuote = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/quotes");
  await page.getByRole("button", { name: "New Quote" }).click();
  await expect(page).toHaveURL("/office/quotes/new");
};

// the shared form's first step for a new home: what and where
const describeNewHome = async (page: Page, street = "35-06 Ditmars Blvd") => {
  await page.getByText("Apartment", { exact: true }).click();
  await page.getByRole("textbox", { name: "Street address" }).fill(street);
  await page.getByRole("textbox", { name: "ZIP code" }).fill("11105");
};

const expectNoViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

test(
  "Office Staff quote a new caller without an email, adding it before sending",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await startNewQuote(page);
    await expect(
      page.getByRole("searchbox", { name: "Find a Client" }),
    ).toBeFocused();

    await page.getByRole("button", { name: "New Client" }).click();
    await chooseService(page);
    await describeNewHome(page);
    await expectNoViolations(page);
    await nextStep(page);
    await expectNoViolations(page);
    await nextStep(page);
    await page.getByRole("textbox", { name: "Full name" }).fill("Pat Phoner");
    await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0123");
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Draft a Quote" }).click();

    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
    const quote = page.url();
    await expect(
      page.getByText(
        "Pat Phoner has no email yet, so this Quote can't be sent.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send to Pat Phoner" }),
    ).toBeDisabled();

    await page.getByRole("link", { name: "their Client screen" }).click();
    await expect(page.getByText("None yet", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit contact details" });
    await dialog
      .getByRole("textbox", { name: "Email (optional)" })
      .fill("pat@example.com");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("pat@example.com")).toBeVisible();

    await page.goto(quote);
    await expect(
      page.getByRole("button", { name: "Send to Pat Phoner" }),
    ).toBeEnabled();
    // entering it sent nothing: the Quote is what Pat will get
    expect(await emailsTo("pat@example.com")).toEqual([]);
  },
);

test(
  "Office Staff quote a Client found by searching, for a new home",
  { tag: "@desktop" },
  async ({ page }) => {
    await requestQuoteAsGuest(casey);
    const sent = (await emailsTo(casey.email)).length;
    await startNewQuote(page);

    await page.getByRole("searchbox", { name: "Find a Client" }).fill("casey");
    await page
      .getByRole("grid", { name: "Clients found" })
      .getByRole("row", { name: /Casey Client/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Casey Client" }),
    ).toBeVisible();
    await chooseService(page);
    // its request is still waiting, so that home can't be asked about again
    // for this
    await expect(
      page.getByRole("radio", { name: /41-12 Austin St/ }),
    ).toBeDisabled();
    await expect(
      page.getByRole("radio", { name: "A different home" }),
    ).toBeChecked();
    await describeNewHome(page);
    await nextStep(page);
    await page.getByRole("button", { name: "Draft a Quote" }).click();

    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Quote for Casey Client",
    );
    await expect(
      page
        .getByLabel("Breadcrumbs")
        .getByRole("link", { name: "35-06 Ditmars Blvd, 11105" }),
    ).toBeVisible();
    expect(await emailsTo(casey.email)).toHaveLength(sent);
  },
);

test("a Client's screen starts a New Quote for them", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/clients?tab=all");
  await page.getByRole("row", { name: /Casey Client/ }).click();

  await page.getByRole("button", { name: "New Quote" }).click();

  await expect(page).toHaveURL(/\/office\/quotes\/new\?clientId=/);
  await expect(
    page.getByRole("heading", { name: "Casey Client" }),
  ).toBeVisible();
  await expectNoViolations(page);
});

test(
  "the Office narrows the open Quotes by status and by search, kept on coming Back",
  { tag: "@desktop" },
  async ({ page }) => {
    await requestQuoteAsGuest(casey);
    await requestQuoteForPremises(
      { name: "Dana Dentist", email: "dana@example.com" },
      "Acme Dental",
    );
    await createStaff(olive);
    await signedInAs(page, olive.email);
    await page.goto("/office/quotes");

    const quotes = page.getByRole("grid", { name: "Open Quotes" });
    await expect(quotes.getByRole("row")).toHaveCount(3);
    // what each is a Quote of
    await expect(
      quotes.getByRole("row", { name: /Acme Dental/ }),
    ).toContainText("Commercial cleaning");
    await expect(
      quotes.getByRole("row", { name: /Casey Client/ }),
    ).toContainText("Standard Clean");
    await expect(page.getByRole("tab", { name: /Requested/ })).toContainText(
      "2",
    );
    await page.getByRole("tab", { name: /Draft/ }).click();
    await expect(page.getByText("No Draft Quotes.")).toBeVisible();
    await page.getByRole("tab", { name: /All/ }).click();

    await page.getByRole("searchbox", { name: "Search Quotes" }).fill("acme");
    await expect(page).toHaveURL("/office/quotes?q=acme");
    await expect(quotes.getByRole("row")).toHaveCount(2);
    await expect(quotes).toContainText("Acme Dental");
    await expectNoViolations(page);

    await quotes.getByRole("row", { name: /Acme Dental/ }).click();
    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
    await page.goBack();
    await expect(
      page.getByRole("searchbox", { name: "Search Quotes" }),
    ).toHaveValue("acme");
    await expect(quotes.getByRole("row")).toHaveCount(2);
  },
);
