import type { Page } from "@playwright/test";
import {
  acceptedJob,
  billedWeek,
  bookJob,
  bookSiteVisit,
  completedFirstClean,
  createClient,
  createStaff,
  expect,
  offerJob,
  proposeNextMonday,
  saved,
  startOn,
  recordNoAccess,
  requestQuoteAsGuest,
  requestQuoteForPremises,
  requestReschedule,
  sentServicePlanQuote,
  setClock,
  setLanguage,
  signedInAs,
  signUp,
  test,
  draftTheQuote,
  recordFindingsWithoutVisit,
  addCleaner,
} from "./harness.ts";

// Every screen, at the widths people actually use, from a small phone to a
// wide desktop. Functional tests read values from the DOM, which is there
// whether or not anyone can see it, so this is what notices text squeezed out
// of sight: an input narrower than what's typed in it, or a page that scrolls
// sideways.
const widths = [320, 375, 412, 640, 768, 1024, 1280, 1440];

const problemsAt = (page: Page) =>
  page.evaluate(() => {
    const problems: string[] = [];
    const { documentElement: root } = document;
    if (root.scrollWidth > root.clientWidth) {
      problems.push(
        `the page scrolls sideways (${root.scrollWidth}px in ${root.clientWidth}px)`,
      );
    }
    for (const input of document.querySelectorAll("input")) {
      if (input.type === "hidden" || input.type === "checkbox") continue;
      if (input.getClientRects().length === 0) continue;
      // an input's scrollWidth grows past its width when its text doesn't fit
      if (input.scrollWidth > input.clientWidth + 1) {
        const label =
          input.labels?.[0]?.textContent ?? input.getAttribute("aria-label");
        problems.push(
          `"${label ?? input.name}" is ${input.clientWidth}px wide but its text needs ${input.scrollWidth}px`,
        );
      }
    }
    // a field drawn as a box of parts (a date's segments and calendar
    // button, a number's stepper): squeezed, its parts crowd into its
    // padding and get cut off at the edge, though nothing scrolls
    for (const group of document.querySelectorAll('[role="group"]')) {
      if (group.getClientRects().length === 0) continue;
      const box = group.getBoundingClientRect();
      const style = getComputedStyle(group);
      const left = box.left + parseFloat(style.paddingLeft) - 1;
      const right = box.right - parseFloat(style.paddingRight) + 1;
      for (const part of group.querySelectorAll(
        'button, input:not([type="hidden"]), [role="spinbutton"]',
      )) {
        const rect = part.getBoundingClientRect();
        if (rect.width === 0) continue;
        if (rect.left < left || rect.right > right) {
          const name =
            group.getAttribute("aria-label") ??
            document.getElementById(
              group.getAttribute("aria-labelledby")?.split(" ")[0] ?? "",
            )?.textContent;
          problems.push(
            `"${name}" is too narrow: its ${part.getAttribute("aria-label") ?? part.tagName.toLowerCase()} is cut off at the edge`,
          );
          break;
        }
      }
    }
    return problems;
  });

const expectFitsEveryWidth = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const problems: string[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const problem of await problemsAt(page)) {
      problems.push(`${path} at ${width}px: ${problem}`);
    }
  }
  expect.soft(problems).toEqual([]);
};

