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
  turnDownQuote,
  draftTheQuote,
  addCleaner,
  linkIn,
  pageAction,
  expectNoPageAction,
  openTile,
  searchList,
  expectNextStep,
  expectNothingNext,
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

// a Standard Clean asked for, sent for next Monday with a Deep Clean
// recommended beside it for a first visit, open on the Office's Quote
const sentQuote = async (page: Page) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  await proposeNextMonday(page);
  await send(page);
};

// the Deep Clean recommended for a first visit: its price set behind its
// fold in the Service part
const deepCleanOverride = async (page: Page) => {
  await page.getByText("Deep Clean, also offered for a first visit").click();
  return page.getByRole("group", { name: "Deep Clean" });
};

const quoteLink = () => linkIn(casey.email, "Your quote from Empire Cleaning");

test(
  "Office Staff send a Quote, and the Client signs up from the email to see it",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    await requestQuoteAsGuest(casey);
    await signInAsOffice(page);
    await startDraft(page);

    // the Standard Clean asked for is the Draft's price; the Deep Clean
    // recommended for a first visit, offered too, an aside under it (the
    // user, on #527)
    const prices = page.getByRole("region", { name: "Quote" });
    await expect(prices.getByRole("heading", { level: 3 })).toHaveText([
      "Standard Clean",
    ]);
    await expect(
      prices.getByText(/^Also offered: Deep Clean \$[\d,.]+$/),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Deep Clean" }),
    ).toContainText("Shown to the client as recommended");
    // its price set in the Service part, behind its fold, the price itself
    // beside it
    const deep = await deepCleanOverride(page);
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
  // Send waits on a time first, saved before the override holds the
  // saves
  await proposeNextMonday(page);
  await saved(page);

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

test("a Quote waits on a proposed time to be sent, picked in a tap", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  const status = page.getByRole("status").filter({ hasText: /saved/i });
  const sendTo = page.getByRole("button", { name: `Send to ${casey.name}` });
  await expect(status).toHaveText("Saved · pick a time to send");
  await expect(sendTo).toBeDisabled();

  // it starts on the first day with room, Tuesday: Monday is within 24
  // hours of the API's 4am
  const part = page.getByRole("region", { name: "Proposed time" });
  await expect(
    part.getByRole("button", { name: "Mon, Jan 5, too soon" }),
  ).toBeDisabled();
  await expect(
    part.getByRole("button", { name: "Tue, Jan 6", exact: true }),
  ).toHaveAttribute("aria-current", "date");
  await expect(part).toContainText("Open times on Tue, Jan 6");
  // nothing before today to page back to
  await expect(
    part.getByRole("button", { name: "Previous week" }),
  ).toBeDisabled();
  await part.getByRole("button", { name: "10:00 AM", exact: true }).click();
  await expect(status).toHaveText("Saved");
  await expect(sendTo).toBeEnabled();
});

// a bar at the foot is a phone's (#493 D1): there it holds the price,
// whether it's saved and Send, Delete draft on the title row; from md Send
// is the header's next step, Delete draft behind its arrow, "Saved" beside
// it, and once scrolled the header that sticks keeps the price in view. The
// price is the one asked for, named; the Deep Clean recommended for a first
// visit is an aside, in neither (the user's word on #527's U1)
test(
  "a Draft's Send is its next step, its price kept in view as it scrolls",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    await requestQuoteAsGuest(casey);
    await signInAsOffice(page);
    await startDraft(page);
    await saved(page);
    await expectNextStep(page, `Send to ${casey.name}`);
    const next = page.getByRole("group", { name: "What to do" });
    if (isMobile) {
      await expect(next).toContainText(/^Standard Clean \$[\d,.]+Saved/);
      await expect(
        page.getByRole("button", { name: "Delete draft" }),
      ).toBeVisible();
      return;
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(
      next.getByRole("button", { name: "More actions" }),
    ).toBeVisible();
    await page
      .getByRole("region", { name: "Proposed time" })
      .scrollIntoViewIfNeeded();
    // the header that sticks: the price asked for, named, as the prices
    // beside the form aren't in view, and Saved
    await expect(
      page.getByText(/^Standard Clean \$[\d,.]+$/).filter({ visible: true }),
    ).toBeVisible();
    await saved(page);
    await pageAction(page, "Delete draft");
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Keep it" })
      .click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  },
);

