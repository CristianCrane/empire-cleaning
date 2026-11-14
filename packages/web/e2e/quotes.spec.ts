import type { Page } from "@playwright/test";
import {
  bookJob,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  proposeNextMonday,
  requestQuoteAsGuest,
  saved,
  setClock,
  signedInAs,
  signInWithLink,
  test,
  draftTheQuote,
  addCleaner,
  linkIn,
  pageAction,
  expectNoPageAction,
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
    await addCleaner(name, [4, 4, 4, 4, 4, 0, 0]);
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
    `Draft quote for ${casey.name}`,
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

const quoteLink = () => linkIn(casey.email, "Your quote from Empire Cleaning");

test(
  "Office Staff send a Quote, and the Client signs up from the email to see it",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    await requestQuoteAsGuest(casey);
    await signInAsOffice(page);
    await startDraft(page);

    await expect(
      page.getByRole("region", { name: "Deep Clean" }),
    ).toContainText("Recommended");
    // its price set in the Service part, the price itself beside it
    const deep = page.getByRole("group", { name: "Deep Clean" });
    await deep.getByText("Set the Deep Clean price yourself").click();
    await deep
      .getByRole("textbox", { name: "Deep Clean price before tax" })
      .fill("250");
    await deep
      .getByRole("textbox", { name: "Why this price" })
      .fill("Regular Client's friend");
    await proposeNextMonday(page);
    await send(page);
    await expect(
      page.getByRole("region", { name: "Current quote" }),
    ).toContainText("Mon, Jan 12, 9:00 AM");
    await expect(
      page.getByRole("region", { name: "Deep Clean" }),
    ).toContainText("Set to $250.00 before tax");

    // a fresh browser, signed out: the link asks them to sign in first
    const client = await (await browser.newContext()).newPage();
    const link = await quoteLink();
    await client.goto(link);
    await expect(client).toHaveURL(/\/sign-in\?next=/);
    await signInWithLink(client, casey.email);
    await expect(client).toHaveURL(link);

    await expect(client.getByRole("heading", { level: 1 })).toHaveText(
      "Your quote",
    );
    const offer = client.getByRole("region", { name: "Quote details" });
    await expect(
      offer.getByRole("radio", { name: "Deep Clean" }),
    ).toBeChecked();
    await expect(offer).toContainText("Recommended");
    // $250 plus 8.875% tax
    await expect(offer).toContainText("$272.19");
    await expect(offer).toContainText("Mon, Jan 12, 9:00 AMYour clean");
  },
);

test("prices follow the Draft as it changes, and an override waits for its reason", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);

  const standard = page.getByRole("group", { name: "Standard Clean" });
  await standard.getByText("Set the Standard Clean price yourself").click();
  await standard
    .getByRole("textbox", { name: "Standard Clean price before tax" })
    .fill("250");
  const status = page.getByRole("status").filter({ hasText: /prices|saved/i });
  await expect(status).toHaveText(
    "Give a reason for the new price to update the prices",
  );
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();
  await expect(
    standard.getByText("Say why you're changing the suggested price"),
  ).toBeVisible();

  await standard
    .getByRole("textbox", { name: "Why this price" })
    .fill("Small flat");
  // $250 plus 8.875% tax, without saving by hand
  await expect(
    page.getByRole("region", { name: "Standard Clean" }),
  ).toContainText("$272.19");
  await expect(status).toHaveText("Saved");
});

test("a Quote can't be sent without a proposed time", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);

  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();

  await expect(page.getByText("Pick a time")).toBeVisible();
});

