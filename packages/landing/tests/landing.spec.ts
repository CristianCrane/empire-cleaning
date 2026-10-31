import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { business } from "../src/business.ts";
import { googleReviewsUrl, reviews } from "../src/reviews.ts";
import { emailsTo, expect, test } from "./harness.ts";

// the form loads once its section scrolls into view, and lists the Services
// once they arrive from the API
const openQuoteForm = async (page: Page) => {
  await page.goto("/#quote");
  await expect(
    page.getByRole("radio", { name: /^Standard Clean/ }),
  ).toBeVisible();
};

// the form asks in steps; Next checks the step's required fields, and
// this waits for the next one to show
const next = async (page: Page) => {
  const step = page.getByText(/^Step \d of \d$/);
  const before = await step.textContent();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(step).not.toHaveText(before!);
};

// the first step: the Service asked for
const chooseService = async (page: Page, name = "Standard Clean") => {
  await page.locator("form").getByText(name, { exact: true }).click();
  await next(page);
};

// in the order they appear
const sections = [
  "What we clean",
  "Why Empire",
  "What our Clients say",
  "Save 10% with a Service Plan",
  "How it works",
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

    test(
      "shows every section",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await page.goto("/");

        await expect(
          page.getByRole("heading", { level: 1, name: /clean spaces/i }),
        ).toBeVisible();
        for (const name of sections) {
          await expect(
            page.getByRole("heading", { level: 2, name }),
          ).toBeVisible();
        }
        await expect(page.getByRole("heading", { level: 2 })).toHaveText(
          sections,
        );
      },
    );

    test(
      "has no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await openQuoteForm(page);
        const check = async () => {
          const { violations } = await new AxeBuilder({ page }).analyze();
          expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
        };

        // each step of the form
        await check();
        await chooseService(page);
        await check();
        await page
          .getByRole("textbox", { name: "Street address" })
          .fill("41-12 Austin St");
        await page.getByRole("textbox", { name: "ZIP code" }).fill("11375");
        await next(page);
        // the Add-ons arrive from the API a moment after the step
        await expect(
          page.getByRole("group", { name: "Any extras?" }),
        ).toBeVisible();
        await check();
        await next(page);
        await expect(
          page.getByRole("textbox", { name: "Full name" }),
        ).toBeVisible();
        await check();
      },
    );
  });
}

test(
  "everything reads and works without JavaScript",
  { tag: "@smoke" },
  async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");

    for (const name of sections) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await expect(
      page
        .getByRole("link", { name: `Call ${business.phone.display}` })
        .first(),
    ).toHaveAttribute("href", business.phone.href);
    // every review is there to swipe through, without buttons that do nothing
    await expect(
      page.getByRole("group", { name: `1 of ${reviews.length}` }),
    ).toContainText(reviews[0].text);
    await expect(page.locator("#reviews figure")).toHaveCount(reviews.length);
    await expect(
      page.getByRole("button", { name: "Next review" }),
    ).toBeHidden();
    // no form that couldn't send anything: the Quote section offers the phone
    await expect(page.locator("#quote form")).toHaveCount(0);
    await expect(page.locator("#quote")).toContainText(
      "and we'll put your Quote together",
    );
    await context.close();
  },
);

