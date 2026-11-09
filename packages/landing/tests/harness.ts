import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import { controlUrl } from "../playwright.config.ts";

// talks to the e2e API's control server (packages/server/tests/e2e/server.ts)
const control = async (path: string) => {
  const res = await fetch(`${controlUrl}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
};

type Email = { to: string; subject: string; text: string };

export const emailsTo = (address: string): Promise<Email[]> =>
  control(`/emails?to=${encodeURIComponent(address)}`);

// an address of a test's own, to send the Quote form with: new each time, as
// the tests run in parallel against one database that nothing resets
export const newEmail = () => `casey-${crypto.randomUUID()}@example.com`;

// every test fails if the Content-Security-Policy (astro.config.ts) blocked
// anything a page loads
export const test = base.extend<{ allowedByCsp: void }>({
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
// that's gone. The web app's (packages/web/e2e) also waits until what it
// checks is fully opaque. axe runs in the page itself (legacy mode), asked
// for violations only: a third of the time of its default, which runs it in
// each frame and then again in a blank page, ~1 s a check. Legacy mode skips
// cross-origin iframes, which the site has none of
export const expectAccessible = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const { violations } = await new AxeBuilder({ page })
    .exclude("[data-live-announcer]")
    .setLegacyMode()
    .options({ resultTypes: ["violations"] })
    .analyze();
  expect(
    violations.map((v) => ({
      rule: `${v.id}: ${v.help}`,
      on: v.nodes.map((n) => `${n.html}\n${n.failureSummary}`),
    })),
  ).toEqual([]);
};

export { expect };
