import AxeBuilder from "@axe-core/playwright";
import { business } from "../src/business.ts";
import { faqs } from "../src/faqs.ts";
import { guides } from "../src/guides/index.ts";
import { servicePages } from "../src/service-pages/index.ts";
import { expect, test } from "./harness.ts";

// a few evergreen guides (#180), each answering one question
for (const guide of guides) {
  test.describe(guide.crumb, () => {
    const path = `/guides/${guide.slug}/`;

    test("reads as one article, then the form", async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        guide.heading,
      );
      await expect(page.getByRole("heading", { level: 2 })).toHaveText([
        ...guide.sections.map((s) => s.title),
        "Request a Quote",
        "Our services",
      ]);
      await expect(
        page.getByRole("navigation", { name: "Breadcrumbs" }),
      ).toHaveText(`Home${guide.crumb}`);
      // and fits the screen, without sideways scrolling
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });

    test("gets its own title, description, address and article data", async ({
      page,
    }) => {
      await page.goto(path);

      const url = `${business.url}guides/${guide.slug}/`;
      await expect(page).toHaveTitle(`${guide.title} | Empire Cleaning`);
      expect(
        await page.locator('meta[name="description"]').getAttribute("content"),
      ).toBe(guide.description);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        url,
      );
      const data = JSON.parse(
        (await page
          .locator('script[type="application/ld+json"]')
          .textContent()) ?? "",
      );
      const [place, , crumbs, article] = data["@graph"];
      expect(crumbs.itemListElement[1]).toMatchObject({
        name: guide.crumb,
        item: url,
      });
      expect(article).toMatchObject({
        "@type": "Article",
        headline: guide.heading,
        datePublished: guide.published,
        author: { "@id": place["@id"] },
        publisher: { "@id": place["@id"] },
      });
    });

    test("is linked from the service pages it belongs to", async ({ page }) => {
      for (const { service, under, text } of guide.linkedFrom) {
        await page.goto(`/services/${service}/`);
        await expect(
          page
            .locator(under === "pricing" ? "#pricing" : "#when")
            .getByRole("link", { name: text }),
        ).toHaveAttribute("href", path);
      }
    });

    test("has no accessibility violations, in either theme", async ({
      page,
    }) => {
      for (const theme of ["light", "dark"]) {
        await page.goto(path);
        await page.evaluate((t) => localStorage.setItem("ec-theme", t), theme);
        await page.reload();
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

test("a guide reads without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const [guide] = guides;
  await page.goto(`/guides/${guide.slug}/`);

  for (const { title } of guide.sections) {
    await expect(
      page.getByRole("heading", { level: 2, name: title }),
    ).toBeVisible();
  }
  await context.close();
});

test("the home page doesn't link to the guides, except the price answer", async ({
  page,
}) => {
  await page.goto("/");

  const links = await page
    .locator('a[href^="/guides/"]')
    .evaluateAll((all) => all.map((a) => a.getAttribute("href")));
  expect(links).toEqual(["/guides/house-cleaning-cost/"]);
});

test("the home page's questions open their answers, the price one leading to its guide", async ({
  page,
}) => {
  await page.goto("/");

  const section = page.locator("#faqs");
  for (const { question, answer } of faqs) {
    await expect(section.getByText(answer)).toBeHidden();
    await section.getByText(question).click();
    await expect(section.getByText(answer)).toBeVisible();
  }
  await section.getByRole("link", { name: "What affects the price" }).click();
  await expect(page).toHaveURL(/\/guides\/house-cleaning-cost\/$/);
});

test("every guide is in the sitemap", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  for (const { slug } of guides) {
    expect(sitemap).toContain(`<loc>${business.url}guides/${slug}/</loc>`);
  }
});

test("each guide links from service pages that exist", () => {
  for (const guide of guides) {
    for (const { service } of guide.linkedFrom) {
      expect(
        servicePages.some((p) => p.slug === service),
        `${guide.slug} → ${service}`,
      ).toBe(true);
    }
  }
});