test.describe("requesting a Quote", () => {
  // steps 1 and 2: a Standard Clean, then what and where
  const fillWhere = async (page: Page, zip = "11375") => {
    await chooseService(page);
    await page.getByText("Apartment", { exact: true }).click();
    await page
      .getByRole("textbox", { name: "Street address" })
      .fill("41-12 Austin St");
    await page.getByRole("textbox", { name: "ZIP code" }).fill(zip);
  };

  // the last step: who's asking
  const fillDetails = async (page: Page) => {
    await page.getByRole("textbox", { name: "Full name" }).fill("Casey Client");
    await page
      .getByRole("textbox", { name: "Email" })
      .fill("casey@example.com");
    await page.getByRole("textbox", { name: "Phone" }).fill("(646) 555-0100");
  };

  // every step, taking the home as it comes
  const fillIn = async (page: Page, zip = "11375") => {
    await fillWhere(page, zip);
    await next(page);
    await next(page);
    await fillDetails(page);
  };

  test(
    "a Guest sends it and is told where the Quote will go",
    { tag: "@smoke" },
    async ({ page }) => {
      await openQuoteForm(page);
      await fillWhere(page);
      await next(page);
      await page.getByText("Heavy", { exact: true }).click();
      await page
        .getByText("After my first clean, I'd like regular visits", {
          exact: false,
        })
        .click();
      await next(page);
      await fillDetails(page);

      await page.getByRole("button", { name: "Request a Quote" }).click();

      await expect(
        page.getByText("Thanks, we've got your request"),
      ).toBeVisible();
      await expect(
        page.getByText("We'll email your Quote to casey@example.com"),
      ).toBeVisible();
      const [receipt] = await emailsTo("casey@example.com");
      expect(receipt?.subject).toBe("We've received your request for a Quote");
    },
  );

  test("the API's explanation shows beside the field", async ({ page }) => {
    await openQuoteForm(page);
    await fillIn(page, "1137");

    await page.getByRole("button", { name: "Request a Quote" }).click();

    // back on the step with the field
    const zip = page.getByRole("textbox", { name: "ZIP code" });
    await expect(zip).toHaveAttribute("aria-invalid", "true");
    await expect(zip).toHaveAccessibleDescription(/Enter a 5-digit ZIP code/);
    expect(await emailsTo("casey@example.com")).toEqual([]);
  });

  test("asking again about the same home explains a Quote is on its way", async ({
    page,
  }) => {
    await openQuoteForm(page);
    await fillIn(page);
    await page.getByRole("button", { name: "Request a Quote" }).click();
    await expect(
      page.getByText("Thanks, we've got your request"),
    ).toBeVisible();

    await page.reload();
    await openQuoteForm(page);
    await fillIn(page);
    await page.getByRole("button", { name: "Request a Quote" }).click();

    await expect(
      page.getByText(
        "You've already asked us for a Quote for this home. We'll email it to casey@example.com soon.",
      ),
    ).toBeVisible();
    // the form stays, nothing was sent twice
    await expect(
      page.getByRole("textbox", { name: "Full name" }),
    ).toBeVisible();
    expect(await emailsTo("casey@example.com")).toHaveLength(1);
  });

  test("extras are offered by name, with no prices, and can be chosen", async ({
    page,
  }) => {
    await openQuoteForm(page);
    await fillWhere(page);
    await next(page);
    const extras = page.getByRole("group", { name: "Any extras?" });
    await expect(extras.getByRole("checkbox")).toHaveCount(4);
    await expect(extras).not.toContainText("$");

    await extras.getByText("Inside the fridge").click();
    await expect(
      extras.getByRole("checkbox", { name: "Inside the fridge" }),
    ).toBeChecked();
    await next(page);
    await fillDetails(page);
    await page.getByRole("button", { name: "Request a Quote" }).click();

    await expect(
      page.getByText("Thanks, we've got your request"),
    ).toBeVisible();
  });

  test("a Service like Painting asks only what it needs: a rough area, no Condition or visits", async ({
    page,
  }) => {
    await openQuoteForm(page);
    // the Service chosen says what it is
    await page.locator("form").getByText("Painting", { exact: true }).click();
    await expect(page.getByText(/^Walls, ceilings and trim/)).toBeVisible();
    await next(page);
    // offered for homes and businesses alike
    await expect(
      page.getByText("Business premises", { exact: true }),
    ).toBeVisible();
    await page.getByText("Apartment", { exact: true }).click();
    await page
      .getByRole("textbox", { name: "Street address" })
      .fill("41-12 Austin St");
    await page.getByRole("textbox", { name: "ZIP code" }).fill("11375");
    await next(page);

    await expect(page.getByText("How much cleaning does it need?")).toHaveCount(
      0,
    );
    await expect(page.getByText(/regular visits/)).toHaveCount(0);
    // nor its rooms, which only price cleaning
    await expect(page.getByText("Bedrooms", { exact: true })).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Area in sq ft (optional)" })
      .fill("350");
    await next(page);
    await fillDetails(page);
    await page.getByRole("button", { name: "Request a Quote" }).click();

    await expect(
      page.getByText("We'll email your Quote to casey@example.com"),
    ).toBeVisible();
  });

  test("a business asks for its premises to be cleaned on chosen days", async ({
    page,
  }) => {
    await openQuoteForm(page);
    // for business premises alone, so where is all the next step asks
    await chooseService(page, "Commercial cleaning");
    await expect(page.getByText("Apartment", { exact: true })).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Street address" })
      .fill("200 Park Ave S");
    await page.getByRole("textbox", { name: "ZIP code" }).fill("10003");
    await next(page);
    // a Site Visit finds these, so they aren't asked
    await expect(page.getByText("How much cleaning does it need?")).toHaveCount(
      0,
    );
    await expect(page.getByRole("group", { name: "Any extras?" })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: /Type of premises/ }).click();
    await page.getByRole("option", { name: "Medical" }).click();
    await page.getByText("Tue", { exact: true }).click();
    await page.getByText("Thu", { exact: true }).click();
    await page.getByRole("button", { name: /Preferred start time/ }).click();
    await page.getByRole("option", { name: "7:30 PM" }).click();
    await next(page);
    await page
      .getByRole("textbox", { name: "Business name" })
      .fill("Acme Dental");
    await fillDetails(page);

    await page.getByRole("button", { name: "Request a Quote" }).click();

    await expect(
      page.getByText("We'll email your Quote to casey@example.com"),
    ).toBeVisible();
    const [receipt] = await emailsTo("casey@example.com");
    expect(receipt?.text).toContain("200 Park Ave S, 10003");
  });

  test("required details are asked for before anything is sent", async ({
    page,
  }) => {
    await openQuoteForm(page);

    await page.getByRole("button", { name: "Next", exact: true }).click();

    // still on the first step, then the second
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await chooseService(page);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Street address" }),
    ).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: "Back" }).click();
    await fillWhere(page);
    await next(page);
    await next(page);
    await page.getByRole("button", { name: "Request a Quote" }).click();
    await expect(
      page.getByRole("textbox", { name: "Full name" }),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Thanks, we've got your request")).toHaveCount(
      0,
    );
  });
});

