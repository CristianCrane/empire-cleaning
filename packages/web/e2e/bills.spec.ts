import type { Page } from "@playwright/test";
import {
  clientPayingBill,
  paymentNotDone,
  type BillView,
} from "@empire-cleaning/models";
import {
  billedWeek,
  chaseBills,
  createStaff,
  emailsTo,
  expect,
  failCharges,
  payBillsBy,
  requestQuoteAsGuest,
  requestQuoteForPremises,
  signUp,
  signedInAs,
  test,
  linkIn,
  pageAction,
  expectNextStep,
  expectNoPageAction,
  expectNothingNext,
  expectGreyedPageActions,
  openTile,
  listRows,
  payThisBill,
  requireApproval,
  returnToTab,
  setClock,
  titleBadge,
} from "./harness.ts";

// Weekly Bills for commercial Clients (ADR-0016), in the Office and the
// portal

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// Olive, signed up, with a week billed for Casey
const billed = async (
  week: Omit<Parameters<typeof billedWeek>[0], "officeEmail"> = {},
) => {
  await createStaff(olive);
  await signUp(olive.email);
  return billedWeek({ officeEmail: olive.email, ...week });
};

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

test(
  "Office Staff switch a business to weekly Bills paid on their page, with a billing email",
  { tag: "@smoke" },
  async ({ page }) => {
    await requestQuoteForPremises(casey, "Acme Dental");
    await createStaff(olive);
    await signedInAs(page, olive.email);
    await page.goto("/office/clients?tab=quoting");
    await page.getByText("Acme Dental").click();

    const billing = page.getByRole("region", { name: "Billing" });
    await expect(billing).toContainText("Per job, when each is done");
    await billing.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Billing" });
    await dialog.getByText("Bill weekly").click();
    await dialog.getByText("On the Bill's page").click();
    await dialog.getByRole("textbox", { name: "Days to pay" }).fill("7");
    await dialog
      .getByRole("textbox", { name: "Billing email (optional)" })
      .fill("accounts@acme.example.com");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).toBeHidden();
    await expect(billing).toContainText("Weekly, from the week of Mon, Jan 5");
    await expect(billing).toContainText(
      "On each bill's page within 7 days, by card or bank",
    );
    await expect(billing).toContainText("accounts@acme.example.com");
  },
);

test("switching weekly billing off shows what it charged per Job", async ({
  page,
}) => {
  const { clientId } = await billed({ unbilled: true });
  await signedInAs(page, olive.email);
  await page.goto(`/office/clients/${clientId}`);

  const billing = page.getByRole("region", { name: "Billing" });
  await billing.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Billing" });
  await dialog.getByText("Bill weekly").click();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toContainText("We've emailed the client what we did");
  await expect(dialog).toContainText(/Deep Clean at 41-12 Austin St/);
  await expect(dialog).toContainText(/Charged \$\d/);
  expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
    "You're now charged per clean",
  );
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(billing).toContainText("Per job, when each is done");
});

test("a Client with only a home has no weekly billing to set", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/clients?tab=quoting");
  await page.getByText("Casey Client").click();
  await expect(heading(page)).toHaveText("Casey Client");
  await expect(page.getByRole("region", { name: "Billing" })).toBeHidden();
});

test(
  "Office Staff see a Client's Bills and record a payment made another way",
  { tag: "@desktop" },
  async ({ page }) => {
    const { clientId } = await billed({ payment: "on_page" });
    await signedInAs(page, olive.email);
    await page.goto(`/office/clients/${clientId}`);

    const bills = page.getByRole("grid", { name: "Casey Client's Bills" });
    await expect(bills.getByRole("row")).toHaveCount(1);
    await expect(bills).toContainText("EC-000001");
    await expect(bills).toContainText("Week of Mon, Jan 5");
    await expect(bills).toContainText("due by Mon, Jan 26");
    await expect(bills).toContainText("Due");
    await bills.getByRole("row").first().click();

    await expect(heading(page)).toHaveText("Bill EC-000001");
    // the Client pays it on its page: nothing is next for the Office
    await expect(
      page.getByRole("region", { name: "Bill details" }),
    ).toContainText("To pay by Mon, Jan 26");
    await expectNothingNext(page);
    const lines = page.getByRole("region", { name: "Bill details" });
    await expect(
      lines.getByRole("link", { name: /^Deep Clean at 41-12 Austin St/ }),
    ).toBeVisible();
    await expect(lines).toContainText("Tax included");
    await expect(lines).toContainText("Total");

    await pageAction(page, "Record a payment");
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await dialog
      .getByRole("textbox", { name: "How it was paid" })
      .fill("Cheque 1042");
    await dialog.getByRole("button", { name: "Record payment" }).click();

    await expect(dialog).toBeHidden();
    await expect(titleBadge(page, "Paid")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Bill details" }),
    ).toContainText("Cheque 1042");
    await expectNoPageAction(page, "Record a payment");
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your receipt for bill EC-000001",
    );
  },
);

