import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { apiUrl } from "../playwright.config.ts";
import {
  signedInAs,
  createClient,
  createStaff,
  expect,
  signInLinkFor,
  signInWithLink,
  test,
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
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today");
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
        page.getByText("signed in as new@example.com"),
      ).toBeVisible();
      await expect(
        page.getByText("Asked us for a Quote with a different email?"),
      ).toBeVisible();
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

    await expect(elsewhere).toHaveURL(/\/sign-in/);
    await expect(elsewhere.getByRole("alert")).toContainText(
      "expired or has already been used",
    );
    await expect(
      elsewhere.getByRole("button", { name: "Email me a sign-in link" }),
    ).toBeVisible();
    await elsewhere.close();
  });
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

    await expect(page.getByRole("alert")).toContainText(
      "Signing in didn't work",
    );
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

      await page.getByRole("button", { name: officeStaff.name }).click();
      await page.getByRole("row", { name: "Switch to Cleaner area" }).click();
      await expect(page).toHaveURL("/cleaner");

      await page.getByRole("button", { name: officeStaff.name }).click();
      await page.getByRole("row", { name: "Switch to Office" }).click();
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

    await page.getByRole("button", { name: cleaner.name }).click();
    await page.getByRole("row", { name: "Switch to Client portal" }).click();

    await expect(page).toHaveURL("/portal");
  });

  test("signing out ends the session", async ({ page }) => {
    await createStaff(cleaner);
    await signedInAs(page, cleaner.email);

    await page.getByRole("button", { name: cleaner.name }).click();
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

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    // dark is something a person chooses, remembered on their device
    test.beforeEach(async ({ page }) => {
      if (theme === "dark") {
        await page.addInitScript(() =>
          localStorage.setItem("ec-theme", "dark"),
        );
      }
    });

    test(
      "sign-in has no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await page.goto("/sign-in?error=INVALID_TOKEN");
        await expect(page.getByRole("alert")).toBeVisible();

        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      },
    );

    test(
      "an area has no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await createStaff(officeStaff);
        await signedInAs(page, officeStaff.email);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      },
    );

    test(
      "the welcome page has no accessibility violations",
      { tag: theme === "light" ? "@desktop" : [] },
      async ({ page }) => {
        await signedInAs(page, "new@example.com");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      },
    );
  });
}
