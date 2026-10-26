import type { Page } from "@playwright/test";
import {
  acceptedJob,
  bookJob,
  createStaff,
  expect,
  offerPlace,
  proposeNextMonday,
  recordNoAccess,
  requestQuoteAsGuest,
  requestReschedule,
  setClock,
  setUsualWeek,
  signedInAs,
  signUp,
  test,
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

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

test("the Office's screens fit every width", async ({ page }) => {
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [7.25, 8, 8, 8, 6.5, 0, 0]);
  const job = (await bookJob({
    startsAt: "2027-03-02T14:00:00Z",
    labourHours: 5.25,
  })) as { id: string };
  await offerPlace(job.id, cory.id);
  // today's, for the dashboard (the API's clock is at 5 January 2026)
  await bookJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 5.25 });
  await requestQuoteAsGuest(casey, ["Inside the oven"]);
  await createStaff(olive);
  await signedInAs(page, olive.email);

  await page.goto("/office/requests");
  await page.getByText("Casey Client").click();
  await expect(page).toHaveURL(/\/office\/requests\/[0-9a-f-]{36}$/);
  const request = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "View Client" }).click();
  const client = new URL(page.url()).pathname;
  await page.goto(request);
  await page.getByRole("button", { name: "Draft a Quote" }).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  const draft = new URL(page.url()).pathname;

  for (const path of [
    "/office",
    "/office/requests",
    request,
    client,
    draft,
    "/office/schedule?from=2027-03-01&to=2027-03-07",
    "/office/schedule?from=2027-03-01&to=2027-03-03",
    "/office/staff",
    `/office/staff/${cory.id}`,
    "/office/price-list",
    `/office/jobs/${job.id}`,
  ]) {
    await expectFitsEveryWidth(page, path);
  }
});

test("the portal's screens fit every width", async ({ page }) => {
  await requestQuoteAsGuest(casey);
  await signedInAs(page, casey.email);

  for (const path of [
    "/portal",
    "/portal/request",
    "/portal/details",
    "/portal/payment-method",
  ]) {
    await expectFitsEveryWidth(page, path);
  }
});

test("a Sent Quote fits every width, for the Office and the Client", async ({
  page,
  browser,
}) => {
  await requestQuoteAsGuest(casey, ["Inside the oven"]);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/requests");
  await page.getByText("Casey Client").click();
  await page.getByRole("button", { name: "Draft a Quote" }).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  const quote = new URL(page.url()).pathname;
  await proposeNextMonday(page);
  await page.getByRole("button", { name: "Send to Casey Client" }).click();
  await expect(page.getByRole("region", { name: "Offer" })).toBeVisible();

  await expectFitsEveryWidth(page, quote);

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await expectFitsEveryWidth(
    client,
    quote.replace("/office/quotes/", "/portal/quotes/"),
  );
});

test("an Accepted Quote and the Client's upcoming Jobs fit every width", async ({
  page,
  browser,
}) => {
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  await requestQuoteAsGuest(casey, ["Inside the oven"]);
  await createStaff(olive);
  await signedInAs(page, olive.email);
  await page.goto("/office/requests");
  await page.getByText("Casey Client").click();
  await page.getByRole("button", { name: "Draft a Quote" }).click();
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}$/);
  const quote = new URL(page.url()).pathname;
  await proposeNextMonday(page);
  await page.getByRole("button", { name: "Send to Casey Client" }).click();
  await expect(page.getByRole("region", { name: "Offer" })).toBeVisible();

  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  const own = quote.replace("/office/quotes/", "/portal/quotes/");
  await client.goto(own);
  await client.getByRole("button", { name: /^Accept and pay/ }).click();
  await expect(client.getByText("You're booked")).toBeVisible();

  await expectFitsEveryWidth(page, quote);
  await expectFitsEveryWidth(client, own);
  await expectFitsEveryWidth(client, "/portal");
});

test("cancelling, Cancelled and No Access Jobs fit every width", async ({
  page,
  browser,
}) => {
  await createStaff(olive);
  await signUp(olive.email);
  const cory = (await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  })) as { id: string };
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  const booked = await acceptedJob({
    startsAt: "2026-01-12T14:00:00Z",
    officeEmail: olive.email,
  });
  await offerPlace(booked.id, cory.id, { confirmed: true });
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await signedInAs(page, olive.email);

  // still to come: cancelling, with what it costs
  await expectFitsEveryWidth(client, `/portal/jobs/${booked.id}`);
  await expectFitsEveryWidth(page, `/office/jobs/${booked.id}`);

  // No Access, recorded on the day
  await setClock("2026-01-12T14:30:00Z");
  const cleaner = await (await browser.newContext()).newPage();
  await signedInAs(cleaner, "cory@example.com");
  await expectFitsEveryWidth(cleaner, `/cleaner/jobs/${booked.id}`);
  await recordNoAccess(booked.id, cory.id, "Nobody answered");
  await expectFitsEveryWidth(cleaner, `/cleaner/jobs/${booked.id}`);
  await expectFitsEveryWidth(client, `/portal/jobs/${booked.id}`);
  await expectFitsEveryWidth(page, `/office/jobs/${booked.id}`);

  // Cancelled, by Empire Cleaning
  const cancelled = await acceptedJob({
    startsAt: "2026-01-19T14:00:00Z",
    officeEmail: olive.email,
  });
  await page.goto(`/office/jobs/${cancelled.id}`);
  await page.getByRole("button", { name: "Cancel Job" }).click();
  await page.getByText("Empire Cleaning can't do it").click();
  await page
    .getByRole("textbox", { name: "Why? (told to the Client)" })
    .fill("Our crew is unwell.");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel Job" })
    .click();
  await expect(page.getByRole("region", { name: "Cancelled" })).toBeVisible();
  await expectFitsEveryWidth(page, `/office/jobs/${cancelled.id}`);
  await expectFitsEveryWidth(client, `/portal/jobs/${cancelled.id}`);
});

test("Reschedule Requests fit every width", async ({ page, browser }) => {
  await createStaff(olive);
  await signUp(olive.email);
  const cory = (await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  })) as { id: string };
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  const booked = await acceptedJob({
    startsAt: "2026-01-12T14:00:00Z",
    officeEmail: olive.email,
  });
  const client = await (await browser.newContext()).newPage();
  await signedInAs(client, casey.email);
  await signedInAs(page, olive.email);

  // what moving costs, before asking
  await expectFitsEveryWidth(client, `/portal/jobs/${booked.id}`);

  // pending, for the Client, the Office and Needs attention
  await requestReschedule(booked.id, { date: "2026-01-14", time: "10:00" });
  await expectFitsEveryWidth(client, `/portal/jobs/${booked.id}`);
  await expectFitsEveryWidth(page, `/office/jobs/${booked.id}`);
  await expectFitsEveryWidth(page, "/office");
});

test("signing in, the welcome page and the Cleaner area fit every width", async ({
  page,
}) => {
  await expectFitsEveryWidth(page, "/sign-in");

  await signedInAs(page, "new@example.com");
  await expectFitsEveryWidth(page, "/welcome");

  const cory = (await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  })) as { id: string };
  const job = (await bookJob({
    startsAt: "2026-01-08T14:00:00Z",
    labourHours: 5.25,
  })) as { id: string };
  await offerPlace(job.id, cory.id);
  await page.context().clearCookies();
  await signedInAs(page, "cory@example.com");
  await expectFitsEveryWidth(page, "/cleaner");
  await expectFitsEveryWidth(page, `/cleaner/jobs/${job.id}`);
});
