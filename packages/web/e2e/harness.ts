import AxeBuilder from "@axe-core/playwright";
import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import type { Me, QuoteSource, StaffRole } from "@empire-cleaning/models";
import { THEME_STORAGE_KEY } from "@empire-cleaning/ui/theme-boot";
import { apiUrl, controlUrl } from "../playwright.config.ts";
import { tourIds } from "../src/screens/tours.ts";

// talks to the e2e API's control server (packages/server/tests/e2e/server.ts)
const control = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${controlUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
};

// the records an Account connects to when its person signs up (ADR-0006)
export const createStaff = (member: {
  email: string;
  name: string;
  roles: StaffRole[];
}) => control("/staff", { method: "POST", body: JSON.stringify(member) });

export const createClient = (client: {
  email: string;
  name: string;
  phone?: string;
}) => control("/clients", { method: "POST", body: JSON.stringify(client) });

// the hours a Staff member is usually available, Monday first
const setUsualWeek = (staffId: string, usualWeek: number[]) =>
  control(`/staff/${staffId}/usual-week`, {
    method: "PUT",
    body: JSON.stringify({ usualWeek }),
  });

// a Cleaner on Staff, their email their first name at example.com, usually
// free these hours each day, Monday first: 8 each weekday unless said
export const addCleaner = async (
  name: string,
  usualWeek = [8, 8, 8, 8, 8, 0, 0],
) => {
  const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
  const member = (await createStaff({ name, email, roles: ["cleaner"] })) as {
    id: string;
  };
  await setUsualWeek(member.id, usualWeek);
  return { id: member.id, email };
};

