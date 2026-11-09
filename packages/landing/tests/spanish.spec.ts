import { LANGUAGES } from "@empire-cleaning/models";
import { pages, pathOf, urlOf } from "../src/routes.ts";
import { expect, expectAccessible, test } from "./harness.ts";

// every page in English and in Spanish under /es/ (ADR-0025, #301): each
// says its language, links its twin both ways, and switches to it
for (const page of pages) {
  for (const lang of LANGUAGES) {
    const other = lang === "en" ? "es" : "en";
    const path = pathOf(page, lang);

    test(`${path} says its language, links its twin and switches to it`, async ({
      page: tab,
    }) => {
      await tab.goto(path);

      await expect(tab.locator("html")).toHaveAttribute("lang", lang);
      await expect(tab.locator('meta[property="og:locale"]')).toHaveAttribute(
        "content",
        lang === "en" ? "en_US" : "es_US",
      );
      await expect(tab.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        urlOf(page, lang),
      );
      for (const l of LANGUAGES) {
        await expect(
          tab.locator(`link[rel="alternate"][hreflang="${l}"]`),
        ).toHaveAttribute("href", urlOf(page, l));
      }
      await expect(
        tab.locator('link[rel="alternate"][hreflang="x-default"]'),
      ).toHaveAttribute("href", urlOf(page, "en"));

      // Spanish runs longer: it still fits the screen (docs/ux.md, Language)
      expect(
        await tab.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);

      await tab
        .getByRole("link", { name: lang === "en" ? "Español" : "English" })
        .click();
      await expect(tab).toHaveURL(new RegExp(`${pathOf(page, other)}$`));
      await expect(tab.locator("html")).toHaveAttribute("lang", other);
    });
  }
}

test("every page is in the sitemap in both languages", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  for (const page of pages) {
    for (const lang of LANGUAGES) {
      expect(sitemap).toContain(`<loc>${urlOf(page, lang)}</loc>`);
    }
  }
});

test("the Spanish home page is in Spanish, but for the reviews and the form, and has no accessibility violations", async ({
  page,
}) => {
  await page.goto("/es/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Espacios limpios.",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Lo que limpiamos" }),
  ).toBeVisible();
  // the reviews as their Client wrote them, and the form until #302
  await expect(page.locator("#reviews figure").first()).toHaveAttribute(
    "lang",
    "en",
  );
  await expect(page.locator("#quote")).toContainText(
    "Por ahora el formulario está en inglés.",
  );
  // no "Se habla español" to someone reading Spanish
  await expect(page.getByText("Se habla español")).toHaveCount(0);
  await expect(
    page.getByRole("radio", { name: /^Standard Clean/ }),
  ).toBeVisible();
  await expectAccessible(page);
});

test("an address that isn't a page says so in Spanish too, leading to the Spanish home page", async ({
  page,
}) => {
  await page.goto("/es/no-existe/");

  await expect(
    page.getByText("No hay ninguna página en esta dirección."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ir a la página en español" }).click();
  await expect(page).toHaveURL(/\/es\/#quote$/);
});