test("a Draft whose prices changed since it was saved shows them before it's sent", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  await proposeNextMonday(page);
  await saved(page);
  const standard = page.getByRole("region", { name: "Standard Clean" });
  const before = (await standard.textContent())!;

  // the Price List changes behind the open Draft
  const list = await (await page.request.get("/api/price-list")).json();
  const raised = await page.request.put("/api/price-list", {
    data: {
      ...list,
      conditionLight: list.conditionLight + 0.5,
      conditionModerate: list.conditionModerate + 0.5,
      conditionHeavy: list.conditionHeavy + 0.5,
    },
  });
  expect(raised.ok()).toBe(true);
  await page.getByRole("button", { name: `Send to ${casey.name}` }).click();

  await expect(
    page.getByText(
      "The prices have changed since you saved this. Check them, then send it.",
    ),
  ).toBeVisible();
  await expect(standard).not.toHaveText(before);
  await saved(page);
  await send(page);
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
  await expect(client.getByText("Your quote is ready")).toBeVisible();
  await client.getByRole("link", { name: "See your quote" }).click();

  await client.getByRole("button", { name: "Decline this quote" }).click();
  await client
    .getByRole("alertdialog")
    .getByRole("button", { name: "Decline" })
    .click();

  await expect(client.getByText("You declined this Quote")).toBeVisible();
  await expect(
    client.getByRole("button", { name: "Decline this quote" }),
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
  const sent = page.getByText("Quote sent", { exact: true });
  const offer = page.getByRole("region", { name: "Current quote" });
  await expect(sent).toHaveText(["Quote sent"]);
  await expect(offer).toContainText("Sent ");

  await page.getByRole("button", { name: "Change quote" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Draft quote for ${casey.name}`,
  );
  await expect(
    page.getByText(
      `${casey.name} still sees the quote as you sent it until you send your changes.`,
    ),
  ).toBeVisible();
  // still Sent, the offer standing while the changes are drafted
  await page.goto(quote);
  await expect(page.getByText("Being updated")).toBeVisible();
  await expect(page.getByText("Sent", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      `This draft isn't sent yet. ${casey.name} still sees the quote as you sent it until you send your changes.`,
    ),
  ).toBeVisible();
  await page.goto("/office/quotes");
  await expect(
    page.getByRole("row", { name: new RegExp(casey.name) }),
  ).toContainText("Being updated");

  await page.goto(quote);
  await page.getByRole("link", { name: "Carry on with the draft" }).click();
  await send(page);
  await expect(page.getByText("Being updated")).toBeHidden();
  await expect(sent).toHaveText(["Quote sent", "Quote sent"]);
  await expect(offer).toContainText("Sent ");
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
    client.getByRole("region", { name: "Quote details" }),
  ).toContainText("Deep Clean");
  await expect(client.getByText(/Updated/)).toBeHidden();

  await page.getByRole("button", { name: "Change quote" }).click();
  const deep = page.getByRole("group", { name: "Deep Clean" });
  await deep.getByText("Set the Deep Clean price yourself").click();
  await deep
    .getByRole("textbox", { name: "Deep Clean price before tax" })
    .fill("250");
  await deep
    .getByRole("textbox", { name: "Why this price" })
    .fill("Regular Client's friend");
  await send(page);

  // the first email's link opens the new offer, which says it's changed
  await client.goto(link);
  await expect(
    client.getByText("Updated Jan 5, 2026", { exact: false }),
  ).toBeVisible();
  // $250 plus 8.875% tax
  await expect(
    client.getByRole("region", { name: "Quote details" }),
  ).toContainText("$272.19");
  await expect(client.getByText(/Revision/)).toBeHidden();
  // Home shows the one Quote, as it stands now
  await client.goto("/portal");
  await expect(client.getByText("Your quote is ready")).toBeVisible();
  await expect(client.getByText("Deep Clean $272.19")).toBeVisible();
});

