import { createStaff, expect, signedInAs, test } from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const logo = { name: "Empire Cleaning & Pro Services" };

// the Office has more sections than a phone's tab bar holds: Today and the
// Schedule stay in it, the rest sit in the ☰ menu with the logo (#200)
test("on a phone the Office keeps Today and the Schedule in the tab bar, the rest in the menu", async ({
  page,
}) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");

  const bar = page.getByRole("navigation", { name: "Office" });
  await expect(bar.getByRole("link")).toHaveText(["Today", "Schedule"]);
  await expect(bar.getByRole("link", { name: "Today" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // the logo heads the menu, not Today
  await expect(page.getByRole("img", logo)).toBeHidden();

  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("img", logo)).toBeVisible();
  await expect(menu.getByRole("link")).toHaveText([
    "Jobs",
    "Quotes",
    "Clients",
    "Staff",
    "Services",
    "Price List",
  ]);
  // related sections under one heading
  await expect(
    menu.getByRole("group", { name: "Work" }).getByRole("link"),
  ).toHaveText(["Jobs", "Quotes"]);
  await expect(
    menu.getByRole("group", { name: "People" }).getByRole("link"),
  ).toHaveText(["Clients", "Staff"]);
  await expect(
    menu.getByRole("group", { name: "Pricing" }).getByRole("link"),
  ).toHaveText(["Services", "Price List"]);

  // a section goes there and closes the menu; the top bar names it
  await menu.getByRole("link", { name: "Clients" }).click();
  await expect(page).toHaveURL("/office/clients");
  await expect(menu).toBeHidden();
  await expect(page.getByRole("banner")).toContainText("Clients");
  await expect(bar.getByRole("link", { name: "Today" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByRole("button", { name: "Menu" }).click();
  await expect(menu.getByRole("link", { name: "Clients" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test(
  "on a larger screen the sidebar holds every section in groups, with the logo",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone has no sidebar");
    await createStaff(olive);
    await signedInAs(page, olive.email);
    await expect(page).toHaveURL("/office");

    const sidebar = page.getByRole("navigation", { name: "Office" });
    await expect(sidebar.getByRole("link")).toHaveText([
      "Today",
      "Schedule",
      "Jobs",
      "Quotes",
      "Clients",
      "Staff",
      "Services",
      "Price List",
    ]);
    // the busiest two first, then related sections under one heading
    await expect(sidebar.getByRole("group")).toHaveText([
      /^Work.*Jobs.*Quotes$/,
      /^People.*Clients.*Staff$/,
      /^Pricing.*Services.*Price List$/,
    ]);
    await expect(page.getByRole("img", logo)).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  },
);