// every Charge is declined with this reason from now on; null to stop
export const failCharges = (reason: string | null = "card_declined") =>
  control("/payments/fail", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

// a card entered in the payment form needs the bank's approval from now on,
// which it gives ("approved"), refuses, or is still waiting on; null to stop
export const requireApproval = (
  answer: "approved" | "refused" | "pending" | null = "approved",
) =>
  control("/payments/approval", {
    method: "POST",
    body: JSON.stringify({ answer }),
  });

// a booked Job at a home of its own, straight onto the Schedule, a crew of
// 2 unless said: one Cleaner Confirmed on it can't mark it done alone
export const bookJob = (job: {
  startsAt: string;
  labourHours: number;
  crewSize?: number;
  // one of the seeded Services; a Deep Clean unless said
  service?: "standard" | "deep" | "moveInOut" | "commercial";
}) => control("/jobs", { method: "POST", body: JSON.stringify(job) });

// a Site Visit at the Property on `street`, booked for the Staff member
// with `staffEmail` as Office Staff book one (the Client is emailed)
export const bookSiteVisit = (visit: {
  street: string;
  staffEmail: string;
  date: string;
  time: string;
  minutes?: number;
}) =>
  control("/site-visits", {
    method: "POST",
    body: JSON.stringify(visit),
  }) as Promise<{ id: string }>;

// a Deep Clean booked by accepting a Quote, so it has a price: Quoted by
// the Office Staff member with `officeEmail` (signed up already), with a
// card saved by the Client and the Deposit taken
export const acceptedJob = (job: {
  startsAt: string;
  officeEmail: string;
  crewSize?: number;
  depositPercent?: number;
  addOns?: string[];
}) =>
  control("/jobs/accepted", {
    method: "POST",
    body: JSON.stringify(job),
  }) as Promise<{ id: string }>;

// a home whose First Clean is Completed, so it can be offered a Service
// Plan: Casey's Deep Clean at 9am on Monday 12 January, Quoted by the Office
// Staff member with `officeEmail` (signed up already) and done at 11am by
// Cory, a Cleaner added for it. The clock is left at 11am that day.
export const completedFirstClean = (officeEmail: string) =>
  control("/first-cleans/completed", {
    method: "POST",
    body: JSON.stringify({ officeEmail }),
  }) as Promise<{
    quoteRequestId: string;
    propertyId: string;
    job: { id: string };
  }>;

// a Service Plan Quote for the home, a Standard Clean from `startsAt` (or
// every week from each of several), Sent by the Office Staff member with
// `officeEmail` (signed up already)
export const sentServicePlanQuote = (plan: {
  officeEmail: string;
  propertyId: string;
  startsAt: string | string[];
  recurrence?: "weekly" | "fortnightly" | "four_weekly";
  crewSize?: number;
}) =>
  control("/service-plan-quotes", {
    method: "POST",
    body: JSON.stringify(plan),
  }) as Promise<{ id: string }>;

// a Service Plan started from such a Quote, its acceptance recorded by the
// Office on the Client's saved card
export const startedServicePlan = (plan: {
  officeEmail: string;
  propertyId: string;
  startsAt: string;
  recurrence?: "weekly" | "fortnightly" | "four_weekly";
  crewSize?: number;
}) =>
  control("/service-plans/started", {
    method: "POST",
    body: JSON.stringify(plan),
  }) as Promise<{ planId: string; firstJob: { id: string } }>;

// a Job marked Completed by a Cleaner Confirmed on it
export const completeJob = (
  jobId: string,
  staffId: string,
  input: {
    condition: "light" | "moderate" | "heavy";
    reports: { kind: "extra_time"; hours: number; reason: string }[];
  },
) =>
  control(`/jobs/${jobId}/complete`, {
    method: "POST",
    body: JSON.stringify({ staffId, ...input }),
  });

// No Access recorded by a Cleaner Confirmed on the Job
export const recordNoAccess = (
  jobId: string,
  staffId: string,
  reason: string,
) =>
  control(`/jobs/${jobId}/no-access`, {
    method: "POST",
    body: JSON.stringify({ staffId, reason }),
  });

// a Reschedule Request, as the Client sends it from the portal, at what it
// costs now
export const requestReschedule = (
  jobId: string,
  to: {
    date: string;
    time: string;
    cost?: "free" | "free_late" | "late_cancellation";
  },
) =>
  control(`/jobs/${jobId}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ cost: "free", ...to }),
  });

// Office Staff move a booked Job straight to a new time, New York's
export const moveJob = (jobId: string, to: { date: string; time: string }) =>
  control(`/jobs/${jobId}/move`, {
    method: "POST",
    body: JSON.stringify(to),
  });

// a Job Offered to a Cleaner (and Confirmed by them, if asked)
export const offerJob = (
  jobId: string,
  staffId: string,
  { confirmed = false } = {},
) =>
  control(`/jobs/${jobId}/assignments`, {
    method: "POST",
    body: JSON.stringify({ staffId, confirmed }),
  });

// A week billed for Casey, a business now, with premises: their Deep Clean
// at 9am on Wednesday 7 January, Quoted by the Office Staff member with
// `officeEmail` (signed up already) and done at noon by Cory, a Cleaner added
// for it, goes on bill EC-000001, made on Monday the 12th. It's charged
// automatically or paid on its page, as `payment` says. With `plan`, a weekly
// plan at the home from Thursday the 8th has its first Job on it too. With
// `failing`, its automatic Charge is declined, and Charges keep failing
// until failCharges(null). The clock is left at 10am on Monday the 12th; with
// `unbilled`, at noon on the day the last Job was done, before any Bill.
export const billedWeek = (week: {
  officeEmail: string;
  payment?: "automatic" | "on_page";
  billingEmail?: string;
  plan?: boolean;
  failing?: boolean;
  unbilled?: boolean;
}) =>
  control("/bills/billed-week", {
    method: "POST",
    body: JSON.stringify(week),
  }) as Promise<{
    clientId: string;
    // none while `unbilled`
    billId: string | null;
    jobId: string;
    planId: string | null;
  }>;

// how the test payment form pays a Bill on its page from now on: by card
// (the default), or by a bank debit that stays processing
export const payBillsBy = (by: "card" | "bank") =>
  control("/payments/bills-in-browser", {
    method: "POST",
    body: JSON.stringify({ by }),
  });
// moves the API's clock (it starts at 9:00 UTC on Monday 5 January 2026)
export const setClock = (at: string) =>
  control("/clock", { method: "POST", body: JSON.stringify({ at }) });

// what the server's timer does as the clock advances: Service Plans' Jobs
// coming within reach go on the Schedule
export const generatePlanJobs = () =>
  control("/service-plans/generate", { method: "POST" });

// an Account for this email, signed up the way people do, without a browser
export const signUp = (email: string) =>
  control("/sessions", { method: "POST", body: JSON.stringify({ email }) });

// as if the person had signed in with Google, which has this picture of them
export const setGooglePicture = (email: string, picture: string) =>
  control("/accounts/picture", {
    method: "POST",
    body: JSON.stringify({ email, picture }),
  });

type Email = { to: string; subject: string; text: string };

export const emailsTo = (address: string): Promise<Email[]> =>
  control(`/emails?to=${encodeURIComponent(address)}`);

// the path of the link in the latest email to `address` with this subject,
// as the person follows it
export const linkIn = async (address: string, subject: string) => {
  const sent = (await emailsTo(address)).findLast((e) => e.subject === subject);
  if (!sent) throw new Error(`no "${subject}" email was sent to ${address}`);
  return new URL(sent.text.match(/https?:\/\/\S+/)![0]).pathname;
};

// the sign-in link from the latest email to `address`, as the person would click it
export const signInLinkFor = async (address: string) => {
  const last = (await emailsTo(address)).at(-1);
  if (!last) throw new Error(`no email was sent to ${address}`);
  const link = last.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no link in the email to ${address}`);
  return link;
};

