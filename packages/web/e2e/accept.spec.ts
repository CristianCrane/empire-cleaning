import {
  bookJob,
  emailsTo,
  expect,
  failCharges,
  requireApproval,
  signedInAs,
  signInWithLink,
  test,
  quoteSent,
  linkIn,
  payAndBook,
  requestQuoteAsGuest,
  openTile,
  saveACard,
  pageAction,
  expectNoPageAction,
  expectNextStep,
  setClock,
} from "./harness.ts";
import type { Browser, Page } from "@playwright/test";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// the API's clock is at 4am on Monday 5 January 2026 in New York; Quotes here
// are for 9am on Monday 12 January

test(
  "the Client accepts from the Quote email in one step, and sees the Job booked",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    await quoteSent(page, olive, casey);

    const client = await (await browser.newContext()).newPage();
    const link = await linkIn(casey.email, "Your quote from Empire Cleaning");
    await client.goto(link);
    await signInWithLink(client, casey.email);
    await expect(client).toHaveURL(link);

    const { form, accept } = payAndBook(client);
    // Deep Clean is chosen to begin with, on the Quote; Casey goes for the
    // Standard Clean, and pays its Deposit under it
    const details = client.getByRole("region", { name: "Quote details" });
    await expect(
      details.getByRole("radio", { name: /Deep Clean/ }),
    ).toBeChecked();
    await details.getByText("Standard Clean", { exact: true }).click();
    await expect(form.getByText("Test payments: no card")).toBeVisible();
    // paying saves the card for the Balance, which the form says
    await expect(
      form.getByText("By paying, you agree that Empire Cleaning"),
    ).toBeVisible();
    await accept.click();

    await expect(
      client.getByText(
        "You're booked: a Standard Clean on Mon, Jan 12, 9:00 AM",
      ),
    ).toBeVisible();
    await expect(form).toBeHidden();
    expect((await emailsTo(casey.email)).map((e) => e.subject)).toContain(
      "You're booked with Empire Cleaning",
    );

    await client.getByRole("link", { name: "Home" }).first().click();
    // Home leads with it
    await expect(client.getByText("Your first clean")).toBeVisible();
    await expect(client.getByText("Mon, Jan 12, 9:00 AM")).toBeVisible();
    await expect(client.getByText(/^Standard Clean at /)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/ accepted it$/)).toBeVisible();
    await page.goto("/office/schedule?from=2026-01-12&to=2026-01-12");
    await expect(page.getByText(casey.name)).toBeVisible();
  },
);

test("a declined Deposit books nothing, and another try goes through", async ({
  page,
  browser,
}) => {
  await quoteSent(page, olive, casey);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(
    await linkIn(casey.email, "Your quote from Empire Cleaning"),
  );
  await failCharges("card_declined");

  const { form, accept } = payAndBook(client);
  await accept.click();

  await expect(
    form.getByText("Your card didn't go through, so nothing was booked"),
  ).toBeVisible();
  await expect(client.getByText("Open until", { exact: false })).toBeVisible();
  // a declined card isn't kept: the form is there for another
  await expect(form.getByText("Test payments: no card")).toBeVisible();

  await failCharges(null);
  await accept.click();
  // the page's own banner: the "You're booked" toast shows at the same time
  await expect(
    client.getByText("You're booked: a Deep Clean on Mon, Jan 12, 9:00 AM"),
  ).toBeVisible();
});

test("a Deposit the bank asks the Client to approve is booked once approved", async ({
  page,
  browser,
}) => {
  await quoteSent(page, olive, casey);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(
    await linkIn(casey.email, "Your quote from Empire Cleaning"),
  );
  const { form, accept } = payAndBook(client);

  await requireApproval("refused");
  await accept.click();
  await expect(
    form.getByText("Your bank didn't approve the payment"),
  ).toBeVisible();

  await requireApproval("approved");
  await accept.click();
  await expect(
    client.getByText("You're booked: a Deep Clean on Mon, Jan 12, 9:00 AM"),
  ).toBeVisible();
});

test("Office Staff email a link to add a card, then record the Client's acceptance", async ({
  page,
  browser,
}) => {
  await quoteSent(page, olive, casey);
  // with no card, a yes by phone can't be recorded: the alert says why,
  // and holds the way to ask for one
  const noCard = page
    .getByRole("status")
    .filter({ hasText: "Casey has no card saved" });
  await expect(noCard).toContainText("so a yes by phone can't be recorded yet");
  await expectNoPageAction(page, "Record acceptance");
  await noCard
    .getByRole("button", { name: "Email Casey a link to add a card" })
    .click();
  await expect(page.getByText(`Link sent to ${casey.email}`)).toBeVisible();

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(
    await linkIn(casey.email, "Add a card for Empire Cleaning"),
  );
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "Your card",
  );
  await expect(client.getByText("You haven't saved a card yet")).toBeVisible();
  await expect(
    client.getByText("By saving your card, you agree that Empire Cleaning"),
  ).toBeVisible();
  await saveACard(client).save.click();
  await expect(
    client.getByText("Your Test card ending 4242 is saved"),
  ).toBeVisible();

  await page.reload();
  await expect(noCard).toHaveCount(0);
  // with one, recording their yes is the next step
  await expectNextStep(page, "Record acceptance");
  await pageAction(page, "Record acceptance");
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Test card ending 4242");
  await confirm.getByRole("button", { name: "Charge and book" }).click();

  await expect(page.getByText("Accepted and booked")).toBeVisible();
  // the Service booked alone, for the time it's booked for
  const offer = page.getByRole("region", { name: "Current quote" });
  await expect(offer).toContainText("Booked for");
  await expect(offer.getByRole("heading", { level: 3 })).toHaveText([
    "Deep Clean",
  ]);
  await expectNoPageAction(page, "Record acceptance");
});

