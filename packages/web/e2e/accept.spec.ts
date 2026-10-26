import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  emailsTo,
  expect,
  failCharges,
  proposeNextMonday,
  requireApproval,
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

// two Cleaners free on weekdays, so the proposed time has room for a crew of 2
const cleanerAvailable = async () => {
  for (const name of ["Cory Cleaner", "Dee Cleaner"]) {
    const member = await createStaff({
      name,
      email: `${name.split(" ")[0]!.toLowerCase()}@example.com`,
      roles: ["cleaner"],
    });
    await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
  }
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
    // paying saves the card for the Balance, which the form says
    await expect(
      accept.getByText("By paying, you authorise Empire Cleaning"),
    ).toBeVisible();
    await accept.getByRole("button", { name: /^Accept and pay \$/ }).click();

    await expect(
      client.getByText(
        "You're booked: a Standard Clean on Mon, Jan 12, 9:00 AM",
      ),
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
    accept.getByText(
      "Your card couldn't be charged, so nothing has been booked",
    ),
  ).toBeVisible();
  await expect(
    client.getByText("This Quote is open until", { exact: false }),
  ).toBeVisible();
  // a declined card isn't kept: the form is there for another
  await expect(accept.getByText("Test payments: no card")).toBeVisible();

  await failCharges(null);
  await accept.getByRole("button", { name: /^Accept and pay/ }).click();
  await expect(client.getByText("You're booked")).toBeVisible();
});

test("a Deposit the bank asks the Client to approve is booked once approved", async ({
  page,
  browser,
}) => {
  await quoteSent(page);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await linkIn("Your Quote from Empire Cleaning"));
  const accept = client.getByRole("region", { name: "Accept and book" });

  await requireApproval("refused");
  await accept.getByRole("button", { name: /^Accept and pay/ }).click();
  await expect(
    accept.getByText("Your bank didn't approve the payment"),
  ).toBeVisible();

  await requireApproval("approved");
  await accept.getByRole("button", { name: /^Accept and pay/ }).click();
  await expect(
    client.getByText("You're booked: a Deep Clean on Mon, Jan 12, 9:00 AM"),
  ).toBeVisible();
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
  await expect(
    client.getByText("By saving your card, you authorise Empire Cleaning"),
  ).toBeVisible();
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
  await expect(page.getByRole("region", { name: "Offer" })).toContainText(
    "Deep Clean, booked",
  );
  await expect(record).toBeHidden();
});

test("a Quote whose day has filled up can't be paid for, and the Office is asked for another time", async ({
  page,
  browser,
}) => {
  await quoteSent(page);
  // another booking takes all of Monday's 16 hours, from 2pm
  await bookJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 16 });

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await linkIn("Your Quote from Empire Cleaning"));
  await expect(
    client.getByText(
      "Sorry, Mon, Jan 12, 9:00 AM has been fully booked since we sent this Quote",
    ),
  ).toBeVisible();
  // nothing to pay for, but they can still say no
  await expect(
    client.getByRole("region", { name: "Accept and book" }),
  ).toHaveCount(0);
  await expect(
    client.getByRole("button", { name: "Decline this Quote" }),
  ).toBeVisible();

  await page.goto("/office");
  const needs = page.getByRole("grid", { name: "Needs attention" });
  await expect(needs).toContainText("Needs another time");
  await needs.getByText(casey.name).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  await expect(
    page.getByText(`can't accept it. Draft a new Quote with another time`),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Record acceptance" }),
  ).toHaveCount(0);
});
