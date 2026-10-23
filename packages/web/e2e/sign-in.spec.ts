import AxeBuilder from "@axe-core/playwright";
import {
  createAccount,
  emailsTo,
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
const client = {
  email: "casey@example.com",
  name: "Casey Client",
  roles: ["client" as const],
};

test.describe("signing in with an emailed link", () => {
  for (const [account, area, heading] of [
    [officeStaff, "/office", "Today"],
    [cleaner, "/cleaner", "Today"],
    [client, "/portal", "Welcome, Casey"],
  ] as const) {
    test(`lands ${account.name} in their area`, async ({ page }) => {
      await createAccount(account);

      await page.goto("/");
      await expect(page).toHaveURL(/\/sign-in/);
      await signInWithLink(page, account.email);

      await expect(page).toHaveURL(area);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    });
  }

  test("returns to the page that was asked for", async ({ page }) => {
    await createAccount(client);

    await page.goto("/portal");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fportal/);
    await signInWithLink(page, client.email);

    await expect(page).toHaveURL("/portal");
  });

  test("an unknown email gets the same answer, and no email", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page
      .getByRole("textbox", { name: "Email" })
      .fill("stranger@example.com");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(page.getByText("Check your email")).toBeVisible();
    expect(await emailsTo("stranger@example.com")).toEqual([]);
  });

  test("a used link explains itself and offers a fresh one", async ({
    page,
    browser,
  }) => {
    await createAccount(client);
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
  test("Continue with Google hands over to Google", async ({ page }) => {
    // stop at Google's door: the test never talks to Google itself
    await page.route("https://accounts.google.com/**", (route) =>
      route.fulfill({ body: "Google" }),
    );
    await page.goto("/sign-in");

    await page.getByRole("button", { name: "Continue with Google" }).click();

    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
    const url = new URL(page.url());
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3100/api/auth/callback/google",
    );
  });

  test("someone trying Google before their first emailed link is told what to do", async ({
    page,
  }) => {
    await page.goto("/sign-in?error=account_not_linked");

    await expect(page.getByRole("alert")).toContainText(
      "The first time you sign in, use an emailed link",
    );
  });

  test("a Google account with no Empire Cleaning account is told so", async ({
    page,
  }) => {
    await page.goto("/sign-in?error=signup_disabled");

    await expect(page.getByRole("alert")).toContainText(
      "no Empire Cleaning account for that Google address",
    );
  });
});

test.describe("areas", () => {
  test("someone signed out can't reach any area", async ({ page }) => {
    for (const area of ["/office", "/cleaner", "/portal"]) {
      await page.goto(area);
      await expect(page).toHaveURL(/\/sign-in/);
    }
  });

  test("a wrong area sends you to your own", async ({ page }) => {
    await createAccount(client);
    await page.goto("/sign-in");
    await signInWithLink(page, client.email);

    await page.goto("/office");

    await expect(page).toHaveURL("/portal");
  });

  test("Staff with both roles switch areas without signing in again", async ({
    page,
  }) => {
    await createAccount({ ...officeStaff, roles: ["office_staff", "cleaner"] });
    await page.goto("/sign-in");
    await signInWithLink(page, officeStaff.email);
    await expect(page).toHaveURL("/office");

    await page.getByRole("button", { name: officeStaff.name }).click();
    await page.getByRole("button", { name: "Switch to Cleaner area" }).click();
    await expect(page).toHaveURL("/cleaner");

    await page.getByRole("button", { name: officeStaff.name }).click();
    await page.getByRole("button", { name: "Switch to Office" }).click();
    await expect(page).toHaveURL("/office");
    expect(await emailsTo(officeStaff.email)).toHaveLength(1);
  });

  test("signing out ends the session", async ({ page }) => {
    await createAccount(cleaner);
    await page.goto("/sign-in");
    await signInWithLink(page, cleaner.email);

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

    test("sign-in has no accessibility violations", async ({ page }) => {
      await page.goto("/sign-in?error=INVALID_TOKEN");
      await expect(page.getByRole("alert")).toBeVisible();

      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });

    test("an area has no accessibility violations", async ({ page }) => {
      await createAccount(officeStaff);
      await page.goto("/sign-in");
      await signInWithLink(page, officeStaff.email);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  });
}
