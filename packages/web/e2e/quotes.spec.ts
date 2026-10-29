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
  draftTheQuote,
} from "./harness.ts";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// the API's clock is at 4am on Monday 5 January 2026 in New York

// with two Cleaners free for 4 hours on weekdays, so the days Quotes propose
// have 8 hours, and a crew of 2
const signInAsOffice = async (page: Page) => {
  for (const name of ["Cory Cleaner", "Dee Cleaner"]) {
    const member = await createStaff({
      name,
      email: `${name.split(" ")[0]!.toLowerCase()}@example.com`,
      roles: ["cleaner"],
    });
    await setUsualWeek(member.id, [4, 4, 4, 4, 4, 0, 0]);
  }
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await expect(page).toHaveURL("/office");
};

// from the Office's Requested Quote to a new Draft
const startDraft = async (page: Page) => {
  await page.goto("/office/quotes");
  await page.getByText(casey.name).click();
  await draftTheQuote(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Revision 1 for ${casey.name}`,
  );
};

// sends the Draft open on the page, which returns to the Quote (an earlier
// send's toast may still be showing, so it waits for the page too)
const send = async (page: Page) => {
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(page.getByText(`Quote sent to ${casey.email}`)).toBeVisible();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
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
    await expect(
      page.getByRole("region", { name: "Current Quote" }),
    ).toContainText("Mon, Jan 12, 9:00 AM");
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
  await expect(page.getByText(/ declined it$/)).toBeVisible();
});

test("Office Staff draft a new Revision of a Sent Quote, which keeps the last as history", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  await proposeNextMonday(page);
  await send(page);
  const quote = page.url();
  // each Sent Revision is a moment in the Quote's story, the offer in full
  // on top
  const sent = page.getByText(/^Revision \d+ sent$/);
  const offer = page.getByRole("region", { name: "Current Quote" });
  await expect(sent).toHaveText(["Revision 1 sent"]);
  await expect(offer).toContainText("Revision 1, sent");

  await page.getByRole("button", { name: "Draft a new Revision" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Revision 2 for ${casey.name}`,
  );
  await expect(
    page.getByText(
      `${casey.name} still sees Revision 1 until you send this one.`,
    ),
  ).toBeVisible();
  // still Sent, the offer standing while the changes are drafted
  await page.goto(quote);
  await expect(page.getByText("Draft changes")).toBeVisible();
  await expect(page.getByText("Sent", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      `Revision 2 is a Draft, not sent yet. ${casey.name} still sees Revision 1 until you send it.`,
    ),
  ).toBeVisible();
  await page.goto("/office/quotes");
  await expect(
    page.getByRole("row", { name: new RegExp(casey.name) }),
  ).toContainText("Draft changes");

  await page.goto(quote);
  await page.getByRole("link", { name: "Continue the Draft" }).click();
  await send(page);
  await expect(page.getByText("Draft changes")).toBeHidden();
  await expect(sent).toHaveText(["Revision 2 sent", "Revision 1 sent"]);
  await expect(offer).toContainText("Revision 2, sent");
});

