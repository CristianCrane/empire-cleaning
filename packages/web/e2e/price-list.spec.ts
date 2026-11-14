import type { Page } from "@playwright/test";
import {
  signedInAs,
  createStaff,
  expect,
  expectAccessible,
  nextStep,
  chooseService,
  requestQuoteAsGuest,
  test,
  draftTheQuote,
  expectCurrentSection,
  goTo,
  eachTheme,
  serviceKey,
} from "./harness.ts";

const casey = { name: "Casey Client", email: "casey@example.com" };
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

// the placeholder Price List prices the harness's request (2 bedrooms, 1.5
// bathrooms, 1 floor, no pets: 1 + 1 + 1.125 = 3.125 h) like this:
//   standard 3.25 h x $55 = $178.75, to $179, + 8.875% tax = $194.89
//   deep     5 h    x $55 = $275,            + 8.875% tax = $299.41
test(
  "Office Staff see the Suggested price for the Service and its first-visit recommendation, with the working",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await requestQuoteAsGuest(casey);
    await signInAsOffice(page);

    await goTo(page, "Quotes");
    await page.getByText("Casey Client").click();

    // priced on the Draft, from the Suggested Price
    await draftTheQuote(page);
    const crumbs = page.getByLabel("Breadcrumbs");
    await expect(
      crumbs.getByRole("link", { name: "Quotes", exact: true }),
    ).toBeVisible();
    const deep = page.getByRole("region", { name: "Deep Clean" });
    const standard = page.getByRole("region", { name: "Standard Clean" });
    await expect(deep).toContainText("$299.41");
    await expect(deep).toContainText("Recommended");
    await expect(deep).toContainText("Includes $24.41 tax");
    await expect(deep).toContainText("Suggested price, before tax$275.00");
    await expect(standard).toContainText("$194.89");
    // how it was reached, folded under the price
    await standard.getByText("How it's worked out").click();
    await expect(
      standard.getByText("Cleaning hours, rounded up to the quarter-hour"),
    ).toBeVisible();
    await expect(standard).toContainText(
      "Cleaning hours, rounded up to the quarter-hour3.25 h",
    );
    await expect(standard).toContainText("Suggested price, before tax$179.00");
    // which prices, with how it's worked out (WEB-C)
    await expect(
      standard.getByText("From your prices, version 1."),
    ).toBeVisible();
    // Quotes stays marked in the navigation
    await expectCurrentSection(page, "Quotes");
  },
);

test("the Add-ons asked for are priced, and shown with their hours", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey, ["Inside the oven"]);
  await signInAsOffice(page);
  await goTo(page, "Quotes");
  await page.getByText("Casey Client").click();

  await expect(page.getByText("Inside the oven").first()).toBeVisible();
  // on the Draft: 3.125 + 0.5 = 3.625 h, rounded up to 3.75 h
  await draftTheQuote(page);
  const standard = page.getByRole("region", { name: "Standard Clean" });
  await expect(standard).toContainText("+ Inside the oven0.5 h");
  await expect(standard).toContainText(
    "Cleaning hours, rounded up to the quarter-hour3.75 h",
  );
});

