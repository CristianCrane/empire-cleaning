import type { Locator, Page } from "@playwright/test";
import { apiUrl } from "../playwright.config.ts";
import {
  bookSiteVisit,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  expectCurrentSection,
  requestQuoteForPremises,
  signedInAs,
  test,
  draftTheQuote,
  proposeNextMonday,
  recordFindingsWithoutVisit,
  addCleaner,
  serviceKey,
  pageAction,
  expectNoPageAction,
  expectNextStep,
  expectNothingNext,
  setClock,
  titleBadge,
} from "./harness.ts";

// The API's clock starts at 4am on Monday 5 January 2026 in New York.

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

const signInAsOffice = async (page: Page) => {
  await createStaff(olive);
  await signedInAs(page, olive.email);
};

// a design-system Select in a dialog: its button is named by its value and
// its label, and its options pop up over the page
const choose = async (dialog: Locator, label: RegExp, option: string) => {
  await dialog.getByRole("button", { name: label }).click();
  await dialog
    .page()
    .getByRole("option", { name: option, exact: true })
    .click();
};

test(
  "Office Staff book a Site Visit for business premises, and record what it found",
  { tag: "@smoke" },
  async ({ page }) => {
    await requestQuoteForPremises(casey, "Acme Dental");
    await signInAsOffice(page);

    await page.goto("/office/quotes");
    await expect(page.getByText("Needs a site visit")).toBeVisible();
    await page.getByText("Acme Dental").click();
    await expect(
      page.getByText(
        "Commercial cleaning needs a site visit before it's quoted",
      ),
    ).toBeVisible();

    await expectNextStep(page, "Book a site visit");
    await pageAction(page, "Book a site visit");
    const dialog = page.getByRole("dialog", { name: "Book a site visit" });
    await choose(dialog, /Who visits/, "Olive Owner");
    await dialog
      .getByRole("group", { name: "Day" })
      .getByRole("spinbutton", { name: /month/i })
      .click();
    await page.keyboard.type("01062026");
    await dialog
      .getByRole("group", { name: "Start time" })
      .getByRole("spinbutton", { name: /hour/i })
      .click();
    await page.keyboard.type("1000AM");
    await expect(dialog.getByRole("textbox", { name: /How long/ })).toHaveValue(
      "30",
    );
    await dialog.getByRole("button", { name: "Book site visit" }).click();

    await expect(page).toHaveURL(/\/office\/site-visits\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Booked", { exact: true })).toBeVisible();
    await expect(page.getByText("Tue, Jan 6, 10:00 AM")).toBeVisible();
    await expect(
      page.locator("#main").getByText("Olive Owner", { exact: true }),
    ).toBeVisible();
    const [email] = (await emailsTo(casey.email)).filter(
      (e) => e.subject === "Your site visit is booked",
    );
    expect(email!.text).toContain("Tuesday, January 6 at 10:00 AM");
    const visit = page.url();

    await page.goto("/office/quotes");
    await expect(page.getByText("Site visit booked")).toBeVisible();

    await page.goto(visit);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Record findings" }).click();
    const findings = page.getByRole("dialog", {
      name: "What the site visit found",
    });
    await expect(
      findings.getByRole("textbox", { name: "Floor area in sq ft" }),
    ).toHaveValue("4,500");
    await findings.getByText("Heavy", { exact: true }).click();
    await findings
      .getByRole("textbox", { name: /Office notes/ })
      .fill("Two treatment rooms need extra care");
    await findings.getByRole("button", { name: "Save findings" }).click();

    await expect(page.getByText("Findings recorded").first()).toBeVisible();
    await expect(page.getByText("Done", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Two treatment rooms need extra care"),
    ).toBeVisible();
  },
);

test("a Site Visit that has been is badged To record, on its page and its home's", async ({
  page,
}) => {
  await requestQuoteForPremises(casey, "Acme Dental");
  await addCleaner("Cory Cleaner");
  const visit = await bookSiteVisit({
    street: "200 Park Ave S",
    staffEmail: "cory@example.com",
    date: "2026-01-06",
    time: "10:00",
  });
  // the day before, its findings card says when to add them, and nothing
  // is next
  await setClock("2026-01-05T15:00:00Z");
  await signInAsOffice(page);
  await page.goto(`/office/site-visits/${visit.id}`);
  await expect(
    page.getByText("When it's done, add what was found."),
  ).toBeVisible();
  await expectNothingNext(page);

  // the next day: it's been, with nothing recorded. Recording is the page's
  // next step, pinned at a phone's foot after the facts; the alert says
  // only why, and What it found waits until something is
  await setClock("2026-01-07T15:00:00Z");
  await page.reload();
  await expect(
    page.getByText("Cory Cleaner has been. A quote waits on what they found.", {
      exact: true,
    }),
  ).toBeVisible();
  await expectNextStep(page, "Record findings");
  await expect(
    page.getByRole("button", { name: "Record findings" }),
  ).toHaveCount(1);
  await expect(page.getByRole("region", { name: "What it found" })).toHaveCount(
    0,
  );
  await expect(titleBadge(page, "To record")).toBeVisible();
  // in the section its crumbs start from, as a home's other pages are
  await expectCurrentSection(page, "Clients");
  // its home's row says it too, not "findings to record" beside Booked
  await page
    .getByRole("link", { name: /200 Park Ave S/ })
    .first()
    .click();
  const row = page.getByRole("grid", { name: "Site visit" }).getByRole("row");
  await expect(row).toHaveText(/To record$/);
  await expect(row).not.toContainText("findings to record");
  await page.goBack();
  await expect(page.getByText("Cory Cleaner has been.")).toBeVisible();
});

test("a Quote for business premises can't be drafted until their findings are recorded", async ({
  page,
}) => {
  await requestQuoteForPremises(casey, "Acme Dental");
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText("Acme Dental").click();

  // not seen yet: seeing them is the only thing to do
  await expect(
    page.getByText(
      "Commercial cleaning needs a site visit before it's quoted.",
    ),
  ).toBeVisible();
  await expectNextStep(page, "Book a site visit");
  await expectNoPageAction(page, "Draft the quote");

  // premises the Office knows already
  await recordFindingsWithoutVisit(page);
  await draftTheQuote(page, "one-off");
  await expect(
    page.getByText("This business hasn't had a site visit yet"),
  ).toHaveCount(0);
  // a time is all Send waits on now
  await proposeNextMonday(page);
  await expect(page.getByRole("button", { name: /^Send to/ })).toBeEnabled();
});

test("a Site Visit shows on the Schedule, in the Client's portal and in the visiting Cleaner's day", async ({
  page,
}) => {
  await requestQuoteForPremises(casey, "Acme Dental");
  await addCleaner("Cory Cleaner");
  await bookSiteVisit({
    street: "200 Park Ave S",
    staffEmail: "cory@example.com",
    date: "2026-01-05",
    time: "15:00",
  });

  await signInAsOffice(page);
  await page.goto("/office/schedule?from=2026-01-05&to=2026-01-05");
  // a Cleaner's visit takes half an hour of their hours that day
  await expect(page.getByText("30 min booked")).toBeVisible();
  await page.getByRole("link", { name: /3:00 PM Acme Dental/ }).click();
  await expect(page).toHaveURL(/\/office\/site-visits\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Cory Cleaner", { exact: true })).toBeVisible();

  await page.context().clearCookies();
  await signedInAs(page, "cory@example.com");
  await expect(page).toHaveURL("/cleaner");
  const today = page.getByRole("region", { name: "Next up" });
  await expect(today).toContainText("3:00 PM");
  await expect(today).toContainText("200 Park Ave S");
  await expect(today.getByRole("link", { name: /Call/ })).toBeVisible();

  await page.context().clearCookies();
  await signedInAs(page, casey.email);
  await expect(page).toHaveURL("/portal");
  await expect(
    page.getByText("Your site visit", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/^Cory comes to see 200 Park Ave S.* for about 30 min$/),
  ).toBeVisible();
  // and on their cleans, its title read on from the time before it
  await page.goto("/portal/cleans");
  await expect(page.getByRole("row").first()).toContainText(
    /3:00 PM\s·\ssite visit/,
  );
});

test("a home's Quote for a Service seen first asks for a site visit as a home's", async ({
  page,
}) => {
  // Painting is seen before it's quoted, for a home too (ADR-0018)
  const asked = await fetch(`${apiUrl}/api/quotes/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contact: { ...casey, phone: "(646) 555-0100" },
      property: {
        new: {
          kind: "residential",
          type: "apartment",
          street: "41-12 Austin St",
          unit: "4B",
          postcode: "11375",
        },
      },
      serviceKey: await serviceKey("Painting"),
      wantsRegularService: false,
    }),
  });
  expect(asked.status).toBe(201);
  await signInAsOffice(page);
  await page.goto("/office/quotes");
  await page.getByText("41-12 Austin St").click();

  // it's the Service that needs seeing, not the home
  await expect(
    page.getByText("Painting needs a site visit before it's quoted."),
  ).toBeVisible();
  await expect(page.getByText(/business premises/i)).toHaveCount(0);
  // the page's next step, and only there
  await expectNextStep(page, "Book a site visit");
  await expect(
    page.getByRole("button", { name: /^Book a site visit$/i }),
  ).toHaveCount(1);
});