test("Office Staff void a Bill that shouldn't have gone out", async ({
  page,
}) => {
  const { billId } = await billed({ payment: "on_page" });
  await signedInAs(page, olive.email);
  await page.goto(`/office/bills/${billId}`);

  await pageAction(page, "Cancel bill");
  const dialog = page.getByRole("alertdialog", {
    name: "Cancel bill EC-000001?",
  });
  // a reason is needed
  await dialog.getByRole("button", { name: "Cancel bill" }).click();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Why it's cancelled" })
    .fill("Sent before the Adjustment was agreed");
  await dialog.getByRole("button", { name: "Cancel bill" }).click();

  await expect(dialog).toBeHidden();
  await expect(titleBadge(page, "Cancelled")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Bill details" }),
  ).toContainText("Sent before the Adjustment was agreed");
  expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
    "Bill EC-000001 is cancelled",
  );
});

test(
  "the Client opens their Bill from its email and pays it on its page",
  { tag: "@smoke" },
  async ({ page }) => {
    await billed({ payment: "on_page" });
    await signedInAs(page, casey.email);

    // their Home leads with it
    const owed = page.getByRole("region", { name: "To pay" });
    await expect(owed).toContainText("Bill EC-000001 is due by Jan 26");
    await expect(
      owed.getByRole("link", { name: "Pay bill EC-000001" }),
    ).toBeVisible();
    // and so do their Payments, which lead to it
    await page.getByRole("link", { name: "Payments" }).click();
    await expect(page.getByText("To pay")).toBeVisible();
    await expect(
      page.getByText("Bill EC-000001 is due by Jan 26"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Pay Bill EC-000001" }),
    ).toBeVisible();

    await page.goto(
      await linkIn(casey.email, "Your bill EC-000001 from Empire Cleaning"),
    );
    await expect(heading(page)).toHaveText("Bill EC-000001");
    // paying it is the page's next step
    await expect(
      page.getByRole("region", { name: "Bill details" }),
    ).toContainText("To pay by Mon, Jan 26");
    await expectNextStep(page, "Pay this bill");
    // the fake's form, in the part a card goes in
    const { form, pay } = await payThisBill(page);
    await expect(form).toContainText("Test payments: no card or bank account");
    await pay.click();

    await expect(page.getByText("Thank you, your bill is paid")).toBeVisible();
    await expect(titleBadge(page, "Paid")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Bill details" }),
    ).toContainText("Paid on this page");
    await expectNoPageAction(page, "Pay this bill");

    // their Payments show it paid, and owe nothing
    await page.getByRole("link", { name: "Payments" }).first().click();
    await expect(page.getByText("Nothing owed")).toBeVisible();
    await openTile(page, "All payments");
    await expect(listRows(page, "All payments")).toContainText([
      /Bill EC-000001/,
    ]);
  },
);

// the one rule: nothing else moves its money while our Charge may still
// take it (#534, ADR-0022). Its page says so before she tries (the test
// "a Bill we try again ourselves…"), and a page opened before our Charge
// started is turned down when pressed:
// the dialog says why once the page has caught up, its button greyed and
// what she typed kept, and stops saying it once the payment is done
test("a Bill's dialog opened before its card payment started says why it can't be done once pressed", async ({
  page,
}) => {
  const { billId } = await billed({ failing: "processing" });
  await signedInAs(page, olive.email);
  // the Bill as its page loaded it before our Charge started, until it's
  // pressed; then once its payment is done, unpaid (the page also loads it
  // again when its tab is shown)
  let before = true;
  let done = false;
  await page.route(`**/api/bills/${billId}`, async (route) => {
    if (!before && !done) return route.fallback();
    const response = await route.fetch();
    const bill = (await response.json()) as BillView;
    await route.fulfill({
      response,
      json: before
        ? { ...bill, unpaid: null, canCancelOrRecord: true }
        : { ...bill, canCancelOrRecord: true },
    });
  });

  await page.goto(`/office/bills/${billId}`);
  await pageAction(page, "Record a payment");
  const record = page.getByRole("dialog", { name: "Record a payment" });
  const how = record.getByRole("textbox", { name: "How it was paid" });
  await how.fill("Cheque 1042");
  before = false;
  await record.getByRole("button", { name: "Record payment" }).click();
  // info, as it waits on us: a status, not a danger alert
  await expect(record.getByRole("status")).toHaveText(paymentNotDone.record);
  await expect(record.getByRole("alert")).toHaveCount(0);
  await expect(
    record.getByRole("button", { name: "Record payment" }),
  ).toBeDisabled();
  await expect(how).toHaveValue("Cheque 1042");
  await record.getByRole("button", { name: "Cancel" }).click();
  await expect(record).toBeHidden();

  before = true;
  await page.reload();
  await pageAction(page, "Cancel bill");
  const cancel = page.getByRole("alertdialog", {
    name: "Cancel bill EC-000001?",
  });
  await cancel
    .getByRole("textbox", { name: "Why it's cancelled" })
    .fill("Sent in error");
  before = false;
  await cancel.getByRole("button", { name: "Cancel bill" }).click();
  await expect(cancel.getByRole("status")).toHaveText(paymentNotDone.cancel);
  await expect(cancel.getByRole("alert")).toHaveCount(0);
  await expect(
    cancel.getByRole("button", { name: "Cancel bill" }),
  ).toBeDisabled();
  await expect(
    cancel.getByRole("textbox", { name: "Why it's cancelled" }),
  ).toHaveValue("Sent in error");

  // left open while the payment ends unpaid: once she's back on the tab,
  // the button is back on and nothing says it's still going through
  done = true;
  await returnToTab(page);
  await expect(
    cancel.getByRole("button", { name: "Cancel bill" }),
  ).toBeEnabled();
  await expect(cancel.getByText(paymentNotDone.cancel)).toBeHidden();
  await expect(
    cancel.getByRole("textbox", { name: "Why it's cancelled" }),
  ).toHaveValue("Sent in error");
});

test("a Bill paid from a bank account is processing until it clears", async ({
  page,
}) => {
  const { billId } = await billed({ payment: "on_page" });
  await payBillsBy("bank");
  await signedInAs(page, casey.email);
  await page.goto(`/portal/bills/${billId}`);
  await (await payThisBill(page)).pay.click();

  await expect(page.getByText("Your bank payment is on its way")).toBeVisible();
  await expect(titleBadge(page, "Clearing")).toBeVisible();
  await expectNoPageAction(page, "Pay this bill");
});

// a payment on a Bill's page that took nothing, seen in the dialog (#534):
// the dialog says why and what to do; once it's closed, the Bill's page
// says it too, before its due date, as do their Payments and the Office's
// page, so when they call, Olive sees what they saw
test("a Client's payment on a Bill's page that didn't go through says why, there, on Payments and to the Office", async ({
  page,
  browser,
}) => {
  const { billId } = await billed({ payment: "on_page" });
  await signedInAs(page, casey.email);
  await page.goto(`/portal/bills/${billId}`);
  await failCharges("insufficient_funds");
  const { form, pay } = await payThisBill(page);
  await pay.click();
  await expect(
    form.getByText(
      "Your payment didn't go through (there wasn't enough money in the account), so nothing was taken. Please try again, or use another card or bank account.",
      { exact: true },
    ),
  ).toBeVisible();
  await form.getByRole("button", { name: "Cancel" }).click();

  await expect(titleBadge(page, "Unpaid")).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText(
        /^Your payment of \$[\d.,]+ didn't go through \(there wasn't enough money in the account\)\. Please try again, or use another card or bank account\.$/,
      ),
  ).toBeVisible();
  // its due date still ahead
  await expect(
    page.getByRole("region", { name: "Bill details" }),
  ).toContainText("To pay by Mon, Jan 26");
  await expectNextStep(page, "Pay this bill");

  await page.getByRole("link", { name: "Payments" }).first().click();
  await expect(page.getByRole("main").getByRole("alert").first()).toHaveText(
    "Your payment for bill EC-000001 didn't go through (there wasn't enough money in the account).",
  );
  await expect(page.getByRole("region", { name: "To pay" })).toContainText(
    "Bill EC-000001 is due by Jan 26",
  );

  const office = await (await browser.newContext()).newPage();
  await signedInAs(office, olive.email);
  await office.goto(`/office/bills/${billId}`);
  await expect(titleBadge(office, "Unpaid")).toBeVisible();
  await expect(
    office
      .getByRole("main")
      .getByText(
        /^The client's payment of \$[\d.,]+ didn't go through on Jan 12 \(there wasn't enough money in the account\)\. They can try again on its page\.$/,
      ),
  ).toBeVisible();
  await expectNextStep(office, "Record a payment");

  // paid at the next try
  await failCharges(null);
  await page.goto(`/portal/bills/${billId}`);
  await (await payThisBill(page)).pay.click();
  await expect(titleBadge(page, "Paid")).toBeVisible();
});

