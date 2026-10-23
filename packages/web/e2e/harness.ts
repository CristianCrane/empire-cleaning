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