// opens the latest sign-in link to `email` and presses Sign in on its page
export const followSignInLink = async (page: Page, email: string) => {
  await page.goto(await signInLinkFor(email));
  await page.getByRole("button", { name: "Sign in" }).click();
};

// asks for a sign-in link on the page, then follows it from the email
export const signInWithLink = async (page: Page, email: string) => {
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  await followSignInLink(page, email);
};

// Starts a test signed in, without the sign-in form, the email or the extra
// page loads: the control server signs the person in for real and the session
// goes into the browser. Use it when signing in is not what the test is about;
// the sign-in tests use signInWithLink.
export const signedInAs = async (page: Page, email: string) => {
  const cookies = (await control("/sessions", {
    method: "POST",
    body: JSON.stringify({ email }),
  })) as { name: string; value: string }[];
  await page.context().addCookies(
    cookies.map((cookie) => ({
      ...cookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax" as const,
    })),
  );
  await page.goto("/");
};

// every test starts from an empty database and no emails, and fails if the
// Content-Security-Policy (vite.config.ts) blocked anything a page loads.
// First-time help's tours dim the page and take every press, so a test meets
// none, as if each had been seen, unless it asks to in its own page
// (showTours, tours.spec.ts)
export const test = base.extend<{
  cleanSlate: void;
  allowedByCsp: void;
  showTours: boolean;
  toursSeen: void;
}>({
  cleanSlate: [
    async ({}, use) => {
      await control("/reset", { method: "POST" });
      await use();
    },
    { auto: true },
  ],
  allowedByCsp: [
    async ({ context }, use) => {
      const blocked: string[] = [];
      await context.exposeBinding("cspBlocked", (_source, what: string) => {
        blocked.push(what);
      });
      await context.addInitScript(() =>
        document.addEventListener("securitypolicyviolation", (event) =>
          (
            window as unknown as { cspBlocked: (what: string) => void }
          ).cspBlocked(`${event.effectiveDirective}: ${event.blockedURI}`),
        ),
      );
      await use();
      expect(blocked, "blocked by the Content-Security-Policy").toEqual([]);
    },
    { auto: true },
  ],
  showTours: [false, { option: true }],
  toursSeen: [
    async ({ browser, context, showTours }, use) => {
      const routed: BrowserContext[] = [];
      const allSeen = (on: BrowserContext) => {
        routed.push(on);
        return on.route("**/api/me", async (route) => {
          const response = await route.fetch();
          if (!response.ok()) return route.fulfill({ response });
          const me: Me = await response.json();
          await route.fulfill({
            response,
            json: { ...me, seenTours: tourIds },
          });
        });
      };
      if (!showTours) await allSeen(context);
      // and in every browser a test opens beside its own, e.g. the Client's
      // while the Office's is open, tours shown in its own or not
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async (...options) => {
        const opened = await newContext(...options);
        await allSeen(opened);
        return opened;
      };
      await use();
      browser.newContext = newContext;
      // an answer still on its way as the test ends goes nowhere
      for (const on of routed) {
        await on.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
      }
    },
    { auto: true },
  ],
});

