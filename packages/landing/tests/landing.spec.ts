import type { Locator, Page } from "@playwright/test";
import { business } from "../src/business.ts";
import { guides } from "../src/guides/index.ts";
import { reviews } from "../src/reviews.ts";
import { appUrl } from "../playwright.config.ts";
import {
  emailsTo,
  expect,
  expectAccessible,
  newEmail,
  test,
} from "./harness.ts";

// every kind of page: the home page, an area, a service, both guides
const everyKindOfPage = [
  "/",
  "/queens/",
  "/services/deep-cleaning/",
  ...guides.map((g) => `/guides/${g.slug}/`),
];

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
  "What our clients say",
  "Why Empire",
  "How it works",
  "Request a quote",
  "Save 10% with a cleaning plan",
  "Questions we're asked",
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
        // each step of the form
        await expectAccessible(page);
        await chooseService(page);
        await expectAccessible(page);
        await page
          .getByRole("textbox", { name: "Street address" })
          .fill("41-12 Austin St");
        await page.getByRole("textbox", { name: "ZIP code" }).fill("11375");
        await next(page);
        // the Add-ons arrive from the API a moment after the step
        await expect(
          page.getByRole("group", { name: "Any extras?" }),
        ).toBeVisible();
        await expectAccessible(page);
        await next(page);
        await expect(
          page.getByRole("textbox", { name: "Full name" }),
        ).toBeVisible();
        await expectAccessible(page);
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
    await expect(page.locator("#quote form")).toBeHidden();
    await expect(
      page.getByText("and we'll put your Quote together"),
    ).toBeVisible();
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
  const fillDetails = async (page: Page, email: string) => {
    await page.getByRole("textbox", { name: "Full name" }).fill("Casey Client");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("textbox", { name: "Phone" }).fill("(646) 555-0100");
  };

  // every step, taking the home as it comes
  const fillIn = async (page: Page, email: string, zip = "11375") => {
    await fillWhere(page, zip);
    await next(page);
    await next(page);
    await fillDetails(page, email);
  };

  test(
    "a Guest sends it and is told where the Quote will go",
    { tag: "@smoke" },
    async ({ page }) => {
      const email = newEmail();
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
      await fillDetails(page, email);

      await page.getByRole("button", { name: "Request a quote" }).click();

      await expect(
        page.getByText("Thanks, we've got your request"),
      ).toBeVisible();
      await expect(
        page.getByText(`We'll email your quote to ${email}`),
      ).toBeVisible();
      const [receipt] = await emailsTo(email);
      expect(receipt?.subject).toBe("We got your request for a quote");
    },
  );

  test("says which page it was sent from, and the link the visit began with", async ({
    page,
  }) => {
    const email = newEmail();
    // a visit from the Google Business Profile's link, asking from another
    // page
    await page.goto("/?utm_source=gbp&utm_medium=profile");
    await expect(
      page.getByRole("radio", { name: /^Standard Clean/ }),
    ).toBeVisible();
    await page.goto("/queens/#quote");
    await expect(
      page.getByRole("radio", { name: /^Standard Clean/ }),
    ).toBeVisible();
    await fillIn(page, email);

    const sent = page.waitForRequest(/\/api\/quotes\/ask$/);
    await page.getByRole("button", { name: "Request a quote" }).click();

    expect((await sent).postDataJSON().source).toEqual({
      page: "/queens/",
      utmSource: "gbp",
      utmMedium: "profile",
      utmCampaign: null,
    });
    await expect(
      page.getByText("Thanks, we've got your request"),
    ).toBeVisible();
  });

  test("a visit from no tagged link sends just the page", async ({ page }) => {
    const email = newEmail();
    await openQuoteForm(page);
    await fillIn(page, email);

    const sent = page.waitForRequest(/\/api\/quotes\/ask$/);
    await page.getByRole("button", { name: "Request a quote" }).click();

    expect((await sent).postDataJSON().source).toEqual({
      page: "/",
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
  });

  test("the API's explanation shows beside the field", async ({ page }) => {
    const email = newEmail();
    await openQuoteForm(page);
    await fillIn(page, email, "1137");

    await page.getByRole("button", { name: "Request a quote" }).click();

    // back on the step with the field
    const zip = page.getByRole("textbox", { name: "ZIP code" });
    await expect(zip).toHaveAttribute("aria-invalid", "true");
    await expect(zip).toHaveAccessibleDescription(/Enter a 5-digit ZIP code/);
    expect(await emailsTo(email)).toEqual([]);
  });

  test("asking too often says how long to wait (#32)", async ({ page }) => {
    const email = newEmail();
    // the server's limits are off in dev; it would answer like this
    await page.route("**/api/quotes/ask", (route) =>
      route.fulfill({
        status: 429,
        headers: { "retry-after": "720" },
        json: {
          message:
            "Too many tries. Please try again in 12 minutes, or call us on (646) 320-9076.",
        },
      }),
    );
    await openQuoteForm(page);
    await fillIn(page, email);
    await page.getByRole("button", { name: "Request a quote" }).click();

    await expect(
      page.getByText(
        "Too many tries. Please try again in 12 minutes, or call us on (646) 320-9076.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Full name" }),
    ).toBeVisible();
  });

  test("the field for bots is out of sight and reach, and sent only if filled (#32)", async ({
    page,
  }) => {
    const email = newEmail();
    await openQuoteForm(page);
    await fillIn(page, email);

    const field = page.locator('input[name="website"]');
    await expect(field).not.toBeInViewport();
    await expect(field).toHaveAttribute("tabindex", "-1");
    await expect(page.getByRole("textbox", { name: /website/i })).toHaveCount(
      0,
    );
    const sent = page.waitForRequest(/\/api\/quotes\/ask$/);
    await page.getByRole("button", { name: "Request a quote" }).click();

    expect((await sent).postDataJSON()).not.toHaveProperty("website");
  });

  test("asking again about the same home is thanked, and the inbox told a Quote is on its way", async ({
    page,
  }) => {
    const email = newEmail();
    await openQuoteForm(page);
    await fillIn(page, email);
    await page.getByRole("button", { name: "Request a quote" }).click();
    await expect(
      page.getByText("Thanks, we've got your request"),
    ).toBeVisible();

    await page.reload();
    await openQuoteForm(page);
    await fillIn(page, email);
    await page.getByRole("button", { name: "Request a quote" }).click();

    // anyone could have typed it, so the page says what it says to anyone,
    // and only the Client's inbox why (#243)
    await expect(
      page.getByText("Thanks, we've got your request"),
    ).toBeVisible();
    const mail = await emailsTo(email);
    expect(mail.map((m) => m.subject)).toEqual([
      "We got your request for a quote",
      "About your request for a quote",
    ]);
    expect(mail[1]!.text).toContain(
      "You've already asked us for a quote for 41-12 Austin St, 11375.",
    );
  });

  test("the extras are the last Service chosen's, even when the first one's come late", async ({
    page,
  }) => {
    // the first Service's extras are held back until the next one's are in
    let answerLate!: () => Promise<void>;
    let firstUrl = "";
    const held = new Promise<void>((resolve) => {
      void page.route("**/api/price-list/add-ons?*", async (route) => {
        if (firstUrl) return route.fallback();
        firstUrl = route.request().url();
        answerLate = () =>
          route.fulfill({
            json: [{ key: "from-before", name: "From the first Service" }],
          });
        resolve();
      });
    });
    await openQuoteForm(page);
    const form = page.locator("form");
    await form.getByText("Standard Clean", { exact: true }).click();
    await held;
    const second = page.waitForResponse(
      (r) =>
        r.url().includes("/api/price-list/add-ons?") && r.url() !== firstUrl,
    );
    await form.getByText("Deep Clean", { exact: true }).click();
    await second;
    const late = page.waitForResponse(firstUrl);
    await answerLate();
    await late;

    await next(page);
    await page.getByText("Apartment", { exact: true }).click();
    await page
      .getByRole("textbox", { name: "Street address" })
      .fill("41-12 Austin St");
    await page.getByRole("textbox", { name: "ZIP code" }).fill("11375");
    await next(page);
    const extras = page.getByRole("group", { name: "Any extras?" });
    await expect(extras.getByRole("checkbox").first()).toBeVisible();
    await expect(extras.getByText("From the first Service")).toHaveCount(0);
  });

  test("extras refused on sending are asked for again, for the Service chosen by then", async ({
    page,
  }) => {
    const email = newEmail();
    // an extra withdrawn since the form loaded: the server would answer so
    await page.route("**/api/quotes/ask", (route) =>
      route.fulfill({
        status: 400,
        json: { details: [{ path: "addOns.0", issue: "No longer offered" }] },
      }),
    );
    // the extras asked for again after the refusal are held back
    let asked = 0;
    let answerLate!: () => Promise<void>;
    let heldUrl = "";
    const held = new Promise<void>((resolve) => {
      void page.route("**/api/price-list/add-ons?*", async (route) => {
        if (++asked !== 2) return route.fallback();
        heldUrl = route.request().url();
        answerLate = () =>
          route.fulfill({
            json: [{ key: "from-before", name: "From the first Service" }],
          });
        resolve();
      });
    });
    await openQuoteForm(page);
    await fillWhere(page);
    await next(page);
    await page
      .getByRole("group", { name: "Any extras?" })
      .getByText("Inside the fridge")
      .click();
    await next(page);
    await fillDetails(page, email);
    await page.getByRole("button", { name: "Request a quote" }).click();
    await expect(
      page.getByText(
        "Some of the extras you chose are no longer offered. Please check your choices.",
      ),
    ).toBeVisible();
    await held;

    // back to the start, for another Service, before the answer comes
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    const deep = page.waitForResponse(
      (r) =>
        r.url().includes("/api/price-list/add-ons?") && r.url() !== heldUrl,
    );
    await page.locator("form").getByText("Deep Clean", { exact: true }).click();
    await deep;
    const late = page.waitForResponse(heldUrl);
    await answerLate();
    await late;
    await next(page);
    await next(page);

    const extras = page.getByRole("group", { name: "Any extras?" });
    await expect(extras.getByRole("checkbox").first()).toBeVisible();
    await expect(extras.getByText("From the first Service")).toHaveCount(0);
  });

  test("extras are offered by name, with no prices, and can be chosen", async ({
    page,
  }) => {
    const email = newEmail();
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
    await fillDetails(page, email);
    await page.getByRole("button", { name: "Request a quote" }).click();

    await expect(
      page.getByText("Thanks, we've got your request"),
    ).toBeVisible();
  });

  test("a Service like Painting asks only what it needs: a rough area, no Condition or visits", async ({
    page,
  }) => {
    const email = newEmail();
    await openQuoteForm(page);
    // the Service chosen says what it is
    await page.locator("form").getByText("Painting", { exact: true }).click();
    await expect(page.getByText(/^Walls, ceilings and trim/)).toBeVisible();
    await next(page);
    // offered for homes and businesses alike
    await expect(page.getByText("A business", { exact: true })).toBeVisible();
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
    await fillDetails(page, email);
    await page.getByRole("button", { name: "Request a quote" }).click();

    await expect(
      page.getByText(`We'll email your quote to ${email}`),
    ).toBeVisible();
  });

  test("a business asks for its premises to be cleaned on chosen days", async ({
    page,
  }) => {
    const email = newEmail();
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
    await page.getByRole("button", { name: /Type of business/ }).click();
    await page.getByRole("option", { name: "Medical" }).click();
    await page.getByText("Tue", { exact: true }).click();
    await page.getByText("Thu", { exact: true }).click();
    await page.getByRole("button", { name: /Preferred start time/ }).click();
    await page.getByRole("option", { name: "7:30 PM" }).click();
    await next(page);
    await page
      .getByRole("textbox", { name: "Business name" })
      .fill("Acme Dental");
    await fillDetails(page, email);

    await page.getByRole("button", { name: "Request a quote" }).click();

    await expect(
      page.getByText(`We'll email your quote to ${email}`),
    ).toBeVisible();
    const [receipt] = await emailsTo(email);
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
    await page.getByRole("button", { name: "Request a quote" }).click();
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
    ).toHaveAttribute("href", business.social.google.href);
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
      all.map((i) => i.getAttribute("component-export") ?? "").sort(),
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

test.describe("the Quote form, as it loads", () => {
  // the Services slow to arrive, as on a poor connection
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/services/on-offer", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
  });

  test(
    "holds its room, so nothing moves when it arrives",
    { tag: "@desktop" },
    async ({ page }) => {
      await page.goto("/#quote");
      const height = () =>
        page
          .locator("#quote")
          .evaluate((el) => el.getBoundingClientRect().height);
      // drawn in the page from the start, its tiles blank
      await expect(page.locator("#quote [aria-busy]")).toBeVisible();
      const before = await height();

      await expect(
        page.getByRole("radio", { name: /^Standard Clean/ }),
      ).toBeVisible();
      expect(await height()).toBeCloseTo(before, 0);

      // and the browser saw no layout shift worth the name
      const shift = await page.evaluate(
        () =>
          new Promise<{ total: number; moved: string[] }>((resolve) => {
            let total = 0;
            const moved: string[] = [];
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as (PerformanceEntry & {
                value: number;
                sources: { node?: Node }[];
              })[]) {
                total += entry.value;
                for (const { node } of entry.sources)
                  moved.push(
                    (node as Element | undefined)?.closest?.("[id]")?.id ??
                      node?.nodeName ??
                      "?",
                  );
              }
            }).observe({ type: "layout-shift", buffered: true });
            setTimeout(() => resolve({ total, moved }), 100);
          }),
      );
      expect(shift.total, `moved: ${shift.moved.join(", ")}`).toBeLessThan(
        0.01,
      );
    },
  );

  test("can't be used before it's ready", async ({ browser }) => {
    // the page as drawn, before its script runs
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.emulateMedia({});
    await page.goto("/");
    const form = page.locator("#quote form");
    // inert, whatever shows
    expect(await form.evaluate((f) => f.closest("[inert]") !== null)).toBe(
      true,
    );
    await context.close();
  });
});

