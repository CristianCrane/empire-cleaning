import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  createStaff,
  expect,
  requestQuoteAsGuest,
  signedInAs,
  test,
  draftTheQuote,
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
    await expect(services.getByRole("row")).toHaveCount(6);
    await services.getByRole("row", { name: /Standard Clean/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Standard Clean" }),
    ).toBeVisible();
    // what the figures come to, as a Quote, as they're typed: 1 + 2 x 0.5
    // + 1.5 x 0.75 = 3.125 h, up to 3.25 h, x $55 = $179, + 8.875%
    const example = page.getByRole("region", { name: "Example Quote" });
    await expect(example).toContainText(
      "A 2-bedroom, 1½-bathroom home, in moderate Condition",
    );
    await expect(example).toContainText(
      "Labour Hours, up to the quarter-hour3.25 h",
    );
    await expect(example).toContainText("Total$194.89");
    await expect(example).not.toContainText("Your changes");
    await page.getByRole("textbox", { name: "Hourly rate" }).fill("$60");
    await page.getByRole("textbox", { name: "Hourly rate" }).blur();
    // the saved figures' price beside the new one
    await expect(example).toContainText("Your changes: +$17.42 on this Quote");
    await expect(example).toContainText("Total$212.31");
    await expect(example).toContainText("was $179.00$195.00");

    // another place, and another Condition: 1 + 4 x 0.5 + 3 x 0.75 + 0.5
    // + 0.5 = 6.25 h, x 1.4 heavy (the starting figure) = 8.75 h, x $60
    // = $525, + 8.875%
    await example.getByText("4 bed").click();
    await example.getByText("Heavy").click();
    await expect(example).toContainText("Total$571.59");
    await page.getByRole("button", { name: "Save Service" }).click();
    await expect(page.getByText("Service saved")).toBeVisible();
    await expect(
      page.getByText(/^Version \d+, saved by Olive Owner/),
    ).toBeVisible();

    await requestQuoteAsGuest(casey);
    await page.goto("/office/quotes");
    await page.getByText("Casey Client").click();
    await draftTheQuote(page);

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

  await page.getByRole("textbox", { name: "Name" }).fill("Window cleaning");
  await page
    .getByRole("textbox", { name: "Description" })
    .fill("Every window, inside and out.");
  await page.getByText("Both", { exact: true }).click();
  // only area pricing suits business premises
  await expect(page.getByRole("radio", { name: "By area" })).toBeChecked();
  await page.getByRole("textbox", { name: "Hours per 1,000 sq ft" }).fill("6");
  await page
    .getByText("Takes longer the dirtier the place is (Condition)")
    .click();
  // 2 x 6 h = 12 h at $55 = $660, + 8.875% = $718.58; nothing saved to
  // compare with
  const example = page.getByRole("region", { name: "Example Quote" });
  await expect(example).toContainText("2,000 sq ft of office");
  await expect(example).toContainText(
    "Labour Hours, up to the quarter-hour12 h",
  );
  await expect(example).toContainText("Total$718.58");
  await expect(example).not.toContainText("Your changes");
  await page.getByRole("button", { name: "Add Service" }).click();

  await expect(page.getByText("Window cleaning added")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Window cleaning" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("Window cleaning retired")).toBeVisible();
  await expect(page.getByText("Retired", { exact: true })).toBeVisible();

  await page
    .getByLabel("Breadcrumbs")
    .getByRole("link", { name: "Services" })
    .click();
  await expect(
    page.getByRole("grid", { name: "Services" }).getByText("Window cleaning"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show 1" }).click();
  await expect(
    page
      .getByRole("grid", { name: "Retired Services" })
      .getByText("Window cleaning"),
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
