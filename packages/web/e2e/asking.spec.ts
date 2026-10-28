import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  signedInAs,
  createStaff,
  expect,
  nextStep,
  requestQuoteAsGuest,
  test,
} from "./harness.ts";

const casey = { name: "Casey Client", email: "casey@example.com" };
const officeStaff = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};

const signInAs = (page: Page, email: string) => signedInAs(page, email);

// the shared form's first step for a new home: what and where
const describeNewHome = async (
  page: Page,
  { zip = "11375", street = "35-06 Ditmars Blvd", unit = "" } = {},
) => {
  await page.getByText("Apartment", { exact: true }).click();
  await page.getByRole("textbox", { name: "Street address" }).fill(street);
  if (unit) {
    await page.getByRole("textbox", { name: /^Apartment or unit/ }).fill(unit);
  }
  await page.getByRole("textbox", { name: "ZIP code" }).fill(zip);
};

const expectNoViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

test(
  "someone who signed up first becomes a Client by asking for a Quote",
  { tag: "@smoke" },
  async ({ page }) => {
    await signInAs(page, "new@example.com");
    await expect(page).toHaveURL("/welcome");

    await describeNewHome(page);
    await nextStep(page);
    await nextStep(page);
    await page.getByRole("textbox", { name: "Full name" }).fill("Nina New");
    await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0111");
    await page.getByRole("button", { name: "Request a Quote" }).click();

    await expect(page).toHaveURL("/portal");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Nina",
    );
    await expect(
      page.getByText("35-06 Ditmars Blvd, 11375").first(),
    ).toBeVisible();
  },
);

test("a home with a Quote open can't be asked about again, and points to it", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAs(page, casey.email);
  await page.getByRole("link", { name: "Request a Quote" }).click();
  await expect(page).toHaveURL("/portal/request");

  // their home is listed, but not selectable: its Quote is on the way
  const existing = page.getByRole("radio", {
    name: /41-12 Austin St, 4B, 11375/,
  });
  await expect(existing).toBeDisabled();
  await expect(
    page.getByText("This home has a Quote open already."),
  ).toBeVisible();
  await expect(
    page.getByText("We're preparing your Quote for 41-12 Austin St"),
  ).toBeVisible();

  // typing the same address another way is still the same home
  await page.getByText("A different home", { exact: true }).click();
  await describeNewHome(page, {
    street: "41-12 Austin Street",
    unit: "apt 4b",
  });
  await nextStep(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();

  await expect(
    page.getByText("You've already asked us for a Quote for this home."),
  ).toBeVisible();
  await expect(page).toHaveURL("/portal/request");

  // the way on is the Quote they have
  await page.getByRole("link", { name: "41-12 Austin St, 4B, 11375" }).click();
  await expect(page).toHaveURL(/\/portal\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByText("We're preparing your Quote")).toBeVisible();
});

test("a Client sees a Quote they asked for in Your Quotes, as they asked it", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey, ["Inside the oven"]);
  await signInAs(page, casey.email);

  const quotes = page.getByRole("grid", { name: "Your Quotes" });
  const row = quotes.getByRole("row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("41-12 Austin St, 4B, 11375");
  await expect(row).toContainText("Extras: Inside the oven");
  await expect(row).toContainText("Requested");
  await row.click();

  await expect(page).toHaveURL(/\/portal\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your Quote",
  );
  await expect(
    page.getByText(
      "We're preparing your Quote, and we'll email it to you, usually within a working day.",
    ),
  ).toBeVisible();
  const asked = page.getByRole("region", { name: "What you asked for" });
  await expect(asked).toContainText("Inside the oven");
  await expect(asked).toContainText("Wanted after the first clean");
  // nothing to accept until it's Sent
  await expect(page.getByRole("button", { name: /Accept/ })).toBeHidden();
});

