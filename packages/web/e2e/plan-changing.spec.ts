import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  completedFirstClean,
  createStaff,
  emailsTo,
  expect,
  sentServicePlanQuote,
  signedInAs,
  signUp,
  startedServicePlan,
  test,
} from "./harness.ts";

// Casey's First Clean is done at 11am on Monday 12 January 2026, New York
// time, with their card saved, and the API's clock is left there. Their plan
// is a Standard Clean every week from 9am on Monday the 19th, with a $50.46
// Deposit, its Jobs booked up to 9 February.
const FIRST = "2026-01-19T14:00:00Z";
// the new terms: every 2 weeks from 9am on Wednesday the 28th
const NEW_START = "2026-01-28T14:00:00Z";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// Casey's plan, its acceptance recorded by Olive
const planStarted = async () => {
  await createStaff(olive);
  await signUp(olive.email);
  const { propertyId } = await completedFirstClean(olive.email);
  const plan = await startedServicePlan({
    officeEmail: olive.email,
    propertyId,
    startsAt: FIRST,
  });
  return { ...plan, propertyId };
};

// within: only part of the page, e.g. an open dialog (which hides the rest,
// main landmark and heading included, from assistive technology)
const expectAccessible = async (page: Page, within?: string) => {
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const axe = new AxeBuilder({ page });
  const { violations } = await (within ? axe.include(within) : axe).analyze();
  expect(violations).toEqual([]);
};

test(
  "the Office offers new terms for a plan, and the Client accepts them in the portal",
  { tag: ["@smoke", "@desktop"] },
  async ({ page, browser }) => {
    const { planId, propertyId } = await planStarted();
    await signedInAs(page, olive.email);
    await page.goto(`/office/service-plans/${planId}`);

    await page.getByRole("button", { name: "Change terms" }).click();
    await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
    await expect(
      page.getByText("This changes Casey Client's", { exact: false }),
    ).toBeVisible();

    // sent with new terms, as the Draft editor's own tests do
    const quote = await sentServicePlanQuote({
      officeEmail: olive.email,
      propertyId,
      startsAt: NEW_START,
      recurrence: "fortnightly",
    });

    const client = await (await browser.newContext()).newPage();
    await signedInAs(client, casey.email);
    await client.goto(`/portal/quotes/${quote.id}`);
    await expect(
      client.getByText("Your new terms start Wed, Jan 28, 9:00 AM"),
    ).toBeVisible();
    const change = client.getByText("This changes your Service Plan");
    await expect(change).toBeVisible();
    await expect(
      client.getByText(
        "The cleans you have booked from then on are cancelled, at no charge: Mon, Feb 2, 9:00 AM; Mon, Feb 9, 9:00 AM.",
      ),
    ).toBeVisible();
    await expect(
      client.getByText(
        "Your $50.46 Deposit stays as it is, so nothing is charged now.",
      ),
    ).toBeVisible();
    await expectAccessible(client);

    const accept = client.getByRole("region", { name: "Accept the new terms" });
    await accept.getByRole("button", { name: "Accept the new terms" }).click();
    await expect(
      client.getByText(
        "Your Service Plan has changed: it's on these terms from Wed, Jan 28, 9:00 AM.",
      ),
    ).toBeVisible();
    await client.getByRole("link", { name: "See your Service Plan" }).click();
    const cleans = client.getByRole("grid", { name: "Your upcoming cleans" });
    await expect(cleans.getByRole("row")).toHaveText([
      /Mon, Jan 19, 9:00 AM/,
      /Mon, Jan 26, 9:00 AM/,
      /Wed, Jan 28, 9:00 AM/,
    ]);
    expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
      "Your Service Plan with Empire Cleaning has changed",
    );

    // the Office sees the plan on its new terms
    await page.goto(`/office/service-plans/${planId}`);
    await expect(
      page.getByRole("heading", { name: "Standard Clean, every 2 weeks" }),
    ).toBeVisible();
  },
);

test(
  "a Client asks to change their plan, which reaches the Office as a plan change",
  { tag: "@desktop" },
  async ({ page, browser }) => {
    const { planId } = await planStarted();
    const client = await (await browser.newContext()).newPage();
    await signedInAs(client, casey.email);
    await client.goto(`/portal/plans/${planId}`);

    await client.getByRole("button", { name: "Ask to change" }).click();
    const dialog = client.getByRole("dialog", {
      name: "Ask to change your plan",
    });
    await dialog
      .getByRole("textbox", { name: "What would you like to change?" })
      .fill("Could we move to Wednesdays, every 2 weeks?");
    await expectAccessible(client, "[role=dialog]");
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(
      client.getByText("Sent: we'll send you a new Service Plan Quote"),
    ).toBeVisible();

    await signedInAs(page, olive.email);
    await page.goto("/office/requests");
    const row = page.getByRole("row", { name: /Casey Client/ });
    await expect(row).toContainText("Plan change");
    await row.click();
    await expect(
      page.getByText("Could we move to Wednesdays, every 2 weeks?"),
    ).toBeVisible();
    await expect(
      page.getByText(
        "A Service Plan Quote answering this request changes its terms once the Client accepts it.",
        { exact: false },
      ),
    ).toBeVisible();
  },
);
