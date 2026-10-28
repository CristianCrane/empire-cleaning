import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  createStaff,
  expect,
  requestQuoteAsGuest,
  signedInAs,
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

test(
  "Office Staff change a Service's rate, and new Quotes are priced at it",
  { tag: "@smoke" },
  async ({ page }) => {
    await signInAsOffice(page);
    await page.getByRole("link", { name: "Services" }).click();
    await expect(page).toHaveURL("/office/services");

    const services = page.getByRole("grid", { name: "Services" });
    await expect(services.getByRole("row")).toHaveCount(5);
    await services.getByRole("row", { name: /Standard Clean/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Standard Clean" }),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Hourly rate" }).fill("$60");
    await page.getByRole("button", { name: "Save Service" }).click();
    await expect(page.getByText("Service saved")).toBeVisible();
    await expect(
      page.getByText(/^Version \d+, saved by Olive Owner/),
    ).toBeVisible();

    await requestQuoteAsGuest(casey);
    await page.goto("/office/quotes");
    await page.getByText("Casey Client").click();

    // 3.25 h x $60 = $195, + 8.875% = $212.31; Deep Clean keeps its own $55
    await expect(
      page.getByRole("region", { name: "Standard Clean" }),
    ).toContainText("$212.31");
    await expect(
      page.getByRole("region", { name: "Deep Clean" }),
    ).toContainText("$299.41");
  },
);

test("Office Staff add a Service priced by area, and retire it", async ({
  page,
}) => {
  await signInAsOffice(page);
  await page.goto("/office/services");
  await page.getByRole("link", { name: "New Service" }).click();

  await page.getByRole("textbox", { name: "Name" }).fill("Painting");
  await page
    .getByRole("textbox", { name: "Description" })
    .fill("Walls and ceilings, inside.");
  await page.getByText("Both", { exact: true }).click();
  // only area pricing suits business premises
  await expect(page.getByRole("radio", { name: "By area" })).toBeChecked();
  await page.getByRole("textbox", { name: "Hours per 1,000 sq ft" }).fill("6");
  await page.getByText("Condition changes its hours").click();
  await page.getByRole("button", { name: "Add Service" }).click();

  await expect(page.getByText("Painting added")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Painting" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("Painting retired")).toBeVisible();
  await expect(page.getByText("Retired", { exact: true })).toBeVisible();

  await page
    .getByLabel("Breadcrumbs")
    .getByRole("link", { name: "Services" })
    .click();
  await expect(
    page.getByRole("grid", { name: "Services" }).getByText("Painting"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show 1" }).click();
  await expect(
    page.getByRole("grid", { name: "Retired Services" }).getByText("Painting"),
  ).toBeVisible();
});

test("a mistake on a Service is explained beside the field", async ({
  page,
}) => {
  await signInAsOffice(page);
  await page.goto("/office/services/new");

  await page.getByRole("textbox", { name: "Name" }).fill("Deep Clean");
  await page.getByRole("button", { name: "Add Service" }).click();

  const name = page.getByRole("textbox", { name: "Name" });
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAccessibleDescription(
    /Another Service already has this name/,
  );
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
      "the Services and a Service's page have no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await signInAsOffice(page);
        await page.goto("/office/services");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Services",
        );
        await expectNoViolations(page);

        await page.getByText("Commercial cleaning").click();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Commercial cleaning",
        );
        await expectNoViolations(page);
      },
    );
  });
}