// a section in the navigation, wherever it shows: on a phone most of the
// Office's sit in its ☰ menu, which is opened first (#200). Whether it opened
// it, so a check can close it again
const showNavLink = async (page: Page, name: string) => {
  const link = page
    .getByRole("navigation")
    .getByRole("link", { name, exact: true })
    .filter({ visible: true });
  const menu = page.getByRole("button", { name: "Menu" });
  await expect(link.or(menu).first()).toBeVisible();
  if (await link.isVisible()) return { link, opened: false };
  await menu.click();
  await expect(link).toBeVisible();
  return { link, opened: true };
};

// goes to a section through the navigation
export const goTo = async (page: Page, name: string) => {
  const { link } = await showNavLink(page, name);
  await link.click();
};

// moves to another area ("Office", "Cleaner area", "Client portal") from the
// person's Account menu, which the test has opened, and waits until the area
// is on screen. The URL changes at once, but until the new area is ready the
// old one stays, its menu open (AreaLayout's AccountMenu), so a test that went
// on at the URL could press something in the old one, which then goes (#310)
export const switchArea = async (page: Page, area: string) => {
  await page.getByRole("row", { name: `Switch to ${area}` }).click();
  await expect(
    page.getByRole("navigation", { name: area, exact: true }).first(),
  ).toBeVisible();
};

// whether the navigation marks a section as the one you're in
export const expectCurrentSection = async (
  page: Page,
  name: string,
  current = true,
) => {
  const { link, opened } = await showNavLink(page, name);
  if (current) await expect(link).toHaveAttribute("aria-current", "page");
  else await expect(link).not.toHaveAttribute("aria-current", "page");
  if (opened) {
    await page.keyboard.press("Escape");
    await expect(link).toBeHidden();
  }
};

// the accessibility check (axe), the only way a test runs it. It waits until
// nothing is animating: a dialog checked while it opens is still fading in,
// and its text fails on contrast now and then. React Aria's hidden live
// announcer is left out: a button pending as it navigates away leaves its
// announcement pointing at a label that's gone. axe runs in the page itself
// (legacy mode), asked for violations only, as landing's does
// (packages/landing/tests/harness.ts): its default runs it in each frame and
// then again in a blank page, ~0.9 s a check against ~0.5 s. Legacy mode
// skips frames of another origin, so each must be hidden: Stripe.js adds its
// metrics frame, hidden, to every screen, and any other, such as the real
// card form, fails here rather than go unchecked.
// within: only part of the page, e.g. an open dialog (which hides the rest,
// main landmark and heading included, from assistive technology)
export const expectAccessible = async (page: Page, within?: string) => {
  await page.waitForFunction((selector) => {
    if (document.getAnimations().length) return false;
    // an animation can be yet to start: also wait until what's checked,
    // and all around it, is no longer see-through
    const checked = selector ? document.querySelector(selector) : document.body;
    for (let at = checked; at; at = at.parentElement) {
      if (getComputedStyle(at).opacity !== "1") return false;
    }
    return true;
  }, within);
  const { origin } = new URL(page.url());
  const shownElsewhere: string[] = [];
  for (const frame of page.mainFrame().childFrames()) {
    if (URL.canParse(frame.url()) && new URL(frame.url()).origin === origin) {
      continue;
    }
    const shown = await (
      await frame.frameElement()
    ).evaluate((node) => {
      const iframe = node as HTMLIFrameElement;
      return iframe.checkVisibility({ visibilityProperty: true })
        ? iframe.src
        : null;
    });
    if (shown !== null) shownElsewhere.push(shown || frame.url());
  }
  expect(shownElsewhere, "frames of another origin, which axe skips").toEqual(
    [],
  );
  const axe = new AxeBuilder({ page })
    .exclude("[data-live-announcer]")
    .setLegacyMode()
    .options({ resultTypes: ["violations"] });
  const { violations } = await (within ? axe.include(within) : axe).analyze();
  expect(
    violations.map((v) => ({
      rule: `${v.id}: ${v.help}`,
      on: v.nodes.map((n) => `${n.html}\n${n.failureSummary}`),
    })),
  ).toEqual([]);
};