// the Client's bank asking them to approve their payment (#534): refused,
// nothing was taken and the page reads as before; left waiting, both
// pages say so, the Office can't cancel or record a payment meanwhile, and
// paying again calls the first off
test("a Client's payment their bank asks them to approve: refused, left waiting, then paid at once", async ({
  page,
  browser,
}) => {
  const { billId } = await billed({ payment: "on_page" });
  await signedInAs(page, casey.email);
  await page.goto(`/portal/bills/${billId}`);

  await requireApproval("refused");
  const { form, pay } = await payThisBill(page);
  await pay.click();
  await expect(
    form.getByText(
      "The payment wasn't approved, so nothing was taken. Please try again, or use another card or bank account.",
      { exact: true },
    ),
  ).toBeVisible();
  await form.getByRole("button", { name: "Cancel" }).click();
  // never approved, nothing failed: as before they pressed Pay
  await expect(titleBadge(page, "Due")).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

  await requireApproval("pending");
  await (await payThisBill(page)).pay.click();
  await expect(page.getByText("Your payment is pending")).toBeVisible();
  await expect(titleBadge(page, "Due")).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText(
        "Your bank hasn't approved your payment yet. Approve it in your bank's app, or press Pay this bill to start over: the first payment is called off, so you're only charged once.",
        { exact: true },
      ),
  ).toBeVisible();
  await expectNextStep(page, "Pay this bill");

  const office = await (await browser.newContext()).newPage();
  await signedInAs(office, olive.email);
  await office.goto(`/office/bills/${billId}`);
  await expect(
    office
      .getByRole("main")
      .getByText(
        /^Casey Client is paying this bill online, \$[\d.,]+, waiting on their bank to approve it\. If it isn't approved by \d+:\d\d [AP]M, it's called off and you can cancel the bill or record a payment\.$/,
      ),
  ).toBeVisible();
  await expectGreyedPageActions(
    office,
    ["Record a payment", "Cancel bill"],
    clientPayingBill.item("Casey"),
  );

  await requireApproval("approved");
  await (await payThisBill(page)).pay.click();
  await expect(page.getByText("Thank you, your bill is paid")).toBeVisible();
  await expect(titleBadge(page, "Paid")).toBeVisible();
  await office.reload();
  await expect(titleBadge(office, "Paid")).toBeVisible();
});

