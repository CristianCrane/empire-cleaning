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
  listRows,
  saveACard,
  savedCardsAsk,
  pageAction,
  expectNoPageAction,
  expectNextStep,
  setClock,
  titleBadge,
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

  // the page's alert, where the payment stands, answering the press
  await expect(
    client.getByRole("alert").filter({
      hasText:
        "Your payment didn't go through. Please try again, or use another card.",
    }),
  ).toBeFocused();
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
  const { accept } = payAndBook(client);

  await requireApproval("refused");
  await accept.click();
  await expect(
    client.getByRole("status").filter({
      hasText:
        "Your payment wasn't approved, so nothing was taken. Please try again, or use another card.",
    }),
  ).toBeFocused();

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
  // the one asked for is picked, as the card leads with it; Casey said
  // the Deep Clean
  await expect(
    confirm.getByRole("radio", { name: "Standard Clean" }),
  ).toBeChecked();
  // the radio's label covers its input, so the tap lands on its name
  await confirm.getByText("Deep Clean", { exact: true }).click();
  await expect(
    confirm.getByRole("radio", { name: "Deep Clean" }),
  ).toBeChecked();
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
  ).toHaveText(["Standard Clean"]);
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
    client.getByText(/^Your bank hasn't approved your payment yet\./),
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
    client.getByText(/^Your bank hasn't approved your payment yet\./),
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
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: paying }),
  ).toBeVisible();
  await pageAction(page, "Change quote");
  await expect(page).toHaveURL(/\/draft$/);
  await expect(
    page.getByText("Casey Client is paying the deposit online."),
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
}) => {
  await payingOnline(page, browser);
  await page.reload();
  await pageAction(page, "Change quote");
  await expect(page).toHaveURL(/\/draft$/);
  await expect(
    page.getByText("Casey Client is paying the deposit online."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send to Casey Client" }).first(),
  ).toBeDisabled();
  // said beside Send at every width, as what Send waits on is, and still
  // while what's typed waits to save (review F22)
  const status = page.getByRole("status").filter({ hasText: /prices|saved/i });
  await expect(status).toHaveText(
    "Saved · send waits on Casey's deposit payment",
  );
  const standard = page.getByRole("group", { name: "Standard Clean" });
  await standard.getByText("Set the Standard Clean price yourself").click();
  await standard
    .getByRole("textbox", { name: "Standard Clean price before tax" })
    .fill("250");
  await expect(status).toHaveText(
    "Give a reason for the new price to update the prices · send waits on Casey's deposit payment",
  );
  // and it ends at rest, as Jen opens it, for its shot
  await standard.getByText("Set the Standard Clean price yourself").click();
  await expect(status).toHaveText(
    "Saved · send waits on Casey's deposit payment",
  );
});

// past the 15 minutes, a payment their bank is finishing can't be called
// off, so the changes wait on it, as Record acceptance does (#534
// critical review C2), and the page holds Send till it's done, as it did
// before the 15 minutes (UX review U8, U9)
test(
  "changes wait to be sent while the Client's bank finishes their Deposit",
  // a laptop's Send is in the header
  { tag: "@desktop" },
  async ({ page, browser }) => {
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

    // the line beside Send says it waits, where Send was pressed, and the
    // alert says on what, as the press found it, in view and read out
    await expect(
      page.getByRole("button", { name: "Send to Casey Client" }).first(),
    ).toBeDisabled();
    await expect(
      page.getByRole("status").filter({ hasText: /prices|saved/i }),
    ).toHaveText("Saved · send waits on Casey's deposit payment");
    const alert = page.getByRole("status").filter({
      hasText:
        "Casey Client's online payment is still going through with their bank, which usually takes under half an hour. If it books the quote you sent, your draft is deleted. If not, you can send your changes then.",
    });
    await expect(alert).toBeFocused();
    await expect(alert).toBeInViewport({ ratio: 1 });
    // calm, as it waits on no one (#534's UX design, Screen 5)
    await expect(alert).toHaveClass(/bg-info-subtle/);
    await expect(page).toHaveURL(/\/draft$/);
  },
);

// #534's UX design, Screen 5: Casey, a card saved, pays with one typed in,
// and their bank answers as `answers` sets: the Quote, open on Olive's
// screen, says where it stands
const paidOnline = async (
  page: Page,
  browser: Browser,
  answers: () => Promise<void>,
) => {
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
  await answers();
  await accept.click();
  return client;
};

