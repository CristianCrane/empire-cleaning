import type { Page } from "@playwright/test";
import type { Language } from "@empire-cleaning/models";
import { uiWords } from "@empire-cleaning/ui/language";
import { cleanerTours } from "../src/screens/cleaner/tours.ts";
import { officeTours } from "../src/screens/office/tours.ts";
import { clientTours } from "../src/screens/portal/tours.ts";
import { toursFor, type AreaTours } from "../src/screens/tours.ts";
import {
  addCleaner,
  bookJob,
  createStaff,
  draftTheQuote,
  eachTheme,
  expect,
  expectAccessible,
  offerJob,
  quoteSent,
  requestQuoteAsGuest,
  requestReschedule,
  returnToTab,
  setClock,
  signedInAs,
  test,
} from "./harness.ts";

const olive = { email: "olive@example.com", name: "Olive Owner" };
const casey = { name: "Casey Client", email: "casey@example.com" };

// first-time help's tours in the test's own page, which every other spec
// (and every other browser here) is spared (harness.ts)
test.use({ showTours: true });

// the tour's step on the screen, by its title
const step = (page: Page, title: string) =>
  page.getByRole("dialog", { name: title });

// what the step points at: lit up, the rest of the page dimmed. Found as
// the tour finds it, by the words its name starts with
const expectPointedAt = (page: Page, words: string) =>
  expect(page.locator(".driver-active-element")).toHaveAccessibleName(
    new RegExp(`^${words.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );

// the area's tour with this id, walked through on the screen showing it:
// led by the area's value line when it's the `first` of the area's a person
// meets, then each step, pointing at its target, Next to the next and Got it
// to close, or closed by Escape at the last (`escape`). Checked for
// accessibility at the value line and the tour's first step
const walkTour = async (
  page: Page,
  area: AreaTours,
  id: string,
  { first = false, escape = false, lang = "en" as Language } = {},
) => {
  const buttons = uiWords[lang];
  const tour = area.tours.find((t) => t.id === id)!;
  if (first) {
    await expect(step(page, area.welcomeTitle)).toContainText(area.welcome);
    await expectAccessible(page);
    await step(page, area.welcomeTitle)
      .getByRole("button", { name: buttons.next })
      .click();
  }
  for (const [i, { target, title }] of tour.steps.entries()) {
    const last = i === tour.steps.length - 1;
    await expect(step(page, title)).toBeVisible();
    await expectPointedAt(
      page,
      "press" in target ? target.press : target.named,
    );
    if (i === 0) await expectAccessible(page);
    if (last && escape) await page.keyboard.press("Escape");
    else {
      await step(page, title)
        .getByRole("button", { name: last ? buttons.gotIt : buttons.next })
        .click();
    }
  }
  await expect(step(page, tour.steps.at(-1)!.title)).toBeHidden();
};

// each seen, on the Account: a tour whose step can't be found on its
// screen never runs, and fails here
const expectEachSeen = (page: Page, area: AreaTours) =>
  expect
    .poll(async () => {
      const me = await (await page.request.get("/api/me")).json();
      return (me.seenTours as string[])
        .filter((id) => area.tours.some((tour) => tour.id === id))
        .sort((a, b) => a.localeCompare(b));
    })
    .toEqual(
      area.tours.map((tour) => tour.id).sort((a, b) => a.localeCompare(b)),
    );

// each area with tours is walked through here; a new area's fails this
// until it is
test("every area's tours are walked through", () => {
  expect(Object.keys(toursFor)).toEqual(["portal", "office", "cleaner"]);
});

eachTheme(() => {
  test("a new Client meets each of the portal's tours once, as each screen first matters", async ({
    page,
    browser,
  }) => {
    const office = await (await browser.newContext()).newPage();
    await quoteSent(office, olive, casey);

    // Home, a Quote waiting: the first tour they meet leads with the value
    // line. Coming back to the tab asks for the Account again, and leaves
    // the tour
    await signedInAs(page, casey.email);
    await expect(step(page, clientTours.en.welcomeTitle)).toBeVisible();
    const lookedAgain = page.waitForResponse("**/api/me");
    await returnToTab(page);
    await lookedAgain;
    await walkTour(page, clientTours.en, "portal-home-quote", { first: true });

    // the Quote page; closed partway, it counts as seen just the same
    await page.getByRole("link", { name: "See your quote" }).click();
    await walkTour(page, clientTours.en, "portal-quote", { escape: true });

    await page
      .getByRole("region", { name: "Pay and book" })
      .getByRole("button", { name: /^Accept and pay \$/ })
      .click();
    await expect(page.getByText(/^You're booked: a /)).toBeVisible();

    // Home, once booked
    await page.getByRole("link", { name: "Home" }).first().click();
    await walkTour(page, clientTours.en, "portal-home-booked");

    await expectEachSeen(page, clientTours.en);
  });

  test("new Office Staff meet each of the Office's tours once, as each screen first matters", async ({
    page,
  }) => {
    for (const name of ["Cory Cleaner", "Dee Cleaner"]) await addCleaner(name);
    await requestQuoteAsGuest(casey);
    // Thursday's, within the week, so it's open to the free Cleaners
    const job = (await bookJob({
      startsAt: "2026-01-08T14:00:00.000Z",
      labourHours: 4,
    })) as { id: string };
    await requestReschedule(job.id, { date: "2026-01-09", time: "10:00" });
    await createStaff({ ...olive, roles: ["office_staff"] });

    // Today. Having seen a Client tour, they're still met by the Office's
    // value line: each area leads its own first tour with its own
    await signedInAs(page, olive.email);
    await page.request.put("/api/me/tours/portal-home-quote");
    await page.reload();
    await walkTour(page, officeTours, "office-today", { first: true });

    // the Quote asked for, drafted
    await page
      .getByRole("grid", { name: "Needs attention" })
      .getByRole("row", { name: /^Send a quote/ })
      .click();
    await draftTheQuote(page);
    await walkTour(page, officeTours, "office-quote-draft", { escape: true });

    // a Job with a new time asked for, and Cleaners Needed: one tour at a
    // time, the next on the next visit
    await page.goto(`/office/jobs/${job.id}`);
    await walkTour(page, officeTours, "office-job-new-time");
    await page.reload();
    await walkTour(page, officeTours, "office-job-cleaner-needed");

    await page.getByRole("link", { name: "Schedule", exact: true }).click();
    await walkTour(page, officeTours, "office-schedule");

    await expectEachSeen(page, officeTours);
  });

  test("a new Cleaner meets each of the Cleaner's tours once, as each screen first matters", async ({
    page,
  }) => {
    const cory = await addCleaner("Cory Cleaner");
    // within the week, each its own day: Tuesday's theirs, Wednesday's
    // offered to them, and Thursday's open to them, as they're free. A crew
    // of one, so theirs is fully crewed: Mark done waits for every Cleaner
    // on a Job to confirm
    const [theirs, offered, open] = (await Promise.all(
      ["06", "07", "08"].map((day) =>
        bookJob({
          startsAt: `2026-01-${day}T14:00:00.000Z`,
          labourHours: 4,
          crewSize: 1,
        }),
      ),
    )) as { id: string }[];
    await offerJob(theirs!.id, cory.id, { confirmed: true });
    await offerJob(offered!.id, cory.id);

    // Your Jobs, theirs next up
    await signedInAs(page, cory.email);
    await walkTour(page, cleanerTours, "cleaner-home", { first: true });

    await page.goto(`/cleaner/jobs/${offered!.id}`);
    await walkTour(page, cleanerTours, "cleaner-job-offered");

    await page.goto(`/cleaner/open/${open!.id}`);
    await walkTour(page, cleanerTours, "cleaner-open");

    // theirs, once it's started
    await setClock("2026-01-06T14:00:00.000Z");
    await page.goto(`/cleaner/jobs/${theirs!.id}`);
    await walkTour(page, cleanerTours, "cleaner-job");

    await expectEachSeen(page, cleanerTours);
  });
});
