import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  signedInAs,
  createStaff,
  expect,
  requestQuoteAsGuest,
  test,
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

const expectNoViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

// the placeholder Price List prices the harness's request (2 bedrooms, 1.5
// bathrooms, 1 floor, no pets: 1 + 1 + 1.125 = 3.125 h) like this:
//   standard 3.25 h x $55 = $178.75, to $179, + 8.875% tax = $194.89
//   deep     5 h    x $55 = $275,            + 8.875% tax = $299.41
test(
  "Office Staff see the Suggested Price for both Clean Types, with the working",
  { tag: ["@smoke", "@desktop"] },
  async ({ page }) => {
    await requestQuoteAsGuest(casey);
    await signInAsOffice(page);

    await page.getByRole("link", { name: "Requests" }).click();
    await page.getByText("Casey Client").click();

    await expect(page).toHaveURL(/\/office\/requests\/[0-9a-f-]{36}$/);
    const crumbs = page.getByLabel("Breadcrumbs");
    await expect(crumbs.getByRole("link", { name: "Requests" })).toBeVisible();
    const deep = page.getByRole("region", { name: "Deep Clean" });
    const standard = page.getByRole("region", { name: "Standard Clean" });
    await expect(deep).toContainText("$299.41");
    await expect(deep).toContainText("Recommended");
    await expect(deep).toContainText("$275.00 + $24.41 tax (8.875%)");
    await expect(standard).toContainText("$194.89");
    // how it was reached
    await expect(standard).toContainText(
      "Labour Hours, rounded up to the quarter-hour3.25 h",
    );
    await expect(standard).toContainText("Suggested Price, before tax$179.00");
    await expect(
      page.getByText("Worked out from Price List version 1"),
    ).toBeVisible();
    // Requests stays marked in the navigation
    await expect(
      page
        .getByRole("navigation", { name: "Office" })
        .getByRole("link", { name: "Requests" }),
    ).toHaveAttribute("aria-current", "page");
  },
);

test("a request's extras are priced, and shown with their hours", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey, ["Inside the oven"]);
  await signInAsOffice(page);
  await page.getByRole("link", { name: "Requests" }).click();
  await page.getByText("Casey Client").click();

  await expect(page.getByText("Inside the oven").first()).toBeVisible();
  // 3.125 + 0.5 = 3.625 h, rounded up to 3.75 h
  await expect(
    page.getByRole("region", { name: "Standard Clean" }),
  ).toContainText("+ Inside the oven0.5 h");
  await expect(
    page.getByRole("region", { name: "Standard Clean" }),
  ).toContainText("Labour Hours, rounded up to the quarter-hour3.75 h");
});

test(
  "Office Staff edit the Price List: rate, Add-ons and the rest",
  { tag: "@smoke" },
  async ({ page }) => {
    await signInAsOffice(page);
    await page.getByRole("link", { name: "Price List" }).click();
    await expect(page).toHaveURL("/office/price-list");

    // placeholders, until the Office saves their own
    await expect(page.getByText("These are placeholder figures")).toBeVisible();

    await page.getByRole("textbox", { name: "Hourly rate" }).fill("$60");
    await page
      .getByRole("button", { name: "Retire Inside the fridge" })
      .click();
    await page.getByRole("button", { name: "Add an Add-on" }).click();
    await page
      .getByRole("textbox", { name: "Name" })
      .last()
      .fill("Steam clean");
    await page.getByText("Tax-exempt").last().click();
    await expect(
      page.getByRole("checkbox", { name: "Tax-exempt" }).last(),
    ).toBeChecked();
    await page.getByRole("button", { name: "Save Price List" }).click();

    await expect(page.getByText("Price List saved as version 2")).toBeVisible();
    await page.reload();
    await expect(page.getByText("These are placeholder figures")).toHaveCount(
      0,
    );
    await expect(
      page.getByText(/Version 2, saved by Olive Owner/),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Hourly rate" }),
    ).toHaveValue("$60.00");
    await expect(
      page.getByRole("textbox", { name: "Name" }).last(),
    ).toHaveValue("Steam clean");
    await expect(
      page.getByRole("button", { name: "Restore Inside the fridge" }),
    ).toBeVisible();
    await expect(page.getByText("Retired")).toHaveCount(1);
  },
);