test("Sign in in the header leads to the app, on a phone too", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Sign in" }),
  ).toHaveAttribute("href", appUrl);
});

test("Request a Quote leads to the quote section", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("main")
    .getByRole("link", { name: "Request a quote" })
    .click();

  await expect(page).toHaveURL(/#quote$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Request a quote" }),
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

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const textAlign = (page: Page, selector: string) =>
    page.locator(selector).evaluate((el) => getComputedStyle(el).textAlign);

  test("How it works' steps are centred, on a phone and three across", async ({
    page,
  }) => {
    await page.goto("/");
    const step = page.locator("#how-it-works li").first();
    const centred = () =>
      step.evaluate((li) => {
        const number = li.querySelector("span")!.getBoundingClientRect();
        const box = li.getBoundingClientRect();
        return {
          align: getComputedStyle(li).textAlign,
          // the number's middle is the step's middle
          numberCentred:
            Math.abs(
              number.left + number.width / 2 - (box.left + box.width / 2),
            ) < 1,
        };
      });
    expect(await centred()).toEqual({ align: "center", numberCentred: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await centred()).toEqual({ align: "center", numberCentred: true });
  });

  test("the footer is centred", async ({ page }) => {
    await page.goto("/");
    expect(await textAlign(page, "footer > div")).toBe("center");
  });
});

test("an intro is centred under its title at every width", async ({ page }) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const intro = page.locator("#services-title + p");
    expect(await intro.evaluate((p) => getComputedStyle(p).textAlign)).toBe(
      "center",
    );
  }
});

