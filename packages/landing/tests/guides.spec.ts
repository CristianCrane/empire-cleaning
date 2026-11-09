import { business } from "../src/business.ts";
import { faqs } from "../src/faqs.ts";
import { guides as twins, type Guide } from "../src/guides/index.ts";
import { pathOf } from "../src/routes.ts";
import { servicePages } from "../src/service-pages/index.ts";

// each guide's English page; the Spanish twins are spanish.spec.ts's
const guides = twins.map((twin) => twin.en);
const pathOfGuide = (guide: Guide) =>
  pathOf({ kind: "guide", guide: guide.key }, "en");
import { expect, expectAccessible, test } from "./harness.ts";

// a few evergreen guides (#180), each answering one question
for (const guide of guides) {
  test.describe(guide.crumb, () => {
    const path = pathOfGuide(guide);

    test("reads as one article, then the form", async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        guide.heading,
      );
      await expect(page.getByRole("heading", { level: 2 })).toHaveText([
        ...guide.sections.map((s) => s.title),
        "Request a quote",
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

      const url = new URL(path, business.url).href;
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
      for (const { service, under } of guide.linkedFrom) {
        await page.goto(pathOf({ kind: "service", service }, "en"));
        await expect(
          page
            .locator(under === "pricing" ? "#pricing" : "#when")
            .getByRole("link", { name: guide.link, exact: true }),
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
        await test.step(`${theme} theme`, () => expectAccessible(page));
      }
    });
  });
}

test("a guide reads without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const guide = guides[0]!;
  await page.goto(pathOfGuide(guide));

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
  expect(links).toEqual([pathOfGuide(guides[0]!)]);
});

test("the home page's questions open their answers, the price one leading to its guide", async ({
  page,
}) => {
  await page.goto("/");

  const section = page.locator("#faqs");
  for (const { question, answer } of faqs.en) {
    await expect(section.getByText(answer)).toBeHidden();
    await section.getByText(question).click();
    await expect(section.getByText(answer)).toBeVisible();
  }
  await section.getByRole("link", { name: "What affects the price" }).click();
  await expect(page).toHaveURL(/\/guides\/house-cleaning-cost\/$/);
});

test("every guide is in the sitemap", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  for (const guide of guides) {
    expect(sitemap).toContain(
      `<loc>${new URL(pathOfGuide(guide), business.url).href}</loc>`,
    );
  }
});

test("each guide links from service pages that exist", () => {
  for (const guide of guides) {
    for (const { service } of guide.linkedFrom) {
      expect(
        servicePages.some((p) => p.en.card === service),
        `${guide.key} → ${service}`,
      ).toBe(true);
    }
  }
});
