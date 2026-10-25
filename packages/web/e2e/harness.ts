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

// moves the API's clock (it starts at 9:00 UTC on Monday 5 January 2026)
export const setClock = (at: string) =>
  control("/clock", { method: "POST", body: JSON.stringify({ at }) });

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