test("from a tablet, the footer has the areas left, the logo in the middle and the details right, level, then the © centred under them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");
  const footer = page.locator("footer");
  const box = async (part: Locator) => (await part.boundingBox())!;
  const [areas, logo, details, copyright, row] = await Promise.all([
    box(footer.getByRole("navigation", { name: "Areas we serve" })),
    box(footer.getByRole("img", { name: business.brand })),
    box(footer.locator("> div > :last-child")),
    box(footer.locator("> p")),
    box(footer.locator("> div")),
  ]);
  const middle = (b: { y: number; height: number }) => b.y + b.height / 2;
  const centre = (b: { x: number; width: number }) => b.x + b.width / 2;

  expect(areas.x + areas.width).toBeLessThan(logo.x);
  expect(logo.x + logo.width).toBeLessThan(details.x);
  expect(centre(logo)).toBeCloseTo(centre(row), 0);
  expect(middle(areas)).toBeCloseTo(middle(details), 0);
  expect(middle(logo)).toBeCloseTo(middle(details), 0);
  expect(copyright.y).toBeGreaterThan(row.y + row.height);
  expect(centre(copyright)).toBeCloseTo(centre(row), 0);
});

test("every Why Empire point is a card alike", async ({ page }) => {
  await page.goto("/");

  const points = page.locator("#why-empire li");
  await expect(points).toHaveCount(4);
  const borders = await points.evaluateAll((all) =>
    all.map((li) => getComputedStyle(li).borderTopWidth),
  );
  expect(borders.every((b) => b === borders[0] && b !== "0px")).toBe(true);
});