// the tests in body, once in each theme: light, which runs on desktop too,
// and dark, which is something a person chooses, remembered on their device
export const eachTheme = (body: () => void) => {
  for (const theme of ["light", "dark"] as const) {
    test.describe(
      `${theme} theme`,
      { tag: theme === "light" ? "@desktop" : [] },
      () => {
        if (theme === "dark") {
          test.beforeEach(({ page }) =>
            page.addInitScript(
              (key) => localStorage.setItem(key, "dark"),
              THEME_STORAGE_KEY,
            ),
          );
        }
        body();
      },
    );
  }
};

// the quote form asks in steps: presses Next, which checks the step's
// required fields, and waits for the next step to show
export const nextStep = async (page: Page) => {
  const step = page.getByText(/^Step \d of \d$/);
  const before = await step.textContent();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(step).not.toHaveText(before!);
};

// the quote form's first step: the Service asked for, then on
export const chooseService = async (page: Page, name = "Standard Clean") => {
  await page.locator("form").getByText(name, { exact: true }).click();
  await nextStep(page);
};

export { expect };

// a Service on offer, by its name, as the form offers them
export const serviceKey = async (name: string) => {
  const offered = (await (
    await fetch(`${apiUrl}/api/services/on-offer`)
  ).json()) as { key: string; name: string }[];
  return offered.find((s) => s.name === name)!.key;
};

// a Standard Clean as a Guest asks for it from the landing page, straight
// to the e2e API of this worker (e2e/slots.ts), the page they asked from, and
// its language, which becomes the new Client's (ADR-0025)
export const requestQuoteAsGuest = async (
  contact: { name: string; email: string },
  addOnNames: string[] = [],
  source?: QuoteSource,
  lang: "en" | "es" = "en",
) => {
  const standard = await serviceKey("Standard Clean");
  // Add-ons are chosen by key, from those on offer
  const offered = (await (
    await fetch(`${apiUrl}/api/price-list/add-ons?service=${standard}`)
  ).json()) as { key: string; name: string }[];
  const addOns = offered
    .filter((addOn) => addOnNames.includes(addOn.name))
    .map((addOn) => addOn.key);

  const res = await fetch(`${apiUrl}/api/quotes/ask`, {
    method: "POST",
    headers: { "content-type": "application/json", "accept-language": lang },
    body: JSON.stringify({
      contact: { ...contact, phone: "(646) 555-0100" },
      property: {
        new: {
          kind: "residential",
          type: "apartment",
          street: "41-12 Austin St",
          unit: "4B",
          postcode: "11375",
          bedrooms: 2,
          bathrooms: 1.5,
          storeys: 1,
          pets: false,
        },
      },
      serviceKey: standard,
      condition: "moderate",
      wantsRegularService: true,
      addOns,
      source,
    }),
  });
  if (!res.ok) throw new Error(`quote request: ${res.status}`);
};