test("a saved Price List prices new requests, and a new Add-on appears on the form", async ({
  page,
}) => {
  await signInAsOffice(page);
  await page.goto("/office/price-list");
  await page.getByRole("textbox", { name: "Hourly rate" }).fill("$60");
  await page.getByRole("button", { name: "Save Price List" }).click();
  await expect(page.getByText("Price List saved as version 2")).toBeVisible();

  await requestQuoteAsGuest(casey);
  await page.goto("/office/requests");
  await page.getByText("Casey Client").click();

  // 3.25 h x $60 = $195, + 8.875% = $212.31
  await expect(
    page.getByRole("region", { name: "Standard Clean" }),
  ).toContainText("$212.31");
  await expect(
    page.getByText("Worked out from Price List version 2"),
  ).toBeVisible();
});

test("saving keeps your place on the page", async ({ page }) => {
  await signInAsOffice(page);
  await page.goto("/office/price-list");
  const save = page.getByRole("button", { name: "Save Price List" });
  await save.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await save.click();
  // the page's data is fetched again after a save; that mustn't jump to the
  // top (the placeholder notice going may still nudge it a little)
  await expect(page.getByText(/Version 2, saved by Olive Owner/)).toBeVisible();
  await expect(save).toBeInViewport();
});

test("a mistake is explained beside the field", async ({ page }) => {
  await signInAsOffice(page);
  await page.goto("/office/price-list");

  await page.getByRole("textbox", { name: "One-off Jobs (%)" }).fill("40");
  await page.getByRole("button", { name: "Save Price List" }).click();

  const tax = page.getByRole("textbox", { name: "One-off Jobs (%)" });
  await expect(tax).toHaveAttribute("aria-invalid", "true");
  await expect(tax).toHaveAccessibleDescription(
    /That's higher than any sales tax/,
  );
  await expect(page.getByText("Price List saved")).toHaveCount(0);
});

test("the request form offers the Add-ons by name, and the choice reaches the Office", async ({
  page,
  browser,
}) => {
  await signedInAs(page, "new@example.com");
  await expect(page).toHaveURL("/welcome");

  // names only: no prices on the form
  const extras = page.getByRole("group", { name: "Any extras?" });
  await expect(extras.getByRole("checkbox")).toHaveCount(4);
  await expect(extras).not.toContainText("$");
  await extras.getByText("Inside the oven").click();
  await expect(
    extras.getByRole("checkbox", { name: "Inside the oven" }),
  ).toBeChecked();

  await page.getByRole("textbox", { name: "Full name" }).fill("Nina New");
  await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0111");
  await page.getByText("Apartment", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Street address" })
    .fill("35-06 Ditmars Blvd");
  await page.getByRole("textbox", { name: "ZIP code" }).fill("11375");
  await page.getByRole("button", { name: "Request a Quote" }).click();

  await expect(page).toHaveURL("/portal");
  await expect(page.getByText("Extras: Inside the oven")).toBeVisible();

  // and the Office sees it
  const office = await browser.newPage();
  await createStaff(olive);
  await signedInAs(office, olive.email);
  await office.getByRole("link", { name: "Requests" }).click();
  await office.getByText("Nina New").click();
  await expect(office.getByText("Inside the oven").first()).toBeVisible();
  await office.close();
});

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      if (theme === "dark") {
        await page.addInitScript(() =>
          localStorage.setItem("ec-theme", "dark"),
        );
      }
    });

    test(
      "the Price List has no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await signInAsOffice(page);
        await page.goto("/office/price-list");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Price List",
        );

        await expectNoViolations(page);
      },
    );

    test(
      "a Quote Request's page has no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await requestQuoteAsGuest(casey, ["Inside the oven"]);
        await signInAsOffice(page);
        await page.goto("/office/requests");
        await page.getByText("Casey Client").click();
        await expect(
          page.getByRole("region", { name: "Deep Clean" }),
        ).toBeVisible();

        await expectNoViolations(page);
      },
    );
  });
}