test("only the Client can open their Bill", async ({ page }) => {
  const { billId } = await billed({ payment: "on_page" });
  // signed out, they're asked to sign in and brought back
  await page.goto(`/portal/bills/${billId}`);
  await expect(page).toHaveURL(/\/sign-in\?next=/);

  // anyone else's Bill doesn't exist for them
  await requestQuoteForPremises(
    { name: "Dana Dentist", email: "dana@example.com" },
    "Dana Dental",
  );
  await signedInAs(page, "dana@example.com");
  await page.goto(`/portal/bills/${billId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
  await expect(page.getByText("Bill EC-000001")).toBeHidden();
});

test("a Bill whose Charge failed is under Needs attention, holds the plan, and paying it lifts the hold", async ({
  page,
  browser,
}) => {
  const { billId, planId } = await billed({ plan: true, failing: true });
  await signedInAs(page, olive.email);

  const attention = await openTile(page, "Money");
  const unpaidBill = attention
    .getByRole("row")
    .filter({ hasText: "Bill EC-000001 ·" });
  await expect(unpaidBill).toContainText("Collect the bill");
  const onHold = attention
    .getByRole("row")
    .filter({ hasText: "Collect what's owed to resume the plan" });
  await expect(onHold).toContainText("bill EC-000001 unpaid");
  await unpaidBill.click();
  await expect(page).toHaveURL(`/office/bills/${billId}`);
  // and which of the client's plans it pauses, by its home
  await expect(
    page.getByText(
      /^Its payment didn't go through( \(.+\))?\. We've emailed the client to update their card\. Once they do, we try the payment again\. Until it's paid, the client's cleaning plan at 41-12 Austin St, 4B, 11375 is paused\.$/,
    ),
  ).toBeVisible();
  // recording one made another way is the Office's next step; and the
  // card it was to be charged to, never charged (#499)
  await expectNextStep(page, "Record a payment");
  await expect(
    page.getByRole("region", { name: "Bill details" }),
  ).not.toContainText("Charged to their card");

  await page.goto(`/office/service-plans/${planId}`);
  const hold = page.getByRole("status").filter({ hasText: "Paused." });
  await expect(hold).toContainText("bill EC-000001");
  await expectNextStep(page, "See bill EC-000001");

  // the Client's Payments say what the pause means under what's owed
  await failCharges(null);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto("/portal/payments");
  await expect(client.getByRole("region", { name: "To pay" })).toContainText(
    "Until it's paid, we won't book more cleans on your plan.",
  );

  // and they pay it from their plan's page
  await client.goto(`/portal/plans/${planId}`);
  await expect(
    client
      .getByRole("status")
      .filter({ hasText: "Your cleaning plan is paused" }),
  ).toContainText("bill EC-000001");
  await pageAction(client, "Pay bill EC-000001");
  // which says the plan is paused till it's paid
  await expect(
    client.getByText(
      /^We couldn't take \$[\d.,]+ for this bill.* Until it's paid, we won't book more cleans on your plan\.$/,
    ),
  ).toBeVisible();
  // it was never charged to their card, as it would have been (#499)
  const details = client.getByRole("region", { name: "Bill details" });
  await expect(details).toContainText("From your card, automatically");
  await expect(details).not.toContainText("Charged to your card");
  await expectNextStep(client, "Pay this bill");
  await (await payThisBill(client)).pay.click();
  await expect(titleBadge(client, "Paid")).toBeVisible();

  await client.goto(`/portal/plans/${planId}`);
  await expect(client.getByText("Active", { exact: true })).toBeVisible();
  // its cleans go on Bills, not charged one by one
  await expect(
    client.getByText(
      /^Each week's cleans go on one bill, made the following Monday and charged to your card\./,
    ),
  ).toBeVisible();
  await expect(client.getByText("Your cleaning plan is paused")).toBeHidden();
});

// a Bill's payment we try again ourselves waits on us: its badge and its
// alert say so alike, the Office's and the Client's (#493 PR 14), and that
// its plan is paused, the Office's naming the plan's home and why; and the
// Client is offered no second payment, as ours may still take it (#533).
// Their Payments say it calmly: the next test
test("a Bill we try again ourselves reads as payment pending, not failed, says its plan is paused, and offers no Pay", async ({
  page,
  browser,
}) => {
  const { billId } = await billed({ plan: true, failing: "processing" });

  // the Office's says what it can't do yet and why, and which plan, with
  // both greyed: nothing else moves its money while our Charge may still
  // take it (#534, ADR-0022)
  const office = await (await browser.newContext()).newPage();
  await signedInAs(office, olive.email);
  await office.goto(`/office/bills/${billId}`);
  await expect(titleBadge(office, "Payment pending")).toBeVisible();
  await expect(office.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(
    office.getByText(
      `${paymentNotDone.page} Until it's paid, the client's cleaning plan at 41-12 Austin St, 4B, 11375 is paused.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expectGreyedPageActions(
    office,
    ["Record a payment", "Cancel bill"],
    paymentNotDone.item,
  );

  await signedInAs(page, casey.email);
  await page.goto(`/portal/bills/${billId}`);
  await expect(titleBadge(page, "Payment pending")).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(
    page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: "Nothing you need to do." }),
  ).toHaveText(
    "Nothing you need to do. Until it goes through, we won't book more cleans on your plan.",
  );
  await expectNoPageAction(page, "Pay this bill");
});