test("Office Staff Turn down a Quote asked for, and the Client is told why", async ({
  page,
  browser,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText(casey.name).click();

  await pageAction(page, "Turn down");
  const dialog = page.getByRole("alertdialog", {
    name: "Turn down this quote?",
  });
  await dialog.getByText("Outside the area we clean").click();
  await dialog.getByRole("button", { name: "Turn down" }).click();

  await expect(page.getByText("Quote turned down")).toBeVisible();
  await expect(
    page.getByText(/Turned down .*: outside the area we clean\./),
  ).toBeVisible();
  await expectNoPageAction(page, "Turn down");
  await expect(
    page.getByRole("button", { name: "Draft the quote" }),
  ).toBeHidden();
  const told = (await emailsTo(casey.email)).find(
    (e) => e.subject === "About your quote from Empire Cleaning",
  );
  expect(told?.text).toContain("It's outside the area we clean");
  // the email's link shows them the same
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(
    await linkIn(casey.email, "About your quote from Empire Cleaning"),
  );
  await expect(
    client.getByText(
      "Sorry, we can't take this one on. It's outside the area we clean.",
    ),
  ).toBeVisible();
  await expect(client.getByText("Turned down")).toBeVisible();
  // closed, so off the list of open Quotes
  await page.goto("/office/quotes");
  await expect(page.getByText("No quotes yet")).toBeVisible();
});

test("a Sent Quote can't be Turned down", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText(casey.name).click();
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Turn down" })).toBeVisible();
  await page.keyboard.press("Escape");
  await draftTheQuote(page);
  await proposeNextMonday(page);
  await send(page);

  await expectNoPageAction(page, "Turn down");
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

  // a day before it Expires, 24 hours before the proposed time
  await setClock("2026-01-10T14:00:00Z");
  await page.reload();

  const item = page
    .getByRole("grid", { name: "Needs attention" })
    .getByRole("row", { name: new RegExp(casey.name) });
  await expect(item).toContainText("Follow up before it expires");
  await expect(item).toContainText("expires Sun, Jan 11, 9:00 AM");
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
  await expectAccessible(page);

  await proposeNextMonday(page);
  await send(page);
  await page.goto(url);
  await expect(
    page.getByRole("region", { name: "Current quote" }),
  ).toBeVisible();
  await expectAccessible(page);

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(await quoteLink());
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Your quote",
  );
  await expectAccessible(client);
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
    "That day only has room for the Standard Clean. Pick another day to offer the Deep Clean too.",
  );

  // Tuesday has the hours, but no crew at 9am, for either: so no room
  await page
    .getByRole("group", { name: "Date" })
    .getByRole("spinbutton", { name: /day/i })
    .click();
  await page.keyboard.type("13");
  await expect(proposed).toContainText(
    "Not enough cleaners are free then. Pick another time, or give a cleaner more working hours that day.",
  );
  await expect(proposed).not.toContainText("has room");

  // and at 10am, room for both
  await page
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type("10");
  await expect(proposed).toContainText(
    "Tue, Jan 13 has room for either clean.",
  );
  await expect(proposed).not.toContainText("Not enough cleaners");

  // from 10pm the Deep Clean, 2.5 hours on site, would run past midnight
  await page
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type("1000PM");
  await expect(proposed).toContainText(
    "The Deep Clean would run past midnight. Pick an earlier start time to offer it too.",
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
    // a save landing while the picker is open loads it again, and redraws its
    // days: a box measured then is of a block already gone
    await saved(page);

    await page
      .getByRole("region", { name: "Proposed time" })
      .getByRole("button", { name: "Pick from the schedule" })
      .click();
    const schedule = page.getByRole("dialog", {
      name: "Pick from the schedule",
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
        name: "Mon, Jan 12, 9:00 AM, not enough cleaners free",
      }),
    ).toBeVisible();
    await expect(
      monday.getByRole("button", { name: "Mon, Jan 12, 9:30 AM", exact: true }),
    ).toBeAttached();

    await expectAccessible(page, "[role=dialog]");

    if (page.viewportSize()!.width < 768) {
      await schedule.getByRole("button", { name: "Next day" }).click();
    }
    await schedule
      .getByRole("button", { name: "Tue, Jan 13, 10:30 AM" })
      .click();
    await expect(schedule).toBeHidden();
    await expect(
      page.getByRole("region", { name: "Proposed time" }),
    ).toContainText("Tue, Jan 13 has room for");

    await send(page);
    await expect(
      page.getByRole("region", { name: "Current quote" }),
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
  await saved(page);

  await expect(
    page.getByRole("region", { name: "Move-in/out Clean" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Deep Clean" })).toHaveCount(0);
  // as it was asked
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Move-in/out Clean Service" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^What was asked/ }).click();
  await expect(
    page.getByRole("definition").filter({ hasText: /^Standard Clean$/ }),
  ).toBeVisible();
});

test("deleting a first Draft whose Service was asked for again since leaves the newer ask", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Standard Clean Service" }).click();
  await page.getByRole("option", { name: "Move-in/out Clean" }).click();
  await saved(page);
  // the Standard Clean is free again, and Casey asks for it
  await requestQuoteAsGuest(casey);

  await page.getByRole("button", { name: "Delete draft" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(
    `If ${casey.name} has asked for a Standard Clean again since`,
  );
  await dialog.getByRole("button", { name: "Delete the draft" }).click();

  await expect(page.getByText("Draft deleted")).toBeVisible();
  await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
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
  await saved(page);
  // 1.2 x 8 h, to the quarter-hour, at $60: $585 plus 8.875% tax
  await expect(page.getByRole("region", { name: "Painting" })).toContainText(
    "$636.92",
  );
});
