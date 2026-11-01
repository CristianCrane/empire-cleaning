import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { business } from "../src/business.ts";
import { servicePages } from "../src/service-pages/index.ts";
import { services } from "../src/services.ts";
import { expect, test } from "./harness.ts";

// a page per service (#177), each in its own words
const sections = (page: (typeof servicePages)[number]) => [
  page.included.title,
  page.pricing.title,
  page.when.title,
  "What our Clients say",
  "Questions we're asked",
  "How it works",
  "Request a Quote",
  "Related services",
];

// the form's Services arrive from the API a moment after the page
const formReady = (page: Page) =>
  expect(page.getByRole("radio", { name: /^Standard Clean/ })).toBeVisible();

for (const service of servicePages) {
  test.describe(service.card, () => {
    const path = `/services/${service.slug}/`;

    test("shows its sections, in order", async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        service.heading,
      );
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(
        sections(service),
      );
      await expect(
        page.getByRole("navigation", { name: "Breadcrumbs" }),
      ).toHaveText(`Home${service.card}`);
      for (const { items } of service.included.rooms) {
        for (const item of items) {
          await expect(page.locator("#included")).toContainText(item);
        }
      }
      // and fits the screen, without sideways scrolling
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });

    test("gets its own title, description and address", async ({ page }) => {
      await page.goto(path);

      const url = `${business.url}services/${service.slug}/`;
      await expect(page).toHaveTitle(`${service.title} | Empire Cleaning`);
      const meta = (selector: string) =>
        page.locator(selector).getAttribute("content");
      expect(await meta('meta[name="description"]')).toBe(service.description);
      expect(await meta('meta[property="og:url"]')).toBe(url);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        url,
      );
    });

    test("gets the business, its breadcrumbs and the service as structured data", async ({
      page,
    }) => {
      await page.goto(path);

      const data = JSON.parse(
        (await page
          .locator('script[type="application/ld+json"]')
          .textContent()) ?? "",
      );
      const [place, , crumbs, offered] = data["@graph"];
      const url = `${business.url}services/${service.slug}/`;
      expect(crumbs).toMatchObject({
        "@type": "BreadcrumbList",
        itemListElement: [
          { position: 1, name: "Home", item: business.url },
          { position: 2, name: service.card, item: url },
        ],
      });
      expect(offered).toMatchObject({
        "@type": "Service",
        name: service.heading,
        url,
        provider: { "@id": place["@id"] },
      });
      expect(offered.areaServed.map((a: { name: string }) => a.name)).toEqual(
        business.areas.map((a) => a.name),
      );
    });

    test("opens its Quote form with its Service chosen, where the Office has one", async ({
      page,
    }) => {
      await page.goto(`${path}#quote`);
      await formReady(page);

      const radios = page.locator("form").getByRole("radio");
      if (service.office) {
        await expect(
          page.getByRole("radio", {
            name: new RegExp(`^${service.office.name}`),
          }),
        ).toBeChecked();
      } else {
        // the copy says which to choose instead
        for (const radio of await radios.all()) {
          await expect(radio).not.toBeChecked();
        }
      }
    });

    test("has no accessibility violations, in either theme", async ({
      page,
    }) => {
      for (const theme of ["light", "dark"]) {
        await page.goto(path);
        await page.evaluate((t) => localStorage.setItem("ec-theme", t), theme);
        await page.reload();
        await formReady(page);
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map((v) => `${theme} ${v.id}: ${v.help}`)).toEqual(
          [],
        );
      }
    });
  });
}

test("the recurring page's Quote asks for regular visits already", async ({
  page,
}) => {
  await page.goto("/services/recurring-cleaning/#quote");
  await formReady(page);

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Street address" })
    .fill("41-12 Austin St");
  await page.getByRole("textbox", { name: "ZIP code" }).fill("11375");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(
    page.getByRole("checkbox", { name: /regular visits/ }),
  ).toBeChecked();
});

test("a service page reads without JavaScript, its answers a tap away", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const [service] = servicePages;
  await page.goto(`/services/${service.slug}/`);

  for (const name of sections(service)) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  const { question, answer } = service.faqs[0];
  await expect(page.getByText(answer)).toBeHidden();
  await page.getByText(question).click();
  await expect(page.getByText(answer)).toBeVisible();
  await context.close();
});

test("a service page's only JavaScript is the theme toggle, the Quote form and the reviews' buttons", async ({
  page,
}) => {
  await page.goto(`/services/${servicePages[0].slug}/`);

  expect(
    await page
      .locator("astro-island")
      .evaluateAll((all) =>
        all.map((i) => i.getAttribute("component-export")).sort(),
      ),
  ).toEqual(["QuoteForm", "ThemeToggle"]);
});

test("the home page's service cards lead to their pages, all but Custom cleaning", async ({
  page,
}) => {
  await page.goto("/");

  const cards = page.locator("#services");
  for (const { name } of services) {
    const service = servicePages.find((p) => p.card === name);
    const link = cards.getByRole("link", { name });
    if (service) {
      await expect(link).toHaveAttribute("href", `/services/${service.slug}/`);
    } else {
      await expect(link).toHaveCount(0);
    }
  }
  // the whole card leads there, not only its name: a press on its words
  // lands on the link stretched over it
  const text = cards.getByText(/^Dust, debris/);
  await text.scrollIntoViewIfNeeded();
  const words = await text.boundingBox();
  await page.mouse.click(
    words!.x + words!.width / 2,
    words!.y + words!.height / 2,
  );
  await expect(page).toHaveURL(/\/services\/post-construction-cleaning\/$/);
});

test("an area's most-asked services lead to their pages", async ({ page }) => {
  await page.goto("/queens/");

  await page
    .locator("#popular")
    .getByRole("link", { name: "Move-in and move-out" })
    .click();
  await expect(page).toHaveURL(/\/services\/move-in-move-out-cleaning\/$/);
});

test("every service page is in the sitemap", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  for (const { slug } of servicePages) {
    expect(sitemap).toContain(`<loc>${business.url}services/${slug}/</loc>`);
  }
});

test("each service's page is its own: no two share a title, description or heading", async ({
  page,
}) => {
  const seen = {
    title: new Set(),
    description: new Set(),
    heading: new Set(),
  };
  for (const service of servicePages) {
    for (const key of ["title", "description", "heading"] as const) {
      expect(seen[key].has(service[key]), `${service.card} ${key}`).toBe(false);
      seen[key].add(service[key]);
    }
    await page.goto(`/services/${service.slug}/`);
    // at least ~400 words of its own, beside what every page shares
    const own = await page
      .locator("#included, #pricing, #when, #faqs, #page-title")
      .allTextContents();
    const words = own.join(" ").split(/\s+/).length;
    expect(words, service.card).toBeGreaterThanOrEqual(400);
  }
});
