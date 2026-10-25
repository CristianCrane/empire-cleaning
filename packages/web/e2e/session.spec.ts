import {
  createClient,
  createStaff,
  expect,
  returnToTab,
  signInWithLink,
  test,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};

// the app asks who you are when you sign in, switch areas or come back to the
// tab, not on every click; these are the times it can have changed behind its
// back (another tab, the landing page, the Office adding a record)

test("coming back to the tab notices a Client record connected meanwhile", async ({
  page,
}) => {
  await createStaff(olive);
  await page.goto("/sign-in");
  await signInWithLink(page, olive.email);
  await expect(page).toHaveURL("/office");

  // e.g. Olive asks for a Quote from the landing page, in another tab
  await createClient({ email: olive.email, name: "Olive Owner" });
  await returnToTab(page);

  await page.getByRole("button", { name: olive.name }).click();
  await page.getByRole("button", { name: "Switch to Client portal" }).click();
  await expect(page).toHaveURL("/portal");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome, Olive",
  );
});

test("switching areas notices a Client record connected meanwhile", async ({
  page,
}) => {
  await createStaff({ ...olive, roles: ["office_staff", "cleaner"] });
  await page.goto("/sign-in");
  await signInWithLink(page, olive.email);
  // the app has asked who this is, and been told: Staff, nothing more
  await expect(page).toHaveURL("/office");
  await createClient({ email: olive.email, name: "Olive Owner" });

  // the menu still offers only what it knew; entering another area looks again
  await page.getByRole("button", { name: olive.name }).click();
  await page.getByRole("button", { name: "Switch to Cleaner area" }).click();
  await expect(page).toHaveURL("/cleaner");

  await page.getByRole("button", { name: olive.name }).click();
  await expect(
    page.getByRole("button", { name: "Switch to Client portal" }),
  ).toBeVisible();
});

test("signing out in another tab signs this one out when you return", async ({
  context,
  page,
}) => {
  await createStaff(olive);
  await page.goto("/sign-in");
  await signInWithLink(page, olive.email);
  await expect(page).toHaveURL("/office");

  const other = await context.newPage();
  await other.goto("/office");
  await other.getByRole("button", { name: olive.name }).click();
  await other.getByRole("button", { name: "Sign out" }).click();
  await expect(other).toHaveURL(/\/sign-in/);

  await returnToTab(page);

  await expect(page).toHaveURL(/\/sign-in/);
});

test("moving between pages in an area doesn't ask who you are each time", async ({
  page,
}) => {
  await createStaff(olive);
  await page.goto("/sign-in");
  await signInWithLink(page, olive.email);
  await expect(page).toHaveURL("/office");
  const asked: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/me")
      asked.push(request.url());
  });
  const nav = page.getByRole("navigation", { name: "Office" });

  await nav.getByRole("link", { name: "Requests" }).click();
  await expect(page).toHaveURL("/office/requests");
  await nav.getByRole("link", { name: "Today" }).click();
  await expect(page).toHaveURL("/office");
  await nav.getByRole("link", { name: "Requests" }).click();
  await expect(page).toHaveURL("/office/requests");

  expect(asked).toEqual([]);
});
