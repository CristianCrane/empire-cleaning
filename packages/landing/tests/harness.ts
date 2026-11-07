import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
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

// every test starts from an empty database and no emails, and fails if the
// Content-Security-Policy (astro.config.ts) blocked anything a page loads
export const test = base.extend<{ cleanSlate: void; allowedByCsp: void }>({
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
});

// the accessibility check (axe), the only way a test runs it. It waits until
// nothing is animating: a part checked while it fades in fails on contrast
// now and then. React Aria's hidden live announcer is left out: a button
// pending as it navigates away leaves its announcement pointing at a label
// that's gone. The web app's (packages/web/e2e) also waits for a dialog to
// fade all the way in
export const expectAccessible = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const { violations } = await new AxeBuilder({ page })
    .exclude("[data-live-announcer]")
    .analyze();
  expect(
    violations.map((v) => ({
      rule: `${v.id}: ${v.help}`,
      on: v.nodes.map((n) => `${n.html}\n${n.failureSummary}`),
    })),
  ).toEqual([]);
};

export { expect };
