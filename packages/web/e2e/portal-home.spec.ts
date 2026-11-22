import type { Page } from "@playwright/test";
import {
  acceptedJob,
  addCleaner,
  completeJob,
  completedFirstClean,
  createStaff,
  expect,
  expectAccessible,
  expectNoPageAction,
  failCharges,
  offerJob,
  pageAction,
  proposeReported,
  recordNoAccess,
  requestReschedule,
  sentServicePlanQuote,
  setClock,
  setLanguage,
  signedInAs,
  signUp,
  startedServicePlan,
  test,
} from "./harness.ts";

// A Client's Home leads with what waits on them (#493): an alert under the
// greeting says why, the card's Button does it, and Request a quote stands
// aside meanwhile. Each test ends on Home, for its picture (pr:shots).
// The API's clock is at 4am on Monday 5 January 2026 in New York; Casey's
// Deep Clean is at 9am on Monday the 12th.
const MONDAY_9AM = "2026-01-12T14:00:00Z";
const MONDAY_9_30AM = "2026-01-12T14:30:00Z";
const MONDAY_11AM = "2026-01-12T16:00:00Z";

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { email: "casey@example.com" };

// Casey's Deep Clean, Quoted by Olive, with Cory Confirmed on it
const booked = async () => {
  await createStaff(olive);
  await signUp(olive.email);
  const cory = await addCleaner("Cory Cleaner");
  const job = await acceptedJob({
    startsAt: MONDAY_9AM,
    officeEmail: olive.email,
  });
  await offerJob(job.id, cory.id, { confirmed: true });
  return { job, cory };
};

// done, with an hour more than Quoted, which Olive asks Casey to approve
const priceChangeWaiting = async () => {
  const { job, cory } = await booked();
  await setClock(MONDAY_11AM);
  await completeJob(job.id, cory.id, {
    condition: "moderate",
    reports: [{ kind: "extra_time", hours: 1, reason: "Heavy grease" }],
  });
  await proposeReported(job.id, olive.email);
  return job;
};

const home = async (page: Page) => {
  await signedInAs(page, casey.email);
  await page.goto("/portal");
  await expect(
    page.getByRole("heading", { level: 1, name: "Hi, Casey" }),
  ).toBeVisible();
};

// the alert above the card, once
const why = (page: Page) => page.getByRole("main").getByRole("status");

test("with nothing waiting, Home leads with the next clean, no alert above it", async ({
  page,
}) => {
  await booked();
  await home(page);
  await expect(
    page.getByRole("region", { name: "Your first clean" }),
  ).toContainText("Mon, Jan 12, 9:00 AM");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(why(page)).toHaveCount(0);
  // the usual step is on offer
  await expect(
    page.getByRole("link", { name: "Request a quote", exact: true }),
  ).toBeVisible();
});

test(
  "a price change to answer leads Home, its why above the card, Request a quote aside",
  { tag: ["@desktop"] },
  async ({ page }) => {
    const job = await priceChangeWaiting();
    await home(page);
    await expect(why(page)).toHaveText(
      "The crew needed 1 more hour on your Mon, Jan 12 clean. Please answer by Mon, Jan 19.",
    );
    const card = page.getByRole("region", {
      name: "A price change to answer",
    });
    await expect(card).toContainText("$59.88 more");
    await expect(
      card.getByRole("link", { name: "Review the price change" }),
    ).toHaveAttribute("href", `/portal/jobs/${job.id}`);
    await expectNoPageAction(page, "Request a quote");
    await expectAccessible(page);
  },
);

test("a price change leads Home over a clean booked and a move asked for", async ({
  page,
}) => {
  await priceChangeWaiting();
  // a plan at the home from the Monday after, its first clean asked moved
  await signedInAs(page, casey.email);
  const [done] = (await (
    await page.request.get("/api/jobs/mine/past")
  ).json()) as { property: { id: string } }[];
  const { firstJob } = await startedServicePlan({
    officeEmail: olive.email,
    propertyId: done!.property.id,
    startsAt: "2026-01-19T14:00:00Z",
  });
  await requestReschedule(firstJob.id, { date: "2026-01-21", time: "10:00" });
  await home(page);
  await expect(why(page).first()).toContainText(
    "The crew needed 1 more hour on your Mon, Jan 12 clean.",
  );
  await expect(
    page.getByRole("region", { name: "A price change to answer" }),
  ).toBeVisible();
  // what they wait on us for, under the card
  await expect(why(page).last()).toContainText(
    "You asked to move your Mon, Jan 19 clean to Wed, Jan 21, 10:00 AM.",
  );
});

