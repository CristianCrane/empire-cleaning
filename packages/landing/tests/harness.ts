import { test as base, expect } from "@playwright/test";
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

type Email = { to: string; subject: string; text: string };

export const emailsTo = (address: string): Promise<Email[]> =>
  control(`/emails?to=${encodeURIComponent(address)}`);

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