// a tap on a day, then on one of its start times that has room: those with
// no crew free are left out (the user's pick B on #493), and the time picked
// fills its tile with when it ends, and folds the part to it once saved
test("Office Staff pick a Draft's proposed time from its open times", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  // both Cleaners at another home on Tuesday from 9 to 9:30
  await bookJob({ startsAt: "2026-01-13T14:00:00Z", labourHours: 1 });
  await startDraft(page);
  await proposeNextMonday(page);
  await saved(page);
  const part = page.getByRole("region", { name: "Proposed time" });
  await expect(
    part.getByRole("button", { name: "Mon, Jan 12, picked" }),
  ).toHaveAttribute("aria-current", "date");

  await part.getByRole("button", { name: "Tue, Jan 13", exact: true }).click();
  const morning = part.getByRole("group", { name: "Morning on Tue, Jan 13" });
  await expect(
    morning.getByRole("button", { name: "9:30 AM", exact: true }),
  ).toBeVisible();
  await expect(
    morning.getByRole("button", { name: "9:00 AM", exact: true }),
  ).toHaveCount(0);
  await morning.getByRole("button", { name: "10:30 AM", exact: true }).click();
  await saved(page);
  await expect(
    part.getByRole("button", { name: "Tue, Jan 13, picked" }),
  ).toBeVisible();
  await expect(
    morning.getByRole("button", { name: /^10:30\sAM\s?to \d+:\d\d\s(AM|PM)$/ }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(
    page.getByRole("button", {
      name: /^Proposed time\s*Tue, Jan 13\s·\s10:30\sAM to /,
    }),
  ).toHaveAttribute("aria-expanded", "false");
  await send(page);
  await expect(
    page.getByRole("region", { name: "Current quote" }),
  ).toContainText("Tue, Jan 13, 10:30 AM");
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
  await sentQuote(page);

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
  // closed: the server takes no new Revision of it, so none is offered
  await expectNoPageAction(page, "Change quote");
});

test(
  "the Quotes list names the Service its total is for",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    await sentQuote(page);

    await page.goto("/office/quotes");
    const row = page.getByRole("row", { name: new RegExp(casey.name) });
    // the Service asked for, not the one recommended
    await expect(row).toContainText(/Standard Clean.*\$\d/);
    await expect(row).not.toContainText("Deep Clean");
    // a phone's row says what its age is, as the Table's header does
    if (isMobile) await expect(row).toContainText("waiting since today");
    // found by the Service, as a search for another isn't
    await searchList(page, "Search quotes", "Deep");
    await expect(row).toBeHidden();
    await page
      .getByRole("searchbox", { name: "Search quotes" })
      .fill("Standard");
    await expect(row).toBeVisible();
    await page.getByRole("searchbox", { name: "Search quotes" }).fill("");
    await expect(row).toBeVisible();

    if (!isMobile) {
      // a laptop window at half width keeps the clean, its price and its
      // wait, and gives up the address first
      const columns = page.getByRole("columnheader");
      await page.setViewportSize({ width: 900, height: 720 });
      await expect(columns).toHaveText([
        "Client",
        "Service",
        "Total",
        "Waiting",
      ]);
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(columns).toHaveText([
        "Client",
        "Address",
        "Service",
        "Total",
        "Waiting",
      ]);
    }
  },
);

test("a home's History names the Service a Quote was sent for", async ({
  page,
}) => {
  await sentQuote(page);

  await page.goto("/office/clients?tab=quoting");
  await page.getByRole("row", { name: new RegExp(casey.name) }).click();
  await page
    .getByRole("grid", { name: /properties/ })
    .getByRole("row", { name: /41-12 Austin St/ })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "41-12 Austin St, 4B, 11375",
  );
  await expect(
    page
      .getByRole("list", { name: /^History/ })
      .getByRole("listitem")
      .filter({ hasText: "Quote ·" }),
  ).toContainText([/Standard Clean \$\d/]);
});

