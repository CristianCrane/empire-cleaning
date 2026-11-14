import type { Page } from "@playwright/test";
import {
  createStaff,
  expect,
  expectAccessible,
  requestQuoteAsGuest,
  signedInAs,
  test,
  draftTheQuote,
  goTo,
  eachTheme,
  listRows,
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

test(
  "Office Staff change a Service's rate, and new Quotes are priced at it",
  { tag: "@smoke" },
  async ({ page }) => {
    await signInAsOffice(page);
    await goTo(page, "Services");
    await expect(page).toHaveURL("/office/services");

    const services = listRows(page, "Services");
    await expect(services).toHaveCount(5);
    await services.filter({ hasText: "Standard Clean" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Standard Clean" }),
    ).toBeVisible();
    // what the figures come to, as a Quote, as they're typed: 1 + 2 x 0.5
    // + 1.5 x 0.75 = 3.125 h, up to 3.25 h, x $55 = $179, + 8.875%
    const example = page.getByRole("region", { name: "Example quote" });
    await expect(example).toContainText(
      "A 2-bedroom, 1½-bathroom home, in moderate condition",
    );
    await expect(example).toContainText(
      "Cleaning hours, rounded up to the quarter-hour3.25 h",
    );
    await expect(example).toContainText("Total$194.89");
    await expect(example).not.toContainText("Your changes");
    await page.getByRole("textbox", { name: "Hourly rate" }).fill("$60");
    await page.getByRole("textbox", { name: "Hourly rate" }).blur();
    // the saved figures' price beside the new one
    await expect(example).toContainText("Your changes: +$17.42 on this quote");
    await expect(example).toContainText("Total$212.31");
    await expect(example).toContainText("was $179.00$195.00");

    // another place, and another Condition: 1 + 4 x 0.5 + 3 x 0.75 + 0.5
    // + 0.5 = 6.25 h, x 1.4 heavy (the starting figure) = 8.75 h, x $60
    // = $525, + 8.875%
    await example.getByText("4 bed").click();
    await example.getByText("Heavy").click();
    await expect(example).toContainText("Total$571.59");
    await page.getByRole("button", { name: "Save service" }).click();
    // and what a change to the prices touches, which Services once said
    await expect(
      page.getByText(
        "Service saved. Changes apply to prices worked out from now on. Quotes already sent keep their prices.",
      ),
    ).toBeVisible();
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
  await page.getByRole("link", { name: "New service" }).click();

  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Window cleaning");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
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
  const example = page.getByRole("region", { name: "Example quote" });
  await expect(example).toContainText("2,000 sq ft of office");
  await expect(example).toContainText(
    "Cleaning hours, rounded up to the quarter-hour12 h",
  );
  await expect(example).toContainText("Total$718.58");
  await expect(example).not.toContainText("Your changes");
  await page.getByRole("button", { name: "Add service" }).click();

  await expect(page.getByText("Window cleaning added")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Window cleaning" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Retire" }).click();
  await expect(
    page.getByText(
      "Window cleaning retired. Quotes, plans and jobs that used it still price by it.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Retired", { exact: true })).toBeVisible();

  // Retire's at the top, and a phone's toasts sit over the top bar and the
  // breadcrumbs, held there while the pointer rests on them: each let go
  // of, as someone would, the pointer kept on them so none goes mid-press
  const toasts = page.getByRole("region", { name: /notification/ });
  await toasts.hover();
  const dismiss = toasts.getByRole("button", { name: "Dismiss" });
  while ((await dismiss.count()) > 0) await dismiss.first().click();
  await page
    .getByLabel("Breadcrumbs")
    .getByRole("link", { name: "Services" })
    .click();
  await expect(listRows(page, "Services")).toHaveCount(5);
  await expect(
    listRows(page, "Services").filter({ hasText: "Window cleaning" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /Retired/ }).click();
  await expect(page).toHaveURL("/office/services?tab=retired");
  await expect(listRows(page, "Services")).toHaveText([/Window cleaning/]);
});

test("Office Staff give a Service its Spanish name and description, which Spanish readers get", async ({
  page,
}) => {
  await signInAsOffice(page);
  await goTo(page, "Services");
  await listRows(page, "Services")
    .filter({ hasText: "Standard Clean" })
    .click();
  // set once, so a line of what's set, opened to change
  const whatItIs = page.getByRole("button", { name: /^What it is/ });
  await expect(whatItIs).toContainText(
    "Standard Clean · homes · in Spanish too",
  );
  await whatItIs.click();
  const nameEs = page.getByRole("textbox", {
    name: "Name in Spanish (optional)",
  });
  // the starting Services come with theirs
  await expect(nameEs).toHaveValue("Limpieza estándar");
  await nameEs.fill("Limpieza básica");
  await page
    .getByRole("textbox", { name: "Description in Spanish (optional)" })
    .fill("Lo de siempre, bien hecho.");
  await page.getByRole("button", { name: "Save service" }).click();
  await expect(page.getByText("Service saved")).toBeVisible();

  await page.reload();
  await whatItIs.click();
  await expect(nameEs).toHaveValue("Limpieza básica");

  // what the Quote form lists, to a Spanish reader
  const offered = (await (
    await page.request.get("/api/services/on-offer", {
      headers: { "accept-language": "es" },
    })
  ).json()) as { name: string; description: string }[];
  expect(offered).toContainEqual(
    expect.objectContaining({
      name: "Limpieza básica",
      description: "Lo de siempre, bien hecho.",
    }),
  );
});

test("a mistake on a Service is explained beside the field", async ({
  page,
}) => {
  await signInAsOffice(page);
  await page.goto("/office/services/new");

  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Deep Clean");
  await page.getByRole("button", { name: "Add service" }).click();

  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAccessibleDescription(
    /Another service already has this name/,
  );
});

eachTheme(() => {
  test("the Services and a Service's page have no accessibility violations", async ({
    page,
  }) => {
    await signInAsOffice(page);
    await page.goto("/office/services");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Services",
    );
    await expectAccessible(page);

    await page.getByText("Commercial cleaning").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Commercial cleaning",
    );
    await expectAccessible(page);
  });
});