// the same, then in Spanish (ADR-0025, docs/ux.md: Spanish runs 20–30%
// longer), for a Guest's or Client's screen: the signed-in person's
// Preferred Language, or before sign-in the language of the page that linked
// here (?lang=es). English again after
const expectFitsInBoth = async (page: Page, path: string) => {
  await expectFitsEveryWidth(page, path);
  const me = await page.request.get("/api/me");
  const client = me.ok() && (await me.json()).languages.portal !== null;
  if (client) {
    await setLanguage(page, "es");
    await expectFitsEveryWidth(page, path);
    await setLanguage(page, "en");
  } else {
    await expectFitsEveryWidth(
      page,
      `${path}${path.includes("?") ? "&" : "?"}lang=es`,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await page.evaluate(() => localStorage.removeItem("language"));
  }
};

// the same for a dialog, opened from a page by its button: a dialog keeps its
// own width, whatever the screen's, so its fields can be squeezed on the
// widest screen
const expectDialogFitsEveryWidth = async (
  page: Page,
  path: string,
  button: string,
) => {
  await page.goto(path);
  await page.getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const problems: string[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const problem of await problemsAt(page)) {
      problems.push(`${button} dialog at ${width}px: ${problem}`);
    }
  }
  expect.soft(problems).toEqual([]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
};

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

test("the Office's screens fit every width", async ({ page }) => {
  // every screen at every width: near the 30s budget alone, past it while
  // other workers load the machine
  test.slow();
  const cory = await addCleaner("Cory Cleaner", [7.25, 8, 8, 8, 6.5, 0, 0]);
  const job = (await bookJob({
    startsAt: "2027-03-02T14:00:00Z",
    labourHours: 5.25,
  })) as { id: string };
  await offerJob(job.id, cory.id);
  // today's, for the dashboard (the API's clock is at 5 January 2026)
  await bookJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 5.25 });
  await requestQuoteAsGuest(casey, ["Inside the oven"]);
  await createStaff(olive);
  await signedInAs(page, olive.email);

  await page.goto("/office/quotes");
  await page.getByText("Casey Client").click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  const request = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "View property" }).click();
  await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
  const property = new URL(page.url()).pathname;
  await page
    .getByLabel("Breadcrumbs")
    .getByRole("link", { name: "Casey Client" })
    .click();
  await expect(page).toHaveURL(/\/office\/clients\/[0-9a-f-]{36}$/);
  const client = new URL(page.url()).pathname;
  await page.goto(request);
  await draftTheQuote(page);
  const draft = new URL(page.url()).pathname;

  for (const path of [
    "/office",
    "/office/quotes",
    "/office/clients",
    "/office/quotes/new",
    request,
    client,
    property,
    draft,
    "/office/schedule?from=2027-03-01&to=2027-03-07",
    "/office/schedule?from=2027-03-01&to=2027-03-03",
    "/office/staff",
    `/office/staff/${cory.id}`,
    "/office/price-list",
    "/office/services",
    "/office/services/new",
    // Standard Clean, which every install starts with
    "/office/services/5e7a1c00-0000-4000-8000-000000000001",
    `/office/jobs/${job.id}`,
  ]) {
    await expectFitsEveryWidth(page, path);
  }
});

test("business premises' screens fit every width, the form included", async ({
  page,
}) => {
  // every screen at every width: near the 30s budget alone, past it while
  // other workers load the machine
  test.slow();
  await requestQuoteForPremises(casey, "Acme Dental Group of Queens");
  await createStaff(olive);
  const visit = await bookSiteVisit({
    street: "200 Park Ave S",
    staffEmail: olive.email,
    date: "2026-01-06",
    time: "10:00",
  });
  await signedInAs(page, olive.email);

  await page.goto("/office/quotes");
  await page.getByText(/Acme Dental Group/).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  const request = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "View property" }).click();
  await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
  const property = new URL(page.url()).pathname;
  for (const path of [request, property, `/office/site-visits/${visit.id}`]) {
    await expectFitsEveryWidth(page, path);
  }

  // its Site Visit's dialogs, on its page: moving it, and once it's
  // cancelled, booking one from its home
  const sitePage = `/office/site-visits/${visit.id}`;
  await expectDialogFitsEveryWidth(page, sitePage, "Move or change");
  await expectDialogFitsEveryWidth(page, sitePage, "Record findings");
  await page.getByRole("button", { name: "Cancel visit" }).click();
  await page.getByRole("button", { name: "Cancel Site Visit" }).click();
  await expect(page.getByText("Site Visit cancelled")).toBeVisible();
  await expectDialogFitsEveryWidth(page, property, "Book a site visit");

  // once the premises are known, its Draft
  await page.goto(request);
  await recordFindingsWithoutVisit(page);
  await draftTheQuote(page, "one-off");
  await expectFitsEveryWidth(page, new URL(page.url()).pathname);

  // New Quote for business premises, with its days to choose
  await page.goto("/office/quotes/new");
  await page.getByRole("button", { name: "New client" }).click();
  await page
    .locator("form")
    .getByText("Commercial cleaning", { exact: true })
    .click();
  const problems: string[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const problem of await problemsAt(page)) {
      problems.push(`the business form at ${width}px: ${problem}`);
    }
  }
  expect.soft(problems).toEqual([]);
});

test("the portal's screens fit every width", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signedInAs(page, casey.email);

  for (const path of [
    "/portal",
    "/portal/request",
    "/portal/payments",
    "/portal/details",
    "/portal/payment-method",
  ]) {
    await expectFitsInBoth(page, path);
  }
});

