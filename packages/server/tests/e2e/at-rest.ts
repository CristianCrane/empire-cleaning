// A screen as a person would see it, for `pnpm pr:shots` (shots.ts): no
// focus ring or hover left by the last press, no toast over it (#407, #410),
// what's pinned to the screen where a person sees it, and the same picture
// each run. Each package's harness shoots the screen a test ends on with it
// (prShot). The type alone is Playwright's, so a spec runs this with its
// own checkout's Playwright, as shots.config.ts says
import { writeFileSync } from "node:fs";
import type { BrowserContext, Page, TestInfo } from "@playwright/test";

export const atRest = async (
  page: Page,
  // the screen as the test left it, not the whole page (--viewport)
  { viewport = false } = {},
): Promise<Buffer> => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    // React Aria's top layer: the toast region (and, in dev alone, a
    // prototype's bar, which no shot has)
    for (const toasts of document.querySelectorAll<HTMLElement>(
      "[data-react-aria-top-layer]",
    ))
      toasts.style.visibility = "hidden";
  });
  // the whole page, with what's pinned to the screen where a person sees
  // it: the top bar at the page's top, the tab bar at its foot. Chromium's
  // full-page shot draws them where the screen sat as the test ended,
  // mid-page (#414), so the screen is made as tall as the page instead.
  // What's sized by the screen's height grows with it (the desktop
  // sidebar), and may make the page taller, so it's measured again
  // (every project here sets a screen size, so there's always a width).
  // With --viewport, the screen as the test left it, and what a bar
  // pinned to it covers there (#430)
  const width = !viewport && page.viewportSize()?.width;
  for (let tries = 0; width && tries < 3; tries++) {
    const [height, screen] = await page.evaluate(() => [
      document.documentElement.scrollHeight,
      window.innerHeight,
    ]);
    if (height === screen) break;
    await page.setViewportSize({ width, height });
  }
  // a still frame, so one commit shoots one test the same each run
  // (pr:shots --same compares them byte for byte, #439): transitions run
  // to their end, as the hover the mouse just left fades out, and the shot
  // is taken again until two in a row match, as an image or font settles
  const still = () => page.screenshot({ animations: "disabled" });
  let shot = await still();
  for (let tries = 0; tries < 5; tries++) {
    const again = await still();
    if (again.equals(shot)) break;
    shot = again;
  }
  return shot;
};

// the end of a test that passed, at rest, attached as its "pr-shot" for
// pr:shots (shots.ts reads it from the report): each package's harness runs
// it after each test (prShot). Nothing outside pr:shots, or with no page
export const shootTheEnd = async (
  context: BrowserContext,
  testInfo: TestInfo,
) => {
  const [page] = context.pages();
  if (!process.env.PR_SHOTS_OUT || testInfo.status !== "passed" || !page)
    return;
  const shot = await atRest(page, {
    viewport: !!process.env.PR_SHOTS_VIEWPORT,
  });
  const path = testInfo.outputPath("pr-shot.png");
  writeFileSync(path, shot);
  await testInfo.attach("pr-shot", { path, contentType: "image/png" });
};