test(
  "a Client's card page folds how the card is used, and keeps what saving it agrees to in view",
  { tag: "@desktop" },
  async ({ page }) => {
    await requestQuoteAsGuest(casey);
    await signedInAs(page, casey.email);
    await page.goto("/portal/payment-method");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your card",
    );

    const howUsed = page.getByText("How your card is used");
    const about = page.getByText("We take a deposit from this card");
    await expect(about).toBeHidden();
    await howUsed.click();
    await expect(about).toBeVisible();
    await howUsed.click();
    await expect(about).toBeHidden();
    await expect(
      page.getByText("By saving your card, you agree that Empire Cleaning"),
    ).toBeVisible();
  },
);

test("Office Staff record acceptance of the offer while drafting a new Revision, which discards the Draft", async ({
  page,
  browser,
}) => {
  await quoteSent(page, olive, casey);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto("/portal/payment-method");
  // the fake's form, in the part a card goes in
  const card = saveACard(client);
  await expect(card.part).toContainText("Saving uses a test card ending 4242");
  await card.save.click();
  await expect(
    client.getByText("Your Test card ending 4242 is saved"),
  ).toBeVisible();

  await page.reload();
  const quote = page.url();
  await pageAction(page, "Change quote");
  await expect(page).toHaveURL(/\/draft$/);
  // back on the Quote, the offer can still be accepted, behind the arrow:
  // carrying on with the draft is the next step
  await page.goto(quote);
  await expect(
    page.getByText("Casey Client still sees the quote as you sent it"),
  ).toBeVisible();
  await expectNextStep(page, "Carry on with the draft");
  await pageAction(page, "Record acceptance");
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(
    "It accepts the quote you sent, and deletes your draft.",
  );
  await confirm.getByRole("button", { name: "Charge and book" }).click();

  await expect(page.getByText("Accepted and booked")).toBeVisible();
  await expect(page.getByText("Being updated")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Current quote" })
      .getByRole("heading", { level: 3 }),
  ).toHaveText(["Deep Clean"]);
});

// the Client's side, nothing to pay for: portal-quote.spec.ts
test("a Quote whose day has filled up asks the Office for another time", async ({
  page,
}) => {
  await quoteSent(page, olive, casey);
  // another booking takes all of Monday's 16 hours, from 2pm
  await bookJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 16 });

  await page.goto("/office");
  const needs = await openTile(page, "Quotes");
  await expect(needs).toContainText("Pick another time for the quote");
  await needs.getByText(casey.name).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  await expect(
    page.getByText(
      /filled up since this quote was sent, so Casey Client can't accept it\.$/,
    ),
  ).toBeVisible();
  // changing it to another time is the next step
  await expectNextStep(page, "Change quote");
  await expectNoPageAction(page, "Record acceptance");
});

