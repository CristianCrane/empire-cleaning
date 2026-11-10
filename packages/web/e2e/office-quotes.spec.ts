import type { Page } from "@playwright/test";
import { apiUrl } from "../playwright.config.ts";
import {
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  requestQuoteAsGuest,
  requestQuoteForPremises,
  serviceKey,
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
  await page.getByRole("button", { name: "New quote" }).click();
  await expect(page).toHaveURL("/office/quotes/new");
};

// New Quote asks everything on one page, in the order a call goes: what
// they need
const chooseService = async (page: Page, name = "Standard Clean") =>
  page.locator("form").getByText(name, { exact: true }).click();

// a new home: what and where
const describeNewHome = async (page: Page, street = "35-06 Ditmars Blvd") => {
  await page.getByText("Apartment", { exact: true }).click();
  await page.getByRole("textbox", { name: "Street address" }).fill(street);
  await page.getByRole("textbox", { name: "ZIP code" }).fill("11105");
};

test("Office Staff set a new caller's language, see it on their page, and change it", async ({
  page,
}) => {
  await startNewQuote(page);
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("Pat Phoner");
  await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0123");
  await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
  await page.getByText("Español").click();
  await chooseService(page);
  await describeNewHome(page);
  await page.getByRole("button", { name: "Draft a quote" }).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}\/draft$/);

  await page.getByRole("link", { name: "their client page" }).click();
  const contact = page.getByRole("region", { name: "Contact details" });
  await expect(contact).toContainText("Preferred languageEspañol");
  await contact.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit contact details" });
  await expect(dialog.getByRole("radio", { name: "Español" })).toBeChecked();
  await dialog.getByText("English").click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Contact details saved")).toBeVisible();
  await page.reload();
  await expect(contact).toContainText("Preferred languageEnglish");
});

test(
  "Office Staff quote a new caller without an email, adding it before sending",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await startNewQuote(page);
    await expect(
      page.getByRole("searchbox", { name: "Find a client" }),
    ).toBeFocused();

    await page.getByRole("button", { name: "New client" }).click();
    // who's calling comes first
    await page.getByRole("textbox", { name: "Full name" }).fill("Pat Phoner");
    const price = page.getByRole("region", { name: "What it comes to" });
    await expect(price).toContainText("Pick what they need");
    await chooseService(page);
    await describeNewHome(page);
    // what it comes to as it's said: 1 + 2 x 0.5 + 1 x 0.75 = 2.75 h, x $55
    // = $151 to the dollar, + 8.875%
    await expect(price).toContainText("A 2-bedroom, 1-bathroom apartment");
    await expect(price).toContainText("Total$164.40");
    await page
      .getByRole("group", { name: /extras/ })
      .getByText("Inside the oven")
      .click();
    // its 0.5 h on top: 3.25 h x $55 = $179, + 8.875%
    await expect(price).toContainText("+ Inside the oven");
    await expect(price).toContainText("Total$194.89");
    await expectAccessible(page);
    await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0123");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Draft a quote" }).click();
    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}\/draft$/);
    const quote = page.url();
    // the Draft starts at the price said on the phone
    await expect(
      page.getByRole("region", { name: "Standard Clean" }),
    ).toContainText("$194.89");
    await expect(
      page.getByText(
        "Pat Phoner has no email yet, so this quote can't be sent.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send to Pat Phoner" }),
    ).toBeDisabled();

    await page.getByRole("link", { name: "their client page" }).click();
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

    await page.getByRole("searchbox", { name: "Find a client" }).fill("casey");
    await page
      .getByRole("grid", { name: "Clients found" })
      .getByRole("row", { name: /Casey Client/ })
      .click();
    await expect(
      page.getByRole("region", { name: "Who's calling" }),
    ).toContainText("Casey Client");
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
    await page.getByRole("button", { name: "Draft a quote" }).click();
    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}\/draft$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Draft quote for Casey Client",
    );
    await expect(
      page
        .getByLabel("Breadcrumbs")
        .getByRole("link", { name: "35-06 Ditmars Blvd, 11105" }),
    ).toBeVisible();
    expect(await emailsTo(casey.email)).toHaveLength(sent);
  },
);

test(
  "a Guest's ask leaves a home as it is, and the Office sees what they said",
  { tag: "@desktop" },
  async ({ page }) => {
    // asked about first for Painting, which isn't priced from rooms, the
    // home has none recorded
    const painting = await fetch(`${apiUrl}/api/quotes/ask`, {
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
          },
        },
        serviceKey: await serviceKey("Painting"),
        wantsRegularService: false,
      }),
    });
    expect(painting.status).toBe(201);
    // anyone can type Casey's email and address (#243)
    await requestQuoteAsGuest(casey);
    await createStaff(olive);
    await signedInAs(page, olive.email);
    await page.goto("/office/quotes");

    await page
      .getByRole("grid", { name: "Open quotes" })
      .getByRole("row")
      .filter({ hasText: "Standard Clean" })
      .click();

    await expect(page.getByText("(the client said moderate)")).toBeVisible();
    await expect(
      page.getByText(
        "(the client said 2 bedrooms, 1.5 bathrooms, 1 storey, no pets)",
      ),
    ).toBeVisible();
    await expectAccessible(page);
  },
);

test("a Client's screen starts a New quote for them", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/clients?tab=all");
  await page.getByRole("row", { name: /Casey Client/ }).click();

  await page.getByRole("button", { name: "New quote" }).click();

  await expect(page).toHaveURL(/\/office\/quotes\/new\?clientId=/);
  await expect(
    page.getByRole("region", { name: "Who's calling" }),
  ).toContainText("Casey Client");
  await expectAccessible(page);
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

    const quotes = page.getByRole("grid", { name: "Open quotes" });
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
    await expect(page.getByText("No draft quotes.")).toBeVisible();
    await page.getByRole("tab", { name: /All/ }).click();

    await page.getByRole("searchbox", { name: "Search quotes" }).fill("acme");
    await expect(page).toHaveURL("/office/quotes?q=acme");
    await expect(quotes.getByRole("row")).toHaveCount(2);
    await expect(quotes).toContainText("Acme Dental");
    await expectAccessible(page);

    await quotes.getByRole("row", { name: /Acme Dental/ }).click();
    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
    await page.goBack();
    await expect(
      page.getByRole("searchbox", { name: "Search quotes" }),
    ).toHaveValue("acme");
    await expect(quotes.getByRole("row")).toHaveCount(2);
  },
);