test("a Client asks about a second home", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signInAs(page, casey.email);
  await page.goto("/portal/request");

  await page.getByText("A different home", { exact: true }).click();
  await describeNewHome(page);
  await nextStep(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();

  await expect(page).toHaveURL("/portal");
  await expect(page.getByText("Quote requested")).toBeVisible();
  await expect(
    page.getByRole("grid", { name: "Your Quotes" }).getByRole("row"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("grid", { name: "Your homes" }).getByRole("row"),
  ).toHaveCount(2);
});

test(
  "the portal shows where you are",
  { tag: "@desktop" },
  async ({ page }) => {
    await requestQuoteAsGuest(casey);
    await signInAs(page, casey.email);
    const portalNav = page.getByRole("navigation", { name: "Client portal" });

    await page.getByRole("link", { name: "Request a Quote" }).click();
    await expect(page).toHaveURL("/portal/request");

    const crumbs = page.getByLabel("Breadcrumbs");
    await expect(crumbs.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(crumbs.getByText("Request a Quote")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // the section it belongs to is marked in the navigation
    await expect(portalNav.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await crumbs.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("/portal");
  },
);

test("the API's explanation shows beside the field", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signInAs(page, casey.email);
  await page.goto("/portal/request");

  await page.getByText("A different home", { exact: true }).click();
  await describeNewHome(page, { zip: "1137" });
  await nextStep(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();

  // back on the step with the field
  const zip = page.getByRole("textbox", { name: "ZIP code" });
  await expect(zip).toHaveAttribute("aria-invalid", "true");
  await expect(zip).toHaveAccessibleDescription(/Enter a 5-digit ZIP code/);
});

test("a Client edits their contact details and Access Instructions", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAs(page, casey.email);
  await page.getByRole("link", { name: "Your details" }).click();
  await expect(page).toHaveURL("/portal/details");

  await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0123");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Details saved")).toBeVisible();

  await page
    .getByRole("textbox", { name: "How do we get in?" })
    .fill("Key in the lockbox, code 4821");
  await page.getByRole("button", { name: "Save Access Instructions" }).click();
  await expect(page.getByText("Access Instructions saved")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Phone" })).toHaveValue(
    "(718) 555-0123",
  );
  await expect(
    page.getByRole("textbox", { name: "How do we get in?" }),
  ).toHaveValue("Key in the lockbox, code 4821");
});

test("Office Staff see the Quote, open the home and correct its details", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await createStaff(officeStaff);
  await signInAs(page, officeStaff.email);

  await page.getByRole("link", { name: "Quotes", exact: true }).click();
  await expect(page).toHaveURL("/office/quotes");
  await page.getByText("Casey Client").click();
  // the Quote first; its home is one step further
  await expect(page).toHaveURL(/\/office\/quotes\//);
  await page.getByRole("link", { name: "View Property" }).click();

  await expect(page).toHaveURL(/\/office\/properties\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "41-12 Austin St, 4B, 11375",
  );
  const save = page.getByRole("button", { name: "Save corrections" });
  await expect(save).toBeDisabled();

  await page.getByRole("textbox", { name: "Bedrooms" }).fill("4");
  await page
    .getByRole("button", { name: /^(Light|Moderate|Heavy) Condition$/ })
    .click();
  await page.getByRole("option", { name: "Heavy" }).click();
  await save.click();
  await expect(page.getByText("Details corrected")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Bedrooms" })).toHaveValue(
    "4",
  );
  await expect(
    page.getByRole("button", { name: /^(Light|Moderate|Heavy) Condition$/ }),
  ).toHaveText(/Heavy/);
  await expect(page.getByText("4 bedrooms")).toBeVisible();
});

test(
  "the Office shows where you are",
  { tag: "@desktop" },
  async ({ page }) => {
    await requestQuoteAsGuest(casey);
    await createStaff(officeStaff);
    await signInAs(page, officeStaff.email);
    const officeNav = page.getByRole("navigation", { name: "Office" });

    await page.getByRole("link", { name: "Quotes", exact: true }).click();
    await page.getByText("Casey Client").click();
    const crumbs = page.getByLabel("Breadcrumbs");
    const address = "41-12 Austin St, 4B, 11375";
    // a Quote sits below its home, which sits below its Client
    await expect(crumbs.getByText("Quote", { exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await crumbs.getByRole("link", { name: address }).click();
    await expect(page).toHaveURL(/\/office\/properties\//);
    await expect(crumbs.getByText(address)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await crumbs.getByRole("link", { name: "Casey Client" }).click();
    await expect(page).toHaveURL(/\/office\/clients\//);

    await expect(crumbs.getByText("Casey Client")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // however a Client is reached, they belong to Clients
    await expect(
      officeNav.getByRole("link", { name: "Clients" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      officeNav.getByRole("link", { name: "Quotes", exact: true }),
    ).not.toHaveAttribute("aria-current", "page");

    await crumbs.getByRole("link", { name: "Clients" }).click();
    await expect(page).toHaveURL("/office/clients");
  },
);

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
      "the portal's screens have no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await requestQuoteAsGuest(casey);
        await signInAs(page, casey.email);

        for (const path of ["/portal", "/portal/request", "/portal/details"]) {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectNoViolations(page);
        }

        // a Quote they asked for, not yet Sent
        await page.goto("/portal");
        await page
          .getByRole("grid", { name: "Your Quotes" })
          .getByRole("row")
          .click();
        await expect(page.getByText("What you asked for")).toBeVisible();
        await expectNoViolations(page);
      },
    );

    test(
      "the Office's screens have no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await requestQuoteAsGuest(casey);
        await createStaff(officeStaff);
        await signInAs(page, officeStaff.email);

        await page.goto("/office/quotes");
        await expect(page.getByText("Casey Client")).toBeVisible();
        await expectNoViolations(page);

        await page.getByText("Casey Client").click();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Quote for Casey Client",
        );
        await expectNoViolations(page);

        await page.goto("/office/clients");
        await expect(page.getByText("Casey Client")).toBeVisible();
        await expectNoViolations(page);
      },
    );

    test(
      "the welcome page's form has no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await signInAs(page, "new@example.com");
        await expect(
          page.getByRole("textbox", { name: "Street address" }),
        ).toBeVisible();
        await expectNoViolations(page);
        await describeNewHome(page);
        await nextStep(page);
        await expect(
          page.getByRole("group", { name: "Any extras?" }),
        ).toBeVisible();
        await expectNoViolations(page);
        await nextStep(page);
        await expectNoViolations(page);
      },
    );
  });
}