for (const path of everyKindOfPage) {
  test(`${path}'s bands alternate, plain and raised, the form on a raised one`, async ({
    page,
  }) => {
    await page.goto(path);

    const raised = await page
      .locator("main > section")
      .evaluateAll((all) =>
        all.map(
          (s) => getComputedStyle(s).backgroundColor !== "rgba(0, 0, 0, 0)",
        ),
      );
    // the hero first, plain, then each the other of the one before
    expect(raised).toEqual(raised.map((_, i) => i % 2 === 1));
    // the form's tiles are drawn for a raised band; a guide with an odd
    // number of parts puts it on a plain one
    expect(
      await page
        .locator("#quote")
        .evaluate((s) => getComputedStyle(s).backgroundColor),
    ).not.toBe("rgba(0, 0, 0, 0)");
  });
}

// every page imports the footer on its own, the 404 too
for (const path of [...everyKindOfPage, "/no-such-page"]) {
  test(`${path}'s foot links the business on Facebook, Instagram, Yelp and Google, each in a new tab`, async ({
    page,
  }) => {
    await page.goto(path);

    for (const { name, href } of Object.values(business.social)) {
      const link = page
        .locator("footer")
        .getByRole("link", { name: `Empire Cleaning on ${name}` });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener");
    }
  });
}

