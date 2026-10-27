import {
  createStaff,
  expect,
  requestQuoteAsGuest,
  signedInAs,
  test,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// an id no record has
const missing = "00000000-0000-4000-8000-000000000000";

test("a record that doesn't exist is a page not found in the Office, with a way home", async ({
  page,
}) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);

  for (const path of [
    `/office/jobs/${missing}`,
    `/office/quotes/${missing}`,
    `/office/service-plans/${missing}`,
    `/office/bills/${missing}`,
    `/office/requests/${missing}`,
    `/office/staff/${missing}`,
    `/office/clients/${missing}`,
    // a mangled link reads the same
    "/office/jobs/not-an-id",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
  }

  // still in the Office, nav and all
  await expect(page.getByRole("link", { name: "Schedule" })).toBeVisible();
  await page.getByRole("link", { name: "Go to your home page" }).click();
  await expect(page).toHaveURL("/office");
});

test("a record that doesn't exist is a page not found in the portal, with a way home", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signedInAs(page, casey.email);

  for (const path of [
    `/portal/jobs/${missing}`,
    `/portal/quotes/${missing}`,
    `/portal/plans/${missing}`,
    `/portal/bills/${missing}`,
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
  }

  await page.getByRole("link", { name: "Go to your home page" }).click();
  await expect(page).toHaveURL("/portal");
});

test("a page that fails to load says something went wrong, without details, and can be tried again", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signedInAs(page, casey.email);
  await page.goto("/portal/details");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // the server falls over
  await page.route("**/api/clients/me", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: 'relation "clients" does not exist' }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Something went wrong" }),
  ).toBeVisible();
  await expect(page.getByText("does not exist")).toBeHidden();
  await expect(page.getByRole("button", { name: "Show Error" })).toBeHidden();

  // the connection drops
  await page.unroute("**/api/clients/me");
  await page.route("**/api/clients/me", (route) => route.abort());
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Something went wrong" }),
  ).toBeVisible();

  // and comes back
  await page.unroute("**/api/clients/me");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Your details" }),
  ).toBeVisible();

  // or home instead
  await page.route("**/api/clients/me", (route) => route.abort());
  await page.reload();
  // the reload has to fail before the route is lifted, or it loads fine
  await expect(
    page.getByRole("heading", { level: 1, name: "Something went wrong" }),
  ).toBeVisible();
  await page.unroute("**/api/clients/me");
  await page.getByRole("link", { name: "Go to your home page" }).click();
  await expect(page).toHaveURL("/portal");
});
