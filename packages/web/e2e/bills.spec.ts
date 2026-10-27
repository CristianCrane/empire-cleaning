import type { Page } from "@playwright/test";
import {
  billedWeek,
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

// the link in the latest email with this subject, as the Client follows it
const linkIn = async (to: string, subject: string) => {
  const sent = (await emailsTo(to)).findLast((e) => e.subject === subject);
  return new URL(sent!.text.match(/https?:\/\/\S+/)![0]).pathname;
};

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

// the Bill's status, beside its heading
const badge = (page: Page, status: string) =>
  heading(page).locator("..").getByText(status, { exact: true });

test(
  "Office Staff switch a business to weekly Bills paid on their page, with a billing email",
  { tag: "@smoke" },
  async ({ page }) => {
    await requestQuoteForPremises(casey, "Acme Dental");
    await createStaff(olive);
    await signedInAs(page, olive.email);
    await page.goto("/office/clients");
    await page.getByText("Acme Dental").click();

    const billing = page.getByRole("region", { name: "Billing" });
    await expect(billing).toContainText("Per Job, when each is done");
    await billing.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Billing" });
    await dialog.getByText("Bill weekly").click();
    await dialog.getByText("On the Bill's page").click();
    await dialog.getByRole("textbox", { name: "Terms, in days" }).fill("7");
    await dialog
      .getByRole("textbox", { name: "Billing email (optional)" })
      .fill("accounts@acme.example.com");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).toBeHidden();
    await expect(billing).toContainText("Weekly, from the week of Mon, Jan 5");
    await expect(billing).toContainText(
      "On each Bill's page within 7 days, by card or bank debit",
    );
    await expect(billing).toContainText("accounts@acme.example.com");
  },
);

test("a Client with only a home has no weekly billing to set", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/clients");
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
    await expect(page.getByText("Waiting for the Client to pay")).toBeVisible();
    const lines = page.getByRole("region", { name: "What it's for" });
    await expect(
      lines.getByRole("link", { name: /^Deep Clean at 41-12 Austin St/ }),
    ).toBeVisible();
    await expect(lines).toContainText("Tax included");
    await expect(lines).toContainText("Total");

    await page.getByRole("button", { name: "Record a payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await dialog
      .getByRole("textbox", { name: "How it was paid" })
      .fill("Cheque 1042");
    await dialog.getByRole("button", { name: "Record payment" }).click();

    await expect(dialog).toBeHidden();
    await expect(badge(page, "Paid")).toBeVisible();
    await expect(page.getByRole("region", { name: "Details" })).toContainText(
      "Cheque 1042",
    );
    await expect(
      page.getByRole("button", { name: "Record a payment" }),
    ).toBeHidden();
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

  await page.getByRole("button", { name: "Void" }).click();
  const dialog = page.getByRole("dialog", { name: "Void bill EC-000001?" });
  // a reason is needed
  await dialog.getByRole("button", { name: "Void" }).click();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Why it's voided" })
    .fill("Sent before the Adjustment was agreed");
  await dialog.getByRole("button", { name: "Void" }).click();

  await expect(dialog).toBeHidden();
  await expect(badge(page, "Voided")).toBeVisible();
  await expect(page.getByRole("region", { name: "Details" })).toContainText(
    "Sent before the Adjustment was agreed",
  );
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

    // on their home screen too
    const bills = page.getByRole("grid", { name: "Your Bills" });
    await expect(bills).toContainText("Bill EC-000001");
    await expect(bills).toContainText("Due");

    await page.goto(
      await linkIn(casey.email, "Your bill EC-000001 from Empire Cleaning"),
    );
    await expect(heading(page)).toHaveText("Bill EC-000001");
    await expect(
      page.getByText(/^Please pay \$[\d.,]+ by Mon, Jan 26\.$/),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Pay \$/ }).click();

    await expect(page.getByText("Thank you: your Bill is paid")).toBeVisible();
    await expect(badge(page, "Paid")).toBeVisible();
    await expect(page.getByRole("region", { name: "Details" })).toContainText(
      "Paid on this page",
    );
    await expect(
      page.getByRole("region", { name: "Pay this Bill" }),
    ).toBeHidden();
  },
);

test("a Bill paid from a bank account is processing until it clears", async ({
  page,
}) => {
  const { billId } = await billed({ payment: "on_page" });
  await payBillsBy("bank");
  await signedInAs(page, casey.email);
  await page.goto(`/portal/bills/${billId}`);
  await page.getByRole("button", { name: /^Pay \$/ }).click();

  await expect(page.getByText("Your bank payment is on its way")).toBeVisible();
  await expect(badge(page, "Processing")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Pay this Bill" }),
  ).toBeHidden();
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
  // (the router's own error screen, as for any record that isn't theirs)
  await expect(page.getByText("Something went wrong!")).toBeVisible();
  await expect(page.getByText("Bill EC-000001")).toBeHidden();
});

test("a Bill whose Charge failed is under Needs attention, holds the plan, and paying it lifts the hold", async ({
  page,
  browser,
}) => {
  const { billId, planId } = await billed({ plan: true, failing: true });
  await signedInAs(page, olive.email);

  const attention = page.getByRole("grid", { name: "Needs attention" });
  const unpaidBill = attention
    .getByRole("row")
    .filter({ hasText: "Bill EC-000001 ·" });
  await expect(unpaidBill).toContainText("Unpaid");
  const onHold = attention.getByRole("row").filter({ hasText: "On Hold" });
  await expect(onHold).toContainText("Bill EC-000001 Unpaid");
  await unpaidBill.click();
  await expect(page).toHaveURL(`/office/bills/${billId}`);
  await expect(
    page.getByText(/^Its automatic Charge failed \(card_declined\)/),
  ).toBeVisible();

  await page.goto(`/office/service-plans/${planId}`);
  const hold = page.getByRole("region", { name: "On Hold" });
  await expect(hold).toContainText("bill EC-000001");
  await expect(
    hold.getByRole("link", { name: "See bill EC-000001" }),
  ).toBeVisible();

  // the Client pays it from their plan's page
  await failCharges(null);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(`/portal/plans/${planId}`);
  await client
    .getByRole("region", { name: "On Hold" })
    .getByRole("link", { name: "Pay bill EC-000001" })
    .click();
  await expect(
    client.getByText(/^We couldn't charge \$[\d.,]+ for this Bill/),
  ).toBeVisible();
  await client.getByRole("button", { name: /^Pay \$/ }).click();
  await expect(badge(client, "Paid")).toBeVisible();

  await client.goto(`/portal/plans/${planId}`);
  await expect(client.getByText("Active", { exact: true })).toBeVisible();
  await expect(client.getByRole("region", { name: "On Hold" })).toBeHidden();
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
      page.getByRole("region", { name: "What it's for" }),
    ).toBeVisible();
    // Empire Cleaning's name heads it, and nothing around it to press
    await expect(
      page.getByText("Empire", { exact: true }).filter({ visible: true }),
    ).toHaveCount(1);
    for (const nav of await page.getByRole("navigation").all()) {
      await expect(nav).toBeHidden();
    }
    await expect(
      page.getByRole("region", { name: "Pay this Bill" }),
    ).toBeHidden();
    await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
  },
);
