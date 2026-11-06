import {
  createClient,
  createStaff,
  expect,
  expectAccessible,
  signedInAs,
  followSignInLink,
  test,
  eachTheme,
} from "./harness.ts";

// people from the demo the test site is seeded with (tests/seed.ts), named as
// the server's list of them names them
const jennifer = {
  email: "owner@example.com",
  name: "Jennifer",
  roles: ["office_staff" as const],
};
const maria = {
  email: "owner+maria@example.com",
  name: "Maria Gonzalez",
  roles: ["cleaner" as const],
};
const helen = {
  email: "owner+helen@example.com",
  name: "Helen Kowalski",
  phone: "(718) 555-0100",
};

test.beforeEach(async () => {
  await createStaff(jennifer);
  await createStaff(maria);
  await createClient(helen);
});

test(
  "a tour's link takes the Office to a Client's page, signed in as them",
  { tag: "@smoke" },
  async ({ page }) => {
    await signedInAs(page, jennifer.email);

    await page.goto("/people?as=helen&next=/portal");
    await expect(
      page.getByRole("heading", { name: "Who do you want to be?" }),
    ).toBeVisible();
    await expect(page.getByText("On a weekly plan")).toBeVisible();
    await expect(
      page.getByText("This signs you out as Jennifer."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Be Helen" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(page.getByText(helen.email)).toBeVisible();
    // the email lands in Gmail on the test site; not here
    await expect(
      page.getByRole("link", { name: "Open it in Gmail" }),
    ).toHaveCount(0);

    await followSignInLink(page, helen.email);
    await expect(page).toHaveURL("/portal");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Hi, Helen",
    );
  },
);

test("someone signed in as the person asked for goes straight on", async ({
  page,
}) => {
  await signedInAs(page, helen.email);

  await page.goto("/people?as=helen&next=/portal/cleans");

  await expect(page).toHaveURL("/portal/cleans");
});

test("signed out, any demo person can be picked from the list", async ({
  page,
}) => {
  await page.goto("/people");
  await expect(
    page.getByRole("heading", { name: "Pick a person" }),
  ).toBeVisible();
  await page.getByRole("row", { name: /Maria Gonzalez/ }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await followSignInLink(page, maria.email);
  await expect(page).toHaveURL("/cleaner");
});

test("who's signed in can't be picked again", async ({ page }) => {
  await signedInAs(page, maria.email);

  await page.goto("/people");

  await expect(
    page.getByRole("row", { name: /Maria Gonzalez \(you\)/ }),
  ).toBeDisabled();
});

test("anyone else signs in by their email, back to the page asked for", async ({
  page,
}) => {
  await page.goto("/people?next=/portal");
  await page.getByRole("textbox", { name: "Email" }).fill(helen.email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await followSignInLink(page, helen.email);
  await expect(page).toHaveURL("/portal");
});

eachTheme(() => {
  test("the people page has no accessibility violations", async ({ page }) => {
    await signedInAs(page, jennifer.email);
    await page.goto("/people?as=helen");
    await expect(page.getByRole("button", { name: "Be Helen" })).toBeVisible();

    await expectAccessible(page);
  });
});

test("the real site has no people page", async ({ page }) => {
  // the e2e server is dev; stand in for the real site's answer
  await page.route("**/api/demo-people", (route) =>
    route.fulfill({ status: 404, json: { message: "Not found" } }),
  );

  await page.goto("/people");

  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});

test("the test site's banner says who's signed in, a way to be someone else", async ({
  page,
}) => {
  await page.route("**/api/site", (route) =>
    route.fulfill({ json: { mode: "test" } }),
  );
  await signedInAs(page, jennifer.email);

  await page.goto("/office");
  await page.getByRole("link", { name: "You're Jennifer" }).click();

  await expect(page).toHaveURL("/people");
});