// declining is asked once more, and a Client who backs out has declined
// nothing: the quote's still theirs to accept
test("a Client who backs out of declining keeps the Quote open", async ({
  page,
  browser,
}) => {
  await quoteSent(await (await browser.newContext()).newPage(), olive, casey);
  const link = await linkIn(casey.email, "Your quote from Empire Cleaning");
  await page.goto(link);
  await signInWithLink(page, casey.email);
  await expect(page).toHaveURL(link);

  await page.getByRole("button", { name: "Decline this quote" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Decline this quote?" });
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(payAndBook(page).accept).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Decline this quote" }),
  ).toBeVisible();
});

// #534: while a Client's bank asks them to approve the Deposit, nothing
// else that moves money on the Quote starts, so it's never taken twice

// Casey, a card saved, pays with one typed in that their bank wants them to
// approve, and comes back before they have: the Quote waits on them
const payingOnline = async (page: Page, browser: Browser) => {
  await quoteSent(page, olive, casey);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto("/portal/payment-method");
  await saveACard(client).save.click();
  await expect(
    client.getByText("Your Test card ending 4242 is saved"),
  ).toBeVisible();
  await client.goto(
    await linkIn(casey.email, "Your quote from Empire Cleaning"),
  );
  const { form, accept } = payAndBook(client);
  await form.getByRole("button", { name: "Use a different card" }).click();
  await requireApproval("pending");
  await accept.click();
  await expect(
    form.getByText("Your bank hasn't approved the payment yet."),
  ).toBeVisible();
  return { client, form, accept };
};

const paying =
  /^Casey Client is paying the \$[\d.]+ deposit online, for the Deep Clean, waiting on their bank to approve it\./;

test("Office Staff can't record acceptance while the Client's bank approves their Deposit", async ({
  page,
  browser,
  isMobile,
}) => {
  // opened before Casey pays, as on the phone with them
  await quoteSent(page, olive, casey);
  const quote = page.url();
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto("/portal/payment-method");
  await saveACard(client).save.click();
  await expect(
    client.getByText("Your Test card ending 4242 is saved"),
  ).toBeVisible();
  await page.goto(quote);
  await pageAction(page, "Record acceptance");
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Test card ending 4242");

  await client.goto(
    await linkIn(casey.email, "Your quote from Empire Cleaning"),
  );
  const { form, accept } = payAndBook(client);
  await form.getByRole("button", { name: "Use a different card" }).click();
  await requireApproval("pending");
  await accept.click();
  await expect(
    form.getByText("Your bank hasn't approved the payment yet."),
  ).toBeVisible();

  // refused, the dialog says why in the page's words, greyed
  await confirm.getByRole("button", { name: "Charge and book" }).click();
  await expect(confirm.getByRole("status")).toHaveText(paying);
  await expect(
    confirm.getByRole("button", { name: "Charge and book" }),
  ).toBeDisabled();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();

  // the page says until when, its next step greyed
  await expect(
    page.getByRole("status").filter({ hasText: paying }),
  ).toContainText("it's called off and you can record acceptance.");
  await expect(
    page
      .getByRole("group", { name: "What to do" })
      .getByRole("button", { name: "Record acceptance" })
      .first(),
  ).toBeDisabled();
  // on a phone, its foot says why, as the alert has scrolled away; a wider
  // screen has it in the header, by the alert
  if (isMobile)
    await expect(
      page.getByText("Not while Casey is paying the deposit"),
    ).toBeVisible();
});

test("a Client's bank approving the Deposit while Office Staff draft changes accepts the quote sent, and the draft goes", async ({
  page,
  browser,
}) => {
  const { client, accept } = await payingOnline(page, browser);
  await page.clock.install();
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: paying }),
  ).toBeVisible();
  await pageAction(page, "Change quote");
  await expect(page).toHaveURL(/\/draft$/);
  await expect(
    page.getByText("Casey Client is paying the deposit on the quote you sent."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send to Casey Client" }).first(),
  ).toBeDisabled();

  // approved in their bank's app, then pressed again: booked with it
  await requireApproval(null);
  await accept.click();
  await expect(client.getByText(/^You're booked: a Deep Clean/)).toBeVisible();

  await page.clock.runFor(15_000);
  await expect(page).not.toHaveURL(/\/draft$/);
  await expect(
    page.getByText(
      "Casey Client accepted the quote you sent, so your draft was deleted.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/ accepted it$/)).toBeVisible();
});

test("the draft of a Quote its Client is paying waits to be sent", async ({
  page,
  browser,
  isMobile,
}) => {
  await payingOnline(page, browser);
  await page.reload();
  await pageAction(page, "Change quote");
  await expect(page).toHaveURL(/\/draft$/);
  await expect(
    page.getByText("Casey Client is paying the deposit on the quote you sent."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send to Casey Client" }).first(),
  ).toBeDisabled();
  if (isMobile)
    await expect(
      page.getByText("Not while Casey is paying the deposit"),
    ).toBeVisible();
});

// past the 15 minutes, a payment their bank is finishing can't be called
// off, so the changes wait on it, as Record acceptance does (#534
// critical review C2)
test("changes wait to be sent while the Client's bank finishes their Deposit", async ({
  page,
  browser,
}) => {
  await payingOnline(page, browser);
  await page.reload();
  await pageAction(page, "Change quote");
  await expect(page).toHaveURL(/\/draft$/);
  // approved in their bank's app at 15 minutes, the bank finishing it
  await setClock("2026-01-05T09:16:00Z");
  await requireApproval("processing");
  await page.reload();

  await page
    .getByRole("button", { name: "Send to Casey Client" })
    .first()
    .click();

  await expect(
    page.getByText(
      "Casey Client's online payment is still going through with their bank, which usually takes a few minutes, so you can't send your changes yet. Nothing more was charged.",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/draft$/);
});

test("a Client back from their bank before approving the Deposit is told how it goes on", async ({
  page,
}) => {
  await quoteSent(page, olive, casey);
  await signedInAs(page, casey.email);
  await page.goto(await linkIn(casey.email, "Your quote from Empire Cleaning"));
  const { form, accept } = payAndBook(page);
  await requireApproval("pending");
  await accept.click();
  await expect(form.getByRole("status").last()).toHaveText(
    "Your bank hasn't approved the payment yet. Approve it in your bank's app to book your clean. Or press Accept and pay to start over: the first payment is called off, so you're only charged once.",
  );
});