test("Office Staff draft a new Revision of a Sent Quote, which keeps the last as history", async ({
  page,
}) => {
  await sentQuote(page);
  const quote = page.url();
  // each Sent Revision is a moment in the Quote's story, the offer in full
  // on top
  const sent = page.getByText("Quote sent", { exact: true });
  const offer = page.getByRole("region", { name: "Current quote" });
  await expect(sent).toHaveText(["Quote sent"]);
  // for the Service asked for, not the Deep Clean recommended beside it,
  // and the crew it was sent with
  await expect(
    page.getByText(/^Standard Clean \$[\d,.]+\s·\s2\scleaners\s·\sfor /),
  ).toHaveCount(1);
  await expect(offer).toContainText("Sent ");
  // its own Service, the one recommended an aside under it, as the Draft
  await expect(offer.getByRole("heading", { level: 3 })).toHaveText([
    "Standard Clean",
  ]);
  await expect(
    offer.getByText(/^Also offered: Deep Clean \$[\d,.]+$/),
  ).toBeVisible();

  // Sent and waiting, with no card to record a yes by phone: nothing is
  // next, and Change quote is the page's one action
  await expect(
    page.getByText(`Casey has no card saved`, { exact: false }),
  ).toBeVisible();
  await expectNothingNext(page);
  await pageAction(page, "Change quote");
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
      `${casey.name} still sees the quote as you sent it until you send your changes.`,
      { exact: true },
    ),
  ).toBeVisible();
  // carrying on is the next step, Change quote gone from Current quote's
  // title line
  await expectNextStep(page, "Carry on with the draft");
  await expect(offer.getByRole("button", { name: "Change quote" })).toHaveCount(
    0,
  );
  await page.goto("/office/quotes");
  await expect(
    page.getByRole("row", { name: new RegExp(casey.name) }),
  ).toContainText("Being updated");

  await page.goto(quote);
  await pageAction(page, "Carry on with the draft");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Draft quote for ${casey.name}`,
  );
});

// sent again with only its crew changed, the price and time under each send
// the same: what the entry says it changed is sentAgain's, pinned in
// sent-again.test.tsx, so this reads the story as it ends, either way
test("a Quote sent again with only its cleaners changed", async ({ page }) => {
  await sentQuote(page);
  await pageAction(page, "Change quote");
  const terms = page.getByRole("region", { name: "Terms" });
  await terms.getByRole("button", { name: /^Terms/ }).click();
  await terms.getByRole("textbox", { name: "Cleaners" }).fill("3");
  await send(page);
  await expect(page.getByText("Being updated")).toBeHidden();
  // newest first, in the story, not the toast's "Quote sent to …"
  await expect(
    page
      .getByRole("list", { name: "This quote's story, newest first" })
      .getByText(/^Quote sent/),
  ).toHaveText([/^Quote sent again/, "Quote sent"]);
  await expect(
    page.getByRole("region", { name: "Current quote" }),
  ).toContainText("Sent ");
});

test("the Client sees only the latest Revision, from any of its emails", async ({
  page,
  browser,
}) => {
  await sentQuote(page);
  const link = await quoteLink();
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(link);
  await expect(
    client.getByRole("region", { name: "Quote details" }),
  ).toContainText("Deep Clean");
  await expect(client.getByText(/Updated/)).toBeHidden();

  await pageAction(page, "Change quote");
  const deep = await deepCleanOverride(page);
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
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText(casey.name).click();

  // asked for: drafting it is the next step, turning it down behind the
  // arrow
  await expectNextStep(page, "Draft the quote");
  await turnDownQuote(page);
  // the story says when and why
  const story = page.getByRole("list", { name: /This quote's story/ });
  await expect(
    story.getByRole("listitem").filter({ hasText: "Turned down" }),
  ).toContainText("Outside the area we clean");
  await expectNoPageAction(page, "Turn down");
  await expectNoPageAction(page, "Draft the quote");
  const told = (await emailsTo(casey.email)).find(
    (e) => e.subject === "About your quote from Empire Cleaning",
  );
  // the email's link shows them the same: portal-quote.spec.ts
  expect(told?.text).toContain("It's outside the area we clean");
  // closed, so off the list of open Quotes
  await page.goto("/office/quotes");
  await expect(page.getByText("No quotes yet")).toBeVisible();
});

test("a Sent Quote can't be Turned down", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText(casey.name).click();
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Turn down" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
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
  await sentQuote(page);
  await page.goto("/office");
  // nothing for Quotes needs the Office yet
  await expect(page.getByRole("button", { name: /^Quotes/ })).toBeDisabled();

  // a day before it Expires, 24 hours before the proposed time
  await setClock("2026-01-10T14:00:00Z");
  await page.reload();

  const item = (await openTile(page, "Quotes")).getByRole("row", {
    name: new RegExp(casey.name),
  });
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

// what's wrong with the time picked, over its tile, and beside Send, which
// waits only on a time it can't send
test("the draft says when the proposed time has no room for a clean", async ({
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
  const status = page.getByRole("status").filter({ hasText: /saved/i });
  const sendIt = page.getByRole("button", { name: `Send to ${casey.name}` });

  await proposeNextMonday(page);
  await expect(proposed).toContainText(
    "The client can't pick the Deep Clean at this time: that day is too full.",
  );
  // the aside says so too, unfolded; it can still be sent
  const deep = page.getByRole("region", { name: "Deep Clean" });
  await expect(deep).toContainText(
    "The client can't pick it at this time: that day is too full.",
  );
  await expect(status).toHaveText("Saved");
  await expect(sendIt).toBeEnabled();

  // the nearest time with room for both is a tap away: Tuesday, once
  // its Cleaners are back from the other home
  const fullDay = proposed
    .getByRole("status")
    .filter({ hasText: "that day is too full" });
  await expect(fullDay).toContainText(
    "Tue, Jan 13 at 9:30 AM has room for the Deep Clean too.",
  );
  await fullDay.getByRole("button", { name: "Pick that time" }).click();
  await expect(status).toHaveText("Saved");
  await expect(deep).not.toContainText("can't pick");
  await expect(proposed).not.toContainText("can't pick");

  // at 9am Tuesday has the hours, but no crew, for either: the client
  // can't accept it, though it can still be sent
  await page
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type("0900AM");
  await expect(proposed).toContainText(
    "Not enough cleaners are free then. So the client can't accept the quote: pick another time, or give a cleaner more working hours that day.",
  );
  await expect(status).toHaveText("Saved · no room on Tue, Jan 13 at 9:00 AM");
  await expect(sendIt).toBeEnabled();
  // the card says so of the clean asked for too, not of the Deep Clean
  // alone, and once for both
  await expect(
    page.getByRole("region", { name: "Standard Clean", exact: true }),
  ).toContainText(
    "The client can't pick it or the Deep Clean at this time: not enough cleaners are free then.",
  );
  await expect(deep).not.toContainText("can't pick");
  // the tiles' heading doesn't call the picked time open
  await expect(proposed).toContainText(
    "Open times on Tue, Jan 13, and the time picked",
  );
  // and paged off its week, what's wrong with it is still said
  await proposed.getByRole("button", { name: "Next week" }).click();
  await expect(
    proposed.getByRole("status").filter({ hasText: "Picked" }),
  ).toContainText("Not enough cleaners are free then.");
  await proposed.getByRole("button", { name: "Show it" }).click();

  // and at 10am, room for both
  await page
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type("10");
  await expect(status).toHaveText("Saved");
  await expect(proposed).not.toContainText("Not enough cleaners");
  await expect(deep).not.toContainText("can't pick");

  // paged off its week, the picked time is still said, and a tap away
  await proposed.getByRole("button", { name: "Next week" }).click();
  const picked = proposed.getByRole("status").filter({ hasText: "Picked" });
  await expect(picked).toContainText(
    /Picked: Tue, Jan 13, 10:00\sAM to [\d:]+\s[AP]M, which has room\./,
  );
  await picked.getByRole("button", { name: "Show it" }).click();
  await expect(picked).toBeHidden();
  await expect(
    proposed.getByRole("button", { name: /^10:00\sAM/, pressed: true }),
  ).toBeVisible();

  // from 10pm the Deep Clean, 2.5 hours on site, would run past midnight,
  // which can't be sent; the Standard Clean ends in time, so it's the Deep
  // Clean that's named, and its tile isn't marked
  await page
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type("1000PM");
  await expect(proposed).toContainText(
    "The Deep Clean would run past midnight at this time, so the quote can't be sent. Pick an earlier start time.",
  );
  await expect(deep).toContainText(
    "It would run past midnight at this time, so the quote can't be sent. Pick an earlier start time.",
  );
  await expect(status).toHaveText("Saved · pick an earlier start time");
  await expect(sendIt).toBeDisabled();

  // the nearest time the Deep Clean ends by midnight, with room for both,
  // is a tap away, as when it's short of room
  const late = proposed.getByRole("alert").filter({ hasText: "past midnight" });
  await expect(late).toContainText(
    "Tue, Jan 13 at 7:00 PM has room for the Deep Clean too.",
  );
  await late.getByRole("button", { name: "Pick that time" }).click();
  await expect(status).toHaveText("Saved");
  await expect(sendIt).toBeEnabled();
});

test("Office Staff change what a Draft is for, and what was asked stays", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signInAsOffice(page);
  await startDraft(page);
  // a Standard Clean was asked for, with a Deep Clean recommended for a
  // first visit
  await expect(page.getByRole("region", { name: "Deep Clean" })).toContainText(
    "Shown to the client as recommended",
  );

  await page.getByRole("button", { name: "Standard Clean Type" }).click();
  await page.getByRole("option", { name: "Move-in/out Clean" }).click();
  await saved(page);

  await expect(
    page.getByRole("region", { name: "Move-in/out Clean" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Deep Clean" })).toHaveCount(0);
  // as it was asked
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Move-in/out Clean Type" }),
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
  await page.getByRole("button", { name: "Standard Clean Type" }).click();
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

  await page.getByRole("button", { name: "Standard Clean Type" }).click();
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