// on a Draft Quote, typed segment by segment as people do: Monday 12
// January 2026 at 9:00 AM, a week after the API's clock
// a business asking, as a Guest, for its Office premises (4,500 sq ft) to be
// cleaned on Monday, Wednesday and Friday evenings
export const requestQuoteForPremises = async (
  contact: { name: string; email: string },
  businessName: string,
) => {
  const types = (await (
    await fetch(`${apiUrl}/api/price-list/premises-types`)
  ).json()) as { key: string; name: string }[];

  const res = await fetch(`${apiUrl}/api/quotes/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contact: { ...contact, phone: "(646) 555-0100" },
      businessName,
      property: {
        new: {
          kind: "commercial",
          street: "200 Park Ave S",
          unit: "Floor 3",
          postcode: "10003",
          premisesType: types.find((t) => t.name === "Office")!.key,
          floorArea: 4500,
        },
      },
      serviceKey: await serviceKey("Commercial cleaning"),
      wantsRegularService: true,
      weekdays: [0, 2, 4],
      preferredTime: "18:00",
    }),
  });
  if (!res.ok) throw new Error(`quote request: ${res.status}`);
};

// types a start into a Draft's pickers, in `part`: a plan's weekday, or the
// page. The day goes last, as a weekday's section is named after it.
export const startOn = async (
  page: Page,
  part: Page | Locator,
  date: string,
  time: string,
) => {
  await part
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type(time);
  await part
    .getByRole("group", { name: "Date" })
    .getByRole("spinbutton", { name: /month/i })
    .click();
  await page.keyboard.type(date);
};

export const proposeNextMonday = (page: Page) =>
  startOn(page, page, "01122026", "0900AM");

// once the Draft has saved all that's on screen
export const saved = (page: Page) =>
  expect(
    page.getByRole("status").filter({ hasText: /saved|prices/ }),
  ).toHaveText("All changes saved");

// what the browser does when the person comes back to this tab
export const returnToTab = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.dispatchEvent(new Event("focus")));

// drafts the Requested Quote open on the page and waits for the Draft's
// page; `kind` answers the dialog that asks which, where either is possible
export const draftTheQuote = async (
  page: Page,
  kind?: "one-off" | "cleaning plan",
) => {
  await page.getByRole("button", { name: "Draft the quote" }).click();
  if (kind) {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: `A ${kind} quote` })
      .click();
  }
  await expect(page).toHaveURL(/\/office\/quotes\/[0-9a-f-]{36}\/draft$/);
};

// a one-off Quote the Client asked for as a Guest, Sent by `office` (added
// as Office Staff here) for 9am on Monday 12 January (proposeNextMonday),
// with two Cleaners free on weekdays so a crew of 2 fits. The page is left
// on the Quote.
export const quoteSent = async (
  page: Page,
  office: { email: string; name: string },
  client: { email: string; name: string },
) => {
  for (const name of ["Cory Cleaner", "Dee Cleaner"]) await addCleaner(name);
  await requestQuoteAsGuest(client);
  await createStaff({ ...office, roles: ["office_staff"] });
  await signedInAs(page, office.email);
  await page.goto("/office/quotes");
  await page.getByText(client.name).click();
  await draftTheQuote(page);
  await proposeNextMonday(page);
  await page.getByRole("button", { name: `Send to ${client.name}` }).click();
  await expect(page.getByText(`Quote sent to ${client.email}`)).toBeVisible();
};

// from a business's Quote whose premises haven't been seen: records the
// premises as the Office knows them, with no visit, and comes back
export const recordFindingsWithoutVisit = async (page: Page) => {
  const quote = page.url();
  await page.getByRole("link", { name: "property page", exact: true }).click();
  await page
    .getByRole("button", { name: "Record findings without a visit" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Record findings without a visit",
  });
  await dialog.getByText("Moderate", { exact: true }).click();
  await dialog.getByRole("button", { name: "Save findings" }).click();
  await expect(page.getByText("Findings recorded").first()).toBeVisible();
  await page.goto(quote);
};
