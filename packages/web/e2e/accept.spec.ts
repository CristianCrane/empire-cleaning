import type { Page } from "@playwright/test";
import {
  createStaff,
  emailsTo,
  expect,
  failCharges,
  proposeNextMonday,
  requestQuoteAsGuest,
  setUsualWeek,
  signedInAs,
  signInWithLink,
  test,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// the API's clock is at 4am on Monday 5 January 2026 in New York; Quotes here
// are for 9am on Monday 12 January

// a Cleaner free on weekdays, so the proposed day has room
const cleanerAvailable = async () => {
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
};

// the Office sends Casey a Quote, and stays on its page
const quoteSent = async (page: Page) => {
  await cleanerAvailable();
  await requestQuoteAsGuest(casey);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/requests");
  await page.getByText(casey.name).click();
  await page.getByRole("button", { name: "Draft a Quote" }).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  await proposeNextMonday(page);
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();
};

const linkIn = async (subject: string) => {
  const sent = (await emailsTo(casey.email)).find((e) => e.subject === subject);
  return new URL(sent!.text.match(/https?:\/\/\S+/)![0]).pathname;
};

test(
  "the Client accepts from the Quote email in one step, and sees the Job booked",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    await quoteSent(page);

    const client = await (await browser.newContext()).newPage();
    const link = await linkIn("Your Quote from Empire Cleaning");
    await client.goto(link);
    await signInWithLink(client, casey.email);
    await expect(client).toHaveURL(link);

    const accept = client.getByRole("region", { name: "Accept and book" });
    // Deep Clean is chosen to begin with; Casey goes for the Standard Clean
    await expect(
      accept.getByRole("radio", { name: /Deep Clean/ }),
    ).toBeChecked();
    await accept.getByText("Standard Clean", { exact: true }).click();
    await expect(accept.getByText("Test payments: no card")).toBeVisible();
    await accept.getByRole("button", { name: /^Accept and pay \$/ }).click();

    await expect(
      client.getByText("You're booked: a Standard Clean on Mon, Jan 12, 9:00 AM"),
    ).toBeVisible();
    await expect(accept).toBeHidden();
    expect((await emailsTo(casey.email)).map((e) => e.subject)).toContain(
      "You're booked with Empire Cleaning",
    );

    await client.getByRole("link", { name: "Home" }).first().click();
    const jobs = client.getByRole("grid", { name: "Your upcoming Jobs" });
    await expect(jobs).toContainText("Mon, Jan 12, 9:00 AM");
    await expect(jobs).toContainText("Standard Clean");

    await page.reload();
    await expect(
      page.getByRole("term").filter({ hasText: "Accepted" }),
    ).toBeVisible();
    await page.goto("/office/schedule?from=2026-01-12&to=2026-01-12");
    await expect(page.getByText(casey.name)).toBeVisible();
  },
);

test("a declined Deposit books nothing, and another try goes through", async ({
  page,
  browser,
}) => {
  await quoteSent(page);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await linkIn("Your Quote from Empire Cleaning"));
  await failCharges("card_declined");

  const accept = client.getByRole("region", { name: "Accept and book" });
  await accept.getByRole("button", { name: /^Accept and pay/ }).click();

  await expect(
    accept.getByText("Your card couldn't be charged, so nothing has been booked"),
  ).toBeVisible();
  await expect(
    client.getByText("This Quote is open until", { exact: false }),
  ).toBeVisible();
  // the card was kept: trying again needs no new one
  await expect(accept.getByText("Paying with your")).toContainText(
    "Test card ending 4242",
  );

  await failCharges(null);
  await accept.getByRole("button", { name: /^Accept and pay/ }).click();
  await expect(client.getByText("You're booked")).toBeVisible();
});

test("Office Staff email a link to add a card, then record the Client's acceptance", async ({
  page,
  browser,
}) => {
  await quoteSent(page);
  const record = page.getByRole("region", { name: "Record acceptance" });
  await expect(record).toContainText("hasn't saved a Payment Method yet");
  await record
    .getByRole("button", { name: "Email Casey a link to add a card" })
    .click();
  await expect(page.getByText(`Link sent to ${casey.email}`)).toBeVisible();

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await linkIn("Add a Payment Method for Empire Cleaning"));
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Payment Method",
  );
  await expect(client.getByText("You haven't saved a card yet")).toBeVisible();
  await client.getByRole("button", { name: "Save card" }).click();
  await expect(
    client.getByText("Your Test card ending 4242 is saved"),
  ).toBeVisible();

  await page.reload();
  await expect(record).toContainText("Charged to their Test card ending 4242");
  await record.getByRole("button", { name: "Record acceptance" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Charge and book" })
    .click();

  await expect(page.getByText("Accepted and booked")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Offer" }),
  ).toContainText("Deep Clean, booked");
  await expect(record).toBeHidden();
});