test.describe("reviews", () => {
  const review = (page: Page, i: number) =>
    page.getByRole("group", { name: `${i} of ${reviews.length}` });

  test("show one at a time, stepping through with Previous and Next", async ({
    page,
  }) => {
    await page.goto("/#reviews");
    const count = page.locator("#reviews [data-count]");
    await expect(count).toHaveText(`1 of ${reviews.length}`);
    await expect(review(page, 1)).toBeInViewport({ ratio: 0.9 });
    await expect(review(page, 2)).not.toBeInViewport();

    await page.getByRole("button", { name: "Next review" }).click();
    await expect(count).toHaveText(`2 of ${reviews.length}`);
    await expect(review(page, 2)).toBeInViewport({ ratio: 0.9 });
    await expect(review(page, 1)).not.toBeInViewport();
  });

  test("wrap round at either end", async ({ page }) => {
    await page.goto("/#reviews");
    const count = page.locator("#reviews [data-count]");

    await page.getByRole("button", { name: "Previous review" }).click();
    await expect(count).toHaveText(`${reviews.length} of ${reviews.length}`);
    await expect(review(page, reviews.length)).toBeInViewport({ ratio: 0.9 });

    await page.getByRole("button", { name: "Next review" }).click();
    await expect(count).toHaveText(`1 of ${reviews.length}`);
  });

  test("link to all our reviews on Google", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "Read all our reviews on Google" }),
    ).toHaveAttribute("href", googleReviewsUrl);
  });
});

test("the only JavaScript is the theme toggle, the Quote form and the reviews' buttons", async ({
  page,
}) => {
  await page.goto("/");

  // the reviews' buttons are a few lines of plain script, not an island
  const islands = page.locator("astro-island");
  await expect(islands).toHaveCount(2);
  expect(
    await islands.evaluateAll((all) =>
      all.map((i) => i.getAttribute("component-export")).sort(),
    ),
  ).toEqual(["QuoteForm", "ThemeToggle"]);
});

test("a chosen theme applies straight away and is remembered", async ({
  page,
}) => {
  await page.goto("/");
  // the toggle hydrates once the browser is idle; Astro drops "ssr" when it has
  await expect(
    page.locator(`astro-island[component-export="ThemeToggle"]`),
  ).not.toHaveAttribute("ssr");
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

test(
  "fits the screen without sideways scrolling",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  },
);

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
