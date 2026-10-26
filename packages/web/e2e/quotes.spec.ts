import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  emailsTo,
  expect,
  proposeNextMonday,
  requestQuoteAsGuest,
  setClock,
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

// the API's clock is at 4am on Monday 5 January 2026 in New York

// with a Cleaner free on weekdays, so the days Quotes propose have room
const signInAsOffice = async (page: Page) => {
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");
};

// from the Office's Quote Request screen to a new Draft
const startDraft = async (page: Page) => {
  await page.goto("/office/requests");
  await page.getByText(casey.name).click();
  await page.getByRole("button", { name: "Draft a Quote" }).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Quote for ${casey.name}`,
  );
};

const send = async (page: Page) => {
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();
  await expect(page.getByText("Sent", { exact: true }).first()).toBeVisible();
};

const quoteLink = async () => {
  const sent = (await emailsTo(casey.email)).find(
    (e) => e.subject === "Your Quote from Empire Cleaning",
  );
  return new URL(sent!.text.match(/https?:\/\/\S+/)![0]).pathname;
};

test(
  "Office Staff send a Quote, and the Client signs up from the email to see it",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    await requestQuoteAsGuest(casey);
    await signInAsOffice(page);
    await startDraft(page);

    const deep = page.getByRole("region", { name: "Deep Clean" });
    await expect(deep).toContainText("Recommended");
    await deep.getByText("Override the Deep Clean price").click();
    await deep
      .getByRole("textbox", { name: "Deep Clean price before tax" })
      .fill("250");
    await deep
      .getByRole("textbox", { name: "Reason for the override" })
      .fill("Regular Client's friend");
    await proposeNextMonday(page);
    await send(page);
    await expect(page.getByRole("region", { name: "Offer" })).toContainText(
      "Mon, Jan 12, 9:00 AM",
    );
    await expect(
      page.getByRole("region", { name: "Deep Clean" }),
    ).toContainText("Overridden to $250.00 before tax");

    // a fresh browser, signed out: the link asks them to sign in first
    const client = await (await browser.newContext()).newPage();
    const link = await quoteLink();
    await client.goto(link);
    await expect(client).toHaveURL(/\/sign-in\?next=/);
    await signInWithLink(client, casey.email);
    await expect(client).toHaveURL(link);

    await expect(client.getByRole("heading", { level: 1 })).toHaveText(
      "Your Quote",
    );
    const offer = client.getByRole("region", { name: "Deep Clean" });
    await expect(offer).toContainText("Recommended");
    // $250 plus 8.875% tax
    await expect(offer).toContainText("$272.19");
    await expect(
      client.getByText("Proposed for Mon, Jan 12, 9:00 AM"),
    ).toBeVisible();
  },
);

test("prices follow the Draft as it changes, and an override waits for its reason", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);

  const standard = page.getByRole("region", { name: "Standard Clean" });
  await standard.getByText("Override the Standard Clean price").click();
  await standard
    .getByRole("textbox", { name: "Standard Clean price before tax" })
    .fill("250");
  const status = page.getByRole("status").filter({ hasText: /prices|saved/ });
  await expect(status).toHaveText(
    "Give a reason for the override to update the prices",
  );
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(
    standard.getByText("Say why you're changing the Suggested Price"),
  ).toBeVisible();

  await standard
    .getByRole("textbox", { name: "Reason for the override" })
    .fill("Small flat");
  // $250 plus 8.875% tax, without saving by hand
  await expect(standard).toContainText("$272.19");
  await expect(status).toHaveText("All changes saved");
});

test("a Quote can't be sent without a proposed time", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);

  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();

  await expect(page.getByText("Choose a proposed time")).toBeVisible();
});

test("the Client Declines a Quote from the portal", async ({
  page,
  browser,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  await proposeNextMonday(page);
  await send(page);

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  const quotes = client.getByRole("grid", { name: "Your Quotes" });
  await expect(quotes).toContainText("Sent");
  await quotes.getByRole("row").first().click();

  await client.getByRole("button", { name: "Decline this Quote" }).click();
  await client
    .getByRole("alertdialog")
    .getByRole("button", { name: "Decline" })
    .click();

  await expect(client.getByText("You declined this Quote")).toBeVisible();
  await expect(
    client.getByRole("button", { name: "Decline this Quote" }),
  ).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("term").filter({ hasText: "Declined" }),
  ).toBeVisible();
});

test("a Quote about to Expire needs attention", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  await proposeNextMonday(page);
  await send(page);
  await page.goto("/office");
  await expect(
    page.getByRole("grid", { name: "Needs attention" }),
  ).not.toContainText(casey.name);

  // a day before the proposed time, when it Expires
  await setClock("2026-01-11T14:00:00Z");
  await page.reload();

  const item = page
    .getByRole("grid", { name: "Needs attention" })
    .getByRole("row", { name: new RegExp(casey.name) });
  await expect(item).toContainText("Quote expiring");
  await expect(item).toContainText("expires Mon, Jan 12, 9:00 AM");
  await item.click();
  await expect(page).toHaveURL(/\/office\/quotes\//);
});

test("Quote screens pass automated accessibility checks", async ({
  page,
  browser,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  // the screens themselves: arriving by a click leaves react-aria announcing
  // something from the page before
  const url = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  let { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await proposeNextMonday(page);
  await send(page);
  await page.goto(url);
  await expect(
    page.getByRole("term").filter({ hasText: "Sent" }),
  ).toBeVisible();
  ({ violations } = await new AxeBuilder({ page }).analyze());
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await quoteLink());
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Your Quote",
  );
  ({ violations } = await new AxeBuilder({ page: client }).analyze());
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("the draft says whether the proposed day has room for each clean", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  // Cory's 8 hours on Monday, half of them already booked: room for the
  // Standard Clean (3.25 h) but not the Deep Clean (5 h)
  await bookJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 4 });
  await startDraft(page);
  const proposed = page.getByRole("region", { name: "Proposed time" });

  await proposeNextMonday(page);
  await expect(proposed).toContainText(
    "Mon, Jan 12 has 4 h of Cleaner time free: room for the Standard Clean (3.25 h), but not the Deep Clean (5 h)",
  );

  // Tuesday is clear
  await page
    .getByRole("group", { name: "Date" })
    .getByRole("spinbutton", { name: /day/i })
    .click();
  await page.keyboard.type("13");
  await expect(proposed).toContainText(
    "Tue, Jan 13 has 8 h of Cleaner time free: room for either clean.",
  );
});