test("page not found and something went wrong fit every width, in an area and out", async ({
  page,
}) => {
  await requestQuoteAsGuest(casey);
  await signedInAs(page, casey.email);
  await expectFitsInBoth(page, "/no-such-page");
  await expectFitsInBoth(
    page,
    "/portal/bills/00000000-0000-4000-8000-000000000000",
  );
  await page.route("**/api/clients/me", (route) => route.abort());
  await expectFitsInBoth(page, "/portal/details");
});

test("a Sent Quote fits every width, for the Office and the Client", async ({
  page,
  browser,
}) => {
  await requestQuoteAsGuest(casey, ["Inside the oven"]);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/quotes");
  await page.getByText("Casey Client").click();
  await draftTheQuote(page);
  // the Quote's own page, not its Draft's
  const quote = new URL(page.url()).pathname.replace(/\/draft$/, "");
  await proposeNextMonday(page);
  await page.getByRole("button", { name: "Send to Casey Client" }).click();
  await expect(
    page.getByRole("region", { name: "Current quote" }),
  ).toBeVisible();

  await expectFitsEveryWidth(page, quote);

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await expectFitsInBoth(
    client,
    quote.replace("/office/quotes/", "/portal/quotes/"),
  );
});

test("an Accepted Quote and the Client's upcoming Jobs fit every width", async ({
  page,
  browser,
}) => {
  // two Cleaners, so the Quote's crew of 2 has room
  for (const name of ["Cory Cleaner", "Dee Cleaner"]) await addCleaner(name);
  await requestQuoteAsGuest(casey, ["Inside the oven"]);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/quotes");
  await page.getByText("Casey Client").click();
  await draftTheQuote(page);
  // the Quote's own page, not its Draft's
  const quote = new URL(page.url()).pathname.replace(/\/draft$/, "");
  await proposeNextMonday(page);
  await page.getByRole("button", { name: "Send to Casey Client" }).click();
  await expect(
    page.getByRole("region", { name: "Current quote" }),
  ).toBeVisible();

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  const own = quote.replace("/office/quotes/", "/portal/quotes/");
  await client.goto(own);
  await client.getByRole("button", { name: /^Accept and pay/ }).click();
  await expect(client.getByText(/^You're booked: a Deep Clean/)).toBeVisible();

  await expectFitsEveryWidth(page, quote);
  await expectFitsInBoth(client, own);
  await expectFitsInBoth(client, "/portal");
});

test("a Service Plan Quote fits every width, Draft and Sent, for the Office and the Client", async ({
  page,
  browser,
}) => {
  // 16-18 s alone, as the Office's screens are: past the 30 s budget while
  // other workers load the machine
  test.slow();
  await createStaff(olive);
  await signedInAs(page, olive.email);
  const { job } = await completedFirstClean(olive.email);
  const firstClean = `/office/jobs/${job.id}`;
  await page.goto(firstClean);
  await page.getByRole("button", { name: "Quote a cleaning plan" }).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}\/draft$/);
  const quote = new URL(page.url()).pathname.replace(/\/draft$/, "");

  await expectFitsEveryWidth(page, firstClean);
  await expectFitsEveryWidth(page, `${quote}/draft`);

  // its first Job on Monday 19 January 2026 at 9:00 AM
  await startOn(page, page, "01192026", "0900AM");
  await page.getByRole("button", { name: "Send to Casey Client" }).click();
  await expect(
    page.getByRole("region", { name: "Current quote" }),
  ).toBeVisible();
  await expectFitsEveryWidth(page, quote);
  // the home's page, with its history
  await page
    .getByLabel("Breadcrumbs")
    .getByRole("link", { name: /41-12 Austin St/ })
    .click();
  await expect(page).toHaveURL(/\/office\/properties\/[0-9a-f-]{36}$/);
  await expectFitsEveryWidth(page, new URL(page.url()).pathname);

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await expectFitsInBoth(
    client,
    quote.replace("/office/quotes/", "/portal/quotes/"),
  );
  await expectFitsInBoth(client, "/portal");
});