test("the Client sees only the latest Revision, from any of its emails", async ({
  page,
  browser,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  await proposeNextMonday(page);
  await send(page);
  const link = await quoteLink();
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(link);
  await expect(
    client.getByRole("region", { name: "Deep Clean" }),
  ).toBeVisible();
  await expect(client.getByText(/Updated/)).toBeHidden();

  await page.getByRole("button", { name: "Draft a new Revision" }).click();
  const deep = page.getByRole("region", { name: "Deep Clean" });
  await deep.getByText("Override the Deep Clean price").click();
  await deep
    .getByRole("textbox", { name: "Deep Clean price before tax" })
    .fill("250");
  await deep
    .getByRole("textbox", { name: "Reason for the override" })
    .fill("Regular Client's friend");
  await send(page);

  // the first email's link opens the new offer, which says it's changed
  await client.goto(link);
  await expect(
    client.getByText("41-12 Austin St, 4B, 11375 · Updated Jan 5, 2026"),
  ).toBeVisible();
  // $250 plus 8.875% tax
  await expect(
    client.getByRole("region", { name: "Deep Clean" }),
  ).toContainText("$272.19");
  await expect(client.getByText(/Revision/)).toBeHidden();
  await client.goto("/portal");
  await expect(
    client.getByRole("grid", { name: "Your Quotes" }).getByRole("row"),
  ).toHaveCount(1);
});

test("Office Staff Turn Down a Quote asked for, and the Client is told why", async ({
  page,
  browser,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText(casey.name).click();

  await page.getByRole("button", { name: "Turn Down" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Turn Down this Quote?",
  });
  await dialog.getByText("Outside the area we clean").click();
  await dialog.getByRole("button", { name: "Turn Down" }).click();

  await expect(page.getByText("Quote Turned Down")).toBeVisible();
  await expect(
    page.getByText(/Turned Down .*: outside the area we clean\./),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn Down" })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Draft the Quote" }),
  ).toBeHidden();
  const told = (await emailsTo(casey.email)).find(
    (e) => e.subject === "About your Quote from Empire Cleaning",
  );
  expect(told?.text).toContain("it's outside the area we clean");
  // the email's link shows them the same
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(new URL(told!.text.match(/https?:\/\/\S+/)![0]).pathname);
  await expect(
    client.getByText(
      "We're sorry, but we can't quote for this home: it's outside the area we clean.",
    ),
  ).toBeVisible();
  await expect(client.getByText("Turned Down")).toBeVisible();
  // closed, so off the list of open Quotes
  await page.goto("/office/quotes");
  await expect(page.getByText("No open Quotes.")).toBeVisible();
});

test("a Sent Quote can't be Turned Down", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText(casey.name).click();
  await expect(page.getByRole("button", { name: "Turn Down" })).toBeVisible();
  await draftTheQuote(page);
  await proposeNextMonday(page);
  await send(page);

  await expect(page.getByRole("button", { name: "Turn Down" })).toBeHidden();
});

test("old Requests links lead to Quotes", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText(casey.name).click();
  const id = new URL(page.url()).pathname.split("/").at(-1);

  await page.goto("/office/requests");
  await expect(page).toHaveURL("/office/quotes");
  await page.goto(`/office/requests/${id}`);
  await expect(page).toHaveURL(`/office/quotes/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Quote for ${casey.name}`,
  );
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
  await expect(item).toContainText("Follow up before it expires");
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
    page.getByRole("region", { name: "Current Quote" }),
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
  // Monday's 8 hours, half of them already booked from 2pm: room for the
  // Standard Clean (3.25 h) but not the Deep Clean (5 h)
  await bookJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 4 });
  // and on Tuesday, both Cleaners at another home from 9 to 9:30
  await bookJob({ startsAt: "2026-01-13T14:00:00Z", labourHours: 1 });
  await startDraft(page);
  const proposed = page.getByRole("region", { name: "Proposed time" });

  await proposeNextMonday(page);
  await expect(proposed).toContainText(
    "Mon, Jan 12 has 4 h of Cleaner time free: room for the Standard Clean (3.25 h), but not the Deep Clean (5 h)",
  );

  // Tuesday has the hours, but no crew at 9am
  await page
    .getByRole("group", { name: "Date" })
    .getByRole("spinbutton", { name: /day/i })
    .click();
  await page.keyboard.type("13");
  await expect(proposed).toContainText(
    "Tue, Jan 13 has 7 h of Cleaner time free: room for either clean.",
  );
  await expect(proposed).toContainText(
    "Not enough Cleaners are free at 9:00 AM: a crew of 2 is needed, and 0 of the 2 available that day are. The Client couldn't accept this Quote: choose another time, or give a Cleaner hours that day.",
  );
});

