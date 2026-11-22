import type { Page } from "@playwright/test";
import {
  LANGUAGES,
  LEGAL_KEYS,
  legalPages,
  legalPathOf,
} from "@empire-cleaning/models";
import { apiUrl, landingUrl } from "../playwright.config.ts";
import {
  signedInAs,
  createClient,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  followSignInLink,
  signInLinkFor,
  signInWithLink,
  openAccount,
  switchArea,
  test,
  eachTheme,
} from "./harness.ts";

const officeStaff = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const cleaner = {
  email: "cory@example.com",
  name: "Cory Cleaner",
  roles: ["cleaner" as const],
};
const client = { email: "casey@example.com", name: "Casey Client" };

// hands over to Google and stands in for it, so the test never talks to
// Google; returns where Google would be asked to send the person back to
const startGoogle = async (page: Page) => {
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({ body: "Google" }),
  );
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
  return new URL(page.url());
};

test.describe("signing up and in with an emailed link", () => {
  test(
    "Office Staff land in the Office",
    { tag: "@smoke" },
    async ({ page }) => {
      await createStaff(officeStaff);

      await page.goto("/");
      await expect(page).toHaveURL(/\/sign-in/);
      await signInWithLink(page, officeStaff.email);

      await expect(page).toHaveURL("/office");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Hi, Olive",
      );
    },
  );

  test("Cleaners land in the Cleaner area", async ({ page }) => {
    await createStaff(cleaner);

    await page.goto("/sign-in");
    await signInWithLink(page, cleaner.email);

    await expect(page).toHaveURL("/cleaner");
  });

  test("Clients land in the Client portal", async ({ page }) => {
    await createClient(client);

    await page.goto("/sign-in");
    await signInWithLink(page, client.email);

    await expect(page).toHaveURL("/portal");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Hi, Casey",
    );
  });

  test(
    "a new email signs up and is welcomed, with a way to a Quote",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/sign-in");
      await signInWithLink(page, "new@example.com");

      await expect(page).toHaveURL("/welcome");
      await expect(
        page.getByText("Signed in as new@example.com"),
      ).toBeVisible();
      // a different email's way out, under Sign out, not an alert
      await expect(
        page.getByText(
          "Asked for a quote with another email? Sign out and use that one.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("status").filter({ hasText: "another email" }),
      ).toHaveCount(0);
      // what happens next is the line under the title, said once: no
      // steps beside the form, once its first step shows
      await expect(
        page.getByText(
          "Tell us what you'd like cleaned, and we'll email you a quote, usually within a working day.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Next", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("What happens next")).toHaveCount(0);

      // and can leave, to sign in with another email
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/sign-in/);
    },
  );

  test("returns to the page that was asked for", async ({ page }) => {
    await createClient(client);

    await page.goto("/portal");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fportal/);
    await signInWithLink(page, client.email);

    await expect(page).toHaveURL("/portal");
  });

  test("a used link explains itself and offers a fresh one", async ({
    page,
    browser,
  }) => {
    await page.goto("/sign-in");
    await signInWithLink(page, client.email);
    const used = await signInLinkFor(client.email);

    const elsewhere = await browser.newPage();
    await elsewhere.goto(used);
    await elsewhere.getByRole("button", { name: "Sign in" }).click();

    await expect(elsewhere).toHaveURL(/\/sign-in/);
    await expect(
      elsewhere.getByText("expired or has already been used"),
    ).toBeVisible();
    await expect(
      elsewhere.getByRole("button", { name: "Email me a sign-in link" }),
    ).toBeVisible();
  });

  // mail scanners open links before the person does (#243): some only fetch
  // the page, some load it in a browser, but none presses its button
  test("a link a mail scanner opened first still signs in", async ({
    page,
    browser,
    request,
  }) => {
    await createClient(client);
    await page.goto("/sign-in");
    await page.getByRole("textbox", { name: "Email" }).fill(client.email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    const link = await signInLinkFor(client.email);

    await request.get(link);
    const scanning = await browser.newContext();
    const scanner = await scanning.newPage();
    await scanner.goto(link);
    await expect(
      scanner.getByRole("heading", { name: "Sign in to Empire Cleaning" }),
    ).toBeVisible();
    await expectAccessible(scanner);
    await scanning.close();

    await followSignInLink(page, client.email);
    await expect(page).toHaveURL("/portal");
  });

  test("a link that didn't arrive can be sent again", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("textbox", { name: "Email" }).fill(client.email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Send it again" }).click();

    await expect(page.getByText("Another link is on its way")).toBeVisible();
    await expect
      .poll(async () => (await emailsTo(client.email)).length)
      .toBe(2);
  });

  test("asking too often says how long to wait (#32)", async ({ page }) => {
    // the server's limits are off in dev; it would answer like this
    await page.route("**/api/auth/sign-in/magic-link", (route) =>
      route.fulfill({
        status: 429,
        headers: { "retry-after": "720" },
        json: {
          message:
            "Too many tries. Please try again in 12 minutes, or call us on (646) 320-9076.",
        },
      }),
    );
    await page.goto("/sign-in");
    await page.getByRole("textbox", { name: "Email" }).fill(client.email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(
      page.getByText(
        "Too many tries. Please try again in 12 minutes, or call us on (646) 320-9076.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Email me a sign-in link" }),
    ).toBeVisible();
  });
});

