import type { Locator, Page } from "@playwright/test";
import {
  billedWeek,
  createStaff,
  emailsTo,
  expect,
  quoteSent,
  requestQuoteAsGuest,
  signUp,
  signedInAs,
  test,
} from "./harness.ts";

// The real card form: Stripe's Payment Element (src/screens/portal/
// CardForm.tsx) in the built app, under its Content-Security-Policy, against
// the API paying through the real Stripe adapter in a sandbox
// (playwright.sandbox.config.ts), with Stripe's test cards typed into its
// frames. Every other spec runs the fake payment provider, whose form takes
// no card. Nightly in CI, and by hand when CardForm.tsx, Stripe.js or the CSP
// change:
//
//   pnpm --filter @empire-cleaning/web stripe:sandbox
//
// The browser tells our API how each payment went and the API asks Stripe
// (a webhook only stands in when the browser never comes back), so no
// webhook is needed. Not checked with expectAccessible: axe can't see into
// Stripe's frames, and fails on them (docs/testing.md).

const { STRIPE_SANDBOX_SECRET_KEY = "", STRIPE_SANDBOX_PUBLISHABLE_KEY = "" } =
  process.env;
if (
  !STRIPE_SANDBOX_SECRET_KEY.startsWith("sk_test_") ||
  !STRIPE_SANDBOX_PUBLISHABLE_KEY.startsWith("pk_test_")
) {
  throw new Error(
    "a Stripe sandbox's keys are needed: STRIPE_SANDBOX_SECRET_KEY (sk_test_) and STRIPE_SANDBOX_PUBLISHABLE_KEY (pk_test_), or the server's .env (#205 adds CI's)",
  );
}

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// Stripe's test cards (docs.stripe.com/testing)
const CARD = {
  visa: "4242424242424242",
  declined: "4000000000000002",
  // its bank asks for 3D Secure on every payment
  approval: "4000002500003155",
  // its bank asks for 3D Secure, then says no whatever is pressed
  approvalFails: "4000002760003184",
};

// the Payment Element's frame, under `within`
const cardFrame = (within: Locator) =>
  within.frameLocator(
    'iframe[title="Secure payment input frame"]:not([aria-hidden="true"])',
  );

// types a card into the Payment Element under `within`
const enterCard = async (within: Locator, number: string) => {
  const frame = cardFrame(within);
  await frame.getByLabel("Card number").fill(number);
  await frame.getByLabel("Expiration date").fill("12 / 34");
  await frame.getByLabel("Security code").fill("123");
  const country = frame.getByLabel("Country");
  if (await country.isVisible()) await country.selectOption("US");
  const zip = frame.getByLabel("ZIP code");
  if (await zip.isVisible()) await zip.fill("10001");
};

// Stripe's 3D Secure test page, in a frame inside Stripe's own over our
// page, and the Client's answer there
const approveIn3DSecure = async (page: Page, answer: "Complete" | "Fail") => {
  const outer = page.locator('iframe[src*="three-ds-2-challenge"]');
  const button = outer
    .contentFrame()
    .frameLocator("#challengeFrame")
    .getByRole("button", { name: answer });
  // a press before the page's script has started does nothing, so it's
  // pressed again until Stripe takes its frame away
  await expect(async () => {
    await button.click({ timeout: 5000 });
    await expect(outer).toBeHidden({ timeout: 5000 });
  }).toPass({ timeout: 60_000 });
};

// Casey, on the Quote Olive Sent them, with its form to pay and book
const onTheQuote = async (
  page: Page,
  browser: import("@playwright/test").Browser,
) => {
  await quoteSent(page, olive, casey);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  const sent = (await emailsTo(casey.email)).find(
    (e) => e.subject === "Your quote from Empire Cleaning",
  );
  await client.goto(new URL(sent!.text.match(/https?:\/\/\S+/)![0]).pathname);
  return {
    client,
    accept: client.getByRole("region", { name: "Pay and book" }),
  };
};

const booked = "You're booked: a Deep Clean on Mon, Jan 12, 9:00 AM";

test("accepting a Quote with a card takes the Deposit and saves the card", async ({
  page,
  browser,
}) => {
  const { client, accept } = await onTheQuote(page, browser);
  await enterCard(accept, CARD.visa);
  await accept.getByRole("button", { name: /^Accept and pay \$/ }).click();
  await expect(client.getByText(booked)).toBeVisible();

  await client.goto("/portal/payment-method");
  await expect(
    client.getByText(/^Your Visa ending 4242 is saved/),
  ).toBeVisible();
  await client.goto("/portal/payments");
  await expect(
    client.getByRole("grid", { name: "Latest payments" }),
  ).toContainText("Deposit");
});

test("a card whose bank asks for 3D Secure is booked once it's approved", async ({
  page,
  browser,
}) => {
  const { client, accept } = await onTheQuote(page, browser);
  await enterCard(accept, CARD.approval);
  await accept.getByRole("button", { name: /^Accept and pay \$/ }).click();
  await approveIn3DSecure(client, "Complete");
  await expect(client.getByText(booked)).toBeVisible();
});

test("a 3D Secure check that fails books nothing, and says so", async ({
  page,
  browser,
}) => {
  const { client, accept } = await onTheQuote(page, browser);
  await enterCard(accept, CARD.approvalFails);
  await accept.getByRole("button", { name: /^Accept and pay \$/ }).click();
  await approveIn3DSecure(client, "Fail");
  // Stripe's own words for it, which the form shows as they come
  await expect(
    accept.getByText(/^We are unable to authenticate your payment method\./),
  ).toBeVisible();
  await expect(client.getByText(booked)).toBeHidden();
});

test("a declined card books nothing and takes nothing", async ({
  page,
  browser,
}) => {
  const { client, accept } = await onTheQuote(page, browser);
  await enterCard(accept, CARD.declined);
  await accept.getByRole("button", { name: /^Accept and pay \$/ }).click();
  await expect(
    accept.getByText("Your card didn't go through, so nothing was booked"),
  ).toBeVisible();

  await client.goto("/portal/payments");
  await expect(client.getByText("Nothing paid yet")).toBeVisible();
});

test("the Client saves a card as their Payment Method", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signedInAs(page, casey.email);
  await page.goto("/portal/payment-method");
  const add = page.getByRole("region", { name: "Add a card" });
  await enterCard(add, CARD.visa);
  await add.getByRole("button", { name: "Save card" }).click();
  await expect(page.getByText(/^Your Visa ending 4242 is saved/)).toBeVisible();
});

test("the Client pays a Bill on its page by card", async ({ page }) => {
  await createStaff(olive);
  await signUp(olive.email);
  const { billId } = await billedWeek({
    officeEmail: olive.email,
    payment: "on_page",
  });
  await signedInAs(page, casey.email);
  await page.goto(`/portal/bills/${billId}`);
  const pay = page.getByRole("region", { name: "Pay this bill" });
  const card = cardFrame(pay).getByRole("tab", { name: "Card" });
  if (await card.isVisible()) await card.click();
  await enterCard(pay, CARD.visa);
  await pay.getByRole("button", { name: /^Pay \$/ }).click();
  await expect(page.getByText("Thank you, your bill is paid")).toBeVisible();
});
