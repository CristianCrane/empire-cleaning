import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  createStaff,
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

const signInAsOffice = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
};

// a design-system Select: its button is named by its value and its label
const choose = async (page: Page, label: RegExp, option: string) => {
  await page.getByRole("button", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

// the parts of the shared form new business premises need
const describeNewPremises = async (page: Page) => {
  await page.getByText("Business premises", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Business name" })
    .fill("Acme Dental");
  await page
    .getByRole("textbox", { name: "Street address" })
    .fill("200 Park Ave S");
  await page.getByRole("textbox", { name: "ZIP code" }).fill("10003");
  await choose(page, /Type of premises/, "Office");
  await page
    .getByRole("textbox", { name: /^Floor area in sq ft/ })
    .fill("4500");
};

const expectNoViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

test(
  "a business asks for regular cleaning on chosen days, with no Condition or extras",
  { tag: "@smoke" },
  async ({ page }) => {
    await signedInAs(page, "nina@example.com");
    await expect(page).toHaveURL("/welcome");

    await describeNewPremises(page);
    await page.getByRole("textbox", { name: "Full name" }).fill("Nina New");
    await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0111");
    // a home's questions aren't asked
    await expect(page.getByText("How much cleaning does it need?")).toHaveCount(
      0,
    );
    await expect(page.getByText("Any extras?")).toHaveCount(0);
    await page.getByText("Monday", { exact: true }).click();
    await page.getByText("Friday", { exact: true }).click();
    await choose(page, /Preferred start time/, "6:00 PM");
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Request a Quote" }).click();

    await expect(page).toHaveURL("/portal");
    await expect(page.getByText("Your premises")).toBeVisible();
    await expect(page.getByText("Office · 4,500 sq ft")).toBeVisible();
    await expect(
      page.getByText("Monday and Friday at 6:00 PM", { exact: false }),
    ).toBeVisible();
  },
);

test("a business wanting regular cleaning is asked which days, or may ask for a one-off", async ({
  page,
}) => {
  await signedInAs(page, "nina@example.com");
  await describeNewPremises(page);
  await page.getByRole("textbox", { name: "Full name" }).fill("Nina New");
  await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0111");

  await page.getByRole("button", { name: "Request a Quote" }).click();
  await expect(
    page.getByText("Choose the days you want cleaned"),
  ).toBeVisible();

  await page.getByText("A one-off clean", { exact: true }).click();
  await page.getByRole("button", { name: "Request a Quote" }).click();
  await expect(page).toHaveURL("/portal");
  await expect(
    page.getByText("A one-off clean", { exact: false }),
  ).toBeVisible();
});

test(
  "Office Staff see a business's request priced from its floor area, and correct its premises",
  { tag: "@desktop" },
  async ({ page }) => {
    await requestQuoteForPremises(casey, "Acme Dental");
    await signInAsOffice(page);

    await page.getByRole("link", { name: "Requests" }).click();
    const row = page.getByRole("row", { name: /Acme Dental \(Casey Client\)/ });
    await expect(row).toContainText("Office · 4,500 sq ft");
    await expect(row).toContainText("Monday, Wednesday and Friday at 6:00 PM");
    await row.click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Acme Dental (Casey Client)",
    );
    await expect(page.getByText("Not recorded yet")).toBeVisible();
    await expect(
      page.getByText("No Condition is recorded yet", { exact: false }),
    ).toBeVisible();
    // the placeholder Price List: 4,500 sq ft at 0.5 h per 1,000 is 2.25 h,
    // at $55 an hour is $124, plus 8.875% tax
    await expect(
      page.getByText("Office: 4,500 sq ft ÷ 1,000 × 0.5 h").first(),
    ).toBeVisible();
    await expect(page.getByText("The premises").first()).toBeVisible();
    await expect(page.getByText("$135.01")).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("link", { name: "View Property" }).click();
    await expect(page).toHaveURL(/\/office\/properties\//);
    await choose(page, /Type of premises/, "Medical");
    await page
      .getByRole("textbox", { name: "Floor area in sq ft" })
      .fill("2000");
    await choose(page, /Condition$/, "Heavy");
    await page.getByRole("button", { name: "Save corrections" }).click();
    await expect(page.getByText("Details corrected")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Medical · 2,000 sq ft")).toBeVisible();
    await expect(page.getByRole("button", { name: /Condition$/ })).toHaveText(
      /Heavy/,
    );
  },
);

test("Office Staff keep the commercial rate and tax, the Premises Types, and who each Add-on is for", async ({
  page,
}) => {
  await signInAsOffice(page);
  await page.goto("/office/price-list");

  await page
    .getByRole("textbox", { name: "Commercial hourly rate" })
    .fill("$65");
  await page.getByRole("textbox", { name: "Commercial Jobs (%)" }).fill("9");
  await page.getByRole("button", { name: "Retire Retail" }).click();
  await page.getByRole("button", { name: "Add a type of premises" }).click();
  await page
    .getByRole("textbox", { name: "Type of premises" })
    .last()
    .fill("Gym");
  await page
    .getByRole("button", { name: /Offered for/ })
    .nth(2)
    .click();
  await page.getByRole("option", { name: "Homes and businesses" }).click();
  await page.getByRole("button", { name: "Save Price List" }).click();
  await expect(page.getByText("Price List saved as version 2")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Commercial hourly rate" }),
  ).toHaveValue("$65.00");
  await expect(
    page.getByRole("textbox", { name: "Commercial Jobs (%)" }),
  ).toHaveValue("9");
  await expect(
    page.getByRole("button", { name: "Restore Retail" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Type of premises" }).last(),
  ).toHaveValue("Gym");
  await expect(
    page.getByRole("button", { name: /Offered for/ }).nth(2),
  ).toHaveText(/Homes and businesses/);
});

test("Office Staff quote a business caller from New Quote", async ({
  page,
}) => {
  await signInAsOffice(page);
  await page.goto("/office/quotes/new");

  await page.getByRole("button", { name: "New Client" }).click();
  await page.getByText("Business premises", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Business name" })
    .fill("Phoner & Co");
  await page.getByRole("textbox", { name: "Full name" }).fill("Pat Phoner");
  await page.getByRole("textbox", { name: "Phone" }).fill("(718) 555-0123");
  await page.getByRole("textbox", { name: "Street address" }).fill("9 Main St");
  await page.getByRole("textbox", { name: "ZIP code" }).fill("11375");
  await choose(page, /Type of premises/, "Retail");
  await page.getByText("A one-off clean", { exact: true }).click();
  await page.getByRole("button", { name: "Draft a Quote" }).click();

  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Quote for Phoner & Co (Pat Phoner)",
  );
  await expect(
    page.getByText("Retail · floor area not known yet", { exact: false }),
  ).toBeVisible();
});