test("sign-in links the landing site's policies, in the screen's language", async ({
  page,
}) => {
  for (const lang of LANGUAGES) {
    await page.goto(`/sign-in?lang=${lang}`);
    for (const key of LEGAL_KEYS) {
      await expect(
        page.getByRole("link", { name: legalPages[lang][key].name }),
      ).toHaveAttribute(
        "href",
        new URL(legalPathOf(key, lang), landingUrl).href,
      );
    }
  }
});

test.describe("Google", () => {
  test("hands over to Google, to come back to the API", async ({ page }) => {
    await page.goto("/sign-in");

    const google = await startGoogle(page);

    expect(google.searchParams.get("redirect_uri")).toBe(
      `${apiUrl}/api/auth/callback/google`,
    );
  });

  test("a sign-in that fails part-way explains itself", async ({ page }) => {
    await page.goto("/sign-in?error=internal_server_error");

    await expect(page.getByText("Signing in didn't work")).toBeVisible();
  });
});

test.describe("areas", () => {
  test("someone signed out can't reach any area", async ({ page }) => {
    for (const area of ["/office", "/cleaner", "/portal", "/welcome"]) {
      await page.goto(area);
      await expect(page).toHaveURL(/\/sign-in/);
    }
  });

  test("a wrong area sends you to your own", async ({ page }) => {
    await createClient(client);
    await signedInAs(page, client.email);

    await page.goto("/office");

    await expect(page).toHaveURL("/portal");
  });

  test("an Account connected to nothing can't reach any area", async ({
    page,
  }) => {
    await signedInAs(page, "new@example.com");

    await page.goto("/portal");

    await expect(page).toHaveURL("/welcome");
  });

  test(
    "Staff with both roles switch areas without signing in again",
    { tag: "@desktop" },
    async ({ page }) => {
      await createStaff({ ...officeStaff, roles: ["office_staff", "cleaner"] });
      await signedInAs(page, officeStaff.email);
      await expect(page).toHaveURL("/office");

      await openAccount(page, officeStaff.name);
      await switchArea(page, "Cleaner area");
      await expect(page).toHaveURL("/cleaner");

      await openAccount(page, officeStaff.name);
      await switchArea(page, "Office");
      await expect(page).toHaveURL("/office");
    },
  );

  test("someone who is both Staff and a Client switches to the portal", async ({
    page,
  }) => {
    await createStaff(cleaner);
    await createClient({ email: cleaner.email, name: cleaner.name });
    await signedInAs(page, cleaner.email);
    await expect(page).toHaveURL("/cleaner");

    await openAccount(page, cleaner.name);
    await switchArea(page, "Client portal");

    await expect(page).toHaveURL("/portal");
  });

  test("signing out ends the session", async ({ page }) => {
    await createStaff(cleaner);
    await signedInAs(page, cleaner.email);

    await openAccount(page, cleaner.name);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    await page.goto("/cleaner");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("the app is styled with the design system", async ({ page }) => {
    await page.goto("/sign-in");

    // the page background is the design system's, not the browser's default
    const background = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(background).not.toBe("rgba(0, 0, 0, 0)");
    await expect(
      page.getByRole("button", { name: "Email me a sign-in link" }),
    ).toHaveCSS("min-height", "44px");
  });

  test("an unknown address shows a way back", async ({ page }) => {
    await page.goto("/no-such-page");

    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });
});

eachTheme(() => {
  test("sign-in has no accessibility violations", async ({ page }) => {
    await page.goto("/sign-in?error=INVALID_TOKEN");
    await expect(
      page.getByText("expired or has already been used"),
    ).toBeVisible();

    await expectAccessible(page);
  });

  test("an area has no accessibility violations", async ({ page }) => {
    await createStaff(officeStaff);
    await signedInAs(page, officeStaff.email);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await expectAccessible(page);
  });
});