const recordAcceptance = (page: Page) =>
  page
    .getByRole("group", { name: "What to do" })
    .getByRole("button", { name: "Record acceptance" })
    .first();

// it waits on no one, so it's calm, info, as the Office's Bill says the
// same wait, and Record acceptance waits till it's done
test("Office Staff see a Deposit the Client's bank is finishing as going through, calm, with Record acceptance waiting on it, and its badge says so on the list", async ({
  page,
  browser,
}) => {
  const client = await paidOnline(page, browser, () =>
    requireApproval("processing"),
  );
  await expect(titleBadge(client, "Payment pending")).toBeVisible();

  await page.reload();
  const alert = page
    .getByRole("status")
    .filter({ hasText: /^Casey Client's online payment/ });
  await expect(alert).toHaveText(
    /^Casey Client's online payment of the \$[\d.]+ deposit, for the Deep Clean, is still going through with their bank, which usually takes under half an hour\. If it doesn't go through, you can record acceptance then\.$/,
  );
  await expect(alert).toHaveClass(/bg-info-subtle/);
  await expect(recordAcceptance(page)).toBeDisabled();
  // the quote leads with the clean they're paying for, the one they asked
  // for an aside (#534's UX review U2)
  await expect(
    page.getByText(/^Also offered: Standard Clean \$[\d,.]+$/),
  ).toBeVisible();
  await expect(page.getByText(/^Also offered: Deep Clean/)).toHaveCount(0);

  // the Office's badge, on the quote and its list, says what Casey's does
  // while it goes through: it's on its way, and nothing of hers (#534 Q7)
  await page.goto("/office/quotes");
  const row = listRows(page, "Quotes").filter({ hasText: "Casey Client" });
  await expect(row).toContainText("Payment pending");
  await row.click();
  await expect(titleBadge(page, "Payment pending")).toBeVisible();
});

// one that took nothing says how it ended, in the Office's Bill's words for
// the same endings, while Casey can still try again, and Record acceptance
// is live again
test("Office Staff see a Deposit payment the Client's bank never approved took nothing, and can record acceptance", async ({
  page,
  browser,
}) => {
  const client = await paidOnline(page, browser, () =>
    requireApproval("refused"),
  );
  await expect(
    client.getByText(/^Your payment wasn't approved, so nothing was taken\./),
  ).toBeVisible();

  await page.reload();
  const alert = page
    .getByRole("status")
    .filter({ hasText: /^On Jan 5, Casey Client's/ });
  // what it was, as while it went through (#534's UX review U4)
  await expect(alert).toHaveText(
    /^On Jan 5, Casey Client's online payment of the \$[\d.]+ deposit, for the Deep Clean, wasn't approved, so nothing was taken\. They can try again on their quote, or you can record acceptance\.$/,
  );
  await expect(alert).toHaveClass(/bg-info-subtle/);
  // it leads with the clean they picked, and recording their yes picks it
  // too (#534's UX review U8)
  await expect(
    page.getByText(/^Also offered: Standard Clean \$[\d,.]+$/),
  ).toBeVisible();
  await recordAcceptance(page).click();
  await expect(
    page
      .getByRole("alertdialog", { name: "Record acceptance?" })
      .getByRole("radio", { name: "Deep Clean" }),
  ).toBeChecked();
});

// #534 Q7: Casey's saved card is one whose bank asks them to approve each
// payment, so Olive's charge for their yes by phone is stopped: it's
// theirs to accept on their quote, and the dialog says so, with nothing
// left to press but Close
test("Office Staff recording acceptance on a card whose bank asks the Client to approve are told it's theirs to accept", async ({
  page,
  browser,
}) => {
  await quoteSent(page, olive, casey);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto("/portal/payment-method");
  await saveACard(client).save.click();
  await expect(
    client.getByText("Your Test card ending 4242 is saved"),
  ).toBeVisible();
  await savedCardsAsk();

  await page.reload();
  await pageAction(page, "Record acceptance");
  const confirm = page.getByRole("alertdialog", { name: "Record acceptance?" });
  await confirm.getByRole("button", { name: "Charge and book" }).click();

  await expect(confirm).toContainText(
    /Casey Client's bank wants them to approve the \$[\d.]+ deposit themselves\. Nothing was charged or booked\. They can accept on their quote's page, and their bank will ask them there\./,
  );
  // its only action, beside the title row's X
  await expect(confirm.getByRole("button").filter({ hasText: /./ })).toHaveText(
    ["Close"],
  );
  await expect(emailsTo(casey.email)).resolves.not.toContainEqual(
    expect.objectContaining({ subject: "Your clean is booked" }),
  );
});

test("Office Staff see why a Client's Deposit payment didn't go through", async ({
  page,
  browser,
}) => {
  const client = await paidOnline(page, browser, () =>
    failCharges("insufficient_funds"),
  );
  await expect(
    client.getByText(/^Your payment didn't go through/),
  ).toBeVisible();
  await failCharges(null);

  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: /^On Jan 5, Casey Client's/ }),
  ).toHaveText(
    /^On Jan 5, Casey Client's online payment of the \$[\d.]+ deposit, for the Deep Clean, didn't go through \(there wasn't enough money in the account\)\. They can try again on their quote, or you can record acceptance\.$/,
  );
  await expect(recordAcceptance(page)).toBeEnabled();
  await expect(
    page.getByText(/^Also offered: Standard Clean \$[\d,.]+$/),
  ).toBeVisible();
});

test("a Client back from their bank before approving the Deposit is told how it goes on", async ({
  page,
}) => {
  await quoteSent(page, olive, casey);
  await signedInAs(page, casey.email);
  await page.goto(await linkIn(casey.email, "Your quote from Empire Cleaning"));
  const { accept } = payAndBook(page);
  await requireApproval("pending");
  await accept.click();
  // the page's alert, answering the press: its wait ends 15 minutes on,
  // 4:15 AM in New York
  const said = page
    .getByRole("status")
    .filter({ hasText: /^Your bank hasn't/ });
  await expect(said).toHaveText(
    "Your bank hasn't approved your payment yet. Approve it in your bank's app by 4:15 AM to book your Deep Clean, or press Accept and pay to start over: you're only charged once.",
  );
  await expect(said).toBeFocused();
});

// #534's UX design, Screens 1b and 1c: declining calls off a payment their
// bank still asks them to approve; once their bank is finishing it, it
// can't be, and the quote asks nothing more of them till it books
test("a Client's quote their bank is finishing the Deposit on asks nothing more, and can't be declined meanwhile", async ({
  page,
}) => {
  await quoteSent(page, olive, casey);
  await signedInAs(page, casey.email);
  await page.goto(await linkIn(casey.email, "Your quote from Empire Cleaning"));
  const { form, accept } = payAndBook(page);
  await requireApproval("pending");
  await accept.click();
  await expect(
    page.getByText(/^Your bank hasn't approved your payment yet\./),
  ).toBeVisible();

  await form.getByRole("button", { name: "Decline this quote" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(
    "The payment waiting on your bank is called off, so you won't be charged.",
  );
  // approved in their bank's app at 15 minutes, the bank finishing it
  await setClock("2026-01-05T09:16:00Z");
  await requireApproval("processing");
  await dialog.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "Your payment is still going through with your bank, so this quote can't be declined now. We'll email you as soon as your clean is booked, usually within half an hour.",
  );
  await expect(
    dialog.getByRole("button", { name: "Decline", exact: true }),
  ).toBeDisabled();

  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(titleBadge(page, "Payment pending")).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: /^We'll email you/ }),
  ).toHaveText(
    "We'll email you as soon as your clean is booked, usually within half an hour.",
  );
  await expect(form).toBeHidden();
  await expect(page.getByText("Open until", { exact: false })).toBeHidden();
  await expect(
    page
      .getByRole("region", { name: "Quote details" })
      .getByRole("radio", { name: "Deep Clean" }),
  ).toBeHidden();
});

// Casey accepts with a card their bank then finishes the Deposit on
const depositGoingThrough = async (page: Page) => {
  await quoteSent(page, olive, casey);
  await signedInAs(page, casey.email);
  await page.goto(await linkIn(casey.email, "Your quote from Empire Cleaning"));
  await requireApproval("processing");
  await payAndBook(page).accept.click();
  await expect(titleBadge(page, "Payment pending")).toBeVisible();
};

// #534's UX design, Screen 2: a Deposit their bank is finishing asks
// nothing of them, so Home says where it stands, calm, and no quote waits
// on their answer. Ends on Home, for its picture (pr:shots)
test("a Client whose Deposit is going through is told so on Home, with nothing to do", async ({
  page,
}) => {
  await depositGoingThrough(page);
  await page.goto("/portal");
  await expect(
    page.getByText("Payment pending", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Deposit for Deep Clean · Nothing you need to do."),
  ).toBeVisible();
  await expect(page.getByText("Quote ready", { exact: true })).toHaveCount(0);
  await expectNoPageAction(page, "Accept and pay");
});

// Screen 3: their home says the same, as Home does, and so does the
// quote's row on the home's page. Ends there, for its picture
test("a Client whose Deposit is going through sees it by their home and on its quote's row", async ({
  page,
}) => {
  await depositGoingThrough(page);
  await page.goto("/portal/details");
  const home = page
    .getByRole("grid", { name: "Your home" })
    .getByRole("row")
    .first();
  await expect(home).toContainText("Payment pending");
  await expect(home).toContainText("Deposit for Deep Clean");
  await home.click();
  // short of room, its button moves under the title before the street
  // breaks in two (#534's UX review U6)
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveText("41-12 Austin St");
  expect(
    await title.evaluate((h) => {
      const r = document.createRange();
      r.selectNodeContents(h);
      return new Set([...r.getClientRects()].map((b) => Math.round(b.top)))
        .size;
    }),
  ).toBe(1);
  const quotes = page.getByRole("grid", { name: "Quotes" });
  await expect(quotes.getByRole("row")).toContainText("Payment pending");
  await expect(quotes.getByText("Ready", { exact: true })).toHaveCount(0);
});

// Screen 4: Payments, where they look for their money, says it's on its
// way, not that they're all paid up. Ends there, for its picture
test("a Client whose Deposit is going through sees it pending on Payments, with nothing to do", async ({
  page,
}) => {
  await depositGoingThrough(page);
  const quote = page.url();
  await page.goto("/portal/payments");
  await expect(
    page.getByText("Payment pending", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Deposit for Deep Clean · Nothing you need to do."),
  ).toBeVisible();
  await expect(page.getByText("You're all paid up")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "See your quote" }),
  ).toHaveAttribute("href", new URL(quote).pathname);
  // its tile the one way to Your card, not a button beside it too (#534's
  // UX review U7)
  await expect(page.getByRole("link", { name: /Your card/ })).toHaveCount(1);
  // and listed, pending, as the money's left their bank (UX review U3)
  await openTile(page, "All payments");
  const rows = listRows(page, "All payments");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Deposit for Deep Clean");
  await expect(rows.first()).toContainText("Payment pending");
});

// Screen 4: a Deposit taken as their bank approved it, but given back as
// the time filled up meanwhile, is in All payments with its refund, by its
// quote, as there's no clean to list it by. Ends there, for its picture
test("a Client whose Deposit was given back as the time filled up sees it and its refund in All payments", async ({
  page,
}) => {
  await quoteSent(page, olive, casey);
  await signedInAs(page, casey.email);
  await page.goto(await linkIn(casey.email, "Your quote from Empire Cleaning"));
  const quote = new URL(page.url()).pathname;
  await requireApproval("approved");
  // another booking takes all of Monday's 16 hours while their bank asks
  await page.route("**/accept/finalize", async (route) => {
    await bookJob({ startsAt: "2026-01-12T19:00:00Z", labourHours: 16 });
    await route.fallback();
  });
  await payAndBook(page).accept.click();
  await expect(titleBadge(page, "Time unavailable")).toBeVisible();

  await page.goto("/portal/payments");
  await expect(page.getByText("You're all paid up")).toBeVisible();
  await openTile(page, "All payments");
  const rows = listRows(page, "All payments");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Refund on Deep Clean");
  await expect(rows.nth(0)).toContainText(/−\$\d/);
  await expect(rows.nth(1)).toContainText("Deposit for Deep Clean");
  await expect(rows.nth(1)).toContainText("Not booked");
  await rows.nth(1).click();
  await expect(page).toHaveURL(quote);
  await page.goBack();
  await openTile(page, "All payments");
});