test("what's owed leads Home, a price change waiting a tile with what it adds and by when", async ({
  page,
}) => {
  const { job, cory } = await booked();
  await setClock(MONDAY_11AM);
  await failCharges();
  await completeJob(job.id, cory.id, {
    condition: "moderate",
    reports: [{ kind: "extra_time", hours: 1, reason: "Heavy grease" }],
  });
  await proposeReported(job.id, olive.email);
  await home(page);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "We couldn't take payment for your Jan 12 clean.",
  );
  await expect(
    page
      .getByRole("region", { name: "To pay" })
      .getByRole("link", { name: "Update your card" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Review a price change/ }),
  ).toContainText("$59.88 more, answer by Mon, Jan 19");
});

test("a paused plan, nothing booked and nothing to do, says so calmly above the plan", async ({
  page,
}) => {
  await createStaff(olive);
  await signUp(olive.email);
  const { propertyId } = await completedFirstClean(olive.email);
  // every four weeks, so only its first clean is booked yet
  const { firstJob } = await startedServicePlan({
    officeEmail: olive.email,
    propertyId,
    startsAt: "2026-01-19T14:00:00Z",
    recurrence: "four_weekly",
  });
  // skipped late, its fee still with the payment service, which we try
  // again ourselves
  await setClock("2026-01-18T15:00:00Z");
  await failCharges("processing");
  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${firstJob.id}`);
  await pageAction(page, "Skip this clean");
  await page
    .getByRole("alertdialog", { name: "Skip this clean?" })
    .getByRole("button", { name: "Skip this clean" })
    .click();
  await expect(page.getByText("Your clean is skipped")).toBeVisible();

  await page.goto("/portal");
  await expect(why(page)).toHaveText(
    "Your cleaning plan is paused. A payment on it hasn't gone through yet. We'll try again by ourselves, so there's nothing you need to do.",
  );
  await expect(
    page.getByRole("region", { name: "Your cleaning plan" }),
  ).toContainText("Nothing's booked until it goes through.");
  // nothing asked of them: the usual step stays
  await expect(
    page.getByRole("link", { name: "Request a quote", exact: true }),
  ).toBeVisible();
});

test("the morning a crew couldn't get in, Home says what happened and leads with how we get in", async ({
  page,
}) => {
  const { job, cory } = await booked();
  await setClock(MONDAY_9_30AM);
  await recordNoAccess(job.id, cory.id, "The code didn't open the door");
  // that morning in the browser too, as Home tells the day by its clock
  await page.clock.install({ time: new Date("2026-01-12T15:00:00Z") });
  await home(page);
  await expect(why(page)).toContainText(
    "The crew came at Mon, Jan 12, 9:30 AM, but couldn't get in: \"The code didn't open the door\".",
  );
  await expect(why(page)).toContainText(
    /As with a late cancellation, your \$[\d.]+ deposit is kept as the fee\./,
  );
  await expect(
    page
      .getByRole("region", { name: "How we get in" })
      .getByRole("link", { name: "Check how we get in" }),
  ).toBeVisible();
  await expectNoPageAction(page, "Request a quote");
});

test(
  "a Client's Home leads with a Quote that's ready, and says it once",
  { tag: "@desktop" },
  async ({ page }) => {
    // Casey's first clean done, and a cleaning plan offered after it
    await createStaff(olive);
    await signUp(olive.email);
    const { propertyId } = await completedFirstClean(olive.email);
    await sentServicePlanQuote({
      officeEmail: olive.email,
      propertyId,
      startsAt: "2026-01-26T14:00:00Z",
    });
    await signedInAs(page, casey.email);

    await expect(
      page.getByRole("heading", { level: 1, name: "Hi, Casey" }),
    ).toBeVisible();
    const card = page.getByRole("region", { name: "Your quote is ready" });
    await expect(card).toContainText("Cleaning plan");
    // the card's Button, so not a tile too
    const tiles = page.getByRole("list", { name: "Shortcuts" });
    await expect(tiles.getByRole("link")).toHaveCount(3);
    await expect(
      tiles.getByRole("link", { name: /^See your quote/ }),
    ).toHaveCount(0);
    await expect(
      card.getByRole("link", { name: "See your quote" }),
    ).toHaveAttribute("href", /^\/portal\/quotes\//);
  },
);

test("a price change to answer leads Home in Spanish", async ({ page }) => {
  await priceChangeWaiting();
  await signedInAs(page, casey.email);
  await setLanguage(page, "es");
  await page.goto("/portal");
  await expect(why(page)).toHaveText(
    "El equipo necesitó 1 hora más en su limpieza del lun, 12 de ene. Responda antes del lun, 19 de ene.",
  );
  await expect(
    page.getByRole("region", { name: "Un cambio de precio por responder" }),
  ).toContainText("Revisar el cambio de precio");
});
