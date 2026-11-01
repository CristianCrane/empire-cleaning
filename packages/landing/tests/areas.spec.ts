import AxeBuilder from "@axe-core/playwright";
import { areas } from "../src/areas/index.ts";
import { business } from "../src/business.ts";
import { expect, test } from "./harness.ts";

// a page per area we serve (#176), each in its own words
const sections = (area: (typeof areas)[number]) => [
  area.places.title,
  area.homes.title,
  area.popular.title,
  "What our Clients say",
  "Questions we're asked",
  "How it works",
  "Request a Quote",
];

for (const area of areas) {
  test.describe(area.name, () => {
    const path = `/${area.slug}/`;

    test("shows its sections, in order", async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        area.heading,
      );
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(
        sections(area),
      );
      await expect(
        page.getByRole("navigation", { name: "Breadcrumbs" }),
      ).toHaveText(`Home${area.name}`);
      for (const place of area.places.list) {
        await expect(page.locator("#places")).toContainText(place);
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

      const url = `${business.url}${area.slug}/`;
      await expect(page).toHaveTitle(`${area.title} | Empire Cleaning`);
      const meta = (selector: string) =>
        page.locator(selector).getAttribute("content");
      expect(await meta('meta[name="description"]')).toBe(area.description);
      expect(await meta('meta[property="og:url"]')).toBe(url);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        url,
      );
    });

    test("gets the business, its breadcrumbs and cleaning there as structured data", async ({
      page,
    }) => {
      await page.goto(path);

      const data = JSON.parse(
        (await page
          .locator('script[type="application/ld+json"]')
          .textContent()) ?? "",
      );
      const [place, , crumbs, service] = data["@graph"];
      expect(place["@id"]).toBe(`${business.url}#business`);
      expect(crumbs).toMatchObject({
        "@type": "BreadcrumbList",
        itemListElement: [
          { position: 1, name: "Home", item: business.url },
          {
            position: 2,
            name: area.name,
            item: `${business.url}${area.slug}/`,
          },
        ],
      });
      expect(service).toMatchObject({
        "@type": "Service",
        provider: { "@id": place["@id"] },
        areaServed: { name: area.name, sameAs: area.wiki },
      });
    });

    test("has no accessibility violations, in either theme", async ({
      page,
    }) => {
      for (const theme of ["light", "dark"]) {
        await page.goto(path);
        await page.evaluate((t) => localStorage.setItem("ec-theme", t), theme);
        await page.reload();
        // the form's Services arrive from the API
        await expect(
          page.getByRole("radio", { name: /^Standard Clean/ }),
        ).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map((v) => `${theme} ${v.id}: ${v.help}`)).toEqual(
          [],
        );
      }
    });
  });
}

test("an area's page reads without JavaScript, its answers a tap away", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const [area] = areas;
  await page.goto(`/${area.slug}/`);

  for (const name of sections(area)) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  const { question, answer } = area.faqs[0];
  await expect(page.getByText(answer)).toBeHidden();
  await page.getByText(question).click();
  await expect(page.getByText(answer)).toBeVisible();
  await context.close();
});

test("an area's only JavaScript is the theme toggle, the Quote form and the reviews' buttons", async ({
  page,
}) => {
  await page.goto(`/${areas[0].slug}/`);

  const islands = page.locator("astro-island");
  expect(
    await islands.evaluateAll((all) =>
      all.map((i) => i.getAttribute("component-export")).sort(),
    ),
  ).toEqual(["QuoteForm", "ThemeToggle"]);
});

test("the home page links to every area, in Why Empire and the footer", async ({
  page,
}) => {
  await page.goto("/");

  for (const area of areas) {
    await expect(
      page.locator("#why-empire").getByRole("link", { name: area.short }),
    ).toHaveAttribute("href", `/${area.slug}/`);
    await expect(
      page
        .getByRole("navigation", { name: "Areas we serve" })
        .getByRole("link", { name: area.name }),
    ).toHaveAttribute("href", `/${area.slug}/`);
  }
  await page
    .getByRole("navigation", { name: "Areas we serve" })
    .getByRole("link", { name: "Brooklyn" })
    .click();
  await expect(page).toHaveURL(/\/brooklyn\/$/);
  // and back by the breadcrumbs
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Home" })
    .click();
  await expect(page).toHaveURL(/\/$/);
});

test("every area's page is in the sitemap", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  for (const area of areas) {
    expect(sitemap).toContain(`<loc>${business.url}${area.slug}/</loc>`);
  }
});

test("each area's page is its own: no two share a title, description, heading or text", async ({
  page,
}) => {
  const seen = { title: new Set(), description: new Set(), heading: new Set() };
  for (const area of areas) {
    for (const key of ["title", "description", "heading"] as const) {
      expect(seen[key].has(area[key]), `${area.name} ${key}`).toBe(false);
      seen[key].add(area[key]);
    }
    await page.goto(`/${area.slug}/`);
    // at least ~400 words of its own, beside what every page shares
    const own = await page
      .locator("#places, #homes, #popular, #faqs, #area-title")
      .allTextContents();
    const words = own.join(" ").split(/\s+/).length;
    expect(words, area.name).toBeGreaterThanOrEqual(400);
  }
});
