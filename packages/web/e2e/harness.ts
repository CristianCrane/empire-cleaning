import { test as base, expect, type Page } from "@playwright/test";
import type { StaffRole } from "@empire-cleaning/models";
import { controlUrl } from "../playwright.config.ts";

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

export const createClient = (client: { email: string; name: string }) =>
  control("/clients", { method: "POST", body: JSON.stringify(client) });

// the hours a Staff member is usually available, Monday first
export const setUsualWeek = (staffId: string, usualWeek: number[]) =>
  control(`/staff/${staffId}/usual-week`, {
    method: "PUT",
    body: JSON.stringify({ usualWeek }),
  });

// every Charge is declined with this reason from now on; null to stop
export const failCharges = (reason: string | null = "card_declined") =>
  control("/payments/fail", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

// a card entered in the payment form needs the bank's approval from now on,
// which it gives ("approved"), refuses, or is still waiting on; null to stop
export const requireApproval = (
  then: "approved" | "refused" | "pending" | null = "approved",
) =>
  control("/payments/approval", {
    method: "POST",
    body: JSON.stringify({ then }),
  });

// a booked Job at a home of its own, straight onto the Schedule
export const bookJob = (job: {
  startsAt: string;
  labourHours: number;
  crewSize?: number;
  cleanType?: "standard" | "deep";
}) => control("/jobs", { method: "POST", body: JSON.stringify(job) });

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

// a Service Plan Quote for the home, a Standard Clean from `startsAt`, Sent
// by the Office Staff member with `officeEmail` (signed up already)
export const sentServicePlanQuote = (plan: {
  officeEmail: string;
  propertyId: string;
  startsAt: string;
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

// a Job marked Completed by a Cleaner with a Confirmed place on it
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

// No Access recorded by a Cleaner with a Confirmed place on the Job
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

// a place on a Job Offered to a Cleaner (and Confirmed by them, if asked)
export const offerPlace = (
  jobId: string,
  staffId: string,
  { confirmed = false } = {},
) =>
  control(`/jobs/${jobId}/assignments`, {
    method: "POST",
    body: JSON.stringify({ staffId, confirmed }),
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

// the sign-in link from the latest email to `address`, as the person would click it
export const signInLinkFor = async (address: string) => {
  const last = (await emailsTo(address)).at(-1);
  if (!last) throw new Error(`no email was sent to ${address}`);
  const link = last.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no link in the email to ${address}`);
  return link;
};

// asks for a sign-in link on the page, then follows it from the email
export const signInWithLink = async (page: Page, email: string) => {
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  await page.goto(await signInLinkFor(email));
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

// every test starts from an empty database and no emails
export const test = base.extend<{ cleanSlate: void }>({
  cleanSlate: [
    async ({}, use) => {
      await control("/reset", { method: "POST" });
      await use();
    },
    { auto: true },
  ],
});

export { expect };

// a Quote Request as a Guest sends it from the landing page, straight to the
// e2e API (packages/web/playwright.config.ts runs it on port 3100)
export const requestQuoteAsGuest = async (
  contact: { name: string; email: string },
  addOnNames: string[] = [],
) => {
  // Add-ons are chosen by key, from those on offer
  const offered = (await (
    await fetch("http://localhost:3100/api/price-list/add-ons")
  ).json()) as { key: string; name: string }[];
  const addOns = offered
    .filter((addOn) => addOnNames.includes(addOn.name))
    .map((addOn) => addOn.key);

  const res = await fetch("http://localhost:3100/api/quote-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contact: { ...contact, phone: "(646) 555-0100" },
      property: {
        new: {
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
      condition: "moderate",
      wantsRegularService: true,
      addOns,
    }),
  });
  if (!res.ok) throw new Error(`quote request: ${res.status}`);
};

// on a Draft Quote, typed segment by segment as people do: Monday 12
// January 2026 at 9:00 AM, a week after the API's clock
export const proposeNextMonday = async (page: Page) => {
  await page
    .getByRole("group", { name: "Date" })
    .getByRole("spinbutton", { name: /month/i })
    .click();
  await page.keyboard.type("01122026");
  await page
    .getByRole("group", { name: "Start time" })
    .getByRole("spinbutton", { name: /hour/i })
    .click();
  await page.keyboard.type("0900AM");
};

// what the browser does when the person comes back to this tab
export const returnToTab = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.dispatchEvent(new Event("focus")));
