import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { business } from "../src/business.ts";

const sections = [
  "What we clean",
  "How it works",
  "Save 10% with a Service Plan",
  "Why Empire",
  "Request a Quote",
];

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    // dark is something a visitor chooses, remembered on their device
    test.beforeEach(async ({ page }) => {
      if (theme === "dark") {
        await page.addInitScript(() =>
          localStorage.setItem("ec-theme", "dark"),
        );
      }
    });

    test("shows every section", async ({ page }) => {
      await page.goto("/");

      await expect(
        page.getByRole("heading", { level: 1, name: /clean spaces/i }),
      ).toBeVisible();
      for (const name of sections) {
        await expect(
          page.getByRole("heading", { level: 2, name }),
        ).toBeVisible();
      }
    });

    test("has no accessibility violations", async ({ page }) => {
      await page.goto("/");

      const { violations } = await new AxeBuilder({ page }).analyze();

      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  });
}

test("everything reads and works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");

  for (const name of sections) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: `Call ${business.phone.display}` }).first(),
  ).toHaveAttribute("href", business.phone.href);
  await context.close();
});

test("the theme toggle is the only JavaScript on the page", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("astro-island")).toHaveCount(1);
  await expect(page.locator("astro-island")).toHaveAttribute(
    "component-export",
    "ThemeToggle",
  );
});

test("a chosen theme applies straight away and is remembered", async ({
  page,
}) => {
  await page.goto("/");
  // the toggle hydrates once the browser is idle; Astro drops "ssr" when it has
  await expect(page.locator("astro-island")).not.toHaveAttribute("ssr");
  await page.getByRole("button", { name: "Dark theme" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test.describe("on a device set to dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("the page is still light until the visitor chooses dark", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    const scheme = await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    );
    expect(scheme).toBe("light");
  });
});

test("Request a Quote leads to the quote section", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("main")
    .getByRole("link", { name: "Request a Quote" })
    .click();

  await expect(page).toHaveURL(/#quote$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Request a Quote" }),
  ).toBeInViewport();
});

test("fits the screen without sideways scrolling", async ({ page }) => {
  await page.goto("/");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe("search engines", () => {
  test("get a title, description and link preview", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(business.title);
    const meta = (selector: string) =>
      page.locator(selector).getAttribute("content");
    expect(await meta('meta[name="description"]')).toBe(business.description);
    expect(await meta('meta[property="og:title"]')).toBe(business.title);
    expect(await meta('meta[property="og:url"]')).toBe(business.url);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      business.url,
    );
  });

  test("get the business's details as structured data", async ({ page }) => {
    await page.goto("/");

    const data = JSON.parse(
      (await page
        .locator('script[type="application/ld+json"]')
        .textContent()) ?? "",
    );
    expect(data).toMatchObject({
      "@type": "LocalBusiness",
      name: business.name,
      telephone: business.phone.e164,
      url: business.url,
    });
  });

  test("find the page through robots.txt and the sitemap", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain(`Sitemap: ${business.url}sitemap-index.xml`);

    const index = await request.get("/sitemap-index.xml");
    expect(index.ok()).toBe(true);
    const sitemap = await (await request.get("/sitemap-0.xml")).text();
    expect(sitemap).toContain(`<loc>${business.url}</loc>`);
  });
});
