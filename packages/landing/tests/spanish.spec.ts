import { LANGUAGES, type Language } from "@empire-cleaning/models";
import { pages, pathOf, urlOf } from "../src/routes.ts";
import type { Page } from "@playwright/test";
import {
  emailsTo,
  expect,
  expectAccessible,
  newEmail,
  test,
} from "./harness.ts";

// what each language's pages say, written here rather than read from the
// site, so a wrong one there fails: Open Graph's name for the language, and
// the switch to the other one
const expected: Record<Language, { ogLocale: string; switchTo: string }> = {
  en: { ogLocale: "en_US", switchTo: "Español" },
  es: { ogLocale: "es_US", switchTo: "English" },
};

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
        expected[lang].ogLocale,
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

      await tab.getByRole("link", { name: expected[lang].switchTo }).click();
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

test("the Spanish home page is in Spanish, but for the reviews, and has no accessibility violations", async ({
  page,
}) => {
  await page.goto("/es/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Espacios limpios.",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Lo que limpiamos" }),
  ).toBeVisible();
  // the reviews as their Client wrote them
  await expect(page.locator("#reviews figure").first()).toHaveAttribute(
    "lang",
    "en",
  );
  // no "Se habla español" to someone reading Spanish
  await expect(page.getByText("Se habla español")).toHaveCount(0);
  // the form too, with the Services' Spanish names (#302)
  await expect(
    page.getByRole("radio", { name: /^Limpieza estándar/ }),
  ).toBeVisible();
  await expect(page.locator("#quote")).toContainText("Paso 1 de 4");
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

// the form asks in steps; Siguiente checks the step's fields, and this waits
// for the next one to show
const next = async (page: Page) => {
  const step = page.getByText(/^Paso \d de \d$/);
  const before = await step.textContent();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(step).not.toHaveText(before!);
};

test("a Guest asks for a Quote in Spanish, sees the API's messages in Spanish, and gets the Spanish receipt (#302)", async ({
  page,
}) => {
  const email = newEmail();
  await page.goto("/es/#quote");

  await page
    .locator("form")
    .getByText("Limpieza estándar", { exact: true })
    .click();
  await next(page);
  await page.getByText("Apartamento", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Dirección" })
    .fill("41-12 Austin St");
  // four digits: only the API says what's wrong
  await page.getByRole("textbox", { name: "Código postal" }).fill("1137");
  await next(page);
  await expect(
    page.getByRole("group", { name: "¿Algún adicional?" }),
  ).toContainText("Dentro del horno");
  await page.getByText("Intensa", { exact: true }).click();
  await next(page);
  await page
    .getByRole("textbox", { name: "Nombre completo" })
    .fill("Casey Client");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByRole("textbox", { name: "Teléfono" }).fill("(646) 555-0100");
  await page.getByRole("button", { name: "Pedir una cotización" }).click();

  // back on the step with the field, the API's message in Spanish
  const zip = page.getByRole("textbox", { name: "Código postal" });
  await expect(zip).toHaveAccessibleDescription(
    /Escriba un código postal de 5 dígitos/,
  );
  await expectAccessible(page);
  await zip.fill("11375");
  await next(page);
  await next(page);
  await page.getByRole("button", { name: "Pedir una cotización" }).click();

  await expect(page.getByText("Gracias, recibimos su solicitud")).toBeVisible();
  await expect(
    page.getByText(`Le enviaremos su cotización a ${email}`),
  ).toBeVisible();
  const [receipt] = await emailsTo(email);
  expect(receipt?.subject).toBe("Recibimos su solicitud de cotización");
  expect(receipt?.text).toMatch(/^Hola, Casey:/);
});