// nothing to pay while it's ours, so their Payments' card asks nothing:
// not "To pay" but Payment pending, info as the Bill is, one short line,
// the Bill a link to see, not the page's primary (#493); its plan's pause
// in its fewest words, what's booked left to its Bill, the test above (#536)
test("Payments says a Bill we try again ourselves needs nothing from them", async ({
  page,
}) => {
  const { billId } = await billed({ plan: true, failing: "processing" });
  await signedInAs(page, casey.email);
  await page.goto("/portal/payments");

  const card = page.getByRole("region", { name: "Payment pending" });
  for (const line of [
    "Bill EC-000001 · Nothing you need to do.",
    "Until it goes through, we won't book more cleans on your plan.",
  ])
    await expect(card.getByText(line, { exact: true })).toBeVisible();
  await expect(card).not.toContainText("paused");
  await expect(page.getByRole("region", { name: "To pay" })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  // nothing next: the link is outlined, and no Pay anywhere on the page
  const see = card.getByRole("link", { name: "See the bill" });
  await expect(see).toHaveAttribute("href", `/portal/bills/${billId}`);
  await expect(see).toHaveClass(/(^|\s)border-primary(\s|$)/);
  await expect(see).not.toHaveClass(/(^|\s)bg-primary(\s|$)/);
  await expect(page.getByRole("link", { name: /^Pay bill/ })).toHaveCount(0);
});

test("a late Bill with no cleaning plan on it says no plan is paused, to the Client or the Office", async ({
  page,
  browser,
}) => {
  const { billId } = await billed({ payment: "on_page" });
  // the day after it was due by, after 8am New York
  await setClock("2026-01-27T14:00:00Z");
  await chaseBills();

  await signedInAs(page, casey.email);
  await page.goto(`/portal/bills/${billId}`);
  await expect(
    page.getByText("This bill wasn't paid by its due date.", {
      exact: true,
    }),
  ).toBeVisible();

  const office = await (await browser.newContext()).newPage();
  await signedInAs(office, olive.email);
  await office.goto(`/office/bills/${billId}`);
  await expect(
    office.getByText(
      "It wasn't paid by its due date. We remind the client each week until it's paid.",
      { exact: true },
    ),
  ).toBeVisible();
});

test(
  "a Bill's page prints as the Bill alone",
  { tag: "@desktop" },
  async ({ page }) => {
    const { billId } = await billed({ payment: "on_page" });
    await signedInAs(page, casey.email);
    await page.goto(`/portal/bills/${billId}`);
    await expect(heading(page)).toHaveText("Bill EC-000001");

    await page.emulateMedia({ media: "print" });
    await expect(heading(page)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Bill details" }),
    ).toBeVisible();
    // Empire Cleaning's logo heads it, and nothing around it to press
    await expect(
      page
        .getByRole("img", { name: "Empire Cleaning & Pro Services" })
        .filter({ visible: true }),
    ).toHaveCount(1);
    for (const nav of await page.getByRole("navigation").all()) {
      await expect(nav).toBeHidden();
    }
    await expect(
      page
        .getByRole("button", { name: /^(Pay this bill|Print)$/ })
        .filter({ visible: true }),
    ).toHaveCount(0);
  },
);

// a clean's receipt says where the rest of its money went: the Bill, by its
// number and where it stands, a link to it, and no "Paid" total that is
// only the Deposit (#493 PR 4's UX review, U2 and U15)
test("a weekly-billed clean's receipt names its Bill and where it stands", async ({
  page,
}) => {
  const { jobId, billId } = await billed();
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${jobId}`);

  // done, how long it was to take goes: the receipt says when it was
  await expect(page.getByRole("region", { name: "Details" })).not.toContainText(
    "How long",
  );
  const receipt = page.getByRole("region", { name: "Your receipt" });
  const bill = receipt.getByRole("link", { name: "Bill EC-000001" });
  await expect(bill.locator("..")).toHaveText("Bill EC-000001Paid");
  await expect(receipt.getByText("Paid", { exact: true })).toHaveCount(1);
  // ending on the receipt, for its picture (pr:shots)
  await expect(bill).toHaveAttribute("href", `/portal/bills/${billId}`);
});