test(
  "Office Staff pick a Quote's start from the Schedule, seeing what's booked",
  { tag: ["@desktop"] },
  async ({ page }) => {
    await requestQuoteAsGuest(casey);
    await signInAsOffice(page);
    // most of Monday booked: an hour from 9am, four from 2pm, each with both
    // Cleaners
    await bookJob({ startsAt: "2026-01-12T14:00:00Z", labourHours: 1 });
    await bookJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 4 });
    await startDraft(page);
    await proposeNextMonday(page);

    await page
      .getByRole("region", { name: "Proposed time" })
      .getByRole("button", { name: "Pick from the Schedule" })
      .click();
    const schedule = page.getByRole("dialog", {
      name: "Pick from the Schedule",
    });
    // the week around the chosen day on a desktop, the day itself on a phone
    const monday = schedule.getByRole("region", {
      name: "Mon, Jan 12",
      exact: true,
    });
    await expect(monday).toContainText("5 h booked · 3 h free");
    await expect(monday).toContainText("Starts");
    await expect(monday).toContainText("9:00 AM This clean");
    await expect(
      schedule.getByRole("group", { name: "Jobs on Mon, Jan 12" }),
    ).toContainText("2:00 PM");
    // another crew's Job at the proposed time: the new clean sits beside it
    const ninesJob = (await schedule
      .getByRole("group", { name: "Jobs on Mon, Jan 12" })
      .getByText(/^9:00 AM Client/)
      .boundingBox())!;
    const thisClean = (await monday
      .getByText("9:00 AM This clean")
      .boundingBox())!;
    expect(
      thisClean.x >= ninesJob.x + ninesJob.width ||
        ninesJob.x >= thisClean.x + thisClean.width,
    ).toBe(true);
    // nobody is free for it at 9, while that Job is on: marked, though it
    // can still be picked; free again from 9:30
    await expect(
      monday.getByRole("button", {
        name: "Mon, Jan 12, 9:00 AM, no crew free",
      }),
    ).toBeVisible();
    await expect(
      monday.getByRole("button", { name: "Mon, Jan 12, 9:30 AM", exact: true }),
    ).toBeAttached();

    const { violations } = await new AxeBuilder({ page })
      .include("[role=dialog]")
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    if (page.viewportSize()!.width < 768) {
      await schedule.getByRole("button", { name: "Next day" }).click();
    }
    await schedule
      .getByRole("button", { name: "Tue, Jan 13, 10:30 AM" })
      .click();
    await expect(schedule).toBeHidden();
    await expect(
      page.getByRole("region", { name: "Proposed time" }),
    ).toContainText("Tue, Jan 13 has 8 h of Cleaner time free");

    await send(page);
    await expect(
      page.getByRole("region", { name: "Current Quote" }),
    ).toContainText("Tue, Jan 13, 10:30 AM");
  },
);

test("Office Staff change what a Draft is for, and what was asked stays", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  // a Standard Clean was asked for, with a Deep Clean recommended for a
  // first visit
  await expect(page.getByRole("region", { name: "Deep Clean" })).toContainText(
    "Recommended",
  );

  await page.getByRole("button", { name: "Standard Clean Service" }).click();
  await page.getByRole("option", { name: "Move-in/out Clean" }).click();
  const status = page.getByRole("status").filter({ hasText: /prices|saved/ });
  await expect(status).toHaveText("All changes saved");

  await expect(
    page.getByRole("region", { name: "Move-in/out Clean" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Deep Clean" })).toHaveCount(0);
  // as it was asked
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Move-in/out Clean Service" }),
  ).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: /^Standard Clean$/ }),
  ).toBeVisible();
});

test("a Draft for a Service priced by area is priced on the area Office Staff type", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);

  await page.getByRole("button", { name: "Standard Clean Service" }).click();
  await page.getByRole("option", { name: "Painting" }).click();
  const area = page.getByRole("textbox", { name: "Area in sq ft" });
  await expect(area).toBeVisible();
  await expect(
    page.getByText("None recorded yet: enter one to price it."),
  ).toBeVisible();

  await area.fill("1200");
  await area.blur();
  const status = page.getByRole("status").filter({ hasText: /prices|saved/ });
  await expect(status).toHaveText("All changes saved");
  // 1.2 x 8 h, to the quarter-hour, at $60: $585 plus 8.875% tax
  await expect(page.getByRole("region", { name: "Painting" })).toContainText(
    "$636.92",
  );
});