test(
  "Office Staff edit the Price List: Condition, Add-ons and the rest",
  { tag: "@smoke" },
  async ({ page }) => {
    await signInAsOffice(page);
    await goTo(page, "Prices");
    await expect(page).toHaveURL("/office/price-list");

    // placeholders, until the Office saves their own
    await expect(page.getByText("These are placeholder figures")).toBeVisible();

    // each part is changed in its own dialog, and saved as a new version
    await page.getByRole("button", { name: "Edit Condition" }).click();
    await page.getByRole("textbox", { name: "Heavy (×)" }).fill("1.5");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Prices saved as version 2")).toBeVisible();
    await expect(page.getByText("These are placeholder figures")).toHaveCount(
      0,
    );

    await page.getByRole("row", { name: "Inside the fridge" }).click();
    await page.getByText("Offered").click();
    await page.getByRole("button", { name: "Save extra" }).click();
    await expect(page.getByText("Prices saved as version 3")).toBeVisible();

    await page.getByRole("button", { name: "Add an extra" }).click();
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Steam clean");
    await page.getByText("Tax-exempt").click();
    await expect(
      page.getByRole("checkbox", { name: "Tax-exempt" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Add extra" }).click();
    await expect(page.getByText("Prices saved as version 4")).toBeVisible();

    await page.reload();
    await expect(
      page.getByText(/Version 4, saved by Olive Owner/),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Condition" })).toContainText(
      "1.5×Heavy",
    );
    await expect(page.getByRole("row", { name: "Steam clean" })).toContainText(
      "Tax-exempt",
    );
    await expect(
      page.getByRole("row", { name: "Inside the fridge" }),
    ).toContainText("Retired");
    await expect(page.getByText("Retired")).toHaveCount(1);
  },
);

test("Office Staff give an extra and a type of business their Spanish names, which Spanish readers get", async ({
  page,
}) => {
  await signInAsOffice(page);
  await goTo(page, "Prices");

  await page.getByRole("button", { name: "Add an extra" }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Steam clean");
  await page
    .getByRole("textbox", { name: "Name in Spanish (optional)" })
    .fill("Limpieza a vapor");
  await page.getByRole("button", { name: "Add extra" }).click();
  await expect(page.getByText("Prices saved as version 2")).toBeVisible();

  await page.getByRole("button", { name: "Add a type of business" }).click();
  await page
    .getByRole("textbox", { name: "Type of business", exact: true })
    .fill("Gym");
  await page
    .getByRole("textbox", { name: "In Spanish (optional)" })
    .fill("Gimnasio");
  await page.getByRole("button", { name: "Add type" }).click();
  await expect(page.getByText("Prices saved as version 3")).toBeVisible();

  await page.reload();
  await page.getByRole("row", { name: "Steam clean" }).click();
  await expect(
    page.getByRole("textbox", { name: "Name in Spanish (optional)" }),
  ).toHaveValue("Limpieza a vapor");

  // what the Quote form lists, to a Spanish reader and an English one
  const addOns = `/api/price-list/add-ons?service=${await serviceKey("Standard Clean")}`;
  const listed = async (path: string, language: string) =>
    (
      (await (
        await page.request.get(path, {
          headers: { "accept-language": language },
        })
      ).json()) as { name: string }[]
    ).map((item) => item.name);
  expect(await listed(addOns, "es")).toContain("Limpieza a vapor");
  expect(await listed(addOns, "en")).toContain("Steam clean");
  expect(await listed("/api/price-list/premises-types", "es")).toContain(
    "Gimnasio",
  );
});

test("the starting figures can be kept as they are", async ({ page }) => {
  await signInAsOffice(page);
  await page.goto("/office/price-list");
  await page.getByRole("button", { name: "Keep these figures" }).click();
  await expect(page.getByText("Prices saved as version 2")).toBeVisible();
  await expect(page.getByText("These are placeholder figures")).toHaveCount(0);
});

test("a saved Price List prices new Quotes, and a new Add-on appears on the form", async ({
  page,
}) => {
  await signInAsOffice(page);
  await page.goto("/office/price-list");
  await page.getByRole("button", { name: "Edit Condition" }).click();
  await page.getByRole("textbox", { name: "Moderate (×)" }).fill("2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Prices saved as version 2")).toBeVisible();

  await requestQuoteAsGuest(casey);
  await page.goto("/office/quotes");
  await page.getByText("Casey Client").click();
  await draftTheQuote(page);

  // 3.125 h x2 = 6.25 h x $55 = $343.75, to $344, + 8.875% = $374.53
  const standard = page.getByRole("region", { name: "Standard Clean" });
  await expect(standard).toContainText("$374.53");
  await standard.getByText("How it's worked out").click();
  await expect(
    standard.getByText("From your prices, version 2."),
  ).toBeVisible();
});

test("saving keeps your place on the page", async ({ page }) => {
  await signInAsOffice(page);
  await page.goto("/office/price-list");
  const edit = page.getByRole("button", { name: "Edit Sales tax on fees" });
  await edit.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await edit.click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  // the page's data is fetched again after a save; that mustn't jump to the
  // top (the placeholder notice going may still nudge it a little)
  await expect(page.getByText(/Version 2, saved by Olive Owner/)).toBeVisible();
  await expect(edit).toBeInViewport();
});

test("a mistake is explained beside the field", async ({ page }) => {
  await signInAsOffice(page);
  await page.goto("/office/price-list");

  await page.getByRole("button", { name: "Edit Sales tax on fees" }).click();
  await page.getByRole("textbox", { name: "Fees (%)" }).fill("40");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const tax = page.getByRole("textbox", { name: "Fees (%)" });
  await expect(tax).toHaveAttribute("aria-invalid", "true");
  await expect(tax).toHaveAccessibleDescription(
    /That's higher than any sales tax/,
  );
  await expect(page.getByText("Prices saved")).toHaveCount(0);
});

test("the request form offers the Add-ons by name, and the choice reaches the Office", async ({
  page,
  browser,
}) => {
  await signedInAs(page, "new@example.com");
  await expect(page).toHaveURL("/welcome");
  await chooseService(page);
  await page.getByText("Apartment", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Street address" })
    .fill("35-06 Ditmars Blvd");
  await page.getByRole("textbox", { name: "ZIP code" }).fill("11375");
  await nextStep(page);

  // names only: no prices on the form
  const extras = page.getByRole("group", { name: "Any extras?" });
  await expect(extras.getByRole("checkbox")).toHaveCount(4);
  await expect(extras).not.toContainText("$");
  await extras.getByText("Inside the oven").click();
  await expect(
    extras.getByRole("checkbox", { name: "Inside the oven" }),
  ).toBeChecked();

  await nextStep(page);
  await page.getByRole("textbox", { name: "Full name" }).fill("Nina New");
  await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0111");
  await page.getByRole("button", { name: "Request a quote" }).click();

  await expect(page).toHaveURL("/portal");
  await page.getByRole("link", { name: "See what you asked for" }).click();
  await expect(
    page.getByRole("region", { name: "What you asked for" }),
  ).toContainText("Inside the oven");

  // and the Office sees it
  const office = await browser.newPage();
  await createStaff(olive);
  await signedInAs(office, olive.email);
  await goTo(office, "Quotes");
  await office.getByText("Nina New").click();
  await expect(office.getByText("Inside the oven").first()).toBeVisible();
  await office.close();
});

eachTheme(() => {
  test("the Price List has no accessibility violations", async ({ page }) => {
    await signInAsOffice(page);
    await page.goto("/office/price-list");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prices");

    await expectAccessible(page);
  });

  test("a Requested Quote's page, and its Draft's, have no accessibility violations", async ({
    page,
  }) => {
    await requestQuoteAsGuest(casey, ["Inside the oven"]);
    await signInAsOffice(page);
    await page.goto("/office/quotes");
    await page.getByText("Casey Client").click();
    await expect(
      page.getByRole("button", { name: "Draft the quote" }),
    ).toBeVisible();
    await expectAccessible(page);

    await draftTheQuote(page);
    await expect(
      page.getByRole("region", { name: "Deep Clean" }),
    ).toBeVisible();
    await expectAccessible(page);
  });
});