test("a Service Plan fits every width, for the Office and the Client", async ({
  page,
  browser,
}) => {
  // 16-18 s alone, as the Office's screens are: past the 30 s budget while
  // other workers load the machine
  test.slow();
  await createStaff(olive);
  await signedInAs(page, olive.email);
  const { propertyId } = await completedFirstClean(olive.email);
  const quote = await sentServicePlanQuote({
    officeEmail: olive.email,
    propertyId,
    startsAt: "2026-01-19T14:00:00Z",
  });
  // its third Monday is full, so a visit waits for the Office
  await bookJob({ startsAt: "2026-02-02T14:00:00Z", labourHours: 8 });
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await client.goto(`/portal/quotes/${quote.id}`);
  await client.getByRole("button", { name: /^Accept and pay/ }).click();
  await client.getByRole("link", { name: "See your cleaning plan" }).click();
  await expect(client).toHaveURL(/\/portal\/plans\/[0-9a-f-]{36}$/);
  const plan = new URL(client.url()).pathname;

  await expectFitsInBoth(client, plan);
  await expectFitsInBoth(client, "/portal");
  await expectFitsEveryWidth(
    page,
    plan.replace("/portal/plans/", "/office/service-plans/"),
  );
  await expectFitsEveryWidth(page, `/office/properties/${propertyId}`);
  await expectFitsEveryWidth(page, "/office");

  // new terms for it, replacing its booked Jobs from then on
  const change = await sentServicePlanQuote({
    officeEmail: olive.email,
    propertyId,
    startsAt: "2026-01-28T14:00:00Z",
    recurrence: "fortnightly",
  });
  await expectFitsInBoth(client, `/portal/quotes/${change.id}`);
  await expectFitsEveryWidth(page, `/office/quotes/${change.id}`);
});

test("a Service Plan on several weekdays fits every width, Draft, Sent and started", async ({
  page,
  browser,
}) => {
  // 16-18 s alone, as the Office's screens are: past the 30 s budget while
  // other workers load the machine
  test.slow();
  await createStaff(olive);
  await signedInAs(page, olive.email);
  const { job, propertyId } = await completedFirstClean(olive.email);
  // a Draft with two weekdays
  await page.goto(`/office/jobs/${job.id}`);
  await page.getByRole("button", { name: "Quote a cleaning plan" }).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}\/draft$/);
  const draft = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Add a weekday" }).click();
  await expect(page.getByRole("region", { name: "Weekday 2" })).toBeVisible();
  await saved(page);
  await expectFitsEveryWidth(page, draft);

  // Sent on Mondays, Wednesdays and Fridays, and started
  const quote = await sentServicePlanQuote({
    officeEmail: olive.email,
    propertyId,
    startsAt: [
      "2026-01-19T14:00:00Z",
      "2026-01-21T14:00:00Z",
      "2026-01-23T14:00:00Z",
    ],
  });
  await expectFitsEveryWidth(page, `/office/quotes/${quote.id}`);
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await expectFitsInBoth(client, `/portal/quotes/${quote.id}`);
  await client.goto(`/portal/quotes/${quote.id}`);
  await client.getByRole("button", { name: /^Accept and pay/ }).click();
  await client.getByRole("link", { name: "See your cleaning plan" }).click();
  await expect(client).toHaveURL(/\/portal\/plans\/[0-9a-f-]{36}$/);
  const plan = new URL(client.url()).pathname;
  await expectFitsInBoth(client, plan);
  await expectFitsEveryWidth(
    page,
    plan.replace("/portal/plans/", "/office/service-plans/"),
  );
});