test.describe("the hero", () => {
  // phones, a tablet, laptops (the words move beside the logo at 1024), a
  // wide desktop
  for (const width of [360, 430, 768, 1024, 1280, 1440, 1920]) {
    test(`keeps its background's details clear of the words at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const hero = page.locator("section").first();
      const words = hero.locator("[data-hero-words]");
      const box = await words.boundingBox();
      const heroBox = await hero.boundingBox();

      // the background alone, the words hidden and their place kept; then
      // without its details (skyline, arcs, ripples, swoosh, glints), just
      // the soft light
      await words.evaluate((el) => (el.style.visibility = "hidden"));
      const withDetails = (await hero.screenshot()).toString("base64");
      await hero
        .locator("[data-backdrop-detail]")
        .evaluate((el) => (el.style.visibility = "hidden"));
      const plain = (await hero.screenshot()).toString("base64");

      // how far any pixel where the words sit is changed by the details, per
      // colour channel (0 to 255)
      const stray = await page.evaluate(
        async ({ withDetails, plain, x, y, w, h }) => {
          const pixels = async (shot: string) => {
            const img = new Image();
            img.src = `data:image/png;base64,${shot}`;
            await img.decode();
            const canvas = new OffscreenCanvas(img.width, img.height);
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            const scale = img.width / window.innerWidth;
            return ctx.getImageData(
              Math.round(x * scale),
              Math.round(y * scale),
              Math.round(w * scale),
              Math.round(h * scale),
            ).data;
          };
          const [a, b] = [await pixels(withDetails), await pixels(plain)];
          let most = 0;
          for (let i = 0; i < a.length; i += 4) {
            for (let c = 0; c < 3; c++) {
              most = Math.max(most, Math.abs(a[i + c]! - b[c + i]!));
            }
          }
          return most;
        },
        {
          withDetails,
          plain,
          x: box!.x - heroBox!.x,
          y: box!.y - heroBox!.y,
          w: box!.width,
          h: box!.height,
        },
      );
      expect(stray).toBeLessThanOrEqual(8);
    });
  }

  test("is centred up to a laptop, and beside the logo from there", async ({
    page,
  }) => {
    const align = () =>
      page
        .getByRole("heading", { level: 1 })
        .evaluate((h) => getComputedStyle(h).textAlign);

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/");
    expect(await align()).toBe("center");

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await align()).toBe("left");
  });
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
    expect(await meta('meta[property="og:image"]')).toBe(
      `${business.url}og-image.png`,
    );
    // the picture itself ships with the site
    expect((await page.request.get("/og-image.png")).ok()).toBe(true);
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
    const [place, site] = data["@graph"];
    expect(place).toMatchObject({
      "@type": "HomeAndConstructionBusiness",
      "@id": `${business.url}#business`,
      name: business.brand,
      legalName: business.name,
      telephone: business.phone.e164,
      url: business.url,
      openingHoursSpecification: {
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: "08:00",
        closes: "18:00",
      },
      knowsLanguage: ["en", "es"],
    });
    expect(place.areaServed.map((a: { name: string }) => a.name)).toEqual([
      "Queens",
      "Brooklyn",
      "Manhattan",
      "Nassau County",
      "Western Suffolk County",
    ]);
    // each area says which place it is
    for (const area of place.areaServed) {
      expect(area.sameAs).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
    }
    // and the business, by its pages elsewhere (#178)
    expect(place.sameAs).toEqual(
      Object.values(business.social).map(({ href }) => href),
    );
    expect(place.hasOfferCatalog.itemListElement).toHaveLength(8);
    // Google ignores, and may penalise, a business's own reviews marked up
    expect(place).not.toHaveProperty("aggregateRating");
    expect(place).not.toHaveProperty("review");
    // the logo and the picture it names ship with the site
    for (const url of [place.logo, place.image]) {
      expect((await page.request.get(new URL(url).pathname)).ok()).toBe(true);
    }
    expect(site).toMatchObject({
      "@type": "WebSite",
      url: business.url,
      publisher: { "@id": place["@id"] },
    });
  });

  test("read what we do and where in the heading, and the Spanish", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      business.heading,
    );
    for (const place of [
      "Brooklyn",
      "Manhattan",
      "Nassau",
      "western Suffolk",
    ]) {
      await expect(page.locator("#why-empire")).toContainText(place);
    }
    await expect(page.locator('#why-empire [lang="es"]')).toHaveText(
      "Se habla español.",
    );
    await expect(page.locator('footer [lang="es"]')).toHaveText(
      "Se habla español",
    );
    await expect(page.locator("footer")).toContainText(business.hours.display);
  });

  test("get icons for the tab, the home screen and the results", async ({
    page,
  }) => {
    await page.goto("/");

    for (const selector of [
      'link[rel="icon"][type="image/svg+xml"]',
      'link[rel="icon"][sizes="48x48"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="manifest"]',
    ]) {
      const href = await page.locator(selector).getAttribute("href");
      expect((await page.request.get(href ?? "")).ok(), selector).toBe(true);
    }
    const manifest = await (await page.request.get("/site.webmanifest")).json();
    for (const { src } of manifest.icons) {
      expect((await page.request.get(src)).ok(), src).toBe(true);
    }
  });

  test("get a 404 for an address that isn't a page", async ({ page }) => {
    const response = await page.goto("/no-such-page");

    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found | Empire Cleaning");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Request a quote" }),
    ).toHaveAttribute("href", "/#quote");
    await expect(
      page.getByRole("link", { name: `Call ${business.phone.display}` }),
    ).toHaveAttribute("href", business.phone.href);
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
    expect(sitemap).not.toContain("404");
  });
});