test("cancelling, Cancelled and No Access Jobs fit every width", async ({
  page,
  browser,
}) => {
  // 16-18 s alone, as the Office's screens are: past the 30 s budget while
  // other workers load the machine
  test.slow();
  await createStaff(olive);
  await signUp(olive.email);
  const cory = await addCleaner("Cory Cleaner");
  const booked = await acceptedJob({
    startsAt: "2026-01-12T14:00:00Z",
    officeEmail: olive.email,
  });
  await offerJob(booked.id, cory.id, { confirmed: true });
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await signedInAs(page, olive.email);

  // still to come: cancelling, with what it costs
  await expectFitsInBoth(client, `/portal/jobs/${booked.id}`);
  await expectFitsEveryWidth(page, `/office/jobs/${booked.id}`);

  // No Access, recorded on the day
  await setClock("2026-01-12T14:30:00Z");
  const cleaner = await (await browser.newContext()).newPage();
  await signedInAs(cleaner, "cory@example.com");
  await expectFitsEveryWidth(cleaner, `/cleaner/jobs/${booked.id}`);
  await recordNoAccess(booked.id, cory.id, "Nobody answered");
  await expectFitsEveryWidth(cleaner, `/cleaner/jobs/${booked.id}`);
  await expectFitsInBoth(client, `/portal/jobs/${booked.id}`);
  await expectFitsEveryWidth(page, `/office/jobs/${booked.id}`);

  // Cancelled, by Empire Cleaning
  const cancelled = await acceptedJob({
    startsAt: "2026-01-19T14:00:00Z",
    officeEmail: olive.email,
  });
  await page.goto(`/office/jobs/${cancelled.id}`);
  await page.getByRole("button", { name: "Cancel job" }).click();
  await page.getByText("Empire Cleaning can't do it").click();
  await page
    .getByRole("textbox", { name: "Why? (the client sees this)" })
    .fill("Our crew is unwell.");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel job" })
    .click();
  await expect(
    page.getByText("By Empire Cleaning, refunded in full."),
  ).toBeVisible();
  await expectFitsEveryWidth(page, `/office/jobs/${cancelled.id}`);
  await expectFitsInBoth(client, `/portal/jobs/${cancelled.id}`);
});

test("Reschedule Requests fit every width", async ({ page, browser }) => {
  await createStaff(olive);
  await signUp(olive.email);
  await addCleaner("Cory Cleaner");
  const booked = await acceptedJob({
    startsAt: "2026-01-12T14:00:00Z",
    officeEmail: olive.email,
  });
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await signedInAs(page, olive.email);

  // what moving costs, before asking
  await expectFitsInBoth(client, `/portal/jobs/${booked.id}`);

  // pending, for the Client, the Office and Needs attention
  await requestReschedule(booked.id, { date: "2026-01-14", time: "10:00" });
  await expectFitsInBoth(client, `/portal/jobs/${booked.id}`);
  await expectFitsEveryWidth(page, `/office/jobs/${booked.id}`);
  await expectFitsEveryWidth(page, "/office");
});

test("signing in, the welcome page and the Cleaner area fit every width", async ({
  page,
}) => {
  await expectFitsInBoth(page, "/sign-in");
  // the pages an emailed link opens, before their button is pressed (#243)
  await expectFitsInBoth(page, "/sign-in/link?token=unused");
  await expectFitsInBoth(page, "/confirm-email?token=unused");
  await createClient({
    name: "Helen Kowalski",
    email: "owner+helen@example.com",
  });
  await expectFitsEveryWidth(page, "/people?as=helen");

  await signedInAs(page, "new@example.com");
  await expectFitsInBoth(page, "/welcome");

  // free that week, so they can be Offered it
  const cory = await addCleaner("Cory Cleaner");
  const job = (await bookJob({
    startsAt: "2026-01-08T14:00:00Z",
    labourHours: 5.25,
  })) as { id: string };
  await offerJob(job.id, cory.id);
  // and a Job open to Cory on Friday
  const open = (await bookJob({
    startsAt: "2026-01-09T14:00:00Z",
    labourHours: 3,
    crewSize: 1,
  })) as { id: string };
  await page.context().clearCookies();
  await signedInAs(page, "cory@example.com");
  await expectFitsEveryWidth(page, "/cleaner");
  await expectFitsEveryWidth(page, `/cleaner/jobs/${job.id}`);
  await expectFitsEveryWidth(page, `/cleaner/open/${open.id}`);
});

test("weekly Bills fit every width, for the Office and the Client", async ({
  page,
  browser,
}) => {
  await createStaff(olive);
  await signUp(olive.email);
  // Unpaid, with the most to show: its plan On Hold, and paying it
  const { clientId, billId, planId } = await billedWeek({
    officeEmail: olive.email,
    billingEmail: "accounts@acme.example.com",
    plan: true,
    failing: true,
  });
  await signedInAs(page, olive.email);
  for (const path of [
    "/office",
    `/office/clients/${clientId}`,
    `/office/bills/${billId}`,
    `/office/service-plans/${planId}`,
  ]) {
    await expectFitsEveryWidth(page, path);
  }

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  for (const path of [
    "/portal",
    `/portal/bills/${billId}`,
    `/portal/plans/${planId}`,
  ]) {
    await expectFitsInBoth(client, path);
  }
});
